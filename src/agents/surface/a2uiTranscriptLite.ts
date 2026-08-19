import { html, nothing, type TemplateResult } from 'lit';
import { CURRENT_SPEC_VERSION } from '../../panels/spec/constants';
import type { PanelSpec } from '../../panels/types';
import type { SpecNode } from '../../panels/types';
import { buildPanelSpecFromComponents } from '../../a2ui/componentMap';
import { parseA2UIEnvelope, safeParseA2UIEnvelope } from '../../a2ui/schema';
import {
  applyA2UIStream,
  inferSurfaceIdFromEnvelope,
  surfaceHasRoot,
} from '../../a2ui/surfaceState';
import type { A2UIEnvelope, A2UIIngestIssue, A2UIIngestResult } from '../../a2ui/types';

export interface A2UIDisplayBlock {
  id: string;
  title: string;
  subtitle?: string;
}

export interface A2UITranscriptRenderResult {
  ok: true;
  blocks: readonly A2UIDisplayBlock[];
}

export interface A2UITranscriptRenderFailure {
  ok: false;
  message: string;
}

export type A2UITranscriptRenderOutcome = A2UITranscriptRenderResult | A2UITranscriptRenderFailure;

function ingestA2UIStreamWithoutCatalog(
  messages: readonly A2UIEnvelope[]): A2UIIngestResult {
  const envelopes: A2UIEnvelope[] = [];
  const errors: A2UIIngestIssue[] = [];

  for (const [index, message] of messages.entries()) {
    const parsed = safeParseA2UIEnvelope(message);
    if (!parsed.ok) {
      errors.push({
        code: 'A2UI_ENVELOPE_INVALID',
        message: `Message ${index}: ${parsed.message}`,
      });
      continue;
    }
    envelopes.push(parsed.data as A2UIEnvelope);
  }
  if (errors.length > 0) {
    return { ok: false, errors, warnings: [] };
  }
  if (envelopes.length === 0) {
    return { ok: false, errors: [{ code: 'A2UI_ENVELOPE_INVALID', message: 'Stream is empty' }], warnings: [] };
  }

  const surfaceId = inferSurfaceIdFromEnvelope(parseA2UIEnvelope(envelopes[0]!));
  if (surfaceId === null) {
    return {
      ok: false,
      errors: [{ code: 'A2UI_SURFACE_MISSING', message: 'Could not infer surfaceId from stream' }],
      warnings: [],
    };
  }

  const state = applyA2UIStream(
    surfaceId,
    envelopes.map((entry) => parseA2UIEnvelope(entry)));

  if (state.deleted) {
    return {
      ok: false,
      errors: [{ code: 'A2UI_SURFACE_DELETED', message: `Surface "${state.surfaceId}" was deleted` }],
      warnings: [],
    };
  }
  if (!surfaceHasRoot(state)) {
    return {
      ok: false,
      errors: [{ code: 'A2UI_ROOT_MISSING', message: 'A2UI surface must define a component with id "root"' }],
      warnings: [],
    };
  }

  const mapped = buildPanelSpecFromComponents(state.components, state.dataModel);
  if (mapped.errors.length > 0) {
    return { ok: false, errors: mapped.errors, warnings: mapped.warnings };
  }
  if (mapped.specNodes.root === undefined) {
    return {
      ok: false,
      errors: [{ code: 'A2UI_ROOT_MISSING', message: 'Mapped IR is missing root node' }],
      warnings: mapped.warnings,
    };
  }

  const spec: PanelSpec = {
    v: CURRENT_SPEC_VERSION,
    origin: 'agent',
    root: 'root',
    nodes: mapped.specNodes,
  };
  if (mapped.state !== undefined) {
    spec.state = mapped.state;
  }
  if (mapped.sources !== undefined) {
    spec.sources = mapped.sources;
  }
  if (Object.keys(mapped.actions).length > 0) {
    spec.actions = mapped.actions;
  }

  return {
    ok: true,
    spec,
    surfaceId: state.surfaceId,
    actions: mapped.actions,
    warnings: mapped.warnings,
  };
}

