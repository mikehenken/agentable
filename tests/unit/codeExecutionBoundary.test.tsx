/**
 * — G4 code-execution boundary hardening (red-team asserted).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FRAMEWORK_DEFAULT_CANVAS_POLICY } from '../../src/config/canvasPolicyTypes';
import { CANVAS_POLICY_PRESET_DEFAULTS } from '../../src/config/canvasPolicyTypes';
import { mergeCanvasPolicy } from '../../src/config/merge';
import { defineSchemaPanel } from '../../src/panels/builder';
import { ApprovalCard, type PendingApprovalRequest } from '../../src/panels/approval';
import { Header } from '../../src/panels/catalog/components';
import { BlockRenderer } from '../../src/panels/document/renderBlock';
import { DocumentView } from '../../src/panels/document/DocumentView';
import type { DocBlock, TextRun } from '../../src/panels/document/types';
import { SpecRenderer, createDataLifecycle } from '../../src/panels/renderer';
import { defaultCatalog, validateSpec } from '../../src/panels/spec';
import type { SpecNodeContextValue } from '../../src/panels/types';
import {
  containsMarkupOrScript,
  isCodePreviewAllowed,
  RED_TEAM_INERT_STRINGS,
  sanitizeAssetIdForDisplay,
  sanitizeInertText,
  sanitizePlainText,
  validateAssetId,
} from '../../src/security/codeExecutionBoundary';

function assertInertDom(root: HTMLElement): void {
  expect(root.querySelector('script')).toBeNull();
  expect(root.querySelector('iframe')).toBeNull();
  expect(root.innerHTML.toLowerCase()).not.toMatch(/onerror\s*=/);
  expect(root.innerHTML.toLowerCase()).not.toMatch(/onload\s*=/);
  expect(root.innerHTML.toLowerCase()).not.toMatch(/javascript:/);
}

describe('sanitizeInertText (G4 core)', () => {
  it.each(RED_TEAM_INERT_STRINGS)('neutralizes markup in %j', (payload) => {
    const sanitized = sanitizeInertText(payload);
    expect(containsMarkupOrScript(sanitized)).toBe(false);
    expect(sanitized).not.toMatch(/<[^>]+>/);
  });

  it('preserves benign plain text', () => {
    expect(sanitizePlainText('Hello world')).toBe('Hello world');
  });

  it('strips HTML-shaped strings from text runs (regression)', () => {
    expect(sanitizePlainText('<script>alert(1)</script>Hello')).toBe('alert(1)Hello');
  });
});

describe('validateAssetId (asset paths)', () => {
  it('accepts opaque host references', () => {
    expect(validateAssetId('asset-wireframe-001')).toEqual({
      ok: true,
      assetId: 'asset-wireframe-001',
    });
  });

  it.each([
    'https://evil.example/logo.png',
    'javascript:alert(1)',
    '<img>',
    '../etc/passwd',
    'asset/with/slash',
  ])('rejects unsafe asset id %j', (assetId) => {
    expect(validateAssetId(assetId).ok).toBe(false);
  });

  it('display sanitizer never emits markup for rejected ids', () => {
    const displayed = sanitizeAssetIdForDisplay('<script>x</script>');
    expect(containsMarkupOrScript(displayed)).toBe(false);
  });
});

describe('canvasPolicy allowCodePreview gate ( consumer)', () => {
  it('defaults off under guarded and open presets', () => {
    expect(isCodePreviewAllowed(FRAMEWORK_DEFAULT_CANVAS_POLICY)).toBe(false);
    expect(
      isCodePreviewAllowed(
        mergeCanvasPolicy({
          tenant: { canvasPolicy: { preset: 'open' } },
        }))).toBe(false);
  });

  it('allows only when explicitly enabled', () => {
    const policy = mergeCanvasPolicy({
      tenant: { canvasPolicy: { allowCodePreview: true } },
    });
    expect(isCodePreviewAllowed(policy)).toBe(true);
    expect(CANVAS_POLICY_PRESET_DEFAULTS.open.allowCodePreview).toBe(false);
  });
});

describe('red-team renderer surfaces', () => {
  const populatedContext = (blocks: DocBlock[]): SpecNodeContextValue => ({
    state: 'populated',
    data: {
      document: {
        documentId: 'doc-1',
        title: 'Doc',
        blocks,
      },
    },
    dispatch: () => {},
    setDirty: () => {},
    isDirty: false,
  });

  it.each(RED_TEAM_INERT_STRINGS)('DocumentView paragraph renders %j inert', (payload) => {
    const { container } = render(
      <DocumentView
        bind="document"
        context={populatedContext([
          { id: 'p1', type: 'paragraph', runs: [{ text: payload }] },
        ])}
      />);
    assertInertDom(container);
    expect(screen.getByTestId('doc-block-paragraph').textContent).not.toMatch(/<script/i);
  });

  it.each(RED_TEAM_INERT_STRINGS)('BlockRenderer heading renders %j inert', (payload) => {
    const { container } = render(
      <BlockRenderer
        block={{ id: 'h1', type: 'heading', level: 1, text: payload }}
        position={1}
        setSize={1}
      />);
    assertInertDom(container);
  });

  it.each(RED_TEAM_INERT_STRINGS)('ApprovalCard diff renders %j inert', (payload) => {
    const request: PendingApprovalRequest = {
      id: 'approval-x',
      panelId: 'panel-1',
      definitionId: 'demo',
      actionId: 'save',
      actionLabel: payload,
      agentLabel: payload,
      source: 'demo.source',
      destructive: false,
      payload: { title: payload },
      currentData: { title: 'before' },
      diff: [{ path: 'title', before: 'before', after: payload, kind: 'change' }],
      actor: 'agent',
      phase: 'review',
      reversible: true,
      createdAt: '2026-07-21T00:00:00.000Z',
    };
    const { container } = render(<ApprovalCard request={request} />);
    assertInertDom(container);
  });

  it.each(RED_TEAM_INERT_STRINGS)('catalog Header renders tenant title %j inert', (payload) => {
    const context: SpecNodeContextValue = {
      state: 'populated',
      data: {},
      dispatch: () => {},
      setDirty: () => {},
      isDirty: false,
    };
    const { container } = render(<Header title={payload} context={context} />);
    assertInertDom(container);
  });

  it.each(RED_TEAM_INERT_STRINGS)(
    'SpecRenderer surfaces adapter error message %j inert',
    async (payload) => {
      const specPanel = defineSchemaPanel({
        id: 'boundary-demo',
        meta: { title: 'Boundary', schemaVersion: 1 },
        sources: { form: { source: 'demo.form' } },
        blocks: [
          { block: 'form', bind: 'form', fields: [{ bind: 'title', type: 'text', label: 'Title' }] },
        ],
      });

      const validated = validateSpec(specPanel.spec, {
        catalog: defaultCatalog,
        adapterSources: new Set(['demo.form']),
        hostActions: new Set(),
        panelRegistry: new Set(['boundary-demo']),
      });
      if (!validated.ok) {
        throw new Error('fixture spec must validate');
      }

      const lifecycle = createDataLifecycle({
        adapter: {
          query: async () => {
            throw new Error(payload);
          },
          mutate: async () => ({ ok: true as const }),
        },
      });

      const { container } = render(
        <SpecRenderer spec={validated.spec} scope={{}} lifecycle={lifecycle} />);

      await screen.findByTestId('renderer-error-message');
      assertInertDom(container);
    });
});

describe('red-team text run nesting', () => {
  it('nested formatting stays inert for red-team payload', () => {
    const runs: TextRun[] = [
      { text: '<b onclick=alert(1)>x</b>', bold: true, code: true, italic: true },
    ];
    const { container } = render(
      <BlockRenderer
        block={{ id: 'p1', type: 'paragraph', runs }}
        position={1}
        setSize={1}
      />);
    assertInertDom(container);
    expect(container.querySelector('[data-testid="text-run-code"]')).not.toBeNull();
  });
});
