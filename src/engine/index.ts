/**
 * Engine SPI barrel. The contract lives singular in src/engine/;
 * implementations live under the engine directory (src/engines/tldraw/ since
 * P0, src/engines/ after the P4 rename wave) per.
 */
export type {
  CameraState,
  CanvasEngine,
  CanvasMode,
  EngineCapabilities,
  EngineEventMap,
  EngineHandle,
  EngineLifecycleEvent,
  EngineLifecycleHandle,
  EngineMountOptions,
  EnginePanelPlacement,
  PanelInstanceId,
  PlaceOptions,
  Rect,
  ViewportInfo,
  WorkspaceLayoutRecord,
} from './types';
