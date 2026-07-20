import { z } from 'zod';
import { t } from '../../i18n';
import type { JsonObject, JsonValue, PanelSpec, SpecAction, SpecNode, SpecSourceBinding } from '../types';
import {
  CURRENT_SPEC_VERSION,
  SPEC_MAX_DEPTH,
  SPEC_MAX_NODES,
  SPEC_MAX_STRING_PROP,
  SPEC_MAX_TOTAL_BYTES,
  UNKNOWN_NODE_PLACEHOLDER_TYPE,
  UNKNOWN_NODE_RAW_KEY,
} from './constants';
import { migrateSpec } from './migrate';
import type {
  NormalizedPanelSpec,
  NormalizedSpecNode,
  SpecIssue,
  SpecValidationContext,
  ValidateSpecOptions,
  ValidateSpecResult,
} from './types';

const envelopeSchema = z.object({
  v: z.number().int().min(0),
  origin: z.enum(['host', 'agent']),
  root: z.string().min(1),
  nodes: z.record(z.string(), z.unknown()),
  sources: z.record(z.string(), z.unknown()).optional(),
  state: z.record(z.string(), z.unknown()).optional(),
  actions: z.record(z.string(), z.unknown()).optional(),
});

const URL_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const JAVASCRIPT_SCHEME = /^javascript:/i;
const HTTP_SCHEME = /^https?:\/\//i;
const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function issue(
  code: SpecIssue['code'],
  message: string,
  severity: SpecIssue['severity'],
  extra?: Pick<SpecIssue, 'nodeId' | 'path' | 'hint'>,
): SpecIssue {
  return { code, message, severity, ...extra };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsDangerousObjectKey(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => DANGEROUS_OBJECT_KEYS.has(key));
}

function setSafeJsonProperty(target: JsonObject, key: string, value: JsonValue): void {
  if (DANGEROUS_OBJECT_KEYS.has(key)) return;
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function parseNode(raw: unknown): SpecNode | null {
  if (!isRecord(raw) || typeof raw.type !== 'string' || raw.type.length === 0) {
    return null;
  }
  if (containsDangerousObjectKey(raw)) {
    return null;
  }
  const node: SpecNode = { type: raw.type };
  if (raw.props !== undefined) {
    if (!isRecord(raw.props) || containsDangerousObjectKey(raw.props)) return null;
    node.props = raw.props as JsonObject;
  }
  if (raw.children !== undefined) {
    if (!Array.isArray(raw.children) || !raw.children.every((c) => typeof c === 'string')) {
      return null;
    }
    node.children = raw.children as string[];
  }
  if (raw.showIf !== undefined) {
    if (!isRecord(raw.showIf) || !Array.isArray(raw.showIf.$eq) || raw.showIf.$eq.length !== 2) {
      return null;
    }
    node.showIf = { $eq: raw.showIf.$eq as [JsonValue, JsonValue] };
  }
  if (Object.keys(raw).some((key) => !['type', 'props', 'children', 'showIf'].includes(key))) {
    // Preserve extra keys only through unknown-node raw capture; basic parse still succeeds.
    if (node.props === undefined) node.props = {};
    for (const key of Object.keys(raw)) {
      if (!['type', 'props', 'children', 'showIf'].includes(key)) {
        if (DANGEROUS_OBJECT_KEYS.has(key)) return null;
        setSafeJsonProperty(node.props as JsonObject, key, raw[key] as JsonValue);
      }
    }
  }
  return node;
}

function specByteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function collectStringLengths(
  value: JsonValue,
  path: string,
  out: Array<{ path: string; length: number }>,
): void {
  if (typeof value === 'string') {
    out.push({ path, length: value.length });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectStringLengths(entry, `${path}[${index}]`, out);
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      collectStringLengths(entry as JsonValue, path ? `${path}.${key}` : key, out);
    }
  }
}

function containsControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function stripControlChars(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code > 0x1f && code !== 0x7f) {
      out += value[i];
    }
  }
  return out;
}

