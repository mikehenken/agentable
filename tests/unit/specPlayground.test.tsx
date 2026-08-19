/**
 * read-only spec playground component tests.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpecPlayground } from '../../src/devtools/playground/SpecPlayground';

describe('SpecPlayground ', () => {
  it('renders playground shell with preview and inspector panes', async () => {
    render(<SpecPlayground />);
    expect(screen.getByTestId('spec-playground')).toBeInTheDocument;
    expect(screen.getByTestId('spec-playground-input')).toBeInTheDocument;
    await waitFor(() => {
      expect(screen.getByTestId('spec-playground-preview')).toBeInTheDocument;
    });
    expect(screen.getByTestId('spec-playground-inspector')).toBeInTheDocument;
  });

  it('diagnoses an invalid pasted spec end to end in the inspector', async () => {
    render(<SpecPlayground />);
    fireEvent.click(screen.getByTestId('load-invalid-sample'));

    await waitFor(() => {
      expect(screen.getByTestId('spec-playground-preview-error')).toBeInTheDocument;
    });

    await waitFor(() => {
      expect(screen.getByText(/SPEC_ACTION_REF_MISSING/)).toBeInTheDocument;
    });
  });

  it('renders a valid sample spec in the preview pane', async () => {
    render(<SpecPlayground />);
    fireEvent.click(screen.getByTestId('load-valid-sample'));

    await waitFor(() => {
      expect(screen.getByTestId('spec-playground-preview')).toBeInTheDocument;
    });

    expect(screen.queryByTestId('spec-playground-preview-error')).not.toBeInTheDocument;
  });
});
