import type { CSSProperties } from 'react';
import { HOLE_OFFSET, RING_PITCH, RING_START } from '../components/decor/spiralGeometry';
import type { PageGeometry } from './geometry';

/** Variables CSS con las medidas de la página, para el libro y el medidor. */
export function geometryStyle(g: PageGeometry): CSSProperties {
  return {
    '--page-w': `${g.pageWidth}px`,
    '--page-h': `${g.pageHeight}px`,
    '--pad-top': `${g.padTop}px`,
    '--pad-bottom': `${g.padBottom}px`,
    '--pad-inner': `${g.padInner}px`,
    '--pad-outer': `${g.padOuter}px`,
    '--head-h': `${g.headHeight}px`,
    '--foot-h': `${g.footHeight}px`,
    '--body-w': `${g.bodyWidth}px`,
    '--body-h': `${g.bodyHeight}px`,
    '--block-gap': `${g.blockGap}px`,
    '--step-gap': `${g.stepGap}px`,
    '--col-gap': `${g.columnGap}px`,
    '--aside-w': `${g.asideWidth}px`,
    '--intro-gap': `${g.introGap}px`,
    '--step-photo-max': g.processColumns === 2 ? '100%' : '300px',
    '--hole-offset': `${HOLE_OFFSET}px`,
    '--ring-start': `${RING_START}px`,
    '--ring-pitch': `${RING_PITCH}px`,
  } as CSSProperties;
}
