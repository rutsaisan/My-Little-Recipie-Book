import { useId, useState } from 'react';
import { CHARACTERS, type CharacterId } from '../../assets/characters';
import { CATEGORY_NAME_MAX, PALETTE_COLORS, type PaletteColorId } from '../../domain/categories';
import { validateCategoryName, type CategoryInput } from '../../services/categoryService';
import { useCategories } from '../../state/categoriesContext';
import { paletteVar } from '../decor/categoryArt';
import { Sticker } from '../decor/Sticker';
import { Button } from '../ui/Button';
import styles from './Personalize.module.css';

const ANIMALS = (Object.keys(CHARACTERS) as CharacterId[]).filter((id) => id !== 'vapor');

interface SectionFormProps {
  /** Valores iniciales (al editar una sección). */
  initial?: CategoryInput & { id: string };
  onDone: (id: string) => void;
  onCancel: () => void;
}

/** Crear o cambiar una sección propia: nombre, animalito, color y frase. */
export function SectionForm({ initial, onDone, onCancel }: SectionFormProps) {
  const { categories, create, update } = useCategories();
  const [name, setName] = useState(initial?.name ?? '');
  const [character, setCharacter] = useState<string>(initial?.character ?? 'patito-naranja');
  const [color, setColor] = useState<PaletteColorId>(initial?.color ?? 'caramelo');
  const [phrase, setPhrase] = useState(initial?.phrase ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const phraseId = useId();

  const submit = async () => {
    const taken = categories.filter((c) => c.id !== initial?.id).map((c) => c.name);
    const problem = validateCategoryName(name, taken);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const input = { name, character, color, phrase };
      if (initial) {
        await update(initial.id, input);
        onDone(initial.id);
      } else {
        onDone((await create(input)).id);
      }
    } catch {
      setError('No he podido guardar la sección. Inténtalo de nuevo.');
      setBusy(false);
    }
  };

  return (
    <div className={styles.sectionForm}>
      <label htmlFor={nameId} className={styles.label}>
        Nombre de la sección
      </label>
      <input
        id={nameId}
        className={styles.input}
        value={name}
        maxLength={CATEGORY_NAME_MAX}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        placeholder="Por ejemplo: Recetas de la abuela"
        autoFocus
      />
      {error && <p className={styles.error}>{error}</p>}

      <p className={styles.label}>Animalito del separador</p>
      <div className={styles.animalGrid} role="radiogroup" aria-label="Animalito del separador">
        {ANIMALS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={character === id}
            aria-label={CHARACTERS[id].alt}
            className={styles.animal}
            onClick={() => setCharacter(id)}
          >
            <Sticker id={id} width={40} />
          </button>
        ))}
      </div>

      <p className={styles.label}>Color de la pestaña</p>
      <div className={styles.swatches} role="radiogroup" aria-label="Color de la pestaña">
        {PALETTE_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={color === c.id}
            aria-label={c.label}
            title={c.label}
            className={styles.swatch}
            style={{ background: paletteVar(c.id) }}
            onClick={() => setColor(c.id)}
          />
        ))}
      </div>

      <label htmlFor={phraseId} className={styles.label}>
        Frase del separador <span className={styles.optional}>opcional</span>
      </label>
      <input
        id={phraseId}
        className={styles.input}
        value={phrase}
        maxLength={60}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder="Una frase bonita para esta sección"
      />

      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => void submit()} disabled={busy}>
          {initial ? 'Guardar cambios' : 'Crear sección'}
        </Button>
      </div>
    </div>
  );
}
