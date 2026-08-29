/**
 * Field-form field renderers, including the P7 `repeatable-group` primitive for
 * editable lists of typed sub-objects (Template AI rules, Forms field builder).
 */
import React, { useCallback } from 'react';
import { t } from '../../i18n';
import { sanitizeInertText } from '../../security/codeExecutionBoundary';
import {
  asRecord,
  asRecordArray,
  readFieldPath,
  splitFieldPath,
  writeFieldPath,
} from './fieldPaths';

export interface FieldDefProps {
  bind?: string;
  type?: string;
  label?: string;
  placeholder?: string;
  fields?: readonly FieldDefProps[];
  rowKey?: string;
  defaultItem?: Record<string, unknown>;
  minItems?: number;
  maxItems?: number;
  [key: string]: unknown;
}

export interface FieldEditorProps {
  field: FieldDefProps;
  fieldIndex: number;
  ownerId: string;
  disabled: boolean;
  values: Record<string, unknown>;
  onValueChange: (path: string, value: unknown) => void;
}

function fieldLabel(field: FieldDefProps, fallback: string): string {
  const raw =
    typeof field.label === 'string' && field.label.length > 0 ? field.label : fallback;
  return sanitizeInertText(raw);
}

function scalarToInputValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function inputTypeForField(field: FieldDefProps): string {
  if (field.type === 'url') return 'url';
  if (field.type === 'number') return 'number';
  return 'text';
}

function generateRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultValueForFieldType(type: string | undefined): unknown {
  switch (type) {
    case 'toggle':
      return false;
    case 'number':
      return 0;
    default:
      return '';
  }
}

function createRepeatableRowItem(
  nestedFields: readonly FieldDefProps[],
  rowKey: string,
  template: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const item: Record<string, unknown> =
    template !== undefined ? structuredClone(template) : {};
  if (item[rowKey] === undefined || item[rowKey] === null || item[rowKey] === '') {
    item[rowKey] = generateRowId();
  }
  for (const nested of nestedFields) {
    const nestedBind = nested.bind;
    if (typeof nestedBind !== 'string' || nestedBind.length === 0) continue;
    if (item[nestedBind] === undefined) {
      item[nestedBind] = defaultValueForFieldType(nested.type);
    }
  }
  return item;
}

export interface RepeatableGroupFieldProps {
  field: FieldDefProps;
  fieldIndex: number;
  ownerId: string;
  disabled: boolean;
  values: Record<string, unknown>;
  onValueChange: (path: string, value: unknown) => void;
}