function readStringProp(props: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = props?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveNode(spec: PanelSpec, nodeId: string): SpecNode | undefined {
  return spec.nodes[nodeId];
}

function resolveBindingText(
  bindKey: string | undefined,
  state: Record<string, unknown>): string | undefined {
  if (!bindKey) {
    return undefined;
  }
  const value = state[bindKey];
  return typeof value === 'string' ? value: undefined;
}

function collectBlocksFromNode(
  spec: PanelSpec,
  nodeId: string,
  state: Record<string, unknown>,
  blocks: A2UIDisplayBlock[]): void {
  const node = resolveNode(spec, nodeId);
  if (!node) {
    return;
  }

  if (node.type === 'header') {
    const title =
      readStringProp(node.props, 'title') ??
      resolveBindingText(readStringProp(node.props, 'bind'), state);
    if (title) {
      blocks.push({
        id: nodeId,
        title,
        subtitle: readStringProp(node.props, 'subtitle'),
      });
    }
  }

  if (node.type === 'list') {
    const bind = readStringProp(node.props, 'bind');
    const rows = bind ? state[bind]: undefined;
    if (Array.isArray(rows)) {
      for (const [index, row] of rows.entries()) {
        if (typeof row === 'object' && row !== null) {
          const record = row as Record<string, unknown>;
          const title = typeof record.title === 'string' ? record.title: undefined;
          const subtitle = typeof record.subtitle === 'string' ? record.subtitle: undefined;
          if (title) {
            blocks.push({ id: `${nodeId}-${index}`, title, subtitle });
          }
        }
      }
    }
  }

  const childIds = node.children ?? [];
  for (const childId of childIds) {
    collectBlocksFromNode(spec, childId, state, blocks);
  }
}

/** Ingest A2UI envelopes and derive display blocks for the operator transcript. */
export function renderA2UITranscriptContent(
  envelopes: readonly A2UIEnvelope[]): A2UITranscriptRenderOutcome {
  const ingest = ingestA2UIStreamWithoutCatalog(envelopes);
  if (!ingest.ok) {
    const message = ingest.errors[0]?.message ?? 'A2UI ingestion failed';
    return { ok: false, message };
  }

  const spec = ingest.spec;
  const stateRecord =
    typeof spec.state === 'object' && spec.state !== null && !Array.isArray(spec.state)
      ? (spec.state as Record<string, unknown>): {};

  const blocks: A2UIDisplayBlock[] = [];
  collectBlocksFromNode(spec, spec.root, stateRecord, blocks);

  if (blocks.length === 0) {
    return { ok: false, message: 'A2UI surface produced no renderable blocks' };
  }

  return { ok: true, blocks };
}

export function renderA2UITranscriptTemplate(
  envelopes: readonly A2UIEnvelope[],
  messageId: string): TemplateResult {
  const outcome = renderA2UITranscriptContent(envelopes);
  if (!outcome.ok) {
    return html`
      <div
        part="a2ui-error"
        role="alert"
        data-testid=${`operator-a2ui-error-${messageId}`}
      >
        ${outcome.message}
      </div>
    `;
  }

  return html`
    <div
      part="a2ui-content"
      class="operator-a2ui-content"
      data-testid=${`operator-a2ui-content-${messageId}`}
    >
      ${outcome.blocks.map(
        (block) => html`
          <div part="a2ui-block" class="a2ui-block" data-a2ui-block-id=${block.id}>
            <p part="a2ui-block-title" class="a2ui-block-title">${block.title}</p>
            ${block.subtitle
              ? html`<p part="a2ui-block-subtitle" class="a2ui-block-subtitle">${block.subtitle}</p>`: nothing}
          </div>
        `)}
    </div>
  `;
}
