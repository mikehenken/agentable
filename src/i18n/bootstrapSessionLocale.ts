/**
 * Session locale bootstrap. Called once when the embed or React host
 * mounts so `t`, `getI18n`, and SpecRenderer `dir` share one resolved locale.
 */
import { configureI18n, type I18n } from './index';
import { ar } from './catalog/ar';
import { es } from './catalog/es';

export interface SessionLocaleBootstrapInput {
  /** `locale` attribute on `<agentable-canvas>`; highest precedence. */
  embedLocale?: string | null;
  /** Tenant config `locale` field from config-url JSON. */
  tenantLocale?: string | null;
}

/** Register built-in locale packs and configure the session-wide `t` instance. */
export function bootstrapSessionLocale(input: SessionLocaleBootstrapInput = {}): I18n {
  return configureI18n({
    embedLocale: input.embedLocale,
    tenantLocale: input.tenantLocale,
    navigatorLanguage: null,
    catalogs: { ar, es },
  });
}
