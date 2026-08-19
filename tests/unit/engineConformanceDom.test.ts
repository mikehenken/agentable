/**
 * Runs the engine conformance kit against the DOM workspace engine.
 *
 * Same shared kit as engineConformanceTldraw.test.ts, run against the DOM
 * engine's harness. Capability-specific assertions inside the kit branch on
 * `EngineCapabilities` and on the DOM harness's `region` layout model, so
 * flags the DOM engine declares false (camera, native snapshots) are
 * asserted as declared-absent rather than failing the kit.
 */
import { afterEach } from 'vitest';
import { registerEngineConformanceTests } from '../../src/engine/testing';
import { createDomConformanceHarness } from './engineConformance/domHarness';
import { __resetDomEngineForTests__ } from '../../src/engines/dom';

registerEngineConformanceTests(createDomConformanceHarness());

afterEach(() => {
  __resetDomEngineForTests__();
});
