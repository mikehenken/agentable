/**
 * The English message catalog. This file is the ONLY place a
 * user-facing framework string may live as source text; everything the
 * renderer, catalog components, chrome, and the validator surface to
 * people resolves through these keys via `t()`.
 *
 * The hardcoded-strings gate (`tests/unit/i18nHardcodedStrings.test.ts`)
 * excludes `src/i18n/catalog/` and fails the suite when a user-facing
 * string literal appears anywhere else under the scanned directories, so
 * a string added outside this catalog breaks CI.
 *
 * Values are ICU MessageFormat (see `../messageFormat.ts` for the
 * supported subset). Locale packs supply the same keys for other locales
 * (ships `es` with the career pack in P4/P5).
 */

export const en = {
  // --- Catalog component data-lifecycle states (02 section 6) ---
  'catalog.state.loading': 'Loading...',
  'catalog.state.error': 'Error loading data',
  'catalog.state.empty': 'No data available',
  'catalog.state.dirty': 'Unsaved changes',
  'catalog.state.saving': 'Saving...',
  'catalog.state.stale': 'Data is stale',
  'document.emptyBlocks': 'Empty document',
  'document.undo': 'Undo',
  'document.redo': 'Redo',
  'catalog.confirm.title': 'Confirm',
  'catalog.staleBanner.label': 'Stale',
  'catalog.repeatableGroup.addRow': 'Add row',
  'catalog.repeatableGroup.removeRow': 'Remove row',
  'catalog.repeatableGroup.rowLabel': 'Row {index}',
  'catalog.action.save': 'Save',

  // --- Renderer chrome (02 section 6) ---
  'renderer.stale.message': 'This data changed remotely while you were editing.',
  'renderer.stale.refresh': 'Refresh',
  'renderer.error.fallback': 'Failed to load data',
  'renderer.error.retry': 'Retry',
  'renderer.unsupportedBlock': 'Unsupported block ({type})',

 // --- Spec validation issues (pipeline; surfaced in HITL chrome) ---
  'validation.budget.size': 'Spec exceeds maximum size of {max} bytes',
  'validation.budget.size.hint': 'Reduce node count or shorten string props',
  'validation.envelope.invalid': 'Spec envelope failed structural parse',
  'validation.envelope.invalid.hint':
    'Ensure v, origin, root, and nodes are present with valid types',
  'validation.envelope.sourcesInvalid': 'Spec sources map contains invalid entries',
  'validation.envelope.actionsInvalid': 'Spec actions map contains invalid entries',
  'validation.version.newer': 'Spec version {version} is newer than supported version {supported}',
  'validation.version.needsMigrations':
    'Spec version {version} requires migrations to reach {supported}',
  'validation.version.needsMigrations.hint':
    'Register PanelMeta.migrations for this panel definition',
  'validation.version.migrationFailed': 'Migration failed',
  'validation.version.migrationFailed.hint':
    'Provide contiguous migrations from the persisted version',
  'validation.node.invalid': 'Node "{nodeId}" is not a valid spec node',
  'validation.node.invalid.hint': 'Each node requires a non-empty type string',
  'validation.root.missing': 'Spec root id is missing or empty',
  'validation.root.unknown': 'Root node "{root}" does not exist in nodes',
  'validation.budget.nodes': 'Spec has {count} nodes; maximum is {max}',
  'validation.budget.nodes.hint': 'Reduce nodes to {max} or fewer',
  'validation.budget.depth': 'Spec tree depth {depth} exceeds maximum {max}',
  'validation.budget.depth.hint': 'Flatten nested children',
  'validation.tree.cycle': 'Cycle detected: {cycle}',
  'validation.tree.cycle.hint': 'Ensure children form a tree reachable from root',
  'validation.tree.duplicateChild': 'Node "{nodeId}" lists child "{childId}" more than once',
  'validation.tree.duplicateChild.hint': 'Remove duplicate child ids',
  'validation.tree.orphan': 'Node "{nodeId}" is not reachable from root',
  'validation.node.unknownType': 'Unknown node type "{type}"; preserving raw JSON as placeholder',
  'validation.node.unknownType.hint':
    'Use a catalog node type or register a custom catalog entry',
  'validation.node.propsInvalid': 'Node "{nodeId}" props failed validation for type "{type}"',
  'validation.node.propsInvalid.hint': 'Fix props to match catalog schema',
  'validation.action.refSmuggled': 'Action ref "{ref}" uses forbidden smuggled syntax',
  'validation.action.refSmuggled.hint':
    'Declare the action in spec.actions and reference its id only',
  'validation.action.refUrl': 'Action ref "{ref}" must not be a URL',
  'validation.action.refMissing': 'Action ref "{ref}" is not declared in spec.actions',
  'validation.action.refMissing.hint': 'Add an entry to spec.actions or fix the ref',
  'validation.action.idSmuggled': 'Action id "{actionId}" uses forbidden smuggled syntax',
  'validation.action.idSmuggled.hint': 'Use plain action ids without URL-like syntax',
  'validation.action.urlPayload': 'Action "{actionId}" must not contain URL payloads',
  'validation.action.sourceUnknown':
    'Mutate action "{actionId}" references unknown source "{source}"',
  'validation.action.sourceUnknown.hint': 'Register the source on the DataAdapter',
  'validation.action.hostUnknown': 'Host action "{action}" is not registered',
  'validation.action.panelUnknown':
    'Panel action "{actionId}" references unknown panel "{panelId}"',
  'validation.budget.string': 'String at {path} length {length} exceeds {max}',
  'validation.sanitize.javascriptUrl': 'Forbidden javascript: URL at {path}',
  'validation.sanitize.urlScheme': 'Disallowed URL scheme at {path}',
  'validation.sanitize.urlScheme.hint': 'Use http or https URLs only',
  'validation.sanitize.controlChar': 'Control characters are not allowed at {path}',

 // --- Panel HITL approval chrome (02 section 7,-) ---
  'approval.review.badge': 'Awaiting approval',
  'approval.review.title': 'Approve {action}',
  'approval.review.agentAttribution': 'Agent: {agent}',
  'approval.review.target': 'Target source: {source}',
  'approval.review.irreversible': 'This action cannot be undone.',
  'approval.destructive.badge': 'Confirm destructive action',
  'approval.destructive.title': 'This change is permanent',
  'approval.destructive.defaultMessage': 'Proceed with {action}? This cannot be undone.',
  'approval.destructive.confirm': 'Confirm',
  'approval.approve': 'Approve',
  'approval.reject': 'Reject',
  'approval.diff.field': 'Field',
  'approval.diff.before': 'Current',
  'approval.diff.after': 'Proposed',
  'approval.diff.empty': 'No field changes in this payload.',
  'approval.diff.none': '(empty)',

 // --- Panel chrome: provenance + pin (02 section 7) ---
  'chrome.provenance.agent': 'Agent',
  'chrome.pin.persist': 'Pin panel to workspace',
  'chrome.panel.minimize': 'Minimize panel',
  'chrome.panel.restore': 'Restore panel',
  'chrome.panel.close': 'Close panel',
  'chrome.panel.loading': 'Loading panel…',
  'chrome.panel.adapterUnavailable': 'Panel data adapter is not available.',
  'chrome.panel.notRegistered': 'No panel registered for id {panelId}.',
  'chrome.composed.invalid': 'This composed panel could not be restored.',
  'chrome.openCanvas.indicator': 'Open canvas',
  'chrome.openCanvas.indicatorHint':
    'Agent output is auto-applied on this canvas. Host-data actions still require approval.',

 // --- Career pack panels + nav ---
  'career.panels.openPositions.title': 'Open Positions',
  'career.panels.openPositions.subtitle': 'Current openings',
  'career.panels.applications.title': 'My Applications',
  'career.panels.applications.column.job': 'Job',
  'career.panels.applications.column.status': 'Status',
  'career.panels.applications.column.submitted': 'Submitted',
  'career.panels.growthPaths.title': 'Growth Paths',
  'career.panels.growthPaths.subtitle': 'Example trajectories',
  'career.panels.resources.title': 'Resources',
  'career.nav.openPositions': 'Open Positions',
  'career.nav.newChat': 'New Chat',
  'career.nav.applications': 'My Applications',
  'career.nav.resumeDocs': 'Resume & Docs',
  'career.nav.resources': 'Resources',
  'career.nav.growthPaths': 'Growth Paths',
  'career.nav.careerTools': 'Career Tools',

 // --- Support inbox pack panels + nav ---
  'support.panels.inbox.title': 'Inbox',
  'support.panels.inbox.subtitle': 'Tickets waiting on your team',
  'support.panels.ticketDetail.title': 'Ticket Detail',
  'support.panels.ticketDetail.column.author': 'Author',
  'support.panels.ticketDetail.column.role': 'Role',
  'support.panels.ticketDetail.column.sent': 'Sent',
  'support.panels.macros.title': 'Macros',
  'support.panels.macros.subtitle': 'Canned responses',
  'support.nav.inbox': 'Inbox',
  'support.nav.ticketDetail': 'Ticket Detail',
  'support.nav.macros': 'Macros',

 // --- Agent world-model debug panels ---
  'agents.panels.activity.title': 'Agent Activity',
  'agents.panels.activity.subtitle': 'Session activity ledger',

 // --- Panel devtools ---
  'devtools.panels.specInspector.title': 'Spec Inspector',
  'devtools.panels.specInspector.subtitle': 'Validation, bindings, and HITL/repair history',
  'devtools.panels.specInspector.tabValidation': 'Validation',
  'devtools.panels.specInspector.tabBindings': 'Bindings',
  'devtools.panels.specInspector.tabEvents': 'History',
} as const;

/** Every framework message key; locale packs implement this contract. */
export type MessageKey = keyof typeof en;

/** A (possibly partial) catalog for one locale. Missing keys fall back. */
export type MessageCatalog = Partial<Record<MessageKey, string>>;
