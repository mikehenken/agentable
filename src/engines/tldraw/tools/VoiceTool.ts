import { StateNode } from 'tldraw';
import { ensureVoiceKernel } from '../../../shared/voiceKernel';
import { emitWhiteboardVoiceToggle } from './voiceEvents';

/** Idle child — voice is an action tool, not a drawing mode. */
class VoiceIdle extends StateNode {
  static override id = 'idle';
}

/**
 * Toolbar voice tool — toggles the Gemini Live call then returns to select.
 * Mirrors FloatingToolbar "Voice" on the bounded canvas.
 */
export class VoiceTool extends StateNode {
  static override id = 'voice';
  static override initial = 'idle';
  static override isLockable = false;

  static override children (){
    return [VoiceIdle];
  }

  override onEnter(): void {
    try {
      ensureVoiceKernel().voice.toggle();
    } catch (err) {
      console.error('[VoiceTool] voice toggle failed', err);
    }
    emitWhiteboardVoiceToggle();
    this.editor.setCurrentTool('select');
  }
}
