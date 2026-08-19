/**
 * Typed builder (02 section 3). `defineSchemaPanel(config)` and
 * `defineStaticPanel(config)` compile host-authored panel configs into
 * `{ kind: 'spec', id, meta, spec }` deterministically: stable node ids
 * (`body`, `header`, `form`, `actions`, `list`, ...), stable ordering,
 * pure JSON output, so specs diff cleanly in git. The builder is sugar
 * only; it expresses nothing the IR cannot (one-way compile, no eval),
 * and builder output flows through the exact same `validateSpec`
 * pipeline as agent-emitted IR (D1).
 *
 * Define-time guarantees (thrown as `PanelBuilderError` when a host
 * boots with a bad config, plus compile-time typing where TypeScript
 * can carry it):
 * - action refs used by blocks exist in the declared actions map;
 * - source binds used by blocks exist in the declared sources map;
 * - `showIf` operands reference valid `$scope` / `$state` / `$data` keys;
 * - static panels cannot declare mutate actions or data-bound blocks;
 * - field paths are typed against the host's source payload types via
 *   `SourcePayloads` interface augmentation (05 section 1).
 */
import type {
  JsonObject,
  JsonValue,
  PanelDefinition,
  PanelMeta,
  PanelSpec,
  SpecAction,
  SpecCondition,
  SpecNode,
  SpecSourceBinding,
} from './types';
import { CURRENT_SPEC_VERSION } from './spec/constants';

/**
 * Host-side typed source map (05 section 1). Hosts augment this
 * interface to get field paths typed against their payload types:
 *
 *   declare module 'agentable-canvas/panels/builder' {
 *     interface SourcePayloads { 'site.seo': SeoSettings }
 *   }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SourcePayloads {}

type PayloadOf<TSource extends string> = TSource extends keyof SourcePayloads
  ? SourcePayloads[TSource & keyof SourcePayloads]: unknown;

/**
 * Field paths for a source: the payload's own keys when the host has
 * augmented `SourcePayloads` with an object payload, otherwise any
 * string (the untyped fallback).
 */
export type FieldPathsOf<TSource extends string> =
  PayloadOf<TSource> extends readonly unknown[]
    ? string
    : PayloadOf<TSource> extends Record<string, unknown>
      ? Extract<keyof PayloadOf<TSource>, string>
      : string;

/** FieldDef kinds allowed in v1 (02 section 4; no markdown/image per D10). */
export type FieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'toggle'
  | 'number'
  | 'url'
  | 'keyvalue'
  | 'repeatable-group'
  | 'custom';

/**
 * One field in a `form` block. Extra keys (maxLength and friends) ride
 * through as JSON; the catalog's field schema keeps them via catchall.
 */
export interface FieldConfig<TPath extends string = string> {
  readonly [key: string]: JsonValue | undefined;
  readonly bind?: TPath;
  readonly type?: FieldKind;
  readonly label?: string;
  readonly placeholder?: string;
}

/** The only conditional the spec language supports (D8). */
export interface ShowIfConfig {
  readonly $eq: readonly [JsonValue, JsonValue];
}

interface BlockBase {
  /** Override the deterministic node id. Must be unique across the panel. */
  readonly id?: string;
  readonly showIf?: ShowIfConfig;
}

export interface HeaderBlock extends BlockBase {
  readonly block: 'header';
  readonly title: string;
  readonly icon?: string;
  readonly subtitle?: string;
}

/** Distributes over source names so `fields` are typed per bound payload. */
export type FormBlock<TSources extends SourcesConfig> = {
  [K in Extract<keyof TSources, string>]: BlockBase & {
    readonly block: 'form';
    readonly bind: K;
    readonly fields: readonly FieldConfig<FieldPathsOf<TSources[K]['source']>>[];
  };
}[Extract<keyof TSources, string>];

export interface ActionRowBlock<TActionRef extends string> extends BlockBase {
  readonly block: 'actions';
  readonly actions: readonly TActionRef[];
}

