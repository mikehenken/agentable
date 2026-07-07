import { create } from 'zustand';

export type CanvasVirtualFileKind = 'page' | 'asset' | 'artifact';

export interface CanvasVirtualFile {
  path: string;
  kind: CanvasVirtualFileKind;
  name: string;
  updatedAt?: string;
  sizeBytes?: number;
  url?: string;
  metadata?: Record<string, unknown>;
}

interface CanvasFileState {
  files: CanvasVirtualFile[];
  selectedPath: string | null;
  lastSyncedAt: string | null;
  setFiles: (files: CanvasVirtualFile[]) => void;
  upsertFile: (file: CanvasVirtualFile) => void;
  removeFile: (path: string) => void;
  setSelectedPath: (path: string | null) => void;
  markSynced: () => void;
}

export const useCanvasFileStore = create<CanvasFileState>((set) => ({
  files: [],
  selectedPath: null,
  lastSyncedAt: null,
  setFiles: (files) => set({ files, lastSyncedAt: new Date().toISOString() }),
  upsertFile: (file) =>
    set((state) => {
      const index = state.files.findIndex((entry) => entry.path === file.path);
      const files =
        index >= 0
          ? state.files.map((entry, i) => (i === index ? file : entry))
          : [...state.files, file];
      return { files, lastSyncedAt: new Date().toISOString() };
    }),
  removeFile: (path) =>
    set((state) => ({
      files: state.files.filter((entry) => entry.path !== path),
      lastSyncedAt: new Date().toISOString(),
    })),
  setSelectedPath: (selectedPath) => set({ selectedPath }),
  markSynced: () => set({ lastSyncedAt: new Date().toISOString() }),
}));
