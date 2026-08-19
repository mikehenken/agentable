import { describe, it, expect } from "vitest";

import {
  findNonOverlappingPosition,
  organizePanelsResponsive,
  rectsOverlap,
  computeFreeCanvasArea,
  shouldDockVoicePanel,
  getVoiceDockLayout,
  getSidebarColumnLayout,
  getDefaultChatLayout,
  getChatColumnTargetHeight,
  VOICE_DOCK_PANEL_H,
  DEFAULT_CHAT_WIDTH,
  DEFAULT_CHAT_MIN_WIDTH,
  getViewportLayoutConfig,
  shouldExpandNavSidebar,
  TABLET_BP,
  snapToGrid,
  snapRect,
  clampRectToViewport,
  ensurePanelVisible,
  GRID_SIZE,
  computeNavSidebarHeight,
  NAV_SIDEBAR_DEFAULT_ITEM_COUNT,
  NAV_SIDEBAR_TOP,
  type ViewportLayoutConfig,
} from '../../src/layout/panelLayoutEngine';

import type { PanelLayout } from "../../src/types";

const viewport: ViewportLayoutConfig = getViewportLayoutConfig({
  viewportWidth: 1200,

  viewportHeight: 900,

  navSidebarExpanded: false,
});

describe("rectsOverlap", () => {
  it("detects overlapping rectangles", () => {
    expect(
      rectsOverlap(
        { x: 0, y: 0, w: 100, h: 100 },

        { x: 50, y: 50, w: 100, h: 100 },

        0)).toBe(true);
  });

  it("treats gap as separation", () => {
    expect(
      rectsOverlap(
        { x: 0, y: 0, w: 100, h: 100 },

        { x: 120, y: 0, w: 100, h: 100 },

        20)).toBe(false);
  });
});

describe("grid snap helpers", () => {
  it("snaps values to GRID_SIZE", () => {
    expect(snapToGrid(37)).toBe(40);

    expect(snapToGrid(30)).toBe(40);

    expect(snapToGrid(29)).toBe(20);
  });

  it("snaps rect x/y/w/h", () => {
    const snapped = snapRect({ x: 37, y: 63, w: 415, h: 307 });

    expect(snapped.x % GRID_SIZE).toBe(0);

    expect(snapped.y % GRID_SIZE).toBe(0);

    expect(snapped.w % GRID_SIZE).toBe(0);

    expect(snapped.h % GRID_SIZE).toBe(0);
  });

  it("enforces minimum w/h of GRID_SIZE when snapping rect", () => {
    const snapped = snapRect({ x: 0, y: 0, w: 5, h: 8 });

    expect(snapped.w).toBe(GRID_SIZE);

    expect(snapped.h).toBe(GRID_SIZE);
  });

  it("clamps rect inside viewport", () => {
    const clamped = clampRectToViewport(
      { x: -100, y: 900, w: 400, h: 300 },

      viewport,

      280,

      200);

    expect(clamped.x).toBeGreaterThanOrEqual(viewport.left);

    expect(clamped.y).toBeLessThanOrEqual(viewport.bottom - clamped.h);

    expect(clamped.x + clamped.w).toBeLessThanOrEqual(viewport.right);
  });

  it("pulls panel in from right and bottom edges", () => {
    const offRight = clampRectToViewport(
      { x: viewport.right - 50, y: viewport.top, w: 400, h: 300 },

      viewport,

      280,

      200);

    expect(offRight.x + offRight.w).toBeLessThanOrEqual(viewport.right);

    expect(offRight.x).toBeGreaterThanOrEqual(viewport.left);

    const offBottom = clampRectToViewport(
      { x: viewport.left, y: viewport.bottom - 50, w: 400, h: 300 },

      viewport,

      280,

      200);

    expect(offBottom.y + offBottom.h).toBeLessThanOrEqual(viewport.bottom);

    expect(offBottom.y).toBeGreaterThanOrEqual(viewport.top);
  });

  it("sizes down panel that exceeds viewport width", () => {
    const contentWidth = viewport.right - viewport.left;

    const clamped = clampRectToViewport(
      { x: viewport.left, y: viewport.top, w: contentWidth + 500, h: 300 },

      viewport,

      280,

      200);

    expect(clamped.w).toBeLessThanOrEqual(contentWidth);

    expect(clamped.w).toBeGreaterThanOrEqual(280);

    expect(clamped.x + clamped.w).toBeLessThanOrEqual(viewport.right);
  });

  it("keeps rect fully inside viewport bounds (off-canvas prevention)", () => {
    const cases = [
      { x: -200, y: -50, w: 400, h: 300 },

      { x: viewport.right + 100, y: viewport.top, w: 400, h: 300 },

      { x: viewport.left, y: viewport.bottom + 100, w: 400, h: 300 },

      { x: viewport.right - 10, y: viewport.bottom - 10, w: 800, h: 600 },
    ];

    for (const rect of cases) {
      const clamped = clampRectToViewport(rect, viewport, 280, 200);

      expect(clamped.x).toBeGreaterThanOrEqual(viewport.left);

      expect(clamped.y).toBeGreaterThanOrEqual(viewport.top);

      expect(clamped.x + clamped.w).toBeLessThanOrEqual(viewport.right);

      expect(clamped.y + clamped.h).toBeLessThanOrEqual(viewport.bottom);
    }
  });
});

