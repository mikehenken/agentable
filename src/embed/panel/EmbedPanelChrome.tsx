import { Minus, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { t } from '../../i18n';

export interface EmbedPanelChromeProps {
  panelId: string;
  title: string;
  minimized: boolean;
  hideChrome?: boolean;
  onMinimizeToggle: () => void;
  onClose: () => void;
}

export function EmbedPanelChrome({
  panelId,
  title,
  minimized,
  hideChrome = false,
  onMinimizeToggle,
  onClose,
}: EmbedPanelChromeProps): ReactElement | null {
  if (hideChrome) {
    return null;
  }

  return (
    <div className="panel-chrome" part="chrome" data-testid={`panel-chrome-${panelId}`}>
      <div className="panel-chrome__leading" part="chrome-leading">
        <span className="panel-chrome__title" part="chrome-title">
          {title}
        </span>
      </div>
      <div className="panel-chrome__actions" part="chrome-actions">
        <button
          type="button"
          className="panel-chrome__btn"
          part="chrome-minimize"
          aria-label={minimized ? t('chrome.panel.restore') : t('chrome.panel.minimize')}
          onClick={onMinimizeToggle}
        >
          <Minus size={12} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="panel-chrome__btn"
          part="chrome-close"
          aria-label={t('chrome.panel.close')}
          onClick={onClose}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