function walkJsonStrings(
  value: JsonValue,
  visitor: (text: string, path: string) => void,
  path = '',
): void {
  if (typeof value === 'string') {
    visitor(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      walkJsonStrings(entry, visitor, `${path}[${index}]`);
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      walkJsonStrings(entry as JsonValue, visitor, path ? `${path}.${key}` : key);
    }
  }
}

function looksLikeUrl(value: string): boolean {
  return URL_SCHEME_PATTERN.test(value.trim()) || value.trim().startsWith('//');
}

function isAllowedHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (JAVASCRIPT_SCHEME.test(trimmed)) return false;
  if (!HTTP_SCHEME.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function collectActionRefs(value: JsonValue, path: string, refs: Array<{ ref: string; path: string }>): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectActionRefs(entry, `${path}[${index}]`, refs);
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (key === 'action' && typeof entry === 'string') {
        refs.push({ ref: entry, path: childPath });
      } else if (key === 'actions' && Array.isArray(entry)) {
        entry.forEach((item, index) => {
          if (typeof item === 'string') {
            refs.push({ ref: item, path: `${childPath}[${index}]` });
          } else if (isRecord(item) && typeof item.action === 'string') {
            refs.push({ ref: item.action, path: `${childPath}[${index}].action` });
          }
        });
      } else {
        collectActionRefs(entry as JsonValue, childPath, refs);
      }
    }
  }
}

function normalizeActionRef(ref: string): string {
  return ref.normalize('NFKC');
}

function isSmuggledActionRef(ref: string): boolean {
  const normalized = normalizeActionRef(ref);
  return normalized.includes(':') || normalized.includes('/') || normalized.startsWith('//');
}

function scanStringForSanitizationIssues(
  text: string,
  path: string,
  errors: SpecIssue[],
  nodeId?: string,
): void {
  if (JAVASCRIPT_SCHEME.test(text.trim())) {
    errors.push(
      issue(
        'SPEC_SANITIZE_JAVASCRIPT_URL',
        t('validation.sanitize.javascriptUrl', { path }),
        'error',
        { nodeId, path },
      ),
    );
  } else if (looksLikeUrl(text) && !isAllowedHttpUrl(text)) {
    errors.push(
      issue(
        'SPEC_SANITIZE_URL_SCHEME',
        t('validation.sanitize.urlScheme', { path }),
        'error',
        { nodeId, path, hint: t('validation.sanitize.urlScheme.hint') },
      ),
    );
  }
  if (containsControlChar(text)) {
    errors.push(
      issue(
        'SPEC_SANITIZE_CONTROL_CHAR',
        t('validation.sanitize.controlChar', { path }),
        'error',
        { nodeId, path },
      ),
    );
  }
}

function walkJsonStringsForSanitization(
  value: JsonValue,
  pathPrefix: string,
  errors: SpecIssue[],
  nodeId?: string,
): void {
  walkJsonStrings(value, (text, subPath) => {
    const fullPath = pathPrefix ? `${pathPrefix}.${subPath}` : subPath;
    scanStringForSanitizationIssues(text, fullPath, errors, nodeId);
  });
}

function collectActionStringFields(action: SpecAction): Array<{ path: string; value: string }> {
  const fields: Array<{ path: string; value: string }> = [];
  switch (action.kind) {
    case 'mutate':
      fields.push({ path: 'source', value: action.source }, { path: 'op', value: action.op });
      if (typeof action.confirm === 'string') {
        fields.push({ path: 'confirm', value: action.confirm });
      }
      if (Array.isArray(action.targetFields)) {
        action.targetFields.forEach((field, index) => {
          fields.push({ path: `targetFields[${index}]`, value: field });
        });
      }
      break;
    case 'host':
      fields.push({ path: 'action', value: action.action });
      break;
    case 'panel':
      fields.push({ path: 'panelId', value: action.panelId });
      if (typeof action.scopeFrom === 'string') {
        fields.push({ path: 'scopeFrom', value: action.scopeFrom });
      }
      break;
    case 'prompt':
      fields.push({ path: 'prompt', value: action.prompt });
      break;
    default:
      break;
  }
  return fields;
}

interface TreeAnalysis {
  depth: number;
  cycles: string[][];
  duplicateChildren: Array<{ nodeId: string; childId: string }>;
  orphans: string[];
}

