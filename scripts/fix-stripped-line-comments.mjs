/** Restore `//` on comment lines stripped by over-aggressive slash collapse. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);

function isLikelyOrphanedComment(trimmed) {
  if (!trimmed) return false;
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('*/')) {
    return false;
  }
  if (
    /^(const|let|var|return|if|else|for|while|import|export|function|class|async|await|throw|switch|case|default|break|continue|try|catch|finally|do|new|delete|typeof|instanceof|type|interface|enum|@|}\s*else|}\s*catch|}\s*finally)/.test(
      trimmed,
    )
  ) {
    return false;
  }
  if (/[;{}]$/.test(trimmed)) return false;
  if (/^\w+\s*[(:=<]/.test(trimmed)) return false;
  if (/^\.\.\./.test(trimmed)) return false;
  if (trimmed.startsWith('---')) return true;
  if (trimmed.startsWith('eslint-')) return true;
  if (/^[A-Z]/.test(trimmed)) return true;
  if (/^(voice-only|The |This |When |If |Mock |Use |Register |Stable |Required |Mixed |Ensure |Returns |Note:|TODO:|FIXME:)/.test(trimmed)) {
    return true;
  }
  if (/^[a-z]+-only\b/.test(trimmed)) return true;
  if (/^[a-z]{2,}\s/.test(trimmed) && /[."]\s*$/.test(trimmed)) return true;
  if (/ — /.test(trimmed) || trimmed.includes('—')) return true;
  return false;
}

function fixFile(text) {
  const lines = text.split('\n');
  let changed = false;
  const out = lines.map((line) => {
    const m = line.match(/^(\s*)(.*)$/);
    if (!m) return line;
    const [, indent, content] = m;
    if (!isLikelyOrphanedComment(content.trim())) return line;
    changed = true;
    return `${indent}// ${content.trimStart()}`;
  });
  return { text: out.join('\n'), changed };
}

let files = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(name)) {
      const t = fs.readFileSync(full, 'utf8');
      const { text, changed } = fixFile(t);
      if (changed) {
        fs.writeFileSync(full, text);
        files++;
      }
    }
  }
}
walk(ROOT);
console.log(`Restored // comments in ${files} files`);
