import type { ReactElement } from 'react';
import { Download, FileText, Upload } from 'lucide-react';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';

const DOCS = [
  {
    id: 'resume',
    name: 'Mike_Henken_Resume_2026.pdf',
    updated: 'Mar 10, 2026',
    size: '248 KB',
  },
  {
    id: 'cover',
    name: 'Resort_Manager_Cover_Letter.docx',
    updated: 'Mar 12, 2026',
    size: '42 KB',
  },
  {
    id: 'certs',
    name: 'Hospitality_Certificates.zip',
    updated: 'Feb 28, 2026',
    size: '1.2 MB',
  },
] as const;

export function ResumeDocsPanel(_props: ReactPanelLoaderProps): ReactElement {
  return (
    <div className="flex flex-col h-full min-h-[380px]" data-testid="resume-docs-panel">
      <div className="shrink-0 px-4 py-3 border-b border-canvas-border flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-canvas">Resume & Docs</h2>
          <p className="text-[12px] text-canvas-muted mt-0.5">Files Sandy can reference in applications</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-canvas-primary px-2.5 py-1.5 rounded-lg border border-canvas-primary/30 hover:bg-canvas-primary-tint"
        >
          <Upload size={14} />
          Upload
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-3 space-y-2">
        {DOCS.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-surface p-3"
            data-testid={`resume-doc-${doc.id}`}
          >
            <div className="w-10 h-10 rounded-lg bg-canvas-primary-tint flex items-center justify-center shrink-0">
              <FileText size={18} className="text-canvas-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-canvas truncate">{doc.name}</p>
              <p className="text-[11px] text-canvas-faint">
                Updated {doc.updated} · {doc.size}
              </p>
            </div>
            <button
              type="button"
              className="p-2 rounded-lg text-canvas-muted hover:bg-canvas-surface-subtle"
              aria-label={`Download ${doc.name}`}
            >
              <Download size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
