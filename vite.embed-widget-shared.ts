/**
 * Shared factory for widget embed Vite library builds.
 */
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import { embedDualOutput } from './vite.embed-chunking';

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
  /**
   * Code-split the ESM build into lazy vendor chunks (UMD stays single-file).
   * Only the heavy tldraw-bearing surface (operator-surface-placement) opts in;
   * the small widgets stay single-file, where chunking is pure overhead.
   */
  chunked?: boolean;
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
    // G3: shipped embed bundles never inline a provider key, whatever the
    // local .env.local carries for vite dev. The embeds' only sanctioned
    // credential source at runtime is a token-endpoint / chat proxy.
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
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
        name: options.umdName,...(options.chunked
          ? {}
          : {
              formats: ['es', 'umd'] as ('es' | 'umd')[],
              fileName: (format: string) =>
                format === 'es' ? `${options.fileBase}.js` : `${options.fileBase}.umd.js`,
            }),
      },
      rollupOptions: {...(options.rollupExternal
          ? { external: options.rollupExternal }: {}),
        output: options.chunked
          ? embedDualOutput({
              esFile: `${options.fileBase}.js`,
              umdFile: `${options.fileBase}.umd.js`,
              umdName: options.umdName,
              cssName: `${options.fileBase}.css`,
            })
          : {
              inlineDynamicImports: true,
              assetFileNames: (assetInfo) =>
                assetInfo.name && assetInfo.name.endsWith('.css')
                  ? `${options.fileBase}.css`: assetInfo.name || 'asset-[hash]',
            },
      },
    },
  });
}
