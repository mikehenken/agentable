/**
 * automated checks: drawing tools, engine draw capability gating,
 * and provenance stamping on agent canvas marks.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createShapeId, toRichText } from 'tldraw';
import {
 AGENT_PANEL_ANCHOR_META_KEY,
 AGENT_SHAPE_PROVENANCE_META_KEY,
 ENGINE_DRAW_UNAVAILABLE_CODE,
} from '../../src/engine/agentDrawingTypes';
import {
 bindEngineCapabilities,
 resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import {
 gateToolsForEngineCapabilities,
 selectEngineOfferedTools,
} from '../../src/agents/capabilities';
import {
 DRAWING_TOOLS,
 DRAWING_TOOL_NAMES,
} from '../../src/agents/tools/drawingTools';
import {
 getFunctionDeclarations,
 getTool,
} from '../../src/agents/tools/canvasTools';
import { withAgentToolContextAsync } from '../../src/agents/agentContext';
import {
 annotateAgentPanel,
 clearAgentDrawings,
 drawAgentShapes,
 readShapeProvenance,
} from '../../src/engines/tldraw/agentDrawing/agentDrawingApi';
import {
 bindEditor,
 __resetPanelShapeApiForTests__,
} from '../../src/engines/tldraw/shapes/panelShapeApi';
import type { EngineCapabilities } from '../../src/engine/types';

interface StubShape {
 id: string;
 typeName: 'shape';
 type: string;
 x: number;
 y: number;
 parentId?: string;
 index: string;
 meta: Record<string, unknown>;
 props: Record<string, unknown>;
}

interface StubEditor {
 getShape(): Mock;
 createShape: Mock;
 deleteShapes: Mock;
 getShapePageBounds(): Mock;
 getCurrentPageShapes(): Mock;
 __shapes: Map<string, StubShape>;
}

function makeCapabilities(draw: boolean): EngineCapabilities {
 return {
 frames: true,
 draw,
 minimap: true,
 infinitePan: true,
 nativeSnapshots: true,
 };
}

function makeStubEditor(): StubEditor {
 const shapes = new Map<string, StubShape>();
 const editor: StubEditor = {
 __shapes: shapes,
 getShape: vi.fn((id: string) => shapes.get(id)),
 createShape: vi.fn((shape: Omit<StubShape, 'typeName' | 'index'>) => {
 shapes.set(shape.id, {...shape,
 typeName: 'shape',
 index: `a${shapes.size + 1}`,
 meta: shape.meta ?? {},
 props: shape.props ?? {},
 });
 }),
 deleteShapes: vi.fn((ids: string[]) => {
 for (const id of ids) {
 shapes.delete(id);
 }
 }),
 getShapePageBounds: vi.fn((id: string) => {
 const shape = shapes.get(id);
 if (!shape) return null;
 return { x: shape.x, y: shape.y, w: 400, h: 300 };
 }),
 getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
 };
 return editor;
}

function seedPanel(editor: StubEditor, panelId: string): void {
 const id = String(createShapeId(`panel:${panelId}`));
 editor.__shapes.set(id, {
 id,
 typeName: 'shape',
 type: 'panel',
 x: 100,
 y: 120,
 index: 'a1',
 meta: {},
 props: { w: 400, h: 300, panelId, minimized: false, data: {} },
 });
}

describe('drawing tool engine capability gating', () => {
 afterEach(() => {
 resetEngineCapabilitiesForTests();
 });

 it('offers drawing tools when engine.draw is true', () => {
 const offers = gateToolsForEngineCapabilities(DRAWING_TOOLS, makeCapabilities(true));
 const offered = selectEngineOfferedTools(offers).map((tool) => tool.declaration.name);
 expect(offered).toEqual([...DRAWING_TOOL_NAMES]);
 });

 it('refuses drawing tools on a mocked engine without draw', () => {
 const offers = gateToolsForEngineCapabilities(DRAWING_TOOLS, makeCapabilities(false));
 const offered = selectEngineOfferedTools(offers).map((tool) => tool.declaration.name);
 expect(offered).toEqual([]);
 for (const offer of offers) {
 expect(offer.offered).toBe(false);
 expect(offer.note?.code).toBe('ENGINE_CAPABILITY_MISMATCH');
 expect(offer.note?.message).toContain(ENGINE_DRAW_UNAVAILABLE_CODE);
 }
 });

 it('handler refuses draw_shapes when draw capability is unbound', async () => {
 const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
 expect(tool).toBeDefined();
 const result = await withAgentToolContextAsync(
 { agentId: 'sketch-1', agentLabel: 'Sketch Agent' }, () =>
 tool!.handler({
 shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 0, y: 0, w: 80, h: 40 } }],
 }));
 expect(result.ok).toBe(false);
 if (result.ok) return;
 expect(result.error).toContain(ENGINE_DRAW_UNAVAILABLE_CODE);
 });

 it('omits drawing tools from getFunctionDeclarations when draw is unavailable', () => {
 resetEngineCapabilitiesForTests();
 const declarations = getFunctionDeclarations().map((entry) => entry.name);
 for (const name of DRAWING_TOOL_NAMES) {
 expect(declarations).not.toContain(name);
 expect(getTool(name)).toBeUndefined();
 }
 });

 it('exposes drawing tools in getFunctionDeclarations when draw is bound', () => {
 bindEngineCapabilities(makeCapabilities(true));
 const declarations = getFunctionDeclarations().map((entry) => entry.name);
 for (const name of DRAWING_TOOL_NAMES) {
 expect(declarations).toContain(name);
 expect(getTool(name)).toBeDefined();
 }
 });
});

describe('agent drawing provenance stamping', () => {
 let editor: StubEditor;

 beforeEach(() => {
 __resetPanelShapeApiForTests__();
 resetEngineCapabilitiesForTests();
 bindEngineCapabilities(makeCapabilities(true));
 editor = makeStubEditor();
 bindEditor(editor as never);
 });

 afterEach(() => {
 __resetPanelShapeApiForTests__();
 resetEngineCapabilitiesForTests();
 });

 it('stamps meta.agentableAgent on draw_shapes creations', () => {
 const result = drawAgentShapes('agent-alpha', [
 {
 kind: 'box',
 geometry: { kind: 'rect', x: 10, y: 20, w: 100, h: 50 },
 },
 {
 kind: 'text',
 geometry: { kind: 'text', x: 40, y: 90 },
 text: 'Wireframe label',
 },
 ]);

 expect(result.createdShapeIds).toHaveLength(2);
 expect(result.agentId).toBe('agent-alpha');
 expect(editor.createShape).toHaveBeenCalledTimes(2);

 for (const call of editor.createShape.mock.calls) {
 const created = call[0] as StubShape;
 expect(readShapeProvenance(created)).toBe('agent-alpha');
 expect(created.meta[AGENT_SHAPE_PROVENANCE_META_KEY]).toBe('agent-alpha');
 }
 });

 it('tolerates draw_shapes args that omit the redundant geometry.kind (LLM robustness)', async () => {
 const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
 expect(tool).toBeDefined();

 // Exactly the shape of a live Gemini draw_shapes call that previously
 // failed and blanked the canvas: the shape `kind` is present but the
 // redundant geometry.kind ("rect"/"text") is omitted, and the text box is
 // sized with `w` rather than the schema's `maxWidth`.
 const result = await withAgentToolContextAsync(
 { agentId: 'sketch-2', agentLabel: 'Sketch Agent' }, () =>
 tool!.handler({
 shapes: [
 { kind: 'ellipse', id: 'a', geometry: { x: 0, y: 0, w: 200, h: 90 } },
 { kind: 'box', id: 'b', geometry: { x: 300, y: 0, w: 220, h: 90 } },
 { kind: 'text', id: 'c', text: 'Odyssey-7', geometry: { x: 10, y: 20, w: 180, h: 50 } },
 ],
 }));

 expect(result.ok).toBe(true);
 if (!result.ok) return;

 // All three shapes created despite the missing geometry.kind.
 expect(editor.createShape).toHaveBeenCalledTimes(3);
 const created = editor.createShape.mock.calls.map((call) => call[0] as StubShape);
 expect(created.map((shape) => shape.type)).toEqual(['geo', 'geo', 'text']);
 expect(created[0]!.props.geo).toBe('ellipse');
 expect(created[1]!.props.geo).toBe('rectangle');
 // `w` was honored as the text max width (bounded box, not autoSize).
 const textShape = created.find((shape) => shape.type === 'text');
 expect(textShape?.props.w).toBe(180);
 expect(textShape?.props.autoSize).toBe(false);
 });

 it('creates shapes from hoisted width/height and tuple freehand points (follow-up)', async () => {
 const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
 expect(tool).toBeDefined();

 const result = await withAgentToolContextAsync(
 { agentId: 'sketch-gun', agentLabel: 'Sketch Agent' }, () =>
 tool!.handler({
 shapes: [
 { kind: 'box', x: 100, y: 80, width: 40, height: 80 },
 {
 kind: 'freehand',
 points: [
 [385, 190],
 [390, 190],
 [395, 200],
 ],
 },
 ],
 }));

 expect(result.ok).toBe(true);
 if (!result.ok) return;
 expect(result.result.createdShapeIds.length).toBeGreaterThanOrEqual(2);
 expect(editor.createShape).toHaveBeenCalledTimes(2);
 });

 it('converts literal backslash escapes in model text to what the model meant', async () => {
 const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
 expect(tool).toBeDefined();

 // Live Gemini sometimes double-escapes its JSON, so labels arrive with a
 // visible backslash-n ("T-0: Liftoff\n(Apex-9 clears tower)") that then
 // renders verbatim on the canvas.
 const result = await withAgentToolContextAsync(
 { agentId: 'sketch-5', agentLabel: 'Sketch Agent' }, () =>
 tool!.handler({
 shapes: [
 {
 kind: 'box',
 text: 'T-0: Liftoff\\n(Apex-9 clears tower)',
 geometry: { kind: 'rect', x: 0, y: 0, w: 320, h: 100 },
 },
 ],
 }));

 expect(result.ok).toBe(true);
 const created = editor.createShape.mock.calls.map((call) => call[0] as StubShape);
 const box = created.find((shape) => shape.type === 'geo');
 expect(box?.props.richText).toEqual(toRichText('T-0: Liftoff\n(Apex-9 clears tower)'));
 });

 it('widens a text maxWidth narrower than its longest word (no mid-word wrap)', async () => {
 const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
 expect(tool).toBeDefined();

 // Bar-chart value labels from a live run: "380" in a 40px-wide text
 // shape wrapped mid-number ("38" over "0"). The floor is longest word
 // times the per-character width plus padding: 3 * 15 + 16 = 61.
 const result = await withAgentToolContextAsync(
 { agentId: 'sketch-4', agentLabel: 'Sketch Agent' }, () =>
 tool!.handler({
 shapes: [
 { kind: 'text', text: '380', geometry: { kind: 'text', x: 0, y: 0, maxWidth: 40 } },
 ],
 }));

 expect(result.ok).toBe(true);
 const created = editor.createShape.mock.calls.map((call) => call[0] as StubShape);
 const textShape = created.find((shape) => shape.type === 'text');
 expect(textShape?.props.autoSize).toBe(false);
 expect(textShape?.props.w).toBe(61);
 });

 it('tolerates draw_shapes with geometry hoisted onto the shape (width/height, top-level points)', async () => {
 const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
 expect(tool).toBeDefined();

 // The exact shape of the live Gemini call captured in-browser: no nested
 // `geometry` object, x/y/width/height on the shape itself, and a freehand
 // whose `points` are top-level. This previously failed the whole call and,
 // because a clear ran first, left the canvas blank.
 const result = await withAgentToolContextAsync(
 { agentId: 'sketch-3', agentLabel: 'Sketch Agent' }, () =>
 tool!.handler({
 shapes: [
 { kind: 'ellipse', id: 'sc', text: 'Zenith-1 Spacecraft', x: 300, y: 50, width: 200, height: 90 },
 { kind: 'box', id: 'gs1', text: 'Blue Ridge Station', x: 100, y: 250, width: 180, height: 80 },
 { kind: 'text', id: 'title', text: 'TELEMETRY FLOW', x: 50, y: -20, width: 300 },
 {
 kind: 'freehand',
 id: 'arc',
 points: [
 { x: 270, y: 100 },
 { x: 400, y: 140 },
 { x: 530, y: 100 },
 ],
 },
 ],
 }));

 expect(result.ok).toBe(true);
 if (!result.ok) return;

 expect(editor.createShape).toHaveBeenCalledTimes(4);
 const created = editor.createShape.mock.calls.map((call) => call[0] as StubShape);
 expect(created.map((shape) => shape.type)).toEqual(['geo', 'geo', 'text', 'draw']);
 // width/height honored as w/h on the ellipse.
 expect(created[0]!.props.geo).toBe('ellipse');
 expect(created[0]!.props.w).toBe(200);
 expect(created[0]!.props.h).toBe(90);
 // Freehand rendered as a real tldraw draw shape with encoded segments.
 const drawShape = created.find((shape) => shape.type === 'draw');
 expect(Array.isArray(drawShape?.props.segments)).toBe(true);
 });

 it('skips a single unparseable shape and still draws the rest (no all-or-nothing failure)', async () => {
 const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
 expect(tool).toBeDefined();

 const result = await withAgentToolContextAsync(
 { agentId: 'sketch-4', agentLabel: 'Sketch Agent' }, () =>
 tool!.handler({
 shapes: [
 { kind: 'box', id: 'ok1', x: 0, y: 0, width: 200, height: 90 },
 { kind: 'nonsense', id: 'bad' },
 { kind: 'ellipse', id: 'ok2', x: 300, y: 0, width: 200, height: 90 },
 ],
 }));

 // Batch succeeds; the two valid shapes draw, the unparseable one is dropped
 // instead of failing the whole call (which, after a clear, would blank the
 // canvas).
 expect(result.ok).toBe(true);
 if (!result.ok) return;
 expect(editor.createShape).toHaveBeenCalledTimes(2);
 expect(editor.createShape.mock.calls.map((call) => (call[0] as StubShape).type)).toEqual([
 'geo',
 'geo',
 ]);
 });

 it('honors a model-assigned shape id (shape:<id>) so later tools can reference it', async () => {
 const tool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
 expect(tool).toBeDefined();

 const result = await withAgentToolContextAsync(
 { agentId: 'sketch-5', agentLabel: 'Sketch Agent' }, () =>
 tool!.handler({
 shapes: [{ kind: 'box', id: 'ignition', x: 0, y: 0, width: 120, height: 80 }],
 }));

 expect(result.ok).toBe(true);
 const created = editor.createShape.mock.calls.at(-1)?.[0] as StubShape;
 // The created shape carries the model's id as a tldraw shape id, so a
 // later connect_shapes({ from: 'ignition' }) resolves to it.
 expect(created.id).toBe(String(createShapeId('ignition')));
 });

 it('skips an empty text shape instead of drawing a literal "Text" placeholder', () => {
 const result = drawAgentShapes('sketch-6', [
 { kind: 'text', geometry: { kind: 'text', x: 0, y: 0 } },
 { kind: 'text', geometry: { kind: 'text', x: 0, y: 40 }, text: ' ' },
 { kind: 'text', geometry: { kind: 'text', x: 0, y: 80 }, text: 'Real label' },
 ]);

 // Only the shape with actual content renders; nothing on the canvas ever
 // says "Text".
 expect(result.createdShapeIds).toHaveLength(1);
 expect(editor.createShape).toHaveBeenCalledTimes(1);
 });

 it('fits a labeled box to its longest word (steps label size down, then widens)', () => {
 // "Functions" at size m needs more width than this 95px box; the fitter
 // steps the label to size s and widens the box around its center so the
 // word never wraps mid-word ("Functio ns").
 drawAgentShapes('sketch-8', [
 {
 kind: 'box',
 text: 'Functions',
 geometry: { kind: 'rect', x: 0, y: 0, w: 95, h: 80 },
 },
 ]);

 const created = editor.createShape.mock.calls.at(-1)?.[0] as StubShape;
 expect(created.props.size).toBe('s');
 expect(created.props.w).toBeGreaterThan(95);
 // Widened symmetrically: the center stays at x 47.5.
 const x = created.x as number;
 const w = created.props.w as number;
 expect(x + w / 2).toBeCloseTo(47.5, 5);
 });

 it('leaves a box alone when its label already fits', () => {
 drawAgentShapes('sketch-9', [
 {
 kind: 'box',
 text: 'S3',
 geometry: { kind: 'rect', x: 10, y: 0, w: 160, h: 80 },
 },
 ]);
 const created = editor.createShape.mock.calls.at(-1)?.[0] as StubShape;
 expect(created.props.w).toBe(160);
 expect(created.props.size).toBe('m');
 expect(created.x).toBe(10);
 });

 it('renders box and arrow text as an internal label (richText), never a loose overlay', () => {
 drawAgentShapes('sketch-7', [
 {
 kind: 'box',
 text: 'Flight Computer',
 geometry: { kind: 'rect', x: 0, y: 0, w: 200, h: 90 },
 },
 {
 kind: 'arrow',
 text: 'telemetry',
 geometry: { kind: 'segment', from: { x: 200, y: 45 }, to: { x: 320, y: 45 } },
 },
 ]);

 expect(editor.createShape).toHaveBeenCalledTimes(2);
 const created = editor.createShape.mock.calls.map((call) => call[0] as StubShape);
 const geo = created.find((shape) => shape.type === 'geo');
 const arrow = created.find((shape) => shape.type === 'arrow');
 // The label lives on the shape itself, so tldraw centers and wraps it.
 expect(geo?.props.richText).toBeDefined();
 expect(geo?.props.labelColor).toBe('black');
 expect(arrow?.props.richText).toBeDefined();
 });

 it('parents annotate_panel callouts to the panel shape with provenance meta', () => {
 seedPanel(editor, 'chat');
 const result = annotateAgentPanel('agent-beta', 'chat', 'Review this panel', 'top');
 expect(result.calloutShapeId.length).toBeGreaterThan(0);
 expect(result.agentId).toBe('agent-beta');

 const created = editor.createShape.mock.calls.at(-1)?.[0] as StubShape;
 expect(created.type).toBe('text');
 expect(created.parentId).toBe(String(createShapeId('panel:chat')));
 expect(created.meta[AGENT_SHAPE_PROVENANCE_META_KEY]).toBe('agent-beta');
 expect(created.meta[AGENT_PANEL_ANCHOR_META_KEY]).toBe('chat');
 expect(created.props.richText).toBeDefined();
 });

 it('clear_agent_drawings removes only the targeted agent marks', () => {
 drawAgentShapes('agent-one', [
 { kind: 'box', geometry: { kind: 'rect', x: 0, y: 0, w: 50, h: 50 } },
 ]);
 drawAgentShapes('agent-two', [
 { kind: 'ellipse', geometry: { kind: 'rect', x: 80, y: 0, w: 60, h: 40 } },
 ]);

 const cleared = clearAgentDrawings('agent-one');
 expect(cleared.removedShapeIds).toHaveLength(1);
 expect(editor.deleteShapes).toHaveBeenCalledTimes(1);

 const remainingAgents = editor.getCurrentPageShapes().map((shape) => readShapeProvenance(shape)).filter((agentId): agentId is string => agentId !== undefined);
 expect(remainingAgents).toEqual(['agent-two']);
 });
});
