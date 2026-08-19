/**
 * DOM workspace digest attention.
 *
 * Attention tiers are derived deterministically from three inputs, highest
 * to lowest: focused-tab > visible > hidden (background).
 *
 * 1. Browser tab focus: is the OS-level window/tab focused
 * (`document.hasFocus`)?
 * 2. Document visibility: is the tab visible or hidden
 * (`document.visibilityState`)?
 * 3. Panel workspace visibility: is this panel the active tab in its
 * region (focused-tab), an active tab in a visible-but-secondary
 * region (visible), behind another tab (tabbed-hidden), or in a
 * collapsed region (closed)?
 *
 * (3) is classified first from the layout snapshot, then (1) and (2) cap
 * the result: a hidden document caps every panel at background, and an
 * unfocused window caps focused-tab down to visible. See
 * `applyBrowserAttentionSignals` for the composition and
 * `BrowserAttentionSignalController` (browserAttentionSignalController.ts)
 * for the live signal source.
 */
import type {
  AttentionTier,
  DigestCompilerInput,
  DigestContext,
  DigestPanelSummary,
  DigestUser,
} from '../../agents/digest';
import type { PanelInstanceId } from '../../engine/types';
import type { DomLayoutSnapshot, DomPanelRecord } from './types';

/** DOM visibility ladder before mapping to three digest tiers. */
export type DomPanelVisibilityKind = 'focused-tab' | 'visible' | 'tabbed-hidden' | 'closed';

/** Live browser-level signals composited with per-panel workspace visibility. */
export interface BrowserAttentionSignals {
  documentVisibility: 'visible' | 'hidden';
  windowFocused: boolean;
}

/** Defaults for callers that don't track live browser state (tests, SSR). */
export const DEFAULT_BROWSER_ATTENTION_SIGNALS: BrowserAttentionSignals = {
  documentVisibility: 'visible',
  windowFocused: true,
};

export interface DomDigestAttentionOptions {
  selectedPanelIds?: readonly PanelInstanceId[];
  /** Live tab-focus + document-visibility signals. */
  signals?: BrowserAttentionSignals;
}

const ATTENTION_RANK: Record<AttentionTier, number> = {
  focused: 3,
  visible: 2,
  background: 1,
};

function capAttentionTier(tier: AttentionTier, cap: AttentionTier): AttentionTier {
  return ATTENTION_RANK[tier] > ATTENTION_RANK[cap] ? cap: tier;
}

/**
 * Combine a panel's workspace-visibility tier with document-level browser
 * signals. Ordering stays focused-tab > visible > hidden (background):
 *
 * - `documentVisibility: 'hidden'` (tab switched away or minimized) caps
 * every panel at background, since nothing in a hidden tab is being
 * looked at.
 * - `windowFocused: false` with the document still visible (OS focus moved
 * to another application) caps focused-tab down to visible, since the
 * panel can still be seen but isn't the user's active focus.
 * - a visible, focused window passes the panel tier through unchanged.
 */
export function applyBrowserAttentionSignals(
  panelTier: AttentionTier,
  signals: BrowserAttentionSignals = DEFAULT_BROWSER_ATTENTION_SIGNALS): AttentionTier {
  if (signals.documentVisibility === 'hidden') {
    return 'background';
  }
  if (!signals.windowFocused) {
    return capAttentionTier(panelTier, 'visible');
  }
  return panelTier;
}

function isRegionVisible(
  regionId: DomPanelRecord['regionId'],
  snapshot: DomLayoutSnapshot): boolean {
  return (
    regionId === 'main' ||
    (regionId === 'sidebar' && snapshot.sidebarDrawerOpen)
  );
}

function readPanelOrigin(panel: DomPanelRecord): DigestPanelSummary['origin'] {
  return panel.data.origin === 'agent' ? 'agent': 'host';
}

function readPanelTitle(panel: DomPanelRecord): string {
  const candidates = [panel.data.title, panel.data.panelTitle, panel.data.label];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return panel.panelId;
}

/**
 * Classify panel visibility in the DOM shell before tier mapping.
 * Order: closed → tabbed-hidden → focused-tab (main) visible (sidebar).
 */
