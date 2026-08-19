/**
 * Restore () stripped from common zero-arg method calls by plan-ID cleanup.
 * Run: node scripts/fix-stripped-method-calls.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage']);

const REPLACEMENTS = [
  [/=: ([^=]+?) =>/g, '= (): $1 =>'],
  [/\.json\(\)\(\)/g, '.json()'],
  [/\{ =>/g, '{() =>'],
  [/Date\.now(?=[.;,\)\}\]\s-])/g, 'Date.now()'],
  [/new ([A-Z][A-Za-z0-9_]*);/g, 'new $1();'],
  [/Math\.random(?=[.;,\)\}\]\s])/g, 'Math.random()'],
  [/\.sort\)/g, '.sort())'],
  [/\.sort;/g, '.sort();'],
  [/\.sort,/g, '.sort(),'],
  [/\.toMatchSnapshot;/g, '.toMatchSnapshot();'],
  [/\.toMatchSnapshot\)/g, '.toMatchSnapshot())'],
  [/\.trim\)/g, '.trim())'],
  [/\.trim;/g, '.trim();'],
  [/\.trim,/g, '.trim(),'],
  [/\.trim\./g, '.trim().'],
  [/\.trim\?\.length/g, '.trim()?.length'],
  [/\.trim\|\|/g, '.trim()||'],
  [/\.trim&&/g, '.trim()&&'],
  [/\.trim\s+\?\s+/g, '.trim() ? '],
  [/\.trim\s*:\s*/g, '.trim() : '],
  [/\?\.trim\s+\?\?/g, '?.trim() ??'],
  [/\?\.trim\s+\|\|/g, '?.trim() ||'],
  [/\?\.trim\s*&&/g, '?.trim() &&'],
  [/\?\.trim;/g, '?.trim();'],
  [/\?\.trim,/g, '?.trim(),'],
  [/\?\.trim\)/g, '?.trim())'],
  [/!\/\^https\?:\\\/\\\.test/g, '!/^https?:\\/\\//.test'],
  [/^(\s+)\/\/ (\w+),$/gm, '$1$2,'],
  [/input\.baseUrl\.trim(?!\()/g, 'input.baseUrl.trim()'],
];

function repair(text) {
  let r = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    r = r.replace(pattern, replacement);
  }
  return r;
}

let files = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const original = fs.readFileSync(full, 'utf8');
    const next = repair(original);
    if (next !== original) {
      fs.writeFileSync(full, next);
      files++;
      console.log(path.relative(ROOT, full));
    }
  }
}

walk(ROOT);
console.log(`\nFixed ${files} files`);
