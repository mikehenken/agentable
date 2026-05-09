import * as React from "react";
import { Icon, useResizableSidebar, type IconName } from "../../general";
import {
  Attachments,
  Conversation,
  Loader,
  Message,
  MessageContent,
  Response,
  type AttachmentItem,
} from "../../ui-ai";
import type { ArtifactKind, ChatMessage, ChatMessages, ChatMode, ChatSessionAdapter } from "../types";
import { SettingsDrawer, type ChatModeDef, type ProfileOption, type ModelOption } from "./settings-drawer";
import type { FlatArtifact } from "../modals/context-picker-modal";

const CHAT_DEFAULT_WIDTH = 360;
const CHAT_MIN_WIDTH = 280;
const CHAT_MAX_WIDTH = 640;
const CHAT_COLLAPSED_WIDTH = 36;

const MODE_INITIAL_MAP: Record<string, string> = {
  agent: "A",
  "workflow-builder": "W",
  planning: "P",
  conductor: "O",
};
const modeInitial = (m: string | undefined) => MODE_INITIAL_MAP[m ?? "conductor"] ?? "O";

const ARTIFACT_KIND_ICON: Record<ArtifactKind, IconName> = {
  markdown: "doc",
  yaml: "yaml",
  "yaml-cite": "yaml",
  gap: "spark",
  tldraw: "board",
  source: "artifact",
};

/**
 * Scope a chat tab is bound to. The host app wires this through to the
 * orchestrator session so that conductor mode (and sub-agents that
 * subscribe to scoped context) can see the right run/project/workspace.
 */
export interface ChatScope {
  runId?: string;
  workspaceId?: string;
  projectId?: string;
}

/**
 * Description of a chat tab the panel should render. Each descriptor
 * gets its own session adapter (created via `createSession`), its own
 * conversation, and its own mode/profile/model selection. The
 * descriptor's `id` is the React key — it MUST be stable across
 * re-renders or the tab's state will reset.
 */
export interface ChatTabDescriptor {
  id: string;
  label: string;
  scope?: ChatScope;
  /** Initial mode for this tab. Defaults to panel `defaults.mode`. */
  mode?: ChatMode;
  /** Initial profile for this tab. Defaults to panel `defaults.profile`. */
  profile?: string;
  /** Initial model for this tab. Defaults to panel `defaults.model`. */
  model?: string;
  /**
   * Adopt an existing worker session for this tab. Wired by the
   * persistence layer when rehydrating tabs after reload.
   */
  sessionId?: string;
}

interface InternalTab extends ChatTabDescriptor {
  session: ChatSessionAdapter;
  mode: ChatMode;
  profile: string;
  model: string;
  messages: ChatMessages;
  /** Per-message attachment manifest, keyed by message index. */
  messageAttachments: Record<number, AttachmentItem[]>;
  sending: boolean;
  /** Live-streamed assistant text for the current in-flight reply. */
  streamingText: string;
  input: string;
  showSettings: boolean;
  customPrompt: string;
  /** Attachments staged or uploaded for the next message. */
  pendingAttachments: AttachmentItem[];
}

export interface ChatPanelProps {
  /**
   * Factory for creating a session adapter for a tab. Called once per
   * tab id — the panel caches the resulting adapter for the tab's
   * lifetime. The host wires this to its REST/MCP transport and is
   * free to scope the session via `descriptor.scope`.
   */
  createSession: (descriptor: ChatTabDescriptor) => ChatSessionAdapter;
  modes: ChatModeDef[];
  profiles: ProfileOption[];
  models: ModelOption[];
  /** Defaults for newly-created tabs. */
  defaults?: { mode?: ChatMode; profile?: string; model?: string };
  /**
   * Currently-selected run, used to label freshly-opened conductor
   * tabs ("Run · run-xyz") and to scope the session. When this
   * changes, the panel proposes a new tab — it does NOT mutate
   * existing tabs (the user may have intentionally pinned a tab to a
   * different run).
   */
  currentRun?: { runId: string; label?: string; workspaceId?: string; projectId?: string } | null;
  /** Hook for the "+" button — host opens the context picker and returns added items. */
  onOpenContextPicker?: () => void;
  /** Pinned context — host owns the list. */
  context?: FlatArtifact[];
  /** Remove a context item by id. */
  onRemoveContext?: (id: string) => void;
  /** Open a context artifact in the host's viewer modal. */
  onOpenContextArtifact?: (artifact: FlatArtifact) => void;
  /** True when the chat session is reachable. Drives the header status dot. */
  connected?: boolean;
  /**
   * When set, the panel persists tab descriptors + the active tab id
   * in `localStorage` under `agentable-orch:chat-tabs:<persistKey>`
   * and rehydrates them on next mount. Hosts use the authenticated
   * user id (or a stable surrogate) so each user gets their own tab
   * list. Omit for ephemeral instances (tests, demos).
   */
  persistKey?: string;
}

/**
 * Generates a tab id for a brand-new "+" click. Stable enough for the
 * tab's lifetime; uniqueness is owed to `Date.now()` plus a counter.
 */
let __tabCounter = 0;
const newTabId = () => `tab-${Date.now().toString(36)}-${(__tabCounter++).toString(36)}`;

/**
 * Build the descriptor for the initial tab the panel auto-creates so
 * the user lands on a usable state. If `currentRun` is set, the first
 * tab is conductor-scoped to that run. Otherwise the tab is a generic
 * `agent` chat — conductor mode requires run/project scope to be
 * useful, so we don't surface it as the default.
 */
