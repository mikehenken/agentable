import type { TLUiOverrides } from 'tldraw';
import { openCanvasTextSearch } from './textSearchStore';

export const TEXT_SEARCH_ACTION_ID = 'text-search';

/** tldraw action override — Ctrl/Cmd+F opens canvas text search. */
export const textSearchTldrawOverrides: TLUiOverrides = {
  actions(_editor, actions) {
    return {
      ...actions,
      [TEXT_SEARCH_ACTION_ID]: {
        id: TEXT_SEARCH_ACTION_ID,
        label: 'action.text-search',
        kbd: 'cmd+f,ctrl+f',
        onSelect() {
          openCanvasTextSearch();
        },
      },
    };
  },
  translations: {
    en: {
      'action.text-search': 'Search canvas',
    },
  },
};
