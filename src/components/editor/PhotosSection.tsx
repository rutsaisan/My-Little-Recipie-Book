import { ArrowRight, Info } from 'lucide-react';
import { useId, type Dispatch } from 'react';
import { LIMITS, type DraftIssues, type RecipeDraft } from '../../domain/draft';
import { Sticker } from '../decor/Sticker';
import { Button } from '../ui/Button';
import type { DraftAction } from './draftReducer';
import { PhotoSlot } from './PhotoSlot';
import styles from './Editor.module.css';

interface Props {
  draft: RecipeDraft;
  dispatch: Dispatch<DraftAction>;
  issues: DraftIssues | null;
  onUrlCreated: (url: string) => void;
  onGoToSteps: () => void;
  autoFocusTitle: boolean;
}

/** Apartado 1: nombre de la receta y cómo se presentan las fotos. */
export function PhotosSection({ draft, dispatch, issues, onUrlCreated, onGoToSteps, autoFocusTitle }: Props) {
  const titleId = useId();
  const errorId = useId();
  const stepPhotos = draft.steps.filter((s) => s.photo).length;

  return (
    <div className={styles.panel}>
      <div className={styles.field}>
        <label htmlFor={titleId} className={styles.label}>
          Nombre de la receta
        </label>
        <input
          id={titleId}
          className={`${styles.input} ${styles.titleInput} ${issues?.title ? styles.invalid : ''}`}
          value={draft.title}
          maxLength={LIMITS.title}
          placeholder="Por ejemplo: Bizcocho de yogur de la abuela"
          onChange={(e) => dispatch({ type: 'setText', field: 'title', value: e.target.value })}
          aria-invalid={Boolean(issues?.title)}
          aria-describedby={issues?.title ? errorId : undefined}
          autoFocus={autoFocusTitle}
          autoComplete="off"
        />
        {issues?.title && (
          <p id={errorId} className={styles.error}>
            {issues.title}
          </p>
        )}
      </div>

      <fieldset className={styles.question}>
        <legend className={styles.questionLegend}>¿Cómo quieres presentar las fotografías?</legend>
        <div className={styles.modeGrid}>
          <label className={styles.modeCard}>
            <input
              type="radio"
              name="photoMode"
              value="final"
              checked={draft.photoMode === 'final'}
              onChange={() => dispatch({ type: 'setPhotoMode', value: 'final' })}
            />
            <Sticker id="raya-pila-tortitas" width={74} className={styles.modeArt} />
            <span className={styles.modeTitle}>Una foto final</span>
            <span className={styles.modeText}>Del plato terminado, al lado de los ingredientes.</span>
          </label>
          <label className={styles.modeCard}>
            <input
              type="radio"
              name="photoMode"
              value="process"
              checked={draft.photoMode === 'process'}
              onChange={() => dispatch({ type: 'setPhotoMode', value: 'process' })}
            />
            <Sticker id="raya-sarten" width={58} className={styles.modeArt} />
            <span className={styles.modeTitle}>Fotos del proceso</span>
            <span className={styles.modeText}>Una foto debajo de cada paso de la elaboración.</span>
          </label>
        </div>
      </fieldset>

      {draft.photoMode === null && (
        <p className={styles.hint}>Puedes elegirlo ahora o más tarde; si no tienes fotos, deja «Una foto final» sin foto.</p>
      )}

      {draft.photoMode === 'final' && (
        <div className={styles.photoArea}>
          <PhotoSlot
            value={draft.coverPhoto}
            onChange={(value) => dispatch({ type: 'setCover', value })}
            label="Foto del plato terminado"
            onUrlCreated={onUrlCreated}
          />
          <p className={styles.hint} style={{ maxWidth: 260 }}>
            Se verá en la página como una foto pegada junto a los ingredientes. Es opcional: la puedes añadir más
            tarde.
          </p>
        </div>
      )}

      {draft.photoMode === 'process' && (
        <div className={styles.notice}>
          <Info aria-hidden="true" />
          <div>
            <p>Añadirás una foto a cada paso en el apartado «Elaboración»; cada foto aparecerá debajo de su paso.</p>
            <Button size="sm" variant="ghost" icon={<ArrowRight />} onClick={onGoToSteps}>
              Ir a Elaboración
            </Button>
          </div>
        </div>
      )}

      {draft.photoMode === 'final' && stepPhotos > 0 && (
        <p className={styles.notice}>
          <Info aria-hidden="true" />
          Hay {stepPhotos === 1 ? 'una foto' : `${stepPhotos} fotos`} en los pasos. Con «Una foto final» no se
          guardarán.
        </p>
      )}
      {draft.photoMode === 'process' && draft.coverPhoto && (
        <p className={styles.notice}>
          <Info aria-hidden="true" />
          Ya habías puesto una foto final. Con «Fotos del proceso» no se guardará.
        </p>
      )}
    </div>
  );
}
