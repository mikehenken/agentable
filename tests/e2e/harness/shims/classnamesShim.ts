/** Minimal classnames shim for gallery harness browser bundles. */
export default function classNames(...args: unknown[]): string {
  const parts: string[] = [];
  for (const arg of args) {
    if (typeof arg === 'string' && arg.length > 0) {
      parts.push(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      for (const [key, value] of Object.entries(arg as Record<string, unknown>)) {
        if (value) parts.push(key);
      }
    }
  }
  return parts.join(' ');
}
