import { Clapperboard, Mic, PenLine } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Assistant } from '../components/assistant/Assistant';
import { BookScene, type FocusRequest } from '../components/book/BookScene';
import { CookingMode } from '../components/cooking/CookingMode';
import { DictationSheet } from '../components/dictation/DictationSheet';
import { RecipeEditor, type EditorRequest } from '../components/editor/RecipeEditor';
import { ImportSheet } from '../components/importer/ImportSheet';
import { useMusicAutostart } from '../components/music/useAmbientMusic';
import { PersonalizeSheet } from '../components/personalize/PersonalizeSheet';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import type { CategoryId } from '../domain/categories';
import type { TableclothId } from '../domain/decorations';
import type { Recipe, RecipeId } from '../domain/recipe';
import { useViewport } from '../hooks/useViewport';
import { speechRecognitionSupported } from '../services/speech/recognition';
import { AchievementsProvider } from '../state/AchievementsProvider';
import { AssistantProvider } from '../state/AssistantProvider';
import { CategoriesProvider } from '../state/CategoriesProvider';
import { PreferencesProvider } from '../state/PreferencesProvider';
import { usePreferences } from '../state/preferencesContext';
import { RecipesProvider } from '../state/RecipesProvider';
import { useRecipes } from '../state/recipesContext';
import { ToastProvider } from '../state/ToastProvider';
import { useToast } from '../state/toastContext';
import styles from './App.module.css';

/** Clase de textura del mantel elegido (ver styles/textures.css). */
const TABLECLOTH_CLASS: Record<TableclothId, string> = {
  vichy: 'tex-tablecloth',
  'vichy-claro': 'tex-tablecloth tex-tablecloth-light',
  lino: 'tex-tablecloth tex-tablecloth-linen',
  madera: 'tex-tablecloth tex-tablecloth-wood',
};

export function App() {
  return (
    <ToastProvider>
      <PreferencesProvider>
        <RecipesProvider>
          <CategoriesProvider>
            <AchievementsProvider>
              <AssistantProvider>
                <Cookbook />
              </AssistantProvider>
            </AchievementsProvider>
          </CategoriesProvider>
        </RecipesProvider>
      </PreferencesProvider>
    </ToastProvider>
  );
}