export interface ListRowConfig<TActionRef extends string> {
  readonly title?: string;
  readonly subtitle?: string;
  readonly badges?: readonly JsonValue[];
  readonly meta?: readonly JsonValue[];
  readonly rowActions?: readonly TActionRef[];
}

export interface ListBlock<TSourceName extends string, TActionRef extends string>
  extends BlockBase {
  readonly block: 'list';
  readonly bind: TSourceName;
  readonly row: ListRowConfig<TActionRef>;
  readonly search?: boolean;
  readonly filters?: readonly FieldConfig[];
}

export interface TableBlock<TSourceName extends string, TActionRef extends string>
  extends BlockBase {
  readonly block: 'table';
  readonly bind: TSourceName;
  readonly columns: readonly JsonObject[];
  readonly rowActions?: readonly TActionRef[];
}

export interface BadgeBlock<TSourceName extends string> extends BlockBase {
  readonly block: 'badge';
  readonly text?: string;
  readonly bind?: TSourceName;
  readonly tone?: string;
}

export interface EmptyStateBlock<TActionRef extends string> extends BlockBase {
  readonly block: 'empty-state';
  readonly message: string;
  readonly action?: TActionRef;
}

export interface FilterChipsBlock<TSourceName extends string> extends BlockBase {
  readonly block: 'filter-chips';
  readonly bind: TSourceName;
}

export interface CustomSlotBlock extends BlockBase {
  readonly block: 'custom-slot';
  readonly name: string;
  readonly props?: JsonObject;
}

export interface TabConfig<TBlock> {
  readonly id: string;
  readonly label: string;
  readonly blocks: readonly TBlock[];
}

export interface TabsBlock<TBlock> extends BlockBase {
  readonly block: 'tabs';
  readonly tabs: readonly TabConfig<TBlock>[];
}

type SourcesConfig = Record<string, SpecSourceBinding>;
type ActionsConfig = Record<string, SpecAction>;

/** Static panels may still declare handback CTAs, just nothing that mutates. */
export type StaticAction = Exclude<SpecAction, { kind: 'mutate' }>;

export type SchemaBlock<
  TSources extends SourcesConfig,
  TActionRef extends string,
> =
  | HeaderBlock
  | FormBlock<TSources>
  | ActionRowBlock<TActionRef>
  | ListBlock<Extract<keyof TSources, string>, TActionRef>
  | TableBlock<Extract<keyof TSources, string>, TActionRef>
  | BadgeBlock<Extract<keyof TSources, string>>
  | EmptyStateBlock<TActionRef>
  | FilterChipsBlock<Extract<keyof TSources, string>>
  | CustomSlotBlock
  | TabsBlock<SchemaBlock<TSources, TActionRef>>;

export type StaticBlock<TActionRef extends string = string> =
  | HeaderBlock
  | BadgeBlock<never>
  | EmptyStateBlock<TActionRef>
  | ActionRowBlock<TActionRef>
  | CustomSlotBlock
  | TabsBlock<StaticBlock<TActionRef>>;

export interface SchemaPanelConfig<
  TSources extends SourcesConfig,
  TState extends JsonObject,
  TActions extends ActionsConfig,
> {
  readonly id: string;
  readonly meta: PanelMeta;
  readonly sources: TSources;
  readonly state?: TState;
  readonly actions?: TActions;
  readonly blocks: readonly SchemaBlock<TSources, Extract<keyof TActions, string>>[];
}

export interface StaticPanelConfig<
  TState extends JsonObject,
  TActions extends Record<string, StaticAction>,
> {
  readonly id: string;
  readonly meta: PanelMeta;
  readonly state?: TState;
  readonly actions?: TActions;
  readonly blocks: readonly StaticBlock<Extract<keyof TActions, string>>[];
}

export type SpecPanelDefinition = Extract<PanelDefinition, { kind: 'spec' }>;

