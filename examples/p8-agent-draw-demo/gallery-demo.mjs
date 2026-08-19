/**
 * Thin gallery controller for P8 northstar draw + see.
 * Calls public methods on <agentable-whiteboard> — no src/ imports.
 *** @typedef {{ ok: boolean; agentStampedCount: number; totalShapes: number; agentIds: string[] }} P8Summary */

const whiteboard = document.querySelector('agentable-whiteboard');
const logEl = document.getElementById('p8-activity-log');
const provenanceEl = document.querySelector('[data-testid="p8-provenance-summary"]');
const buttons = Array.from(document.querySelectorAll('.controls button'));

/** @type {boolean} */
let busy = false;

/**
 * @param {{ title: string; detail?: string }} entry
 */
function pushLog(entry) {
  if (!logEl) return;
  const li = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = entry.title;
  li.appendChild(strong);
  if (entry.detail) {
    li.appendChild(document.createTextNode(` — ${entry.detail}`));
  }
  logEl.appendChild(li);
}

/** @param {boolean} next */
function setBusy(next) {
  busy = next;
  for (const button of buttons) {
    button.disabled = next;
  }
}

/** @param {P8Summary | null | undefined} summary */
function renderProvenance(summary) {
  if (!provenanceEl) return;
  if (!summary || summary.agentStampedCount <= 0) {
    provenanceEl.hidden = true;
    return;
  }
  provenanceEl.hidden = false;
  const stamped = provenanceEl.querySelector('[data-field="stamped"]');
  const agents = provenanceEl.querySelector('[data-field="agents"]');
  if (stamped instanceof HTMLElement) {
    stamped.textContent = String(summary.agentStampedCount);
  }
  if (agents instanceof HTMLElement) {
    agents.textContent = summary.agentIds.join(', ') || '—';
  }
}

function notifyToolCall(name, summary, ok) {
  window.dispatchEvent(
    new CustomEvent('landi:tool-call', {
      detail: {
        name,
        args: { _demoSummary: summary },
        ok,
        source: 'p8-scripted-demo',
        timestamp: new Date.toISOString(),
      },
      bubbles: true,
      composed: true,
    }));
}

/** @returns {Promise<HTMLElement & { runNorthstarDemo: Function; whenReady: Function }>} */
async function getWhiteboard {
  await customElements.whenDefined('agentable-whiteboard');
  if (!(whiteboard instanceof HTMLElement)) {
    throw new Error('agentable-whiteboard element missing');
  }
  return whiteboard;
}

/** @param {'clear' | 'draw-flow' | 'draw-batch' | 'read-canvas' | 'full'} step */
async function runStep(step) {
  const board = await getWhiteboard;
  return board.runNorthstarDemo(step);
}

async function onDrawFlow {
  if (busy) return;
  setBusy(true);
  try {
    const result = await runStep('draw-flow');
    const tool = result.steps[0];
    notifyToolCall(
      'draw_shapes',
      'Flow diagram — Client brief → Moodboard → Concepts → Final delivery',
      tool?.ok ?? false);
    pushLog({
      title: 'draw_shapes · flow diagram',
      detail: tool?.ok
        ? 'Career-style flow from logical nodes': String(tool?.error ?? 'failed'),
    });
  } finally {
    setBusy(false);
  }
}

async function onDrawBatch {
  if (busy) return;
  setBusy(true);
  try {
    const result = await runStep('draw-batch');
    const tool = result.steps[0];
    notifyToolCall(
      'draw_shapes',
      'Branded box + provenance hint (Northstar Atelier)',
      tool?.ok ?? false);
    pushLog({
      title: 'draw_shapes · explicit batch',
      detail: tool?.ok
        ? 'Box + text with agent provenance meta': String(tool?.error ?? 'failed'),
    });
  } finally {
    setBusy(false);
  }
}

async function onReadCanvas {
  if (busy) return;
  setBusy(true);
  try {
    const result = await runStep('read-canvas');
    const summary = result.summary;
    if (summary) {
      renderProvenance(summary);
      window.__p8AgentDrawDemoResult = summary;
    }
    notifyToolCall(
      'read_canvas',
      summary
        ? `Viewport read — ${summary.agentStampedCount} agent-stamped shapes`: 'Viewport read failed',
      result.ok);
    pushLog({
      title: 'read_canvas · viewport',
      detail: summary
        ? `${summary.agentStampedCount} agent-stamped ${summary.totalShapes} total shapes`: String(result.steps[0]?.error ?? 'read failed'),
    });
  } finally {
    setBusy(false);
  }
}

