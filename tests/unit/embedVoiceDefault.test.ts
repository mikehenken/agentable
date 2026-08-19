/**
 * embed surfaces voice off-by-default.
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/embed/agentable-whiteboard';
import '../../src/embed/agentable-panel';
import type { AgentableWhiteboardElement } from '../../src/embed/agentable-whiteboard';
import type { AgentablePanelElement } from '../../src/embed/agentable-panel';

describe('embed voice defaults ', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('agentable-whiteboard voiceEnabled defaults to false', async () => {
    await customElements.whenDefined('agentable-whiteboard');
    const el = document.createElement('agentable-whiteboard') as AgentableWhiteboardElement;
    document.body.append(el);
    expect(el.voiceEnabled).toBe(false);
  });

  it('agentable-whiteboard honors voice-enabled attribute opt-in', async () => {
    await customElements.whenDefined('agentable-whiteboard');
    const el = document.createElement('agentable-whiteboard') as AgentableWhiteboardElement;
    el.setAttribute('voice-enabled', '');
    document.body.append(el);
    expect(el.voiceEnabled).toBe(true);
  });

  it('agentable-panel voiceEnabled defaults to false', async () => {
    await customElements.whenDefined('agentable-panel');
    const el = document.createElement('agentable-panel') as AgentablePanelElement;
    document.body.append(el);
    expect(el.voiceEnabled).toBe(false);
  });

  it('agentable-panel honors voice-enabled attribute opt-in', async () => {
    await customElements.whenDefined('agentable-panel');
    const el = document.createElement('agentable-panel') as AgentablePanelElement;
    el.setAttribute('voice-enabled', '');
    document.body.append(el);
    expect(el.voiceEnabled).toBe(true);
  });
});
