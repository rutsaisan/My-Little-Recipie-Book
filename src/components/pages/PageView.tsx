import { memo } from 'react';
import type { BookPage } from '../../layout/types';
import { AlbumPage } from './AlbumPage';
import { IndexPage } from './IndexPage';
import type { PageSide } from './PageFrame';
import { RecipePage } from './RecipePage';
import { ArtPage, EndpaperPage, FillerPage, NewRecipePage, SectionPage, TitlePage } from './SpecialPages';

/** Pinta cualquier página del libro según su tipo. */
export const PageView = memo(function PageView({ page, side }: { page: BookPage; side: PageSide }) {
  switch (page.kind) {
    case 'endpaper-front':
      return <EndpaperPage side={side} />;
    case 'endpaper-back':
      return <EndpaperPage side={side} back />;
    case 'title':
      return <TitlePage side={side} />;
    case 'index':
      return <IndexPage page={page} side={side} />;
    case 'section':
      return <SectionPage categoryId={page.categoryId} number={page.number} side={side} />;
    case 'art':
      return <ArtPage categoryId={page.categoryId} number={page.number} side={side} />;
    case 'filler':
      return <FillerPage seed={page.seed} number={page.number} side={side} />;
    case 'recipe':
      return <RecipePage page={page} side={side} />;
    case 'new-recipe':
      return <NewRecipePage number={page.number} side={side} />;
    case 'album':
      return <AlbumPage page={page} side={side} />;
  }
});
