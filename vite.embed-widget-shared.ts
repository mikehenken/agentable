/**
 * Shared factory for widget embed Vite library builds.
 */
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

export interface EmbedWidgetBuildOptions {
  /** File base under dist/embed — e.g. `agentable-starter-chip` */
  fileBase: string;
  /** UMD global — e.g. `AgentableStarterChip` */
  umdName: string;
  /** Source entry relative to repo root */
  entry: string;
  /** Enable React + extracted Tailwind CSS (operator/panel surfaces). */
  reactSurface?: boolean;
  /** Optional resolve.alias entries merged into the embed build. */
  resolveAlias?: Record<string, string>;
  /** Additional Vite plugins (operator embed proxy, etc.). */
  extraPlugins?: Plugin[];
  /** Rollup externals — operator embed uses this to omit tldraw. */
  rollupExternal?: (id: string) => boolean;
}

export function defineEmbedWidgetConfig(options: EmbedWidgetBuildOptions): UserConfig {
  const plugins = [...(options.extraPlugins ?? []),...(options.reactSurface === true ? [react]: []),
  ];

  return defineConfig({
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './src'),...(options.resolveAlias ?? {}),
      },
      dedupe: [
        'tldraw',
        '@tldraw/editor',
        '@tldraw/state',
        '@tldraw/state-react',
        '@tldraw/store',
        '@tldraw/tlschema',
        '@tldraw/utils',
        '@tldraw/validate',
      ],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: 'dist/embed',
      emptyOutDir: false,
      cssCodeSplit: false,
      sourcemap: true,
      target: 'es2022',
      lib: {
        entry: path.resolve(process.cwd(), options.entry),
        name: options.umdName,
        formats: ['es', 'umd'],
        fileName: (format) =>
          format === 'es' ? `${options.fileBase}.js`: `${options.fileBase}.umd.js`,
      },
      rollupOptions: {...(options.rollupExternal
          ? { external: options.rollupExternal }: {}),
        output: {
          inlineDynamicImports: true,
          assetFileNames: (assetInfo) =>
            assetInfo.name && assetInfo.name.endsWith('.css')
              ? `${options.fileBase}.css`: assetInfo.name || 'asset-[hash]',
        },
      },
    },
  });
}
