/**
 * shadcn.io/ai-inspired chat primitives, hand-written to consume the
 * same NPM dependencies (`streamdown`, `shiki`, `use-stick-to-bottom`)
 * but styled with our orchestration tokens (`tokens.css`,
 * `[data-theme]`).
 *
 * Components in this barrel are domain-agnostic — any future Landi
 * app can import them without pulling in orchestration types.
 */
export { Conversation } from "./conversation";
export type { ConversationProps } from "./conversation";

export { Message, MessageContent } from "./message";
export type { MessageProps, MessageContentProps, MessageRole } from "./message";

export { Response } from "./response";
export type { ResponseProps } from "./response";

export { Loader } from "./loader";

export { Attachments } from "./attachments";
export type { AttachmentItem, AttachmentsProps } from "./attachments";

export {
  ToolMarker,
  TaskMarker,
  ReasoningMarker,
  PlanMarker,
  ConfirmationMarker,
  SourcesMarker,
} from "./markers";

export { parseMarkers } from "./parse-markers";
export type { Block, MarkerKind, MarkerBlock, TextBlock } from "./parse-markers";
