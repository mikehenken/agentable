/**
 * Human-readable labels for inline chat tool-call cards.
 * Avoids dumping raw JSON args into user-facing transcripts.
 */

function readDiagramNodeCount(args: Record<string, unknown>): number | undefined {
  const diagram = args.diagram;
  if (typeof diagram !== 'object' || diagram === null || Array.isArray(diagram)) {
    return undefined;
  }
  const nodes = (diagram as { nodes?: unknown }).nodes;
  return Array.isArray(nodes) ? nodes.length : undefined;
}

function readShapeCount(args: Record<string, unknown>): number | undefined {
  const shapes = args.shapes;
  return Array.isArray(shapes) ? shapes.length : undefined;
}

/**
 * Short, scannable tool summary for chat UI (no raw JSON blobs).
 */
function readToolError(error: string | undefined): string | undefined {
  if (error === undefined) return undefined;
  const trimmed = error.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
}

function formatArgValue(value: unknown): string {
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

/** Helios-style function signature for tool-call chat blocks. */
export function formatToolCallSignature(
  name: string,
  args: Record<string, unknown>,
): string {
  const entries = Object.entries(args).filter(
    ([key, value]) => !key.startsWith('_') && value !== undefined && value !== null && value !== '',
  );
  if (entries.length === 0) {
    return `${name}()`;
  }
  const params = entries.map(([key, value]) => `${key}=${formatArgValue(value)}`).join(', ');
  return `${name}(${params})`;
}

export function formatToolCallLabel(
  name: string,
  args: Record<string, unknown>,
  ok: boolean,
  error?: string,
): string {
  const demoSummary = args._demoSummary;
  if (typeof demoSummary === 'string' && demoSummary.trim().length > 0) {
    return ok ? demoSummary.trim() : `${demoSummary.trim()} — failed`;
  }

  const toolError = readToolError(error);

  switch (name) {
    case 'draw_shapes': {
      const layout = typeof args.layout === 'string' ? args.layout : undefined;
      if (
        layout === 'flow' ||
        layout === 'timeline' ||
        layout === 'radial' ||
        layout === 'nested'
      ) {
        const nodeCount = readDiagramNodeCount(args);
        const layoutLabel =
          layout === 'flow'
            ? 'flow diagram'
            : layout === 'timeline'
              ? 'timeline'
              : layout === 'radial'
                ? 'radial map'
                : 'architecture diagram';
        if (ok) {
          return nodeCount !== undefined
            ? `Drew ${layoutLabel} · ${nodeCount} nodes`
            : `Drew ${layoutLabel}`;
        }
        return toolError ?? `Draw ${layoutLabel} failed`;
      }
      const shapeCount = readShapeCount(args);
      if (shapeCount !== undefined) {
        return ok
          ? `Drew ${shapeCount} shape${shapeCount === 1 ? '' : 's'} on canvas`
          : toolError ?? 'Draw shapes failed';
      }
      return ok ? 'Drew on canvas' : toolError ?? 'Draw failed';
    }
    case 'read_canvas':
      return ok ? 'Read canvas · viewport snapshot' : toolError ?? 'Read canvas failed';
    case 'clear_agent_drawings':
      return ok ? 'Cleared agent drawings' : toolError ?? 'Clear agent drawings failed';
    case 'annotate_panel':
      return ok ? 'Added panel callout' : toolError ?? 'Annotate panel failed';
    case 'screenshot_canvas':
      return ok ? 'Captured canvas screenshot' : toolError ?? 'Screenshot failed';
    case 'open_positions': {
      const signature = formatToolCallSignature(name, args);
      return ok ? `Opened positions · ${signature}` : toolError ?? `${signature} failed`;
    }
    case 'show_job_detail': {
      const signature = formatToolCallSignature(name, args);
      return ok ? `Job detail · ${signature}` : toolError ?? `${signature} failed`;
    }
    case 'open_applications':
      return ok ? 'open_applications()' : toolError ?? 'open_applications() failed';
    case 'open_growth_paths':
      return ok ? 'open_growth_paths()' : toolError ?? 'open_growth_paths() failed';
    case 'open_resources':
      return ok ? 'open_resources()' : toolError ?? 'open_resources() failed';
    case 'open_learning':
      return ok ? 'open_learning()' : toolError ?? 'open_learning() failed';
    default:
      return ok ? `${name} completed` : toolError ?? `${name} failed`;
  }
}
