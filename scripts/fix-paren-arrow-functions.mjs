/** Fix `(() =>` corrupted to missing `()` in arrow functions. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);

function fix(text) {
  return text
    .replace(/\(\s*=>/g, '(() =>')
    .replace(/return\s+=>\s*\{/g, 'return () => {')
    .replace(/return\s+=>\s*\(/g, 'return () => (');
}

let n = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(name)) {
      const t = fs.readFileSync(full, 'utf8');
      const f = fix(t);
      if (f !== t) {
        fs.writeFileSync(full, f);
        n++;
      }
    }
  }
}
walk(ROOT);
console.log(`Fixed (() => in ${n} files`);
