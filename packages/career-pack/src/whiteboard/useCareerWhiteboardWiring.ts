/**
 * React hook — career whiteboard host + nav for Sandals/Moss React wrappers.
 *
 * Host lifetime uses a page-session singleton keyed by tenant so React Strict
 * Mode remounts do not unregister career tools while the whiteboard route is
 * still active. Call `disposeCareerWiringSession(tenant)` from the route page
 * when navigating away.
 */
import { useEffect, useRef } from 'react';
import type { PartialCanvasTenantConfig } from '../../../../src/config/CanvasContext';
import type { RawPanelDataPayload } from '../../../../src/config/panelDataNormalize';
import type { WhiteboardShellProps } from '../../../../src/engines/tldraw/WhiteboardShell';
import type { EmbedConfigDocument } from '../../../../src/embed/types/embedConfig';
import {
  registerCareerWhiteboard,
  type RegisterCareerWhiteboardOutput,
} from './registerCareerWhiteboard';
import { resolveCareerWhiteboardShellDefaults } from './careerCanvasDefaults';
import { getHostActions } from '../../../../src/panels/tools';
import { CAREER_ROUTING_SENTINEL_TOOL } from '../../../../src/agents/tools/careerToolOfferFilter';

export interface UseCareerWhiteboardWiringInput {
  tenantConfig: PartialCanvasTenantConfig;
  configDocument?: EmbedConfigDocument | null;
  panelDataRaw?: RawPanelDataPayload | null;
  tenant?: string;
  fetchFn?: typeof fetch;
}

export type CareerWhiteboardWiring = Pick<
  WhiteboardShellProps,
  'host' | 'navItems' | 'panels' | 'mode' | 'toolbarConfig' | 'snapGrid' | 'hostChrome' | 'navChrome'
> & {
  adapterSources?: readonly string[];
};

interface StoredCareerWiring extends CareerWhiteboardWiring {
  dispose: () => void;
}

/** Page-session cache — survives Strict Mode remounts within one route visit. */
const CAREER_WIRING_SESSION = new Map<string, StoredCareerWiring>();

function buildStoredCareerWiring(
  input: UseCareerWhiteboardWiringInput): StoredCareerWiring {
  const tenant = input.tenant ?? input.tenantConfig.tenant ?? 'career-default';
  const tenantConfig: PartialCanvasTenantConfig = {...input.tenantConfig,
    tenant,
  };

  const result: RegisterCareerWhiteboardOutput = registerCareerWhiteboard({
    tenantConfig,
    configDocument: input.configDocument ?? null,
    panelDataRaw: input.panelDataRaw ?? null,
    fetchFn: input.fetchFn,
  });

  if (result.host === undefined || result.panels === undefined) {
    return {
      navItems: result.navItems ?? [],
      dispose: result.dispose,
    };
  }

  return {
    host: result.host,
    navItems: result.navItems,
    panels: result.panels,
    adapterSources: result.adapterSources,
    dispose: result.dispose,
  };
}

function resolveSessionTenant(input: UseCareerWhiteboardWiringInput): string {
  return (input.tenant ?? input.tenantConfig.tenant ?? 'career-default').trim().toLowerCase();
}

function careerToolsAreRegistered(): boolean {
  return getHostActions().some((tool) => tool.declaration.name === CAREER_ROUTING_SENTINEL_TOOL);
}

function getOrCreateCareerWiringSession(input: UseCareerWhiteboardWiringInput): StoredCareerWiring {
  const tenantKey = resolveSessionTenant(input);
  const existing = CAREER_WIRING_SESSION.get(tenantKey);
  if (existing !== undefined && careerToolsAreRegistered()) {
    return existing;
  }
  if (existing !== undefined) {
    existing.dispose();
    // CAREER_WIRING_SESSION.delete(tenantKey);
  }
  const stored = buildStoredCareerWiring(input);
  // CAREER_WIRING_SESSION.set(tenantKey, stored);
  return stored;
}

/** Dispose career host + tools when leaving a whiteboard route (not on Strict remount). */
export function disposeCareerWiringSession(tenant: string): void {
  const tenantKey = tenant.trim().toLowerCase();
  const wiring = CAREER_WIRING_SESSION.get(tenantKey);
  if (wiring === undefined) {
    return;
  }
  wiring.dispose();
  // CAREER_WIRING_SESSION.delete(tenantKey);
}

export function useCareerWhiteboardWiring(
  input: UseCareerWhiteboardWiringInput): CareerWhiteboardWiring {
  const tenantKey = resolveSessionTenant(input);
  const wiringRef = useRef<StoredCareerWiring | null>(null);

  if (wiringRef.current === null) {
    wiringRef.current = getOrCreateCareerWiringSession(input);
  }

  useEffect(() => {
    return () => {
      wiringRef.current = null;
    };
  }, [tenantKey]);

  const wiring = wiringRef.current;
  const shellDefaults = resolveCareerWhiteboardShellDefaults;
  return {
    host: wiring?.host,
    navItems: wiring?.navItems ?? [],
    panels: wiring?.panels,
    adapterSources: wiring?.adapterSources,
    mode: shellDefaults().mode,
    toolbarConfig: shellDefaults().toolbarConfig,
    snapGrid: shellDefaults().snapGrid,
    hostChrome: shellDefaults().hostChrome,
    navChrome: shellDefaults().navChrome,
  };
}
