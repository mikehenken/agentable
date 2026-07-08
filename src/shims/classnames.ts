/**
 * Vite ESM interop shim: classnames@2 is CJS (`module.exports = classNames`).
 * tldraw imports `import classNames from 'classnames'` — without pre-bundling or
 * this shim, the browser throws "does not provide an export named 'default'".
 */
import classnamesImport from 'classnames-original';

type ClassNamesFn = {
  (...args: unknown[]): string;
  default?: ClassNamesFn;
};

const classnames =
  (classnamesImport as ClassNamesFn).default ?? (classnamesImport as ClassNamesFn);

export default classnames;
