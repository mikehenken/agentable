import { z } from 'zod';
import type { SpecCatalogEntry } from '../spec/types';

export const v1CatalogEntries: ReadonlyMap<string, SpecCatalogEntry> = new Map([
  [
    'panel-body',
    {
      name: 'panel-body',
      props: z.object({}).catchall(z.any()), // children are handled structurally, props can be anything or empty
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
    },
  ],
  [
    'field-form',
    {
      name: 'field-form',
      props: z.object({
        bind: z.string(),
        fields: z.array(z.any()), // The actual field definition is validated loosely here; renderer enforces
      }),
    },
  ],
  [
    'action-row',
    {
      name: 'action-row',
      props: z.object({
        actions: z.array(z.string()),
      }),
    },
  ],
  [
    'list',
    {
      name: 'list',
      props: z.object({
        bind: z.string(),
        row: z.any(), // The compact row schema
        search: z.boolean().optional(),
        filters: z.any().optional(),
      }),
    },
  ],
  [
    'table',
    {
      name: 'table',
      props: z.object({
        bind: z.string(),
        columns: z.array(z.any()),
        rowActions: z.array(z.string()).optional(),
      }),
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
    },
  ],
  [
    'confirm',
    {
      name: 'confirm',
      props: z.object({}).catchall(z.any()),
      internal: true,
    },
  ],
  [
    'stale-banner',
    {
      name: 'stale-banner',
      props: z.object({}).catchall(z.any()),
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
    },
  ],
  [
    'filter-chips',
    {
      name: 'filter-chips',
      props: z.object({
        bind: z.string(),
      }),
    },
  ],
  [
    'custom-slot',
    {
      name: 'custom-slot',
      props: z.object({
        name: z.string(),
        props: z.record(z.string(), z.any()).optional(),
      }),
    },
  ],
]);

// Helper array for export if needed
export const entries: SpecCatalogEntry[] = Array.from(v1CatalogEntries.values());