export type PanelBuilderErrorCode =
  | 'BUILDER_ID_INVALID'
  | 'BUILDER_ID_DUPLICATE'
  | 'BUILDER_BIND_UNKNOWN'
  | 'BUILDER_ACTION_UNKNOWN'
  | 'BUILDER_SHOWIF_SCOPE_KEY'
  | 'BUILDER_SHOWIF_STATE_KEY'
  | 'BUILDER_SHOWIF_SOURCE_UNKNOWN'
  | 'BUILDER_TAB_ID_DUPLICATE'
  | 'BUILDER_STATIC_MUTATE_FORBIDDEN'
  | 'BUILDER_BLOCK_UNKNOWN';

export class PanelBuilderError extends Error {
  readonly code: PanelBuilderErrorCode;

  constructor(code: PanelBuilderErrorCode, message: string) {
    super(message);
    this.name = 'PanelBuilderError';
    this.code = code;
  }
}

const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const SCOPE_PREFIX = '$scope.';
const STATE_PREFIX = '$state.';
const DATA_PREFIX = '$data.';
const SCOPE_KEYS = new Set(['contextId', 'entityId']);

/** Runtime view of the block union once generics are erased. */
interface RuntimeBlock {
  block: string;
  id?: string;
  showIf?: ShowIfConfig;
  title?: string;
  icon?: string;
  subtitle?: string;
  bind?: string;
  fields?: readonly FieldConfig[];
  actions?: readonly string[];
  row?: ListRowConfig<string>;
  search?: boolean;
  filters?: readonly FieldConfig[];
  columns?: readonly JsonObject[];
  rowActions?: readonly string[];
  text?: string;
  tone?: string;
  message?: string;
  action?: string;
  name?: string;
  props?: JsonObject;
  tabs?: readonly TabConfig<unknown>[];
}

/** Canonical stable node ids per block kind (02 section 3). */
const CANONICAL_IDS: Record<string, string> = {
  header: 'header',
  form: 'form',
  actions: 'actions',
  list: 'list',
  table: 'table',
  badge: 'badge',
  'empty-state': 'empty',
  'filter-chips': 'chips',
  'custom-slot': 'slot',
  tabs: 'tabs',
};

/** Block kind to catalog node type. */
const NODE_TYPES: Record<string, string> = {
  header: 'header',
  form: 'field-form',
  actions: 'action-row',
  list: 'list',
  table: 'table',
  badge: 'badge',
  'empty-state': 'empty-state',
  'filter-chips': 'filter-chips',
  'custom-slot': 'custom-slot',
  tabs: 'tabs',
};

/**
 * Deep-copy a JSON value, dropping object entries whose value is
 * `undefined` so the compiled spec is pure, self-contained JSON.
 */
function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJson(entry));
  }
  if (typeof value === 'object' && value !== null) {
    const next: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        next[key] = cloneJson(entry);
      }
    }
    return next;
  }
  return value;
}

function cloneJsonObject(value: object): JsonObject {
  return cloneJson(value as JsonObject) as JsonObject;
}

interface CompileContext {
  sourceNames: ReadonlySet<string>;
  stateKeys: ReadonlySet<string>;
  actionIds: ReadonlySet<string>;
  usedIds: Set<string>;
  counters: Map<string, number>;
  /** Emitted in insertion order; assembled into the nodes map at the end. */
  emitted: Array<[string, SpecNode]>;
}

function fail(code: PanelBuilderErrorCode, message: string): never {
  throw new PanelBuilderError(code, message);
}

