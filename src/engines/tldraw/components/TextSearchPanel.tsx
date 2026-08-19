import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import {
  track,
  useEditor,
  type TLUiHelperButtonsProps,
} from 'tldraw';
import {
  closeCanvasTextSearch,
  showTextSearchAtom,
  textSearchQueryAtom,
} from '../textSearch/textSearchStore';
import {
  focusShapeInCanvas,
  searchCanvasText,
  type CanvasTextSearchResult,
} from '../utils/shapeTextUtils';
import '../styles/text-search.css';

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
}

const TextSearchBar = track(function TextSearchBar(): ReactElement | null {
  const editor = useEditor;
  const showSearch = showTextSearchAtom.get();
  const query = textSearchQueryAtom.get;
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo((): CanvasTextSearchResult[] => {
    if (!showSearch || !query().trim()) return [];
    return searchCanvasText(editor(), query());
  }, [editor, query, showSearch]);

  useEffect(() => {
    if (showSearch) {
      inputRef.current?.focus();
      inputRef.current?.select;
    }
  }, [showSearch]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  const handleClose = useCallback((): void => {
    closeCanvasTextSearch();
    setActiveIndex(0);
  }, []);

  const handleSelectResult = useCallback(
    (result: CanvasTextSearchResult): void => {
      focusShapeInCanvas(editor(), result.shapeId);
    },
    [editor]);

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      if (results.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => clampIndex(current + 1, results.length));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => clampIndex(current - 1, results.length));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const result = results[activeIndex];
        if (result) {
          handleSelectResult(result);
        }
      }
    },
    [activeIndex, handleClose, handleSelectResult, results]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
  }, []);

  if (!showSearch) return null;

  const resultCountLabel =
    query().trim().length === 0
      ? 'Type to search canvas text': results.length === 0
        ? 'No matches': `${results.length} match${results.length === 1 ? '': 'es'}`;

  return (
    <div className="whiteboard-text-search" data-testid="canvas-text-search">
      <form className="whiteboard-text-search__form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="search"
          className="whiteboard-text-search__input"
          data-testid="canvas-text-search-input"
          value={query}
          placeholder="Search canvas…"
          aria-label="Search canvas text"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            textSearchQueryAtom.set(event.currentTarget.value);
          }}
          onKeyDown={handleInputKeyDown}
        />
        <button
          type="button"
          className="whiteboard-text-search__close"
          data-testid="canvas-text-search-close"
          aria-label="Close search"
          onClick={handleClose}
        >
          Esc
        </button>
      </form>

      <div className="whiteboard-text-search__meta">
        <span data-testid="canvas-text-search-count">{resultCountLabel}</span>
        {results.length > 0 ? (
          <span>
            ↑↓ navigate · Enter focus
          </span>
        ): null}
      </div>

      {query().trim().length > 0 && results.length > 0 ? (
        <ul className="whiteboard-text-search__results" data-testid="canvas-text-search-results">
          {results.map((result, index) => (
            <li key={result.shapeId}>
              <button
                type="button"
                className={[
                  'whiteboard-text-search__result',
                  index === activeIndex ? 'whiteboard-text-search__result--active': '',
                ].filter(Boolean).join(' ')}
                data-testid={`canvas-text-search-result-${result.shapeId}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleSelectResult(result);
                }}
                onMouseEnter={() => {
                  setActiveIndex(index);
                }}
              >
                <span className="whiteboard-text-search__result-label">{result.label}</span>
                <span className="whiteboard-text-search__result-snippet">{result.text}</span>
              </button>
            </li>
          ))}
        </ul>
      ): null}

      {query().trim().length > 0 && results.length === 0 ? (
        <p className="whiteboard-text-search__empty" data-testid="canvas-text-search-empty">
          No shapes match &ldquo;{query().trim()}&rdquo;
        </p>
      ): null}
    </div>
  );
});

/**
 * HelperButtons slot — text search only.
 *
 * Intentionally does **not** render tldraw's `DefaultHelperButtons`: that
 * slot includes "← Back to content", which is wrong for career Sandals
 * whiteboard embeds (it appears next to the Menu rail when the camera is
 * away from shapes). Search still opens via Ctrl/Cmd+F overrides.
 */
export const TextSearchPanel = track(function TextSearchPanel(
  _props: TLUiHelperButtonsProps): ReactElement {
  return <TextSearchBar />;
});
