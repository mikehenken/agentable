/**
 * Side-effect bootstrap — MUST evaluate before `agentable-whiteboard` defines
 * the custom element so the first embed render resolves career wiring.
 */
import { ensureCareerWhiteboardEmbedProviderRegistered } from './careerWhiteboardProvider';

ensureCareerWhiteboardEmbedProviderRegistered();