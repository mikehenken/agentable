import { describe, expect, it } from 'vitest';
import { v1CatalogEntries } from '../v1-entries';

describe('v1 catalog entries', () => {
  const expectedEntries = [
    'panel-body',
    'header',
    'field-form',
    'action-row',
    'list',
    'table',
    'badge',
    'tabs',
    'confirm',
    'stale-banner',
    'empty-state',
    'filter-chips',
    'custom-slot',
  ];

  it('provides all expected v1 entries', () => {
    for (const name of expectedEntries) {
      expect(v1CatalogEntries.has(name)).toBe(true);
      expect(v1CatalogEntries.get(name)?.name).toBe(name);
    }
    expect(v1CatalogEntries.size).toBe(expectedEntries.length);
  });

  it('rejects markdown and image (D10)', () => {
    expect(v1CatalogEntries.has('markdown')).toBe(false);
    expect(v1CatalogEntries.has('image')).toBe(false);
  });

  describe('validation tests per entry', () => {
    it('validates header', () => {
      const entry = v1CatalogEntries.get('header')!;
      expect(entry.props.safeParse({ title: 'Test' }).success).toBe(true);
      expect(entry.props.safeParse({ title: 'Test', icon: 'icon', subtitle: 'sub' }).success).toBe(true);
      expect(entry.props.safeParse({ title: 123 }).success).toBe(false);
      expect(entry.props.safeParse({}).success).toBe(false);
    });

    it('validates action-row', () => {
      const entry = v1CatalogEntries.get('action-row')!;
      expect(entry.props.safeParse({ actions: ['save'] }).success).toBe(true);
      expect(entry.props.safeParse({ actions: [] }).success).toBe(true);
      expect(entry.props.safeParse({ actions: 'save' }).success).toBe(false);
    });

    it('validates empty-state', () => {
      const entry = v1CatalogEntries.get('empty-state')!;
      expect(entry.props.safeParse({ message: 'Empty' }).success).toBe(true);
      expect(entry.props.safeParse({ message: 'Empty', action: 'goBack' }).success).toBe(true);
      expect(entry.props.safeParse({}).success).toBe(false);
    });
  });
});
