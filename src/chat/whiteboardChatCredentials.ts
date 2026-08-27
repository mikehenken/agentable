/**
 * Shared whiteboard chat credential resolution — mirrors `ChatPanel.tsx` so
 * operator and Atlas chat use the same proxy / token mint / API key paths.
 */
import type { AgentToolExecutionContext } from '../agents/agentContext';
import type { ChatClientOptions } from './geminiChatClient';
import { DEFAULT_MAX_ROUND_TRIPS } from './geminiChatClient';

export interface WhiteboardChatCredentials {
  useMock: boolean;
  chatProxyUrl: string;
  tokenEndpoint: string;
  apiKey: string;
  systemInstruction: string;
}

/** Treat placeholder markers (e.g. `<SET_IN_config.local.json>`) as unset. */
export function isConfiguredEndpoint(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return !(trimmed.startsWith('<') && trimmed.endsWith('>'));
}

/** First `<agentable-whiteboard>` on the page, if any. */
export function resolveWhiteboardElement(): HTMLElement | null {
  const whiteboard = document.querySelector('agentable-whiteboard');
  return whiteboard instanceof HTMLElement ? whiteboard : null;
}

/**
 * Resolve chat credentials from embed host attributes and build-time env —
 * same precedence as `ChatPanel` (persona env + whiteboard attributes).
 */
export function resolveWhiteboardChatCredentials(): WhiteboardChatCredentials {
  const whiteboard = resolveWhiteboardElement();

  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ?? '';

  let tokenEndpointRaw =
    (import.meta.env.VITE_VOICE_TOKEN_ENDPOINT as string | undefined)?.trim() ??
    (import.meta.env.VITE_TOKEN_MINT_URL as string | undefined)?.trim() ??
    '';

  if (whiteboard?.hasAttribute('token-endpoint')) {
    const attrEndpoint = whiteboard.getAttribute('token-endpoint')?.trim() ?? '';
    if (attrEndpoint.length > 0) {
      tokenEndpointRaw = attrEndpoint;
    }
  }

  let chatProxyUrlRaw =
    (import.meta.env.VITE_LANDI_CHAT_PROXY_URL as string | undefined)?.trim() ?? '';

  if (whiteboard?.hasAttribute('api-endpoint')) {
    const apiEndpoint = whiteboard.getAttribute('api-endpoint')?.trim() ?? '';
    if (apiEndpoint.length > 0 && chatProxyUrlRaw.length === 0) {
      chatProxyUrlRaw = apiEndpoint;
    }
  }

  const tokenEndpoint = isConfiguredEndpoint(tokenEndpointRaw) ? tokenEndpointRaw : '';
  const chatProxyUrl = isConfiguredEndpoint(chatProxyUrlRaw) ? chatProxyUrlRaw : '';

  // Hosts that ship without a backend on purpose (the public examples
  // gallery) opt in explicitly. Without this a production build with no
  // credentials attempts an unauthenticated Gemini request and renders the
  // raw 401 into the chat transcript. Real deployments that merely forgot to
  // configure a key still fail loudly, which is the documented intent.
  const mockAttr = whiteboard?.hasAttribute('mock-chat') ?? false;

  const isProd = (import.meta.env.MODE ?? import.meta.env.NODE_ENV) === 'production';
  const useMock =
    mockAttr ||
    (import.meta.env.VITE_LANDI_MOCK ?? '') === '1' ||
    (!apiKey && !chatProxyUrl && !tokenEndpoint && !isProd);

  let systemInstruction = 'You are a helpful assistant.';
  if (whiteboard?.hasAttribute('system-prompt')) {
    const prompt = whiteboard.getAttribute('system-prompt')?.trim();
    if (prompt && prompt.length > 0) {
      systemInstruction = prompt;
    }
  }

  return {
    useMock,
    chatProxyUrl,
    tokenEndpoint,
    apiKey,
    systemInstruction,
  };
}

/** True when live chat can run (not gallery mock path). */
export function resolveWhiteboardLiveChatEnabled(): boolean {
  const creds = resolveWhiteboardChatCredentials();
  if (creds.useMock) {
    return false;
  }
  return Boolean(creds.chatProxyUrl || creds.apiKey || creds.tokenEndpoint);
}

/** Proxy URL when live chat uses a server endpoint (undefined for key-only paths). */
export function resolveWhiteboardChatProxyUrl(): string | undefined {
  const creds = resolveWhiteboardChatCredentials();
  if (!resolveWhiteboardLiveChatEnabled()) {
    return undefined;
  }
  return creds.chatProxyUrl.length > 0 ? creds.chatProxyUrl : undefined;
}

export interface CreateWhiteboardChatClientInput {
  systemInstruction?: string;
  toolContext?: AgentToolExecutionContext;
  maxToolRoundTrips?: number;
}

/**
 * Build `createChatClient` options matching ChatPanel credential resolution.
 * Returns null when mock/offline gallery path applies.
 */
export function createWhiteboardChatClientOptions(
  input: CreateWhiteboardChatClientInput = {}): ChatClientOptions | null {
  const creds = resolveWhiteboardChatCredentials();
  if (creds.useMock) {
    return null;
  }

  const systemInstruction = input.systemInstruction ?? creds.systemInstruction;
  const maxToolRoundTrips = input.maxToolRoundTrips ?? DEFAULT_MAX_ROUND_TRIPS;

  if (creds.chatProxyUrl) {
    return {
      proxyUrl: creds.chatProxyUrl,
      systemInstruction,
      toolContext: input.toolContext,
      maxToolRoundTrips,
    };
  }

  if (!creds.apiKey && !creds.tokenEndpoint) {
    return null;
  }

  return {
    apiKeySource: creds.tokenEndpoint
      ? async () => {
          const response = await fetch(creds.tokenEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (!response.ok) {
            throw new Error(`token mint failed: ${response.status}`);
          }
          const data = (await response.json()) as { token?: string };
          if (!data.token) {
            throw new Error('token mint missing token field');
          }
          return data.token;
        }: creds().apiKey,
    systemInstruction,
    toolContext: input.toolContext,
    maxToolRoundTrips,
  };
}
