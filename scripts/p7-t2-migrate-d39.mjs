#!/usr/bin/env node
/**
 *: move map — relocate shared infrastructure out of src/canvas/
 * and delete the legacy substrate directory.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

const MOVES = [
  ['canvas/panelLayoutEngine.ts', 'layout/panelLayoutEngine.ts'],
  ['canvas/gridLayout.ts', 'layout/gridLayout.ts'],
  ['canvas/chat/geminiChatClient.ts', 'chat/geminiChatClient.ts'],
  ['canvas/ChatPanel.tsx', 'chat/ChatPanel.tsx'],
  ['canvas/voice/geminiLiveClient.ts', 'voice/geminiLiveClient.ts'],
  ['canvas/voice/mockGeminiLiveClient.ts', 'voice/mockGeminiLiveClient.ts'],
  ['canvas/voice/useGeminiLive.ts', 'voice/useGeminiLive.ts'],
  ['canvas/voice/pcmWorklet.ts', 'voice/pcmWorklet.ts'],
  ['canvas/CanvasContext.tsx', 'config/CanvasContext.tsx'],
  ['canvas/panelDataNormalize.ts', 'config/panelDataNormalize.ts'],
  ['canvas/protocol/ag-ui.ts', 'protocol/ag-ui.ts'],
  ['canvas/protocol/ag-ui.test.ts', 'protocol/ag-ui.test.ts'],
  ['canvas/protocol/copilotkit-bridge.tsx', 'protocol/copilotkit-bridge.tsx'],
  ['canvas/primitives/ListPanel.tsx', 'components/primitives/ListPanel.tsx'],
  ['canvas/primitives/lexicon.ts', 'components/primitives/lexicon.ts'],
  ['canvas/primitives/index.ts', 'components/primitives/index.ts'],
  ['canvas/ChunkErrorBoundary.tsx', 'components/ChunkErrorBoundary.tsx'],
  ['canvas/toneTokens.ts', 'components/toneTokens.ts'],
  ['canvas/tools/canvasTools.ts', 'agents/tools/canvasTools.ts'],
  ['canvas/NavSidebar.tsx', 'components/chrome/NavSidebar.tsx'],
  ['canvas/CanvasChromeContext.tsx', 'components/chrome/CanvasChromeContext.tsx'],
  ['canvas/navItems.ts', 'components/chrome/navItems.ts'],
  ['react-canvas/useVoiceCall.ts', 'hooks/useVoiceCall.ts'],
];

function copyMove(fromRel, toRel) {
  const from = join(src, fromRel);
  const to = join(src, toRel);
  if (!existsSync(from)) {
    console.warn(`skip missing: ${fromRel}`);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}

for (const [from, to] of MOVES) {
  copyMove(from, to);
}

/** Walk all ts/tsx under src and rewrite import paths. */
const REPLACEMENTS = [
  [/from ['"]\.\.\/canvas\/panelLayoutEngine['"]/g, "from '../layout/panelLayoutEngine'"],
  [/from ['"]\.\.\/\.\.\/canvas\/panelLayoutEngine['"]/g, "from '../../layout/panelLayoutEngine'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/panelLayoutEngine['"]/g, "from '../../../layout/panelLayoutEngine'"],
  [/from ['"]\.\.\/canvas\/gridLayout['"]/g, "from '../layout/gridLayout'"],
  [/from ['"]\.\.\/\.\.\/canvas\/gridLayout['"]/g, "from '../../layout/gridLayout'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/gridLayout['"]/g, "from '../../../layout/gridLayout'"],
  [/from ['"]\.\.\/canvas\/CanvasContext['"]/g, "from '../config/CanvasContext'"],
  [/from ['"]\.\.\/\.\.\/canvas\/CanvasContext['"]/g, "from '../../config/CanvasContext'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/CanvasContext['"]/g, "from '../../../config/CanvasContext'"],
  [/from ['"]\.\.\/canvas\/panelDataNormalize['"]/g, "from '../config/panelDataNormalize'"],
  [/from ['"]\.\.\/\.\.\/canvas\/panelDataNormalize['"]/g, "from '../../config/panelDataNormalize'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/panelDataNormalize['"]/g, "from '../../../config/panelDataNormalize'"],
  [/from ['"]\.\.\/canvas\/protocol\/ag-ui['"]/g, "from '../protocol/ag-ui'"],
  [/from ['"]\.\.\/\.\.\/canvas\/protocol\/ag-ui['"]/g, "from '../../protocol/ag-ui'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/protocol\/ag-ui['"]/g, "from '../../../protocol/ag-ui'"],
  [/from ['"]\.\.\/canvas\/chat\/geminiChatClient['"]/g, "from '../chat/geminiChatClient'"],
  [/from ['"]\.\.\/\.\.\/canvas\/chat\/geminiChatClient['"]/g, "from '../../chat/geminiChatClient'"],
  [/from ['"]\.\.\/canvas\/ChatPanel['"]/g, "from '../chat/ChatPanel'"],
  [/from ['"]\.\.\/\.\.\/canvas\/ChatPanel['"]/g, "from '../../chat/ChatPanel'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/ChatPanel['"]/g, "from '../../../chat/ChatPanel'"],
  [/from ['"]\.\.\/canvas\/voice\/useGeminiLive['"]/g, "from '../voice/useGeminiLive'"],
  [/from ['"]\.\.\/\.\.\/canvas\/voice\/useGeminiLive['"]/g, "from '../../voice/useGeminiLive'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/voice\/useGeminiLive['"]/g, "from '../../../voice/useGeminiLive'"],
  [/from ['"]\.\.\/canvas\/tools\/canvasTools['"]/g, "from '../agents/tools/canvasTools'"],
  [/from ['"]\.\.\/\.\.\/canvas\/tools\/canvasTools['"]/g, "from '../../agents/tools/canvasTools'"],
  [/from ['"]\.\.\/canvas\/toneTokens['"]/g, "from '../components/toneTokens'"],
  [/from ['"]\.\.\/\.\.\/canvas\/toneTokens['"]/g, "from '../../components/toneTokens'"],
  [/from ['"]\.\.\/canvas\/CanvasChromeContext['"]/g, "from '../components/chrome/CanvasChromeContext'"],
  [/from ['"]\.\.\/\.\.\/canvas\/CanvasChromeContext['"]/g, "from '../../components/chrome/CanvasChromeContext'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/CanvasChromeContext['"]/g, "from '../../../components/chrome/CanvasChromeContext'"],
  [/from ['"]\.\/CanvasChromeContext['"]/g, "from './CanvasChromeContext'"],
  [/from ['"]\.\/navItems['"]/g, "from './navItems'"],
  [/from ['"]\.\.\/canvas\/navItems['"]/g, "from '../components/chrome/navItems'"],
  [/from ['"]\.\.\/\.\.\/canvas\/navItems['"]/g, "from '../../components/chrome/navItems'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/navItems['"]/g, "from '../../../components/chrome/navItems'"],
  [/from ['"]\.\.\/canvas\/NavSidebar['"]/g, "from '../components/chrome/NavSidebar'"],
  [/from ['"]\.\.\/\.\.\/canvas\/NavSidebar['"]/g, "from '../../components/chrome/NavSidebar'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/canvas\/NavSidebar['"]/g, "from '../../../components/chrome/NavSidebar'"],
  [/from ['"]\.\.\/react-canvas\/useVoiceCall['"]/g, "from '../hooks/useVoiceCall'"],
  [/from ['"]\.\.\/\.\.\/react-canvas\/useVoiceCall['"]/g, "from '../../hooks/useVoiceCall'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/react-canvas\/useVoiceCall['"]/g, "from '../../../hooks/useVoiceCall'"],
  [/from ['"]\.\/panelImports['"]/g, "from './panelLoader'"],
  [/from ['"]\.\.\/stores\/layoutStore['"]/g, "from '../components/chrome/navChromeStore'"],
  [/from ['"]\.\.\/\.\.\/stores\/layoutStore['"]/g, "from '../../components/chrome/navChromeStore'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/stores\/layoutStore['"]/g, "from '../../../components/chrome/navChromeStore'"],
  [/['"]\.\/copilotkit-bridge\.tsx['"]/g, "'./protocol/copilotkit-bridge.tsx'"],
  [/['"]\.\/src\/canvas\/protocol\/copilotkit-bridge\.tsx['"]/g, "'./src/protocol/copilotkit-bridge.tsx'"],
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'canvas' || name === 'react-canvas') continue;
      walk(full, files);
    } else if (/\.(ts|tsx|mjs|json)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

for (const file of walk(src)) {
  let text = readFileSync(file, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of REPLACEMENTS) {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement);
      changed = true;
    }
  }
  if (changed) writeFileSync(file, text);
}

 Also update tests/
const testsDir = join(root, 'tests');
if (existsSync(testsDir)) {
  for (const file of walk(testsDir)) {
    let text = readFileSync(file, 'utf8');
    let changed = false;
    for (const [pattern, replacement] of REPLACEMENTS) {
      const testPattern = new RegExp(
        pattern.source.replace(/\.\.\g, '../../src/').replace(/canvas\g, 'canvas/'),
        pattern.flags);
      const testReplacements = [
        [/from ['"]\.\.\/\.\.\/src\/canvas\/panelLayoutEngine['"]/g, "from '../../src/layout/panelLayoutEngine'"],
        [/from ['"]\.\.\/\.\.\/src\/canvas\/gridLayout['"]/g, "from '../../src/layout/gridLayout'"],
        [/from ['"]\.\.\/\.\.\/src\/canvas\/CanvasContext['"]/g, "from '../../src/config/CanvasContext'"],
        [/from ['"]\.\.\/\.\.\/src\/canvas\/panelDataNormalize['"]/g, "from '../../src/config/panelDataNormalize'"],
        [/from ['"]\.\.\/\.\.\/src\/canvas\/protocol\/ag-ui['"]/g, "from '../../src/protocol/ag-ui'"],
        [/from ['"]\.\.\/\.\.\/src\/canvas\/chat\/geminiChatClient['"]/g, "from '../../src/chat/geminiChatClient'"],
        [/from ['"]\.\.\/\.\.\/src\/canvas\/ChatPanel['"]/g, "from '../../src/chat/ChatPanel'"],
        [/from ['"]\.\.\/\.\.\/src\/canvas\/voice\/useGeminiLive['"]/g, "from '../../src/voice/useGeminiLive'"],
        [/from ['"]\.\.\/\.\.\/src\/canvas\/tools\/canvasTools['"]/g, "from '../../src/agents/tools/canvasTools'"],
        [/from ['"]\.\.\/\.\.\/src\/canvas\/toneTokens['"]/g, "from '../../src/components/toneTokens'"],
        [/from ['"]\.\.\/\.\.\/src\/react-canvas\/useVoiceCall['"]/g, "from '../../src/hooks/useVoiceCall'"],
      ];
      for (const [tp, tr] of testReplacements) {
        if (tp.test(text)) {
          text = text.replace(tp, tr);
          changed = true;
        }
      }
    }
    if (changed) writeFileSync(file, text);
  }
}

rmSync(join(src, 'canvas'), { recursive: true, force: true });
rmSync(join(src, 'react-canvas'), { recursive: true, force: true });
if (existsSync(join(src, 'stores', 'layoutStore.ts'))) {
  rmSync(join(src, 'stores', 'layoutStore.ts'));
}

console.log(' migration: moved infrastructure, removed src/canvas and react-canvas');