describe("shouldExpandNavSidebar", () => {
  it("expands at TABLET_BP and above", () => {
    expect(shouldExpandNavSidebar(TABLET_BP)).toBe(true);
    expect(shouldExpandNavSidebar(TABLET_BP + 1)).toBe(true);
    expect(shouldExpandNavSidebar(1920)).toBe(true);
  });

  it("collapses below TABLET_BP", () => {
    expect(shouldExpandNavSidebar(TABLET_BP - 1)).toBe(false);
    expect(shouldExpandNavSidebar(640)).toBe(false);
    expect(shouldExpandNavSidebar(375)).toBe(false);
  });
});

describe("getViewportLayoutConfig", () => {
  it("uses navSidebarExpanded for content-left inset", () => {
    const collapsed = getViewportLayoutConfig({
      viewportWidth: 1000,

      viewportHeight: 800,

      navSidebarExpanded: false,
    });

    const expanded = getViewportLayoutConfig({
      viewportWidth: 1000,

      viewportHeight: 800,

      navSidebarExpanded: true,
    });

    expect(expanded.left).toBeGreaterThan(collapsed.left);

    expect(collapsed.gap).toBe(GRID_SIZE);
  });

  it("accounts for top and bottom chrome", () => {
    expect(viewport.top).toBe(56);

    expect(viewport.bottom).toBe(900 - 72);
  });
});

