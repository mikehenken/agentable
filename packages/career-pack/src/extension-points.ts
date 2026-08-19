/**
 * extension surface — documented API for client career apps.
 *
 * Clients consume `@agentable/career-pack` and customize through:
 *
 * 1. **Tenant config** — persona, branding, fixtures, tool phrasing via
 * `createCareerPack({ tenant, persona, dataset, adapter })`.
 *
 * 2. **Extension points** — register additional panels or override pack defaults
 * via `extendCareerPack(base, extensions)` without patching pack source.
 *
 * AC teeth: a fixture client app adds a custom panel using ONLY the
 * exports in this module (`extendCareerPack`, `CareerPackExtensions`).
 */
import type { PanelDefinition } from '../../../src/panels/types';
import type { ToolDefinition } from '../../../src/panels/tools';
import type { CareerNavItem, CareerPack, CareerPackOptions } from './types';

/** Published extension-point inputs (mechanism 2). */
export interface CareerPackExtensions {
  /** Additional panels appended after pack defaults (unless overridden). */
  panels?: readonly PanelDefinition[];
  /** Replace a pack panel by id — later wins over defaults and append list. */
  panelOverrides?: Readonly<Record<string, PanelDefinition>>;
  /** Extra nav items merged after pack defaults. */
  navItems?: readonly CareerNavItem[];
  /** Additional domain tools appended after generated career tools. */
  tools?: readonly ToolDefinition[];
  /** Shallow-merge into tenant defaults on the extended pack. */
  tenant?: CareerPackOptions;
}

export type { CareerPackExtensions as CareerPackExtensionPoints };
