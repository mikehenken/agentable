/** Stream status consumed by prompt submit loader affordances. */
export type AgentChatStatus = 'idle' | 'submitted' | 'streaming' | 'ready' | 'error';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageAuthor {
  id: string;
  name: string;
  actorType: 'human' | 'agent' | 'system';
  initials?: string;
  avatarUrl?: string;
}
