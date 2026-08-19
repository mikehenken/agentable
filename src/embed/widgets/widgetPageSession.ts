/**
 * Shared page-session join/leave for widget embeds.
 */
import { ensurePageSession } from '../../session/pageSession';

let widgetParticipantCounter = 0;

function createWidgetParticipantId(tagName: string): string {
  widgetParticipantCounter += 1;
  const slug = tagName.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'widget';
  return `widget-${slug}-${widgetParticipantCounter.toString(36)}`;
}

export interface WidgetPageSessionBinding {
  participantId: string;
  join(): void;
  leave(): void;
}

/** Register this widget surface with the shared page session. */
export function bindWidgetPageSession(tagName: string): WidgetPageSessionBinding {
  const participantId = createWidgetParticipantId(tagName);
  return {
    participantId,
    join() {
      ensurePageSession().join(participantId);
    },
    leave() {
      ensurePageSession().leave(participantId);
    },
  };
}

/** Test-only counter reset. */
export function __resetWidgetParticipantCounterForTests__(): void {
  widgetParticipantCounter = 0;
}
