// Shared domain types for orchestration components.
// Names align with the worker doc (Workspace > Project > Run > Phase > Iteration > Artifacts).
// Prototype seed data uses "Client" — kept as a type alias for visual fidelity.

export type RunStatus = "complete" | "running" | "superseded" | "draft" | "queued";
export type RunVerdict = "PASS" | "FAIL" | null;

export type ArtifactKind =
  | "markdown"
  | "yaml"
  | "yaml-cite"
  | "gap"
  | "tldraw"
  | "source";

export interface Artifact {
  id: string;
  name: string;
  kind: ArtifactKind;
  size?: string;
  updated?: string;
  /** Canonical R2 key when sourced live; absent for seed entries. */
  key?: string;
}

export interface Run {
  id: string;
  name: string;
  status: RunStatus;
  startedAt?: string;
  durationMin?: number;
  iteration?: number;
  score?: number | null;
  verdict?: RunVerdict;
  artifacts: Artifact[];
}

export interface Project {
  id: string;
  name: string;
  status: "active" | "draft" | "paused";
  emoji?: string;
  runs: Run[];
}

export interface Workspace {
  id: string;
  name: string;
  tag: string;
  industry?: string;
  emoji?: string;
  projects: Project[];
}

/** Prototype alias — same shape as Workspace. */
export type Client = Workspace;

export type IntentPriority = "critical" | "high" | "medium" | "low";
export type IntentStatus = "verified" | "paraphrased" | "needs-clarification";

export interface Intent {
  id: string;
  paraphrase: string;
  category: string;
  priority: IntentPriority;
  status: IntentStatus;
  origin: string;
  section: string;
}

export type IntentIndex = Intent[];

export interface GapComponent {
  id: string;
  label: string;
  weight: number;
  raw: number;
  weighted: number;
  prev: number;
  note?: string;
}

export interface GapFinding {
  severity: "warn" | "info" | "negative";
  title: string;
  text: string;
}

export interface GapAnalysis {
  iteration: number;
  verdict: RunVerdict;
  totalScore: number;
  threshold: number;
  prevScore: number;
  prevVerdict?: RunVerdict;
  components: GapComponent[];
  critical: GapFinding[];
  remediation: string[];
}

export interface Citation {
  id: string;
  source: string;
  page: string;
  anchor: string;
  retrieved: string;
}

export interface AnalysisReportMeta {
  runId: string;
  iteration: number;
  generated: string;
  sourceDocs: number;
  sourcePages: number;
  intentsExtracted: number;
  verifiedQuotes: number;
}

export interface AnalysisReportSection {
  id: string;
  heading: string;
  // Body blocks are heterogeneous; component renders by `type` discriminator.
  body: AnalysisReportBlock[];
}

export type AnalysisReportBlock =
  | { type: "p"; text: string }
  | { type: "kpi-row"; tiles: { label: string; value: string; trend: string; tone: "neutral" | "positive" | "warn" | "info" | "negative" }[] }
  | { type: "category-grid"; items: { name: string; count: number; share: number; tone: string }[] }
  | { type: "critical-list"; items: { id: string; title: string; quote: string; section: string }[] }
  | { type: "callout"; tone: "warn" | "info"; title: string; text: string }
  | { type: "dod-list"; items: { label: string; done: boolean; count: string; note?: string }[] };

export interface AnalysisReport {
  title: string;
  subtitle: string;
  meta: AnalysisReportMeta;
  sections: AnalysisReportSection[];
}

export type ChatMode = "conductor" | "agent" | "workflow-builder" | "planning";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  text: string;
  meta?: { mode?: ChatMode; profile?: string; model?: string };
}

export type ChatMessages = ChatMessage[];

/**
 * Adapter consumed by `<ChatPanel>`. The orchestration component owns no
 * transport — the host app implements this interface and may wire it to the
 * `landi-orchestrator` REST chat surface, an in-memory mock, etc.
 */
export interface ChatSessionAdapter {
  /** Initial messages to render before the first send. */
  seed: ChatMessages;
  /** Send a user message; returns the assistant reply. Pure async, host-implemented. */
  send(text: string, opts: { mode: ChatMode; profile: string; model: string }): Promise<ChatMessage>;
  /** Persist mode/profile/model swap; PATCHes the session. */
  patch(opts: Partial<{ mode: ChatMode; profile: string; model: string }>): Promise<void>;
  /** Attach an R2 artifact key to the session context. */
  attach(artifactKey: string, label?: string): Promise<void>;
}

export interface WorkflowDef {
  id: string;
  name: string;
  label: string;
  emoji: string;
  binding: string | null;
  status: "active" | "queued" | "planned" | "complete";
  note: string;
  runs: number | string;
}

export interface BoardNode {
  id: string;
  kind: string;
  phase: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  detail?: string;
  artifact?: string;
  link?: string;
}

export interface BoardPhase {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tone: "neutral" | "info" | "accent" | "warn" | "positive";
}

export interface BoardBay {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardGroup {
  id: string;
  label: string;
  emoji: string;
  nodes: string[];
}

export type BoardEdge = [string, string, EdgeOpts?];

export interface EdgeOpts {
  dashed?: boolean;
  thin?: boolean;
  curve?: "back" | "down";
  label?: string;
  tone?: "neutral" | "warn" | "positive";
}

export interface Board {
  groups: BoardGroup[];
  phases: BoardPhase[];
  bays: BoardBay[];
  nodes: BoardNode[];
  edges: BoardEdge[];
}