describe("findNonOverlappingPosition", () => {
  it("returns viewport origin when no obstacles", () => {
    const pos = findNonOverlappingPosition(400, 300, [], viewport);

    expect(pos).toEqual({ x: viewport.left, y: viewport.top });
  });

  it("never overlaps existing panels", () => {
    const obstacles = [
      { x: viewport.left, y: viewport.top, w: 400, h: 400 },
      { x: viewport.left + 420, y: viewport.top, w: 400, h: 400 },
    ];
    const pos = findNonOverlappingPosition(400, 300, obstacles, viewport);
    const candidate = { x: pos.x, y: pos.y, w: 400, h: 300 };
    for (const obstacle of obstacles) {
      expect(rectsOverlap(candidate, obstacle, viewport.gap)).toBe(false);
    }
    expect(candidate.x + candidate.w).toBeLessThanOrEqual(viewport.right);
    expect(candidate.y + candidate.h).toBeLessThanOrEqual(viewport.bottom);
  });

  it("cascades past obstacles when viewport is full (may go off-screen)", () => {
    const obstacles = [
      {
        x: viewport.left,

        y: viewport.top,

        w: viewport.right - viewport.left,

        h: viewport.bottom - viewport.top - 40,
      },
    ];

    const pos = findNonOverlappingPosition(400, 300, obstacles, viewport);
    const candidate = { x: pos.x, y: pos.y, w: 400, h: 300 };

     // Prefer non-overlap over staying inside a packed viewport.
    expect(rectsOverlap(candidate, obstacles[0], viewport.gap)).toBe(false);
    expect(pos.x).toBeGreaterThanOrEqual(viewport.left);
    expect(pos.y).toBeGreaterThanOrEqual(obstacles[0].y + obstacles[0].h);
  });

  it("snaps to grid when snapGrid enabled", () => {
    const pos = findNonOverlappingPosition(400, 300, [], viewport, {
      snapGrid: true,
    });

    expect(pos.x % GRID_SIZE).toBe(0);

    expect(pos.y % GRID_SIZE).toBe(0);
  });

  it("snaps placement to grid with obstacles when snapGrid enabled", () => {
    const obstacles = [{ x: viewport.left, y: viewport.top, w: 400, h: 400 }];

    const pos = findNonOverlappingPosition(400, 300, obstacles, viewport, {
      snapGrid: true,
    });

    expect(pos.x % GRID_SIZE).toBe(0);

    expect(pos.y % GRID_SIZE).toBe(0);

    const candidate = { x: pos.x, y: pos.y, w: 400, h: 300 };

    for (const obstacle of obstacles) {
      expect(rectsOverlap(candidate, obstacle, viewport.gap)).toBe(false);
    }
  });

  it("grid-aligns cascade past obstacles when viewport is full", () => {
    const obstacles = [
      {
        x: viewport.left,

        y: viewport.top,

        w: viewport.right - viewport.left,

        h: viewport.bottom - viewport.top - 40,
      },
    ];

    const pos = findNonOverlappingPosition(400, 300, obstacles, viewport, {
      snapGrid: true,
    });

    expect(pos.x % GRID_SIZE).toBe(0);

    expect(pos.y % GRID_SIZE).toBe(0);

    const candidate = { x: pos.x, y: pos.y, w: 400, h: 300 };
    expect(rectsOverlap(candidate, obstacles[0], viewport.gap)).toBe(false);
  });

  it("does not snap stack-below into an overlapping grid cell", () => {
    const obstacles = [
      { x: viewport.left, y: viewport.top, w: 400, h: 400 },
      { x: viewport.left + 420, y: viewport.top, w: 400, h: 400 },
      {
        x: viewport.left,
        y: viewport.top + 420,
        w: 400,
        h: 200,
      },
    ];

    const pos = findNonOverlappingPosition(400, 300, obstacles, viewport, {
      snapGrid: true,
    });

    const candidate = { x: pos.x, y: pos.y, w: 400, h: 300 };

    expect(pos.x % GRID_SIZE).toBe(0);
    expect(pos.y % GRID_SIZE).toBe(0);

    for (const obstacle of obstacles) {
      expect(rectsOverlap(candidate, obstacle, viewport.gap)).toBe(false);
    }
  });

  it("places wide panel below chat without overlapping default coords", () => {
    const chat = { x: 240, y: 72, w: 520, h: 44 };
    const pos = findNonOverlappingPosition(880, 540, [chat], viewport, {
      snapGrid: true,
    });

    const candidate = { x: pos.x, y: pos.y, w: 880, h: 540 };

    expect(rectsOverlap(candidate, chat, viewport.gap)).toBe(false);
    expect(candidate.x + candidate.w).toBeLessThanOrEqual(viewport.right);
    expect(candidate.y + candidate.h).toBeLessThanOrEqual(viewport.bottom);
  });

  it("opens many career-sized panels without pairwise overlap (expanded Menu free canvas)", () => {
    const free: ViewportLayoutConfig = {
      left: 234,
      top: 24,
      right: 1256,
      bottom: 776,
      gap: 16,
    };
    const sizes: Array<{ id: string; w: number; h: number }> = [
      { id: "chat", w: 400, h: 620 },
      { id: "open-positions", w: 440, h: 540 },
      { id: "resources", w: 440, h: 540 },
      { id: "growth-paths", w: 440, h: 540 },
      { id: "applications", w: 440, h: 540 },
      { id: "artifacts", w: 420, h: 340 },
    ];
    const placed: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];

    for (const size of sizes) {
      const pos = findNonOverlappingPosition(size.w, size.h, placed, free, {
        snapGrid: true,
      });
      const rect = { id: size.id, x: pos.x, y: pos.y, w: size.w, h: size.h };
      expect(pos.x).toBeGreaterThanOrEqual(free.left);
      expect(pos.y).toBeGreaterThanOrEqual(free.top);
      for (const prior of placed) {
        expect(rectsOverlap(rect, prior, free.gap)).toBe(false);
      }
       // Distinct origins — never stack on the same top-left.
      for (const prior of placed) {
        expect(rect.x === prior.x && rect.y === prior.y).toBe(false);
      }
      placed.push(rect);
    }

    expect(placed).toHaveLength(sizes.length);
  });
});

