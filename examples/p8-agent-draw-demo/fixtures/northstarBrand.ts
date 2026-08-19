/**

 * Fictional Northstar Atelier fixtures for P8 draw + see demo.

 * No real clients or competitor brands.

 */



export const NORTHSTAR_BRAND = {

  name: 'Northstar Atelier',

  tagline: 'Creative studio workflow — agent draw & see',

  tenant: 'northstar-atelier',

} as const;



export const NORTHSTAR_AGENT = {

  agentId: 'northstar-designer',

  agentLabel: 'Astra (Design Agent)',

} as const;



/** Logical flow diagram — structure only, no coordinates (draw_shapes auto-layout). */

export const NORTHSTAR_FLOW_DIAGRAM = {

  layout: 'timeline' as const,

  diagram: {

    nodes: [

      { id: 'brief', label: 'Client brief' },

      { id: 'moodboard', label: 'Moodboard' },

      { id: 'concepts', label: 'Concept sketches' },

      { id: 'delivery', label: 'Final delivery' },

    ],

    edges: [

      { from: 'brief', to: 'moodboard' },

      { from: 'moodboard', to: 'concepts' },

      { from: 'concepts', to: 'delivery' },

    ],

  },

  /** Narrow vertical stack — fits ~940px desktop and ~390px mobile canvas hosts. */
  placement: { kind: 'rect' as const, x: 48, y: 48, w: 260, h: 520 },

};



/** Explicit shape batch with provenance (no diagram auto-layout). */

export const NORTHSTAR_SHAPE_BATCH = {

  shapes: [

    {

      kind: 'box' as const,

      text: 'Northstar Atelier',

      geometry: { kind: 'rect' as const, x: 48, y: 600, w: 260, h: 88 },

      style: { color: 'violet', fill: 'solid', size: 'l' },

    },

    {

      kind: 'text' as const,

      text: 'Agent-stamped marks carry meta.agentableAgent',

      geometry: { kind: 'text' as const, x: 48, y: 700, maxWidth: 280 },

      style: { color: 'light-blue', size: 'm' },

    },

  ],

};