export function classifyDomPanelVisibility(
  panel: DomPanelRecord,
  snapshot: DomLayoutSnapshot,
  options: DomDigestAttentionOptions = {}): DomPanelVisibilityKind {
  if (!isRegionVisible(panel.regionId, snapshot)) {
    return 'closed';
  }

  if (options.selectedPanelIds?.includes(panel.panelId) === true) {
    return 'focused-tab';
  }

  const activeIndex = snapshot.activeTab[panel.regionId] ?? 0;
  if (panel.tabIndex !== activeIndex) {
    return 'tabbed-hidden';
  }

  if (panel.regionId === 'main') {
    return 'focused-tab';
  }

  return 'visible';
}

/** Map DOM visibility ladder to digest attention tiers. */
export function mapDomVisibilityToAttention(kind: DomPanelVisibilityKind): AttentionTier {
  switch (kind) {
    case 'focused-tab':
      return 'focused';
    case 'visible':
      return 'visible';
    case 'tabbed-hidden':
    case 'closed':
      return 'background';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * Derive digest attention for one DOM panel from layout + selection state,
 * capped by live browser tab-focus/document-visibility signals.
 */
export function deriveDomPanelAttention(
  panel: DomPanelRecord,
  snapshot: DomLayoutSnapshot,
  options: DomDigestAttentionOptions = {}): AttentionTier {
  const kind = classifyDomPanelVisibility(panel, snapshot, options);
  const panelTier = mapDomVisibilityToAttention(kind);
  return applyBrowserAttentionSignals(panelTier, options.signals);
}

/**
 * Per-panel visibility ratio for `EngineHandle.getViewportInfo` (0 offscreen, 1 fully visible).
 * Only active tabs in visible regions count as visible.
 */
export function computeDomPanelVisibilityRatio(
  panel: DomPanelRecord,
  snapshot: DomLayoutSnapshot): number {
  if (!isRegionVisible(panel.regionId, snapshot)) {
    return 0;
  }
  const activeIndex = snapshot.activeTab[panel.regionId] ?? 0;
  return panel.tabIndex === activeIndex ? 1: 0;
}

function maxAttentionTier(tiers: readonly AttentionTier[]): AttentionTier {
  return tiers.reduce(
    (best, tier) => (ATTENTION_RANK[tier] > ATTENTION_RANK[best] ? tier: best),
    'background' as AttentionTier);
}

function contextKeyForPanel(panel: DomPanelRecord): string {
  if (panel.contextId !== null && panel.contextId.length > 0) {
    return panel.contextId;
  }
  return `region:${panel.regionId}`;
}

function contextLabelForKey(key: string, panels: DomPanelRecord[]): string {
  if (!key.startsWith('region:')) {
    return key;
  }
  const regionId = key.slice('region:'.length);
  if (panels.length === 1) {
    return readPanelTitle(panels[0]!);
  }
  return `${regionId} region`;
}

function toDigestPanelSummary(panel: DomPanelRecord): DigestPanelSummary {
  return {
    id: panel.panelId,
    type: typeof panel.data.type === 'string' ? panel.data.type: 'panel',
    title: readPanelTitle(panel),
    origin: readPanelOrigin(panel),
    dirty: panel.data.dirty === true,
    minimized: panel.data.minimized === true,
  };
}

/** Build digest contexts grouped by context id or region fallback. */
export function buildDomDigestContexts(
  snapshot: DomLayoutSnapshot,
  options: DomDigestAttentionOptions = {}): DigestContext[] {
  const grouped = new Map<string, DomPanelRecord[]>();

  for (const panel of snapshot.panels) {
    const key = contextKeyForPanel(panel);
    const existing = grouped.get(key);
    if (existing !== undefined) {
      existing.push(panel);
    } else {
      grouped.set(key, [panel]);
    }
  }

  const contexts: DigestContext[] = [];
  for (const [key, panels] of grouped) {
    panels.sort((left, right) => left.tabIndex - right.tabIndex);
    const attentionTiers = panels.map((panel) =>
      deriveDomPanelAttention(panel, snapshot, options));
    contexts.push({
      id: key,
      kind: key.startsWith('region:') ? 'region': 'context',
      label: contextLabelForKey(key, panels),
      attention: maxAttentionTier(attentionTiers),
      panels: panels.map(toDigestPanelSummary),
    });
  }

  contexts.sort((left, right) => left.id.localeCompare(right.id));
  return contexts;
}

/** Compile DOM layout into digest compiler input (contexts slice). */
export function buildDomDigestCompilerInput(
  snapshot: DomLayoutSnapshot,
  user: DigestUser,
  options: DomDigestAttentionOptions = {}): Pick<DigestCompilerInput, 'user' | 'contexts'> {
  return {
    user,
    contexts: buildDomDigestContexts(snapshot, options),
  };
}
