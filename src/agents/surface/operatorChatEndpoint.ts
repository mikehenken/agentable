/**

 * Operator live-chat availability — delegates to shared whiteboard credential

 * resolution (same path as ChatPanel).

 */

export {

  createWhiteboardChatClientOptions,

  isConfiguredEndpoint,

  resolveWhiteboardChatProxyUrl as resolveOperatorProxyUrl,

  resolveWhiteboardLiveChatEnabled as resolveOperatorLiveChatEnabled,

} from '../../chat/whiteboardChatCredentials';

