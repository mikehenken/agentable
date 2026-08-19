import type { JsonObject, SpecAction, SpecNode } from '../panels/types';
import {
  A2UI_DATA_ADAPTER_SOURCE,
  A2UI_DATA_SOURCE_KEY,
  A2UI_LAYOUT_COMPONENTS,
  A2UI_SKIPPED_COMPONENTS,
} from './constants';
import { dataModelToPanelState, resolveDynamicString, type ResolveDynamicOptions } from './dynamicValue';
import type { A2UIComponent, A2UIIngestIssue } from './types';

export interface ComponentMapContext extends ResolveDynamicOptions {
  actions: Record<string, SpecAction>;
  warnings: A2UIIngestIssue[];
  errors: A2UIIngestIssue[];
  usesFieldForm: boolean;
}

function childIds(component: A2UIComponent): readonly string[] {
  if (Array.isArray(component.children) && component.children.length > 0) {
    return component.children;
  }
  if (typeof component.child === 'string' && component.child.length > 0) {
    return [component.child];
  }
  return [];
}

function pushError(
  ctx: ComponentMapContext,
  message: string,
  componentId?: string): void {
  ctx.errors.push({ code: 'A2UI_DYNAMIC_UNRESOLVED', message, componentId });
}

function resolveText(
  component: A2UIComponent,
  ctx: ComponentMapContext): string | null {
  const raw = component.text;
  if (raw === undefined) {
    return null;
  }
  const resolved = resolveDynamicString(raw, ctx);
  if (!resolved.ok) {
    pushError(ctx, resolved.reason, component.id);
    return null;
  }
  return resolved.value as string;
}

function stripMarkdownHeading(text: string): { title: string; subtitle?: string } {
  const match = /^#\s+(.+)$/.exec(text.trim());
  if (match !== null) {
    return { title: match[1]! };
  }
  return { title: text };
}

