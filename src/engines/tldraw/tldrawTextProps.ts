/**
 * Read plain text from tldraw text shape props (v4 richText + legacy text).
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readPlainTextFromShapeProps(props: Record<string, unknown>): string | undefined {
  const legacy = props.text;
  if (typeof legacy === 'string' && legacy.length > 0) {
    return legacy;
  }

  const richText = props.richText;
  if (!isRecord(richText) || richText.type !== 'doc' || !Array.isArray(richText.content)) {
    return undefined;
  }

  const lines: string[] = [];
  for (const block of richText.content) {
    if (!isRecord(block) || block.type !== 'paragraph') {
      continue;
    }
    if (!Array.isArray(block.content)) {
      lines.push('');
      continue;
    }
    const parts: string[] = [];
    for (const node of block.content) {
      if (isRecord(node) && node.type === 'text' && typeof node.text === 'string') {
        parts.push(node.text);
      }
    }
    lines.push(parts.join(''));
  }

  const text = lines.join('\n').trimEnd();
  return text.length > 0 ? text: undefined;
}
