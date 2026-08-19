/**
 * Arabic locale pack. Partial — missing keys fall back to English.
 */
import type { MessageCatalog } from './en';

export const ar = {
  // --- Career pack panels ---
  'career.panels.openPositions.title': 'الوظائف المتاحة',
  'career.panels.openPositions.subtitle': 'الفرص الحالية',
  'career.panels.applications.title': 'طلباتي',
  'career.panels.applications.column.job': 'الوظيفة',
  'career.panels.applications.column.status': 'الحالة',
  'career.panels.applications.column.submitted': 'تاريخ التقديم',
  'career.panels.growthPaths.title': 'مسارات النمو',
  'career.panels.growthPaths.subtitle': 'أمثلة على المسارات المهنية',
  'career.panels.resources.title': 'الموارد',
  'career.nav.openPositions': 'الوظائف المتاحة',
  'career.nav.applications': 'طلباتي',
  'career.nav.resources': 'الموارد',
  'career.nav.growthPaths': 'مسارات النمو',

  // --- Panel chrome controls (embed RTL audit) ---
  'chrome.panel.minimize': 'تصغير اللوحة',
  'chrome.panel.restore': 'استعادة اللوحة',
  'chrome.panel.close': 'إغلاق اللوحة',
  'chrome.panel.loading': 'جارٍ تحميل اللوحة…',
  'chrome.panel.adapterUnavailable': 'محول بيانات اللوحة غير متاح.',
  'chrome.panel.notRegistered': 'لا توجد لوحة مسجلة للمعرّف {panelId}.',
} as const satisfies MessageCatalog;
