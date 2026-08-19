export {
  CHAT_PANEL_ID,
  CHAT_PROMPT_EVENT,
  CHAT_TRANSCRIPT_INJECT_EVENT,
  FIT_AGENT_DRAWING_EVENT,
  FOCUS_CHAT_INPUT_EVENT,
  OPEN_CHAT_EVENT,
  isChatPanelId,
} from './constants';

export { chatPanelLayoutObstacle } from './chatReserved';

export {
  computeChatAwarePlacement,
  getChatPanelBounds,
  mergeChatReservedObstacles,
  repositionPanelBesideChatIfOverlapping,
} from '../engines/tldraw/choreography/chatReserved';

export { dispatchChatPrompt, dispatchOpenChat, type ChatPromptDetail } from './dispatchPrompt';

export {
  validatePersonaStarterPrompts,
  warnPersonaStarterPrompts,
  type PersonaValidationContext,
  type PersonaValidationIssue,
} from './validatePersona';

export {
  resolveVoiceGreetingMode,
  validateVoiceGreetingConfig,
  warnVoiceGreetingConfig,
  type VoiceGreetingValidationContext,
  type VoiceGreetingValidationIssue,
} from './validateVoiceGreeting';
