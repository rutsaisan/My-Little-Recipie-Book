/**
 * Panel «Personalizar el libro»: nombre, portada, mantel, marcapáginas,
 * música, celebraciones y secciones propias. Los cambios se ven al momento.
 */
import { Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ACHIEVEMENTS } from '../../domain/achievements';
import { RIBBON_COLORS, TABLECLOTHS, tableclothAvailable } from '../../domain/decorations';
import { useAchievements } from '../../state/achievementsContext';
import { useCategories } from '../../state/categoriesContext';
import { DEFAULT_DEDICATION, usePreferences } from '../../state/preferencesContext';
import { useToast } from '../../state/toastContext';
import { customCategoryInfo, paletteVar } from '../decor/categoryArt';
import { Sticker } from '../decor/Sticker';
import { useAmbientMusic } from '../music/useAmbientMusic';
import { Button, IconButton } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { SectionForm } from './SectionForm';
import styles from './Personalize.module.css';

const TABLECLOTH_PREVIEW: Record<string, string> = {
  vichy: 'tex-tablecloth',
  'vichy-claro': 'tex-tablecloth tex-tablecloth-light',
  lino: 'tex-tablecloth tex-tablecloth-linen',
  madera: 'tex-tablecloth tex-tablecloth-wood',
};

export function PersonalizeSheet({ onClose }: { onClose: () => void }) {
  const { prefs, setPref } = usePreferences();
  const { stickers, unlocked } = useAchievements();
  const { custom, remove } = useCategories();
  const music = useAmbientMusic();
  const toast = useToast();
  const [slot, setSlot] = useState(0);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const ids = { owner: useId(), dedication: useId(), volume: useId(), title: useId() };
  const unlockedSet = new Set(unlocked.keys());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !toDelete && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, toDelete]);

  const placeSticker = (id: (typeof prefs.coverStickers)[number]) => {
    const next = [...prefs.coverStickers];
    const existing = id ? next.indexOf(id) : -1;
    if (existing !== -1) next[existing] = null; // cada pegatina, en un solo hueco
    next[slot] = id;
    setPref('coverStickers', next);
  };

  const deleting = custom.find((c) => c.id === toDelete);

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={`${styles.sheet} tex-paper`} role="dialog" aria-modal="true" aria-labelledby={ids.title}>
        <header className={styles.header}>
          <h2 id={ids.title} className={styles.title}>
            Personalizar el libro
          </h2>
          <IconButton label="Cerrar" variant="plain" onClick={onClose}>
            <X />
          </IconButton>
        </header>

        <div className={styles.scroll}>
          <section className={styles.group}>
            <h3 className={styles.groupTitle}>Tu libro</h3>
            <label htmlFor={ids.owner} className={styles.label}>
              Este recetario pertenece a…
            </label>
            <input
              id={ids.owner}
              className={styles.input}
              value={prefs.ownerName}
              maxLength={40}
              placeholder="Tu nombre"
              onChange={(e) => setPref('ownerName', e.target.value)}
            />
            <label htmlFor={ids.dedication} className={styles.label}>
              Frase de la portada
            </label>
            <input
              id={ids.dedication}
              className={styles.input}
              value={prefs.dedication}
              maxLength={50}
              placeholder={DEFAULT_DEDICATION}
              onChange={(e) => setPref('dedication', e.target.value)}
            />
          </section>

          <section className={styles.group}>
            <h3 className={styles.groupTitle}>Pegatinas de la portada</h3>
            <p className={styles.hint}>
              Cada insignia que consigues te regala su pegatina. Elige un hueco y después la pegatina.
            </p>
            <div className={styles.slots}>
              {prefs.coverStickers.map((id, i) => (
                <button
                  key={i}
                  type="button"
                  className={styles.slot}
                  aria-pressed={slot === i}
                  aria-label={`Hueco ${i + 1} de la portada${id ? '' : ' (vacío)'}`}
                  onClick={() => setSlot(i)}
                >
                  {id ? <Sticker id={id} width={46} /> : <span className={styles.slotEmpty}>{i + 1}</span>}
                </button>
              ))}
            </div>
            {stickers.length ? (
              <div className={styles.stickerGrid}>
                <button type="button" className={styles.stickerChoice} onClick={() => placeSticker(null)}>
                  Vacío
                </button>
                {stickers.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={styles.stickerChoice}
                    aria-pressed={prefs.coverStickers[slot] === id}
                    onClick={() => placeSticker(id)}
                    aria-label={`Poner la pegatina ${ACHIEVEMENTS.find((a) => a.character === id)?.title ?? id}`}
                  >
                    <Sticker id={id} width={40} />
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.hint}>Aún no tienes pegatinas: escribe tu primera receta para conseguir una.</p>
            )}
          </section>

          <section className={styles.group}>
            <h3 className={styles.groupTitle}>Mantel</h3>
            <div className={styles.cloths}>
              {TABLECLOTHS.map((t) => {
                const available = tableclothAvailable(t.id, unlockedSet);
                const by = ACHIEVEMENTS.find((a) => a.id === t.unlockedBy);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={styles.cloth}
                    aria-pressed={prefs.tablecloth === t.id}
                    disabled={!available}
                    onClick={() => setPref('tablecloth', t.id)}
                    title={available ? t.label : `Se consigue con la insignia «${by?.title}»`}
                  >
                    <span className={`${styles.clothSwatch} ${TABLECLOTH_PREVIEW[t.id]}`} />
                    <span>{t.label}</span>
                    {!available && (
                      <span className={styles.clothLock}>
                        <Lock aria-hidden="true" /> {by?.title}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.group}>
            <h3 className={styles.groupTitle}>Cinta del marcapáginas</h3>
            <div className={styles.swatches} role="radiogroup" aria-label="Color de la cinta">
              {RIBBON_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={prefs.ribbonColor === c.id}
                  aria-label={c.label}
                  title={c.label}
                  className={styles.swatch}
                  style={{ background: paletteVar(c.id) }}
                  onClick={() => setPref('ribbonColor', c.id)}
                />
              ))}
            </div>
          </section>

          <section className={styles.group}>
            <h3 className={styles.groupTitle}>Música y celebraciones</h3>
            <label className={styles.switchRow}>
              <input type="checkbox" checked={music.enabled} onChange={music.toggle} />
              Música ambiental relajante
            </label>
            <label htmlFor={ids.volume} className={styles.label}>
              Volumen
            </label>
            <input
              id={ids.volume}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={music.volume}
              onChange={(e) => music.setVolume(Number(e.target.value))}
              className={styles.range}
            />
            <label className={styles.switchRow}>
              <input
                type="checkbox"
                checked={prefs.celebrations}
                onChange={(e) => setPref('celebrations', e.target.checked)}
              />
              Celebrar las insignias nuevas
            </label>
            <p className={styles.hint}>Si lo apagas, las insignias se siguen guardando en tu álbum, sin avisos.</p>
          </section>

          <section className={styles.group}>
            <h3 className={styles.groupTitle}>Tus secciones</h3>
            {custom.length === 0 && editing !== 'new' && (
              <p className={styles.hint}>Además de las secciones de siempre, puedes crear las tuyas.</p>
            )}
            <ul className={styles.sectionList}>
              {custom.map((c) =>
                editing === c.id ? (
                  <li key={c.id}>
                    <SectionForm initial={c} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
                  </li>
                ) : (
                  <li key={c.id} className={styles.sectionRow}>
                    <span className={styles.sectionTab} style={{ background: customCategoryInfo(c).color }} />
                    <Sticker id={customCategoryInfo(c).character} width={34} />
                    <span className={styles.sectionName}>{c.name}</span>
                    <IconButton label={`Cambiar «${c.name}»`} size="sm" variant="plain" onClick={() => setEditing(c.id)}>
                      <Pencil />
                    </IconButton>
                    <IconButton label={`Borrar «${c.name}»`} size="sm" variant="plain" onClick={() => setToDelete(c.id)}>
                      <Trash2 />
                    </IconButton>
                  </li>
                ),
              )}
            </ul>
            {editing === 'new' ? (
              <SectionForm onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
            ) : (
              <Button size="sm" icon={<Plus />} onClick={() => setEditing('new')}>
                Nueva sección
              </Button>
            )}
          </section>
        </div>
      </aside>

      <Dialog
        open={Boolean(deleting)}
        title={`¿Borrar la sección «${deleting?.name ?? ''}»?`}
        character="raton-pizza"
        onClose={() => setToDelete(null)}
        actions={
          <>
            <Button onClick={() => setToDelete(null)}>No, dejarla</Button>
            <Button
              variant="danger"
              onClick={() => {
                const id = toDelete!;
                setToDelete(null);
                void remove(id).then(
                  () => toast.show('Sección borrada. Sus recetas están ahora en «Otras recetas».'),
                  () => toast.show('No he podido borrar la sección.', { tone: 'error' }),
                );
              }}
            >
              Sí, borrarla
            </Button>
          </>
        }
      >
        Sus recetas no se borran: pasan a «Otras recetas».
      </Dialog>
    </div>
  );
}
