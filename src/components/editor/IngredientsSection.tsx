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
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState, type Dispatch } from 'react';
import { LIMITS, newIngredientRow, type DraftIssues, type IngredientDraft } from '../../domain/draft';
import { getUnit, UNIT_GROUPS, UNITS } from '../../domain/units';
import { Button, IconButton } from '../ui/Button';
import type { DraftAction } from './draftReducer';
import { PendingNote } from './PendingNote';
import { sortableA11y } from './sortableA11y';
import styles from './Editor.module.css';

interface Props {
  ingredients: IngredientDraft[];
  dispatch: Dispatch<DraftAction>;
  issues: DraftIssues | null;
}

/** Apartado 2: lista de ingredientes con cantidad y unidad, reordenable. */
export function IngredientsSection({ ingredients, dispatch, issues }: Props) {
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const keys = ingredients.map((i) => i.key);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const add = (afterKey?: string) => {
    const row = newIngredientRow();
    dispatch({ type: 'addIngredient', row, afterKey });
    setFocusKey(row.key);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      dispatch({ type: 'moveIngredient', from: keys.indexOf(String(active.id)), to: keys.indexOf(String(over.id)) });
    }
  };

  return (
    <div className={styles.panel}>
      <p className={styles.panelIntro}>
        Escribe cada ingrediente con su cantidad y su unidad, por ejemplo <em>200 · gramos · harina</em>. Pulsa
        Intro al terminar uno para añadir otro. Puedes arrastrarlos por el asa para cambiarlos de orden.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={sortableA11y(keys, 'ingrediente')}
      >
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <ul className={styles.rows}>
            {ingredients.map((row, index) => (
              <IngredientRow
                key={row.key}
                row={row}
                index={index}
                error={issues?.ingredients[row.key]}
                autoFocus={row.key === focusKey}
                onChange={(patch) => dispatch({ type: 'updateIngredient', key: row.key, patch })}
                onRemove={() => dispatch({ type: 'removeIngredient', key: row.key })}
                onEnter={() => add(row.key)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Button icon={<Plus />} onClick={() => add()}>
        Añadir ingrediente
      </Button>
    </div>
  );
}

interface RowProps {
  row: IngredientDraft;
  index: number;
  error?: { quantity?: string; name?: string; pending?: string };
  autoFocus: boolean;
  onChange: (patch: Partial<Omit<IngredientDraft, 'key'>>) => void;
  onRemove: () => void;
  onEnter: () => void;
}

function IngredientRow({ row, index, error, autoFocus, onChange, onRemove, onEnter }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const unit = getUnit(row.unit);
  const n = index + 1;

  return (
    <li
      ref={setNodeRef}
      className={`${styles.row} ${row.pending ? styles.pendingRow : ''} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className={styles.handle} aria-label={`Mover el ingrediente ${n}`} {...attributes} {...listeners}>
        <GripVertical />
      </button>
      <input
        className={`${styles.input} ${styles.qty} ${error?.quantity ? styles.invalid : ''}`}
        value={unit.noQuantity ? '' : row.quantity}
        onChange={(e) => onChange({ quantity: e.target.value })}
        placeholder={unit.noQuantity ? '—' : row.pending && !row.quantity ? '¿?' : '200'}
        inputMode="decimal"
        aria-label={`Cantidad del ingrediente ${n}`}
        aria-invalid={Boolean(error?.quantity)}
        disabled={unit.noQuantity}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      <select
        className={`${styles.select} ${styles.unit}`}
        value={row.unit}
        onChange={(e) => onChange({ unit: e.target.value })}
        aria-label={`Unidad del ingrediente ${n}`}
      >
        {UNIT_GROUPS.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {UNITS.filter((u) => u.group === group.id).map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <input
        className={`${styles.input} ${styles.name} ${error?.name ? styles.invalid : ''}`}
        value={row.name}
        onChange={(e) => onChange({ name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder="harina de trigo"
        maxLength={LIMITS.ingredientName}
        aria-label={`Ingrediente ${n}`}
        aria-invalid={Boolean(error?.name)}
        autoComplete="off"
      />
      <IconButton label={`Quitar el ingrediente ${n}`} variant="plain" size="sm" className={styles.remove} onClick={onRemove}>
        <Trash2 />
      </IconButton>
      {(error?.quantity || error?.name) && <p className={styles.rowError}>{error.name ?? error.quantity}</p>}
      {row.pending && (
        <PendingNote reason={row.pending} showError={Boolean(error?.pending)} onConfirm={() => onChange({ pending: undefined })} />
      )}
    </li>
  );
}
