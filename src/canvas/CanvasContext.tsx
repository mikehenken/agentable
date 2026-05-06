/**
 * CanvasContext — tenant configuration injection for the OSS canvas.
 *
 * The OSS canvas core ships zero tenant-specific defaults. Brand voice,
 * system prompt, scenarios, etc. are injected by the consuming tenant
 * wrapper at the React root via `<CanvasProvider>`.
 *
 * Why context, not props-drilling:
 *   The persona is consumed by `<VoiceWidget>` 4 layers down from
 *   `<CanvasShell>`. Threading a `persona` prop through every panel makes
 *   adding panels expensive and breaks the "panels are independent" model
 *   used by `useLayoutStore`.
 *
 * Why context, not direct import:
 *   Persona / system prompt are tenant-owned. Importing them directly
 *   would couple the OSS canvas to a specific tenant package and prevent
 *   reuse. Context keeps the canvas a pure consumer of injected config.
 *
 * Default persona is intentionally generic — a publishable canvas should
 * still work out-of-the-box (with a no-op/demo persona) before a tenant
 * supplies one.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

/** Single starter-prompt chip rendered in the empty-state ChatPanel. */
export interface CanvasStarterPrompt {
  emoji: string;
  text: string;
}

/**
 * Tenant-overridable copy for canvas UI labels. Each field has a sensible
 * library default; embedders override only the labels they want changed.
 *
 * Per UX review: "Share" alone reads as "social share"; in a candidate
 * context, "Send to recruiter" is the right action label. Tenants can
 * configure label copy without forking the component.
 */
export interface CanvasLabels {
  /** Action on AI-generated artifacts. Default: "Share". */
  shareArtifact?: string;
  /** Action label for the chat send button (aria-label). Default: "Send message". */
  sendMessage?: string;
  /** Empty state heading on ArtifactsPanel. Default: "No artifacts yet". */
  emptyArtifacts?: string;
  /** Empty state body copy on ArtifactsPanel. */
  emptyArtifactsHint?: string;
}

export interface CanvasPersona {
  /**
   * System instruction passed to the voice model. Defines tone, vocabulary,
   * factual grounding, and conversational style.
   */
  systemPrompt: string;
  /**
   * Optional opening line spoken on call start. Falsy = model decides.
   */
  voiceGreeting?: string;
  /**
   * Display name surfaced in UI labels (e.g. "{name} is speaking").
   * Default "Assistant"; tenants supply a persona name via config.
   */
  assistantName?: string;
  /**
   * Tenant title used in panel headers + chat copy (e.g. "Career Concierge",
   * "Sales Coach", "Onboarding Guide"). Default "AI Assistant".
   */
  tenantTitle?: string;
  /**
   * Suggestion prompts shown in the empty-state ChatPanel as quick-start
   * chips. Tenant-specific. Empty array hides the chip section.
   */
  starterPrompts?: readonly CanvasStarterPrompt[];
  /**
   * Optional scripted scenario for mock voice mode. When set, the mock
   * client uses this instead of its built-in default. Tenants supply
   * a JSON scenario for offline / demo / CI playback.
   */
  mockScenario?: {
    id: string;
    greeting?: string;
    turns: ReadonlyArray<{
      text: string;
      durationMs: number;
      listenForMs?: number;
    }>;
  };
  /**
   * Gemini Live prebuilt voice name (e.g. `Aoede`). Optional — the voice
   * client defaults when unset.
   */
  geminiVoiceName?: string;
  /**
   * Backplane endpoint that mints ephemeral Gemini Live tokens. When set,
   * the voice transport fetches a fresh short-lived token at session start
   * instead of baking the long-lived `VITE_GEMINI_API_KEY` into the client
   * bundle. Pass the worker's full URL, e.g.
   * `https://your-canvas-token.workers.dev`. Production deployments should
   * always use this rather than `VITE_GEMINI_API_KEY`.
   */
  tokenEndpoint?: string;
}

/**
 * Tenant-overridable mock data for the example panels (Open Positions,
 * Applications, Growth Paths, Resources). Each field is optional — when
 * unset, the panel falls back to its library example data. Pass these
 * to surface tenant-specific roles, applications, ladders, or resources
 * without forking the panel components themselves.
 *
 * `unknown[]` is intentional here: the canvas doesn't enforce the panel
 * data shape at the context boundary — each panel defines its own
 * `Job` / `Application` / `Path` / `Resource` type and casts the array
 * at consumption. Tenants are responsible for matching the panel's
 * documented data shape.
 */
export interface CanvasPanelData {
  jobs?: readonly unknown[];
  applications?: readonly unknown[];
  growthPaths?: readonly unknown[];
  resources?: readonly unknown[];
  /** Optional override for the featured (top) resource on ResourcesPanel. */
  featuredResource?: unknown;
}

export interface CanvasTenantConfig {
  /** Tenant identifier (e.g. "acme", "default"). Surfaced in telemetry. */
  tenant: string;
  /** Voice persona — system prompt + greeting + display name. */
  persona: CanvasPersona;
  /** Tenant-overridable UI labels (action button copy, empty states, etc). */
  labels: Required<CanvasLabels>;
  /** Tenant-overridable mock data for example panels. */
  panelData: CanvasPanelData;
}

const DEFAULT_TENANT_CONFIG: CanvasTenantConfig = {
  tenant: 'default',
  persona: {
    systemPrompt:
      'You are a friendly, helpful assistant. Keep responses short and conversational since this is a voice call.',
    voiceGreeting: undefined,
    assistantName: 'Assistant',
    tenantTitle: 'AI Assistant',
    starterPrompts: [],
  },
  labels: {
    shareArtifact: 'Share',
    sendMessage: 'Send message',
    emptyArtifacts: 'No artifacts yet',
    emptyArtifactsHint:
      'Conversation artifacts will appear here as the assistant generates them or you upload files.',
  } satisfies Required<CanvasLabels>,
  panelData: {},
};

