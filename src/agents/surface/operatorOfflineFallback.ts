/**

 * Deterministic offline operator chat fallback.

 *

 * Used when no live chat credential is configured. Mode-aware actions run

 * read_canvas, open_panel, and draw_shapes via the embed whiteboard API.

 */

import { getOperatorMode } from './operatorModeBridge';

import { runOperatorModeOfflineAction } from './operatorModeOfflineActions';



export interface OperatorOfflineFallbackResult {

  /** Assistant-facing text appended to the operator thread. */

  text: string;

  toolName?: string;

  toolArgs?: Record<string, unknown>;

  toolOk?: boolean;

}



export interface OperatorOfflineFallbackInput {

  userText: string;

  mode?: import('./types').OperatorMode;

}



/**

 * Produce a concise offline reply for the operator composer.

 */

export async function runOperatorOfflineFallback(

  input: OperatorOfflineFallbackInput | string): Promise<OperatorOfflineFallbackResult> {

  const userText = typeof input === 'string' ? input: input.userText;

  const mode = typeof input === 'string' ? getOperatorMode: (input.mode ?? getOperatorMode);



  const action = await runOperatorModeOfflineAction(userText, mode);

  if (action !== null) {

    return {

      text: action.text,

      toolName: action.toolName,

      toolArgs: action.toolArgs,

      toolOk: action.toolOk,

    };

  }



  const trimmed = userText.trim();

  const preview =

    trimmed.length > 96 ? `${trimmed.slice(0, 96).trimEnd()}…`: trimmed;



  return {

    text: preview

      ? `Got it — "${preview}". Live chat is unavailable offline; connect a chat proxy or API credentials on the host whiteboard for model replies.`: 'Operator is ready. Connect a chat proxy or API credentials on the host whiteboard for live model replies.',

  };

}

