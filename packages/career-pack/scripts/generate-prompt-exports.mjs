import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(__dirname, '../src/prompts');

const moss = fs.readFileSync(path.join(promptsDir, 'moss-system-prompt.en.txt'), 'utf8').trim;
fs.writeFileSync(
  path.join(promptsDir, 'mossSystemPrompt.ts'),
  `/** Canonical Moss Mason prompt. Source: moss/config/moss-system-prompt.en.txt */\nexport const MOSS_CAREER_SYSTEM_PROMPT = ${JSON.stringify(moss)} as const;\n`);

const sandalsSrc = fs.readFileSync(path.join(promptsDir, 'sandals-system-prompt.source.ts'), 'utf8');
const systemMatch = sandalsSrc.match(
  /export const CAREER_CONCIERGE_SYSTEM_PROMPT = `([\s\S]*?)`;/);
const greetingMatch = sandalsSrc.match(/export const VOICE_GREETING = `([\s\S]*?)`;/);
if (!systemMatch) {
  throw new Error('Could not extract SANDALS system prompt');
}
fs.writeFileSync(
  path.join(promptsDir, 'sandalsSystemPrompt.ts'),
  [
    '/** Canonical Sandy prompt. Source: sandals/career-canvas/voice/systemPrompt.ts */',
    `export const SANDALS_CAREER_SYSTEM_PROMPT = ${JSON.stringify(systemMatch[1])} as const;`,
    `export const SANDALS_VOICE_GREETING = ${JSON.stringify(greetingMatch?.[1] ?? '')} as const;`,
    '',
  ].join('\n'));

console.log('Generated mossSystemPrompt.ts and sandalsSystemPrompt.ts');
