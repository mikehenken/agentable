export interface PanelLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  autoHeight?: boolean;
  resizable?: boolean;
  minW?: number;
  minH?: number;
  minimized?: boolean;
}

export type PanelId =
  | 'nav'
  | 'chat'
  | 'artifacts'
  | 'open-positions'
  | 'applications'
  | 'resources'
  | 'career-tools'
  | 'growth-paths'
  | 'career-trajectories'
  | 'voice'
  | 'journey'
  | 'settings';

export interface Message {
  id: string;
  text: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  quickChips?: string[];
}

export interface Artifact {
  id: string;
  name: string;
  type: string;
  size: string;
  source: 'upload' | 'generated';
  timestamp: string;
}

export interface DockPosition {
  dock: 'top' | 'bottom' | 'left' | 'right' | 'hidden';
}