async function onClear {
  if (busy) return;
  setBusy(true);
  try {
    const result = await runStep('clear');
    renderProvenance(null);
    window.__p8AgentDrawDemoResult = {
      ok: true,
      agentStampedCount: 0,
      totalShapes: 0,
      agentIds: [],
    };
    pushLog({
      title: 'clear_agent_drawings',
      detail: result.ok ? 'Removed agent-stamped marks': String(result.steps[0]?.error ?? 'clear failed'),
    });
  } finally {
    setBusy(false);
  }
}

async function onRunFullDemo {
  if (busy) return;
  setBusy(true);
  if (logEl) logEl.replaceChildren;
  renderProvenance(null);
  pushLog({ title: 'Demo started', detail: 'Scripted agent turn (no LLM)' });

  try {
    const board = await getWhiteboard;
    const ready = await board.whenReady;
    if (!ready) {
      pushLog({
        title: 'Demo aborted',
        detail: 'Whiteboard editor not ready — retry after canvas mounts',
      });
      window.__galleryReady = { example: 'p8-agent-draw-demo', ok: false };
      return;
    }

    const result = await board.runNorthstarDemo('full');
    for (const step of result.steps) {
      if (step.toolName === 'clear_agent_drawings') {
        notifyToolCall('clear_agent_drawings', 'Cleared prior agent-stamped marks', step.ok);
        pushLog({
          title: 'clear_agent_drawings',
          detail: step.ok ? 'Removed agent-stamped marks': String(step.error ?? 'failed'),
        });
      } else if (step.toolName === 'draw_shapes') {
        const isBatch = result.steps.indexOf(step) > 1;
        pushLog({
          title: isBatch ? 'draw_shapes · explicit batch': 'draw_shapes · flow diagram',
          detail: step.ok
            ? isBatch
              ? 'Box + text with agent provenance meta': 'Career-style flow from logical nodes': String(step.error ?? 'failed'),
        });
      } else if (step.toolName === 'read_canvas') {
        const summary = result.summary;
        if (summary) {
          renderProvenance(summary);
          window.__p8AgentDrawDemoResult = summary;
        }
        pushLog({
          title: 'read_canvas · viewport',
          detail: summary
            ? `${summary.agentStampedCount} agent-stamped ${summary.totalShapes} total shapes`: String(step.error ?? 'read failed'),
        });
      }
    }

    pushLog({
      title: 'Demo complete',
      detail: result.ok
        ? `Provenance verified: ${result.summary?.agentIds.join(', ') ?? 'none'}`: 'One or more steps failed — see log',
    });

    window.__galleryReady = { example: 'p8-agent-draw-demo', ok: result.ok };
    if (result.summary) {
      window.__p8AgentDrawDemoResult = result.summary;
    }
  } finally {
    setBusy(false);
  }
}

function wireControls {
  const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
  byTestId('p8-run-full-demo')?.addEventListener('click', () => void onRunFullDemo);
  byTestId('p8-draw-flow')?.addEventListener('click', () => void onDrawFlow);
  byTestId('p8-draw-batch')?.addEventListener('click', () => void onDrawBatch);
  byTestId('p8-read-canvas')?.addEventListener('click', () => void onReadCanvas);
  byTestId('p8-clear')?.addEventListener('click', () => void onClear);
}

window.__galleryExample = 'p8-agent-draw-demo';
window.__p8AgentDrawDemoResult = {
  ok: false,
  agentStampedCount: 0,
  totalShapes: 0,
  agentIds: [],
};

customElements.whenDefined('agentable-whiteboard').then(async () => {
  wireControls;
  const board = await getWhiteboard;
  const ready = await board.whenReady(45_000);
  window.__galleryReady = { example: 'p8-agent-draw-demo', ok: ready };
  window.__runP8AgentDrawDemo = async () => {
    document.querySelector('[data-testid="p8-run-full-demo"]')?.click;
  };
});
