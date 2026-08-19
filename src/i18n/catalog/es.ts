/**
 * Spanish locale pack. Ships with the career pack in P4; partial —
 * missing keys fall back to English via the locale fallback chain.
 */
import type { MessageCatalog } from './en';

export const es = {
   // --- Career pack panels ---
  'career.panels.openPositions.title': 'Posiciones abiertas',
  'career.panels.openPositions.subtitle': 'Vacantes actuales',
  'career.panels.applications.title': 'Mis solicitudes',
  'career.panels.applications.column.job': 'Puesto',
  'career.panels.applications.column.status': 'Estado',
  'career.panels.applications.column.submitted': 'Enviado',
  'career.panels.growthPaths.title': 'Rutas de crecimiento',
  'career.panels.growthPaths.subtitle': 'Ejemplos de trayectorias',
  'career.panels.resources.title': 'Recursos',
  'career.nav.openPositions': 'Posiciones abiertas',
  'career.nav.applications': 'Mis solicitudes',
  'career.nav.resources': 'Recursos',
  'career.nav.growthPaths': 'Rutas de crecimiento',

   // --- Panel chrome controls (embed RTL audit) ---
  'chrome.panel.minimize': 'Minimizar panel',
  'chrome.panel.restore': 'Restaurar panel',
  'chrome.panel.close': 'Cerrar panel',
  'chrome.panel.loading': 'Cargando panel…',
  'chrome.panel.adapterUnavailable': 'El adaptador de datos del panel no está disponible.',
  'chrome.panel.notRegistered': 'No hay panel registrado para el id {panelId}.',
} as const satisfies MessageCatalog;