describe("organizePanelsResponsive", () => {
  it("assigns non-overlapping layouts for multiple panels", () => {
    const layouts = organizePanelsResponsive(
      [
        { id: "chat", w: 520, h: 480, minW: 420, minH: 420, priority: 0 },

        { id: "resources", w: 560, h: 520, minW: 460, minH: 380, priority: 30 },

        {
          id: "open-positions",
          w: 640,
          h: 560,
          minW: 500,
          minH: 420,
          priority: 10,
        },
      ],

      viewport);

    const rects = Object.values(layouts);

    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        expect(rectsOverlap(rects[i], rects[j], viewport.gap)).toBe(false);
      }
    }
  });

  it("uses single column on narrow viewports", () => {
    const narrow = getViewportLayoutConfig({
      viewportWidth: 500,

      viewportHeight: 800,

      navSidebarExpanded: false,
    });

    const layouts = organizePanelsResponsive(
      [
        { id: "a", w: 400, h: 300, minW: 280, minH: 200, priority: 0 },

        { id: "b", w: 400, h: 300, minW: 280, minH: 200, priority: 1 },
      ],

      narrow);

    expect(layouts.a.x).toBe(narrow.left);

    expect(layouts.b.x).toBe(narrow.left);

    expect(layouts.b.y).toBeGreaterThan(layouts.a.y + layouts.a.h);
  });

  it("grid-aligns when snapGrid is true", () => {
    const layouts = organizePanelsResponsive(
      [{ id: "chat", w: 520, h: 480, minW: 420, minH: 420, priority: 0 }],

      viewport,

      { snapGrid: true });

    const layout = layouts.chat;

    expect(layout.x % GRID_SIZE).toBe(0);

    expect(layout.y % GRID_SIZE).toBe(0);

    expect(layout.w % GRID_SIZE).toBe(0);

    expect(layout.h % GRID_SIZE).toBe(0);
  });

  it("grid-aligns all panels when snapGrid is true", () => {
    const layouts = organizePanelsResponsive(
      [
        { id: "chat", w: 520, h: 480, minW: 420, minH: 420, priority: 0 },

        { id: "resources", w: 560, h: 520, minW: 460, minH: 380, priority: 30 },

        {
          id: "open-positions",
          w: 640,
          h: 560,
          minW: 500,
          minH: 420,
          priority: 10,
        },
      ],

      viewport,

      { snapGrid: true });

    for (const layout of Object.values(layouts)) {
      expect(layout.x % GRID_SIZE).toBe(0);

      expect(layout.y % GRID_SIZE).toBe(0);

      expect(layout.w % GRID_SIZE).toBe(0);

      expect(layout.h % GRID_SIZE).toBe(0);
    }
  });

  it("packs snapped columns tightly without horizontal voids", () => {
    const layouts = organizePanelsResponsive(
      [
        { id: "chat", w: 520, h: 480, minW: 420, minH: 420, priority: 0 },
        { id: "resources", w: 560, h: 520, minW: 460, minH: 380, priority: 30 },
      ],
      viewport,
      { snapGrid: true });

    const chat = layouts.chat;
    const resources = layouts.resources;

    expect(resources.x).toBe(chat.x + chat.w + GRID_SIZE);
    expect(resources.y).toBe(chat.y);
  });

  it("uses actual panel widths with consistent gap in flow layout", () => {
    const layouts = organizePanelsResponsive(
      [
        { id: "chat", w: 520, h: 480, minW: 420, minH: 420, priority: 0 },
        { id: "resources", w: 560, h: 520, minW: 460, minH: 380, priority: 30 },
        {
          id: "open-positions",
          w: 640,
          h: 560,
          minW: 500,
          minH: 420,
          priority: 10,
        },
      ],
      viewport,
      { snapGrid: true });

    const rects = Object.values(layouts);
    const contentWidth = viewport.right - viewport.left;

    for (const layout of rects) {
      expect(layout.w).toBeLessThanOrEqual(contentWidth);
      expect(layout.w % GRID_SIZE).toBe(0);
    }

    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        expect(rectsOverlap(rects[i], rects[j], GRID_SIZE)).toBe(false);
      }
    }
  });

  it("wraps to next row when panels exceed content width", () => {
    const narrow = getViewportLayoutConfig({
      viewportWidth: 700,
      viewportHeight: 900,
      navSidebarExpanded: false,
    });

    const layouts = organizePanelsResponsive(
      [
        { id: "a", w: 400, h: 300, minW: 280, minH: 200, priority: 0 },
        { id: "b", w: 400, h: 300, minW: 280, minH: 200, priority: 1 },
      ],
      narrow,
      { snapGrid: true });

    expect(layouts.b.y).toBeGreaterThan(layouts.a.y);
  });
});