const CanvasContext = createContext<CanvasTenantConfig>(DEFAULT_TENANT_CONFIG);

/**
 * Deeply-partial tenant config — `persona.systemPrompt` is optional too,
 * so consumers can pass `{ persona: { voiceGreeting: '...' } }` without
 * having to fill in the system prompt the library default would provide.
 */
export interface PartialCanvasTenantConfig {
  tenant?: string;
  persona?: Partial<CanvasPersona>;
  labels?: Partial<CanvasLabels>;
  panelData?: CanvasPanelData;
}

export interface CanvasProviderProps {
  config?: PartialCanvasTenantConfig;
  children: ReactNode;
}

/**
 * Provider that injects tenant config into the canvas tree. Merges over the
 * library defaults so consumers can supply only the fields they care about.
 *
 * MEMOIZED: the merged value is referentially stable across re-renders unless
 * a primitive field actually changes. Without this, every parent re-render
 * (e.g. a Lit attribute change to `primary-color`) would publish a new
 * `merged` reference, causing every `useCanvasConfig()` consumer to think
 * the persona changed — which in `useGeminiLive` would tear down a live
 * voice session and reconnect. See architect-reviewer 2026-04-25 CRITICAL.
 */
export function CanvasProvider({ config, children }: CanvasProviderProps) {
  const tenant = config?.tenant;
  const systemPrompt = config?.persona?.systemPrompt;
  const voiceGreeting = config?.persona?.voiceGreeting;
  const assistantName = config?.persona?.assistantName;
  const tenantTitle = config?.persona?.tenantTitle;
  // starterPrompts is an array — depending on it directly in deps would
  // re-trigger memo on every render unless the consumer also memoizes the
  // array. Pin via the persona reference instead.
  const starterPrompts = config?.persona?.starterPrompts;
  const mockScenario = config?.persona?.mockScenario;
  const geminiVoiceName = config?.persona?.geminiVoiceName;
  const tokenEndpoint = config?.persona?.tokenEndpoint;
  // Labels — each field optional, falls through to library default when
  // tenant doesn't override. Keeps OSS copy generic ("Share") while
  // letting tenants supply specific labels ("Send to recruiter") without
  // forking.
  const lShareArtifact = config?.labels?.shareArtifact;
  const lSendMessage = config?.labels?.sendMessage;
  const lEmptyArtifacts = config?.labels?.emptyArtifacts;
  const lEmptyArtifactsHint = config?.labels?.emptyArtifactsHint;
  // Panel data — pinned by reference. Tenants pass module-scope arrays;
  // the panel hooks read these via `useCanvasConfig().panelData.*` and
  // fall back to library example data when undefined.
  const pdJobs = config?.panelData?.jobs;
  const pdApplications = config?.panelData?.applications;
  const pdGrowthPaths = config?.panelData?.growthPaths;
  const pdResources = config?.panelData?.resources;
  const pdFeaturedResource = config?.panelData?.featuredResource;
  const merged = useMemo<CanvasTenantConfig>(
    () => ({
      tenant: tenant ?? DEFAULT_TENANT_CONFIG.tenant,
      persona: {
        systemPrompt: systemPrompt ?? DEFAULT_TENANT_CONFIG.persona.systemPrompt,
        voiceGreeting: voiceGreeting ?? DEFAULT_TENANT_CONFIG.persona.voiceGreeting,
        assistantName: assistantName ?? DEFAULT_TENANT_CONFIG.persona.assistantName,
        tenantTitle: tenantTitle ?? DEFAULT_TENANT_CONFIG.persona.tenantTitle,
        starterPrompts: starterPrompts ?? DEFAULT_TENANT_CONFIG.persona.starterPrompts,
        mockScenario,
        geminiVoiceName,
        tokenEndpoint,
      },
      labels: {
        shareArtifact: lShareArtifact ?? DEFAULT_TENANT_CONFIG.labels.shareArtifact,
        sendMessage: lSendMessage ?? DEFAULT_TENANT_CONFIG.labels.sendMessage,
        emptyArtifacts: lEmptyArtifacts ?? DEFAULT_TENANT_CONFIG.labels.emptyArtifacts,
        emptyArtifactsHint:
          lEmptyArtifactsHint ?? DEFAULT_TENANT_CONFIG.labels.emptyArtifactsHint,
      },
      panelData: {
        jobs: pdJobs,
        applications: pdApplications,
        growthPaths: pdGrowthPaths,
        resources: pdResources,
        featuredResource: pdFeaturedResource,
      },
    }),
    [
      tenant,
      systemPrompt,
      voiceGreeting,
      assistantName,
      tenantTitle,
      starterPrompts,
      mockScenario,
      geminiVoiceName,
      tokenEndpoint,
      lShareArtifact,
      lSendMessage,
      lEmptyArtifacts,
      lEmptyArtifactsHint,
      pdJobs,
      pdApplications,
      pdGrowthPaths,
      pdResources,
      pdFeaturedResource,
    ]
  );
  return <CanvasContext.Provider value={merged}>{children}</CanvasContext.Provider>;
}

/** Hook used inside the canvas tree (e.g. `<VoiceWidget>`) to read tenant config. */
export function useCanvasConfig(): CanvasTenantConfig {
  return useContext(CanvasContext);
}
