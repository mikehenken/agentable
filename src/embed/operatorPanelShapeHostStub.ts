/**
 * Host-only panelShapeApi stub for operator embed bundles (P13-T7 iter-12).
 * Avoids shipping a second tldraw graph — draw/read paths use whiteboard host APIs.
 */

export function getEditor(): null {
  return null;
}

export function inspectBoundEditorStore(_createdShapeIds: readonly string[]): {
  bound: boolean;
  pageShapeCount: number;
  createdFound: number;
} {
  return { bound: false, pageShapeCount: 0, createdFound: 0 };
}

export function unbindEditor(): void {
  // no-op in operator embed
}

export function bindEditor(_editor: unknown): void {
  // no-op in operator embed
}
