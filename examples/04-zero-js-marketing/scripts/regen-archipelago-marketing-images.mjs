#!/usr/bin/env node
/**
 * Regenerate Archipelago Resorts marketing photography for gallery example 04.
 *
 * Uses Gemini image generation (`gemini-3.1-pro-image-preview` by default) via
 * `@google/genai` to replace Sandals careers-site source assets with fictional
 * Archipelago Resorts imagery of matching composition quality.
 *
 * Usage (from agentable-canvas repo root):
 *
 * node examples/04-zero-js-marketing/scripts/regen-archipelago-marketing-images.mjs --dry-run
 * node examples/04-zero-js-marketing/scripts/regen-archipelago-marketing-images.mjs
 * node examples/04-zero-js-marketing/scripts/regen-archipelago-marketing-images.mjs --force
 * node examples/04-zero-js-marketing/scripts/regen-archipelago-marketing-images.mjs --only=hero-team-collage,resort-jamaica
 *
 * Flags:
 * --dry-run Print prompts plan only; do not call the API
 * --force Overwrite existing outputs (default skips existing files)
 * --only=a,b Comma-separated asset ids to generate
 * --model=id Override model (default: gemini-3-pro-image — verified GA Pro Image).
 * Owner-requested gemini-3.1-pro-image-preview currently 404s on v1beta.
 * --fallback=id Override fallback model (default: gemini-3.1-flash-image)
 * --size=1K|2K|4K Image size hint (default: 2K)
 *
 * API key resolution (first match wins):
 * 1. process.env.GEMINI_API_KEY
 * 2. process.env.GOOGLE_API_KEY
 * 3. process.env.GOOGLE_GENAI_API_KEY
 * 4. process.env.VITE_GEMINI_API_KEY
 * 5. GEMINI_API_KEY GOOGLE_API_KEY VITE_GEMINI_API_KEY from nearby.env.local files
 *
 * Never commit secrets. Outputs land in examples/04-zero-js-marketing/assets/.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXAMPLE_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(EXAMPLE_ROOT, 'assets');
const MANIFEST_PATH = path.join(__dirname, 'archipelago-image-manifest.json');
const PROMPTS_PATH = path.join(__dirname, 'archipelago-image-prompts.json');
const REPO_ROOT = path.resolve(EXAMPLE_ROOT, '..', '..');

/**
 * Default image model (verified 2026-07-25 against Gemini Developer API v1beta):
 *
 * | Model id | Result |
 * |----------------------------------|---------------------------------------------|
 * | gemini-3.1-pro-image-preview | 404 (owner-requested; not published) |
 * | gemini-3-pro-image-preview | retired returns empty candidates |
 * | gemini-3-pro-image | OK — GA Nano Banana Pro (default) |
 * | gemini-3.1-flash-image-preview | OK |
 * | gemini-3.1-flash-image | OK — GA Flash Image (fallback) |
 *
 * Pass `--model=gemini-3.1-pro-image-preview` to retry when Google publishes that id.
 */
const DEFAULT_MODEL = 'gemini-3-pro-image';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.1-flash-image';
const OWNER_REQUESTED_MODEL = 'gemini-3.1-pro-image-preview';
const DEFAULT_IMAGE_SIZE = '2K';

/** Shared visual system appended (or embedded) so the set grades consistently. */
const VISUAL_SYSTEM = [
  'Photorealistic editorial luxury hospitality photography for Archipelago Resorts,',
  'a fictional Caribbean-island resort company.',
  'Warm golden-hour color grade with amber highlights and natural teal ocean accents,',
  'soft directional natural light, shallow depth of field where appropriate,',
  'magazine travel-editorial quality, sharp subject focus, believable skin tones,',
  'no plastic AI look, no oversharpening.',
].join(' ');

const NEGATIVE = [
  'Do NOT include: Sandals, Beaches, Moss, Sandy, any real Sandals or Beaches property names,',
  'readable brand logos, embroidered brand wordmarks on uniforms, watermarks, captions,',
  'UI chrome, stock-photo watermarks, deformed hands, extra fingers, melted faces,',
  'text overlays, typography burned into the image, QR codes, or celebrity likenesses.',
].join(' ');