function textFieldBindPath(valueBinding: unknown): string | null {
  if (typeof valueBinding === 'object' && valueBinding !== null && !Array.isArray(valueBinding)) {
    const path = (valueBinding as Record<string, unknown>).path;
    if (typeof path === 'string') {
      const segments = path.replace(/^\//, '').split('/').filter(Boolean);
      return segments[segments.length - 1] ?? null;
    }
  }
  return null;
}

function textFieldVariantToKind(variant: unknown): string {
  if (variant === 'longText') {
    return 'textarea';
  }
  return 'text';
}

function mapButtonAction(
  component: A2UIComponent,
  ctx: ComponentMapContext): string | null {
  const action = component.action;
  if (typeof action !== 'object' || action === null || Array.isArray(action)) {
    return null;
  }
  const event = (action as Record<string, unknown>).event;
  if (typeof event !== 'object' || event === null || Array.isArray(event)) {
    return null;
  }
  const name = (event as Record<string, unknown>).name;
  if (typeof name !== 'string' || name.length === 0) {
    return null;
  }
  ctx.actions[name] = { kind: 'host', action: name };
  return name;
}

function mapTextComponent(component: A2UIComponent, ctx: ComponentMapContext): SpecNode | null {
  const text = resolveText(component, ctx);
  if (text === null) {
    return null;
  }
  const variant = typeof component.variant === 'string' ? component.variant: 'default';
  if (variant === 'h1' || variant === 'h2' || text.startsWith('#')) {
    const { title, subtitle } = stripMarkdownHeading(text);
    return {
      type: 'header',
      props: subtitle !== undefined ? { title, subtitle }: { title },
    };
  }
  if (variant === 'caption') {
    return { type: 'badge', props: { text } };
  }
  return { type: 'header', props: { title: text } };
}

function resolveLabel(component: A2UIComponent, ctx: ComponentMapContext): string {
  if (typeof component.label === 'string') {
    return component.label;
  }
  const resolved = resolveDynamicString(component.label, ctx);
  if (resolved.ok && typeof resolved.value === 'string') {
    return resolved.value;
  }
  return component.id;
}

function mapTextFieldComponent(component: A2UIComponent, ctx: ComponentMapContext): SpecNode | null {
  ctx.usesFieldForm = true;
  const label = resolveLabel(component, ctx);
  const bindPath = textFieldBindPath(component.value) ?? component.id;
  const fieldType = textFieldVariantToKind(component.variant);
  return {
    type: 'field-form',
    props: {
      bind: A2UI_DATA_SOURCE_KEY,
      fields: [{ bind: bindPath, type: fieldType, label }],
    },
  };
}

function mapButtonComponent(component: A2UIComponent, ctx: ComponentMapContext): SpecNode | null {
  const actionRef = mapButtonAction(component, ctx);
  if (actionRef === null) {
    pushError(ctx, 'Button is missing a host action event name', component.id);
    return null;
  }
  return {
    type: 'action-row',
    props: { actions: [actionRef] },
  };
}

function mapLayoutComponent(component: A2UIComponent): SpecNode {
  const children = childIds(component).filter((id) => id.length > 0);
  return children.length > 0
    ? { type: 'panel-body', children: [...children] }: { type: 'panel-body' };
}

function mapIconComponent(component: A2UIComponent): SpecNode {
  const name = typeof component.name === 'string' ? component.name: 'icon';
  return { type: 'badge', props: { text: name, tone: 'neutral' } };
}

/** Map one A2UI basic-catalog component to a platform IR node (or null to skip). */
export function mapA2UIComponentToIrNode(
  component: A2UIComponent,
  ctx: ComponentMapContext): SpecNode | null {
  if (A2UI_SKIPPED_COMPONENTS.has(component.component)) {
    return null;
  }
  switch (component.component) {
    case 'Text':
      return mapTextComponent(component, ctx);
    case 'TextField':
      return mapTextFieldComponent(component, ctx);
    case 'Button':
      return mapButtonComponent(component, ctx);
    case 'Icon':
      return mapIconComponent(component);
    default:
      if (A2UI_LAYOUT_COMPONENTS.has(component.component)) {
        return mapLayoutComponent(component);
      }
      ctx.warnings.push({
        code: 'A2UI_COMPONENT_INVALID',
        message: `No native mapping for A2UI component "${component.component}"; skipped`,
        componentId: component.id,
      });
      return null;
  }
}

export function buildPanelSpecFromComponents(
  components: Map<string, A2UIComponent>,
  dataModel: JsonObject): {
  specNodes: Record<string, SpecNode>;
  actions: Record<string, SpecAction>;
  state: JsonObject | undefined;
  sources: Record<string, { source: string }> | undefined;
  errors: A2UIIngestIssue[];
  warnings: A2UIIngestIssue[];
} {
  const ctx: ComponentMapContext = {
    dataModel,
    actions: {},
    warnings: [],
    errors: [],
    usesFieldForm: false,
  };
  const specNodes: Record<string, SpecNode> = {};

  for (const component of components.values()) {
    const node = mapA2UIComponentToIrNode(component, ctx);
    if (node !== null) {
      specNodes[component.id] = node;
    }
  }

  for (const component of components.values()) {
    const node = specNodes[component.id];
    if (node === undefined || node.children === undefined) {
      continue;
    }
    const filtered = node.children.filter((childId) => specNodes[childId] !== undefined);
    if (filtered.length !== node.children.length) {
      specNodes[component.id] = {...node, children: filtered };
    }
  }

  const state = Object.keys(dataModel).length > 0 ? dataModelToPanelState(dataModel): undefined;
  const sources = ctx.usesFieldForm
    ? { [A2UI_DATA_SOURCE_KEY]: { source: A2UI_DATA_ADAPTER_SOURCE } }: undefined;

  return {
    specNodes,
    actions: ctx.actions,
    state,
    sources,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };
}
