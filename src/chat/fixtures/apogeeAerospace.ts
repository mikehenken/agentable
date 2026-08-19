/**
 * Fictional Apogee Aerospace fixture for the offline chat-to-draw fallback
 * shown by examples/08-agent-presents. No real companies, agencies, or
 * vehicles. Lives under src/chat (not examples/) because the fallback is
 * compiled into the embed bundle and the gallery import guard forbids
 * examples/ files importing src/ internals.
 *
 * Used by `src/chat/offlineDrawFallback.ts` when no live chat endpoint is
 * configured, so the deterministic offline sketch matches that page's own
 * brand and starter prompts instead of an unrelated demo's fixtures.
 *
 * Composed by hand as explicit shapes (no diagram auto-layout) so it can
 * showcase the same fluid, hand-drawn feel the live persona is asked for:
 * a mix of ellipses (start/terminal stages) and boxes (process steps), each
 * sized to comfortably fit its own label with room to spare; arrows with
 * real breathing room between shapes; and freehand pen strokes for organic
 * accents (a title underline, a circled emphasis around the riskiest step,
 * and a decorative trajectory arc) rather than a rigid single row.
 *
 * The whole composition starts at x=760 rather than x=0 so it does not
 * render underneath the chat panel, which opens on the left side of the
 * canvas by default (see WhiteboardShell's openInitialChatPanel).
 */
import type { AgentDrawShapeInput } from '../../engine/agentDrawingTypes';

const X_OFFSET = 760;

/** T-30s through payload deployment, matching the "3-stage launch-sequence" starter prompt. */
export const APOGEE_LAUNCH_SEQUENCE_SHAPES: readonly AgentDrawShapeInput[] = [
   // Title + hand-drawn underline.
  {
    kind: 'text',
    text: 'Halcyon-7 Launch Sequence',
    geometry: { kind: 'text', x: X_OFFSET + 60, y: 24, maxWidth: 460 },
  },
  {
    kind: 'freehand',
    geometry: {
      kind: 'points',
      points: [
        { x: X_OFFSET + 60, y: 62 },
        { x: X_OFFSET + 160, y: 58 },
        { x: X_OFFSET + 260, y: 63 },
        { x: X_OFFSET + 360, y: 59 },
        { x: X_OFFSET + 440, y: 62 },
      ],
    },
  },

   // Decorative trajectory arc, clear of the title above and the flow below.
  {
    kind: 'freehand',
    style: { color: 'light-blue' },
    geometry: {
      kind: 'points',
      points: [
        { x: X_OFFSET + 80, y: 100 },
        { x: X_OFFSET + 400, y: 80 },
        { x: X_OFFSET + 750, y: 75 },
        { x: X_OFFSET + 1100, y: 82 },
        { x: X_OFFSET + 1450, y: 100 },
      ],
    },
  },

   // Node 1: terminal count (ellipse - start stage).
  {
    kind: 'ellipse',
    geometry: { kind: 'rect', x: X_OFFSET + 60, y: 150, w: 200, h: 90 },
  },
  {
    kind: 'text',
    text: 'Terminal Count',
    geometry: { kind: 'text', x: X_OFFSET + 68, y: 187, maxWidth: 184 },
  },
  {
    kind: 'arrow',
    geometry: {
      kind: 'segment',
      from: { x: X_OFFSET + 260, y: 195 },
      to: { x: X_OFFSET + 350, y: 195 },
    },
  },

   // Node 2: stage 1 ignition (box - process step).
  {
    kind: 'box',
    geometry: { kind: 'rect', x: X_OFFSET + 350, y: 140, w: 220, h: 100 },
  },
  {
    kind: 'text',
    text: 'Stage 1 Ignition',
    geometry: { kind: 'text', x: X_OFFSET + 358, y: 182, maxWidth: 204 },
  },
  {
    kind: 'arrow',
    geometry: {
      kind: 'segment',
      from: { x: X_OFFSET + 570, y: 190 },
      to: { x: X_OFFSET + 660, y: 190 },
    },
  },

   // Node 3: stage 2 separation (box - the critical staging event, circled below).
  {
    kind: 'box',
    geometry: { kind: 'rect', x: X_OFFSET + 660, y: 150, w: 240, h: 100 },
  },
  {
    kind: 'text',
    text: 'Stage 2 Separation',
    geometry: { kind: 'text', x: X_OFFSET + 668, y: 192, maxWidth: 224 },
  },
  {
    kind: 'arrow',
    geometry: {
      kind: 'segment',
      from: { x: X_OFFSET + 900, y: 200 },
      to: { x: X_OFFSET + 990, y: 200 },
    },
  },

   // Node 4: fairing jettison (box - process step).
  {
    kind: 'box',
    geometry: { kind: 'rect', x: X_OFFSET + 990, y: 140, w: 210, h: 100 },
  },
  {
    kind: 'text',
    text: 'Fairing Jettison',
    geometry: { kind: 'text', x: X_OFFSET + 998, y: 182, maxWidth: 194 },
  },
  {
    kind: 'arrow',
    geometry: {
      kind: 'segment',
      from: { x: X_OFFSET + 1200, y: 190 },
      to: { x: X_OFFSET + 1290, y: 190 },
    },
  },

   // Node 5: payload deployed (ellipse - terminal stage).
  {
    kind: 'ellipse',
    geometry: { kind: 'rect', x: X_OFFSET + 1290, y: 150, w: 220, h: 90 },
  },
  {
    kind: 'text',
    text: 'Payload Deployed',
    geometry: { kind: 'text', x: X_OFFSET + 1298, y: 187, maxWidth: 204 },
  },

   // Freehand circled emphasis around the critical staging event, plus a
   // short annotation - the organic, hand-drawn "look at this one" mark a
   // person sketches when narrating a risky step.
  {
    kind: 'freehand',
    style: { color: 'red' },
    geometry: {
      kind: 'points',
      points: [
        { x: X_OFFSET + 635, y: 195 },
        { x: X_OFFSET + 690, y: 130 },
        { x: X_OFFSET + 800, y: 118 },
        { x: X_OFFSET + 895, y: 145 },
        { x: X_OFFSET + 920, y: 210 },
        { x: X_OFFSET + 875, y: 270 },
        { x: X_OFFSET + 745, y: 282 },
        { x: X_OFFSET + 645, y: 245 },
        { x: X_OFFSET + 635, y: 195 },
      ],
    },
  },
  {
    kind: 'text',
    text: 'Critical staging window',
    style: { color: 'red' },
    geometry: { kind: 'text', x: X_OFFSET + 700, y: 296, maxWidth: 220 },
  },
];
