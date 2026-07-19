import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { v1CatalogEntries } from '../../src/panels/catalog/v1-entries';
import type { SpecNodeContextValue } from '../../src/panels/types';

describe('catalog component state matrix', () => {
  const states: Array<SpecNodeContextValue['state']> = [
    'loading',
    'empty',
    'populated',
    'error',
    'dirty',
    'saving',
    'stale',
  ];

  const entries = Array.from(v1CatalogEntries.values());

  entries.forEach((entry) => {
    describe(entry.name, () => {
      states.forEach((state) => {
        it(`renders in ${state} state with distinct DOM markers`, () => {
          const Component = entry.component as any;
          const context: SpecNodeContextValue = {
            scope: {},
            data: {},
            dispatch: () => {},
            isDirty: state === 'dirty' || state === 'saving' || state === 'stale',
            setDirty: () => {},
            state,
          };

          const props = {
            context,
            title: 'Test Title',
            message: 'Test Message',
            bind: 'bind',
            actions: ['save'],
            tabs: [{ id: 't1', label: 'Tab 1', child: 'c1' }],
            name: 'custom',
          };

          render(<Component {...props}>Children</Component>);

          // The root container always has the component's test ID
          expect(screen.getByTestId(entry.name)).toBeInTheDocument();

          // Check distinct markers based on the state
          if (state === 'loading') {
            expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
          } else if (state === 'error') {
            expect(screen.getByTestId('error-card')).toBeInTheDocument();
          } else if (state === 'empty') {
            expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
          } else {
            // It should be populated
            expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
            expect(screen.queryByTestId('error-card')).not.toBeInTheDocument();
            expect(screen.queryByTestId('empty-placeholder')).not.toBeInTheDocument();

            if (state === 'dirty') {
              expect(screen.getByTestId('dirty-indicator')).toBeInTheDocument();
            } else if (state === 'saving') {
              expect(screen.getByTestId('saving-spinner')).toBeInTheDocument();
            } else if (state === 'stale') {
              expect(screen.getByTestId('stale-banner-inline')).toBeInTheDocument();
            }
          }
        });
      });
    });
  });
});
