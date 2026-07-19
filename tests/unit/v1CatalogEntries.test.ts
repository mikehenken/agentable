import { describe, expect, it } from 'vitest';
import { v1CatalogEntries } from '../../src/panels/catalog/v1-entries';

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
    it('validates panel-body', () => {
      const entry = v1CatalogEntries.get('panel-body')!;
      expect(entry.props.safeParse({}).success).toBe(true);
      // z.object({}) strips extra props by default if not strict, so this passes but strips them
      expect(entry.props.safeParse({ random: true }).success).toBe(true); 
    });

    it('validates header', () => {
      const entry = v1CatalogEntries.get('header')!;
      expect(entry.props.safeParse({ title: 'Test' }).success).toBe(true);
      expect(entry.props.safeParse({ title: 'Test', icon: 'icon', subtitle: 'sub' }).success).toBe(true);
      expect(entry.props.safeParse({ title: 123 }).success).toBe(false);
      expect(entry.props.safeParse({}).success).toBe(false);
    });

    it('validates field-form', () => {
      const entry = v1CatalogEntries.get('field-form')!;
      expect(entry.props.safeParse({ bind: 'source', fields: [] }).success).toBe(true);
      expect(entry.props.safeParse({ bind: 'source', fields: [{ bind: 'test' }] }).success).toBe(true);
      expect(entry.props.safeParse({ bind: 123, fields: [] }).success).toBe(false);
      expect(entry.props.safeParse({ fields: [] }).success).toBe(false);
      expect(entry.props.safeParse({ bind: 'source' }).success).toBe(false);
    });

    it('validates action-row', () => {
      const entry = v1CatalogEntries.get('action-row')!;
      expect(entry.props.safeParse({ actions: ['save'] }).success).toBe(true);
      expect(entry.props.safeParse({ actions: [] }).success).toBe(true);
      expect(entry.props.safeParse({ actions: 'save' }).success).toBe(false);
    });

    it('validates list', () => {
      const entry = v1CatalogEntries.get('list')!;
      expect(entry.props.safeParse({ bind: 's', row: { title: 'hello' } }).success).toBe(true);
      expect(entry.props.safeParse({ bind: 's', row: {}, search: true }).success).toBe(true);
      expect(entry.props.safeParse({ row: {} }).success).toBe(false);
    });

    it('validates table', () => {
      const entry = v1CatalogEntries.get('table')!;
      expect(entry.props.safeParse({ bind: 's', columns: [] }).success).toBe(true);
      expect(entry.props.safeParse({ bind: 's', columns: [{ id: 'col1' }] }).success).toBe(true);
      expect(entry.props.safeParse({ columns: [] }).success).toBe(false);
      expect(entry.props.safeParse({ bind: 's', columns: "not-array" }).success).toBe(false);
    });

    it('validates badge', () => {
      const entry = v1CatalogEntries.get('badge')!;
      expect(entry.props.safeParse({ text: 'a' }).success).toBe(true);
      expect(entry.props.safeParse({ bind: 'b', tone: 'c' }).success).toBe(true);
      expect(entry.props.safeParse({ text: 123 }).success).toBe(false);
    });

    it('validates tabs', () => {
      const entry = v1CatalogEntries.get('tabs')!;
      expect(entry.props.safeParse({ tabs: [{ id: '1', label: 'One', child: 'c1' }] }).success).toBe(true);
      expect(entry.props.safeParse({ tabs: [] }).success).toBe(true);
      expect(entry.props.safeParse({ tabs: [{ id: '1', label: 'One' }] }).success).toBe(false);
      expect(entry.props.safeParse({}).success).toBe(false);
    });

    it('validates confirm', () => {
      const entry = v1CatalogEntries.get('confirm')!;
      expect(entry.props.safeParse({}).success).toBe(true);
    });

    it('validates stale-banner', () => {
      const entry = v1CatalogEntries.get('stale-banner')!;
      expect(entry.props.safeParse({}).success).toBe(true);
    });

    it('validates empty-state', () => {
      const entry = v1CatalogEntries.get('empty-state')!;
      expect(entry.props.safeParse({ message: 'Empty' }).success).toBe(true);
      expect(entry.props.safeParse({ message: 'Empty', action: 'goBack' }).success).toBe(true);
      expect(entry.props.safeParse({}).success).toBe(false);
    });

    it('validates filter-chips', () => {
      const entry = v1CatalogEntries.get('filter-chips')!;
      expect(entry.props.safeParse({ bind: 'filters' }).success).toBe(true);
      expect(entry.props.safeParse({ bind: 123 }).success).toBe(false);
      expect(entry.props.safeParse({}).success).toBe(false);
    });

    it('validates custom-slot', () => {
      const entry = v1CatalogEntries.get('custom-slot')!;
      expect(entry.props.safeParse({ name: 'slot1' }).success).toBe(true);
      expect(entry.props.safeParse({ name: 'slot1', props: { foo: 'bar' } }).success).toBe(true);
      expect(entry.props.safeParse({}).success).toBe(false);
      expect(entry.props.safeParse({ name: 'slot1', props: "foo" }).success).toBe(false);
    });
  });
});
