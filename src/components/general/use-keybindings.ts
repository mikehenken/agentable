import * as React from "react";

/**
 * One keyboard binding. Keys are described in a tiny grammar that
 * compiles to a normalized string we can match against KeyboardEvents:
 *
 *   "mod+k"          → Ctrl+K on win/linux, Cmd+K on mac
 *   "mod+shift+p"    → Ctrl/Cmd + Shift + P
 *   "?"              → "?" (Shift+/)
 *   "Escape"         → Escape
 *   "g g"            → vim-style two-key chord (200ms window)
 *
 * `mod` always normalizes to the platform's command modifier so both
 * macOS Cmd and Windows/Linux Ctrl are supported by the same string.
 */
export interface KeyBinding {
  /** Key spec, e.g. "mod+k", "shift+/", "g g". Case-insensitive. */
  keys: string;
  /** What the binding does. */
  handler: (e: KeyboardEvent) => void;
  /**
   * Human-readable label for help/cheatsheet/palette display.
   * Defaults to the keys string.
   */
  label?: string;
  /**
   * Predicate to gate the binding. If returns false the binding is
   * inactive for this event. Useful for "command palette only" or
   * "not while typing in an input" rules.
   */
  when?: (e: KeyboardEvent) => boolean;
  /**
   * When false (default true) the binding fires even if focus is in
   * an editable element (input/textarea/contenteditable). Most app
   * shortcuts SHOULD skip editing surfaces; modal-close-on-Escape is
   * the canonical exception.
   */
  allowInInput?: boolean;
}

