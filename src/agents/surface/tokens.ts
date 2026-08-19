import { css } from 'lit';

/**
 * Base layout tokens for the canvas-wide operator surface.
 * Color tokens live in `operatorSurfaceDarkTheme` and MUST be applied after
 * `index.css` in the Lit static styles array so light `:host` defaults do not win.
 */
export const operatorSurfaceBaseStyles = css`:host {
    --operator-color-primary: var(--vibe-accent, #ff6b57);
    --operator-color-accent: var(--vibe-accent-2, #ff8f6b);
    --operator-color-surface: var(--vibe-background, #121212);
    --operator-color-panel: var(--vibe-surface, #1a1a1a);
    --operator-color-border: var(--vibe-border, rgb(255 255 255 / 0.09));
    --operator-color-text: var(--vibe-text, #ececec);
    --operator-color-text-muted: var(--vibe-text-muted, #9a9a9a);
    --operator-radius-sm: 6px;
    --operator-radius-md: 10px;
    --operator-font-family: var(
      --landi-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    --operator-shadow: none;

    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: 100%;
    font-family: var(--operator-font-family);
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    overflow: hidden;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  button,
  select {
    font: inherit;
  }
`;

/**
 * Dark gallery Atlas vibe palette for operator shadow DOM.
 * Applied AFTER inlined `index.css` so shadcn + Landi light `:host` tokens
 * cannot override the operator surface ( theme fix).
 */
export const operatorSurfaceDarkTheme = css`:host {
    color-scheme: dark;

    /* shadcn HSL tokens */
    --background: 0 0% 7%;
    --foreground: 0 0% 93%;
    --card: 0 0% 10%;
    --card-foreground: 0 0% 93%;
    --popover: 0 0% 10%;
    --popover-foreground: 0 0% 93%;
    --primary: 16 90% 55%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 14%;
    --secondary-foreground: 0 0% 93%;
    --muted: 0 0% 14%;
    --muted-foreground: 0 0% 62%;
    --accent: 0 0% 14%;
    --accent-foreground: 0 0% 93%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 100% 0.09;
    --input: 0 0% 8%;
    --ring: 16 90% 55%;

    /* Landi surface tokens (dark) */
    --landi-color-surface: #1f1f1f;
    --landi-color-surface-subtle: #141414;
    --landi-color-background: #121212;
    --landi-color-border: rgb(255 255 255 / 0.09);
    --landi-color-text: #ececec;
    --landi-color-text-muted: #9a9a9a;
    --landi-color-text-secondary: #6f6f6f;
    --landi-color-hover: rgb(255 255 255 / 0.06);

    /* Atlas vibe tokens — aligned with whiteboard-vibe-dark.css + ChatPanel */
    --vibe-accent: #ff6b57;
    --vibe-accent-2: #ff8f6b;
    --vibe-background: #121212;
    --vibe-surface: #1a1a1a;
    --vibe-composer-bg: #141414;
    --vibe-border: rgb(255 255 255 / 0.09);
    --vibe-text: #ececec;
    --vibe-text-muted: #9a9a9a;
    --vibe-text-faint: #6f6f6f;
    --vibe-hover-bg: rgb(255 255 255 / 0.06);
    --vibe-code-inline-bg: rgb(255 255 255 / 0.08);
    --vibe-code-block-bg: #0d0d0d;
    --vibe-disabled-bg: #3a3a3a;
    --vibe-scrollbar-thumb: rgb(255 255 255 / 0.22);

    /* Operator aliases (re-sync after vibe override) */
    --operator-color-surface: var(--vibe-background);
    --operator-color-panel: var(--vibe-surface);
    --operator-color-border: var(--vibe-border);
    --operator-color-text: var(--vibe-text);
    --operator-color-text-muted: var(--vibe-text-muted);

    color: var(--operator-color-text);
  }.operator-surface-shell {
    background: var(--operator-color-surface);
    color: var(--operator-color-text);
  }.operator-header {
    background: var(--operator-color-surface);
    border-color: var(--operator-color-border);
  }.thread-tabs {
    background: var(--operator-color-panel);
    border-color: var(--operator-color-border);
  }.thread-tab[aria-selected='true'] {
    background: var(--operator-color-surface);
    border-color: var(--operator-color-border);
    color: var(--operator-color-text);
  }.thread-tab[aria-selected='false'] {
    color: var(--operator-color-text-muted);
  }.thread-tab[aria-selected='false']:hover {
    color: var(--operator-color-text);
  }.empty-transcript {
    background: transparent;
    color: var(--vibe-text-faint);
  }.composer-shell {
    background: var(--vibe-composer-bg);
    border-color: var(--operator-color-border);
  }.operator-prompt-input {
    border-color: var(--vibe-border);
    background: var(--vibe-composer-bg);
  }.operator-prompt-input:focus-within {
    border-color: color-mix(in srgb, var(--vibe-accent) 55%, var(--vibe-border));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--vibe-accent) 35%, transparent);
  }.operator-model-switcher {
    border-color: var(--vibe-border);
    background: color-mix(in srgb, var(--vibe-surface) 88%, #000);
    color: var(--vibe-text-muted);
  }.operator-suggestion-chip {
    border-color: var(--vibe-border);
    background: color-mix(in srgb, var(--vibe-surface) 90%, #000);
    color: var(--vibe-text-muted);
  }.operator-suggestion-chip:hover {
    border-color: color-mix(in srgb, var(--vibe-accent) 40%, var(--vibe-border));
    background: var(--vibe-hover-bg);
    color: var(--vibe-text);
  }.operator-overlay-scroll {
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
  }.operator-overlay-scroll:hover {
    scrollbar-color: rgb(255 255 255 / 0.2) transparent;
  }.operator-overlay-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }.operator-overlay-scroll::-webkit-scrollbar-track {
    background: transparent;
  }.operator-overlay-scroll::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
  }.operator-overlay-scroll:hover::-webkit-scrollbar-thumb {
    background: rgb(255 255 255 / 0.2);
  }.operator-overlay-scroll:active::-webkit-scrollbar-thumb {
    background: rgb(255 255 255 / 0.28);
  }.composer-shell {
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
  }.operator-prompt-input textarea {
    min-height: 2.75rem;
    padding-bottom: 0.625rem;
    line-height: 1.45;
  }
`;

/** @deprecated Use operatorSurfaceBaseStyles + operatorSurfaceDarkTheme */
export const operatorSurfaceTokens = operatorSurfaceBaseStyles;
