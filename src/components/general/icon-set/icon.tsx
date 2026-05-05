import * as React from "react";

export type IconName =
  | "chevron"
  | "chright"
  | "chdown"
  | "plus"
  | "close"
  | "search"
  | "doc"
  | "yaml"
  | "grid"
  | "sliders"
  | "board"
  | "chat"
  | "logs"
  | "overview"
  | "artifact"
  | "sun"
  | "moon"
  | "play"
  | "pause"
  | "refresh"
  | "download"
  | "star"
  | "starfill"
  | "expand"
  | "collapse"
  | "send"
  | "code"
  | "table"
  | "quote"
  | "list"
  | "spark"
  | "check"
  | "dot"
  | "sort"
  | "filter"
  | "arrowR"
  | "layers";

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const PATHS: Record<IconName, React.ReactNode> = {
  chevron:  <polyline points="6 9 12 15 18 9" />,
  chright:  <polyline points="9 6 15 12 9 18" />,
  chdown:   <polyline points="6 9 12 15 18 9" />,
  plus:     <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  close:    <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
  search:   <><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></>,
  doc:      <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><polyline points="14 3 14 8 19 8" /></>,
  yaml:     <><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="8" y1="9" x2="14" y2="9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" /></>,
  grid:     <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
  sliders:  <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="9"  cy="6"  r="2" fill="currentColor" /><circle cx="15" cy="12" r="2" fill="currentColor" /><circle cx="7"  cy="18" r="2" fill="currentColor" /></>,
  board:    <><rect x="3" y="4" width="18" height="14" rx="1.5" /><line x1="3" y1="9" x2="21" y2="9" /></>,
  chat:     <path d="M4 5h16v11H8l-4 4z" />,
  logs:     <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="14" y2="17" /></>,
  overview: <><circle cx="12" cy="12" r="8" /><line x1="12" y1="4" x2="12" y2="12" /><line x1="12" y1="12" x2="17" y2="14" /></>,
  artifact: <><path d="M5 4h10l4 4v12a1 1 0 0 1-1 1H5z" /><polyline points="15 4 15 8 19 8" /></>,
  sun:      <><circle cx="12" cy="12" r="4" /><line x1="12" y1="3"  x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21" /><line x1="3"  y1="12" x2="5"  y2="12" /><line x1="19" y1="12" x2="21" y2="12" /><line x1="5.6" y1="5.6"  x2="7" y2="7" /><line x1="17" y1="17" x2="18.4" y2="18.4" /><line x1="5.6" y1="18.4" x2="7" y2="17" /><line x1="17" y1="7"  x2="18.4" y2="5.6" /></>,
  moon:     <path d="M20 14a8 8 0 1 1-8-10 6 6 0 0 0 8 10z" />,
  play:     <polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none" />,
  pause:    <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
  refresh:  <><polyline points="20 4 20 10 14 10" /><path d="M4 14a8 8 0 0 0 14 4l2-4" /><polyline points="4 20 4 14 10 14" /><path d="M20 10a8 8 0 0 0-14-4l-2 4" /></>,
  download: <><path d="M12 4v12" /><polyline points="6 12 12 18 18 12" /><line x1="4" y1="20" x2="20" y2="20" /></>,
  star:     <polygon points="12 3 14.5 9 21 9.5 16 14 17.5 21 12 17.5 6.5 21 8 14 3 9.5 9.5 9" />,
  starfill: <polygon points="12 3 14.5 9 21 9.5 16 14 17.5 21 12 17.5 6.5 21 8 14 3 9.5 9.5 9" fill="currentColor" stroke="none" />,
  expand:   <><polyline points="4 9 4 4 9 4" /><polyline points="20 9 20 4 15 4" /><polyline points="4 15 4 20 9 20" /><polyline points="20 15 20 20 15 20" /></>,
  collapse: <><polyline points="9 4 9 9 4 9" /><polyline points="15 4 15 9 20 9" /><polyline points="9 20 9 15 4 15" /><polyline points="15 20 15 15 20 15" /></>,
  send:     <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9" fill="currentColor" stroke="none" opacity="0.18" /><polyline points="22 2 11 13 15 22" /><polyline points="22 2 2 9 11 13" /></>,
  code:     <><polyline points="16 6 22 12 16 18" /><polyline points="8 6 2 12 8 18" /></>,
  table:    <><rect x="3" y="4" width="18" height="16" rx="1" /><line x1="3" y1="9"  x2="21" y2="9" /><line x1="3" y1="14" x2="21" y2="14" /><line x1="9" y1="4"  x2="9"  y2="20" /></>,
  quote:    <><path d="M7 7h4v4H7zM7 11c0 4 4 6 4 6" /><path d="M14 7h4v4h-4zM14 11c0 4 4 6 4 6" /></>,
  list:     <><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="5" cy="6" r="1" fill="currentColor" /><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="5" cy="18" r="1" fill="currentColor" /></>,
  spark:    <polyline points="3 17 8 12 12 14 16 8 21 13" />,
  check:    <polyline points="5 12 10 17 19 7" />,
  dot:      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />,
  sort:     <><polyline points="8 9 12 5 16 9" /><polyline points="8 15 12 19 16 15" /></>,
  filter:   <polygon points="4 4 20 4 14 12 14 19 10 19 10 12" />,
  arrowR:   <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></>,
  layers:   <><polygon points="12 3 22 8 12 13 2 8" /><polyline points="2 13 12 18 22 13" /></>,
};

/**
 * 40-glyph stroke icon set ported from the orchestration prototype.
 * Independent of lucide so the prototype's chrome can be reproduced exactly.
 */
export const Icon: React.FC<IconProps> = ({ name, size = 16, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {PATHS[name]}
  </svg>
);
