/**
 * Persistent open-canvas chrome indicator (D50, P12-T5).
 * Visible only when the resolved canvasPolicy preset is `open`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { Unlock } from 'lucide-react';
import { useCanvasConfig } from '../../config/CanvasContext';
import { isOpenCanvasPolicy } from '../../config/canvasPolicyTypes';
import { t } from '../../i18n';

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.2,
  color: 'var(--landi-color-on-primary, #FFFFFF)',
  background:
    'linear-gradient(135deg, var(--landi-color-primary, #0D7377) 0%, var(--landi-color-primary-light, #14B8A6) 100%)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
  pointerEvents: 'none',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

const containerStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 1200,
};

export function OpenCanvasIndicator(): ReactElement | null {
  const { canvasPolicy } = useCanvasConfig();

  if (!isOpenCanvasPolicy(canvasPolicy)) {
    return null;
  }

  const label = t('chrome.openCanvas.indicator');
  const hint = t('chrome.openCanvas.indicatorHint');

  return (
    <div style={containerStyle} data-testid="open-canvas-indicator-wrapper">
      <div
        data-testid="open-canvas-indicator"
        role="status"
        aria-live="polite"
        aria-label={hint}
        title={hint}
        style={badgeStyle}
      >
        <Unlock size={14} aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}
