/**
 * Shared runtime for catalog field-form and action-row coordination.
 * SpecRenderer mounts the provider; catalog components consume it.
 */
import React, { createContext, useContext } from 'react';
import type { NormalizedPanelSpec } from '../spec';
import type { SpecAction, SpecSourceBinding } from '../types';
import type { FormBus } from './formBus';

export interface FormRuntimeValue {
  formBus: FormBus;
  sources: Readonly<Record<string, SpecSourceBinding>> | undefined;
  actions: Readonly<Record<string, SpecAction>> | undefined;
}

const FormRuntimeContext = createContext<FormRuntimeValue | null>(null);

export interface FormRuntimeProviderProps {
  value: FormRuntimeValue;
  children: React.ReactNode;
}

export function FormRuntimeProvider(props: FormRuntimeProviderProps): React.ReactElement {
  return (
    <FormRuntimeContext.Provider value={props.value}>{props.children}</FormRuntimeContext.Provider>
  );
}

export function useFormRuntime(): FormRuntimeValue {
  const value = useContext(FormRuntimeContext);
  if (value === null) {
    throw new Error('Catalog form components must render inside FormRuntimeProvider');
  }
  return value;
}

/** Returns null when rendered outside FormRuntimeProvider (e.g. isolated unit tests). */
export function useOptionalFormRuntime(): FormRuntimeValue | null {
  return useContext(FormRuntimeContext);
}

export function createFormRuntimeValue(
  formBus: FormBus,
  spec: NormalizedPanelSpec,
): FormRuntimeValue {
  return {
    formBus,
    sources: spec.sources,
    actions: spec.actions,
  };
}
