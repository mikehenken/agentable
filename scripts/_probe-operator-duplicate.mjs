import { chromium } from '@playwright/test';

const browser = await chromium.launch;
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html', {
  waitUntil: 'networkidle',
  timeout: 45_000,
});
await page.waitForFunction(
   => window.__galleryReady?.example === '13-canvas-wide-agent',
  { timeout: 45_000 });

const result = await page.evaluate( => {
  const rail = document.querySelector('.operator-rail');
  const dockPlacement = document.querySelector(
    'agentable-operator-surface-placement[placement="dock-inside"]');

  const collectSurfaces = (root) => {
    const surfaces = [];
    const walk = (node) => {
      if (
        !(node instanceof Element || node instanceof DocumentFragment || node instanceof Document)
      ) {
        return;
      }
      const elements =
        node instanceof Document
          ? [...node.body.querySelectorAll('*')]: node instanceof DocumentFragment
            ? [...node.children]: [node,...node.querySelectorAll('*')];
      for (const el of elements) {
        if (!(el instanceof Element)) continue;
        if (el.tagName.toLowerCase === 'agentable-operator-surface') {
          surfaces.push(el);
        }
        if (el.shadowRoot) {
          walk(el.shadowRoot);
        }
      }
    };
    walk(root);
    return surfaces;
  };

  const railSurfaces = rail ? collectSurfaces(rail): [];
  const dockSurfaces = dockPlacement ? collectSurfaces(dockPlacement): [];
  const allSurfaces = collectSurfaces(document);

  const describeSurface = (surface) => {
    const sr = surface.shadowRoot;
    return {
      modeButtons: sr?.querySelectorAll('.mode-button').length ?? 0,
      headers: sr?.querySelectorAll('.operator-header').length ?? 0,
      composers: sr?.querySelectorAll('.composer-input, [part="composer-input"]').length ?? 0,
      reactRoots: sr?.querySelectorAll('[data-operator-react-root]').length ?? 0,
      childCount: sr?.childElementCount ?? 0,
      innerHTMLLen: sr?.innerHTML.length ?? 0,
    };
  };

  const dockSurface = dockPlacement && 'getOperatorSurface' in dockPlacement
    ? dockPlacement.getOperatorSurface?.: null;
  const dockSurfaceShadow = dockSurface?.shadowRoot;
  return {
    dockGetOperatorSurface: dockSurface?.tagName ?? null,
    dockModeButtons: dockSurfaceShadow?.querySelectorAll('.mode-button').length ?? 0,
    dockHeaders: dockSurfaceShadow?.querySelectorAll('.operator-header').length ?? 0,
    dockHeaderCountPart: dockSurfaceShadow?.querySelectorAll('[part="header"]').length ?? 0,
    dockShadowChildTags: dockSurfaceShadow
      ? [...dockSurfaceShadow.children].map((c) => c.tagName): [],
    operatorResult: window.__operatorGalleryResult,
    placementDefined: customElements.get('agentable-operator-surface-placement') !== undefined,
    surfaceDefined: customElements.get('agentable-operator-surface') !== undefined,
    dockShadowHtmlLen: dockPlacement?.shadowRoot?.innerHTML.length ?? 0,
    dockShadowSurfaceTag: dockPlacement?.shadowRoot?.querySelector('agentable-operator-surface')?.tagName ?? null,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close;
