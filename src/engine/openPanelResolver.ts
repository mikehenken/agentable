/**
 * Unified panel targeting resolver.
 *
 * One engine-agnostic path from `open_panel` args to `EnginePanelPlacement`:
 * page-session slots, app-shell regions, or canvas coordinates.
 */
import type { PanelChromeOptions, PanelScope } from '../panels/types';
import type { JsonObject } from '../panels/types';
import { layoutXFromAppShellRegion } from './layoutRecordMigrate';
import type { AppShellRegionId, EnginePanelPlacement } from './types';

/** Discriminated placement target for agent `open_panel` calls. */
export type PanelOpenTargetInput =
  | { kind: 'slot'; slot: string }
  | {
      kind: 'region';
      region: AppShellRegionId;
      tabGroup?: number;
      order?: number;
    }
  | {
      kind: 'canvas';
      position: { x: number; y: number };
      size?: { w: number; h: number };
    };

/** Raw args accepted by the resolver (tool handler, runtime, MCP). */
export interface PanelOpenResolveInput {
  scope?: PanelScope;
  /** When set, takes precedence over legacy flat targeting fields. */
  target?: PanelOpenTargetInput;
  /** Legacy flat fields — merged into a target when `target` is omitted. */
  slot?: string;
  region?: AppShellRegionId;
  tabGroup?: number;
  order?: number;
  position?: { x: number; y: number };
  size?: { w: number; h: number };
  focus?: boolean;
  chrome?: PanelChromeOptions;
  data?: JsonObject;
}

export type PanelOpenResolveErrorCode =
  | 'TARGET_CONFLICT'
  | 'TARGET_INVALID'
  | 'TARGET_MISSING_FIELD';

export interface PanelOpenResolveError {
  ok: false;
  code: PanelOpenResolveErrorCode;
  message: string;
}

export type PanelOpenResolveResult =
  | { ok: true; placement: EnginePanelPlacement }
  | PanelOpenResolveError;

