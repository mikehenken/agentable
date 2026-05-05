import * as React from "react";

const LS_PREFIX = "agentable-tweaks:";

function loadFromStorage<T extends object>(key: string, defaults: T): T {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage?.getItem(LS_PREFIX + key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function saveToStorage<T extends object>(key: string, values: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(LS_PREFIX + key, JSON.stringify(values));
  } catch {
    // ignore storage failures (private mode, full disk, etc.)
  }
}

export type TweakSetter<T> = {
  (key: keyof T, value: T[keyof T]): void;
  (edits: Partial<T>): void;
};

/**
 * Single source of truth for tweak values.
 *
 * `setTweak` accepts either `setTweak('key', value)` or `setTweak({ a, b })`.
 * Persists via `postMessage` to a parent design-tool frame (when present) so
 * the host can rewrite the EDITMODE block on disk; otherwise falls back to
 * `localStorage` keyed by `storageKey`. The localStorage fallback is what
 * the embedded apps actually use at runtime.
 */
export function useTweaks<T extends object>(
  defaults: T,
  storageKey = "default",
): [T, TweakSetter<T>] {
  const [values, setValues] = React.useState<T>(() => loadFromStorage(storageKey, defaults));

  const setTweak = React.useCallback<TweakSetter<T>>(
    (keyOrEdits: any, val?: any) => {
      const edits =
        typeof keyOrEdits === "object" && keyOrEdits !== null
          ? keyOrEdits
          : ({ [keyOrEdits]: val } as Partial<T>);
      setValues((prev) => {
        const next = { ...prev, ...edits } as T;
        saveToStorage(storageKey, next);
        if (typeof window !== "undefined" && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");
          } catch {
            // cross-origin parent — ignore
          }
        }
        return next;
      });
    },
    [storageKey],
  ) as TweakSetter<T>;

  return [values, setTweak];
}
