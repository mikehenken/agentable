/**
 * Remove orchestration plan/phase/task IDs from agentable-canvas.
 * Safe: never strips () from arrow functions.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  'playwright-report',
  'test-results',
]);

const EXT = new Set([
  '.ts',
  '.tsx',
  '.md',
  '.json',
  '.mjs',
  '.html',
  '.txt',
  '.css',
  '.yaml',
  '.yml',
  '.svelte',
  '.vue',
]);

const ID_PATTERNS = [
  /\bP\d+-T\d+\b/g,
  /\bSTUDY-\d+\b/g,
  /\bCCP-T\d+\b/g,
  /\bUS-[A-Z]\d+\b/g,
  /\bUS-\d+\b/g,
  /\bEpic [A-Z]\b/g,
  /\bTICKET-\d+\b/g,
  /\biteration-\d+\b/g,
  /(?<![#A-Za-z0-9])D\d+(?![A-Za-z0-9])/g,
];

function countIdMatches(text) {
  let n = 0;
  for (const re of ID_PATTERNS) {
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

function polishAfterRemoval(text) {
  let result = text;
  result = result.replace(/\(\s*,/g, '(');
  result = result.replace(/,\s*\)/g, ')');
  result = result.replace(/\(\s*item\s+\d+\s*\)/gi, '');
  result = result.replace(/\( WCAG/g, '(WCAG');
  result = result.replace(/Under\s+deployment freeze/gi, 'Under deployment freeze');
  result = result.replace(/frozen\s+vocabulary/gi, 'frozen error-code vocabulary');
  result = result.replace(/summary:\s{2,}/g, 'summary: ');
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/\s+([,.;:])/g, '$1');
  result = result
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*)(.*)$/s);
      if (!m) return line;
      return m[1] + m[2].replace(/ {2,}/g, ' ');
    })
    .join('\n');
  return result;
}

function removeIds(text) {
  let result = text;
  for (const re of ID_PATTERNS) {
    result = result.replace(re, '');
  }
  return polishAfterRemoval(result);
}

function cleanEntityJson(text) {
  try {
    const data = JSON.parse(text);
    if (data.metadata && typeof data.metadata === 'object') {
      delete data.metadata.study;
      delete data.metadata.task;
    }
    if (Array.isArray(data.tags)) {
      data.tags = data.tags.filter((t) => !/^P\d+-T\d+$/.test(t));
    }
    if (typeof data.description === 'string') {
      data.description = removeIds(data.description);
    }
    return JSON.stringify(data, null, 2) + '\n';
  } catch {
    return removeIds(text);
  }
}

const stats = { files: 0, removals: 0 };

function processFile(full) {
  const ext = path.extname(full);
  if (!EXT.has(ext)) return;
  if (path.basename(full) === 'clean-plan-phase-ids.mjs') return;

  const text = fs.readFileSync(full, 'utf8');
  const before = countIdMatches(text);

  let cleaned;
  if (full.includes(`${path.sep}assets${path.sep}entities${path.sep}`) && ext === '.json') {
    cleaned = cleanEntityJson(text);
  } else {
    cleaned = removeIds(text);
  }

  const after = countIdMatches(cleaned);
  const removed = before - after;
  if (removed > 0 || cleaned !== text) {
    fs.writeFileSync(full, cleaned);
    stats.files += 1;
    stats.removals += removed;
    console.log(`${path.relative(ROOT, full)}: ${removed}`);
  }
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else processFile(full);
  }
}

walk(ROOT);
console.log(`Done: ${stats.files} files, ${stats.removals} removals`);
