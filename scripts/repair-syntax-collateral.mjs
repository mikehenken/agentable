/**
 * Repair syntax collateral from plan-ID cleanup (NOT an ID cleanup script).
 * Run: node scripts/repair-syntax-collateral.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage']);

const stats = { files: 0, changes: 0 };

function repairContent(text, isTsx = false) {
  let r = text;
  let n = 0;
  const bump = (before, after) => {
    if (before !== after) n++;
    return after;
  };

  r = bump(r, r.replace(/^export async function (\w+): /gm, 'export async function $1(): '));
  r = bump(r, r.replace(/^export function (\w+): /gm, 'export function $1(): '));
  r = bump(r, r.replace(/^(\s*)(async )?function (\w+): /gm, '$1$2function $3(): '));

  r = bump(r, r.replace(/^(\s+)((?:async |private |public |protected |override )*)(\w+): void \{/gm, '$1$2$3(): void {'));
  r = bump(
    r,
    r.replace(
      /^(\s+)((?:async |private |public |protected |override )*)(\w+): (Promise<|ReactElement|readonly |[A-Z][\w<>, |?[\]]*) \{/gm,
      '$1$2$3(): $4 {',
    ),
  );
  r = bump(
    r,
    r.replace(/^(\s+)((?:async |private |public |protected |override )*)(\w+): (number|boolean|string) \{/gm, '$1$2$3(): $4 {'),
  );

  r = bump(r, r.replace(/^(\s+)(\w+): void;$/gm, '$1$2(): void;'));
  r = bump(r, r.replace(/^(\s+)(get\w*): ([\w<>, |?[\].]+);$/gm, '$1$2(): $3;'));

  r = bump(r, r.replace(/^(\s+)isReady: boolean \{/gm, '$1get isReady(): boolean {'));
  r = bump(r, r.replace(/^(\s+)exportSnapshot: JsonObject \{/gm, '$1exportSnapshot(): JsonObject {'));
  r = bump(r, r.replace(/^(\s+)importSnapshot: void \{\}/gm, '$1importSnapshot(): void {}'));
  r = bump(r, r.replace(/^(\s+)openPanel: void \{\}/gm, '$1openPanel(): void {}'));
  r = bump(r, r.replace(/^(\s+)(isReady): boolean \{/gm, '$1get $2(): boolean {'));

  r = bump(r, r.replace(/^(\s+)---(.+?)---\s*$/gm, '$1// ---$2---'));

  r = bump(r, r.replace(/new Set\(\)</g, 'new Set<'));
  r = bump(r, r.replace(/new Map\(\)</g, 'new Map<'));
  r = bump(r, r.replace(/new Set<([^>]+)>;/g, 'new Set<$1>();'));
  r = bump(r, r.replace(/new Map<([^>]+)>;/g, 'new Map<$1>();'));

  r = bump(r, r.replace(/< =>/g, '<() =>'));
  r = bump(r, r.replace(/: =>/g, ': () =>'));
  r = bump(r, r.replace(/\?\.\;/g, '?.();'));
  r = bump(r, r.replace(/,\s*=>\s*\{/g, ', () => {'));

  r = bump(r, r.replace(/\? ([^?\n]+?)\(\): /g, '? $1() : '));
  r = bump(r, r.replace(/CONTEXT_FRAME_PADDING 2/g, 'CONTEXT_FRAME_PADDING / 2'));

  r = bump(
    r,
    r.replace(/^(\s+)(?!return\b|break\b|continue\b)([a-zA-Z_][\w.]*);\s*$/gm, '$1$2();'),
  );

  r = bump(
    r,
    r.replace(/^(\s+'[^']+',\s+)([A-Za-z][A-Za-z'() \-/]*)\s*$/gm, (match, prefix, label) => {
      if (label.match(/^(true|false|null|undefined)$/)) return match;
      return `${prefix}// ${label}`;
    }),
  );

  if (!isTsx) {
    r = bump(
      r,
      r.replace(/^(\s+)([A-Z][A-Za-z].*(?:\.|:)?)\s*$/gm, (match, indent, line) => {
        if (line.includes('//') || line.includes('/*') || line.includes('*/')) return match;
        if (/^(return|throw|if|else|for|while|switch|case|default|try|catch|finally|import|export|const|let|var|function|class|interface|type|enum|async|await|break|continue|debugger|do|new|delete|void|typeof|instanceof|in|of|yield|from|as|satisfies|extends|implements)\b/.test(line)) return match;
        if (/^[A-Z_][A-Z0-9_]*$/.test(line.trim())) return match;
        if (/^\w+\(/.test(line.trim())) return match;
        if (/^[{}\[\];,)]+$/.test(line.trim())) return match;
        if (/^['"`]/.test(line.trim())) return match;
        if (/^\/\//.test(line.trim())) return match;
        if (/^\*\//.test(line.trim())) return match;
        if (/^@/.test(line.trim())) return match;
        if (/^\.\.\./.test(line.trim())) return match;
        if (/^<\/?[\w-]+/.test(line.trim())) return match;
        if (/^\w+:\s/.test(line.trim())) return match;
        if (/^\/\s/.test(line.trim())) return match;
        return `${indent}// ${line.trim()}`;
      }),
    );
  }

  return { text: r, changes: n };
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (name === 'repair-syntax-collateral.mjs') continue;

    const original = fs.readFileSync(full, 'utf8');
    const isTsx = name.endsWith('.tsx');
    const { text, changes } = repairContent(original, isTsx);
    if (text !== original) {
      fs.writeFileSync(full, text);
      stats.files++;
      stats.changes += changes;
      console.log(path.relative(ROOT, full));
    }
  }
}

walk(ROOT);
console.log(`\nRepaired ${stats.files} files (${stats.changes} pattern applications)`);