/**
 * @typedef {'1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9'} AspectRatio
 *
 * @typedef {object} AssetSpec
 * @property {string} id
 * @property {string} sourcePath Sandals website relative path
 * @property {string} purpose
 * @property {string} outputFile Filename under assets/
 * @property {AspectRatio} aspectRatio
 * @property {string} prompt
 * @property {'photo' | 'logo' | 'texture' | 'wordmark'} kind
 * @property {string[]} [usedBy]
 *** @type {AssetSpec[]} */
const ASSETS = [
  {
    id: 'hero-team-collage',
    sourcePath: 'public/images/hero-team-collage.jpg',
    purpose: 'Full-bleed careers hero collage (multi-scene hospitality staff)',
    outputFile: 'hero-team-collage.jpg',
    aspectRatio: '16:9',
    kind: 'photo',
    usedBy: ['#hero background'],
    prompt: [
      VISUAL_SYSTEM,
      'Create a single seamless cinematic collage banner (16:9) for Archipelago Resorts careers.',
      'LEFT (largest panel): Caribbean male executive chef in crisp white jacket and tall toque,',
      'carefully plating a gourmet dish with a small sauce pot; soft focus luxury kitchen behind;',
      'NO logos on the coat — plain white fabric only.',
      'TOP RIGHT: Caribbean female guest-services associate in navy blazer warmly greeting a',
      'young family at an open-air stone resort entrance at golden hour; genuine candid smiles.',
      'BOTTOM RIGHT: Caribbean female groundskeeper in straw sun hat and green apron tending',
      'vibrant pink hibiscus among lush tropical foliage.',
      'Blend the three scenes with a wide warm amber/brown soft-focus transition band in the center',
      '(space for headline text later, but DO NOT render any text).',
      'Consistent warm color grade across all panels. Editorial Caribbean hospitality.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'hero-caribbean',
    sourcePath: 'public/images/hero-caribbean.jpg',
    purpose: 'Alt hero Bahamas resort portal card',
    outputFile: 'hero-caribbean.jpg',
    aspectRatio: '16:9',
    kind: 'photo',
    usedBy: ['#resorts The Bahamas card'],
    prompt: [
      VISUAL_SYSTEM,
      'Wide cinematic landscape (16:9) of crystal-clear shallow turquoise Caribbean water over',
      'white sand, soft clouds, distant palm-lined shoreline of a fictional Archipelago Resorts',
      'island property. Elevated travel-editorial drone/coastal perspective, serene luxury mood.',
      'No boats with readable names, no buildings with signage.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'hero-cinematic',
    sourcePath: 'public/images/hero-cinematic.jpg',
    purpose: 'Alt cinematic hero plate (gallery reserve)',
    outputFile: 'hero-cinematic.jpg',
    aspectRatio: '16:9',
    kind: 'photo',
    usedBy: ['reserve future hero variants'],
    prompt: [
      VISUAL_SYSTEM,
      'Cinematic 16:9 twilight long-exposure of an Archipelago Resorts infinity pool terrace',
      'overlooking a dark teal Caribbean sea; warm lantern light on limestone architecture,',
      'silhouetted palms, luxurious quiet atmosphere. Photorealistic, no people, no signage.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'hero-dramatic',
    sourcePath: 'public/images/hero-dramatic.jpg',
    purpose: 'Alt dramatic hero plate (gallery reserve)',
    outputFile: 'hero-dramatic.jpg',
    aspectRatio: '16:9',
    kind: 'photo',
    usedBy: ['reserve future hero variants'],
    prompt: [
      VISUAL_SYSTEM,
      'Dramatic 16:9 storm-clearing sky over a fictional Archipelago Resorts cliffside villa',
      'with turquoise cove below; shafts of golden light through clouds, high-contrast editorial',
      'travel photography. No readable text or logos on buildings.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'resort-jamaica',
    sourcePath: 'public/images/resort-jamaica.jpg',
    purpose: 'Resort portal — Jamaica island card',
    outputFile: 'resort-jamaica.jpg',
    aspectRatio: '4:3',
    kind: 'photo',
    usedBy: ['#resorts Jamaica'],
    prompt: [
      VISUAL_SYSTEM,
      'Aerial drone photograph (4:3) of a fictional Archipelago Resorts property on a Jamaican',
      'Caribbean peninsula: crescent white-sand beach, cream buildings with terracotta roofs',
      'among dense palms, multiple turquoise resort pools, two white catamarans in calm bay,',
      'golden-hour warm light skimmed across water. High-end travel editorial, no signage.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'resort-stlucia',
    sourcePath: 'public/images/resort-stlucia.jpg',
    purpose: 'Resort portal — Saint Lucia island card',
    outputFile: 'resort-stlucia.jpg',
    aspectRatio: '4:3',
    kind: 'photo',
    usedBy: ['#resorts Saint Lucia'],
    prompt: [
      VISUAL_SYSTEM,
      'Elevated 4:3 view of a fictional Archipelago Resorts hillside property in Saint Lucia:',
      'lush rainforest slopes, iconic twin volcanic piton silhouettes in soft haze (generic,',
      'not labeled), infinity pools terracing toward emerald water, warm late-afternoon light.',
      'Luxury travel magazine quality, no logos or text.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'resort-barbados',
    sourcePath: 'public/images/resort-barbados.jpg',
    purpose: 'Resort portal — Barbados island card',
    outputFile: 'resort-barbados.jpg',
    aspectRatio: '4:3',
    kind: 'photo',
    usedBy: ['#resorts Barbados'],
    prompt: [
      VISUAL_SYSTEM,
      '4:3 coastal photograph of a fictional Archipelago Resorts Barbados property: pale coral',
      'stone villas, manicured lawns meeting powder sand, bright aquamarine Atlantic swell,',
      'soft morning light, refined British-Caribbean architectural cues without named landmarks',
      'or signage. Editorial hospitality photography.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'mission-people',
    sourcePath: 'public/images/mission-people.jpg',
    purpose: 'Mission pillar — people collaboration',
    outputFile: 'mission-people.jpg',
    aspectRatio: '4:3',
    kind: 'photo',
    usedBy: ['#mission People first'],
    prompt: [
      VISUAL_SYSTEM,
      '4:3 candid editorial photo of a diverse Archipelago Resorts leadership huddle on a',
      'sunlit open-air terrace overlooking turquoise water: three Caribbean hospitality',
      'professionals reviewing a tablet together, warm smiles, navy and cream uniforms without',
      'brand logos. Natural golden light, shallow depth of field, people-first culture vibe.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'mission-craft',
    sourcePath: 'public/images/mission-craft.jpg',
    purpose: 'Mission pillar — craft mastery',
    outputFile: 'mission-craft.jpg',
    aspectRatio: '4:3',
    kind: 'photo',
    usedBy: ['#mission Craft that matters'],
    prompt: [
      VISUAL_SYSTEM,
      '4:3 close editorial of craft excellence at Archipelago Resorts: Caribbean bartender',
      'precisely garnishing a crystal cocktail at a polished teak beach bar, fresh citrus and',
      'mint in soft focus, warm sidelight, teal sea bokeh behind. No brand names on glassware',
      'or uniforms. Photorealistic luxury hospitality.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'mission-continuity',
    sourcePath: 'public/images/mission-continuity.jpg',
    purpose: 'Mission pillar — tenure continuity',
    outputFile: 'mission-continuity.jpg',
    aspectRatio: '4:3',
    kind: 'photo',
    usedBy: ['#mission Continuity'],
    prompt: [
      VISUAL_SYSTEM,
      '4:3 portrait-adjacent scene of long-tenure pride: older Caribbean male housekeeper in',
      'immaculate cream uniform standing proudly beside a freshly prepared luxury suite balcony',
      'with ocean view; soft morning light, dignified expression, no logos on attire.',
      'Continuity and craftsmanship mood.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'role-instructor',
    sourcePath: 'public/images/role-instructor.jpg',
    purpose: 'Roles mosaic — ACU instructor',
    outputFile: 'role-instructor.jpg',
    aspectRatio: '1:1',
    kind: 'photo',
    usedBy: ['#roles ACU Instructor'],
    prompt: [
      VISUAL_SYSTEM,
      'Square 1:1 photo of a Caribbean woman teaching hospitality skills in a bright Archipelago',
      'Corporate University classroom on property: whiteboard behind her (blank, NO text),',
      'students listening out of focus, warm natural window light, professional instructor polo',
      'without logos. Confident, approachable educator.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'role-manager',
    sourcePath: 'public/images/role-manager.jpg',
    purpose: 'Roles mosaic — resort manager',
    outputFile: 'role-manager.jpg',
    aspectRatio: '3:2',
    kind: 'photo',
    usedBy: ['#roles Resort Manager'],
    prompt: [
      VISUAL_SYSTEM,
      '3:2 landscape of a Caribbean male resort manager in tailored navy blazer walking through',
      'a sunlit Archipelago Resorts lobby with soaring timber ceilings and tropical courtyard',
      'visible beyond glass; purposeful stride, warm hospitality leadership presence, blank',
      'name tag (no readable text). Editorial luxury interiors photography.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'role-marine',
    sourcePath: 'public/images/role-marine.jpg',
    purpose: 'Roles mosaic — marine biologist sustainability',
    outputFile: 'role-marine.jpg',
    aspectRatio: '1:1',
    kind: 'photo',
    usedBy: ['#roles Marine Biologist'],
    prompt: [
      VISUAL_SYSTEM,
      'Square 1:1 photo of a Caribbean marine biologist in a light field shirt kneeling at a',
      'coral restoration nursery table beside clear turquoise shallows at an Archipelago Resorts',
      'property; scientific trays and soft coral fragments visible, no logos on clothing or',
      'equipment labels. Bright natural sun, sustainability-forward editorial.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'role-developer',
    sourcePath: 'public/images/role-developer.jpg',
    purpose: 'Roles mosaic — software developer tech hub',
    outputFile: 'role-developer.jpg',
    aspectRatio: '3:2',
    kind: 'photo',
    usedBy: ['#roles Senior Software Developer', 'growth path corporate'],
    prompt: [
      VISUAL_SYSTEM,
      '3:2 modern tech workplace photo for Archipelago Resorts innovation hub: young Latino',
      'software developer at a clean dual-monitor desk (screens show abstract dashboards with',
      'NO readable text or logos), warm wood and teal accent interior, soft daylight,',
      'professional but island-relaxed dress code. Photorealistic corporate lifestyle.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'role-chef',
    sourcePath: 'public/images/role-chef.jpg',
    purpose: 'Roles mosaic — executive chef',
    outputFile: 'role-chef.jpg',
    aspectRatio: '3:2',
    kind: 'photo',
    usedBy: ['#roles Executive Chef', 'growth path culinary'],
    prompt: [
      VISUAL_SYSTEM,
      '3:2 portrait of a Caribbean female executive chef in white jacket and tall toque, arms',
      'crossed, confident smile, standing behind a marble prep island with fresh pineapple and',
      'whole fish; floor-to-ceiling glass opens to a wooden deck and turquoise Archipelago',
      'Resorts beach. NO embroidery or logos on coat. Golden-hour back light, luxury kitchen.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'team-maya',
    sourcePath: 'public/images/team-kerone.jpg',
    purpose: 'Testimonial portrait — Maya Ortega (replaces Sandals Kerone)',
    outputFile: 'team-maya.jpg',
    aspectRatio: '3:4',
    kind: 'photo',
    usedBy: ['#testimonials', '#publications stories', 'mission quote'],
    prompt: [
      VISUAL_SYSTEM,
      'Vertical 3:4 waist-up portrait of Maya Ortega, fictional Archipelago Resorts Director of',
      'Guest Services: Caribbean woman late 20s/early 30s, warm genuine smile, navy waistcoat',
      'with gold buttons over white shirt, blank gold name tag (no readable text). Bright lobby',
      'with large windows showing palms, white sand, and turquoise sea behind. Soft natural',
      'daylight, shallow depth of field, editorial hospitality portrait.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'team-elena',
    sourcePath: 'public/images/team-sandra.jpg',
    purpose: 'Testimonial portrait — Elena Ruiz (replaces Sandals Sandra-Lee)',
    outputFile: 'team-elena.jpg',
    aspectRatio: '3:4',
    kind: 'photo',
    usedBy: ['#testimonials', 'growth path hospitality'],
    prompt: [
      VISUAL_SYSTEM,
      'Vertical 3:4 portrait of Elena Ruiz, fictional Archipelago Resorts Assistant Concierge',
      'Manager: Caribbean Latina woman mid-30s, poised smile, cream blazer over soft teal blouse,',
      'standing near a concierge desk with tropical floral arrangement; ocean-view lobby bokeh.',
      'Blank name tag only. Soft natural light, editorial quality.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'team-marcus',
    sourcePath: 'public/images/team-andre.jpg',
    purpose: 'Testimonial portrait — Marcus Chen (replaces Sandals Andre)',
    outputFile: 'team-marcus.jpg',
    aspectRatio: '3:4',
    kind: 'photo',
    usedBy: ['#testimonials'],
    prompt: [
      VISUAL_SYSTEM,
      'Vertical 3:4 portrait of Marcus Chen, fictional Archipelago Resorts Evening Duty Manager:',
      'East Asian Caribbean man early 30s, calm confident expression, charcoal suit jacket,',
      'evening lobby lighting with warm brass lamps and soft teal ambient accents; blank name',
      'tag. Photorealistic hospitality leadership portrait.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'team-julian',
    sourcePath: 'public/images/team-carlton.jpg',
    purpose: 'Testimonial portrait — Julian Brooks (replaces Sandals Carlton)',
    outputFile: 'team-julian.jpg',
    aspectRatio: '3:4',
    kind: 'photo',
    usedBy: ['#testimonials'],
    prompt: [
      VISUAL_SYSTEM,
      'Vertical 3:4 portrait of Julian Brooks, fictional long-tenured Archipelago Resorts',
      'housekeeping star: older Caribbean man with silver-flecked hair, kind proud smile,',
      'immaculate cream uniform vest, outdoor covered walkway with tropical gardens behind.',
      'Morning light, dignified continuity vibe, blank name tag, no logos.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'logo-harbor-institute',
    sourcePath: 'public/images/logo-fiu.png',
    purpose: 'Fictional academic partner mark (replaces FIU)',
    outputFile: 'logo-harbor-institute.png',
    aspectRatio: '1:1',
    kind: 'logo',
    usedBy: ['#scu partner grid'],
    prompt: [
      'Minimal flat vector-style emblem on a pure white background for "Harbor Institute of',
      'Hospitality" — a fictional university partner of Archipelago Resorts.',
      'Simple teal (#0E7490) circular seal with a stylized lighthouse and wave line;',
      'clean geometric shapes, professional academic look.',
      'If any letters appear, only the initials "HIH" in a modern sans-serif — no other words.',
      'No gradients, no photorealism, no 3D, no Sandals/FIU/UWI marks.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'logo-coral-cay',
    sourcePath: 'public/images/logo-uwi.png',
    purpose: 'Fictional academic partner mark (replaces UWI)',
    outputFile: 'logo-coral-cay.png',
    aspectRatio: '1:1',
    kind: 'logo',
    usedBy: ['#scu partner grid'],
    prompt: [
      'Minimal flat vector-style emblem on pure white background for "Coral Cay University",',
      'a fictional Caribbean university partner of Archipelago Resorts.',
      'Gold (#C9A227) shield with a simple coral branch and open book icon;',
      'clean academic heraldry, geometric, no photorealism.',
      'If letters appear, only "CCU". No other text. No real university seals.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'logo-tide-trust',
    sourcePath: 'public/images/logo-heart.png',
    purpose: 'Fictional workforce partner mark (replaces HEART/NSTA)',
    outputFile: 'logo-tide-trust.png',
    aspectRatio: '1:1',
    kind: 'logo',
    usedBy: ['#scu partner grid'],
    prompt: [
      'Minimal flat vector-style emblem on pure white background for "Tide Workforce Trust",',
      'a fictional Caribbean skills partnership with Archipelago Resorts.',
      'Warm coral/orange (#F4A261) circular mark with interlocking wave and handshake icons;',
      'friendly NGO aesthetic, flat design, no photorealism.',
      'If letters appear, only "TWT". No HEART/NSTA or government seals.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'brand-wordmark',
    sourcePath: 'public/images/sandals-logo.png',
    purpose: 'Archipelago Resorts wordmark (replaces Sandals logo)',
    outputFile: 'brand-wordmark.png',
    aspectRatio: '21:9',
    kind: 'wordmark',
    usedBy: ['optional brand asset; HTML uses CSS mark by default'],
    prompt: [
      'Clean luxury wordmark logo on pure white background for "Archipelago Resorts".',
      'Elegant modern serif or refined geometric sans-serif lettering in deep navy (#1A1A2E)',
      'with a small teal (#0E7490) wave accent under the word Archipelago.',
      'Wide horizontal lockup (ultrawide 21:9 framing), generous padding, no tagline,',
      'no extra icons beyond the subtle wave.',
      'No Sandals script style, no palm-tree clichés stacked on letters.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'paper-texture',
    sourcePath: 'public/images/paper-texture.jpg',
    purpose: 'Subtle CSS paper texture overlay',
    outputFile: 'paper-texture.jpg',
    aspectRatio: '1:1',
    kind: 'texture',
    usedBy: ['styles (optional texture)'],
    prompt: [
      'Seamless square high-resolution fine paper texture: warm off-white fiber grain,',
      'very subtle, even lighting, no stains, no text, no logos, no photographs of objects.',
      'Suitable as a barely-visible CSS overlay for a luxury dark hospitality site.',
      NEGATIVE,
    ].join(' '),
  },
];

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ dryRun: boolean, force: boolean, only: Set<string> | null, model: string, fallback: string, size: string }} */
  const opts = {
    dryRun: false,
    force: false,
    only: null,
    model: DEFAULT_MODEL,
    fallback: DEFAULT_FALLBACK_MODEL,
    size: DEFAULT_IMAGE_SIZE,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--force') {
      opts.force = true;
    } else if (arg.startsWith('--only=')) {
      const list = arg.slice('--only='.length).split(',').map((s) => s.trim).filter(Boolean);
      opts.only = new Set(list);
    } else if (arg.startsWith('--model=')) {
      opts.model = arg.slice('--model='.length).trim || DEFAULT_MODEL;
    } else if (arg.startsWith('--fallback=')) {
      opts.fallback = arg.slice('--fallback='.length).trim || DEFAULT_FALLBACK_MODEL;
    } else if (arg.startsWith('--size=')) {
      opts.size = arg.slice('--size='.length).trim || DEFAULT_IMAGE_SIZE;
    } else if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelpAndExit(1);
    }
  }

  return opts;
}

/**
 * @param {number} code
 */
function printHelpAndExit(code) {
  console.log(`Usage: node regen-archipelago-marketing-images.mjs [flags]
  --dry-run --force --only=id1,id2 --model=... --fallback=... --size=1K|2K|4K`);
  process.exit(code);
}

/**
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function parseEnvFile(filePath) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(filePath)) {
    return out;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim;
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim;
    let value = line.slice(eq + 1).trim;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * @returns {{ key: string, source: string } | null}
 */
function resolveApiKey {
  const envKeys = [
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'GOOGLE_GENAI_API_KEY',
    'VITE_GEMINI_API_KEY',
  ];

  for (const name of envKeys) {
    const value = process.env[name]?.trim;
    if (value) {
      return { key: value, source: `env:${name}` };
    }
  }

  const envFiles = [
    path.join(REPO_ROOT, '.env.local'),
    path.join(REPO_ROOT, '.env'),
    path.join(EXAMPLE_ROOT, '.env.local'),
    path.resolve(REPO_ROOT, '..', '..', 'landi-canvas-studio', '.env.local'),
    path.resolve(REPO_ROOT, '..', '..', 'landing-editor', '.env.local'),
    path.resolve(REPO_ROOT, '..', 'landi-canvas-studio', '.env.local'),
    path.resolve(REPO_ROOT, '..', 'landing-editor', '.env.local'),
    'C:\\Users\\mikeh\\Projects\\landi\\landi-canvas-studio\\.env.local',
    'C:\\Users\\mikeh\\Projects\\landi\\landing-editor\\.env.local',
  ];

  for (const filePath of envFiles) {
    const parsed = parseEnvFile(filePath);
    for (const name of envKeys) {
      const value = parsed[name]?.trim;
      if (value) {
        return { key: value, source: `${filePath}:${name}` };
      }
    }
  }

  return null;
}

/**
 * @param {string} base64
 * @param {string} mimeType
 * @param {string} preferredExt
 */
function bufferFromInline(base64, mimeType, preferredExt) {
  const buf = Buffer.from(base64, 'base64');
  let ext = preferredExt;
  if (mimeType.includes('png')) {
    ext = '.png';
  } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    ext = '.jpg';
  } else if (mimeType.includes('webp')) {
    ext = '.webp';
  }
  return { buf, ext };
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {unknown} err
 */
function isRetryableError(err) {
  const message = err instanceof Error ? err.message: String(err);
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket|429|503|502|504|RESOURCE_EXHAUSTED|UNAVAILABLE|abort/i.test(
    message);
}

/**
 * @param {import('@google/genai').GoogleGenAI} ai
 * @param {AssetSpec} asset
 * @param {{ model: string, fallback: string, size: string }} opts
 * @param {number} [maxAttemptsPerModel]
 */
async function generateOne(ai, asset, opts, maxAttemptsPerModel = 4) {
  const modelsToTry = [opts.model, opts.fallback].filter(
    (m, i, arr) => m && arr.indexOf(m) === i);

  /** @type {Error | null} */
  let lastError = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: asset.prompt,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: asset.aspectRatio,
              imageSize: opts.size,
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const { buf } = bufferFromInline(
              part.inlineData.data,
              mimeType,
              path.extname(asset.outputFile) || '.png');
            return {
              model,
              mimeType,
              buffer: buf,
              outputFile: asset.outputFile,
            };
          }
        }

        lastError = new Error(`Model ${model} returned no image parts`);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err: new Error(String(err));
        const retryable = isRetryableError(lastError);
        console.warn(
          ` ! model ${model} attempt ${attempt}/${maxAttemptsPerModel} failed: ${lastError.message}`);
        if (!retryable || attempt === maxAttemptsPerModel) {
          break;
        }
        const delayMs = Math.min(30_000, 1500 * 2 ** (attempt - 1));
        console.warn(` … retrying in ${delayMs}ms`);
        await sleep(delayMs);
      }
    }
  }

  throw lastError ?? new Error('Image generation failed');
}

/**
 * @param {AssetSpec[]} assets
 * @param {object} meta
 */
function writeManifest(assets, meta) {
  const payload = {
    generatedAt: new Date.toISOString,
    model: meta.model,
    fallbackModel: meta.fallback,
    imageSize: meta.size,
    dryRun: meta.dryRun,
    brand: 'Archipelago Resorts',
    note: 'Fictional Caribbean hospitality brand. No Sandals/Beaches/Moss trademarks.',
    assets: assets.map((a) => ({
      id: a.id,
      source: a.sourcePath,
      purpose: a.purpose,
      output: `assets/${a.outputFile}`,
      aspectRatio: a.aspectRatio,
      kind: a.kind,
      usedBy: a.usedBy ?? [],
      status: meta.statuses[a.id] ?? 'pending',
      error: meta.errors[a.id] ?? null,
    })),
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const promptsPayload = {
    visualSystem: VISUAL_SYSTEM,
    negative: NEGATIVE,
    assets: assets.map((a) => ({
      id: a.id,
      outputFile: a.outputFile,
      aspectRatio: a.aspectRatio,
      prompt: a.prompt,
    })),
  };
  fs.writeFileSync(PROMPTS_PATH, `${JSON.stringify(promptsPayload, null, 2)}\n`, 'utf8');
}

/**
 * Remove obsolete Sandals-named files once Archipelago replacements exist.
 */
function cleanupLegacyFiles {
  const legacy = [
    'sandals-logo.png',
    'team-kerone.jpg',
    'team-sandra.jpg',
    'team-andre.jpg',
    'team-carlton.jpg',
    'logo-fiu.png',
    'logo-uwi.png',
    'logo-heart.png',
  ];
  for (const name of legacy) {
    const full = path.join(ASSETS_DIR, name);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
      console.log(`Removed legacy Sandals asset: ${name}`);
    }
  }
}

async function main {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const selected = ASSETS.filter((a) => (opts.only ? opts.only.has(a.id): true));
  if (selected.length === 0) {
    console.error('No assets matched --only filter.');
    process.exit(1);
  }

  console.log(`Archipelago image regen — ${selected.length} asset(s)`);
  console.log(`Output: ${ASSETS_DIR}`);
  console.log(`Model: ${opts.model} (fallback: ${opts.fallback}), size: ${opts.size}`);
  if (opts.model === OWNER_REQUESTED_MODEL) {
    console.warn(
      `Note: ${OWNER_REQUESTED_MODEL} may 404 on current Gemini API; fallback ${opts.fallback} will be tried.`);
  }
  console.log(opts.dryRun ? 'Mode: DRY-RUN': opts.force ? 'Mode: FORCE': 'Mode: SKIP-EXISTING');

  /** @type {Record<string, string>} */
  const statuses = {};
  /** @type {Record<string, string | null>} */
  const errors = {};

  for (const asset of selected) {
    const outPath = path.join(ASSETS_DIR, asset.outputFile);
    const exists = fs.existsSync(outPath);
    console.log(`\n[${asset.id}] ${asset.purpose}`);
    console.log(` source: ${asset.sourcePath}`);
    console.log(` target: assets/${asset.outputFile} (${asset.aspectRatio})`);
    if (opts.dryRun) {
      console.log(` prompt: ${asset.prompt.slice(0, 220)}…`);
      statuses[asset.id] = 'dry-run';
      errors[asset.id] = null;
      continue;
    }
    if (exists && !opts.force) {
      console.log(' skip: exists (pass --force to overwrite)');
      statuses[asset.id] = 'skipped-existing';
      errors[asset.id] = null;
      continue;
    }
    statuses[asset.id] = 'pending';
  }

  writeManifest(ASSETS, {
    model: opts.model,
    fallback: opts.fallback,
    size: opts.size,
    dryRun: opts.dryRun,
    statuses,
    errors,
  });

  if (opts.dryRun) {
    console.log(`\nWrote prompt catalog: ${PROMPTS_PATH}`);
    console.log(`Wrote manifest: ${MANIFEST_PATH}`);
    return;
  }

  const keyInfo = resolveApiKey;
  if (!keyInfo) {
    console.error(
      '\nNo GEMINI_API_KEY found. Prompt catalog + manifest written; re-run with a key to generate.');
    process.exit(2);
  }
  console.log(`\nAPI key: loaded (${keyInfo.source.split(':').slice(0, -1).join(':') || keyInfo.source})`);

  const require = createRequire(path.join(REPO_ROOT, 'package.json'));
  /** @type {typeof import('@google/genai')} */
  const genai = require('@google/genai');
  const ai = new genai.GoogleGenAI({ apiKey: keyInfo.key });

  let generated = 0;
  let failed = 0;
  let skipped = 0;

  for (const asset of selected) {
    if (statuses[asset.id] === 'skipped-existing') {
      skipped += 1;
      continue;
    }

    process.stdout.write(`Generating ${asset.id}… `);
    try {
      const result = await generateOne(ai, asset, opts);
      const outPath = path.join(ASSETS_DIR, asset.outputFile);
      const isJpeg =
        result.mimeType.includes('jpeg') || result.mimeType.includes('jpg');
      const isPng = result.mimeType.includes('png');
      const wantsJpg =
        asset.outputFile.toLowerCase.endsWith('.jpg') ||
        asset.outputFile.toLowerCase.endsWith('.jpeg');
      const wantsPng = asset.outputFile.toLowerCase.endsWith('.png');

      const sharp = ( => {
        try {
          return require('sharp');
        } catch {
          return null;
        }
      });

      if (isPng && wantsJpg) {
        if (!sharp) {
          throw new Error(
            'Model returned PNG for a JPG target and sharp is unavailable for conversion');
        }
        await sharp(result.buffer).jpeg({ quality: 92 }).toFile(outPath);
      } else if (isJpeg && wantsPng) {
        if (!sharp) {
          throw new Error(
            'Model returned JPEG for a PNG target and sharp is unavailable for conversion');
        }
        await sharp(result.buffer).png.toFile(outPath);
      } else {
        fs.writeFileSync(outPath, result.buffer);
      }

      console.log(`ok (${result.model}, ${result.mimeType}, ${result.buffer.length} bytes)`);
      statuses[asset.id] = 'generated';
      errors[asset.id] = null;
      generated += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message: String(err);
      console.log(`FAIL: ${message}`);
      statuses[asset.id] = 'failed';
      errors[asset.id] = message;
      failed += 1;
    }

    writeManifest(ASSETS, {
      model: opts.model,
      fallback: opts.fallback,
      size: opts.size,
      dryRun: false,
      statuses,
      errors,
    });

     Pace requests to reduce transient fetch rate-limit failures.
    if (generated + failed < selected.length) {
      await sleep(1200);
    }
  }

   Cleanup legacy only when replacements exist
  const replacementsReady = [
    'team-maya.jpg',
    'team-elena.jpg',
    'team-marcus.jpg',
    'team-julian.jpg',
    'logo-harbor-institute.png',
    'logo-coral-cay.png',
    'logo-tide-trust.png',
    'brand-wordmark.png',
  ].every((f) => fs.existsSync(path.join(ASSETS_DIR, f)));

  if (replacementsReady) {
    cleanupLegacyFiles;
  }

  console.log(`\nDone. generated=${generated} skipped=${skipped} failed=${failed}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
  if (failed > 0) {
    process.exit(1);
  }
}

main.catch((err) => {
  console.error(err);
  process.exit(1);
});
