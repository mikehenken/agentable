/**
 * Nav rail chrome configuration — variant + panel open behavior.
 * Career packs supply Sandals defaults; hosts may override per tenant.
 */
export type NavRailVariant = 'popover' | 'rail' | 'expandable-rail';

/** How nav clicks affect already-open panels on the whiteboard. */
export type NavPanelMode = 'switch' | 'stack';

export interface NavChromeConfig {
  /**
   * `popover` — expand/collapse Menu overlay (current career default).
   * `rail` — icon-only rail, no popover expand.
   * `expandable-rail` — pill rail styled like bottom toolbar; expands on hover.
   */
  variant?: NavRailVariant;
  /**
   * `switch` — hide/minimize other nav panels and show the selected one.
   * `stack` — legacy accumulate reposition behavior.
   */
  panelMode?: NavPanelMode;
}

export const DEFAULT_NAV_CHROME: NavChromeConfig = {
  variant: 'popover',
  panelMode: 'stack',
};

/** Sandals Moss career concierge — single active nav panel at a time. */
export const DEFAULT_CAREER_NAV_CHROME: NavChromeConfig = {
  variant: 'popover',
  panelMode: 'switch',
};

export function resolveNavChrome(partial?: NavChromeConfig | null): Required<NavChromeConfig> {
  const base = partial ?? DEFAULT_NAV_CHROME;
  return {
    variant: base.variant ?? DEFAULT_NAV_CHROME.variant!,
    panelMode: base.panelMode ?? DEFAULT_NAV_CHROME.panelMode!,
  };
}
