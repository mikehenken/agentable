/**
 * ChatPanel tool-call echo rendering.
 *
 * Voice and chat tool calls dispatch `landi:tool-call`; ChatPanel appends
 * inline cards with lucide icons. A missing import (e.g. Wrench) only
 * throws once messages leave the empty state — no prior render test hit
 * that branch.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { CanvasProvider } from '../../src/config/CanvasContext';
import { ChatPanel } from '../../src/chat/ChatPanel';

function renderChromelessChat (){
  return render(
    <CanvasProvider>
      <ChatPanel chromeless />
    </CanvasProvider>);
}

function dispatchToolCall(detail: {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  source?: 'voice' | 'chat';
}) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('landi:tool-call', {
        detail: {
          source: 'voice',
          timestamp: new Date().toISOString(),...detail,
        },
      }));
  });
}

describe('ChatPanel — tool call echo', () => {
  it('renders successful voice open_panel tool cards without throwing', () => {
    renderChromelessChat();
    expect(() => {
      dispatchToolCall({
        name: 'open_panel',
        args: { panel_id: 'open-positions' },
        ok: true,
        source: 'voice',
      });
    }).not.toThrow();

    expect(screen.getByText('open_panel completed')).toBeInTheDocument();
  });

  it('renders failed tool call cards with error styling text', () => {
    renderChromelessChat();
    dispatchToolCall({
      name: 'open_panel',
      args: { panel_id: 'unknown-panel' },
      ok: false,
      source: 'voice',
    });

    expect(screen.getByText('open_panel failed')).toBeInTheDocument();
  });

  it('leaves empty state once a tool echo arrives (non-empty message branch)', () => {
    renderChromelessChat();
    expect(screen.getByText(/Ask me anything/)).toBeInTheDocument();

    dispatchToolCall({
      name: 'open_positions',
      args: { department: 'Engineering' },
      ok: true,
    });

    expect(screen.queryByText(/Ask me anything/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Opened positions · open_positions(department="Engineering")'),
    ).toBeInTheDocument();
  });

  it('voice composer button opens voice panel without throwing', () => {
    renderChromelessChat();
    const voiceButton = screen.getByRole('button', { name: 'Open voice conversation' });
    expect(() => fireEvent.click(voiceButton)).not.toThrow();
  });
});
