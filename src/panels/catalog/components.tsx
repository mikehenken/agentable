/**
 * v1 catalog components (02 section 5). Presentational only: validated
 * props plus `SpecNodeContextValue` in, DOM out. Every user-facing string
 * resolves through the locale layer (`t`, D42); dates and numbers, when
 * these components grow them, render via the `Intl` helpers bound to the
 * same resolved locale.
 */
import React, { useMemo } from 'react';
import { t } from '../../i18n';
import type { SpecNodeContextValue } from '../types';
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

export const Header = (props: HeaderProps): React.ReactElement => (
  <div data-testid="header">{renderState(props.context?.state, props.title)}</div>
);

export interface FieldFormProps extends CatalogComponentProps {
  bind?: string;
  fields?: ReadonlyArray<Record<string, unknown>>;
}

export const FieldForm = (props: FieldFormProps): React.ReactElement => (
  <form data-testid="field-form">{renderState(props.context?.state, props.bind)}</form>
);

export interface ActionRowProps extends CatalogComponentProps {
  actions?: readonly string[];
}

export const ActionRow = (props: ActionRowProps): React.ReactElement => (
  <div data-testid="action-row">{renderState(props.context?.state, props.actions?.join(','))}</div>
);

export interface ListProps extends CatalogComponentProps {
  bind?: string;
  row?: Record<string, unknown>;
  rowKey?: string;
  /** Per-instance override of the declared D56 windowing threshold. */
  virtualizeThreshold?: number;
}

/**
 * When the bound source resolves to an array of records, rows render
 * through `<agentable-virtual-list>`, which windows above the declared
 * threshold (D56) using Lit `repeat` with stable keys. Non-array data
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
}

export const Table = (props: TableProps): React.ReactElement => (
  <table data-testid="table">
    <tbody>
      <tr>
        <td>{renderState(props.context?.state, props.bind)}</td>
      </tr>
    </tbody>
  </table>
);

export interface BadgeProps extends CatalogComponentProps {
  text?: string;
  bind?: string;
  tone?: string;
}

export const Badge = (props: BadgeProps): React.ReactElement => (
  <span data-testid="badge">{renderState(props.context?.state, props.text || props.bind)}</span>
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
  <div data-testid="empty-state">{renderState(props.context?.state, props.message)}</div>
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
