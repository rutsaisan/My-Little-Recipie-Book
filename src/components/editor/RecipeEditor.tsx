/**
 * Formulario para escribir o editar una receta, con aspecto de bloc de notas.
 * Tres apartados (fotografías, ingredientes, elaboración) y un desplegable de
 * información adicional. Nada se guarda hasta pulsar «Guardar en el libro».
 */
import { ArrowLeft, ArrowRight, BookHeart, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { CategoryId } from '../../domain/categories';
import {
  createEmptyDraft,
  draftFromRecipe,
  draftHasContent,
  validateDraft,
  type RecipeDraft,
} from '../../domain/draft';
import { countPending } from '../../domain/importDraft';
import type { Recipe, RecipeId } from '../../domain/recipe';
import { useRecipes } from '../../state/recipesContext';
import { useToast } from '../../state/toastContext';
import { Sticker } from '../decor/Sticker';
import { Button, IconButton } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { DetailsPanel } from './DetailsPanel';
import { draftReducer } from './draftReducer';
import { IngredientsSection } from './IngredientsSection';
import { PhotosSection } from './PhotosSection';
import { StepsSection } from './StepsSection';
import styles from './Editor.module.css';

export type EditorRequest =
  | { mode: 'create'; categoryId?: CategoryId; /** Borrador ya relleno (p. ej. dictado). */ draft?: RecipeDraft }
  | { mode: 'edit'; recipeId: RecipeId };

interface RecipeEditorProps {
  request: EditorRequest;
  onClose: () => void;
  onSaved: (recipe: Recipe, created: boolean) => void;
}

type Tab = 'photos' | 'ingredients' | 'steps';

const TABS: { id: Tab; label: string }[] = [
  { id: 'photos', label: 'Fotografías' },
  { id: 'ingredients', label: 'Ingredientes' },
  { id: 'steps', label: 'Elaboración' },
];

let editorSession = 0;

export function RecipeEditor({ request, onClose, onSaved }: RecipeEditorProps) {
  const { getRecipe, saveDraft } = useRecipes();
  const toast = useToast();
  const existing = request.mode === 'edit' ? getRecipe(request.recipeId) : undefined;
  const [initial] = useState<RecipeDraft>(() =>
    existing
      ? draftFromRecipe(existing)
      : request.mode === 'create' && request.draft
        ? request.draft
        : createEmptyDraft(request.mode === 'create' ? request.categoryId : undefined),
  );
  const [draft, dispatch] = useReducer(draftReducer, initial);
  const [tab, setTab] = useState<Tab>('photos');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const urls = useRef(new Set<string>());
  const mounted = useRef(false);
  const baseId = useId();

  const validation = useMemo(() => validateDraft(draft), [draft]);
  const issues = showErrors ? validation.issues : null;
  const prefilled = request.mode === 'create' && Boolean(request.draft);
  const imported = prefilled && initial.source?.kind === 'video';
  const pendingCount = countPending(draft);
  const dirty = (draft !== initial || prefilled) && (Boolean(existing) || draftHasContent(draft));

  const tabHasPending = (id: Tab) =>
    id === 'ingredients'
      ? draft.ingredients.some((i) => i.pending)
      : id === 'steps'
        ? draft.steps.some((s) => s.pending)
        : Boolean(draft.pendingFields?.includes('title'));

  const tabHasError = (id: Tab) => {
    if (tabHasPending(id)) return true;
    if (!showErrors) return false;
    if (id === 'photos') return Boolean(validation.issues.title);
    if (id === 'ingredients') return Object.keys(validation.issues.ingredients).length > 0;
    return Object.keys(validation.issues.steps).length > 0;
  };

  // Las URL temporales de las fotos nuevas se liberan al cerrar.
  useEffect(() => {
    const created = urls.current;
    // También las de los fotogramas que trae un borrador importado.
    const own = [initial.coverPhoto, ...initial.steps.map((s) => s.photo)];
    for (const ref of own) if (ref?.kind === 'new') created.add(ref.url);
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Se espera un instante: en desarrollo React desmonta y vuelve a montar.
      window.setTimeout(() => {
        if (!mounted.current) created.forEach((url) => URL.revokeObjectURL(url));
      }, 0);
    };
  }, [initial]);

  // ── Cerrar (botón, Esc o botón «atrás» del móvil) ────────────────────────
  const latest = useRef({ dirty, onClose });
  useLayoutEffect(() => {
    latest.current = { dirty, onClose };
  });

  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  useEffect(() => {
    const session = ++editorSession;
    let closedByBack = false;
    if (!(history.state as { recipeEditor?: boolean } | null)?.recipeEditor) {
      history.pushState({ recipeEditor: true }, '');
    }
    const onPop = () => {
      if (latest.current.dirty) {
        history.pushState({ recipeEditor: true }, '');
        setConfirmClose(true);
      } else {
        closedByBack = true;
        latest.current.onClose();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Al cerrar desde la interfaz se retira la entrada del historial
      // (salvo que el componente se vuelva a montar al momento).
      window.setTimeout(() => {
        if (editorSession === session && !closedByBack && (history.state as { recipeEditor?: boolean } | null)?.recipeEditor) {
          history.back();
        }
      }, 0);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const goTo = (next: Tab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const save = async () => {
    if (!validation.ok) {
      setShowErrors(true);
      const section = validation.firstSection;
      if (section === 'details') setDetailsOpen(true);
      else if (section) goTo(section);
      toast.show('Revisa lo que está marcado antes de guardar.', { tone: 'error', duration: 4000 });
      return;
    }
    setSaving(true);
    try {
      const recipe = await saveDraft(draft);
      onSaved(recipe, !existing);
    } catch (error) {
      console.error('[editor] No se pudo guardar', error);
      toast.show('No he podido guardar la receta. Comprueba que el navegador permite guardar datos y vuelve a intentarlo.', {
        tone: 'error',
      });
      setSaving(false);
    }
  };

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const onUrlCreated = (url: string) => urls.current.add(url);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${baseId}-heading`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !confirmClose) {
          e.stopPropagation();
          requestClose();
        }
      }}
    >
      <div className={`${styles.sheet} tex-paper`}>
        <div className={styles.rings} aria-hidden="true" />
        <header className={styles.header}>
          <Sticker id="gato-siames-bizcocho" width={84} motion="bob" className={styles.headerSticker} />
          <div className={styles.headerText}>
            <p className={styles.kicker}>{existing ? 'Editando receta' : 'Receta nueva'}</p>
            <h2 id={`${baseId}-heading`} className={`${styles.heading} ${draft.title.trim() ? '' : styles.headingEmpty}`}>
              {draft.title.trim() || 'Sin nombre todavía'}
            </h2>
          </div>
          <IconButton label="Cerrar sin guardar" onClick={requestClose}>
            <X />
          </IconButton>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Apartados de la receta">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`${baseId}-panel`}
              className={styles.tab}
              onClick={() => goTo(t.id)}
            >
              <span className={styles.tabNumber}>{i + 1}</span>
              {t.label}
              {tabHasError(t.id) && <span className={styles.tabAlert} aria-label="(hay algo que revisar)" />}
            </button>
          ))}
        </div>

        <div ref={scrollRef} className={styles.scroll}>
          {prefilled && !imported && (
            <p className={styles.notice} style={{ marginTop: 0, marginBottom: 16 }}>
              He colocado lo que me dictaste. Revísalo en los tres apartados (sobre todo cantidades y unidades) y
              pulsa «Guardar en el libro».
            </p>
          )}
          {imported && (
            <div className={styles.notice} style={{ marginTop: 0, marginBottom: 16 }}>
              <div>
                <p>
                  {pendingCount > 0
                    ? `He sacado la receta del vídeo. Hay ${pendingCount === 1 ? '1 dato marcado' : `${pendingCount} datos marcados`} «Por confirmar»: corrígelos o pulsa «Confirmar» en cada uno antes de guardar.`
                    : 'He sacado la receta del vídeo y no queda nada por confirmar. Échale un último vistazo y pulsa «Guardar en el libro».'}
                </p>
                {(initial.importWarnings?.length ?? 0) > 0 && (
                  <ul className={styles.importWarnings}>
                    {initial.importWarnings?.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${tab}`} key={tab}>
            {tab === 'photos' && (
              <PhotosSection
                draft={draft}
                dispatch={dispatch}
                issues={issues}
                onUrlCreated={onUrlCreated}
                onGoToSteps={() => goTo('steps')}
                autoFocusTitle={!existing}
              />
            )}
            {tab === 'ingredients' && (
              <IngredientsSection ingredients={draft.ingredients} dispatch={dispatch} issues={issues} />
            )}
            {tab === 'steps' && (
              <StepsSection
                steps={draft.steps}
                photoMode={draft.photoMode}
                dispatch={dispatch}
                issues={issues}
                onUrlCreated={onUrlCreated}
              />
            )}
          </div>
          <DetailsPanel draft={draft} dispatch={dispatch} issues={issues} open={detailsOpen} onToggle={setDetailsOpen} />
        </div>

        <footer className={styles.footer}>
          <Button variant="ghost" onClick={requestClose} disabled={saving}>
            Cancelar
          </Button>
          <div className={styles.footerNav}>
            {tabIndex > 0 && (
              <Button icon={<ArrowLeft />} onClick={() => goTo(TABS[tabIndex - 1].id)} disabled={saving}>
                Anterior
              </Button>
            )}
            {tabIndex < TABS.length - 1 && (
              <Button onClick={() => goTo(TABS[tabIndex + 1].id)} disabled={saving}>
                Siguiente <ArrowRight style={{ width: 16, height: 16, marginLeft: 4, verticalAlign: '-3px' }} />
              </Button>
            )}
            <Button variant="primary" icon={<BookHeart />} onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar en el libro'}
            </Button>
          </div>
        </footer>
      </div>

      <Dialog
        open={confirmClose}
        title="¿Cerrar sin guardar?"
        character="raton-pizza"
        onClose={() => setConfirmClose(false)}
        actions={
          <>
            <Button onClick={() => setConfirmClose(false)}>Seguir escribiendo</Button>
            <Button variant="danger" onClick={onClose}>
              Cerrar sin guardar
            </Button>
          </>
        }
      >
        Lo que has escrito en esta receta se perderá.
      </Dialog>
    </div>
  );
}
