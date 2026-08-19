export {
  GRID_SIZE,
  snapToGrid,
  snapRect,
  findNonOverlappingPosition,
  getViewportLayoutConfig,
  getVoiceDockLayout,
  rectsOverlap,
  type LayoutRect,
  type ViewportLayoutConfig,
} from './panelLayoutEngine';

export {
  GRID_COLUMNS,
  GRID_ROW_HEIGHT,
  GRID_GUTTER,
  GRID_REFERENCE_WIDTH,
  createGridSpec,
  gridSpanToSize,
  rectsOverlapWithGap,
  getPanelGridSpan,
  type GridSpec,
  type GridCellPlacement,
} from './gridLayout';
