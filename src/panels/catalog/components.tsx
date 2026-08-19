/**
 * v1 catalog components (02 section 5). Validated props plus
 * `SpecNodeContextValue` in; field-form owns draft state for bound sources
 * including the P7 `repeatable-group` field primitive.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';
import { resolveCatalogString } from '../../i18n/resolveCatalogString';
import { sanitizeInertText } from '../../security/codeExecutionBoundary';
import type { CatalogEntry, PanelScope, SpecAction, SpecNodeContextValue } from '../types';
import type { DeclaredAction } from '../renderer/types';
import {
  FieldEditor,
  type FieldDefProps,
  useFieldValueChange,
} from './fieldFormFields';
import { asRecord, mergeDraft } from './fieldPaths';
import { useFormRuntime } from './formRuntime';
import { extractListRows } from './virtualization';
import type { AgentableVirtualListElement } from './virtual-list';
import './virtual-list';

interface CatalogComponentProps {
  context?: SpecNodeContextValue;
  children?: React.ReactNode;
}

function renderState(
  state: SpecNodeContextValue['state'] | undefined,
  children: React.ReactNode,
): React.ReactNode {
  if (state === 'loading') return <div data-testid="loading-skeleton">{t('catalog.state.loading')}</div>;
  if (state === 'error') return <div data-testid="error-card">{t('catalog.state.error')}</div>;
  if (state === 'empty') return <div data-testid="empty-placeholder">{t('catalog.state.empty')}</div>;

  return (
    <>
      <span data-testid="populated-content">{children}</span>
      {state === 'dirty' && <span data-testid="dirty-indicator">{t('catalog.state.dirty')}</span>}
      {state === 'saving' && <span data-testid="saving-spinner">{t('catalog.state.saving')}</span>}
      {state === 'stale' && <span data-testid="stale-banner-inline">{t('catalog.state.stale')}</span>}
    </>
  );
}

export type PanelBodyProps = CatalogComponentProps;

export const PanelBody = (props: PanelBodyProps): React.ReactElement => (
  <div data-testid="panel-body">{renderState(props.context?.state, props.children)}</div>
);

export interface HeaderProps extends CatalogComponentProps {
  title?: string;
  icon?: string;
  subtitle?: string;
}

export const Header = (props: HeaderProps): React.ReactElement => {
  const titleText = props.title !== undefined ? resolveCatalogString(props.title) : '';
  const subtitleText =
    props.subtitle !== undefined ? resolveCatalogString(props.subtitle) : null;

  return (
    <div data-testid="header" className="spec-block spec-block--header">
      {renderState(
        props.context?.state,
        <>
          {titleText.length > 0 ? (
            <h2 className="spec-block__title">{titleText}</h2>
          ) : null}
          {subtitleText !== null && subtitleText.length > 0 ? (
            <p className="spec-block__subtitle">{subtitleText}</p>
          ) : null}
        </>,
      )}
    </div>
  );
};

export interface FieldFormProps extends CatalogComponentProps {
  bind?: string;
  fields?: ReadonlyArray<FieldDefProps>;
}

function isMutateAction(action: SpecAction | undefined): action is DeclaredAction {
  return action !== undefined && action.kind === 'mutate';
}

export const FieldForm = (props: FieldFormProps): React.ReactElement => {
  const { bind, fields, context } = props;
  const runtime = useFormRuntime();
  const ownerId = useId();
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);

  const serverData = bind !== undefined ? asRecord(context?.data[bind]) : undefined;
  const source =
    bind !== undefined && runtime.sources?.[bind] !== undefined
      ? runtime.sources[bind]?.source
      : undefined;

  const values = useMemo(() => mergeDraft(serverData, draft), [serverData, draft]);

  const latest = useRef({ context, serverData, draft });
  latest.current = { context, serverData, draft };

  const submit = useCallback((actionRef: string) => {
    const current = latest.current;
    if (current.context === undefined) return;
    const payload = mergeDraft(current.serverData, current.draft);
    current.context.dispatch(actionRef, payload);
  }, []);

  const fill = useCallback((patch: Record<string, unknown>) => {
    setDraft((current) => {
      const base = mergeDraft(latest.current.serverData, current);
      return { ...base, ...patch };
    });
    latest.current.context?.setDirty(true);
  }, []);

  useEffect(() => {
    if (source === undefined || context === undefined) {
      return undefined;
    }
    return runtime.formBus.register(ownerId, { source, submit, fill });
  }, [runtime.formBus, ownerId, source, submit, fill, context]);

  const prevStateRef = useRef(context?.state);
  useEffect(() => {
    const previous = prevStateRef.current;
    prevStateRef.current = context?.state;
    if (
      previous === 'saving' &&
      context?.state !== 'saving' &&
      context?.isDirty !== true
    ) {
      setDraft(null);
    }
  }, [context?.state, context?.isDirty]);

  const onDraftChange = useCallback(
    (nextDraft: Record<string, unknown>) => {
      setDraft(nextDraft);
      context?.setDirty(true);
    },
    [context],
  );

  const onValueChange = useFieldValueChange(values, onDraftChange);
  const saving = context?.state === 'saving';

  const fieldNodes =
    bind !== undefined ? (
      <>
        {(fields ?? []).map((field, index) => (
          <FieldEditor
            key={typeof field.bind === 'string' ? field.bind : `field-${index}`}
            field={field}
            fieldIndex={index}
            ownerId={ownerId}
            disabled={saving === true}
            values={values}
            onValueChange={onValueChange}
          />
        ))}
      </>
    ) : null;

  return (
    <form data-testid="field-form" onSubmit={(event) => event.preventDefault()}>
      {renderState(context?.state, fieldNodes)}
    </form>
  );
};

export interface ActionRowProps extends CatalogComponentProps {
  actions?: readonly string[];
}

function actionLabel(actionRef: string): string {
  if (actionRef === 'save') return t('catalog.action.save');
  return actionRef;
}

export const ActionRow = (props: ActionRowProps): React.ReactElement => {
  const { actions, context } = props;
  const runtime = useFormRuntime();

  const onActionClick = (actionRef: string): void => {
    if (context === undefined) return;
    const action = runtime.actions?.[actionRef];
    if (isMutateAction(action)) {
      const form = runtime.formBus.findBySource(action.source);
      if (form !== undefined) {
        form.submit(actionRef);
        return;
      }
    }
    context.dispatch(actionRef);
  };

  const buttons = (
    <>
      {(actions ?? []).map((actionRef) => (
        <button
          key={actionRef}
          type="button"
          data-testid={`panel-action-${actionRef}`}
          disabled={context?.state === 'saving'}
          onClick={() => onActionClick(actionRef)}
        >
          {actionLabel(actionRef)}
        </button>
      ))}
    </>
  );

  return <div data-testid="action-row">{renderState(context?.state, buttons)}</div>;
};

export interface ListProps extends CatalogComponentProps {
  bind?: string;
  row?: Record<string, unknown>;
  rowKey?: string;
 /** Per-instance override of the declared windowing threshold. */
  virtualizeThreshold?: number;
}

