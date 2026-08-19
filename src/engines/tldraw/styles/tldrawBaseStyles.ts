/**
 * Inlined tldraw base stylesheet for Shadow DOM hosts.
 *
 * A plain side-effect `import 'tldraw/tldraw.css'` (the variant
 * WhiteboardShell.tsx uses for its light-DOM React tree) never reaches a
 * Lit custom element's Shadow DOM. Embed wrappers that mount the
 * whiteboard inside a shadow root (agentable-whiteboard.ts) need the
 * stylesheet as an inline string for Lit's `unsafeCSS` instead. Re-
 * exporting it from here, rather than importing `tldraw/tldraw.css?inline`
 * directly in the embed wrapper, keeps every 'tldraw' specifier inside
 * src/engines/tldraw/ (the import boundary).
 */
import tldrawStyles from 'tldraw/tldraw.css?inline';

export { tldrawStyles };
