/**
 * Display rows and source constants for the Spec Inspector debug panel.
 */
import type { JsonValue, PanelSpec, SpecAction, SpecSourceBinding } from '../panels/types';
import type { SpecIssue } from '../panels/spec/types';
import type {
  BindingInspectorRow,
  SpecDevtoolsEventRow,
  ValidationTraceRow,
} from './types';

/** Panel id for the Tier 2 dockable spec inspector. */
export const SPEC_INSPECTOR_PANEL_ID = 'spec-inspector';

/** DataAdapter source: validation trace rows. */
export const DEVTOOLS_VALIDATION_SOURCE = 'devtools.validationTrace';

/** DataAdapter source: binding data rows. */
export const DEVTOOLS_BINDINGS_SOURCE = 'devtools.bindings';

/** DataAdapter source: HITL repair action history rows. */
export const DEVTOOLS_EVENTS_SOURCE = 'devtools.eventHistory';

function previewJson(value: JsonValue | undefined): string {
  if (value === undefined) return '—';
  try {
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 117)}…`: text;
  } catch {
    return String(value);
  }
}

function formatSourceBinding(binding: SpecSourceBinding): string {
  const params =
    binding.params !== undefined ? ` params=${previewJson(binding.params as JsonValue)}`: '';
  return `${binding.source}${params}`;
}

function formatAction(action: SpecAction): string {
  if (action.kind === 'mutate') {
    return `mutate ${action.source}${action.op !== undefined ? `/${action.op}`: ''}`;
  }
  if (action.kind === 'prompt') {
    return `prompt "${action.prompt.slice(0, 80)}"`;
  }
  if (action.kind === 'host') {
    return `host ${action.action}`;
  }
  if (action.kind === 'panel') {
    return `panel ${action.panelId}`;
  }
  return 'unknown';
}

export function mapValidationIssuesToRows(
  issues: readonly SpecIssue[],
  idPrefix: string): ValidationTraceRow[] {
  return issues.map((issue, index) => ({
    id: `${idPrefix}-${index}`,
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    nodeId: issue.nodeId,
    path: issue.path,
    hint: issue.hint,
  }));
}

export function extractBindingRowsFromSpec(spec: PanelSpec | null): BindingInspectorRow[] {
  if (spec === null) return [];

  const rows: BindingInspectorRow[] = [];

  for (const [key, binding] of Object.entries(spec.sources ?? {})) {
    rows.push({
      id: `source-${key}`,
      kind: 'source',
      key,
      detail: formatSourceBinding(binding),
    });
  }

  for (const [key, value] of Object.entries(spec.state ?? {})) {
    rows.push({
      id: `state-${key}`,
      kind: 'state',
      key,
      detail: previewJson(value),
    });
  }

  for (const [key, action] of Object.entries(spec.actions ?? {})) {
    rows.push({
      id: `action-${key}`,
      kind: 'action',
      key,
      detail: formatAction(action),
    });
  }

  return rows;
}

export function createValidationTraceListRow(row: ValidationTraceRow): {
  id: string;
  title: string;
  subtitle: string;
  severity: string;
} {
  const location =
    row.nodeId !== undefined
      ? row.nodeId: row.path !== undefined
        ? row.path: '—';
  const hint = row.hint !== undefined && row.hint.length > 0 ? ` · hint: ${row.hint}`: '';
  return {
    id: row.id,
    title: `${row.severity.toUpperCase()} · ${row.code}`,
    subtitle: `${row.message} (${location})${hint}`,
    severity: row.severity,
  };
}

export function createBindingListRow(row: BindingInspectorRow): {
  id: string;
  title: string;
  subtitle: string;
} {
  return {
    id: row.id,
    title: `${row.kind} · ${row.key}`,
    subtitle: row.detail,
  };
}

export function createEventHistoryListRow(row: SpecDevtoolsEventRow): {
  id: string;
  title: string;
  subtitle: string;
} {
  return {
    id: row.id,
    title: row.title,
    subtitle: `${row.ts} · ${row.subtitle}`,
  };
}
