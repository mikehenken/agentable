import type { ReactElement } from 'react';
import { t } from '../../i18n';

export interface ProvenanceBadgeProps {
  /** When false the badge is not rendered (host-origin panels). */
  visible: boolean;
}

/**
 * Framework-owned agent provenance marker (D12). Lives in panel chrome so
 * spec content cannot imitate it.
 */
export function ProvenanceBadge({ visible }: ProvenanceBadgeProps): ReactElement | null {
  if (!visible) return null;

  return (
    <span
      className="panel-provenance-badge"
      data-testid="panel-provenance-badge"
      aria-label={t('chrome.provenance.agent')}
    >
      {t('chrome.provenance.agent')}
    </span>
  );
}
