/**
 * Client-side defense-in-depth for anon-key tenant config responses (G3).
 * Strips credential-shaped fields before they enter the embed merge path.
 */
import type { EmbedConfigDocument, StaticEmbedAdapterConfig } from '../types/embedConfig';
import type { RawPanelDataPayload } from '../../config/panelDataNormalize';

/** Top-level keys allowed from a public /config response. */
const ALLOWED_TOP_LEVEL_KEYS: ReadonlyArray<keyof EmbedConfigDocument> = [
  'tenant',
  'primaryColor',
  'welcomeMessage',
  'apiEndpoint',
  'voiceEnabled',
  'snapGrid',
  'systemPrompt',
  'voiceGreeting',
  'greetingMode',
  'tokenEndpoint',
  'fullpageOnEngage',
  'fullscreenOnEngage',
  'canvasMode',
  'canvasBounds',
  'canvasBehavior',
  'canvasZoom',
  'hostHeaderHeight',
  'locale',
  'persona',
  'panelData',
  'adapter',
  'toolbar',
  'toolbarConfig',
  'panels',
];

const FORBIDDEN_KEY_PATTERN =
  /^(auth|secret|service[_-]?role|api[_-]?key|private[_-]?key|gemini|openai|supabase|bearer|password|credential)/i;

const FORBIDDEN_VALUE_PATTERNS = [
  /^sk_[a-zA-Z0-9]+$/,
  /^pk_live_[a-zA-Z0-9]+$/,
  /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\./,
  /^AIzaSy[a-zA-Z0-9_-]+$/,
  /^sbp_[a-zA-Z0-9]+$/,
] as const;

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERN.test(key);
}

function isForbiddenScalar(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return FORBIDDEN_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function sanitizePersona(raw: unknown): EmbedConfigDocument['persona'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isForbiddenKey(key) || isForbiddenScalar(value)) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? (out as EmbedConfigDocument['persona']): undefined;
}

function sanitizeAdapter(raw: unknown): EmbedConfigDocument['adapter'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const input = raw as Record<string, unknown>;
  const kind = input.kind;
  if (kind === 'static') {
    const dataUrl = typeof input.dataUrl === 'string' ? input.dataUrl: undefined;
    const data = input.data;
    if (data !== undefined && (typeof data !== 'object' || data === null || Array.isArray(data))) {
      return dataUrl ? { kind: 'static', dataUrl }: undefined;
    }
    const adapter: StaticEmbedAdapterConfig = { kind: 'static' };
    if (data !== undefined) {
      adapter.data = data as RawPanelDataPayload;
    }
    if (dataUrl) {
      adapter.dataUrl = dataUrl;
    }
    return adapter;
  }
  if (kind === 'http' && typeof input.baseUrl === 'string' && input.baseUrl.trim()) {
    const baseUrl = input.baseUrl.trim();
    if (!/^https?:\/\//.test(baseUrl) && !baseUrl.startsWith('/')) {
      return undefined;
    }
    return { kind: 'http', baseUrl };
  }
  return undefined;
}

/**
 * Strip anything outside the embed config allow-list and known secret patterns.
 */
export function sanitizeEmbedConfigDocument(raw: unknown): EmbedConfigDocument | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const key of ALLOWED_TOP_LEVEL_KEYS) {
    if (!(key in input)) continue;
    const value = input[key];
    if (isForbiddenScalar(value)) continue;

    if (key === 'persona') {
      const persona = sanitizePersona(value);
      if (persona) out.persona = persona;
      continue;
    }
    if (key === 'adapter') {
      const adapter = sanitizeAdapter(value);
      if (adapter) out.adapter = adapter;
      continue;
    }
    if (key === 'apiEndpoint' && typeof value === 'string') {
      const endpoint = value.trim();
      if (endpoint && !/^https?:\/\//.test(endpoint) && !endpoint.startsWith('/')) {
        continue;
      }
    }
    if (key === 'tokenEndpoint' && typeof value === 'string') {
      const endpoint = value.trim();
      if (!endpoint) continue;
      if (!/^https?:\/\//.test(endpoint) && !endpoint.startsWith('/')) {
        continue;
      }
    }
    out[key] = value;
  }

  return Object.keys(out).length > 0 ? (out as EmbedConfigDocument): {};
}