function resolveBlockId(ctx: CompileContext, block: RuntimeBlock, prefix: string): string {
  if (block.id !== undefined) {
    if (!ID_PATTERN.test(block.id)) {
      fail('BUILDER_ID_INVALID', `Block id "${block.id}" must match ${ID_PATTERN.source}`);
    }
    if (ctx.usedIds.has(block.id)) {
      fail('BUILDER_ID_DUPLICATE', `Block id "${block.id}" is used more than once`);
    }
    ctx.usedIds.add(block.id);
    return block.id;
  }
  const canonical = CANONICAL_IDS[block.block];
  if (canonical === undefined) {
    fail('BUILDER_BLOCK_UNKNOWN', `Unknown block kind "${block.block}"`);
  }
  const base = prefix.length > 0 ? `${prefix}-${canonical}` : canonical;
  let count = ctx.counters.get(base) ?? 0;
  let candidate = count === 0 ? base : `${base}-${count + 1}`;
  while (ctx.usedIds.has(candidate)) {
    count += 1;
    candidate = `${base}-${count + 1}`;
  }
  ctx.counters.set(base, count + 1);
  ctx.usedIds.add(candidate);
  return candidate;
}

function checkBind(ctx: CompileContext, blockId: string, bind: string): void {
  if (!ctx.sourceNames.has(bind)) {
    fail(
      'BUILDER_BIND_UNKNOWN',
      `Block "${blockId}" binds unknown source "${bind}"; declare it in sources`);
  }
}

function checkActionRef(ctx: CompileContext, blockId: string, ref: string): void {
  if (!ctx.actionIds.has(ref)) {
    fail(
      'BUILDER_ACTION_UNKNOWN',
      `Block "${blockId}" references undeclared action "${ref}"; declare it in actions`);
  }
}

function checkShowIfOperand(ctx: CompileContext, blockId: string, operand: JsonValue): void {
  if (typeof operand !== 'string') return;
  if (operand.startsWith(SCOPE_PREFIX)) {
    const key = operand.slice(SCOPE_PREFIX.length);
    if (!SCOPE_KEYS.has(key)) {
      fail(
        'BUILDER_SHOWIF_SCOPE_KEY',
        `Block "${blockId}" showIf references invalid scope key "${key}"; use contextId or entityId`);
    }
    return;
  }
  if (operand.startsWith(STATE_PREFIX)) {
    const key = operand.slice(STATE_PREFIX.length);
    if (!ctx.stateKeys.has(key)) {
      fail(
        'BUILDER_SHOWIF_STATE_KEY',
        `Block "${blockId}" showIf references undeclared state key "${key}"`);
    }
    return;
  }
  if (operand.startsWith(DATA_PREFIX)) {
    const sourceName = operand.slice(DATA_PREFIX.length).split('.')[0] ?? '';
    if (!ctx.sourceNames.has(sourceName)) {
      fail(
        'BUILDER_SHOWIF_SOURCE_UNKNOWN',
        `Block "${blockId}" showIf references undeclared source "${sourceName}"`);
    }
  }
}

function compileShowIf(
  ctx: CompileContext,
  blockId: string,
  showIf: ShowIfConfig | undefined): SpecCondition | undefined {
  if (showIf === undefined) return undefined;
  const [left, right] = showIf.$eq;
  checkShowIfOperand(ctx, blockId, left);
  checkShowIfOperand(ctx, blockId, right);
  return { $eq: [cloneJson(left), cloneJson(right)] };
}