function analyzeTree(root: string, nodes: Record<string, SpecNode>): TreeAnalysis {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];
  const duplicateChildren: Array<{ nodeId: string; childId: string }> = [];
  let maxDepth = 0;

  const dfs = (nodeId: string, depth: number, trail: string[]): void => {
    maxDepth = Math.max(maxDepth, depth);
    if (stack.has(nodeId)) {
      const cycleStart = trail.indexOf(nodeId);
      cycles.push(cycleStart >= 0 ? [...trail.slice(cycleStart), nodeId] : [nodeId]);
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    stack.add(nodeId);
    const node = nodes[nodeId];
    const children = node?.children ?? [];
    const seenChild = new Set<string>();
    for (const childId of children) {
      if (seenChild.has(childId)) {
        duplicateChildren.push({ nodeId, childId });
      }
      seenChild.add(childId);
      if (nodes[childId] === undefined) continue;
      dfs(childId, depth + 1, [...trail, nodeId]);
    }
    stack.delete(nodeId);
  };

  if (nodes[root] !== undefined) {
    dfs(root, 1, []);
  }

  const reachable = new Set<string>();
  const markReachable = (nodeId: string): void => {
    if (reachable.has(nodeId) || nodes[nodeId] === undefined) return;
    reachable.add(nodeId);
    for (const childId of nodes[nodeId].children ?? []) {
      markReachable(childId);
    }
  };
  markReachable(root);

  const orphans = Object.keys(nodes).filter((id) => !reachable.has(id));

  return { depth: maxDepth, cycles, duplicateChildren, orphans };
}

function sanitizeJsonValue(value: JsonValue): { value: JsonValue; changed: boolean } {
  if (typeof value === 'string') {
    const cleaned = stripControlChars(value);
    return { value: cleaned, changed: cleaned !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const result = sanitizeJsonValue(entry);
      changed = changed || result.changed;
      return result.value;
    });
    return { value: next, changed };
  }
  if (isRecord(value)) {
    let changed = false;
    const next: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      const result = sanitizeJsonValue(entry as JsonValue);
      changed = changed || result.changed;
      next[key] = result.value;
    }
    return { value: next, changed };
  }
  return { value, changed: false };
}

function normalizeUnknownNode(nodeId: string, raw: unknown, parsed: SpecNode): NormalizedSpecNode {
  const rawRecord = isRecord(raw) ? (raw as JsonObject) : ({ type: parsed.type } as JsonObject);
  return {
    type: UNKNOWN_NODE_PLACEHOLDER_TYPE,
    props: {
      originalType: parsed.type,
      nodeId,
    },
    ...(parsed.children !== undefined ? { children: [...parsed.children] } : {}),
    ...(parsed.showIf !== undefined ? { showIf: parsed.showIf } : {}),
    [UNKNOWN_NODE_RAW_KEY]: rawRecord,
  };
}

function parseSources(raw: Record<string, unknown>): Record<string, SpecSourceBinding> | null {
  const sources: Record<string, SpecSourceBinding> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!isRecord(value) || typeof value.source !== 'string') return null;
    sources[name] = {
      source: value.source,
      ...(isRecord(value.params) ? { params: value.params as JsonObject } : {}),
    };
  }
  return sources;
}

function parseActions(raw: Record<string, unknown>): Record<string, SpecAction> | null {
  const actions: Record<string, SpecAction> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value) || typeof value.kind !== 'string') return null;
    switch (value.kind) {
      case 'mutate': {
        if (typeof value.source !== 'string' || typeof value.op !== 'string') return null;
        actions[id] = {
          kind: 'mutate',
          source: value.source,
          op: value.op,
          ...(typeof value.mutates === 'boolean' ? { mutates: value.mutates } : {}),
          ...(typeof value.destructive === 'boolean' ? { destructive: value.destructive } : {}),
          ...(typeof value.confirm === 'string' ? { confirm: value.confirm } : {}),
          ...(value.variant === 'ai' ? { variant: 'ai' as const } : {}),
          ...(Array.isArray(value.targetFields)
            ? { targetFields: value.targetFields.filter((f): f is string => typeof f === 'string') }
            : {}),
        };
        break;
      }
      case 'host': {
        if (typeof value.action !== 'string') return null;
        actions[id] = { kind: 'host', action: value.action };
        break;
      }
      case 'panel': {
        if (typeof value.panelId !== 'string') return null;
        actions[id] = {
          kind: 'panel',
          panelId: value.panelId,
          ...(typeof value.scopeFrom === 'string' ? { scopeFrom: value.scopeFrom } : {}),
        };
        break;
      }
      case 'prompt': {
        if (typeof value.prompt !== 'string') return null;
        actions[id] = { kind: 'prompt', prompt: value.prompt };
        break;
      }
      default:
        return null;
    }
  }
  return actions;
}

