import * as React from "react";

export interface ProfileOption {
  id: string;
  label: string;
  note: string;
}

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  note: string;
}

export interface ChatModeDef {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  canRunWorkflows: boolean;
  canChat: boolean;
  canEmitArtifacts: boolean;
  suggestions: string[];
}

export interface SettingsDrawerProps {
  modeDef: ChatModeDef;
  profile: string;
  setProfile: (p: string) => void;
  profiles: ProfileOption[];
  model: string;
  setModel: (m: string) => void;
  models: ModelOption[];
  customPrompt: string;
  setCustomPrompt: (p: string) => void;
}

const Cap: React.FC<{ on: boolean; label: string }> = ({ on, label }) => (
  <span
    style={{
      fontSize: 10.5,
      padding: "2px 7px",
      borderRadius: 999,
      fontFamily: "var(--font-mono)",
      color: on ? "var(--positive-fg)" : "var(--fg-ghost)",
      background: on ? "var(--positive-soft)" : "var(--bg-sunken)",
      border: `1px solid ${on ? "transparent" : "var(--border-subtle)"}`,
      textDecoration: on ? "none" : "line-through",
    }}
  >
    {on ? "✓ " : ""}
    {label}
  </span>
);

const Capabilities: React.FC<{ def: ChatModeDef }> = ({ def }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
    <Cap on={def.canChat} label="chat" />
    <Cap on={def.canRunWorkflows} label="dispatch workflows" />
    <Cap on={def.canEmitArtifacts} label="emit artifacts" />
  </div>
);

const SettingGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div
      style={{
        fontSize: 10.5,
        fontFamily: "var(--font-mono)",
        color: "var(--fg-faint)",
        textTransform: "uppercase",
        letterSpacing: ".06em",
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  modeDef,
  profile,
  setProfile,
  profiles,
  model,
  setModel,
  models,
  customPrompt,
  setCustomPrompt,
}) => (
  <div
    style={{
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-canvas)",
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      maxHeight: 380,
      overflow: "auto",
    }}
  >
    <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.45 }}>
      <span style={{ fontWeight: 500, color: "var(--fg-strong)" }}>{modeDef.label} mode.</span> {modeDef.blurb}
    </div>

    <Capabilities def={modeDef} />

    <SettingGroup label="Subagent profile">
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {profiles.map((p) => {
          const on = p.id === profile;
          return (
            <button
              key={p.id}
              onClick={() => setProfile(p.id)}
              style={{
                padding: "6px 8px",
                borderRadius: 5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: on ? "var(--bg-active)" : "transparent",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (!on) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!on) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  flexShrink: 0,
                  border: `2px solid ${on ? "var(--accent)" : "var(--border-base)"}`,
                  background: on ? "radial-gradient(circle, var(--accent) 35%, transparent 40%)" : "transparent",
                }}
              ></span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  color: on ? "var(--fg-strong)" : "var(--fg-base)",
                  fontWeight: on ? 500 : 400,
                  flexShrink: 0,
                }}
              >
                {p.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--fg-faint)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {p.note}
              </span>
            </button>
          );
        })}
      </div>
      {profile === "custom" && (
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="System prompt for the custom subagent…"
          rows={4}
          style={{
            marginTop: 6,
            width: "100%",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            padding: "6px 8px",
            borderRadius: 5,
            background: "var(--bg-panel)",
            border: "1px solid var(--border-base)",
            color: "var(--fg-base)",
            outline: "none",
            resize: "vertical",
          }}
        />
      )}
    </SettingGroup>

    <SettingGroup label="Model">
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {models.map((m) => {
          const on = m.id === model;
          return (
            <button
              key={m.id}
              onClick={() => setModel(m.id)}
              style={{
                padding: "6px 8px",
                borderRadius: 5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: on ? "var(--bg-active)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!on) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!on) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  flexShrink: 0,
                  border: `2px solid ${on ? "var(--accent)" : "var(--border-base)"}`,
                  background: on ? "radial-gradient(circle, var(--accent) 35%, transparent 40%)" : "transparent",
                }}
              ></span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  color: on ? "var(--fg-strong)" : "var(--fg-base)",
                  fontWeight: on ? 500 : 400,
                  flexShrink: 0,
                }}
              >
                {m.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--fg-faint)", flexShrink: 0 }}>· {m.provider}</span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--fg-faint)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  textAlign: "right",
                }}
              >
                {m.note}
              </span>
            </button>
          );
        })}
      </div>
    </SettingGroup>
  </div>
);
