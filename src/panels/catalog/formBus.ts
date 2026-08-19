/**
 * Coordinates field-form draft submission with action-row mutate dispatch.
 * One bus instance is scoped to each SpecRenderer mount.
 */
export interface FormBusHandle {
  readonly source: string;
  submit(actionRef: string): void;
  fill(patch: Record<string, unknown>): void;
}

export class FormBus {
  private readonly handles = new Map<string, FormBusHandle>();

  register(ownerId: string, handle: FormBusHandle): () => void {
    this.handles.set(ownerId, handle);
    return () => {
      this.handles.delete(ownerId);
    };
  }

  findBySource(source: string): FormBusHandle | undefined {
    for (const handle of this.handles.values()) {
      if (handle.source === source) {
        return handle;
      }
    }
    return undefined;
  }

  fillAll(patch: Record<string, unknown>): void {
    for (const handle of this.handles.values()) {
      handle.fill(patch);
    }
  }
}
