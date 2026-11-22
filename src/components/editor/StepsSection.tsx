import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState, type Dispatch } from 'react';
import { LIMITS, newStepRow, type DraftIssues, type PhotoRef, type StepDraft } from '../../domain/draft';
import type { PhotoMode } from '../../domain/recipe';
import { Button, IconButton } from '../ui/Button';
import type { DraftAction } from './draftReducer';
import { PendingNote } from './PendingNote';
import { PhotoSlot } from './PhotoSlot';
import { sortableA11y } from './sortableA11y';
import styles from './Editor.module.css';

interface Props {
  steps: StepDraft[];
  photoMode: PhotoMode | null;
  dispatch: Dispatch<DraftAction>;
  issues: DraftIssues | null;
  onUrlCreated: (url: string) => void;
}

/** Apartado 3: pasos de elaboración, con foto opcional y reordenables. */
export function StepsSection({ steps, photoMode, dispatch, issues, onUrlCreated }: Props) {
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const keys = steps.map((s) => s.key);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const add = () => {
    const row = newStepRow();
    dispatch({ type: 'addStep', row });
    setFocusKey(row.key);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      dispatch({ type: 'moveStep', from: keys.indexOf(String(active.id)), to: keys.indexOf(String(over.id)) });
    }
  };

  return (
    <div className={styles.panel}>
      <p className={styles.panelIntro}>
        Cuenta la receta paso a paso, como se lo explicarías a alguien en tu cocina.
        {photoMode === 'process'
          ? ' Cada paso puede llevar su foto, que aparecerá justo debajo del texto.'
          : ' Si eliges «Fotos del proceso» en el apartado 1, podrás poner una foto en cada paso.'}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={sortableA11y(keys, 'paso')}
      >
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <ol className={styles.rows}>
            {steps.map((step, index) => (
              <StepRow
                key={step.key}
                step={step}
                index={index}
                count={steps.length}
                withPhoto={photoMode === 'process'}
                error={issues?.steps[step.key]}
                autoFocus={step.key === focusKey}
                onText={(text) => dispatch({ type: 'updateStep', key: step.key, patch: { text } })}
                onConfirm={() => dispatch({ type: 'updateStep', key: step.key, patch: { pending: undefined } })}
                onPhoto={(photo) => dispatch({ type: 'updateStep', key: step.key, patch: { photo } })}
                onMove={(to) => dispatch({ type: 'moveStep', from: index, to })}
                onRemove={() => dispatch({ type: 'removeStep', key: step.key })}
                onUrlCreated={onUrlCreated}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <Button icon={<Plus />} onClick={add}>
        Añadir paso
      </Button>
    </div>
  );
}

interface RowProps {
  step: StepDraft;
  index: number;
  count: number;
  withPhoto: boolean;
  error?: string;
  autoFocus: boolean;
  onText: (text: string) => void;
  onConfirm: () => void;
  onPhoto: (photo: PhotoRef | null) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onUrlCreated: (url: string) => void;
}

function StepRow({ step, index, count, withPhoto, error, autoFocus, onText, onConfirm, onPhoto, onMove, onRemove, onUrlCreated }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.key });
  const n = index + 1;
  const length = step.text.length;

  return (
    <li
      ref={setNodeRef}
      className={`${styles.stepRow} ${step.pending ? styles.pendingRow : ''} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className={styles.stepSide}>
        <span className={styles.stepNumber} aria-hidden="true">
          {n}
        </span>
        <button type="button" className={styles.handle} aria-label={`Mover el paso ${n}`} {...attributes} {...listeners}>
          <GripVertical />
        </button>
      </div>
      <div className={styles.stepMain}>
        <textarea
          className={`${styles.textarea} ${error ? styles.invalid : ''}`}
          value={step.text}
          onChange={(e) => onText(e.target.value)}
          maxLength={LIMITS.stepText}
          rows={3}
          placeholder={n === 1 ? 'Por ejemplo: Precalienta el horno a 180 °C y engrasa el molde.' : 'Describe este paso…'}
          aria-label={`Paso ${n}`}
          aria-invalid={Boolean(error)}
          autoFocus={autoFocus}
        />
        {length > LIMITS.stepText * 0.8 && (
          <span className={styles.counter}>
            {length}/{LIMITS.stepText}
          </span>
        )}
        {error && !step.pending && <p className={styles.rowError}>{error}</p>}
        {step.pending && <PendingNote reason={step.pending} showError={Boolean(error)} onConfirm={onConfirm} />}
        {withPhoto && (
          <PhotoSlot
            value={step.photo}
            onChange={onPhoto}
            label={`Foto del paso ${n}`}
            size="small"
            onUrlCreated={onUrlCreated}
          />
        )}
      </div>
      <div className={styles.stepActions}>
        <IconButton label={`Subir el paso ${n}`} variant="plain" size="sm" onClick={() => onMove(index - 1)} disabled={index === 0}>
          <ArrowUp />
        </IconButton>
        <IconButton
          label={`Bajar el paso ${n}`}
          variant="plain"
          size="sm"
          onClick={() => onMove(index + 1)}
          disabled={index === count - 1}
        >
          <ArrowDown />
        </IconButton>
        <IconButton label={`Quitar el paso ${n}`} variant="plain" size="sm" onClick={onRemove}>
          <Trash2 />
        </IconButton>
      </div>
    </li>
  );
}