const initialTabDescriptor = (
  defaults: ChatPanelProps["defaults"] | undefined,
  currentRun: ChatPanelProps["currentRun"] | undefined,
): ChatTabDescriptor => {
  if (currentRun?.runId) {
    return {
      id: `run:${currentRun.runId}`,
      label: currentRun.label ?? `Run · ${currentRun.runId.slice(-12)}`,
      scope: {
        runId: currentRun.runId,
        workspaceId: currentRun.workspaceId,
        projectId: currentRun.projectId,
      },
      mode: defaults?.mode ?? "conductor",
      profile: defaults?.profile,
      model: defaults?.model,
    };
  }
  return {
    id: newTabId(),
    label: "Agent",
    mode: "agent",
    profile: defaults?.profile,
    model: defaults?.model,
  };
};

/**
 * True when conductor mode makes sense for this scope. The conductor
 * agent reads run state and dispatches workflows, so it's only
 * meaningful inside a run or project context.
 */
const conductorAvailable = (scope: ChatScope | undefined): boolean =>
  Boolean(scope?.runId || scope?.projectId);

/**
 * Shape persisted to localStorage. Intentionally minimal — messages
 * live on the worker (`GET /chat/sessions/:id`) and are rehydrated via
 * `adapter.restore()`, so we only store the descriptor + sessionId.
 */
interface PersistedTab {
  id: string;
  label: string;
  scope?: ChatScope;
  mode: ChatMode;
  profile: string;
  model: string;
  sessionId?: string;
}

interface PersistedState {
  v: 1;
  tabs: PersistedTab[];
  activeTabId: string;
}

const persistStorageKey = (key: string) => `agentable-orch:chat-tabs:${key}`;

