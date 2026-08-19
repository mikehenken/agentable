/** Restore https:// and http:// corrupted by slash-collapsing polish. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);

function fix(text) {
  return text
    .replace(/https://(?!\/)/g, 'https://')
    .replace(/http://(?!\/)/g, 'http://')
    .replace(/"eslint\."/g, '"eslint ."');
}

let n = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else {
      const ext = path.extname(name);
      if (!['.ts', '.tsx', '.md', '.json', '.mjs', '.html', '.txt', '.vue', '.svelte'].includes(ext)) continue;
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
console.log(`Restored URLs in ${n} files`);