/** Une el libro, el asistente, los formularios y las ventanas de diálogo. */
function Cookbook() {
  const { getRecipe, removeRecipe, toggleFavorite, markCooked } = useRecipes();
  const { prefs } = usePreferences();
  const toast = useToast();
  useMusicAutostart();
  const viewport = useViewport();
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [choosing, setChoosing] = useState<{ categoryId?: CategoryId } | null>(null);
  const [dictating, setDictating] = useState<{ categoryId?: CategoryId } | null>(null);
  const [importing, setImporting] = useState<{ categoryId?: CategoryId } | null>(null);
  const [cooking, setCooking] = useState<RecipeId | null>(null);
  const [viewed, setViewed] = useState<RecipeId | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [toDelete, setToDelete] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [personalizing, setPersonalizing] = useState(false);

  // «Nueva receta»: se elige entre escribirla o dictarla.
  const onCreate = useCallback((categoryId?: CategoryId) => setChoosing({ categoryId }), []);
  const onEdit = useCallback((recipeId: RecipeId) => setEditor({ mode: 'edit', recipeId }), []);
  const onDelete = useCallback(
    (recipeId: RecipeId) => {
      const recipe = getRecipe(recipeId);
      if (recipe) setToDelete(recipe);
    },
    [getRecipe],
  );
  const onCook = useCallback((recipeId: RecipeId) => setCooking(recipeId), []);
  const onViewRecipe = useCallback((recipeId: RecipeId | null) => setViewed(recipeId), []);

  const onToggleFavorite = useCallback((recipeId: RecipeId) => void toggleFavorite(recipeId), [toggleFavorite]);
  const onCooked = useCallback(
    async (recipeId: RecipeId) => {
      const result = await markCooked(recipeId);
      if (!result) return;
      const n = result.recipe.cookedCount;
      toast.show(
        n === 1
          ? `¡Apuntado! Has completado «${result.recipe.title}».`
          : `¡Otra vez! Ya has cocinado «${result.recipe.title}» ${n} veces.`,
        {
          tone: 'success',
          character: 'gato-calico-chef',
          action: { label: 'Deshacer', onClick: () => void result.undo() },
        },
      );
    },
    [markCooked, toast],
  );

  const onSaved = (recipe: Recipe, created: boolean) => {
    setEditor(null);
    setFocus({ recipeId: recipe.id, nonce: Date.now() });
    toast.show(created ? `«${recipe.title}» ya está en tu libro.` : `Cambios guardados en «${recipe.title}».`, {
      tone: 'success',
    });
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await removeRecipe(toDelete.id);
      toast.show(`Has arrancado «${toDelete.title}» del libro.`, { character: 'serpiente-canela' });
      setToDelete(null);
    } catch (error) {
      console.error('[recetas] No se pudo borrar', error);
      toast.show('No he podido borrar la receta. Inténtalo de nuevo.', { tone: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const cookingRecipe = cooking ? getRecipe(cooking) : undefined;
  const overlay = editor !== null || dictating !== null || importing !== null || cookingRecipe !== undefined || personalizing;
  const busy = overlay || toDelete !== null || choosing !== null;
  const canDictate = speechRecognitionSupported();

  return (
    <div className={`${styles.app} ${TABLECLOTH_CLASS[prefs.tablecloth]}`}>
      <div className={styles.scene} inert={busy}>
        <BookScene
          onCreate={onCreate}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onCooked={(id) => void onCooked(id)}
          onCook={onCook}
          onViewRecipe={onViewRecipe}
          onPersonalize={() => setPersonalizing(true)}
          focus={focus}
          busy={busy}
        />
      </div>

      <Assistant
        recipe={(viewed && getRecipe(viewed)) || null}
        onCook={onCook}
        onDictate={() => setDictating({})}
        onImport={() => setImporting({})}
        // En pantallas estrechas Tom taparía los botones de la importación.
        hidden={editor !== null || dictating !== null || personalizing || (importing !== null && viewport.width < 720)}
      />

      {personalizing && <PersonalizeSheet onClose={() => setPersonalizing(false)} />}

      {dictating && (
        <DictationSheet
          categoryId={dictating.categoryId}
          onClose={() => setDictating(null)}
          onDone={(draft) => {
            setDictating(null);
            setEditor({ mode: 'create', draft });
          }}
        />
      )}

      {importing && (
        <ImportSheet
          categoryId={importing.categoryId}
          onClose={() => setImporting(null)}
          onDone={(draft) => {
            setImporting(null);
            setEditor({ mode: 'create', draft });
          }}
        />
      )}

      {cookingRecipe && (
        <CookingMode
          recipe={cookingRecipe}
          onClose={() => setCooking(null)}
          onFinished={() => void onCooked(cookingRecipe.id)}
        />
      )}

      {editor && (
        <RecipeEditor
          key={editor.mode === 'edit' ? editor.recipeId : 'new'}
          request={editor}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      )}

      <Dialog
        open={choosing !== null}
        title="¿Cómo quieres escribirla?"
        character="gato-siames-bizcocho"
        onClose={() => setChoosing(null)}
        actions={
          <>
            <Button
              icon={<PenLine />}
              onClick={() => {
                setEditor({ mode: 'create', categoryId: choosing?.categoryId });
                setChoosing(null);
              }}
            >
              A mano
            </Button>
            <Button
              variant="primary"
              icon={<Mic />}
              disabled={!canDictate}
              onClick={() => {
                setDictating({ categoryId: choosing?.categoryId });
                setChoosing(null);
              }}
            >
              Dictándola con la voz
            </Button>
            <Button
              icon={<Clapperboard />}
              onClick={() => {
                setImporting({ categoryId: choosing?.categoryId });
                setChoosing(null);
              }}
            >
              De un vídeo
            </Button>
          </>
        }
      >
        {canDictate
          ? 'Puedes rellenar el formulario, dictármela o sacarla de un vídeo de TikTok o Instagram: luego la revisas antes de guardarla.'
          : 'Puedes escribirla a mano o sacarla de un vídeo de TikTok o Instagram (dictar no funciona en este navegador; prueba con Chrome o Edge).'}
      </Dialog>

      <Dialog
        open={toDelete !== null}
        title={`¿Arrancar «${toDelete?.title ?? ''}» del libro?`}
        character="raton-pizza"
        onClose={() => !deleting && setToDelete(null)}
        actions={
          <>
            <Button onClick={() => setToDelete(null)} disabled={deleting}>
              No, dejarla
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? 'Borrando…' : 'Sí, arrancarla'}
            </Button>
          </>
        }
      >
        Se borrará la receta con todas sus fotos. Esto no se puede deshacer.
      </Dialog>
    </div>
  );
}
