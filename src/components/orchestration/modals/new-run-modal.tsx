import * as React from "react";
import { Icon } from "../../general";
import { ModalShell } from "./modal-shell";
import type { Workspace, Project } from "../types";

export interface NewRunWorkflowInput {
  id: string;
  label: string;
  kind: "files" | "text" | "number" | "toggle" | "artifact";
  help?: string;
  required?: boolean;
  placeholder?: string;
  default?: number | string | boolean;
  min?: number;
  max?: number;
  artifactKind?: "yaml" | "tldraw" | "markdown";
}

export interface NewRunWorkflowDef {
  id: string;
  name: string;
  emoji: string;
  binding: string | null;
  blurb: string;
  avgRuntime: string;
  iterations: string;
  planned?: boolean;
  inputs: NewRunWorkflowInput[];
  suggestions: string[];
}

export interface NewRunPayload {
  clientId: string;
  projectId: string;
  workflow: NewRunWorkflowDef;
  config: Record<string, unknown>;
  mode: "choice" | "chat";
  chatPrompt: string | null;
}

export interface NewRunModalProps {
  client: Workspace;
  project: Project;
  workflows: NewRunWorkflowDef[];
  onClose: () => void;
  onKickoff: (payload: NewRunPayload) => void;
}

type Step = "pick" | "configure" | "kickoff";