function formatAgentRepairResult(
  errors: SpecIssue[],
  agentRepairRound: boolean | undefined,
): Pick<ValidateSpecResult, 'agentRepairEligible'> {
  if (!agentRepairRound) return {};
  return { agentRepairEligible: errors.length > 0 };
}

/**
 * Seven-step validation pipeline (D9). Steps 1-6 always run; step 7 marks
 * agent repair eligibility when `options.agentRepairRound` is true.
 */
export function validateSpec(
  input: unknown,
  context: SpecValidationContext,
  options: ValidateSpecOptions = {},
): ValidateSpecResult {
  const errors: SpecIssue[] = [];
  const warnings: SpecIssue[] = [];

  // --- Step 1: envelope parse + version / migration ---
  if (specByteSize(input) > SPEC_MAX_TOTAL_BYTES) {
    errors.push(
      issue(
        'SPEC_BUDGET_SIZE',
        t('validation.budget.size', { max: SPEC_MAX_TOTAL_BYTES }),
        'error',
        { hint: t('validation.budget.size.hint') },
      ),
    );
    return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
  }

  const envelopeResult = envelopeSchema.safeParse(input);
  if (!envelopeResult.success) {
    errors.push(
      issue('SPEC_ENVELOPE_INVALID', t('validation.envelope.invalid'), 'error', {
        hint: t('validation.envelope.invalid.hint'),
      }),
    );
    return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
  }

  const envelope = envelopeResult.data;

  if (envelope.v > CURRENT_SPEC_VERSION) {
    errors.push(
      issue(
        'SPEC_VERSION_UNKNOWN',
        t('validation.version.newer', { version: envelope.v, supported: CURRENT_SPEC_VERSION }),
        'error',
      ),
    );
    return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
  }

  const parsedNodes: Record<string, SpecNode> = {};
  for (const [nodeId, raw] of Object.entries(envelope.nodes)) {
    const parsed = parseNode(raw);
    if (parsed === null) {
      errors.push(
        issue('SPEC_NODES_INVALID', t('validation.node.invalid', { nodeId }), 'error', {
          nodeId,
          hint: t('validation.node.invalid.hint'),
        }),
      );
      continue;
    }
    parsedNodes[nodeId] = parsed;
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
  }

  if (!envelope.root.trim()) {
    errors.push(issue('SPEC_ROOT_MISSING', t('validation.root.missing'), 'error'));
    return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
  }

  if (parsedNodes[envelope.root] === undefined) {
    errors.push(
      issue('SPEC_ROOT_UNKNOWN', t('validation.root.unknown', { root: envelope.root }), 'error', {
        nodeId: envelope.root,
      }),
    );
    return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
  }

  let workingSpec: PanelSpec = {
    v: envelope.v,
    origin: envelope.origin,
    root: envelope.root,
    nodes: parsedNodes,
  };
  if (envelope.sources !== undefined) {
    const sources = parseSources(envelope.sources);
    if (sources === null) {
      errors.push(
        issue('SPEC_ENVELOPE_INVALID', t('validation.envelope.sourcesInvalid'), 'error', {
          path: 'sources',
        }),
      );
      return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
    }
    workingSpec = { ...workingSpec, sources };
  }
  if (envelope.state !== undefined) {
    workingSpec = { ...workingSpec, state: envelope.state as JsonObject };
  }

  if (envelope.actions !== undefined) {
    const actions = parseActions(envelope.actions);
    if (actions === null) {
      errors.push(
        issue('SPEC_ENVELOPE_INVALID', t('validation.envelope.actionsInvalid'), 'error', {
          path: 'actions',
        }),
      );
      return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
    }
    workingSpec.actions = actions;
  }

  if (workingSpec.v < CURRENT_SPEC_VERSION) {
    const migrations = context.migrations ?? [];
    if (migrations.length === 0) {
      errors.push(
        issue(
          'SPEC_VERSION_UNKNOWN',
          t('validation.version.needsMigrations', {
            version: workingSpec.v,
            supported: CURRENT_SPEC_VERSION,
          }),
          'error',
          { hint: t('validation.version.needsMigrations.hint') },
        ),
      );
      return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
    }
    try {
      const migrated = migrateSpec(workingSpec, migrations, CURRENT_SPEC_VERSION);
      workingSpec = migrated.spec;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('validation.version.migrationFailed');
      errors.push(
        issue('SPEC_VERSION_UNKNOWN', message, 'error', {
          hint: t('validation.version.migrationFailed.hint'),
        }),
      );
      return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
    }
  }

  // --- Step 5 (early): node budget ---
  const nodeCount = Object.keys(workingSpec.nodes).length;
  if (nodeCount > SPEC_MAX_NODES) {
    errors.push(
      issue(
        'SPEC_BUDGET_NODES',
        t('validation.budget.nodes', { count: nodeCount, max: SPEC_MAX_NODES }),
        'error',
        { hint: t('validation.budget.nodes.hint', { max: SPEC_MAX_NODES }) },
      ),
    );
  }

  const tree = analyzeTree(workingSpec.root, workingSpec.nodes);
  if (tree.depth > SPEC_MAX_DEPTH) {
    errors.push(
      issue(
        'SPEC_BUDGET_DEPTH',
        t('validation.budget.depth', { depth: tree.depth, max: SPEC_MAX_DEPTH }),
        'error',
        { nodeId: workingSpec.root, hint: t('validation.budget.depth.hint') },
      ),
    );
  }

  for (const cycle of tree.cycles) {
    errors.push(
      issue(
        'SPEC_CYCLE',
        t('validation.tree.cycle', { cycle: cycle.join(' -> ') }),
        'error',
        { nodeId: cycle[0], hint: t('validation.tree.cycle.hint') },
      ),
    );
  }

  for (const dup of tree.duplicateChildren) {
    errors.push(
      issue(
        'SPEC_DUPLICATE_CHILD',
        t('validation.tree.duplicateChild', { nodeId: dup.nodeId, childId: dup.childId }),
        'error',
        { nodeId: dup.nodeId, hint: t('validation.tree.duplicateChild.hint') },
      ),
    );
  }

  for (const orphanId of tree.orphans) {
    warnings.push(
      issue('SPEC_ORPHAN_NODE', t('validation.tree.orphan', { nodeId: orphanId }), 'warning', {
        nodeId: orphanId,
      }),
    );
  }

  // --- Step 2: catalog membership + unknown placeholder ---
  const normalizedNodes: Record<string, NormalizedSpecNode> = {};
  for (const [nodeId, raw] of Object.entries(envelope.nodes)) {
    const node = workingSpec.nodes[nodeId];
    if (node === undefined) continue;
    const catalogEntry = context.catalog.get(node.type);
    if (catalogEntry === undefined) {
      warnings.push(
        issue(
          'SPEC_NODE_UNKNOWN',
          t('validation.node.unknownType', { type: node.type }),
          'warning',
          { nodeId, hint: t('validation.node.unknownType.hint') },
        ),
      );
      normalizedNodes[nodeId] = normalizeUnknownNode(nodeId, raw, node);
      continue;
    }
    normalizedNodes[nodeId] = { ...node };
  }

  // --- Step 3: per-node Zod prop validation ---
  for (const [nodeId, node] of Object.entries(normalizedNodes)) {
    if (node.type === UNKNOWN_NODE_PLACEHOLDER_TYPE) continue;
    const catalogEntry = context.catalog.get(
      workingSpec.nodes[nodeId]?.type ?? node.type,
    );
    if (catalogEntry === undefined) continue;
    const props = node.props ?? {};
    const result = catalogEntry.props.safeParse(props);
    if (!result.success) {
      errors.push(
        issue(
          'SPEC_NODE_PROPS_INVALID',
          t('validation.node.propsInvalid', { nodeId, type: catalogEntry.name }),
          'error',
          {
            nodeId,
            path: 'props',
            hint: result.error.issues[0]?.message ?? t('validation.node.propsInvalid.hint'),
          },
        ),
      );
    } else {
      normalizedNodes[nodeId] = { ...node, props: result.data as JsonObject };
    }
  }

  // --- Step 4: action resolution ---
  const actionIds = new Set(Object.keys(workingSpec.actions ?? {}));
  for (const [nodeId, node] of Object.entries(normalizedNodes)) {
    const refs: Array<{ ref: string; path: string }> = [];
    if (node.props !== undefined) {
      collectActionRefs(node.props, 'props', refs);
    }
    for (const { ref, path } of refs) {
      if (isSmuggledActionRef(ref)) {
        errors.push(
          issue(
            'SPEC_ACTION_REF_SMUGGLED',
            t('validation.action.refSmuggled', { ref }),
            'error',
            { nodeId, path, hint: t('validation.action.refSmuggled.hint') },
          ),
        );
        continue;
      }
      if (looksLikeUrl(ref) || JAVASCRIPT_SCHEME.test(ref)) {
        errors.push(
          issue(
            'SPEC_ACTION_URL_FORBIDDEN',
            t('validation.action.refUrl', { ref }),
            'error',
            { nodeId, path },
          ),
        );
        continue;
      }
      if (!actionIds.has(ref)) {
        errors.push(
          issue(
            'SPEC_ACTION_REF_MISSING',
            t('validation.action.refMissing', { ref }),
            'error',
            { nodeId, path, hint: t('validation.action.refMissing.hint') },
          ),
        );
      }
    }
  }

  if (workingSpec.actions !== undefined) {
    for (const [actionId, action] of Object.entries(workingSpec.actions)) {
      if (isSmuggledActionRef(actionId)) {
        errors.push(
          issue(
            'SPEC_ACTION_REF_SMUGGLED',
            t('validation.action.idSmuggled', { actionId }),
            'error',
            { path: `actions.${actionId}`, hint: t('validation.action.idSmuggled.hint') },
          ),
        );
      }

      const serialized = JSON.stringify(action);
      if (JAVASCRIPT_SCHEME.test(serialized) || /https?:\/\//i.test(serialized)) {
        errors.push(
          issue(
            'SPEC_ACTION_URL_FORBIDDEN',
            t('validation.action.urlPayload', { actionId }),
            'error',
            { path: `actions.${actionId}` },
          ),
        );
      }

      switch (action.kind) {
        case 'mutate':
          if (!context.adapterSources.has(action.source)) {
            errors.push(
              issue(
                'SPEC_ACTION_SOURCE_UNKNOWN',
                t('validation.action.sourceUnknown', { actionId, source: action.source }),
                'error',
                { path: `actions.${actionId}.source`, hint: t('validation.action.sourceUnknown.hint') },
              ),
            );
          }
          break;
        case 'host':
          if (!context.hostActions.has(action.action)) {
            errors.push(
              issue(
                'SPEC_HOST_ACTION_UNKNOWN',
                t('validation.action.hostUnknown', { action: action.action }),
                'error',
                { path: `actions.${actionId}.action` },
              ),
            );
          }
          break;
        case 'panel':
          if (!context.panelRegistry.has(action.panelId)) {
            errors.push(
              issue(
                'SPEC_PANEL_UNKNOWN',
                t('validation.action.panelUnknown', { actionId, panelId: action.panelId }),
                'error',
                { path: `actions.${actionId}.panelId` },
              ),
            );
          }
          break;
        default:
          break;
      }
    }
  }

  // --- Step 5 (continued): string prop budget ---
  for (const [nodeId, node] of Object.entries(normalizedNodes)) {
    if (node.props === undefined) continue;
    const lengths: Array<{ path: string; length: number }> = [];
    collectStringLengths(node.props, 'props', lengths);
    for (const entry of lengths) {
      if (entry.length > SPEC_MAX_STRING_PROP) {
        errors.push(
          issue(
            'SPEC_BUDGET_STRING',
            t('validation.budget.string', {
              path: entry.path,
              length: entry.length,
              max: SPEC_MAX_STRING_PROP,
            }),
            'error',
            { nodeId, path: entry.path },
          ),
        );
      }
    }
  }

  // --- Step 6: sanitization (full envelope per D9.6) ---
  if (workingSpec.state !== undefined) {
    walkJsonStringsForSanitization(workingSpec.state, 'state', errors);
  }

  if (workingSpec.sources !== undefined) {
    for (const [sourceName, binding] of Object.entries(workingSpec.sources)) {
      if (binding.params !== undefined) {
        walkJsonStringsForSanitization(
          binding.params,
          `sources.${sourceName}.params`,
          errors,
        );
      }
    }
  }

  if (workingSpec.actions !== undefined) {
    for (const [actionId, action] of Object.entries(workingSpec.actions)) {
      for (const field of collectActionStringFields(action)) {
        scanStringForSanitizationIssues(
          field.value,
          `actions.${actionId}.${field.path}`,
          errors,
        );
      }
    }
  }

  for (const [nodeId, node] of Object.entries(normalizedNodes)) {
    if (node.showIf !== undefined) {
      walkJsonStringsForSanitization(node.showIf.$eq, `${nodeId}.showIf.$eq`, errors, nodeId);
    }
    if (node.props === undefined) continue;
    walkJsonStringsForSanitization(node.props, `${nodeId}.props`, errors, nodeId);
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings, ...formatAgentRepairResult(errors, options.agentRepairRound) };
  }

  // Sanitize control chars in the success path (strip per D9.6).
  let sanitizedState: JsonObject | undefined;
  if (workingSpec.state !== undefined) {
    const sanitized = sanitizeJsonValue(workingSpec.state);
    if (sanitized.changed) {
      sanitizedState = sanitized.value as JsonObject;
    }
  }

  let sanitizedSources: Record<string, SpecSourceBinding> | undefined;
  if (workingSpec.sources !== undefined) {
    let sourcesChanged = false;
    const nextSources: Record<string, SpecSourceBinding> = {};
    for (const [sourceName, binding] of Object.entries(workingSpec.sources)) {
      if (binding.params === undefined) {
        nextSources[sourceName] = binding;
        continue;
      }
      const sanitized = sanitizeJsonValue(binding.params);
      sourcesChanged = sourcesChanged || sanitized.changed;
      nextSources[sourceName] = sanitized.changed
        ? { ...binding, params: sanitized.value as JsonObject }
        : binding;
    }
    if (sourcesChanged) {
      sanitizedSources = nextSources;
    }
  }

  for (const nodeId of Object.keys(normalizedNodes)) {
    const node = normalizedNodes[nodeId];
    if (node === undefined) continue;
    let nextNode = node;
    if (node.showIf !== undefined) {
      const sanitizedShowIf = sanitizeJsonValue(node.showIf.$eq);
      if (sanitizedShowIf.changed) {
        nextNode = {
          ...nextNode,
          showIf: { $eq: sanitizedShowIf.value as [JsonValue, JsonValue] },
        };
      }
    }
    if (node.props !== undefined) {
      const sanitized = sanitizeJsonValue(node.props);
      if (sanitized.changed) {
        nextNode = { ...nextNode, props: sanitized.value as JsonObject };
      }
    }
    if (nextNode !== node) {
      normalizedNodes[nodeId] = nextNode;
    }
  }

  const normalized: NormalizedPanelSpec = {
    ...workingSpec,
    v: CURRENT_SPEC_VERSION,
    nodes: normalizedNodes,
    ...(sanitizedState !== undefined ? { state: sanitizedState } : {}),
    ...(sanitizedSources !== undefined ? { sources: sanitizedSources } : {}),
  };

  // --- Step 7: agent repair eligibility flag ---
  return {
    ok: true,
    spec: normalized,
    warnings,
    ...formatAgentRepairResult([], options.agentRepairRound),
  };
}

export { CURRENT_SPEC_VERSION } from './constants';
