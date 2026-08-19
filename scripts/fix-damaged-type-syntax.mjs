/** Repair type/call syntax damaged by aggressive (() => fixes. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);

function fix(text) {
  let r = text;
  r = r.replace(/< =>/g, '<() =>');
  r = r.replace(/: =>/g, ': () =>');
  r = r.replace(/\): =>/g, '): () =>');
  r = r.replace(/\bnew Set\b(?!\()/g, 'new Set()');
  r = r.replace(/\bnew Map\b(?!\()/g, 'new Map()');
  r = r.replace(/get (\w+): boolean \{/g, 'get $1(): boolean {');
  r = r.replace(/get (\w+): number \{/g, 'get $1(): number {');
  r = r.replace(/get (\w+): string \{/g, 'get $1(): string {');
  // Restore () on known zero-arg test cleanup calls when line ends with semicolon
  r = r.replace(
    /^(\s+)(clearAnonKeyRateLimitResolverForTests|clearEmbedTelemetryEmitForTests|resetAnonKeyLookupCache|vi\.restoreAllMocks);$/gm,
    '$1$2();',
  );
  r = r.replace(/^(\s+)([a-zA-Z_$][\w$]*ForTests);$/gm, (match, indent, name) => {
    if (name.includes('ForTests')) return `${indent}${name}();`;
    return match;
  });
  return r;
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
console.log(`Repaired type/call syntax in ${n} files`);
