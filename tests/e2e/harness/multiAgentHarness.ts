/**
 * Browser entry: publishes multi-agent scenario results on window for Playwright.
 */
import {
  runMultiAgentE2eScenario,
  type MultiAgentE2eResult,
} from './multiAgentScenario';

declare global {
  interface Window {
    __multiAgentE2eResult?: MultiAgentE2eResult;
    __runMultiAgentE2e?: () => Promise<MultiAgentE2eResult>;
  }
}

window.__runMultiAgentE2e = runMultiAgentE2eScenario;

void runMultiAgentE2eScenario().then((result) => {
  window.__multiAgentE2eResult = result;
});