function compileBlockProps(ctx: CompileContext, blockId: string, block: RuntimeBlock): JsonObject {
  switch (block.block) {
    case 'header': {
      return {
        title: block.title as string,...(block.icon !== undefined ? { icon: block.icon }: {}),...(block.subtitle !== undefined ? { subtitle: block.subtitle }: {}),
      };
    }
    case 'form': {
      const bind = block.bind as string;
      checkBind(ctx, blockId, bind);
      const fields = (block.fields ?? []).map((field) => cloneJsonObject(field));
      return { bind, fields };
    }
    case 'actions': {
      const refs = block.actions ?? [];
      for (const ref of refs) checkActionRef(ctx, blockId, ref);
      return { actions: [...refs] };
    }
    case 'list': {
      const bind = block.bind as string;
      checkBind(ctx, blockId, bind);
      const row = block.row ?? {};
      for (const ref of row.rowActions ?? []) checkActionRef(ctx, blockId, ref);
      return {
        bind,
        row: cloneJsonObject(row),...(block.search !== undefined ? { search: block.search }: {}),...(block.filters !== undefined
          ? { filters: block.filters.map((filter) => cloneJsonObject(filter)) }: {}),
      };
    }
    case 'table': {
      const bind = block.bind as string;
      checkBind(ctx, blockId, bind);
      for (const ref of block.rowActions ?? []) checkActionRef(ctx, blockId, ref);
      return {
        bind,
        columns: (block.columns ?? []).map((column) => cloneJsonObject(column)),...(block.rowActions !== undefined ? { rowActions: [...block.rowActions] }: {}),
      };
    }
    case 'badge': {
      if (block.bind !== undefined) checkBind(ctx, blockId, block.bind);
      return {...(block.text !== undefined ? { text: block.text }: {}),...(block.bind !== undefined ? { bind: block.bind }: {}),...(block.tone !== undefined ? { tone: block.tone }: {}),
      };
    }
    case 'empty-state': {
      if (block.action !== undefined) checkActionRef(ctx, blockId, block.action);
      return {
        message: block.message as string,...(block.action !== undefined ? { action: block.action }: {}),
      };
    }
    case 'filter-chips': {
      const bind = block.bind as string;
      checkBind(ctx, blockId, bind);
      return { bind };
    }
    case 'custom-slot': {
      return {
        name: block.name as string,...(block.props !== undefined ? { props: cloneJsonObject(block.props) }: {}),
      };
    }
    default:
      fail('BUILDER_BLOCK_UNKNOWN', `Unknown block kind "${block.block}"`);
  }
}

interface AssignedBlock {
  id: string;
  block: RuntimeBlock;
}

/**
 * Assign ids for a whole sibling group before any node is emitted, so
 * auto-suffix numbering follows declaration order regardless of nesting.
 */
function assignBlockIds(
  ctx: CompileContext,
  blocks: readonly RuntimeBlock[],
  prefix: string): AssignedBlock[] {
  return blocks.map((block) => ({ id: resolveBlockId(ctx, block, prefix), block }));
}

function compileTabsBlock(ctx: CompileContext, blockId: string, block: RuntimeBlock): void {
  const tabs = block.tabs ?? [];
  const seenTabIds = new Set<string>();
  const tabEntries: Array<{ id: string; label: string; child: string }> = [];
  for (const tab of tabs) {
    if (!ID_PATTERN.test(tab.id)) {
      fail('BUILDER_ID_INVALID', `Tab id "${tab.id}" must match ${ID_PATTERN.source}`);
    }
    if (seenTabIds.has(tab.id)) {
      fail('BUILDER_TAB_ID_DUPLICATE', `Tabs block "${blockId}" repeats tab id "${tab.id}"`);
    }
    seenTabIds.add(tab.id);
    const containerId = `${blockId}-${tab.id}`;
    if (ctx.usedIds.has(containerId)) {
      fail('BUILDER_ID_DUPLICATE', `Tab container id "${containerId}" is used more than once`);
    }
    ctx.usedIds.add(containerId);
    tabEntries.push({ id: tab.id, label: tab.label, child: containerId });
  }

  const showIf = compileShowIf(ctx, blockId, block.showIf);
  const node: SpecNode = {
    type: 'tabs',
    props: { tabs: tabEntries.map((entry) => ({ ...entry })) },
    children: tabEntries.map((entry) => entry.child),...(showIf !== undefined ? { showIf }: {}),
  };
  ctx.emitted.push([blockId, node]);

  tabs.forEach((tab, index) => {
    const entry = tabEntries[index];
    if (entry === undefined) return;
    const assigned = assignBlockIds(
      ctx,
      (tab.blocks ?? []) as readonly RuntimeBlock[],
      entry.child);
    ctx.emitted.push([
      entry.child,
      { type: 'panel-body', children: assigned.map((item) => item.id) },
    ]);
    emitBlocks(ctx, assigned);
  });
}