const Step: React.FC<{ label: string; on: boolean; done?: boolean; disabled?: boolean; onClick: () => void }> = ({
  label,
  on,
  done,
  disabled,
  onClick,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "3px 8px",
      borderRadius: 4,
      cursor: disabled ? "default" : "pointer",
      background: on ? "var(--bg-active)" : "transparent",
      color: on ? "var(--fg-strong)" : done ? "var(--fg-muted)" : "var(--fg-faint)",
      fontWeight: on ? 500 : 400,
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {done && !on ? "✓ " : ""}
    {label}
  </button>
);

const KickTab: React.FC<{ on: boolean; onClick: () => void; icon: React.ComponentProps<typeof Icon>["name"]; label: string }> = ({
  on,
  onClick,
  icon,
  label,
}) => (
  <button
    onClick={onClick}
    style={{
      padding: "5px 12px",
      borderRadius: 4,
      fontSize: 12,
      cursor: "pointer",
      background: on ? "var(--bg-panel)" : "transparent",
      color: on ? "var(--fg-strong)" : "var(--fg-muted)",
      fontWeight: on ? 500 : 400,
      boxShadow: on ? "0 1px 1px rgba(0,0,0,.04)" : "none",
      display: "flex",
      alignItems: "center",
      gap: 5,
    }}
  >
    <Icon name={icon} size={11} />
    <span>{label}</span>
  </button>
);

function fmtValue(inp: NewRunWorkflowInput, v: unknown): React.ReactNode {
  if (v === undefined || v === null || v === "") {
    return <span style={{ color: "var(--fg-ghost)" }}>{(inp.default as React.ReactNode) ?? "—"}</span>;
  }
  if (inp.kind === "toggle") return v ? "on" : "off";
  if (inp.kind === "files") return Array.isArray(v) ? `${v.length} file${v.length === 1 ? "" : "s"}` : "—";
  return String(v);
}

const Field: React.FC<{ inp: NewRunWorkflowInput; value: unknown; onChange: (v: unknown) => void }> = ({
  inp,
  value,
  onChange,
}) => {
  const wrap = (children: React.ReactNode) => (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <label style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg-strong)" }}>{inp.label}</label>
        {inp.required && <span style={{ fontSize: 10, color: "var(--negative)" }}>required</span>}
      </div>
      {children}
      {inp.help && <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 3 }}>{inp.help}</div>}
    </div>
  );

  if (inp.kind === "files") {
    const files = Array.isArray(value) ? (value as File[]) : [];
    return wrap(
      <div>
        <label
          style={{
            padding: "16px 14px",
            borderRadius: 6,
            border: "1px dashed var(--border-base)",
            background: "var(--bg-sunken)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12.5,
            color: "var(--fg-muted)",
            cursor: "pointer",
          }}
        >
          <Icon name="artifact" size={14} style={{ color: "var(--fg-faint)" }} />
          <span>{files.length === 0 ? "Click to choose files (.md, .txt, .csv supported)" : `${files.length} file${files.length === 1 ? "" : "s"} selected`}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--fg-faint)" }}>
            {files.length > 0 ? files.map((f) => f.name).join(", ").slice(0, 40) : "none"}
          </span>
          <input
            type="file"
            multiple
            accept=".md,.txt,.csv,.json,.yaml,.yml,text/*"
            style={{ display: "none" }}
            onChange={(e) => onChange(Array.from(e.target.files ?? []))}
          />
        </label>
        {files.length > 0 && (
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {files.map((f, i) => (
              <li
                key={i}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--fg-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="doc" size={11} style={{ color: "var(--accent)" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <span style={{ color: "var(--fg-ghost)" }}>· {(f.size / 1024).toFixed(1)} kb</span>
              </li>
            ))}
          </ul>
        )}
      </div>,
    );
  }

  if (inp.kind === "artifact")
    return wrap(
      <button
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 6,
          cursor: "pointer",
          border: "1px solid var(--border-base)",
          background: "var(--bg-sunken)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12.5,
          color: "var(--fg-muted)",
          textAlign: "left",
        }}
      >
        <Icon
          name={inp.artifactKind === "tldraw" ? "board" : inp.artifactKind === "yaml" ? "yaml" : "doc"}
          size={13}
          style={{ color: "var(--accent)" }}
        />
        <span
          style={{
            color: value ? "var(--fg-strong)" : "var(--fg-faint)",
            fontFamily: value ? "var(--font-mono)" : "var(--font-sans)",
          }}
        >
          {(value as React.ReactNode) || `Pick ${inp.artifactKind} artifact…`}
        </span>
        <Icon name="chright" size={11} style={{ marginLeft: "auto", color: "var(--fg-faint)" }} />
      </button>,
    );

  if (inp.kind === "text")
    return wrap(
      <input
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={inp.placeholder}
        style={{
          width: "100%",
          padding: "6px 10px",
          borderRadius: 5,
          background: "var(--bg-sunken)",
          border: "1px solid var(--border-subtle)",
          fontSize: 12.5,
          color: "var(--fg-strong)",
          outline: "none",
          fontFamily: "var(--font-sans)",
        }}
      />,
    );

  if (inp.kind === "number") {
    const cur = (value as number) ?? (inp.default as number) ?? 0;
    return wrap(
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onChange(Math.max(inp.min ?? 0, cur - 1))}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            cursor: "pointer",
            color: "var(--fg-muted)",
            background: "var(--bg-sunken)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          −
        </button>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--fg-strong)",
            minWidth: 30,
            textAlign: "center",
          }}
        >
          {cur}
        </span>
        <button
          onClick={() => onChange(Math.min(inp.max ?? 99, cur + 1))}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            cursor: "pointer",
            color: "var(--fg-muted)",
            background: "var(--bg-sunken)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          +
        </button>
      </div>,
    );
  }

  if (inp.kind === "toggle")
    return wrap(
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          padding: 2,
          cursor: "pointer",
          background: value ? "var(--accent)" : "var(--border-base)",
          transition: "background .15s",
          display: "flex",
          alignItems: "center",
          justifyContent: value ? "flex-end" : "flex-start",
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 2px rgba(0,0,0,.15)",
          }}
        ></span>
      </button>,
    );

  return null;
};

