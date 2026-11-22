import { ChevronRight, Plus } from 'lucide-react';
import { useId, useState, type Dispatch } from 'react';
import { SectionForm } from '../personalize/SectionForm';
import { LIMITS, type DraftIssues, type RecipeDraft } from '../../domain/draft';
import { DIFFICULTIES } from '../../domain/recipe';
import { useCategories } from '../../state/categoriesContext';
import { Sticker } from '../decor/Sticker';
import type { DraftAction } from './draftReducer';
import styles from './Editor.module.css';

interface Props {
  draft: RecipeDraft;
  dispatch: Dispatch<DraftAction>;
  issues: DraftIssues | null;
  open: boolean;
  onToggle: (open: boolean) => void;
}

/** Información adicional (desplegable): sección, tiempos, comensales, dificultad y notas. */
export function DetailsPanel({ draft, dispatch, issues, open, onToggle }: Props) {
  const ids = { prep: useId(), cook: useId(), servings: useId(), notes: useId() };
  const { categories, getInfo } = useCategories();
  const [creating, setCreating] = useState(false);
  const summary = [
    getInfo(draft.categoryId).name,
    draft.servings && `${draft.servings} comensales`,
    draft.prepMinutes && `${draft.prepMinutes} min de preparación`,
    draft.cookMinutes && `${draft.cookMinutes} min de cocción`,
    draft.difficulty && DIFFICULTIES.find((d) => d.id === draft.difficulty)?.label,
    draft.notes.trim() && 'con notas',
    draft.toTry && 'por probar',
  ]
    .filter(Boolean)
    .join(' · ');

  const number = (field: 'prepMinutes' | 'cookMinutes' | 'servings', id: string, label: string, placeholder: string) => (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={`${styles.input} ${issues?.[field] ? styles.invalid : ''}`}
        value={draft[field]}
        onChange={(e) => dispatch({ type: 'setText', field, value: e.target.value.replace(/[^\d]/g, '') })}
        inputMode="numeric"
        placeholder={placeholder}
        aria-invalid={Boolean(issues?.[field])}
        autoComplete="off"
      />
      {issues?.[field] && <p className={styles.error}>{issues[field]}</p>}
    </div>
  );

  return (
    <details className={styles.details} open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary className={styles.summary}>
        <span className={styles.summaryTitle}>
          <ChevronRight aria-hidden="true" />
          Información adicional
        </span>
        <span className={styles.optional}>opcional</span>
        <span className={styles.summaryChips}>{summary}</span>
      </summary>
      {open && (
        <div className={styles.detailsBody}>
          <fieldset className={`${styles.chips} ${styles.full}`}>
            <legend className={styles.label} style={{ marginBottom: 8 }}>
              Sección del libro
            </legend>
            {categories.map((category) => (
              <label key={category.id} className={styles.chip}>
                <input
                  type="radio"
                  name="category"
                  value={category.id}
                  checked={draft.categoryId === category.id}
                  onChange={() => dispatch({ type: 'setCategory', value: category.id })}
                />
                <Sticker id={category.character} width={26} />
                {category.shortName}
              </label>
            ))}
            {!creating && (
              <button type="button" className={styles.chip} onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" width={16} height={16} /> Nueva sección
              </button>
            )}
          </fieldset>
          {creating && (
            <div className={styles.full}>
              <SectionForm
                onCancel={() => setCreating(false)}
                onDone={(id) => {
                  setCreating(false);
                  dispatch({ type: 'setCategory', value: id });
                }}
              />
            </div>
          )}
          <label className={`${styles.full} ${styles.check}`}>
            <input
              type="checkbox"
              checked={draft.toTry}
              onChange={(e) => dispatch({ type: 'setToTry', value: e.target.checked })}
            />
            Aún no la he probado (aparecerá en «Por probar»)
          </label>
          {number('prepMinutes', ids.prep, 'Preparación (minutos)', '20')}
          {number('cookMinutes', ids.cook, 'Cocción (minutos)', '35')}
          {number('servings', ids.servings, 'Comensales', '4')}
          <fieldset className={`${styles.chips} ${styles.full}`}>
            <legend className={styles.label} style={{ marginBottom: 8 }}>
              Dificultad
            </legend>
            {[{ id: null, label: 'Sin indicar' }, ...DIFFICULTIES].map((d) => (
              <label key={d.id ?? 'none'} className={styles.chip}>
                <input
                  type="radio"
                  name="difficulty"
                  checked={draft.difficulty === d.id}
                  onChange={() => dispatch({ type: 'setDifficulty', value: d.id })}
                />
                {d.label}
              </label>
            ))}
          </fieldset>
          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor={ids.notes} className={styles.label}>
              Notas personales
            </label>
            <textarea
              id={ids.notes}
              className={`${styles.textarea} ${styles.notesInput}`}
              value={draft.notes}
              onChange={(e) => dispatch({ type: 'setText', field: 'notes', value: e.target.value })}
              maxLength={LIMITS.notes}
              placeholder="Trucos, variaciones, de quién es la receta…"
            />
            {draft.notes.length > LIMITS.notes * 0.8 && (
              <span className={styles.counter}>
                {draft.notes.length}/{LIMITS.notes}
              </span>
            )}
          </div>
        </div>
      )}
    </details>
  );
}
