/**
 * In-memory TTL cache for anon-key tenant config lookups.
 */
import type { EmbedConfigDocument } from '../types/embedConfig';

export interface AnonKeyCacheEntry {
  document: EmbedConfigDocument;
  expiresAt: number;
}

export interface AnonKeyLookupCacheOptions {
  /** Time-to-live in milliseconds. Default 5 minutes. */
  ttlMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

export class AnonKeyLookupCache {
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, AnonKeyCacheEntry>();

  constructor(options: AnonKeyLookupCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
    this.now = options.now ?? (() => Date.now());
  }

  buildKey(input: { apiBaseUrl: string; configPath: string; anonKey: string }): string {
    return `${input.apiBaseUrl}|${input.configPath}|${input.anonKey}`;
  }

  get(key: string): EmbedConfigDocument | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.document;
  }

  set(key: string, document: EmbedConfigDocument): void {
    this.entries.set(key, {
      document,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    this.pruneExpired();
    return this.entries.size;
  }

  private pruneExpired(): void {
    const current = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= current) {
        this.entries.delete(key);
      }
    }
  }
}

/** Shared process-wide cache for embed bundles (tests can replace via setAnonKeyLookupCache). */
let sharedCache: AnonKeyLookupCache | null = null;

export function getAnonKeyLookupCache(): AnonKeyLookupCache {
  if (!sharedCache) {
    sharedCache = new AnonKeyLookupCache();
  }
  return sharedCache;
}

export function setAnonKeyLookupCache(cache: AnonKeyLookupCache | null): void {
  sharedCache = cache;
}

export function resetAnonKeyLookupCache(): void {
  sharedCache = null;
}
