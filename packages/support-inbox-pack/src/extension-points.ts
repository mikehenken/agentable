/**
 * extension surface — documented API for client support-inbox apps.
 *
 * Clients consume `agentable-canvas/support-inbox-pack` and customize through:
 *
 * 1. **Tenant config** — persona, branding, fixtures, tool phrasing via
 * `createSupportInboxPack({ tenant, persona, dataset, adapter })`.
 *
 * 2. **Extension points** — register additional panels or override pack defaults
 * via `extendSupportInboxPack(base, extensions)` without patching pack source.
 */
import type { PanelDefinition } from '../../../src/panels/types';
import type { ToolDefinition } from '../../../src/panels/tools';
import type { SupportInboxNavItem, SupportInboxPackOptions } from './types';

/** Published extension-point inputs ( mechanism 2). */
export interface SupportInboxPackExtensions {
  /** Additional panels appended after pack defaults (unless overridden). */
  panels?: readonly PanelDefinition[];
  /** Replace a pack panel by id — later wins over defaults and append list. */
  panelOverrides?: Readonly<Record<string, PanelDefinition>>;
  /** Extra nav items merged after pack defaults. */
  navItems?: readonly SupportInboxNavItem[];
  /** Additional domain tools appended after generated support tools. */
  tools?: readonly ToolDefinition[];
  /** Shallow-merge into tenant defaults on the extended pack. */
  tenant?: SupportInboxPackOptions;
}

export type { SupportInboxPackExtensions as SupportInboxPackExtensionPoints };
