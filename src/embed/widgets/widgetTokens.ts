import { css } from 'lit';

/** Shared brand tokens for Lit widget embeds. */
export const widgetHostTokens = css`
  :host {
    --landi-widget-color-primary: var(--landi-color-primary, #0d7377);
    --landi-widget-color-accent: var(--landi-color-accent, #c9a227);
    --landi-widget-color-error: var(--landi-color-error, #b04545);
    --landi-widget-color-text: var(--landi-color-text, #1a1a1a);
    --landi-widget-color-text-muted: var(--landi-color-text-muted, #6b7280);
    --landi-widget-color-surface: var(--landi-color-surface, #f7f9f9);
    --landi-widget-color-border: var(--landi-color-border, #e5e5e5);
    --landi-widget-radius-pill: var(--landi-radius-pill, 9999px);
    --landi-widget-radius-md: var(--landi-radius-md, 12px);
    --landi-widget-font-family: var(--landi-font-family, 'Inter', system-ui, sans-serif);
    --landi-widget-motion-scale: var(--landi-motion-scale, 1);
  }
`;

export const widgetVisuallyHidden = css`
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;
