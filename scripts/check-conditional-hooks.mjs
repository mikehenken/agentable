/**
 * Static guard: React hooks must not appear after an early `return null`
 * in the same component function body. Runtime-only violations (react #300)
 * are invisible to bundlers and most unit tests unless both branches render.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK_RE = /\buse(?:State|Effect|Memo|Callback|Ref|Context|Reducer|Id|LayoutEffect|ImperativeHandle|DebugValue)\s*\(/;
const EARLY_RETURN_RE = /^\s*if\s*\([^)]*\)\s*return\s+null\s*;/;

function repoRoot {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function listTsx(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory && entry.name !== 'node_modules') {
      files.push(...listTsx(full));
    } else if (/\.tsx$/.test(entry.name) && !/\.(test|spec)\.tsx$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort;
}

function componentBodies(source) {
  const bodies = [];
  const fnRe = /(?:export\s+)?function\s+[A-Z][A-Za-z0-9]*\s*\([^)]*\)\s*(?::[^{]+)?\{/g;
  let match;
  while ((match = fnRe.exec(source)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    bodies.push(source.slice(start, i - 1));
  }
  return bodies;
}

function findViolations(body, relPath) {
  const lines = body.split('\n');
  const violations = [];
  let depth = 0;
  let sawEarlyReturnAtTop = false;

  for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
    const line = lines[lineNo];
    const trimmed = line.trim;

    if (depth === 0 && EARLY_RETURN_RE.test(line)) {
      sawEarlyReturnAtTop = true;
    }

    if (depth === 0 && sawEarlyReturnAtTop && HOOK_RE.test(line)) {
      violations.push(`${relPath}:${lineNo + 1}: hook after early return null`);
    }

    for (const ch of line) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth = Math.max(0, depth - 1);
    }
  }

  return violations;
}

function main {
  const root = repoRoot;
  const srcDir = join(root, 'src');
  const allViolations = [];

  for (const file of listTsx(srcDir)) {
    const source = readFileSync(file, 'utf8');
    const rel = file.replace(root + '\\', '').replace(root + '/', '');
    for (const body of componentBodies(source)) {
      allViolations.push(...findViolations(body, rel));
    }
  }

  if (allViolations.length > 0) {
    console.error('check-conditional-hooks failed:\n' + allViolations.join('\n'));
    process.exit(1);
  }

  console.log('check-conditional-hooks: ok');
}

main;
