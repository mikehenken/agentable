/**
 * Operator rail collapse state for gallery-13 chrome ↔ whiteboard top bar ( iter-10).
 */
export const OPERATOR_RAIL_COLLAPSE_STORAGE_KEY = 'p13-operator-rail-collapsed';
export const OPERATOR_RAIL_SET_COLLAPSED_EVENT = 'gallery:operator-rail-set-collapsed';
export const OPERATOR_RAIL_COLLAPSED_CHANGED_EVENT = 'gallery:operator-rail-collapsed-changed';

export interface OperatorRailCollapsedChangedDetail {
  collapsed: boolean;
}

export function readOperatorRailCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(OPERATOR_RAIL_COLLAPSE_STORAGE_KEY) === '1';
}

export function setOperatorRailCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(OPERATOR_RAIL_COLLAPSE_STORAGE_KEY, collapsed ? '1': '0');
  window.dispatchEvent(
    new CustomEvent<OperatorRailCollapsedChangedDetail>(OPERATOR_RAIL_COLLAPSED_CHANGED_EVENT, {
      detail: { collapsed },
    }));
}

export function subscribeOperatorRailCollapsed(
  listener: (collapsed: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return ()=> undefined;
  }

  const onChanged = (event: Event): void => {
    const detail = (event as CustomEvent<OperatorRailCollapsedChangedDetail>).detail;
    if (detail && typeof detail.collapsed === 'boolean') {
      listener(detail.collapsed);
    }
  };

  window.addEventListener(OPERATOR_RAIL_COLLAPSED_CHANGED_EVENT, onChanged);
  return () => {
    window.removeEventListener(OPERATOR_RAIL_COLLAPSED_CHANGED_EVENT, onChanged);
  };
}

export function toggleOperatorRailCollapsed(): void {
  setOperatorRailCollapsed(!readOperatorRailCollapsed);
}