describe("ensurePanelVisible", () => {
  it("adjusts pan when panel extends past viewport edges", () => {
    const panelRect = { x: 900, y: 700, w: 400, h: 300 };

    const pan = ensurePanelVisible(panelRect, { x: 0, y: 0 }, viewport);

    expect(panelRect.x + pan.x + panelRect.w).toBeLessThanOrEqual(
      viewport.right);

    expect(panelRect.y + pan.y + panelRect.h).toBeLessThanOrEqual(
      viewport.bottom);
  });

  it("returns negative pan delta when panel extends past right and bottom", () => {
    const panelRect = { x: 900, y: 700, w: 400, h: 300 };

    const pan = ensurePanelVisible(panelRect, { x: 0, y: 0 }, viewport);

    const overflowRight = panelRect.x + panelRect.w - viewport.right;

    const overflowBottom = panelRect.y + panelRect.h - viewport.bottom;

    expect(pan.x).toBe(-overflowRight);

    expect(pan.y).toBe(-overflowBottom);
  });

  it("returns positive pan delta when panel extends past left and top", () => {
    const panelRect = { x: 0, y: 0, w: 400, h: 300 };

    const pan = ensurePanelVisible(panelRect, { x: 0, y: 0 }, viewport);

    expect(pan.x).toBe(viewport.left - panelRect.x);

    expect(pan.y).toBe(viewport.top - panelRect.y);
  });
});

