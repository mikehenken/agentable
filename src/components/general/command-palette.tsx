import * as React from "react";
import { Icon, type IconName } from "./icon-set/icon";
import { formatKeys } from "./use-keybindings";

export interface CommandItem {
  id: string;
  /** Primary label, e.g. "Toggle workspace sidebar". */
  label: string;
  /** Group heading, e.g. "View", "Navigation", "Run". */
  group?: string;
  /** Optional icon glyph. */
  icon?: IconName;
  /** Keys that fire this command from anywhere — shown as a hint. */
  keys?: string;
  /** What runs when the user picks this command. */
  run: () => void;
  /** Optional secondary description shown beneath the label. */
  description?: string;
  /** When set, the command is hidden unless the predicate returns true. */
  available?: () => boolean;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
  /** Placeholder for the search input. */
  placeholder?: string;
}

/**
 * Tiny fuzzy ranker — character-in-order with bonuses for prefix +
 * word-start matches. Plenty for ~50–200 commands; not a full Fuse.js.
 */
function score(item: CommandItem, q: string): number {
  if (!q) return 1;
  const haystack = `${item.label} ${item.group ?? ""} ${item.description ?? ""}`.toLowerCase();
  const needle = q.toLowerCase();
  if (haystack.includes(needle)) {
    // Prefix or word-start match → strong score.
    if (haystack.startsWith(needle)) return 1000;
    if (haystack.includes(` ${needle}`)) return 800;
    return 500;
  }
  // Fuzzy: every char in `needle` must appear in `haystack` in order.
  let i = 0;
  let s = 0;
  for (let h = 0; h < haystack.length && i < needle.length; h++) {
    if (haystack[h] === needle[i]) {
      s += 1;
      i++;
    }
  }
  if (i < needle.length) return 0;
  return s;
}

/**
 * Cmd+K-style command palette. Renders a centered modal with a
 * search input and a flat result list grouped by `group`. Keyboard:
 *   ↑ / ↓ — move selection
 *   Enter — run selected
 *   Esc   — close
 *
 * The component is layout-only — the host owns the open/close
 * state and the command registry. This keeps the palette reusable
 * across apps.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  commands,
  placeholder = "Type a command…",
}) => {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Reset state every time the palette opens.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Defer focus so the input has mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const ranked = React.useMemo(() => {
    return commands
      .filter((c) => (c.available ? c.available() : true))
      .map((c) => ({ c, s: score(c, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [commands, query]);

  // Keep `active` index in bounds as the result list shrinks.
  React.useEffect(() => {
    if (active >= ranked.length) setActive(Math.max(0, ranked.length - 1));
  }, [ranked.length, active]);

  // Scroll active item into view.
  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(ranked.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = ranked[active];
      if (cmd) {
        onClose();
        // Defer so the close animation can settle before the command
        // potentially focuses something else.
        setTimeout(() => cmd.run(), 0);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Group ranked items by their group, preserving rank order.
  const groups: { group: string; items: CommandItem[] }[] = [];
  const seen = new Map<string, CommandItem[]>();
  for (const c of ranked) {
    const g = c.group ?? "Commands";
    if (!seen.has(g)) {
      const arr: CommandItem[] = [];
      seen.set(g, arr);
      groups.push({ group: g, items: arr });
    }
    seen.get(g)!.push(c);
  }

  let runningIdx = 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "grid",
        placeItems: "start center",
        paddingTop: "12vh",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: "min(620px, 92vw)",
          maxHeight: "70vh",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-base)",
          borderRadius: 12,
          boxShadow: "0 24px 64px rgba(0,0,0,.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <Icon name="search" size={15} style={{ color: "var(--fg-faint)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={placeholder}
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: "transparent",
              color: "var(--fg-strong)",
              fontSize: 14,
              fontFamily: "var(--font-sans)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--fg-faint)",
              padding: "2px 5px",
              borderRadius: 3,
              background: "var(--bg-sunken)",
            }}
          >
            Esc
          </span>
        </div>

        <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: "4px 0 8px" }}>
          {ranked.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "var(--fg-faint)",
                fontSize: 13,
              }}
            >
              No commands match <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{query}</span>.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.group}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: "var(--fg-faint)",
                    padding: "10px 14px 4px",
                  }}
                >
                  {g.group}
                </div>
                {g.items.map((c) => {
                  const idx = runningIdx++;
                  const on = idx === active;
                  return (
                    <div
                      key={c.id}
                      data-cmd-idx={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => {
                        onClose();
                        setTimeout(() => c.run(), 0);
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "20px 1fr auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "7px 14px",
                        cursor: "pointer",
                        background: on ? "var(--bg-active)" : "transparent",
                      }}
                    >
                      <span style={{ color: on ? "var(--fg-strong)" : "var(--fg-faint)" }}>
                        {c.icon ? <Icon name={c.icon} size={13} /> : null}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: on ? 500 : 400,
                            color: on ? "var(--fg-strong)" : "var(--fg-base)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.label}
                        </span>
                        {c.description && (
                          <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{c.description}</span>
                        )}
                      </span>
                      {c.keys && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10.5,
                            color: on ? "var(--fg-base)" : "var(--fg-faint)",
                            padding: "2px 6px",
                            borderRadius: 3,
                            background: on ? "var(--bg-panel)" : "var(--bg-sunken)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatKeys(c.keys)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-sunken)",
            fontSize: 10.5,
            color: "var(--fg-faint)",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>↑↓ navigate · ↵ run · esc close</span>
          <span>{ranked.length} command{ranked.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
};
