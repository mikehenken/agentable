import type { ReactElement, ReactNode } from 'react';
import { CopilotKit } from '@copilotkit/react-core';

export interface CopilotKitBridgeProps {
  /** CopilotKit runtime URL, e.g. https://dev.landi.build/api/copilotkit */
  runtimeUrl?: string;
  headers?: Record<string, string>;
  children: ReactNode;
}

/**
 * Optional CopilotKit provider for text-agent channel (Stage 09).
 * When runtimeUrl is omitted, children render unchanged (Gemini chat path).
 */
export function CopilotKitBridge({
  runtimeUrl,
  headers,
  children,
}: CopilotKitBridgeProps): ReactElement {
  if (!runtimeUrl?.trim()) {
    return <>{children}</>;
  }
  return (
    <CopilotKit runtimeUrl={runtimeUrl.trim()} headers={headers}>
      {children}
    </CopilotKit>
  );
}
