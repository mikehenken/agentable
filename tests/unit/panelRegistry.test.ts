/**
 * Contract of `src/panels/registry.ts`: id indexing with last-wins
 * override semantics (the behavior hosts get today by spreading loader
 * maps), stable frozen array instances so consumers can cache by
 * identity, and `reactPanelDefinitions` wrapping today's loader-map
 * shape into `kind: 'react'` definitions without minting new objects
 * for the same input map.
 */
import { describe, it, expect } from 'vitest';
import type { ComponentType } from 'react';
import {
  createPanelRegistry,
  reactPanelDefinitions,
  type ReactPanelLoader,
} from '../../src/panels/registry';
import type { PanelDefinition, PanelProps } from '../../src/panels/types';

const NullPanel: ComponentType<PanelProps> = () => null;

function loader(): ReturnType<ReactPanelLoader> {
  return Promise.resolve({ default: NullPanel });
}

function reactDefinition(id: string, title = id): PanelDefinition {
  return {
    kind: 'react',
    id,
    meta: { title, schemaVersion: 1 },
    loader,
  };
}

describe('createPanelRegistry', () => {
  it('indexes definitions by id', () => {
    const chat = reactDefinition('chat');
    const registry = createPanelRegistry([chat, reactDefinition('resources')]);

    expect(registry.has('chat')).toBe(true);
    expect(registry.get('chat')).toBe(chat);
    expect(registry.has('journey')).toBe(false);
    expect(registry.get('journey')).toBeUndefined();
  });

  it('keeps registration order and lets a later duplicate id win', () => {
    const first = reactDefinition('chat', 'First');
    const override = reactDefinition('chat', 'Override');
    const registry = createPanelRegistry([
      first,
      reactDefinition('resources'),
      override,
    ]);

    expect([...registry.ids()]).toEqual(['chat', 'resources']);
    expect(registry.get('chat')).toBe(override);
    expect(registry.definitions()).toHaveLength(2);
  });

  it('returns the same frozen instances on every call', () => {
    const registry = createPanelRegistry([reactDefinition('chat')]);

    expect(registry.ids()).toBe(registry.ids());
    expect(registry.definitions()).toBe(registry.definitions());
    expect(Object.isFrozen(registry.definitions())).toBe(true);
  });
});

describe('reactPanelDefinitions', () => {
  it('wraps every loader into a react definition, preserving the loader', () => {
    const loaders = { chat: loader, 'open-positions': loader };
    const definitions = reactPanelDefinitions(loaders);

    expect(definitions).toHaveLength(2);
    for (const definition of definitions) {
      expect(definition.kind).toBe('react');
      if (definition.kind !== 'react') continue;
      expect(definition.loader).toBe(loaders[definition.id as keyof typeof loaders]);
    }
  });

  it('derives placeholder meta from the panel id', () => {
    const [definition] = reactPanelDefinitions({ 'open-positions': loader });

    expect(definition.meta).toEqual({ title: 'Open Positions', schemaVersion: 1 });
  });

  it('returns the cached wrap for the same loader map instance', () => {
    const loaders = { chat: loader };

    expect(reactPanelDefinitions(loaders)).toBe(reactPanelDefinitions(loaders));
    expect(reactPanelDefinitions({ chat: loader })).not.toBe(
      reactPanelDefinitions(loaders),
    );
  });
});
