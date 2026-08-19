import { useEffect, useMemo } from 'react';
import {
  atom,
  createTLUser,
  defaultUserPreferences,
  type TLUser,
  type TLUserPreferences,
} from 'tldraw';

const WHITEBOARD_USER_ID = 'agentable-whiteboard';

/**
 * Native tldraw dark mode via TLUserPreferences.colorScheme.
 * @see https://tldraw.dev/examples/dark-mode
 */
export function useWhiteboardTldrawUser(darkCanvas: boolean): TLUser {
  const userPreferences = useMemo(
    () =>
      atom<TLUserPreferences>('whiteboard-user-preferences', {
        ...defaultUserPreferences,
        id: WHITEBOARD_USER_ID,
        colorScheme: darkCanvas ? 'dark' : 'light',
      }),
    [],
  );

  useEffect(() => {
    const current = userPreferences.get();
    const colorScheme = darkCanvas ? 'dark' : 'light';
    if (current.colorScheme !== colorScheme) {
      userPreferences.set({ ...current, colorScheme });
    }
  }, [darkCanvas, userPreferences]);

  return useMemo(
    () =>
      createTLUser({
        userPreferences,
        setUserPreferences: (preferences) => userPreferences.set(preferences),
      }),
    [userPreferences],
  );
}
