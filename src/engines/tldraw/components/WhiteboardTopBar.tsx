/**
 * WhiteboardTopBar — slim chrome strip at the top of the whiteboard
 * route. Hosts:
 *   - Persona title ("{assistantName} · {tenantTitle}")
 *   - Auto-arrange + Reset canvas (config-driven visibility)
 *   - VoiceChip (always-visible voice CTA when voice tool enabled)
 *   - Maximize button (toggle document fullscreen)
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { LayoutGrid, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react';
import { useCanvasConfig } from '../../../config/CanvasContext';
import { AiPersona, useAiPersonaState } from '../../../components/ai-persona';
import { VoiceChip } from '../voice/VoiceChip';
import { getEditor } from '../shapes/panelShapeApi';
import { autoArrangeWhiteboardPanels } from '../layout/autoArrangeWhiteboardPanels';
import { resetWhiteboardLayout } from '../layout/resetWhiteboardLayout';
import type { ResolvedWhiteboardToolbarConfig } from '../toolbar/toolbarConfig';
import {
  readOperatorRailCollapsed,
  setOperatorRailCollapsed,
  subscribeOperatorRailCollapsed,
} from '../../../embed/gallery/operatorRailChromeBridge';
import { useWhiteboardHostChrome } from '../hostChrome/WhiteboardHostChromeContext';

function resolveChromeButtonStyle(darkCanvas: boolean): CSSProperties {
  if (darkCanvas) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      borderRadius: 8,
      border: '1px solid var(--vibe-border, rgb(255 255 255 / 0.09))',
      background: 'var(--vibe-composer-bg, #141414)',
      color: 'var(--vibe-text-muted, #9a9a9a)',
      cursor: 'pointer',
      flexShrink: 0,
    };
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid var(--landi-color-border, #E5E5E0)',
    background: 'var(--landi-color-surface, #FFFFFF)',
    color: 'var(--landi-color-text-muted, #6B6B66)',
    cursor: 'pointer',
    flexShrink: 0,
  };
}

export interface WhiteboardTopBarProps {
  toolbar?: ResolvedWhiteboardToolbarConfig;
  /** Compact chrome: hide button text labels on narrow viewports. */
  compact?: boolean;
  /** Dark vibe canvas shell — use operator/gallery tokens for header controls. */
  darkCanvas?: boolean;
}

