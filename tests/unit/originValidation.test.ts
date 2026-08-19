/**
 * origin validation unit coverage.
 */
import { describe, it, expect } from 'vitest';
import {
  isOriginAllowed,
  parseAllowedOrigins,
  resolveParentOriginFromReferrer,
} from '../../src/embed/iframe/originValidation';

describe('originValidation', () => {
  it('normalizes and deduplicates allowed origins', () => {
    expect(
      parseAllowedOrigins('https://cms.example.com/, https://cms.example.com,http://localhost:3000')).toEqual(['https://cms.example.com', 'http://localhost:3000']);
  });

  it('rejects wildcard and invalid origins', () => {
    expect(parseAllowedOrigins('*')).toEqual([]);
    expect(parseAllowedOrigins('javascript:alert(1)')).toEqual([]);
    expect(isOriginAllowed('https://evil.example.com', ['https://cms.example.com'])).toBe(false);
  });

  it('allows listed origins only', () => {
    const allowlist = ['https://cms.example.com'];
    expect(isOriginAllowed('https://cms.example.com', allowlist)).toBe(true);
    expect(isOriginAllowed('https://cms.example.com/', allowlist)).toBe(true);
  });

  it('derives parent origin from referrer', () => {
    expect(resolveParentOriginFromReferrer('https://cms.example.com/page')).toBe(
      'https://cms.example.com');
    expect(resolveParentOriginFromReferrer('')).toBeNull();
  });
});
