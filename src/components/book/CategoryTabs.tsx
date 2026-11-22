import { bookChrome, type PageGeometry } from '../../layout/geometry';
import type { BookLayout } from '../../layout/types';
import { useCategories } from '../../state/categoriesContext';
import styles from './CategoryTabs.module.css';

interface CategoryTabsProps {
  layout: BookLayout;
  geometry: PageGeometry;
  /** Primera página visible: las secciones anteriores asoman por la izquierda. */
  firstVisible: number;
  closed: boolean;
  onTab: (pageIndex: number) => void;
}

/**
 * Pestañas separadoras que asoman por el canto del cuaderno, como en un
 * recetario de anillas: al pasar una sección, su pestaña cambia de lado.
 */
export function CategoryTabs({ layout, geometry: g, firstVisible, closed, onTab }: CategoryTabsProps) {
  const { getInfo } = useCategories();
  const sections = layout.sections;
  if (!sections.length) return null;
  const spread = g.mode === 'spread';
  const gap = 6;
  const tabHeight = Math.min(96, Math.floor((g.pageHeight - 64) / Math.max(sections.length, 5)) - gap);
  const tuck = 10; // parte de la pestaña escondida bajo las hojas
  const rightEdge = spread ? g.pageWidth * 2 : g.pageWidth;
  const chrome = bookChrome(g.mode);

  return (
    <>
      {sections.map((section, i) => {
        const pageIndex = layout.sectionStart[section.categoryId];
        const onLeft = spread && !closed && pageIndex <= firstVisible;
        const art = getInfo(section.categoryId);
        const category = art;
        const width = chrome.tabOut + tuck;
        return (
          <button
            key={section.categoryId}
            type="button"
            className={`${styles.tab} ${onLeft ? styles.left : styles.right}`}
            style={{
              top: 30 + i * (tabHeight + gap),
              height: tabHeight,
              width,
              left: onLeft ? -chrome.tabOut - chrome.stack + 2 : rightEdge + chrome.stack - tuck - 2,
              background: art.color,
              color: art.ink,
            }}
            onClick={() => onTab(pageIndex)}
            aria-label={`Ir a la sección ${category.name}`}
            title={category.name}
          >
            <span className={styles.label}>{category.shortName}</span>
          </button>
        );
      })}
    </>
  );
}