const PickStep: React.FC<{
  workflows: NewRunWorkflowDef[];
  wfId: string | null;
  onPick: (id: string) => void;
}> = ({ workflows, wfId, onPick }) => {
  const [query, setQuery] = React.useState("");
  // Case-insensitive substring match across the fields a user is most
  // likely to remember: display name, the human blurb, and the worker
  // binding code (so power users can search by `INTENT_WORKFLOW` etc.).
  // Empty query falls through to the full catalog.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((w) => {
      return (
        w.name.toLowerCase().includes(q) ||
        w.blurb.toLowerCase().includes(q) ||
        (w.binding ?? "").toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q)
      );
    });
  }, [workflows, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: "0 0 6px", color: "var(--fg-muted)", fontSize: 13 }}>
        Pick a workflow to drive this run, or start a custom chat run.
      </p>
      <div
        style={{
          position: "relative",
          marginBottom: 4,
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workflows…"
          aria-label="Search workflows"
          autoFocus
          style={{
            width: "100%",
            padding: "8px 12px 8px 32px",
            borderRadius: 6,
            border: "1px solid var(--border-base)",
            background: "var(--bg-canvas)",
            color: "var(--fg-base)",
            fontSize: 13,
            outline: "none",
            fontFamily: "var(--font-sans)",
          }}
          onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)")}
          onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-base)")}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--fg-faint)",
            fontSize: 14,
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          🔍
        </span>
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              width: 20,
              height: 20,
              borderRadius: 4,
              background: "transparent",
              border: 0,
              color: "var(--fg-faint)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
      {filtered.length === 0 && (
        <div
          style={{
            padding: "16px 14px",
            textAlign: "center",
            color: "var(--fg-faint)",
            fontSize: 12.5,
            fontStyle: "italic",
            border: "1px dashed var(--border-subtle)",
            borderRadius: 8,
          }}
        >
          No workflows match "{query}"
        </div>
      )}
      {filtered.map((w) => {
      const on = w.id === wfId;
      return (
        <button
          key={w.id}
          onClick={() => onPick(w.id)}
          disabled={w.planned}
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            cursor: w.planned ? "default" : "pointer",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            textAlign: "left",
            background: on ? "var(--accent-soft)" : "var(--bg-canvas)",
            border: `1px solid ${on ? "var(--accent)" : "var(--border-subtle)"}`,
            opacity: w.planned ? 0.55 : 1,
          }}
          onMouseEnter={(e) => {
            if (!on && !w.planned) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-base)";
            }
          }}
          onMouseLeave={(e) => {
            if (!on && !w.planned) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-canvas)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)";
            }
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{w.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-strong)" }}>{w.name}</span>
              {w.binding && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--fg-faint)",
                    padding: "1px 5px",
                    background: "var(--bg-sunken)",
                    borderRadius: 3,
                  }}
                >
                  {w.binding}
                </span>
              )}
              {w.planned && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--warn-fg)",
                    padding: "1px 6px",
                    background: "var(--warn-soft)",
                    borderRadius: 3,
                    fontWeight: 500,
                  }}
                >
                  planned
                </span>
              )}
            </div>
            <p style={{ margin: "4px 0 6px", fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.45 }}>
              {w.blurb}
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                fontSize: 11,
                color: "var(--fg-faint)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span>⏱ {w.avgRuntime}</span>
              <span>↻ {w.iterations} iter</span>
              <span>📥 {w.inputs.length} input{w.inputs.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </button>
      );
    })}
    </div>
  );
};

const ConfigureStep: React.FC<{
  wf: NewRunWorkflowDef;
  config: Record<string, unknown>;
  setConfig: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}> = ({ wf, config, setConfig }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13 }}>
      Configure inputs for <span style={{ fontWeight: 500, color: "var(--fg-strong)" }}>{wf.name}</span>.
    </p>
    {wf.inputs.map((inp) => (
      <Field
        key={inp.id}
        inp={inp}
        value={config[inp.id]}
        onChange={(v) => setConfig((c) => ({ ...c, [inp.id]: v }))}
      />
    ))}
    {wf.inputs.length === 0 && (
      <div style={{ color: "var(--fg-faint)", fontSize: 12.5, fontStyle: "italic" }}>No configuration needed.</div>
    )}
  </div>
);

