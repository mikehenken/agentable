/**

 * Thin gallery controller for Meridian Labs open agent canvas.

 * Calls public methods on <agentable-whiteboard> — no src/ imports.

 */



const whiteboard = document.querySelector('agentable-whiteboard');



/** @returns {Promise<HTMLElement & { runMeridianDemo: Function; whenReady: Function }>} */

async function getWhiteboard {

  await customElements.whenDefined('agentable-whiteboard');

  if (!(whiteboard instanceof HTMLElement)) {

    throw new Error('agentable-whiteboard element missing');

  }

  return whiteboard;

}



window.__galleryExample = '12-open-agent-canvas';

window.__meridianDemoResult = {

  ok: false,

  flowBoxCount: 0,

  stencilCount: 0,

  totalShapes: 0,

};

window.__meridianDocumentResult = {

  ok: false,

  panelId: '',

  blockCount: 0,

  title: '',

};

window.__meridianExportResult = {

  ok: false,

  format: 'pdf',

};

window.__meridianHitlResult = {

  ok: false,

  pendingBeforeSave: 0,

  pendingAfterSave: 0,

  saveCompleted: false,

  authoringDidNotQueueHitl: false,

};



customElements.whenDefined('agentable-whiteboard').then(async () => {

  try {

    const board = await getWhiteboard;

    const ready = await board.whenReady(45_000);

    if (!ready) {

      window.__galleryReady = { example: '12-open-agent-canvas', ok: false };

      return;

    }



    const result = await board.runMeridianDemo('full');

    if (result.summary) {

      window.__meridianDemoResult = result.summary;

    }

    if (result.document) {

      window.__meridianDocumentResult = result.document;

    }

    if (result.export) {

      window.__meridianExportResult = result.export;

    }

    if (result.hitl) {

      window.__meridianHitlResult = result.hitl;

    }



    window.__galleryReady = {

      example: '12-open-agent-canvas',

      ok: result.ok,

      totalShapes: result.summary?.totalShapes ?? 0,

      documentBlocks: result.document?.blockCount ?? 0,

      exportOk: result.export?.ok ?? false,

      hitlOk: result.hitl?.ok ?? false,

    };

  } catch (err) {

    console.error('[12-open-agent-canvas] demo failed:', err);

    window.__galleryReady = { example: '12-open-agent-canvas', ok: false };

  }

});

