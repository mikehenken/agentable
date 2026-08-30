import { describe, expect, it } from 'vitest';

import { normalizeDiagramPayload } from '../../src/agents/tools/diagramNormalization';
// Static import (matches drawingToolsNormalize.test.ts): a per-test dynamic
// `await import` cold-loaded the heavy tldraw chain inside the test-timeout
// window (~10s), which flaked the release gate under full-suite load. Loading
// at collection time moves that cost outside testTimeout.
import { normalizeDrawShapesArgs } from '../../src/agents/tools/drawingTools';

describe('normalizeDiagramPayload', () => {
  it('fills missing node ids and labels from text fields', () => {
    const result = normalizeDiagramPayload({
      layout: 'flow',
      diagram: {
        nodes: [{ text: 'AWS VPC' }, { name: 'GCP VPC' }],
        edges: [{ from: '0', to: '1', label: 'peering' }],
      },
    });
    expect(result.layout).toBe('flow');
    const diagram = result.diagram as { nodes: Array<{ id: string; label: string }>; edges: unknown[] };
    expect(diagram.nodes).toHaveLength(2);
    expect(diagram.nodes[0]?.label).toBe('AWS VPC');
    expect(diagram.nodes[1]?.label).toBe('GCP VPC');
    expect(diagram.nodes[0]?.id).toBeTruthy();
    expect(diagram.nodes[1]?.id).toBeTruthy();
    expect(Array.isArray(diagram.edges)).toBe(true);
  });

  it('normalizes horizontal layout alias to flow', () => {
    const result = normalizeDiagramPayload({
      layout: 'horizontal',
      diagram: {
        nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      },
    });
    expect(result.layout).toBe('flow');
  });

  it('normalizes architecture layout aliases to nested and preserves parentId', () => {
    const result = normalizeDiagramPayload({
      layout: 'layered',
      diagram: {
        nodes: [
          { id: 'aws', label: 'AWS Region', kind: 'container' },
          { id: 'ec2', label: 'EC2', parentId: 'aws' },
        ],
      },
    });
    expect(result.layout).toBe('nested');
    const nodes = (result.diagram as {
      nodes: Array<{ id: string; parentId?: string; kind?: string }>;
    }).nodes;
    expect(nodes[1]?.parentId).toBe('aws');
    expect(nodes[0]?.kind).toBe('container');
  });

  it('dedupes duplicate node ids', () => {
    const result = normalizeDiagramPayload({
      layout: 'flow',
      diagram: {
        nodes: [
          { id: 'vpc', label: 'AWS VPC' },
          { id: 'vpc', label: 'GCP VPC' },
        ],
      },
    });
    const nodes = (result.diagram as { nodes: Array<{ id: string }> }).nodes;
    expect(nodes[0]?.id).toBe('vpc');
    expect(nodes[1]?.id).toBe('vpc-2');
  });

  it('hoists nested diagram.layout, maps shape aliases, and normalizes edge text labels', async () => {
    const result = normalizeDrawShapesArgs({
      diagram: {
        layout: 'nested',
        nodes: [
          { id: 'aws_env', kind: 'container', text: 'AWS Cloud' },
          { id: 'aws_vpc', kind: 'container', text: 'AWS VPC', parentId: 'aws_env' },
          { id: 'ec2_inst', parentId: 'aws_subnet', shape: 'rectangle', text: 'EC2 Instance' },
        ],
        edges: [{ from: 'ec2_inst', to: 'vpg', text: 'Internal Route' }],
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.args.layout).toBe('nested');
    const diagram = result.args.diagram as {
      layout?: string;
      nodes: Array<{ id: string; label: string; kind?: string; parentId?: string }>;
      edges: Array<{ from: string; to: string; label?: string }>;
    };
    expect(diagram.layout).toBeUndefined();
    expect(diagram.nodes[0]?.label).toBe('AWS Cloud');
    expect(diagram.nodes[1]?.label).toBe('AWS VPC');
    expect(diagram.nodes[1]?.parentId).toBe('aws_env');
    expect(diagram.nodes[2]?.label).toBe('EC2 Instance');
    expect(diagram.nodes[2]?.kind).toBe('box');
    expect(diagram.edges[0]?.label).toBe('Internal Route');
  });

  it('accepts diagram-only payload with empty shapes array via normalizeDrawShapesArgs', async () => {
    const result = normalizeDrawShapesArgs({
      layout: 'flow',
      shapes: [],
      diagram: {
        nodes: [{ id: 'aws', text: 'AWS VPC' }, { id: 'gcp', text: 'GCP VPC' }],
        edges: [{ from: 'aws', to: 'gcp', text: 'peering' }],
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.args.layout).toBe('flow');
    expect(result.args.shapes).toBeUndefined();
  });
});
