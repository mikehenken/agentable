/**
 * Repair arrow functions corrupted by accidental () removal: `, () =>` -> `, () =>`
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);
const EXT = new Set(['.ts', '.tsx', '.mjs', '.js']);

function fix(text) {
  let r = text;
  r = r.replace(/,\s*=>/g, ', () =>');
  r = r.replace(/async\s+=>/g, 'async () =>');
  r = r.replace(/vi\.fn\(\s*=>/g, 'vi.fn(() =>');
  r = r.replace(/vi\.fn\(async\s+=>/g, 'vi.fn(async () =>');
  return r;
}

let files = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (EXT.has(path.extname(name))) {
      const t = fs.readFileSync(full, 'utf8');
      const f = fix(t);
      if (f !== t) {
        fs.writeFileSync(full, f);
        files++;
      }
    }
  }
}
walk(ROOT);
console.log(`Fixed arrow syntax in ${files} files`);