const KickoffStep: React.FC<{
  wf: NewRunWorkflowDef;
  config: Record<string, unknown>;
  chatDraft: string;
  setChatDraft: (s: string) => void;
  onLaunch: (mode: "choice" | "chat") => void;
}> = ({ wf, config, chatDraft, setChatDraft, onLaunch }) => {
  const [tab, setTab] = React.useState<"choice" | "chat">(wf.id === "custom" ? "chat" : "choice");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13 }}>
        Choose how to start the run.{" "}
        <span style={{ color: "var(--fg-faint)" }}>You can always switch to chat once it's running.</span>
      </p>

      <div
        style={{
          display: "flex",
          gap: 1,
          padding: 2,
          background: "var(--bg-sunken)",
          borderRadius: 6,
          alignSelf: "flex-start",
        }}
      >
        {wf.id !== "custom" && (
          <KickTab on={tab === "choice"} onClick={() => setTab("choice")} icon="play" label="Run as configured" />
        )}
        <KickTab on={tab === "chat"} onClick={() => setTab("chat")} icon="chat" label="Start with chat" />
      </div>

      {tab === "choice" && wf.id !== "custom" && (
        <div
          style={{
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--fg-faint)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              marginBottom: 10,
            }}
          >
            Summary
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>{wf.emoji}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-strong)" }}>{wf.name}</span>
            {wf.binding && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>
                {wf.binding}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "4px 12px", fontSize: 12.5 }}>
            {wf.inputs.map((inp) => (
              <React.Fragment key={inp.id}>
                <span style={{ color: "var(--fg-faint)" }}>{inp.label}</span>
                <span
                  style={{
                    color: "var(--fg-base)",
                    fontFamily:
                      inp.kind === "text" || inp.kind === "files" ? "var(--font-sans)" : "var(--font-mono)",
                  }}
                >
                  {fmtValue(inp, config[inp.id])}
                </span>
              </React.Fragment>
            ))}
            {wf.inputs.length === 0 && (
              <span style={{ gridColumn: "1 / -1", color: "var(--fg-faint)", fontStyle: "italic" }}>
                No inputs configured.
              </span>
            )}
          </div>
          <button
            onClick={() => onLaunch("choice")}
            style={{
              marginTop: 14,
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              background: "var(--accent)",
              color: "var(--fg-on-accent)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="play" size={12} />
            <span>Start run</span>
          </button>
        </div>
      )}

      {tab === "chat" && (
        <div
          style={{
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--fg-faint)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              marginBottom: 8,
            }}
          >
            Talk to the {wf.id === "custom" ? "agent" : "conductor"}
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.45 }}>
            {wf.id === "custom"
              ? "Describe what you want. The agent will plan, dispatch sub-workflows when useful, and emit artifacts as it goes."
              : "Open the run with a message. The conductor will fill the gaps in your config from the conversation, then dispatch the workflow."}
          </p>
          <textarea
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            placeholder={wf.suggestions[0] || "Describe what you'd like to do…"}
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 6,
              background: "var(--bg-panel)",
              border: "1px solid var(--border-base)",
              fontSize: 13,
              color: "var(--fg-base)",
              outline: "none",
              fontFamily: "var(--font-sans)",
              resize: "vertical",
            }}
          />
          {wf.suggestions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {wf.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setChatDraft(s)}
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: "var(--bg-sunken)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--fg-muted)",
                    cursor: "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => onLaunch("chat")}
            disabled={!chatDraft.trim()}
            style={{
              marginTop: 14,
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: chatDraft.trim() ? "pointer" : "default",
              background: chatDraft.trim() ? "var(--accent)" : "var(--bg-sunken)",
              color: chatDraft.trim() ? "var(--fg-on-accent)" : "var(--fg-ghost)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="chat" size={12} />
            <span>Start in chat</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const NewRunModal: React.FC<NewRunModalProps> = ({ client, project, workflows, onClose, onKickoff }) => {
  const [step, setStep] = React.useState<Step>("pick");
  const [wfId, setWfId] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<Record<string, unknown>>({});
  const [chatDraft, setChatDraft] = React.useState("");

  const wf = workflows.find((w) => w.id === wfId);

  React.useEffect(() => {
    if (wf) {
      const c: Record<string, unknown> = {};
      wf.inputs.forEach((inp) => {
        if (inp.default !== undefined) c[inp.id] = inp.default;
      });
      setConfig(c);
    }
  }, [wf]);

  const pickWorkflow = (id: string) => {
    setWfId(id);
    if (id === "custom") setStep("kickoff");
    else setStep("configure");
  };

  const launch = (mode: "choice" | "chat") => {
    if (!wf) return;
    onKickoff({
      clientId: client.id,
      projectId: project.id,
      workflow: wf,
      config,
      mode,
      chatPrompt: mode === "chat" ? chatDraft : null,
    });
    onClose();
  };

  return (
    <ModalShell onClose={onClose} width={760} maxHeight="86vh">
      <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="play" size={14} style={{ color: "var(--accent)" }} />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--fg-strong)" }}>New run</h2>
          <span
            style={{
              fontSize: 11.5,
              color: "var(--fg-faint)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            in{" "}
            <span style={{ color: "var(--fg-muted)" }}>
              {client.tag} · {project.name}
            </span>
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              width: 24,
              height: 24,
              borderRadius: 5,
              cursor: "pointer",
              color: "var(--fg-muted)",
              display: "grid",
              placeItems: "center",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <Icon name="close" size={13} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            marginTop: 12,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--fg-faint)",
          }}
        >
          <Step label="1 · Workflow" on={step === "pick"} done={step !== "pick"} onClick={() => setStep("pick")} />
          <Step
            label="2 · Configure"
            on={step === "configure"}
            done={step === "kickoff"}
            disabled={!wf || wf.id === "custom"}
            onClick={() => wf && wf.id !== "custom" && setStep("configure")}
          />
          <Step label="3 · Kick off" on={step === "kickoff"} disabled={!wf} onClick={() => wf && setStep("kickoff")} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "14px 18px" }}>
        {step === "pick" && <PickStep workflows={workflows} wfId={wfId} onPick={pickWorkflow} />}
        {step === "configure" && wf && <ConfigureStep wf={wf} config={config} setConfig={setConfig} />}
        {step === "kickoff" && wf && (
          <KickoffStep
            wf={wf}
            config={config}
            chatDraft={chatDraft}
            setChatDraft={setChatDraft}
            onLaunch={launch}
          />
        )}
      </div>

      <div
        style={{
          padding: "10px 18px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
          {wf ? (
            <>
              <span style={{ fontFamily: "var(--font-mono)" }}>{wf.binding || "chat-only"}</span> · {wf.avgRuntime} ·{" "}
              {wf.iterations} iter
            </>
          ) : (
            <>Pick a workflow to continue</>
          )}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: "6px 12px",
              borderRadius: 5,
              fontSize: 12,
              cursor: "pointer",
              color: "var(--fg-muted)",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            Cancel
          </button>
          {step === "pick" && (
            <button
              onClick={() => wf && (wf.id === "custom" ? setStep("kickoff") : setStep("configure"))}
              disabled={!wf || wf.planned}
              style={{
                padding: "6px 14px",
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 500,
                cursor: wf && !wf.planned ? "pointer" : "default",
                background: wf && !wf.planned ? "var(--accent)" : "var(--bg-sunken)",
                color: wf && !wf.planned ? "var(--fg-on-accent)" : "var(--fg-ghost)",
              }}
            >
              Continue
            </button>
          )}
          {step === "configure" && (
            <>
              <button
                onClick={() => setStep("pick")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 5,
                  fontSize: 12,
                  cursor: "pointer",
                  color: "var(--fg-muted)",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
              >
                Back
              </button>
              <button
                onClick={() => setStep("kickoff")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 5,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  background: "var(--accent)",
                  color: "var(--fg-on-accent)",
                }}
              >
                Continue
              </button>
            </>
          )}
          {step === "kickoff" && wf && wf.id !== "custom" && (
            <button
              onClick={() => setStep("configure")}
              style={{
                padding: "6px 12px",
                borderRadius: 5,
                fontSize: 12,
                cursor: "pointer",
                color: "var(--fg-muted)",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            >
              Back
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