/** Emit nodes parent-before-children so the map reads top-down in git. */
function emitBlocks(ctx: CompileContext, assigned: readonly AssignedBlock[]): void {
  for (const { id, block } of assigned) {
    if (block.block === 'tabs') {
      compileTabsBlock(ctx, id, block);
      continue;
    }
    const showIf = compileShowIf(ctx, id, block.showIf);
    const node: SpecNode = {
      type: NODE_TYPES[block.block] ?? block.block,
      props: compileBlockProps(ctx, id, block),...(showIf !== undefined ? { showIf }: {}),
    };
    ctx.emitted.push([id, node]);
  }
}

function validatePanelId(id: string): void {
  if (!ID_PATTERN.test(id)) {
    fail('BUILDER_ID_INVALID', `Panel id "${id}" must match ${ID_PATTERN.source}`);
  }
}

function compileSpec(
  blocks: readonly RuntimeBlock[],
  sources: SourcesConfig | undefined,
  state: JsonObject | undefined,
  actions: ActionsConfig | undefined): PanelSpec {
  const ctx: CompileContext = {
    sourceNames: new Set(Object.keys(sources ?? {})),
    stateKeys: new Set(Object.keys(state ?? {})),
    actionIds: new Set(Object.keys(actions ?? {})),
    usedIds: new Set(['body']),
    counters: new Map(),
    emitted: [],
  };

  const assigned = assignBlockIds(ctx, blocks, '');
  emitBlocks(ctx, assigned);

  const nodes: Record<string, SpecNode> = {
    body: { type: 'panel-body', children: assigned.map((item) => item.id) },
  };
  for (const [nodeId, node] of ctx.emitted) {
    nodes[nodeId] = node;
  }

  return {
    v: CURRENT_SPEC_VERSION,
    origin: 'host',
    root: 'body',...(sources !== undefined
      ? { sources: cloneJsonObject(sources) as unknown as Record<string, SpecSourceBinding> }: {}),...(state !== undefined ? { state: cloneJsonObject(state) }: {}),
    nodes,...(actions !== undefined
      ? { actions: cloneJsonObject(actions) as unknown as Record<string, SpecAction> }: {}),
  };
}

/**
 * Compile a data-bound (Tier 2 "Schema") panel definition. Sources,
 * state, and actions are declared up front; blocks reference them by
 * name and every reference is checked at define time.
 */
export function defineSchemaPanel<
  const TSources extends SourcesConfig,
  const TState extends JsonObject,
  const TActions extends ActionsConfig,
>(config: SchemaPanelConfig<TSources, TState, TActions>): SpecPanelDefinition {
  validatePanelId(config.id);
  const spec = compileSpec(
    config.blocks as readonly RuntimeBlock[],
    config.sources,
    config.state,
    config.actions);
  return { kind: 'spec', id: config.id, meta: config.meta, spec };
}

/**
 * Compile a data-free (Tier 1 "Static") panel definition. No sources
 * exist, so no block may bind data and no action may mutate; handback
 * CTAs (host / panel / prompt actions) remain available.
 */
export function defineStaticPanel<
  const TState extends JsonObject,
  const TActions extends Record<string, StaticAction>,
>(config: StaticPanelConfig<TState, TActions>): SpecPanelDefinition {
  validatePanelId(config.id);
  for (const [actionId, action] of Object.entries(config.actions ?? {})) {
    if ((action as SpecAction).kind === 'mutate') {
      fail(
        'BUILDER_STATIC_MUTATE_FORBIDDEN',
        `Static panel "${config.id}" declares mutate action "${actionId}"; use defineSchemaPanel`);
    }
  }
  const spec = compileSpec(
    config.blocks as readonly RuntimeBlock[],
    undefined,
    config.state,
    config.actions as ActionsConfig | undefined);
  return { kind: 'spec', id: config.id, meta: config.meta, spec };
}
