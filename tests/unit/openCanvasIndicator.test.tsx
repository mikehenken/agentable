/**
 * — open-canvas indicator visible only under `open` preset.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasProvider } from '../../src/config/CanvasContext';
import { OpenCanvasIndicator } from '../../src/components/chrome/OpenCanvasIndicator';

describe('OpenCanvasIndicator', () => {
  it('is hidden when canvasPolicy preset is guarded (framework default)', () => {
    render(
      <CanvasProvider>
        <OpenCanvasIndicator />
      </CanvasProvider>);
    expect(screen.queryByTestId('open-canvas-indicator')).toBeNull();
  });

  it('is visible when canvasPolicy preset is open', () => {
    render(
      <CanvasProvider config={{ canvasPolicy: { preset: 'open' } }}>
        <OpenCanvasIndicator />
      </CanvasProvider>);
    const indicator = screen.getByTestId('open-canvas-indicator');
    expect(indicator).toBeVisible;
    expect(indicator).toHaveTextContent('Open canvas');
    expect(indicator).toHaveAttribute('role', 'status');
  });

  it('stays hidden when open preset is overridden back to guarded at runtime', () => {
    render(
      <CanvasProvider
        config={{ canvasPolicy: { preset: 'open' } }}
        runtimeConfig={{ canvasPolicy: { preset: 'guarded' } }}
      >
        <OpenCanvasIndicator />
      </CanvasProvider>);
    expect(screen.queryByTestId('open-canvas-indicator')).toBeNull();
  });
});