/**
 * When the bound source resolves to an array of records, rows render
 * through `<agentable-virtual-list>`, which windows above the declared
 * threshold using Lit `repeat` with stable keys. Non-array data
 * keeps the legacy presentational output so existing specs and the
 * builder/raw-IR byte-parity contract are untouched.
 */
export const List = (props: ListProps): React.ReactElement => {
  const bound = props.bind !== undefined ? props.context?.data[props.bind] : undefined;
  const rows = useMemo(
    () => extractListRows(bound, props.row, props.rowKey),
    [bound, props.row, props.rowKey],
  );

  if (props.context?.state === 'populated' && rows !== null) {
    const threshold = props.virtualizeThreshold;
    const applyProperties = (element: AgentableVirtualListElement | null): void => {
      if (element === null) return;
      element.items = rows;
      if (threshold !== undefined) {
        element.threshold = threshold;
      }
    };
    return (
      <ul data-testid="list">
        <span data-testid="populated-content">
          <agentable-virtual-list ref={applyProperties} data-testid="virtual-list" />
        </span>
      </ul>
    );
  }

  return <ul data-testid="list">{renderState(props.context?.state, props.bind)}</ul>;
};

export interface TableProps extends CatalogComponentProps {
  bind?: string;
  columns?: readonly Record<string, unknown>[];
}

