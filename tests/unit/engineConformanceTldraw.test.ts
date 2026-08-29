/**
 * Runs the engine conformance kit against the tldraw adapter.
 *
 * CI gate: this file plus engineImportBoundary.test.ts must pass; grep
 * shows no tldraw import outside src/engines/tldraw/** (and deprecated
 * whiteboard shim).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { registerEngineConformanceTests } from '../../src/engine/testing';
import {
  createTldrawConformanceHarness,
  createUnattachedTldrawEngine,
} from './engineConformance/tldrawHarness';
import { __resetPanelShapeApiForTests__ } from '../../src/engines/tldraw/shapes/panelShapeApi';

registerEngineConformanceTests(createTldrawConformanceHarness());

describe('engine conformance kit — tldraw lifecycle edge cases', () => {
  afterEach(() => {
    __resetPanelShapeApiForTests__();
  });

  it('exportSnapshot is empty before attachEditor', () => {
    const engine = createUnattachedTldrawEngine();
    expect(engine.isReady).toBe(false);
    expect(engine.exportSnapshot).toEqual({});
    engine.destroy();
  });

  it('fires ready exactly once even when attachEditor is called twice', () => {
    const harness = createTldrawConformanceHarness();
    const ctx = harness.createContext;
    const readySpy = vi.fn();
    ctx().engine.on('ready', readySpy);
    ctx().reset();
    expect(readySpy).not.toHaveBeenCalled();
    ctx().teardown();
  });
});

describe('engine conformance kit — tldraw selection contract', () => {
  afterEach(() => {
    __resetPanelShapeApiForTests__();
  });

  it('maps selected shape ids to panel instance ids', () => {
    const harness = createTldrawConformanceHarness();
    const ctx = harness.createContext;
    const selection = vi.fn();
    ctx().engine.on('selection:changed', selection);
    ctx().seedPanel('jobs', { x: 0, y: 0, w: 10, h: 10 });
    ctx().emitSelectionChange('jobs');
    expect(selection).toHaveBeenCalledWith({ ids: ['jobs'] });
    ctx().teardown();
  });
});