export function WhiteboardTopBar({
  toolbar,
  compact = false,
  darkCanvas = false,
}: WhiteboardTopBarProps = {}): ReactElement {
  const { persona } = useCanvasConfig();
  const assistantName = persona.assistantName ?? 'Assistant';
  const tenantTitle = persona.tenantTitle ?? 'AI Assistant';
  const avatarInitial = assistantName.charAt(0).toUpperCase() || 'A';
  const brandLogo = persona.brandLogo;
  const showHeaderPersona = persona.visual?.showInHeader === true && brandLogo === undefined;
  const headerPersonaType = persona.visual?.type ?? 'halo';
  const hostChrome = useWhiteboardHostChrome();
  const isCanvasExpanded = hostChrome?.().isCanvasExpanded ?? false;
  const useCanvasExpand = hostChrome?.().chrome.fullscreenMode === 'canvas-expand';
  const isFullscreen = useCanvasExpand ? isCanvasExpanded : useDocumentFullscreenState();
  const { state: personaState, level: personaLevel } = useAiPersonaState({
    preferAsleepWhenIdle: true,
  });
  const showAutoArrange = toolbar?.showAutoArrangeTopBar ?? true;
  const showReset = toolbar?.showResetTopBar ?? true;
  const showVoice = toolbar?.enableVoiceTool ?? true;
  const [operatorRailCollapsed, setOperatorRailCollapsedState] = useState(() =>
    readOperatorRailCollapsed());
  const chromeButtonStyle = resolveChromeButtonStyle(darkCanvas);
  const headerBorder = darkCanvas
    ? 'var(--vibe-border, rgb(255 255 255 / 0.09))': 'var(--landi-color-border, #E5E5E0)';
  const headerBackground = darkCanvas
    ? 'var(--vibe-surface, #1a1a1a)': 'var(--landi-color-surface, #FFFFFF)';
  const headerText = darkCanvas
    ? 'var(--vibe-text, #ececec)': 'var(--landi-color-text, #1A1A1A)';

  useEffect(() => {
    return subscribeOperatorRailCollapsed(setOperatorRailCollapsedState);
  }, []);

  const toggleOperatorRail = useCallback(() => {
    setOperatorRailCollapsed(!operatorRailCollapsed);
  }, [operatorRailCollapsed]);

  const toggleFullscreen = useCallback(() => {
    if (useCanvasExpand && hostChrome !== null) {
      hostChrome.toggleCanvasExpand();
      return;
    }
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      const target = document.documentElement;
      void target.requestFullscreen?.();
    }
  }, [hostChrome, useCanvasExpand]);

  const handleAutoArrange = useCallback(() => {
    const editor = getEditor();
    if (!editor) return;
    autoArrangeWhiteboardPanels(editor);
  }, []);

  const handleResetCanvas = useCallback(() => {
    const editor = getEditor();
    if (!editor) return;
    resetWhiteboardLayout(editor, { openChat: true, resetCamera: true });
  }, []);

  return (
    <header
      data-testid="whiteboard-top-bar"
      data-compact={compact ? 'true' : 'false'}
      style={{
        height: 48,
        flex: '0 0 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: compact ? '0 8px' : '0 16px',
        gap: 8,
        borderBottom: `1px solid ${headerBorder}`,
        background: headerBackground,
        zIndex: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: compact ? 12 : 14,
          fontWeight: 600,
          color: headerText,
          minWidth: 0,
          flex: '1 1 auto',
          overflow: 'hidden',
        }}
      >
        {brandLogo ? (
          <img
            src={brandLogo.url}
            alt={brandLogo.alt}
            data-testid="whiteboard-brand-logo"
            style={{
              height: brandLogo.height ?? 28,
              width: 'auto',
              flexShrink: 0,
              objectFit: 'contain',
            }}
          />
        ) : showHeaderPersona ? (
          <AiPersona
            type={headerPersonaType}
            state={personaState}
            size="xs"
            level={personaLevel}
            initial={avatarInitial}
            label={assistantName}
            data-testid="ai-persona-header"
          />
        ): (
          <span
            aria-hidden="true"
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
              color: 'var(--landi-color-on-primary, #FFFFFF)',
              background:
                'linear-gradient(135deg, var(--landi-color-primary, #0D7377) 0%, var(--landi-color-primary-light, #14B8A6) 100%)',
            }}
          >
            {avatarInitial}
          </span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {compact ? assistantName : `${assistantName} · ${tenantTitle}`}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 4 : 8,
          flexShrink: 0,
          maxWidth: compact ? '58%' : 'none',
          overflowX: 'auto',
        }}
      >
        {showAutoArrange ? (
          <button
            type="button"
            data-testid="whiteboard-auto-arrange"
            onClick={handleAutoArrange}
            title="Auto-arrange panels"
            aria-label="Auto-arrange panels"
            style={{...chromeButtonStyle,
              padding: compact ? '6px' : chromeButtonStyle.padding,
            }}
          >
            <LayoutGrid size={14} />
            {!compact ? (
              <span style={{ fontSize: 12, fontWeight: 500 }}>Auto-arrange</span>
            ): null}
          </button>
        ): null}
        {showReset ? (
          <button
            type="button"
            data-testid="whiteboard-reset-canvas"
            onClick={handleResetCanvas}
            title="Reset canvas"
            aria-label="Reset canvas"
            style={{...chromeButtonStyle,
              padding: compact ? '6px' : chromeButtonStyle.padding,
            }}
          >
            <RotateCcw size={14} />
            {!compact ? (
              <span style={{ fontSize: 12, fontWeight: 500 }}>Reset</span>
            ): null}
          </button>
        ): null}
        {darkCanvas ? (
          <button
            type="button"
            data-testid="operator-rail-expand"
            onClick={toggleOperatorRail}
            title={operatorRailCollapsed ? 'Expand operator rail' : 'Collapse operator rail'}
            aria-label={operatorRailCollapsed ? 'Expand operator rail' : 'Collapse operator rail'}
            style={{...chromeButtonStyle,
              padding: compact ? '6px' : chromeButtonStyle.padding,
            }}
          >
            {operatorRailCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            {!compact ? (
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {operatorRailCollapsed ? 'Operator' : 'Hide operator'}
              </span>
            ): null}
          </button>
        ): null}
        {showVoice ? <VoiceChip /> : null}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Maximize'}
          style={{
            width: 32,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${headerBorder}`,
            borderRadius: 8,
            background: headerBackground,
            color: darkCanvas
              ? 'var(--vibe-text-muted, #9a9a9a)': 'var(--landi-color-text-muted, #6B6B66)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </header>
  );
}

function useDocumentFullscreenState(): boolean {
  const [isFs, setIsFs] = useState(() =>
    typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const sync = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  return isFs;
}
