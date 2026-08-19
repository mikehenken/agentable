import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(__dirname, '../src/prompts');

const helios = fs.readFileSync(path.join(promptsDir, 'helios-system-prompt.en.txt'), 'utf8').trim;
fs.writeFileSync(
  path.join(promptsDir, 'heliosSystemPrompt.ts'),
  `/** Canonical Helios Mason prompt. Source: helios/config/helios-system-prompt.en.txt */\nexport const HELIOS_CAREER_SYSTEM_PROMPT = ${JSON.stringify(helios)} as const;\n`);

const archipelagoSrc = fs.readFileSync(path.join(promptsDir, 'archipelago-system-prompt.source.ts'), 'utf8');
const systemMatch = archipelagoSrc.match(
  /export const CAREER_CONCIERGE_SYSTEM_PROMPT = `([\s\S]*?)`;/);
const greetingMatch = archipelagoSrc.match(/export const VOICE_GREETING = `([\s\S]*?)`;/);
if (!systemMatch) {
  throw new Error('Could not extract ARCHIPELAGO system prompt');
}
fs.writeFileSync(
  path.join(promptsDir, 'archipelagoSystemPrompt.ts'),
  [
    '/** Canonical Sandy prompt. Source: archipelago/career-canvas/voice/systemPrompt.ts */',
    `export const ARCHIPELAGO_CAREER_SYSTEM_PROMPT = ${JSON.stringify(systemMatch[1])} as const;`,
    `export const ARCHIPELAGO_VOICE_GREETING = ${JSON.stringify(greetingMatch?.[1] ?? '')} as const;`,
    '',
  ].join('\n'));

console.log('Generated heliosSystemPrompt.ts and archipelagoSystemPrompt.ts');
