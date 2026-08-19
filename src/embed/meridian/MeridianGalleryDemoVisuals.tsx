import { useEffect, useState, type ReactElement } from 'react';
import { sanitizeInertText } from '../../security/codeExecutionBoundary';

export const MERIDIAN_GALLERY_EXPORT_CONFIRMATION_EVENT =
  'meridian:gallery-export-confirmation' as const;
export const MERIDIAN_GALLERY_DOCUMENT_SHOW_EVENT = 'meridian:gallery-document-show' as const;
export const MERIDIAN_GALLERY_HITL_SHOW_EVENT = 'meridian:gallery-hitl-show' as const;
export const MERIDIAN_GALLERY_HITL_HIDE_EVENT = 'meridian:gallery-hitl-hide' as const;

export interface MeridianExportConfirmationDetail {
  filename: string;
  sha256?: string;
}

export interface MeridianDocumentShowDetail {
  title: string;
  blocks: ReadonlyArray<{ type: string; preview: string }>;
}

export interface MeridianHitlShowDetail {
  actionLabel: string;
  agentLabel: string;
}

const overlayShellStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 99_999,
  pointerEvents: 'none',
  fontFamily: 'Inter, system-ui, sans-serif',
  color: '#e2e8f0',
};

const panelCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 'min(420px, 38vw)',
  maxHeight: 'min(72vh, 640px)',
  borderRadius: 14,
  border: '1px solid rgba(129, 140, 248, 0.35)',
  background: 'linear-gradient(180deg, rgba(30, 27, 75, 0.97) 0%, rgba(15, 23, 42, 0.97) 100%)',
  boxShadow: '0 18px 48px rgba(0, 0, 0, 0.45)',
  overflow: 'hidden',
};

/**
 * Fixed gallery overlays for US-3/4/5 screenshot capture (STUDY-018 iter-4).
 * Complements canvas PanelShape rendering when tldraw HTML layers are off-screen.
 */
export function MeridianGalleryDemoVisuals(): ReactElement | null {
  const [exportConfirmation, setExportConfirmation] =
    useState<MeridianExportConfirmationDetail | null>(null);
  const [documentPreview, setDocumentPreview] = useState<MeridianDocumentShowDetail | null>(null);
  const [hitlPreview, setHitlPreview] = useState<MeridianHitlShowDetail | null>(null);

  useEffect(() => {
    const onExportConfirmation = (event: Event): void => {
      const detail = (event as CustomEvent<MeridianExportConfirmationDetail>).detail;
      if (detail === undefined || typeof detail.filename !== 'string' || detail.filename.length === 0) {
        return;
      }
      setExportConfirmation({
        filename: detail.filename,
        sha256: typeof detail.sha256 === 'string' ? detail.sha256 : undefined,
      });
    };

    const onDocumentShow = (event: Event): void => {
      const detail = (event as CustomEvent<MeridianDocumentShowDetail>).detail;
      if (detail === undefined || typeof detail.title !== 'string' || !Array.isArray(detail.blocks)) {
        return;
      }
      setDocumentPreview({
        title: detail.title,
        blocks: detail.blocks,
      });
    };

    const onHitlShow = (event: Event): void => {
      const detail = (event as CustomEvent<MeridianHitlShowDetail>).detail;
      if (detail === undefined || typeof detail.actionLabel !== 'string') {
        return;
      }
      setHitlPreview({
        actionLabel: detail.actionLabel,
        agentLabel: typeof detail.agentLabel === 'string' ? detail.agentLabel : 'Meridian Designer',
      });
    };

    const onHitlHide = (): void => {
      setHitlPreview(null);
    };

    window.addEventListener(MERIDIAN_GALLERY_EXPORT_CONFIRMATION_EVENT, onExportConfirmation);
    window.addEventListener(MERIDIAN_GALLERY_DOCUMENT_SHOW_EVENT, onDocumentShow);
    window.addEventListener(MERIDIAN_GALLERY_HITL_SHOW_EVENT, onHitlShow);
    window.addEventListener(MERIDIAN_GALLERY_HITL_HIDE_EVENT, onHitlHide);
    return () => {
      window.removeEventListener(MERIDIAN_GALLERY_EXPORT_CONFIRMATION_EVENT, onExportConfirmation);
      window.removeEventListener(MERIDIAN_GALLERY_DOCUMENT_SHOW_EVENT, onDocumentShow);
      window.removeEventListener(MERIDIAN_GALLERY_HITL_SHOW_EVENT, onHitlShow);
      window.removeEventListener(MERIDIAN_GALLERY_HITL_HIDE_EVENT, onHitlHide);
    };
  }, []);

  if (exportConfirmation === null && documentPreview === null && hitlPreview === null) {
    return null;
  }

  return (
    <>
      {documentPreview !== null ? (
        <aside
          data-testid="meridian-document-panel"
          aria-label={documentPreview.title}
          style={{
            ...overlayShellStyle,
            top: 88,
            right: 20,
          }}
        >
          <div style={panelCardStyle}>
            <header
              style={{
                padding: '14px 16px 10px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                {sanitizeInertText(documentPreview.title)}
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
                Structured brief · {documentPreview.blocks.length} blocks
              </p>
            </header>
            <div style={{ padding: '12px 16px 16px', overflow: 'auto' }}>
              {documentPreview.blocks.map((block, index) => (
                <div
                  key={`${block.type}-${index}`}
                  data-block-type={block.type}
                  style={{
                    marginBottom: 12,
                    paddingBottom: 12,
                    borderBottom:
                      index < documentPreview.blocks.length - 1
                        ? '1px solid rgba(148, 163, 184, 0.12)'
                        : undefined,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#818cf8',
                      marginBottom: 4,
                    }}
                  >
                    {block.type}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.45, color: '#e2e8f0' }}>
                    {sanitizeInertText(block.preview)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      ) : null}

      {hitlPreview !== null ? (
        <section
          data-testid="meridian-hitl-card"
          aria-live="polite"
          style={{
            ...overlayShellStyle,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(460px, 92vw)',
            padding: 18,
            borderRadius: 14,
            border: '1px solid rgba(251, 191, 36, 0.45)',
            background: 'rgba(15, 23, 42, 0.96)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.55)',
          }}
        >
          <div
            data-testid="approval-awaiting-badge"
            style={{
              display: 'inline-block',
              marginBottom: 10,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(251, 191, 36, 0.16)',
              color: '#fcd34d',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Awaiting approval
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#f8fafc' }}>
            Review {sanitizeInertText(hitlPreview.actionLabel)}
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: '#cbd5e1', lineHeight: 1.5 }}>
            {sanitizeInertText(hitlPreview.agentLabel)} requested a host-data save. Persistence stays
            HITL even when canvasPolicy is open.
          </p>
        </section>
      ) : null}

      {exportConfirmation !== null ? (
        <div
          data-testid="meridian-export-confirmation"
          role="status"
          aria-live="polite"
          style={{
            ...overlayShellStyle,
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 'min(92vw, 520px)',
            padding: '12px 18px',
            borderRadius: 12,
            border: '1px solid rgba(129, 140, 248, 0.45)',
            background: 'linear-gradient(180deg, rgba(30, 27, 75, 0.96) 0%, rgba(15, 23, 42, 0.96) 100%)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          <strong style={{ color: '#c7d2fe' }}>PDF exported</strong>
          {' — '}
          {exportConfirmation.filename}. Block-model export completed under open policy.
        </div>
      ) : null}
    </>
  );
}