describe("voice dock layout", () => {
  it("docks whenever voice panel is visible", () => {
    expect(shouldDockVoicePanel(999_999, false)).toBe(false);
    expect(shouldDockVoicePanel(0, true)).toBe(true);
    expect(shouldDockVoicePanel(999_999, true)).toBe(true);
  });

  it("computes NavSidebar height from item count", () => {
    const collapsed = computeNavSidebarHeight(false, NAV_SIDEBAR_DEFAULT_ITEM_COUNT);
    const expanded = computeNavSidebarHeight(true, NAV_SIDEBAR_DEFAULT_ITEM_COUNT);
    expect(collapsed).toBeGreaterThan(0);
    expect(expanded).toBeGreaterThan(0);
    expect(expanded).toBeLessThan(collapsed);
  });

  it("returns sidebar-width dock layout flush under NavSidebar", () => {
    const collapsed = getVoiceDockLayout({
      navSidebarExpanded: false,
      sidebarItemCount: NAV_SIDEBAR_DEFAULT_ITEM_COUNT,
    });

    expect(collapsed.w).toBe(44);
    expect(collapsed.x).toBe(12);
    expect(collapsed.y).toBe(
      NAV_SIDEBAR_TOP + computeNavSidebarHeight(false, NAV_SIDEBAR_DEFAULT_ITEM_COUNT));
    const expanded = getVoiceDockLayout({
      navSidebarExpanded: true,
      sidebarItemCount: NAV_SIDEBAR_DEFAULT_ITEM_COUNT,
    });

    expect(expanded.w).toBe(210);
    expect(expanded.y).toBe(
      NAV_SIDEBAR_TOP + computeNavSidebarHeight(true, NAV_SIDEBAR_DEFAULT_ITEM_COUNT));
  });

  it("returns sidebar column height with optional voice stack", () => {
    const sidebarOnly = getSidebarColumnLayout({
      navSidebarExpanded: true,
      sidebarItemCount: NAV_SIDEBAR_DEFAULT_ITEM_COUNT,
      voiceVisible: false,
    });
    const withVoice = getSidebarColumnLayout({
      navSidebarExpanded: true,
      sidebarItemCount: NAV_SIDEBAR_DEFAULT_ITEM_COUNT,
      voiceVisible: true,
    });

    expect(sidebarOnly.y).toBe(NAV_SIDEBAR_TOP);
    expect(sidebarOnly.h).toBe(
      computeNavSidebarHeight(true, NAV_SIDEBAR_DEFAULT_ITEM_COUNT));
    expect(withVoice.h).toBeGreaterThan(sidebarOnly.h);
    expect(withVoice.h - sidebarOnly.h).toBe(188);
  });

  it("returns compact chat defaults aligned to content-left and fixed sidebar+voice height", () => {
    const viewport = getViewportLayoutConfig({
      viewportWidth: 1280,
      viewportHeight: 900,
      navSidebarExpanded: true,
    });

    const targetHeight = getChatColumnTargetHeight(
      true,
      NAV_SIDEBAR_DEFAULT_ITEM_COUNT);
    expect(targetHeight).toBe(
      computeNavSidebarHeight(true, NAV_SIDEBAR_DEFAULT_ITEM_COUNT) +
        VOICE_DOCK_PANEL_H);
    const withoutVoice = getDefaultChatLayout({
      viewport,
      navSidebarExpanded: true,
      sidebarItemCount: NAV_SIDEBAR_DEFAULT_ITEM_COUNT,
      snapGrid: true,
    });

    expect(withoutVoice.x).toBe(snapToGrid(viewport.left));
    expect(withoutVoice.y).toBe(snapToGrid(NAV_SIDEBAR_TOP));
    expect(withoutVoice.w).toBe(DEFAULT_CHAT_WIDTH);
    expect(withoutVoice.h).toBe(snapToGrid(targetHeight));

    const withVoice = getDefaultChatLayout({
      viewport,
      navSidebarExpanded: true,
      sidebarItemCount: NAV_SIDEBAR_DEFAULT_ITEM_COUNT,
      snapGrid: true,
    });

    expect(withVoice.w).toBe(DEFAULT_CHAT_WIDTH);
    expect(withVoice.h).toBe(withoutVoice.h);
    expect(withVoice.w % GRID_SIZE).toBe(0);
    expect(withVoice.h % GRID_SIZE).toBe(0);
    expect(withVoice.w).toBeLessThan(520);
    expect(withVoice.w).toBeGreaterThanOrEqual(DEFAULT_CHAT_MIN_WIDTH);
  });
});
