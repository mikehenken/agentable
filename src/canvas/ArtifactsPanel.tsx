import { FileText } from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';
import { useCanvasConfig } from './CanvasContext';
import { usePanelIntentStore } from '../stores/panelIntentStore';

/**
 * ArtifactsPanel — empty by default. Conversation artifacts (resume,
 * generated career-path PNGs, improved-resume PDFs) appear here once
 * the assistant generates or the user uploads them.
 *
 * M1 ships only the empty state and the receiving slot. M2 wires up
 * the artifacts store + actual upload/generation pipeline. Demo fixtures
 * live in `examples/` when needed for marketing screenshots.
 */
export function ArtifactsPanel() {
  const { panels } = useLayoutStore();
  const { labels } = useCanvasConfig();
  // Subscribe to artifacts via the hook so pushes trigger a re-render.
  // `getState()` would read once at mount and never update.
  const storeArtifacts = usePanelIntentStore((s) => s.artifacts);
  const layout = panels.artifacts;

  if (!layout?.visible) return null;

  // Live artifacts pushed by the agent (`share_artifact` tool, or any
  // chat agent calling the same registry).
  const artifacts: ReadonlyArray<{ id: string; name: string; size: string; preview?: string }> =
    storeArtifacts.map((a) => ({
      id: a.id,
      name: a.name,
      size: `${a.kind} · ${a.content.length} chars`,
      preview: a.content,
    }));

  return (
    <DraggablePanel id="artifacts" title="Attachments & Artifacts">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {artifacts.length === 0 ? (
          <div
            className="flex h-full min-h-[200px] flex-col items-center justify-center text-center px-6 py-8"
            // role="status" reads the visible <p> text below as a live
            // region; no separate aria-label needed (would announce twice).
            role="status"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{
                background:
                  'color-mix(in srgb, var(--landi-color-primary, #0D7377) 8%, transparent)',
                color: 'var(--landi-color-primary, #0D7377)',
              }}
            >
              <FileText size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-canvas-muted mb-1">
              {labels.emptyArtifacts}
            </p>
            <p className="text-xs text-canvas-faint max-w-[260px] leading-relaxed">
              {labels.emptyArtifactsHint}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {artifacts.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-canvas-border"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-surface-subtle flex items-center justify-center shrink-0">
                  <FileText size={18} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-canvas truncate">{a.name}</p>
                  <p className="text-xs text-canvas-faint">{a.size}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DraggablePanel>
  );
}
