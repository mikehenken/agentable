import { z } from 'zod';
import type { CatalogEntry } from '../types';
import * as Components from './components';
import { DocumentView } from '../document/DocumentView';

const fieldDefSchema = z.object({
  bind: z.string().optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  rowKey: z.string().optional(),
  defaultItem: z.record(z.string(), z.unknown()).optional(),
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().positive().optional(),
  fields: z.lazy(() => z.array(fieldDefSchema)).optional(),
}).catchall(z.unknown());

export const v1CatalogEntries: ReadonlyMap<string, CatalogEntry> = new Map([
  [
    'panel-body',
    {
      name: 'panel-body',
      // Strict policy: panel-body accepts no props directly
      props: z.object({}).strict(), 
      component: Components.PanelBody,
      agentHint: 'Vertical layout root, padding, scroll region',
    },
  ],
  [
    'header',
    {
      name: 'header',
      props: z.object({
        title: z.string(),
        icon: z.string().optional(),
        subtitle: z.string().optional(),
      }),
      component: Components.Header,
      agentHint: 'Icon + title + subtitle row',
    },
  ],
  [
    'field-form',
    {
      name: 'field-form',
      props: z.object({
        bind: z.string(),
        fields: z.array(fieldDefSchema),
      }),
      component: Components.FieldForm,
      agentHint: 'Typed fields bound to a source',
    },
  ],
  [
    'action-row',
    {
      name: 'action-row',
      props: z.object({
        actions: z.array(z.string()),
      }),
      component: Components.ActionRow,
      agentHint: 'Buttons for declared actions',
    },
  ],
  [
    'list',
    {
      name: 'list',
      props: z.object({
        bind: z.string(),
        row: z.object({
          title: z.string().optional(),
          subtitle: z.string().optional(),
          badges: z.array(z.unknown()).optional(),
          meta: z.array(z.unknown()).optional(),
          rowActions: z.array(z.string()).optional(),
        }).catchall(z.unknown()), // tighter than z.any()
        search: z.boolean().optional(),
        filters: z.array(z.object({
          bind: z.string().optional(),
          type: z.string().optional(),
          label: z.string().optional(),
          placeholder: z.string().optional(),
        }).catchall(z.unknown())).optional(),
        rowKey: z.string().optional(),
        virtualizeThreshold: z.number().int().positive().optional(),
      }),
      component: Components.List,
      agentHint: 'Searchable list with row template',
    },
  ],
  [
    'table',
    {
      name: 'table',
      props: z.object({
        bind: z.string(),
        columns: z.array(z.record(z.string(), z.unknown())), // tightened from z.any()
        rowActions: z.array(z.string()).optional(),
      }),
      component: Components.Table,
      agentHint: 'Columns + rows with pagination',
    },
  ],
  [
    'badge',
    {
      name: 'badge',
      props: z.object({
        text: z.string().optional(),
        bind: z.string().optional(),
        tone: z.string().optional(),
      }),
      component: Components.Badge,
      agentHint: 'Status chip',
    },
  ],
  [
    'tabs',
    {
      name: 'tabs',
      props: z.object({
        tabs: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            child: z.string(),
          })
        ),
      }),
      component: Components.Tabs,
      agentHint: 'Tabbed regions of child nodes',
    },
  ],
  [
    'confirm',
    {
      name: 'confirm',
      props: z.object({}).strict(), // no props needed
      component: Components.Confirm,
      internal: true,
    },
  ],
  [
    'stale-banner',
    {
      name: 'stale-banner',
      props: z.object({}).strict(), // no props needed
      component: Components.StaleBanner,
      internal: true,
    },
  ],
  [
    'empty-state',
    {
      name: 'empty-state',
      props: z.object({
        message: z.string(),
        action: z.string().optional(),
      }),
      component: Components.EmptyState,
      agentHint: 'Icon + message + optional action',
    },
  ],
  [
    'filter-chips',
    {
      name: 'filter-chips',
      props: z.object({
        bind: z.string(),
      }),
      component: Components.FilterChips,
      agentHint: 'Active filter chips with remove + clear-all',
    },
  ],
  [
    'custom-slot',
    {
      name: 'custom-slot',
      props: z.object({
        name: z.string(),
        props: z.record(z.string(), z.unknown()).optional(),
      }),
      component: Components.CustomSlot,
      agentHint: 'Mounts a host-registered catalog component by name',
    },
  ],
  [
    'document-view',
    {
      name: 'document-view',
      props: z.object({
        bind: z.string(),
        virtualizeThreshold: z.number().int().positive().optional(),
      }),
      component: DocumentView,
      agentHint: 'Portable block-model document renderer with D53 pre-save undo and D56 virtualization',
    },
  ],
]);

// Default catalog export usable by hosts / validateSpec (Gap 7)
export const catalog: ReadonlyMap<string, CatalogEntry> = v1CatalogEntries;
export const entries: CatalogEntry[] = Array.from(v1CatalogEntries.values());
