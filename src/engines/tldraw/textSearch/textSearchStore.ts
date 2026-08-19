import { atom } from 'tldraw';

/** Whether the canvas text search bar is visible. */
export const showTextSearchAtom = atom('showTextSearch', false);

/** Current query string in the search input. */
export const textSearchQueryAtom = atom('textSearchQuery', '');

/** Open the search bar (idempotent). */
export function openCanvasTextSearch(): void {
  if (!showTextSearchAtom.get()) {
    showTextSearchAtom.set(true);
  }
}

/** Close search and clear the query. */
export function closeCanvasTextSearch(): void {
  showTextSearchAtom.set(false);
  textSearchQueryAtom.set('');
}
