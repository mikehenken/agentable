/**
 * React wrapper for `<agentable-panel>`.
 *
 * Registers the Lit custom element, exposes camelCase props, and wires the
 * typed event map via explicit addEventListener (colons in event names).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from 'react';
import '../embed/agentable-panel';
import type { AgentablePanelElement } from '../embed/agentable-panel';
import {
  applyAgentablePanelProps,
  bindAgentablePanelEvents,
  type AgentablePanelEventHandlers,
  type AgentablePanelWrapperProps,
} from '../embed/wrappers/agentablePanelWrapperCore';

export interface AgentablePanelProps extends AgentablePanelWrapperProps, AgentablePanelEventHandlers {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Test story hook — maps to `data-skip-react-mount` on the custom element. */
  skipReactMount?: boolean;
}

export interface AgentablePanelHandle {
  element: AgentablePanelElement | null;
  reload: () => Promise<void>;
}

export const AgentablePanel = forwardRef<AgentablePanelHandle, AgentablePanelProps>(
  function AgentablePanel(props, forwardedRef) {
    const {
      panel,
      tenant,
      primaryColor,
      welcomeMessage,
      apiEndpoint,
      anonKey,
      configPath,
      voiceEnabled,
      snapGrid,
      systemPrompt,
      voiceGreeting,
      greetingMode,
      tokenEndpoint,
      locale,
      configUrl,
      panelDataUrl,
      panelTitle,
      hideChrome,
      slotName,
      lazyHydrate,
      skipReactMount,
      onConfigReloaded,
      onPanelReady,
      onAdapterLoaded,
      onPanelError,
      onChromeChanged,
      onApprovalPending,
      onPhaseChanged,
      className,
      style,
      children,
    } = props;

    const ref = useRef<AgentablePanelElement | null>(null);

    const handlersRef = useRef<AgentablePanelEventHandlers>({
      onConfigReloaded,
      onPanelReady,
      onAdapterLoaded,
      onPanelError,
      onChromeChanged,
      onApprovalPending,
      onPhaseChanged,
    });
    handlersRef.current = {
      onConfigReloaded,
      onPanelReady,
      onAdapterLoaded,
      onPanelError,
      onChromeChanged,
      onApprovalPending,
      onPhaseChanged,
    };

    useImperativeHandle(
      forwardedRef, () => ({
        get element (){
          return ref.current;
        },
        reload: async () => {
          if (ref.current) {
            await ref.current.reload();
          }
        },
      }),
      []);

    useEffect(() => {
      const el = ref.current;
      if (!el) {
        return;
      }
      return bindAgentablePanelEvents(el, () => handlersRef.current);
    }, []);

    useEffect(() => {
      const el = ref.current;
      if (!el) {
        return;
      }
      applyAgentablePanelProps(el, {
        panel,
        tenant,
        primaryColor,
        welcomeMessage,
        apiEndpoint,
        anonKey,
        configPath,
        voiceEnabled,
        snapGrid,
        systemPrompt,
        voiceGreeting,
        greetingMode,
        tokenEndpoint,
        locale,
        configUrl,
        panelDataUrl,
        panelTitle,
        hideChrome,
        slotName,
        lazyHydrate,
      });
    }, [
      panel,
      tenant,
      primaryColor,
      welcomeMessage,
      apiEndpoint,
      anonKey,
      configPath,
      voiceEnabled,
      snapGrid,
      systemPrompt,
      voiceGreeting,
      greetingMode,
      tokenEndpoint,
      locale,
      configUrl,
      panelDataUrl,
      panelTitle,
      hideChrome,
      slotName,
      lazyHydrate,
      skipReactMount,
    ]);

    return (
      <agentable-panel
        ref={ref}
        panel={panel}
        tenant={tenant}
        primary-color={primaryColor}
        welcome-message={welcomeMessage}
        api-endpoint={apiEndpoint}
        anon-key={anonKey}
        config-path={configPath}
        voice-enabled={voiceEnabled}
        snap-grid={snapGrid}
        system-prompt={systemPrompt}
        voice-greeting={voiceGreeting}
        voice-greeting-mode={greetingMode}
        token-endpoint={tokenEndpoint}
        locale={locale}
        config-url={configUrl}
        panel-data-url={panelDataUrl}
        panel-title={panelTitle}
        hide-chrome={hideChrome}
        slot-name={slotName}
        lazy-hydrate={lazyHydrate}
        {...(skipReactMount ? { 'data-skip-react-mount': true }: {})}
        className={className}
        style={style}
      >
        {children}
      </agentable-panel>
    );
  });

AgentablePanel.displayName = 'AgentablePanel';