export function RepeatableGroupField(props: RepeatableGroupFieldProps): React.ReactElement | null {
  const { field, fieldIndex, ownerId, disabled, values, onValueChange } = props;
  const groupBind = field.bind;
  if (typeof groupBind !== 'string' || groupBind.length === 0) {
    return null;
  }

  const nestedFields = Array.isArray(field.fields) ? field.fields : [];
  const rowKey = typeof field.rowKey === 'string' && field.rowKey.length > 0 ? field.rowKey : 'id';
  const minItems = typeof field.minItems === 'number' && field.minItems >= 0 ? field.minItems : 0;
  const maxItems =
    typeof field.maxItems === 'number' && field.maxItems > 0 ? field.maxItems : Number.POSITIVE_INFINITY;
  const defaultItem = asRecord(field.defaultItem);

  const rows = asRecordArray(readFieldPath(values, groupBind));
  const label = fieldLabel(field, groupBind);
  const canAdd = !disabled && rows.length < maxItems;
  const canRemove = !disabled && rows.length > minItems;

  const addRow = (): void => {
    const nextRows = [...rows, createRepeatableRowItem(nestedFields, rowKey, defaultItem)];
    onValueChange(groupBind, nextRows);
  };

  const removeRow = (rowIndex: number): void => {
    if (rowIndex < 0 || rowIndex >= rows.length) return;
    const nextRows = rows.filter((_row, index) => index !== rowIndex);
    onValueChange(groupBind, nextRows);
  };

  const updateNestedField = (rowIndex: number, nestedBind: string, value: unknown): void => {
    const path = `${groupBind}.${rowIndex}.${nestedBind}`;
    const draft = structuredClone(values);
    writeFieldPath(draft, path, value);
    onValueChange(groupBind, readFieldPath(draft, groupBind));
  };

  return (
    <fieldset
      data-testid="repeatable-group"
      data-repeatable-bind={groupBind}
      data-field-index={fieldIndex}
    >
      <legend>{label}</legend>
      <div data-testid="repeatable-group-rows">
        {rows.map((row, rowIndex) => {
          const rowIdentity = row[rowKey];
          const rowKeyValue =
            typeof rowIdentity === 'string' || typeof rowIdentity === 'number'
              ? String(rowIdentity)
              : String(rowIndex);
          return (
            <div
              key={rowKeyValue}
              data-testid="repeatable-group-row"
              data-row-index={rowIndex}
              data-row-key={rowKeyValue}
            >
              <span data-testid="repeatable-group-row-label">
                {t('catalog.repeatableGroup.rowLabel', { index: rowIndex + 1 })}
              </span>
              {nestedFields.map((nested, nestedIndex) => {
                const nestedBind =
                  typeof nested.bind === 'string' && nested.bind.length > 0
                    ? nested.bind
                    : `field-${nestedIndex}`;
                const nestedId = `${ownerId}-${groupBind}-${rowIndex}-${nestedBind}`;
                const nestedLabel = fieldLabel(nested, nestedBind);
                const nestedValue = scalarToInputValue(row[nestedBind]);
                const common = {
                  id: nestedId,
                  value: nestedValue,
                  disabled,
                  'data-testid': `repeatable-field-${groupBind}-${rowIndex}-${nestedBind}`,
                } as const;

                return (
                  <div
                    key={nestedBind}
                    data-repeatable-nested-field={nestedBind}
                  >
                    <label htmlFor={nestedId}>{nestedLabel}</label>
                    {nested.type === 'textarea' ? (
                      <textarea
                        {...common}
                        onChange={(event) =>
                          updateNestedField(rowIndex, nestedBind, event.target.value)
                        }
                      />
                    ) : nested.type === 'toggle' ? (
                      <input
                        id={nestedId}
                        type="checkbox"
                        checked={row[nestedBind] === true}
                        disabled={disabled}
                        data-testid={common['data-testid']}
                        onChange={(event) =>
                          updateNestedField(rowIndex, nestedBind, event.target.checked)
                        }
                      />
                    ) : (
                      <input
                        {...common}
                        type={inputTypeForField(nested)}
                        onChange={(event) =>
                          updateNestedField(rowIndex, nestedBind, event.target.value)
                        }
                      />
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                data-testid={`repeatable-group-remove-${rowIndex}`}
                disabled={!canRemove}
                onClick={() => removeRow(rowIndex)}
              >
                {t('catalog.repeatableGroup.removeRow')}
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        data-testid="repeatable-group-add"
        disabled={!canAdd}
        onClick={addRow}
      >
        {t('catalog.repeatableGroup.addRow')}
      </button>
    </fieldset>
  );
}

export function ScalarField(props: FieldEditorProps): React.ReactElement | null {
  const { field, fieldIndex, ownerId, disabled, values, onValueChange } = props;
  const fieldBind = field.bind;
  if (typeof fieldBind !== 'string' || fieldBind.length === 0) {
    return null;
  }

  const inputId = `${ownerId}-${fieldBind}`;
  const label = fieldLabel(field, fieldBind);
  const value = scalarToInputValue(readFieldPath(values, fieldBind));
  const common = {
    id: inputId,
    value,
    disabled,
    'data-testid': `field-${fieldBind}`,
  } as const;

  return (
    <div data-panel-field={fieldBind} data-field-index={fieldIndex}>
      <label htmlFor={inputId}>{label}</label>
      {field.type === 'textarea' ? (
        <textarea
          {...common}
          onChange={(event) => onValueChange(fieldBind, event.target.value)}
        />
      ) : field.type === 'toggle' ? (
        <input
          id={inputId}
          type="checkbox"
          checked={readFieldPath(values, fieldBind) === true}
          disabled={disabled}
          data-testid={common['data-testid']}
          onChange={(event) => onValueChange(fieldBind, event.target.checked)}
        />
      ) : (
        <input
          {...common}
          type={inputTypeForField(field)}
          onChange={(event) => onValueChange(fieldBind, event.target.value)}
        />
      )}
    </div>
  );
}

export function FieldEditor(props: FieldEditorProps): React.ReactElement | null {
  if (props.field.type === 'repeatable-group') {
    return <RepeatableGroupField {...props} />;
  }
  return <ScalarField {...props} />;
}

export function useFieldValueChange(
  values: Record<string, unknown>,
  onDraftChange: (nextDraft: Record<string, unknown>) => void,
): (path: string, value: unknown) => void {
  return useCallback(
    (path: string, value: unknown) => {
      const nextDraft = structuredClone(values);
      if (splitFieldPath(path).length === 1) {
        nextDraft[path] = value as never;
      } else {
        writeFieldPath(nextDraft, path, value);
      }
      onDraftChange(nextDraft);
    },
    [values, onDraftChange],
  );
}