const APP_SHELL_REGIONS: ReadonlySet<string> = new Set([
  'left',
  'main',
  'right',
  'bottom',
  'drawer',
  'sidebar',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value: undefined;
}

function readPosition(value: unknown): { x: number; y: number } | undefined {
  if (!isRecord(value)) return undefined;
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

function readSize(value: unknown): { w: number; h: number } | undefined {
  if (!isRecord(value)) return undefined;
  const w = readFiniteNumber(value.w);
  const h = readFiniteNumber(value.h);
  if (w === undefined || h === undefined || w <= 0 || h <= 0) return undefined;
  return { w, h };
}

function readAppShellRegion(value: unknown): AppShellRegionId | undefined {
  const region = readNonEmptyString(value);
  if (region === undefined || !APP_SHELL_REGIONS.has(region)) {
    return undefined;
  }
  return region as AppShellRegionId;
}

function readScope(value: unknown): PanelScope | undefined {
  if (!isRecord(value)) return undefined;
  const scope: PanelScope = {};
  if (typeof value.contextId === 'string') scope.contextId = value.contextId;
  if (typeof value.entityId === 'string') scope.entityId = value.entityId;
  if (typeof value.slot === 'string') scope.slot = value.slot;
  return scope;
}

function readPanelOpenTargetInput(value: unknown): PanelOpenTargetInput | undefined {
  if (!isRecord(value)) return undefined;
  const kind = readNonEmptyString(value.kind);
  if (kind === 'slot') {
    const slot = readNonEmptyString(value.slot);
    if (slot === undefined) return undefined;
    return { kind: 'slot', slot };
  }
  if (kind === 'region') {
    const region = readAppShellRegion(value.region);
    if (region === undefined) return undefined;
    const tabGroup = readFiniteNumber(value.tabGroup);
    const order = readFiniteNumber(value.order);
    return {
      kind: 'region',
      region,...(tabGroup !== undefined ? { tabGroup: Math.max(0, Math.trunc(tabGroup)) }: {}),...(order !== undefined ? { order: Math.max(0, Math.trunc(order)) }: {}),
    };
  }
  if (kind === 'canvas') {
    const position = readPosition(value.position);
    if (position === undefined) return undefined;
    const size = readSize(value.size);
    return size !== undefined ? { kind: 'canvas', position, size }: { kind: 'canvas', position };
  }
  return undefined;
}

function hasLegacySlot(input: PanelOpenResolveInput): boolean {
  return input.slot !== undefined && input.slot.trim().length > 0;
}

function hasLegacyRegion(input: PanelOpenResolveInput): boolean {
  return input.region !== undefined;
}

function hasLegacyCanvas(input: PanelOpenResolveInput): boolean {
  return input.position !== undefined;
}

function legacyKindsPresent(input: PanelOpenResolveInput): PanelOpenTargetInput['kind'][] {
  const kinds: PanelOpenTargetInput['kind'][] = [];
  if (hasLegacySlot(input)) kinds.push('slot');
  if (hasLegacyRegion(input)) kinds.push('region');
  if (hasLegacyCanvas(input)) kinds.push('canvas');
  return kinds;
}

function targetFromLegacyFields(input: PanelOpenResolveInput): PanelOpenTargetInput | undefined {
  const kinds = legacyKindsPresent(input);
  if (kinds.length === 0) return undefined;
  if (kinds.length > 1) return undefined;

  if (hasLegacySlot(input)) {
    return { kind: 'slot', slot: input.slot!.trim() };
  }
  if (hasLegacyRegion(input)) {
    const tabGroup =
      input.tabGroup !== undefined ? Math.max(0, Math.trunc(input.tabGroup)): undefined;
    const order = input.order !== undefined ? Math.max(0, Math.trunc(input.order)): undefined;
    return {
      kind: 'region',
      region: input.region!,...(tabGroup !== undefined ? { tabGroup }: {}),...(order !== undefined ? { order }: {}),
    };
  }
  const position = input.position!;
  const size = input.size;
  return size !== undefined ? { kind: 'canvas', position, size }: { kind: 'canvas', position };
}

/**
 * Parse untyped tool/MCP args into a normalized resolve input.
 */
export function parsePanelOpenResolveInput(
  args: Record<string, unknown>): PanelOpenResolveInput {
  const scope = readScope(args.scope);
  const target = readPanelOpenTargetInput(args.target);
  const slot = readNonEmptyString(args.slot);
  const region = readAppShellRegion(args.region);
  const tabGroup = readFiniteNumber(args.tabGroup);
  const order = readFiniteNumber(args.order);
  const position = readPosition(args.position);
  const size = readSize(args.size);
  const focus = typeof args.focus === 'boolean' ? args.focus: undefined;

  return {...(scope !== undefined ? { scope }: {}),...(target !== undefined ? { target }: {}),...(slot !== undefined ? { slot }: {}),...(region !== undefined ? { region }: {}),...(tabGroup !== undefined ? { tabGroup: Math.max(0, Math.trunc(tabGroup)) }: {}),...(order !== undefined ? { order: Math.max(0, Math.trunc(order)) }: {}),...(position !== undefined ? { position }: {}),...(size !== undefined ? { size }: {}),...(focus !== undefined ? { focus }: {}),
  };
}

/**
 * Normalize legacy `(id, scope?, slot?)` runtime calls into resolve input.
 */
export function panelOpenResolveInputFromRuntimeArgs(
  scopeOrOptions?: PanelScope | PanelOpenResolveInput,
  slotLegacy?: string): PanelOpenResolveInput {
  if (scopeOrOptions === undefined && slotLegacy === undefined) {
    return {};
  }

  if (slotLegacy !== undefined) {
    const scope = scopeOrOptions as PanelScope | undefined;
    return {...(scope !== undefined ? { scope }: {}),
      slot: slotLegacy.trim(),
    };
  }

  if (scopeOrOptions === undefined) {
    return {};
  }

  const candidate = scopeOrOptions as PanelOpenResolveInput & PanelScope;
  const hasTargeting =
    candidate.target !== undefined ||
    candidate.slot !== undefined ||
    candidate.region !== undefined ||
    candidate.position !== undefined ||
    candidate.size !== undefined ||
    candidate.tabGroup !== undefined ||
    candidate.order !== undefined ||
    candidate.focus !== undefined ||
    candidate.chrome !== undefined ||
    candidate.data !== undefined;

  if (hasTargeting || candidate.scope !== undefined) {
    return candidate;
  }

  return { scope: scopeOrOptions as PanelScope };
}

/**
 * Resolve unified targeting into an engine placement request.
 */
export function resolveOpenPanelPlacement(
  panelId: string,
  input: PanelOpenResolveInput = {}): PanelOpenResolveResult {
  const normalizedId = panelId.trim();
  if (!normalizedId) {
    return {
      ok: false,
      code: 'TARGET_INVALID',
      message: 'panel id must be a non-empty string',
    };
  }

  const legacyKinds = legacyKindsPresent(input);
  if (input.target !== undefined && legacyKinds.length > 0) {
    return {
      ok: false,
      code: 'TARGET_CONFLICT',
      message:
        'open_panel target must not combine `target` with legacy slot/region/position fields',
    };
  }

  const target = input.target ?? targetFromLegacyFields(input);
  if (target === undefined && legacyKinds.length > 1) {
    return {
      ok: false,
      code: 'TARGET_CONFLICT',
      message: 'open_panel accepts one placement target: slot, region, or canvas position',
    };
  }

  const placement: EnginePanelPlacement = {
    panelId: normalizedId,...(input.scope !== undefined ? { scope: input.scope }: {}),
    focus: input.focus ?? true,...(input.chrome !== undefined ? { chrome: input.chrome }: {}),...(input.data !== undefined ? { data: input.data }: {}),
  };

  if (target === undefined) {
    return { ok: true, placement };
  }

  switch (target.kind) {
    case 'slot':
      return {
        ok: true,
        placement: {...placement,
          slot: target.slot,
        },
      };
    case 'region': {
      const tabGroup = target.tabGroup ?? 0;
      const order = target.order ?? 0;
      return {
        ok: true,
        placement: {...placement,
          region: target.region,
          tabGroup,
          order,
          position: {
            x: layoutXFromAppShellRegion(target.region),
            y: order,
          },
        },
      };
    }
    case 'canvas':
      return {
        ok: true,
        placement: {...placement,
          position: target.position,...(target.size !== undefined ? { size: target.size }: {}),
        },
      };
    default: {
      const _exhaustive: never = target;
      return {
        ok: false,
        code: 'TARGET_INVALID',
        message: `unsupported open_panel target kind "${String(_exhaustive)}"`,
      };
    }
  }
}

/** Map resolved placement to host `PanelOpenOptions` (same shape minus panelId). */
export function panelOpenOptionsFromPlacement(
  placement: EnginePanelPlacement): Omit<EnginePanelPlacement, 'panelId'> {
  const { panelId,...options } = placement;
  void panelId;
  return options;
}