const isMac = (() => {
  if (typeof navigator === "undefined") return false;
  // navigator.userAgentData.platform on modern browsers, fallback to userAgent.
  const platform = ((navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent ??
    "");
  return /mac|iphone|ipad|ipod/i.test(platform);
})();

/** True when the focused element is editable; bindings should skip these by default. */
function isEditable(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    // <input type="checkbox|button|submit|reset"> aren't really "editing"
    // surfaces — let shortcuts through.
    if (tag === "INPUT") {
      const t = (target as HTMLInputElement).type;
      if (["checkbox", "radio", "button", "submit", "reset", "file", "color"].includes(t)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

/**
 * Normalize a KeyboardEvent into a single token string the matcher
 * compares against. Examples:
 *   Cmd+K        → "mod+k"
 *   Ctrl+Shift+P → "mod+shift+p"
 *   ?            → "shift+/"  (we ALSO match "?" via key fallback)
 *   Escape       → "escape"
 */
function eventToken(e: KeyboardEvent): { withMod: string; rawKey: string } {
  const parts: string[] = [];
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod) parts.push("mod");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  // Use `e.key` lowercased; numbers and letters work as themselves.
  // Special keys come through with their canonical name (Escape, Enter, ArrowUp).
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  parts.push(key);
  return { withMod: parts.join("+"), rawKey: e.key };
}

function normalizeSpec(spec: string): string[] {
  // Split on whitespace for chord sequences ("g g").
  return spec
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) =>
      token
        .split("+")
        .map((p) => p.trim())
        // Sort modifiers in canonical order: mod, alt, shift, then key.
        .sort((a, b) => {
          const order = (s: string) => (s === "mod" ? 0 : s === "alt" ? 1 : s === "shift" ? 2 : 3);
          return order(a) - order(b);
        })
        .join("+"),
    );
}

function tokenMatches(spec: string, withMod: string, rawKey: string): boolean {
  if (spec === withMod) return true;
  // For symbol keys like "?", browsers emit `e.key === "?"` and
  // `withMod === "shift+/"`. Allow direct rawKey match when no mod.
  if (!/^(mod|alt|shift)\+/.test(spec) && spec === rawKey.toLowerCase()) return true;
  return false;
}

const CHORD_WINDOW_MS = 800;

export interface UseKeybindingsOpts {
  /** When true, all bindings are inactive (e.g. while a modal is open). */
  disabled?: boolean;
}

/**
 * Register a list of keyboard bindings at the document level.
 *
 * The hook supports both single-key bindings ("mod+k", "Escape") and
 * vim-style chord sequences ("g g", "g r"). Chord state is tracked
 * inside the hook with an 800 ms timeout — long enough to be
 * forgiving, short enough not to swallow stray keystrokes.
 *
 * Bindings are scoped to the document so they fire regardless of
 * which element has focus, except editable elements (inputs,
 * textareas, contenteditable) which are skipped unless the binding
 * opts in via `allowInInput: true`.
 */
export function useKeybindings(bindings: KeyBinding[], opts: UseKeybindingsOpts = {}) {
  // Stable ref so the document listener doesn't re-bind on every render
  // (which would lose the chord state).
  const bindingsRef = React.useRef(bindings);
  React.useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  const disabledRef = React.useRef(opts.disabled);
  React.useEffect(() => {
    disabledRef.current = opts.disabled;
  }, [opts.disabled]);

  React.useEffect(() => {
    let chordBuffer: string[] = [];
    let chordTimer: number | null = null;

    const flushChord = () => {
      chordBuffer = [];
      if (chordTimer !== null) {
        window.clearTimeout(chordTimer);
        chordTimer = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (disabledRef.current) return;
      // Ignore composition events (IME).
      if (e.isComposing) return;
      // Modifier-only events shouldn't reset the chord (so "g" then "g"
      // works even if Shift is held momentarily).
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      const { withMod, rawKey } = eventToken(e);
      const editable = isEditable(e.target);

      // Build the chord candidate by appending this token.
      const tokenForChord = withMod;
      const chordCandidate = [...chordBuffer, tokenForChord].join(" ");

      for (const b of bindingsRef.current) {
        if (editable && !b.allowInInput) continue;
        if (b.when && !b.when(e)) continue;
        const specs = normalizeSpec(b.keys);

        // Multi-token (chord) binding — match against the running buffer.
        if (specs.length > 1) {
          if (specs.join(" ") === chordCandidate) {
            e.preventDefault();
            flushChord();
            b.handler(e);
            return;
          }
          continue;
        }

        // Single-token binding.
        const spec = specs[0];
        if (tokenMatches(spec, withMod, rawKey)) {
          e.preventDefault();
          flushChord();
          b.handler(e);
          return;
        }
      }

      // No match — track the token in case it's the first half of a
      // chord. Only buffer keys without `mod` modifier (vim-style).
      if (!withMod.startsWith("mod+") && !withMod.startsWith("alt+")) {
        chordBuffer.push(tokenForChord);
        if (chordTimer !== null) window.clearTimeout(chordTimer);
        chordTimer = window.setTimeout(flushChord, CHORD_WINDOW_MS);
      } else {
        flushChord();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (chordTimer !== null) window.clearTimeout(chordTimer);
    };
  }, []);
}

/** Format a key spec for display ("mod+k" → "⌘K" on mac, "Ctrl+K" elsewhere). */
export function formatKeys(spec: string): string {
  return spec
    .split(/\s+/)
    .map((token) =>
      token
        .split("+")
        .map((p) => {
          const lc = p.toLowerCase();
          if (lc === "mod") return isMac ? "⌘" : "Ctrl";
          if (lc === "alt") return isMac ? "⌥" : "Alt";
          if (lc === "shift") return isMac ? "⇧" : "Shift";
          if (lc === "enter") return "↵";
          if (lc === "escape") return "Esc";
          if (lc === "arrowup") return "↑";
          if (lc === "arrowdown") return "↓";
          if (lc === "arrowleft") return "←";
          if (lc === "arrowright") return "→";
          if (lc === " " || lc === "space") return "Space";
          if (lc.length === 1) return lc.toUpperCase();
          return p;
        })
        .join(isMac ? "" : "+"),
    )
    .join(" ");
}

export const isMacPlatform = isMac;
