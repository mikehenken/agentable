/**
 * Dev-only structured tool call logging (JSON lines).
 *
 * Browser: console + `landi:tool-call-log` event (MCP can capture).
 * Node/tests: append to `.logs/tool-calls/tool-calls.jsonl`.
 *
 * Enable: `import.meta.env.DEV`, or `VITE_LOG_TOOL_CALLS=1`, or `LOG_TOOL_CALLS=1`.
 */
import { inferPanelOpenedByTool } from './tools/domainRoutingToolFilter';

export interface ToolCallLogEntry {
  timestamp: string;
  toolName: string;
  args: Record<string, unknown>;
  ok: boolean;
  result?: unknown;
  error?: string;
  panelOpened?: string;
  messageId?: string;
  source?: 'chat' | 'voice' | 'unknown';
  agentId?: string;
}

let nodeLogDirPromise: Promise<string> | null = null;

export function isToolCallLoggingEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOG_TOOL_CALLS === '1') {
    return true;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV === true) {
    return true;
  }
  if (typeof process !== 'undefined' && process.env?.LOG_TOOL_CALLS === '1') {
    return true;
  }
  return false;
}

function resolveNodeLogPath(): Promise<string> {
  if (nodeLogDirPromise === null) {
    nodeLogDirPromise = import('node:path').then((path) =>
      path.join(process.cwd(), '.logs', 'tool-calls', 'tool-calls.jsonl'),
    );
  }
  return nodeLogDirPromise;
}

async function appendNodeLogLine(line: string): Promise<void> {
  if (typeof process === 'undefined' || !process.versions?.node) {
    return;
  }
  try {
    const [fs, pathMod] = await Promise.all([import('node:fs/promises'), import('node:path')]);
    const filePath = await resolveNodeLogPath();
    await fs.mkdir(pathMod.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${line}\n`, 'utf8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[toolCallDevLogger] failed to write log file', message);
  }
}

export interface LogToolCallInput {
  toolName: string;
  args: Record<string, unknown>;
  result: { ok: true; result: unknown } | { ok: false; error: string };
  messageId?: string;
  source?: ToolCallLogEntry['source'];
  agentId?: string;
}

export function logToolCallDev(input: LogToolCallInput): void {
  if (!isToolCallLoggingEnabled()) {
    return;
  }

  const entry: ToolCallLogEntry = {
    timestamp: new Date().toISOString(),
    toolName: input.toolName,
    args: input.args,
    ok: input.result.ok,
    panelOpened: inferPanelOpenedByTool(input.toolName, input.args),
    messageId: input.messageId,
    source: input.source ?? 'unknown',
    agentId: input.agentId,
  };

  if (input.result.ok) {
    entry.result = input.result.result;
  } else {
    entry.error = input.result.error;
  }

  const line = JSON.stringify(entry);

  if (typeof console !== 'undefined') {
    console.info('[tool-call-log]', line);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ToolCallLogEntry>('landi:tool-call-log', {
        detail: entry,
        bubbles: true,
        composed: true,
      }),
    );
  }

  void appendNodeLogLine(line);
}
