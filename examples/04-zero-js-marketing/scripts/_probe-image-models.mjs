#!/usr/bin/env node
/**
 * One-off probe: which Gemini image model IDs accept generateContent.
 * Not part of the public regen CLI — safe to delete after verification.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function parseEnv(filePath) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(filePath)) {
    return out;
  }
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim;
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

const envLocal = parseEnv(path.join(REPO_ROOT, '.env.local'));
const key =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  envLocal.GEMINI_API_KEY ||
  envLocal.GOOGLE_API_KEY ||
  envLocal.GOOGLE_GENAI_API_KEY ||
  envLocal.VITE_GEMINI_API_KEY;

if (!key) {
  console.error('NO_KEY');
  process.exit(2);
}
console.log(`KEY_OK len=${key.length}`);

const require = createRequire(path.join(REPO_ROOT, 'package.json'));
/** @type {typeof import('@google/genai')} */
const genai = require('@google/genai');
const ai = new genai.GoogleGenAI({ apiKey: key });

const models = [
  'gemini-3.1-pro-image-preview',
  'gemini-3-pro-image-preview',
  'gemini-3-pro-image',
  'gemini-3.1-flash-image-preview',
  'gemini-3.1-flash-image',
];

for (const model of models) {
  process.stdout.write(`${model}... `);
  try {
    const response = await ai.models.generateContent({
      model,
      contents:
        'A single soft beige paper texture square, seamless, no text, no logos.',
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
      },
    });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data);
    if (img) {
      const bytes = Buffer.from(img.inlineData.data, 'base64').length;
      console.log(`OK ${img.inlineData.mimeType || '?'} bytes=${bytes}`);
    } else {
      const text = parts.find((p) => p.text)?.text ?? '';
      console.log(`NO_IMAGE parts=${parts.length} text=${JSON.stringify(text.slice(0, 120))}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message: String(err);
    console.log(`FAIL ${message.slice(0, 240).replace(/\s+/g, ' ')}`);
  }
}