interface TableColumnDef {
  field: string;
  label: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveTableColumn(column: Record<string, unknown>): TableColumnDef | null {
  const field =
    typeof column.bind === 'string' && column.bind.length > 0
      ? column.bind
      : typeof column.id === 'string' && column.id.length > 0
        ? column.id
        : null;
  if (field === null) {
    return null;
  }
  const rawLabel = column.label;
  const label =
    typeof rawLabel === 'string' && rawLabel.length > 0
      ? resolveCatalogString(rawLabel)
      : field;
  return { field, label };
}

function formatTableCellValue(field: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return '—';
  }
  if (field === 'status' && typeof value === 'string') {
    return <span className="spec-table__status">{value}</span>;
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed);
      }
    }
    return sanitizeInertText(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return sanitizeInertText(String(value));
}

export const Table = (props: TableProps): React.ReactElement => {
  const bound = props.bind !== undefined ? props.context?.data[props.bind] : undefined;
  const columns = (props.columns ?? [])
    .map((column) => resolveTableColumn(column))
    .filter((column): column is TableColumnDef => column !== null);
  const rows =
    Array.isArray(bound) && bound.length > 0 && bound.every(isPlainRecord) ? bound : null;

  if (props.context?.state === 'populated' && rows !== null && columns.length > 0) {
    return (
      <div data-testid="table" className="spec-block spec-block--table">
        <table className="spec-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.field} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={String(row.id ?? rowIndex)}>
                {columns.map((column) => (
                  <td key={column.field}>{formatTableCellValue(column.field, row[column.field])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div data-testid="table" className="spec-block spec-block--table">
      <table className="spec-table">
        <tbody>
          <tr>
            <td>{renderState(props.context?.state, props.bind)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export interface BadgeProps extends CatalogComponentProps {
  text?: string;
  bind?: string;
  tone?: string;
}

export const Badge = (props: BadgeProps): React.ReactElement => (
  <span data-testid="badge">
    {renderState(
      props.context?.state,
      sanitizeInertText(String(props.text || props.bind || '')),
    )}
  </span>
);

export interface TabsProps extends CatalogComponentProps {
  tabs?: ReadonlyArray<{ id: string; label: string; child: string }>;
}

export const Tabs = (props: TabsProps): React.ReactElement => (
  <div data-testid="tabs">
    {renderState(props.context?.state, props.tabs?.map((tab) => tab.id).join(','))}
  </div>
);

export type ConfirmProps = CatalogComponentProps;

export const Confirm = (props: ConfirmProps): React.ReactElement => (
  <dialog data-testid="confirm">{renderState(props.context?.state, t('catalog.confirm.title'))}</dialog>
);

export type StaleBannerProps = CatalogComponentProps;

export const StaleBanner = (props: StaleBannerProps): React.ReactElement => (
  <div data-testid="stale-banner">{renderState(props.context?.state, t('catalog.staleBanner.label'))}</div>
);

export interface EmptyStateProps extends CatalogComponentProps {
  message?: string;
  action?: string;
}

export const EmptyState = (props: EmptyStateProps): React.ReactElement => (
  <div data-testid="empty-state">
    {renderState(props.context?.state, resolveCatalogString(props.message))}
  </div>
);

export interface FilterChipsProps extends CatalogComponentProps {
  bind?: string;
}

export const FilterChips = (props: FilterChipsProps): React.ReactElement => (
  <div data-testid="filter-chips">{renderState(props.context?.state, props.bind)}</div>
);

export interface CustomSlotProps extends CatalogComponentProps {
  name?: string;
  props?: Record<string, unknown>;
}

export const CustomSlot = (props: CustomSlotProps): React.ReactElement => (
  <div data-testid="custom-slot">{renderState(props.context?.state, props.name)}</div>
);
