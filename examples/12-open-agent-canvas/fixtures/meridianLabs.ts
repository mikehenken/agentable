/**
 * Fictional Meridian Labs fixtures (rule 4).
 * Data-only — no src/ imports (gallery import guard).
 */

export const MERIDIAN_LABS_BRAND = {
  name: 'Meridian Labs',
  tagline: 'Fictional product design studio',
  tenant: 'meridian-labs',
} as const;

/** Scripted gallery demo agent — matches P12 harness persona. */
export const MERIDIAN_AGENT = {
  agentId: 'meridian-designer',
  agentLabel: 'Meridian Designer',
} as const;

/** Auto-layout bounds for the connected funnel diagram on gallery hosts. */
export const MERIDIAN_WIREFRAME_PLACEMENT = {
  kind: 'rect' as const,
  x: 360,
  y: 48,
  w: 280,
  h: 520,
};

/** Connected landing-page wireframe — logical structure only (no coordinates). */
export const MERIDIAN_WIREFRAME_FLOW = {
  layout: 'flow' as const,
  diagram: {
    nodes: [
      { id: 'nav-bar', label: 'Navigation', kind: 'box' as const },
      { id: 'hero', label: 'Hero headline', kind: 'box' as const },
      { id: 'feature-grid', label: 'Feature grid', kind: 'box' as const },
      { id: 'signup-cta', label: 'Sign up CTA', kind: 'box' as const },
    ],
    edges: [
      { from: 'nav-bar', to: 'hero', label: 'scroll' },
      { from: 'hero', to: 'feature-grid' },
      { from: 'feature-grid', to: 'signup-cta' },
    ],
  },
};

/** Wireframe stencil placements (Meridian Labs onboarding screen). */
export const MERIDIAN_WIREFRAME_STENCILS = [
  {
    stencil: 'nav' as const,
    label: 'Meridian nav',
    geometry: { kind: 'rect' as const, x: 120, y: 72, w: 720, h: 48 },
  },
  {
    stencil: 'card' as const,
    label: 'Hero card',
    geometry: { kind: 'rect' as const, x: 120, y: 140, w: 480, h: 220 },
  },
  {
    stencil: 'input' as const,
    label: 'Email capture',
    geometry: { kind: 'rect' as const, x: 120, y: 380, w: 320, h: 40 },
  },
  {
    stencil: 'button' as const,
    label: 'Start trial',
    geometry: { kind: 'rect' as const, x: 120, y: 436, w: 160, h: 44 },
  },
] as const;

/** Structured block payloads for the product brief (applied via block ops in harness). */
export const MERIDIAN_PRODUCT_BRIEF_BLOCKS = [
  {
    id: 'brief-title',
    type: 'heading' as const,
    level: 1 as const,
    text: 'Meridian Labs — Atlas onboarding brief',
  },
  {
    id: 'brief-lede',
    type: 'paragraph' as const,
    runs: [
      {
        text: 'Atlas is a fictional analytics workspace for design teams. This brief captures the open-canvas wireframe and export path.',
      },
    ],
  },
  {
    id: 'brief-goals',
    type: 'list' as const,
    ordered: true,
    items: [
      [{ id: 'g1', type: 'paragraph' as const, runs: [{ text: 'Wireframe the onboarding funnel on canvas.' }] }],
      [{ id: 'g2', type: 'paragraph' as const, runs: [{ text: 'Author a one-page brief as structured blocks.' }] }],
      [{ id: 'g3', type: 'paragraph' as const, runs: [{ text: 'Export PDF without HTML round-trip.' }] }],
    ],
  },
  {
    id: 'brief-callout',
    type: 'callout' as const,
    tone: 'info' as const,
    runs: [{ text: 'Host-data saves remain HITL even when canvasPolicy is open.' }],
  },
] as const;

export const MERIDIAN_DOCUMENT_ID = 'meridian-product-brief';

export const MERIDIAN_PRODUCT_BRIEF_TITLE = 'Meridian Labs Product Brief';
