/**
 * Read-only spec playground docs harness.
 * Open via dev server: /examples/spec-playground/index.html
 */
import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SpecPlayground } from '../../src/devtools/playground/SpecPlayground';

export function SpecPlaygroundApp(): ReactElement {
  return <SpecPlayground />;
}

const mount = document.getElementById('root');
if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <SpecPlaygroundApp />
    </StrictMode>);
}

declare global {
  interface Window {
    __specPlaygroundReady?: { ok: boolean };
  }
}

window.__specPlaygroundReady = { ok: true };
