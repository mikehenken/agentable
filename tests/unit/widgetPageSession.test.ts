import { describe, expect, it, beforeEach } from 'vitest';
import {
  bindWidgetPageSession,
  __resetWidgetParticipantCounterForTests__,
} from '../../src/embed/widgets/widgetPageSession';
import {
  ensurePageSession,
  __resetPageSessionForTests__,
} from '../../src/session/pageSession';

describe('widgetPageSession', () => {
  beforeEach(() => {
    __resetPageSessionForTests__();
    __resetWidgetParticipantCounterForTests__();
  });

  it('joins and leaves the shared page session', () => {
    const binding = bindWidgetPageSession('agentable-starter-chip');
    binding.join();
    expect(ensurePageSession().getSnapshot().participantIds).toContain(binding.participantId);

    binding.leave();
    expect(ensurePageSession().getSnapshot().participantIds).not.toContain(binding.participantId);
  });

  it('creates unique participant ids per widget mount', () => {
    const first = bindWidgetPageSession('ask-about-this-button');
    const second = bindWidgetPageSession('ask-about-this-button');
    expect(first.participantId).not.toBe(second.participantId);
  });
});
