import { create } from 'zustand';
import { emitAgUiStatePatch } from '../protocol/ag-ui';

export interface CanvasSiteFile {
  path: string;
  content: string;
  mimeType: string;
  updatedAt: number;
  source: 'virtual' | 'upload' | 'generated';
  url?: string;
}

interface CanvasFileStoreState {
  siteId: string | null;
  files: Record<string, CanvasSiteFile>;
  setSiteId: (siteId: string | null) => void;
  listFiles: () => CanvasSiteFile[];
  readFile: (path: string) => CanvasSiteFile | null;
  writeFile: (path: string, content: string, mimeType?: string, source?: CanvasSiteFile['source']) => CanvasSiteFile;
  deleteFile: (path: string) => boolean;
  storeImage: (path: string, url: string, mimeType?: string) => CanvasSiteFile;
}

function normalizePath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, '');
  if (!trimmed) {
    throw new Error('path must be non-empty');
  }
  if (trimmed.includes('..')) {
    throw new Error('path must not contain.. segments');
  }
  return trimmed;
}

export const useCanvasFileStore = create<CanvasFileStoreState>((set, get) => ({
  siteId: null,
  files: {},

  setSiteId: (siteId) => {
    set({ siteId });
    emitAgUiStatePatch('files.siteId', siteId);
  },

  listFiles: () => Object.values(get().files).sort((a, b) => a.path.localeCompare(b.path)),

  readFile: (path) => {
    const key = normalizePath(path);
    return get().files[key] ?? null;
  },

  writeFile: (path, content, mimeType = 'text/plain', source = 'virtual') => {
    const key = normalizePath(path);
    const entry: CanvasSiteFile = {
      path: key,
      content,
      mimeType,
      updatedAt: Date.now(),
      source,
    };
    set((state) => ({ files: {...state.files, [key]: entry } }));
    emitAgUiStatePatch(`files.${key}`, entry);
    return entry;
  },

  deleteFile: (path) => {
    const key = normalizePath(path);
    const existing = get().files[key];
    if (!existing) return false;
    set((state) => {
      const next = {...state.files };
      delete next[key];
      return { files: next };
    });
    emitAgUiStatePatch(`files.${key}`, null);
    return true;
  },

  storeImage: (path, url, mimeType = 'image/png') => {
    const key = normalizePath(path);
    const entry: CanvasSiteFile = {
      path: key,
      content: url,
      mimeType,
      updatedAt: Date.now(),
      source: 'generated',
      url,
    };
    set((state) => ({ files: {...state.files, [key]: entry } }));
    emitAgUiStatePatch(`files.${key}`, entry);
    return entry;
  },
}));
