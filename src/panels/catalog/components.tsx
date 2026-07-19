import React from 'react';
import type { SpecNodeContextValue } from '../types';

function renderState(state: SpecNodeContextValue['state'], children: React.ReactNode) {
  if (state === 'loading') return <div data-testid="loading-skeleton">Loading...</div>;
  if (state === 'error') return <div data-testid="error-card">Error loading data</div>;
  if (state === 'empty') return <div data-testid="empty-placeholder">No data available</div>;
  
  return (
    <>
      {children}
      {state === 'dirty' && <span data-testid="dirty-indicator">Unsaved changes</span>}
      {state === 'saving' && <span data-testid="saving-spinner">Saving...</span>}
      {state === 'stale' && <span data-testid="stale-banner-inline">Data is stale</span>}
    </>
  );
}

export const PanelBody = (props: any) => <div data-testid="panel-body">{renderState(props.context?.state, props.children)}</div>;
export const Header = (props: any) => <div data-testid="header">{renderState(props.context?.state, props.title)}</div>;
export const FieldForm = (props: any) => <form data-testid="field-form">{renderState(props.context?.state, props.bind)}</form>;
export const ActionRow = (props: any) => <div data-testid="action-row">{renderState(props.context?.state, props.actions?.join(','))}</div>;
export const List = (props: any) => <ul data-testid="list">{renderState(props.context?.state, props.bind)}</ul>;
export const Table = (props: any) => <table data-testid="table"><tbody><tr><td>{renderState(props.context?.state, props.bind)}</td></tr></tbody></table>;
export const Badge = (props: any) => <span data-testid="badge">{renderState(props.context?.state, props.text || props.bind)}</span>;
export const Tabs = (props: any) => <div data-testid="tabs">{renderState(props.context?.state, props.tabs?.map((t: any) => t.id).join(','))}</div>;
export const Confirm = (props: any) => <dialog data-testid="confirm">{renderState(props.context?.state, "Confirm")}</dialog>;
export const StaleBanner = (props: any) => <div data-testid="stale-banner">{renderState(props.context?.state, "Stale")}</div>;
export const EmptyState = (props: any) => <div data-testid="empty-state">{renderState(props.context?.state, props.message)}</div>;
export const FilterChips = (props: any) => <div data-testid="filter-chips">{renderState(props.context?.state, props.bind)}</div>;
export const CustomSlot = (props: any) => <div data-testid="custom-slot">{renderState(props.context?.state, props.name)}</div>;
