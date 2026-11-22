/**
 * Medidor invisible: pinta las piezas de las recetas y del índice fuera de la
 * pantalla, con las mismas medidas que las páginas, y anota sus alturas.
 */
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { IndexEntryLine, IndexTitle } from '../components/pages/IndexPage';
import {
  IngredientLine,
  IngredientsHeading,
  IntroAside,
  MethodHeading,
  NotesBlock,
  RecipeHeader,
  StepItem,
} from '../components/recipe/RecipeBlocks';
import { layoutSignature, type Recipe } from '../domain/recipe';
import { geometryStyle } from './geometryStyle';
import type { PageGeometry } from './geometry';
import type { IndexEntry, IndexMeasure, RecipeMeasure } from './types';
import styles from './Measurer.module.css';

export interface IndexMeasureRequest {
  key: string;
  entries: IndexEntry[];
  labels: string[];
}

export interface MeasuredRecipe {
  id: string;
  /** Firma de la receta medida (`layoutSignature`): si cambia, se vuelve a medir. */
  stamp: string;
  measure: RecipeMeasure;
}

interface MeasurerProps {
  geometry: PageGeometry;
  recipes: Recipe[];
  index: IndexMeasureRequest | null;
  onRecipes: (geometryKey: string, measured: MeasuredRecipe[]) => void;
  onIndex: (key: string, measure: IndexMeasure) => void;
}

const height = (el: Element | null) => (el ? el.getBoundingClientRect().height : 0);
const heights = (root: Element, selector: string) => Array.from(root.querySelectorAll(selector), height);

export function Measurer({ geometry, recipes, index, onRecipes, onIndex }: MeasurerProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (recipes.length) {
      const result: MeasuredRecipe[] = [];
      for (const recipe of recipes) {
        const el = root.querySelector(`[data-recipe="${CSS.escape(recipe.id)}"]`);
        if (!el) continue;
        const measure: RecipeMeasure = {
          header: height(el.querySelector('[data-m="header"]')),
          ingredientsHeading: height(el.querySelector('[data-m="ing-heading"]')),
          ingredientLinesIntro: heights(el, '[data-m="ing-intro"] > li'),
          ingredientsHeadingFull: height(el.querySelector('[data-m="ing-heading-full"]')),
          ingredientsHeadingCont: height(el.querySelector('[data-m="ing-heading-cont"]')),
          ingredientLinesFull: heights(el, '[data-m="ing-full"] > li'),
          aside: height(el.querySelector('[data-m="aside"]')),
          photoStacked: height(el.querySelector('[data-m="photo-stacked"]')),
          methodHeading: height(el.querySelector('[data-m="method-heading"]')),
          methodHeadingCont: height(el.querySelector('[data-m="method-heading-cont"]')),
          steps: heights(el, '[data-m="steps"] > li'),
          notes: height(el.querySelector('[data-m="notes"]')),
        };
        result.push({ id: recipe.id, stamp: layoutSignature(recipe), measure });
      }
      onRecipes(geometry.key, result);
    }

    if (index) {
      const el = root.querySelector('[data-index]');
      if (el) {
        onIndex(index.key, {
          title: height(el.querySelector('[data-m="index-title"]')),
          titleCont: height(el.querySelector('[data-m="index-title-cont"]')),
          entries: heights(el, '[data-m="index-entries"] > li'),
        });
      }
    }
  }, [recipes, index, geometry, onRecipes, onIndex]);

  if (!recipes.length && !index) return null;

  const g = geometry;
  const introWidth = g.bodyWidth - g.asideWidth - g.introGap;

  return createPortal(
    <div ref={rootRef} className={styles.measurer} style={geometryStyle(g)} aria-hidden="true">
      {recipes.map((recipe) => {
        const columns = recipe.photoMode === 'process' ? g.processColumns : 1;
        const stepWidth = columns === 2 ? (g.bodyWidth - g.columnGap) / 2 : g.bodyWidth;
        return (
          <div key={recipe.id} data-recipe={recipe.id} className={styles.recipe}>
            <div style={box(g.bodyWidth)} data-m="header">
              <RecipeHeader recipe={recipe} servings={recipe.servings} />
            </div>
            <div style={box(introWidth)}>
              <div data-m="ing-heading">
                <IngredientsHeading empty={recipe.ingredients.length === 0} />
              </div>
              <ul data-m="ing-intro">
                {recipe.ingredients.map((i) => (
                  <IngredientLine key={i.id} ingredient={i} />
                ))}
              </ul>
            </div>
            <div style={box(g.asideWidth)}>
              <div data-m="aside" className={styles.aside}>
                <IntroAside recipe={recipe} width={g.asideWidth} />
              </div>
            </div>
            {recipe.photoMode === 'final' && recipe.coverPhotoId && (
              <div style={box(g.stackedPhotoWidth)}>
                <div data-m="photo-stacked" className={styles.aside}>
                  <IntroAside recipe={recipe} width={g.stackedPhotoWidth} />
                </div>
              </div>
            )}
            <div style={box(g.bodyWidth)}>
              <div data-m="ing-heading-full">
                <IngredientsHeading empty={recipe.ingredients.length === 0} />
              </div>
              <div data-m="ing-heading-cont">
                <IngredientsHeading continued />
              </div>
              <ul data-m="ing-full">
                {recipe.ingredients.map((i) => (
                  <IngredientLine key={i.id} ingredient={i} />
                ))}
              </ul>
              <div data-m="method-heading">
                <MethodHeading />
              </div>
              <div data-m="method-heading-cont">
                <MethodHeading continued />
              </div>
            </div>
            <ol data-m="steps" style={box(stepWidth)}>
              {recipe.steps.map((step, n) => (
                <StepItem key={step.id} step={step} number={n + 1} showPhoto={recipe.photoMode === 'process'} />
              ))}
            </ol>
            {recipe.notes && (
              <div style={box(g.bodyWidth)}>
                <div data-m="notes">
                  <NotesBlock notes={recipe.notes} />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {index && (
        <div data-index style={box(g.bodyWidth)}>
          <div data-m="index-title">
            <IndexTitle continued={false} />
          </div>
          <div data-m="index-title-cont">
            <IndexTitle continued />
          </div>
          <ol data-m="index-entries">
            {index.entries.map((entry, n) => (
              <IndexEntryLine key={n} entry={entry} label={index.labels[n]} number={888} />
            ))}
          </ol>
        </div>
      )}
    </div>,
    document.body,
  );
}

function box(width: number): CSSProperties {
  return { width, display: 'flow-root' };
}