const readPersistedState = (key: string): PersistedState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(persistStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed?.v !== 1 || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writePersistedState = (key: string, state: PersistedState): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(persistStorageKey(key), JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — non-fatal.
  }
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  createSession,
  modes,
  profiles,
  models,
  defaults = {},
  currentRun,
  onOpenContextPicker,
  context = [],
  onRemoveContext,
  onOpenContextArtifact,
  connected = true,
  persistKey,
}) => {
  // ── Tab state ─────────────────────────────────────────────────────
  // Tabs live in a single array; the active tab is tracked separately
  // so closing a tab can fall back to a sibling without resetting state.
  // Resize + collapse. Persisted under `agentable-orch:chatpanel` so
  // the user's preferred width survives reloads.
  const sidebar = useResizableSidebar({
    side: "right",
    defaultWidth: CHAT_DEFAULT_WIDTH,
    minWidth: CHAT_MIN_WIDTH,
    maxWidth: CHAT_MAX_WIDTH,
    collapsedWidth: CHAT_COLLAPSED_WIDTH,
    storageKey: "agentable-orch:chatpanel",
  });

  // Read persisted tab list once on mount. When present, hydrate the
  // panel from it; otherwise fall back to the auto-initial tab.
  const persisted = React.useMemo(
    () => (persistKey ? readPersistedState(persistKey) : null),
    // persistKey is stable per-user; intentional one-shot hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const initial = React.useMemo(
    () => initialTabDescriptor(defaults, currentRun ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [tabs, setTabs] = React.useState<InternalTab[]>(() => {
    const buildTab = (desc: ChatTabDescriptor): InternalTab => ({
      ...desc,
      session: createSession(desc),
      mode: desc.mode ?? defaults.mode ?? "agent",
      profile: desc.profile ?? defaults.profile ?? profiles[0]?.id ?? "",
      model: desc.model ?? defaults.model ?? models[0]?.id ?? "",
      messages: [],
      messageAttachments: {},
      sending: false,
      streamingText: "",
      input: "",
      showSettings: false,
      customPrompt: "",
      pendingAttachments: [],
    });
    if (persisted && persisted.tabs.length > 0) {
      return persisted.tabs.map((p) =>
        buildTab({
          id: p.id,
          label: p.label,
          scope: p.scope,
          mode: p.mode,
          profile: p.profile,
          model: p.model,
          sessionId: p.sessionId,
        }),
      );
    }
    return [buildTab(initial)];
  });
  const [activeTabId, setActiveTabId] = React.useState<string>(() => {
    if (persisted?.activeTabId && persisted.tabs.some((t) => t.id === persisted.activeTabId)) {
      return persisted.activeTabId;
    }
    return persisted?.tabs[0]?.id ?? initial.id;
  });
  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // ── Restore persisted tab histories ───────────────────────────────
  // For each rehydrated tab whose session adapter exposes `restore()`,
  // pull the stored conversation from the worker so reload returns to
  // the same view (not a blank pane). Best-effort: a 404 just leaves
  // that tab empty.
  React.useEffect(() => {
    if (!persisted) return;
    let cancelled = false;
    persisted.tabs.forEach((p) => {
      if (!p.sessionId) return;
      setTabs((ts) => {
        const t = ts.find((x) => x.id === p.id);
        if (!t || !t.session.restore) return ts;
        // fire-and-forget; result merged via setTabs in the inner promise
        void t.session.restore(p.sessionId!).then((res) => {
          if (cancelled || !res) return;
          setTabs((ts2) =>
            ts2.map((x) => (x.id === p.id ? { ...x, messages: res.messages } : x)),
          );
        });
        return ts;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the host's currentRun changes, surface a pending hint button
  // that opens a fresh tab scoped to it. We do NOT auto-mutate any
  // existing tab — the user may have intentionally pinned a tab.
  const runTabAlreadyOpen = React.useMemo(() => {
    if (!currentRun?.runId) return false;
    return tabs.some((t) => t.scope?.runId === currentRun.runId);
  }, [tabs, currentRun]);

  const updateTab = React.useCallback(
    (id: string, patch: Partial<InternalTab>) => {
      setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [],
  );

  const openTab = React.useCallback(
    (descriptor: ChatTabDescriptor) => {
      // Don't duplicate a tab for the same scope+mode — switch to the
      // existing one instead. Heuristic: same scope.runId + mode.
      const existing = tabs.find(
        (t) =>
          t.scope?.runId === descriptor.scope?.runId &&
          (t.mode === descriptor.mode || !descriptor.mode),
      );
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
      const session = createSession(descriptor);
      const next: InternalTab = {
        ...descriptor,
        session,
        mode:
          descriptor.mode ??
          defaults.mode ??
          (conductorAvailable(descriptor.scope) ? "conductor" : "agent"),
        profile: descriptor.profile ?? defaults.profile ?? profiles[0]?.id ?? "",
        model: descriptor.model ?? defaults.model ?? models[0]?.id ?? "",
        messages: [],
        messageAttachments: {},
        sending: false,
        streamingText: "",
        input: "",
        showSettings: false,
        customPrompt: "",
        pendingAttachments: [],
      };
      setTabs((ts) => [...ts, next]);
      setActiveTabId(next.id);
    },
    [tabs, createSession, defaults, profiles, models],
  );

  const closeTab = React.useCallback(
    (id: string) => {
      setTabs((ts) => {
        if (ts.length <= 1) return ts; // keep at least one
        const idx = ts.findIndex((t) => t.id === id);
        const next = ts.filter((t) => t.id !== id);
        if (id === activeTabId) {
          // Activate the previous tab (or first if we removed index 0).
          const fallback = next[Math.max(0, idx - 1)] ?? next[0];
          setActiveTabId(fallback.id);
        }
        return next;
      });
    },
    [activeTabId],
  );

  // Scroll handling moved to <Conversation> — `use-stick-to-bottom`
  // pins the view to the latest message while honoring user scroll-up.

  // Patch the underlying session whenever the active tab's
  // mode/profile/model swaps. Fire-and-forget; host surfaces errors
  // via toasts.
  React.useEffect(() => {
    if (!active) return;
    void active.session.patch({ mode: active.mode, profile: active.profile, model: active.model }).catch(() => {});
  }, [active?.id, active?.mode, active?.profile, active?.model]);

  // Conductor mode is only meaningful inside a run or project scope.
  // If a tab is configured for conductor but its scope was dropped
  // (e.g. a persisted tab loaded on a fresh session, or a scope that
  // never existed), demote it to `agent` so the picker stays in sync.
  React.useEffect(() => {
    setTabs((ts) =>
      ts.map((t) =>
        t.mode === "conductor" && !conductorAvailable(t.scope) ? { ...t, mode: "agent" } : t,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist tab descriptors + active id to localStorage on every
  // structural change. Messages are NOT persisted client-side — the
  // worker owns history and we rehydrate via `adapter.restore()`.
  React.useEffect(() => {
    if (!persistKey) return;
    const snapshot: PersistedState = {
      v: 1,
      tabs: tabs.map((t) => ({
        id: t.id,
        label: t.label,
        scope: t.scope,
        mode: t.mode,
        profile: t.profile,
        model: t.model,
        sessionId: t.session.getSessionId?.() ?? undefined,
      })),
      activeTabId,
    };
    writePersistedState(persistKey, snapshot);
    // Re-derive on tab list, mode/profile/model swaps, message count
    // (proxy for "session id may have just been minted on first send"),
    // and active tab. Spell out the dependencies so React doesn't
    // re-run on unrelated state churn (e.g. typing in the input).
  }, [
    persistKey,
    activeTabId,
    tabs.length,
    tabs.map((t) => `${t.id}:${t.mode}:${t.profile}:${t.model}:${t.label}:${t.messages.length}`).join("|"),
  ]);

  // External command bus. The host fires `agentable-chat:command` to
  // drive the panel from a keyboard shortcut without prop drilling.
  // Supported actions:
  //   "new-tab"        — open a fresh conductor tab (or run-scoped if applicable)
  //   "close-tab"      — close the active tab
  //   "next-tab"       — switch to the next tab (wraps)
  //   "prev-tab"       — switch to the previous tab (wraps)
  //   "select-tab"     — switch to the tab at detail.index (0-based)
  //   "focus-input"    — focus the composer textarea on the active tab
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onCommand = (ev: Event) => {
      const e = ev as CustomEvent<{ action: string; index?: number }>;
      const a = e.detail?.action;
      if (a === "new-tab") {
        if (currentRun?.runId && !runTabAlreadyOpen) {
          openTab({
            id: `run:${currentRun.runId}:${newTabId()}`,
            label: currentRun.label ?? `Run · ${currentRun.runId.slice(-12)}`,
            scope: {
              runId: currentRun.runId,
              workspaceId: currentRun.workspaceId,
              projectId: currentRun.projectId,
            },
            mode: defaults.mode ?? "conductor",
            profile: defaults.profile,
            model: defaults.model,
          });
        } else {
          openTab({
            id: newTabId(),
            label: "Agent",
            mode: "agent",
            profile: defaults.profile,
            model: defaults.model,
          });
        }
      } else if (a === "close-tab") {
        if (active) closeTab(active.id);
      } else if (a === "next-tab" || a === "prev-tab") {
        if (tabs.length < 2) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const delta = a === "next-tab" ? 1 : -1;
        const next = tabs[(idx + delta + tabs.length) % tabs.length];
        if (next) setActiveTabId(next.id);
      } else if (a === "select-tab" && typeof e.detail?.index === "number") {
        const t = tabs[e.detail.index];
        if (t) setActiveTabId(t.id);
      } else if (a === "focus-input") {
        // Ensure the panel is expanded then focus the composer.
        window.dispatchEvent(
          new CustomEvent("agentable-sidebar:toggle", {
            detail: { key: "agentable-orch:chatpanel", force: "expand" },
          }),
        );
        requestAnimationFrame(() => {
          const ta = document.querySelector<HTMLTextAreaElement>("aside textarea");
          ta?.focus();
        });
      }
    };
    window.addEventListener("agentable-chat:command", onCommand);
    return () => window.removeEventListener("agentable-chat:command", onCommand);
  }, [tabs, activeTabId, active, currentRun, runTabAlreadyOpen, openTab, closeTab, defaults]);

  if (!active) return null;

  const modeDef = modes.find((m) => m.id === active.mode) ?? modes[0];
  const profileDef = profiles.find((p) => p.id === active.profile);
  const modelDef = models.find((m) => m.id === active.model);

  const setMode = (m: ChatMode) => updateTab(active.id, { mode: m });
  const setProfile = (p: string) => updateTab(active.id, { profile: p });
  const setModel = (m: string) => updateTab(active.id, { model: m });
  const setInput = (v: string) => updateTab(active.id, { input: v });
  const setShowSettings = (v: boolean) => updateTab(active.id, { showSettings: v });
  const setCustomPrompt = (v: string) => updateTab(active.id, { customPrompt: v });

  /**
   * Send a literal text string as a synthetic user turn. Used by the
   * Plan/Action/Question/Suggestion markers in the assistant's reply to
   * post a follow-up message back to the agent in response to a click
   * (e.g. "Run as coordinator" => sends "Execute the plan above…").
   */
  const sendText = async (text: string) => {
    if (!text.trim() || active.sending) return;
    const tabId = active.id;
    const userMsg = { role: "user" as const, text } as ChatMessage;
    updateTab(tabId, {
      sending: true,
      streamingText: "",
      messages: [...active.messages, userMsg],
    });
    const meta = { mode: active.mode, profile: active.profile, model: active.model };
    try {
      if (active.session.sendStream) {
        await active.session.sendStream(text, meta, (delta) => {
          setTabs((ts) =>
            ts.map((t) => (t.id === tabId ? { ...t, streamingText: t.streamingText + delta } : t)),
          );
        });
        setTabs((ts) =>
          ts.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  sending: false,
                  messages: [...t.messages, { role: "assistant", text: t.streamingText, meta } as ChatMessage],
                  streamingText: "",
                }
              : t,
          ),
        );
      } else {
        const reply = await active.session.send(text, meta);
        setTabs((ts) =>
          ts.map((t) =>
            t.id === tabId ? { ...t, sending: false, messages: [...t.messages, reply] } : t,
          ),
        );
      }
    } catch (err) {
      setTabs((ts) =>
        ts.map((t) =>
          t.id === tabId
            ? {
                ...t,
                sending: false,
                streamingText: "",
                messages: [
                  ...t.messages,
                  {
                    role: "assistant",
                    text: `Failed to reach the orchestrator: ${err instanceof Error ? err.message : String(err)}`,
                    meta,
                  } as ChatMessage,
                ],
              }
            : t,
        ),
      );
    }
  };

  // ── Response action callbacks ────────────────────────────────────
  // Markers in the assistant's reply (Plan, Actions, Question, Suggestion)
  // post follow-up text on click. The agent picks up the new user turn
  // through the same SSE pipeline and decides what to do next.
  const onPlanRun = (plan: { title?: string; steps: { title: string }[]; planId?: string }) => {
    const stepList = plan.steps.map((s, i) => `${i + 1}. ${s.title}`).join("\n");
    void sendText(
      `Execute this plan as the coordinator. Use the run lifecycle tools (create_run, run_phases) to dispatch the work, and report progress with tool cards as you go.\n\nPlan: ${plan.title ?? "(untitled)"}\n${stepList}`,
    );
  };
  const onPlanRefine = (plan: { title?: string }) => {
    void sendText(`Refine the plan "${plan.title ?? "(untitled)"}" — what would you adjust before running it?`);
  };
  const onAction = (a: { id: string; label: string; payload?: unknown }) => {
    if (a.id === "run-plan") {
      void sendText("Execute the plan above using the orchestration tools.");
    } else if (a.id === "refine") {
      void sendText("Walk me through how you'd refine the plan above.");
    } else if (a.id === "cancel") {
      void sendText("Cancel that — let's go a different direction.");
    } else {
      void sendText(`[${a.label}]`);
    }
  };
  const onQuestionAnswer = (answer: string, label: string) => {
    void sendText(label === answer ? answer : `${label} (${answer})`);
  };
  const onSuggest = (s: string) => {
    void sendText(s);
  };
  const onHitmApprove = (phaseId: string) => {
    void sendText(`Approve phase ${phaseId} — call approve_phase_hitm with approved=true.`);
  };
  const onHitmReject = (phaseId: string) => {
    void sendText(`Reject phase ${phaseId} — call approve_phase_hitm with approved=false and a reason.`);
  };

  const send = async () => {
    if ((!active.input.trim() && active.pendingAttachments.length === 0) || active.sending) return;
    const text = active.input;
    const tabId = active.id;
    const userAttachments = active.pendingAttachments.filter((a) => a.status === "ready");
    const userMsg = { role: "user" as const, text } as ChatMessage;

    // Stage the user message + attachment manifest for that message.
    updateTab(tabId, {
      input: "",
      sending: true,
      streamingText: "",
      messages: [...active.messages, userMsg],
      messageAttachments: {
        ...active.messageAttachments,
        [active.messages.length]: userAttachments,
      },
      // Clear pending — only send `ready` files; uploading-in-flight stay.
      pendingAttachments: active.pendingAttachments.filter((a) => a.status !== "ready"),
    });

    const meta = { mode: active.mode, profile: active.profile, model: active.model };

    try {
      // Prefer the streaming path when the adapter supports it. Each
      // delta is appended to the tab's `streamingText`; the Response
      // renderer in the message list reads that field for the
      // last-message-on-the-fly view.
      if (active.session.sendStream) {
        await active.session.sendStream(text, meta, (delta) => {
          setTabs((ts) =>
            ts.map((t) => (t.id === tabId ? { ...t, streamingText: t.streamingText + delta } : t)),
          );
        });
        // On stream done, fold the accumulator into a real assistant
        // ChatMessage so it persists in the history list and clears
        // the live "streaming" view.
        setTabs((ts) =>
          ts.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  sending: false,
                  messages: [
                    ...t.messages,
                    { role: "assistant", text: t.streamingText, meta } as ChatMessage,
                  ],
                  streamingText: "",
                }
              : t,
          ),
        );
      } else {
        const reply = await active.session.send(text, meta);
        setTabs((ts) =>
          ts.map((t) =>
            t.id === tabId ? { ...t, sending: false, messages: [...t.messages, reply] } : t,
          ),
        );
      }
    } catch (err) {
      setTabs((ts) =>
        ts.map((t) =>
          t.id === tabId
            ? {
                ...t,
                sending: false,
                streamingText: "",
                messages: [
                  ...t.messages,
                  {
                    role: "assistant",
                    text: `Failed to reach the orchestrator: ${err instanceof Error ? err.message : String(err)}`,
                    meta,
                  } as ChatMessage,
                ],
              }
            : t,
        ),
      );
    }
  };

  // ── File / attachment handling ────────────────────────────────────
  // Upload happens AS-SOON-AS files are added (drag-drop, paste, or
  // file-picker), so by the time the user hits send the keys are
  // already on the session. Per-file lifecycle: uploading → ready
  // (or failed). Failed files surface a tooltip with the error.
  const addFiles = React.useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      if (!active.session.upload) return; // adapter doesn't support uploads
      const tabId = active.id;
      const staged: AttachmentItem[] = list.map((f) => ({
        id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        mime: f.type || undefined,
        size: f.size,
        status: "uploading",
      }));
      setTabs((ts) =>
        ts.map((t) => (t.id === tabId ? { ...t, pendingAttachments: [...t.pendingAttachments, ...staged] } : t)),
      );
      list.forEach((file, idx) => {
        const id = staged[idx].id;
        active.session
          .upload!(file)
          .then(({ key, label }) => {
            setTabs((ts) =>
              ts.map((t) =>
                t.id === tabId
                  ? {
                      ...t,
                      pendingAttachments: t.pendingAttachments.map((a) =>
                        a.id === id ? { ...a, status: "ready", key, name: label ?? a.name } : a,
                      ),
                    }
                  : t,
              ),
            );
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            setTabs((ts) =>
              ts.map((t) =>
                t.id === tabId
                  ? {
                      ...t,
                      pendingAttachments: t.pendingAttachments.map((a) =>
                        a.id === id ? { ...a, status: "failed", error: message } : a,
                      ),
                    }
                  : t,
              ),
            );
          });
      });
    },
    [active],
  );

  const removeAttachment = React.useCallback(
    (id: string) => {
      const tabId = active.id;
      setTabs((ts) =>
        ts.map((t) =>
          t.id === tabId ? { ...t, pendingAttachments: t.pendingAttachments.filter((a) => a.id !== id) } : t,
        ),
      );
    },
    [active.id],
  );

  // Drag-drop on the panel + hidden file input ref.
  const [dragging, setDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const onPanelDragOver = (e: React.DragEvent<HTMLElement>) => {
    if (!active.session.upload) return;
    if (e.dataTransfer?.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!dragging) setDragging(true);
    }
  };
  const onPanelDragLeave = (e: React.DragEvent<HTMLElement>) => {
    // Only clear when leaving the aside entirely, not on child enter/leave.
    if (e.currentTarget === e.target) setDragging(false);
  };
  const onPanelDrop = (e: React.DragEvent<HTMLElement>) => {
    if (!active.session.upload) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
    setDragging(false);
  };

  // Collapsed: thin vertical strip with chat icon + outward chevron.
  // Click anywhere expands. Mirrors the LeftRail collapsed pattern so
  // both edges of the shell read with the same visual grammar.
  if (sidebar.collapsed) {
    return (
      <aside
        style={{
          width: sidebar.width,
          flexShrink: 0,
          background: "var(--bg-app)",
          borderLeft: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 0",
          position: "relative",
        }}
      >
        <button
          onClick={sidebar.toggleCollapse}
          title="Expand chat sidebar"
          aria-label="Expand chat sidebar"
          style={{
            width: 28,
            height: 28,
            borderRadius: 5,
            display: "grid",
            placeItems: "center",
            color: "var(--fg-muted)",
            cursor: "pointer",
            background: "transparent",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
        >
          {/* Chevron points LEFT to indicate "expand to the left". */}
          <Icon name="chright" size={14} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button
          onClick={sidebar.toggleCollapse}
          title="Conductor chat (collapsed) — click to expand"
          aria-label="Conductor chat (collapsed) — click to expand"
          style={{
            marginTop: 6,
            flex: 1,
            width: "100%",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            color: "var(--fg-faint)",
            background: "transparent",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
        >
          <Icon name="chat" size={14} />
        </button>
        {/* Status dot pinned at the bottom — mirrors LeftRail's
            collapsed-mode health indicator placement. */}
        <span
          title={connected ? "Chat session ready" : "Chat session offline"}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: connected ? "var(--positive)" : "var(--fg-ghost)",
            boxShadow: connected ? "0 0 0 3px var(--positive-soft)" : "none",
            marginBottom: 8,
          }}
        />
        {/* Resize handle stays active while collapsed — pulling on it
            expands AND sets the new width in a single drag. */}
        <div
          {...sidebar.handleProps}
          style={{
            position: "absolute",
            top: 0,
            left: -2,
            bottom: 0,
            width: 5,
            cursor: "col-resize",
            zIndex: 10,
            background: "transparent",
            touchAction: "none",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = "inset 1px 0 0 0 var(--accent)";
          }}
          onMouseLeave={(e) => {
            if (!sidebar.dragging)
              (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          }}
        />
      </aside>
    );
  }

  return (
    <aside
      onDragOver={onPanelDragOver}
      onDragLeave={onPanelDragLeave}
      onDrop={onPanelDrop}
      style={{
        width: sidebar.width,
        flexShrink: 0,
        background: "var(--bg-app)",
        borderLeft: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        outline: dragging ? "2px dashed var(--accent)" : "none",
        outlineOffset: -2,
      }}
    >
      {/* ── Tab strip ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 0,
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-sunken)",
          minHeight: 30,
          paddingRight: 4,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", flex: 1, minWidth: 0, overflowX: "auto" }}>
          {tabs.map((tab) => {
            const on = tab.id === active.id;
            const scopedToCurrent = currentRun?.runId && tab.scope?.runId === currentRun.runId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 8px 0 10px",
                  cursor: "pointer",
                  background: on ? "var(--bg-app)" : "transparent",
                  borderRight: "1px solid var(--border-subtle)",
                  borderBottom: on ? "2px solid var(--accent)" : "2px solid transparent",
                  fontSize: 11.5,
                  color: on ? "var(--fg-strong)" : "var(--fg-muted)",
                  fontFamily: tab.scope?.runId ? "var(--font-mono)" : "var(--font-sans)",
                  fontWeight: on ? 500 : 400,
                  flexShrink: 0,
                  maxWidth: 180,
                  whiteSpace: "nowrap",
                  position: "relative",
                }}
              >
                {scopedToCurrent && (
                  <span
                    title="Scoped to the currently-open run"
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      background: "var(--accent)",
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </span>
                {tabs.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    title="Close tab"
                    style={{
                      width: 14,
                      height: 14,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 3,
                      color: "var(--fg-ghost)",
                      fontSize: 13,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLSpanElement).style.background = "var(--bg-hover)";
                      (e.currentTarget as HTMLSpanElement).style.color = "var(--fg-base)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLSpanElement).style.background = "transparent";
                      (e.currentTarget as HTMLSpanElement).style.color = "var(--fg-ghost)";
                    }}
                  >
                    ×
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* Collapse chevron — placed in the tab strip's right gutter
            alongside the "+ New chat" button so all panel-level chrome
            sits in one place (Hick's Law: fewer scan zones). Chevron
            points RIGHT to indicate "collapse to the right". */}
        <button
          title="Collapse chat sidebar"
          aria-label="Collapse chat sidebar"
          onClick={sidebar.toggleCollapse}
          style={{
            width: 28,
            height: 28,
            alignSelf: "center",
            borderRadius: 4,
            display: "grid",
            placeItems: "center",
            color: "var(--fg-faint)",
            cursor: "pointer",
            flexShrink: 0,
            background: "transparent",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
        >
          <Icon name="chright" size={13} />
        </button>
        <button
          title="New chat"
          onClick={() => {
            // If there's a current run and no tab for it, open one
            // scoped to it (conductor by default — that's the
            // mode that makes sense with run state). Otherwise,
            // conductor is unavailable, so a fresh tab opens as
            // a general-purpose agent chat.
            if (currentRun?.runId && !runTabAlreadyOpen) {
              openTab({
                id: `run:${currentRun.runId}:${newTabId()}`,
                label: currentRun.label ?? `Run · ${currentRun.runId.slice(-12)}`,
                scope: {
                  runId: currentRun.runId,
                  workspaceId: currentRun.workspaceId,
                  projectId: currentRun.projectId,
                },
                mode: defaults.mode ?? "conductor",
                profile: defaults.profile,
                model: defaults.model,
              });
            } else {
              openTab({
                id: newTabId(),
                label: "Agent",
                mode: "agent",
                profile: defaults.profile,
                model: defaults.model,
              });
            }
          }}
          style={{
            width: 28,
            height: 28,
            alignSelf: "center",
            borderRadius: 4,
            display: "grid",
            placeItems: "center",
            color: "var(--fg-faint)",
            cursor: "pointer",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
        >
          <Icon name="plus" size={13} />
        </button>
      </div>

      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{modeDef?.icon}</span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--fg-strong)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {modeDef?.label}
              {active.scope?.runId && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: "1px 6px",
                    borderRadius: 999,
                    fontSize: 9.5,
                    fontFamily: "var(--font-mono)",
                    background: "var(--accent-soft)",
                    color: "var(--accent-fg)",
                    fontWeight: 500,
                    letterSpacing: ".02em",
                  }}
                >
                  {active.scope.runId.length > 16 ? `…${active.scope.runId.slice(-14)}` : active.scope.runId}
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: "var(--fg-faint)",
                fontFamily: "var(--font-mono)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {profileDef?.label} · {modelDef?.label}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(!active.showSettings)}
            title="Configure"
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              display: "grid",
              placeItems: "center",
              color: active.showSettings ? "var(--fg-strong)" : "var(--fg-muted)",
              background: active.showSettings ? "var(--bg-active)" : "transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!active.showSettings) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (!active.showSettings) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <Icon name="sliders" size={13} />
          </button>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10.5,
              color: connected ? "var(--positive-fg)" : "var(--fg-faint)",
              fontFamily: "var(--font-mono)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: connected ? "var(--positive)" : "var(--fg-ghost)",
                boxShadow: connected ? "0 0 0 2px var(--positive-soft)" : "none",
              }}
            ></span>
            {connected ? "ready" : "offline"}
          </span>
        </div>

        {/* Suggestion: if currentRun is set but no tab is scoped to it, offer a quick-open. */}
        {currentRun?.runId && !runTabAlreadyOpen && (
          <button
            onClick={() =>
              openTab({
                id: `run:${currentRun.runId}`,
                label: currentRun.label ?? `Run · ${currentRun.runId.slice(-12)}`,
                scope: {
                  runId: currentRun.runId,
                  workspaceId: currentRun.workspaceId,
                  projectId: currentRun.projectId,
                },
                mode: "conductor",
              })
            }
            style={{
              marginTop: 8,
              width: "100%",
              padding: "5px 8px",
              borderRadius: 5,
              background: "var(--accent-soft)",
              color: "var(--accent-fg)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: "1px dashed var(--accent)",
            }}
          >
            <Icon name="plus" size={11} />
            <span>
              Open conductor scoped to{" "}
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {currentRun.runId.length > 22 ? `…${currentRun.runId.slice(-20)}` : currentRun.runId}
              </span>
            </span>
          </button>
        )}

        <div
          style={{
            display: "flex",
            gap: 2,
            marginTop: 8,
            padding: 2,
            background: "var(--bg-sunken)",
            borderRadius: 6,
          }}
        >
          {modes
            .filter((m) => m.id !== "conductor" || conductorAvailable(active.scope))
            .map((m) => {
            const on = m.id === active.mode;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id as ChatMode)}
                title={m.blurb}
                style={{
                  flex: 1,
                  padding: "4px 4px",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: on ? "var(--bg-panel)" : "transparent",
                  boxShadow: on ? "0 1px 1px rgba(0,0,0,.04)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  fontSize: 11,
                  color: on ? "var(--fg-strong)" : "var(--fg-muted)",
                  fontWeight: on ? 500 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                <span style={{ fontSize: 12 }}>{m.icon}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {active.showSettings && modeDef && (
        <SettingsDrawer
          modeDef={modeDef}
          profile={active.profile}
          setProfile={setProfile}
          profiles={profiles}
          model={active.model}
          setModel={setModel}
          models={models}
          customPrompt={active.customPrompt}
          setCustomPrompt={setCustomPrompt}
        />
      )}

      {!active.showSettings && (
        <div
          style={{
            padding: "7px 12px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              color: "var(--fg-faint)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              marginRight: 2,
            }}
          >
            Context:
          </span>
          {context.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--fg-ghost)", fontStyle: "italic" }}>nothing pinned</span>
          )}
          {context.map((a) => (
            <button
              key={a.id}
              onClick={() => onOpenContextArtifact?.(a)}
              title="Open in viewer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 4px 2px 6px",
                borderRadius: 4,
                cursor: "pointer",
                background: "var(--bg-sunken)",
                border: "1px solid var(--border-subtle)",
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--fg-muted)",
                maxWidth: 200,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-strong)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sunken)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
              }}
            >
              <Icon
                name={ARTIFACT_KIND_ICON[a.kind] || "doc"}
                size={10}
                style={{ color: "var(--accent)", flexShrink: 0 }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveContext?.(a.id);
                }}
                style={{
                  width: 13,
                  height: 13,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 2,
                  color: "var(--fg-ghost)",
                  flexShrink: 0,
                }}
              >
                ×
              </span>
            </button>
          ))}
          <button
            title="Add context"
            onClick={() => onOpenContextPicker?.()}
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              color: "var(--fg-faint)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <Icon name="plus" size={11} />
          </button>
        </div>
      )}

      <Conversation>
        {active.messages.map((m, i) => {
          const atts = active.messageAttachments[i] ?? [];
          if (m.role === "user") {
            return (
              <Message
                key={i}
                from="user"
                footer={
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--fg-faint)",
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    you · just now
                  </div>
                }
              >
                {atts.length > 0 && <Attachments items={atts} compact />}
                <MessageContent from="user">{m.text}</MessageContent>
              </Message>
            );
          }
          if (m.role === "system") {
            return (
              <Message key={i} from="system">
                {m.text}
              </Message>
            );
          }
          // assistant
          const meta = m.meta;
          return (
            <Message
              key={i}
              from="assistant"
              header={
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: "var(--bg-sunken)",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      color: "var(--accent-fg)",
                      fontWeight: 600,
                    }}
                  >
                    {modeInitial(meta?.mode ?? active.mode)}
                  </div>
                  <span style={{ fontSize: 10.5, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                    {(modes.find((x) => x.id === (meta?.mode ?? active.mode))?.label ?? "orchestrator").toLowerCase()}
                  </span>
                  {meta && (
                    <>
                      <span style={{ fontSize: 10, color: "var(--fg-ghost)" }}>·</span>
                      <span style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                        {profiles.find((p) => p.id === meta.profile)?.label ?? ""} ·{" "}
                        {models.find((mm) => mm.id === meta.model)?.label ?? ""}
                      </span>
                    </>
                  )}
                </div>
              }
            >
              <MessageContent from="assistant">
                <Response
                  onPlanRun={onPlanRun}
                  onPlanRefine={onPlanRefine}
                  onAction={onAction}
                  onQuestionAnswer={onQuestionAnswer}
                  onSuggest={onSuggest}
                  onHitmApprove={onHitmApprove}
                  onHitmReject={onHitmReject}
                >
                  {m.text}
                </Response>
              </MessageContent>
            </Message>
          );
        })}

        {/* Live-streaming assistant message — rendered at the tail
            while `sending` is true and we have at least one delta. */}
        {active.sending && active.streamingText.length > 0 && (
          <Message
            from="assistant"
            header={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: "var(--bg-sunken)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    color: "var(--accent-fg)",
                    fontWeight: 600,
                  }}
                >
                  {modeInitial(active.mode)}
                </div>
                <span style={{ fontSize: 10.5, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                  streaming…
                </span>
              </div>
            }
          >
            <MessageContent from="assistant">
              <Response
                streaming
                onPlanRun={onPlanRun}
                onPlanRefine={onPlanRefine}
                onAction={onAction}
                onQuestionAnswer={onQuestionAnswer}
                onSuggest={onSuggest}
                onHitmApprove={onHitmApprove}
                onHitmReject={onHitmReject}
              >
                {active.streamingText}
              </Response>
            </MessageContent>
          </Message>
        )}

        {active.sending && active.streamingText.length === 0 && (
          <Message from="assistant">
            <MessageContent from="assistant" style={{ padding: "8px 12px" }}>
              <Loader label="thinking" />
            </MessageContent>
          </Message>
        )}
      </Conversation>

      <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 4 }}>
        {modeDef?.suggestions.slice(0, 2).map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 999,
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-subtle)",
              color: "var(--fg-muted)",
              cursor: "pointer",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sunken)")}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 10 }}>
        <div
          style={{
            background: "var(--bg-panel)",
            border: dragging ? "1px dashed var(--accent)" : "1px solid var(--border-base)",
            borderRadius: 8,
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {/* Staged + uploaded attachments — chip row above the textarea. */}
          {active.pendingAttachments.length > 0 && (
            <Attachments items={active.pendingAttachments} onRemove={removeAttachment} compact />
          )}

          <textarea
            value={active.input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
            }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files ?? []);
              if (files.length > 0) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            placeholder={
              active.mode === "conductor"
                ? active.scope?.runId
                  ? `Ask the conductor about this run…`
                  : "Ask the conductor — e.g. 'list recent runs'"
                : active.mode === "agent"
                  ? "Ask the agent — anything about this project"
                  : active.mode === "workflow-builder"
                    ? "Describe a workflow to build (attach a doc to ground it)…"
                    : "Describe what you want to plan…"
            }
            rows={2}
            style={{
              border: 0,
              outline: "none",
              resize: "none",
              width: "100%",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--fg-base)",
              background: "transparent",
              padding: 2,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Attach button — hidden when adapter doesn't expose
                upload(). Hidden file input pattern, same as NewRunModal. */}
            {active.session.upload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = ""; // allow re-picking the same file
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  aria-label="Attach file"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--fg-muted)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                >
                  <Icon name="plus" size={13} />
                </button>
              </>
            )}
            <button
              onClick={() => void send()}
              disabled={(!active.input.trim() && active.pendingAttachments.filter((a) => a.status === "ready").length === 0) || active.sending}
              style={{
                marginLeft: "auto",
                padding: "5px 10px",
                borderRadius: 5,
                background: (active.input.trim() || active.pendingAttachments.some((a) => a.status === "ready")) && !active.sending ? "var(--accent)" : "var(--bg-sunken)",
                color: (active.input.trim() || active.pendingAttachments.some((a) => a.status === "ready")) && !active.sending ? "var(--fg-on-accent)" : "var(--fg-ghost)",
                fontSize: 12,
                fontWeight: 500,
                cursor: (active.input.trim() || active.pendingAttachments.some((a) => a.status === "ready")) && !active.sending ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>Send</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.7 }}>⌘↵</span>
            </button>
          </div>
        </div>
      </div>

      {/* Resize handle — 5px hit strip on the LEFT edge (mirrors
          LeftRail's right-edge handle so both panel boundaries behave
          identically). Invisible at rest; flashes a 1px accent line on
          hover/drag for discoverability without adding chrome. */}
      <div
        {...sidebar.handleProps}
        style={{
          position: "absolute",
          top: 0,
          left: -2,
          bottom: 0,
          width: 5,
          cursor: "col-resize",
          zIndex: 10,
          background: "transparent",
          touchAction: "none",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "inset 1px 0 0 0 var(--accent)";
        }}
        onMouseLeave={(e) => {
          if (!sidebar.dragging)
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      />
    </aside>
  );
};
