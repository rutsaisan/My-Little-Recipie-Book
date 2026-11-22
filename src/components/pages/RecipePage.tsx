import { CookingPot, Heart, Pencil, Play, Trash2 } from 'lucide-react';
import type { Recipe } from '../../domain/recipe';
import type { PageGeometry } from '../../layout/geometry';
import type { BookPage, RecipeBlock } from '../../layout/types';
import { useCategories } from '../../state/categoriesContext';
import { useBook } from '../book/bookContext';
import {
  FootSticker,
  IngredientLine,
  IngredientsHeading,
  IntroAside,
  MethodHeading,
  NotesBlock,
  RecipeHeader,
  StepItem,
} from '../recipe/RecipeBlocks';
import { IconButton } from '../ui/Button';
import { PageFrame, type PageSide } from './PageFrame';
import styles from './RecipePage.module.css';

type RecipeBookPage = Extract<BookPage, { kind: 'recipe' }>;

export function RecipePage({ page, side }: { page: RecipeBookPage; side: PageSide }) {
  const book = useBook();
  const { recipesById, geometry, servingsFor, setServings, onEdit, onDelete, highlightRecipeId } = book;
  const { getInfo } = useCategories();
  const recipe = recipesById.get(page.recipeId);
  if (!recipe) return <PageFrame side={side} number={page.number} />;

  const servings = servingsFor(recipe);
  const factor = recipe.servings && servings ? servings / recipe.servings : 1;
  const category = getInfo(recipe.categoryId);
  const first = page.part === 0;

  const narrow = geometry.bodyWidth < 340;
  const cookedLabel =
    recipe.cookedCount > 0
      ? `¡La he cocinado otra vez! (van ${recipe.cookedCount})`
      : `¡La he cocinado! Marcar «${recipe.title}» como completada`;
  const head = (
    <div className={`${styles.head} ${side === 'left' ? styles.headLeft : ''}`}>
      <span className={styles.kicker}>
        {narrow ? category.shortName : category.name}
        {page.parts > 1 && <span className={styles.part}> · {page.part + 1}/{page.parts}</span>}
      </span>
      {first && (
        <span className={styles.actions}>
          <IconButton label={`Cocinar «${recipe.title}» paso a paso`} size="sm" variant="plain" onClick={() => book.onCook(recipe.id)}>
            <Play />
          </IconButton>
          <IconButton
            label={recipe.favorite ? `Quitar «${recipe.title}» de favoritas` : `Añadir «${recipe.title}» a favoritas`}
            size="sm"
            variant="plain"
            className={recipe.favorite ? styles.favOn : undefined}
            aria-pressed={recipe.favorite}
            onClick={() => book.onToggleFavorite(recipe.id)}
          >
            <Heart fill={recipe.favorite ? 'currentColor' : 'none'} />
          </IconButton>
          <IconButton label={cookedLabel} size="sm" variant="plain" onClick={() => book.onCooked(recipe.id)}>
            <CookingPot />
          </IconButton>
          <IconButton label={`Editar «${recipe.title}»`} size="sm" variant="plain" onClick={() => onEdit(recipe.id)}>
            <Pencil />
          </IconButton>
          <IconButton
            label={`Eliminar «${recipe.title}»`}
            size="sm"
            variant="plain"
            onClick={() => onDelete(recipe.id)}
          >
            <Trash2 />
          </IconButton>
        </span>
      )}
    </div>
  );

  return (
    <PageFrame
      side={side}
      number={page.number}
      head={head}
      label={`${recipe.title} (página ${page.number})`}
      className={highlightRecipeId === recipe.id ? styles.fresh : undefined}
    >
      {page.blocks.map((block, index) => (
        <RecipeBlockView
          key={`${block.type}-${index}`}
          block={block}
          recipe={recipe}
          factor={factor}
          servings={servings}
          geometry={geometry}
          onServingsChange={(value) => setServings(recipe.id, value)}
        />
      ))}
    </PageFrame>
  );
}

interface BlockProps {
  block: RecipeBlock;
  recipe: Recipe;
  factor: number;
  servings: number | null;
  geometry: PageGeometry;
  onServingsChange: (value: number) => void;
}

function RecipeBlockView({ block, recipe, factor, servings, geometry, onServingsChange }: BlockProps) {
  switch (block.type) {
    case 'header':
      return <RecipeHeader recipe={recipe} servings={servings} onServingsChange={onServingsChange} />;

    case 'intro':
      return (
        <div className={styles.intro}>
          <div className={styles.introIngredients}>
            <IngredientsHeading empty={recipe.ingredients.length === 0} />
            <ul>
              {recipe.ingredients.slice(0, block.to).map((ingredient) => (
                <IngredientLine key={ingredient.id} ingredient={ingredient} factor={factor} />
              ))}
            </ul>
          </div>
          <div className={styles.introAside}>
            <IntroAside recipe={recipe} width={geometry.asideWidth} />
          </div>
        </div>
      );

    case 'photo':
      return (
        <div className={styles.stackedPhoto}>
          <div style={{ width: geometry.stackedPhotoWidth }} className={styles.stackedPhotoBox}>
            <IntroAside recipe={recipe} width={geometry.stackedPhotoWidth} />
          </div>
        </div>
      );

    case 'ingredients':
      return (
        <div className={styles.block}>
          <IngredientsHeading continued={block.continued} empty={!block.continued && recipe.ingredients.length === 0} />
          <ul>
            {recipe.ingredients.slice(block.from, block.to).map((ingredient) => (
              <IngredientLine key={ingredient.id} ingredient={ingredient} factor={factor} />
            ))}
          </ul>
        </div>
      );

    case 'method':
      return (
        <div className={styles.block}>
          <MethodHeading continued={block.continued} />
          <div className={styles.columns}>
            {block.columns.map((column, c) => (
              <ol key={c} className={styles.column}>
                {column.map((stepIndex) => (
                  <StepItem
                    key={recipe.steps[stepIndex].id}
                    step={recipe.steps[stepIndex]}
                    number={stepIndex + 1}
                    showPhoto={recipe.photoMode === 'process'}
                  />
                ))}
              </ol>
            ))}
          </div>
        </div>
      );

    case 'notes':
      return <NotesBlock notes={recipe.notes} />;

    case 'sticker':
      return <FootSticker recipeId={recipe.id} height={geometry.stickerBlockHeight} />;
  }
}
