/**
 * In-memory session backing the spec inspector devtools panel.
 */
import type { JsonObject, PanelSpec } from '../panels/types';
import {
  extractBindingRowsFromSpec,
  mapValidationIssuesToRows,
} from './specDevtoolsRows';
import type {
  BindingInspectorRow,
  InspectSpecInput,
  RecordHitlQueuedInput,
  RecordHitlResolvedInput,
  SpecDevtoolsEventRow,
  SpecDevtoolsListener,
  SpecDevtoolsSnapshot,
  Unsubscribe,
  ValidationTraceRow,
} from './types';

let eventCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `devtools-event-${eventCounter}`;
}

function cloneSpecJson(spec: PanelSpec | null): JsonObject | null {
  if (spec === null) return null;
  return structuredClone(spec) as unknown as JsonObject;
}

function appendEvent(
  history: SpecDevtoolsEventRow[],
  kind: SpecDevtoolsEventRow['kind'],
  title: string,
  subtitle: string): void {
  history.unshift({
    id: nextEventId(),
    ts: new Date().toISOString(),
    kind,
    title,
    subtitle,
  });
}

export interface SpecDevtoolsSession {
  inspectSpec(input: InspectSpecInput): void;
  recordRepairAttempt(input: InspectSpecInput): void;
  recordHitlQueued(input: RecordHitlQueuedInput): void;
  recordHitlResolved(input: RecordHitlResolvedInput): void;
  recordActionRun(panelId: string, actionId: string, status: string): void;
  clear(): void;
  getSnapshot(): SpecDevtoolsSnapshot;
  subscribe(listener: SpecDevtoolsListener): Unsubscribe;
}

export function createSpecDevtoolsSession(): SpecDevtoolsSession {
  let targetLabel = '—';
  let specJson: JsonObject | null = null;
  let validationTrace: ValidationTraceRow[] = [];
  let bindings: BindingInspectorRow[] = [];
  let eventHistory: SpecDevtoolsEventRow[] = [];
  const listeners = new Set<SpecDevtoolsListener>();

  const notifySafe = (listener: SpecDevtoolsListener): void => {
    try {
      listener();
    } catch {
       // Dev-only observer; never break host runtime.
    }
  };

  const notify = (): void => {
    for (const listener of listeners) notifySafe(listener);
  };

  const applyInspection = (input: InspectSpecInput): void => {
    targetLabel = input.targetLabel;
    specJson = cloneSpecJson(input.spec);
    const errors = input.errors ?? [];
    const warnings = input.warnings ?? [];
    validationTrace = mapValidationIssuesToRows([...errors,...warnings], 'trace');
    bindings = extractBindingRowsFromSpec(input.spec);
  };

  return {
    inspectSpec(input: InspectSpecInput): void {
      applyInspection(input);
      const errorCount = input.errors?.length ?? 0;
      const warningCount = input.warnings?.length ?? 0;
      appendEvent(
        eventHistory,
        'validation',
        `Inspect ${input.targetLabel}`,
        errorCount > 0
          ? `${errorCount} error(s), ${warningCount} warning(s)`: warningCount > 0
            ? `${warningCount} warning(s)`: 'valid');
      notify();
    },

    recordRepairAttempt(input: InspectSpecInput): void {
      applyInspection(input);
      const operation = input.operation ?? 'compose';
      appendEvent(
        eventHistory,
        'repair',
        `${operation} repair round`,
        input.repairEligible === true
          ? 'agent repair eligible': 'terminal validation failure');
      notify();
    },

    recordHitlQueued(input: RecordHitlQueuedInput): void {
      const { request } = input;
      appendEvent(
        eventHistory,
        'hitl_queued',
        `HITL · ${request.actionLabel}`,
        `${request.panelId} · ${request.agentLabel}`);
      notify();
    },

    recordHitlResolved(input: RecordHitlResolvedInput): void {
      const { request, status } = input;
      appendEvent(
        eventHistory,
        'hitl_resolved',
        `HITL ${status}`,
        `${request.panelId} · ${request.actionId}`);
      notify();
    },

    recordActionRun(panelId: string, actionId: string, status: string): void {
      appendEvent(eventHistory, 'action', `Action ${actionId}`, `${panelId} · ${status}`);
      notify();
    },

    clear(): void {
      targetLabel = '—';
      specJson = null;
      validationTrace = [];
      bindings = [];
      eventHistory = [];
      notify();
    },

    getSnapshot(): SpecDevtoolsSnapshot {
      return {
        targetLabel,
        specJson,
        validationTrace: [...validationTrace],
        bindings: [...bindings],
        eventHistory: [...eventHistory],
      };
    },

    subscribe(listener: SpecDevtoolsListener): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function resetSpecDevtoolsCounterForTests(): void {
  eventCounter = 0;
}
