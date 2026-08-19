/**
 * Sandals browser blockers — career fixture → React panel-data adapter.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SANDALS_CAREER_DATASET,
  careerDatasetToPanelData,
  coalesceCareerPanelDataPayload,
  isCareerDatasetPanelPayload,
} from '@agentable/career-pack';
import { normalizePanelDataPayload } from '../../src/config/panelDataNormalize';
import panelDataMinimal from '../fixtures/panel-data-minimal.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SANDALS_FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../sandals/website/public/data/sandals-career-fixture.json');

describe('careerDatasetToPanelData', () => {
  it('converts career jobs into OpenPositionsPanel-compatible rows', () => {
    const panelData = careerDatasetToPanelData(SANDALS_CAREER_DATASET);
    const first = panelData.jobs?.[0];
    expect(first).toMatchObject({
      id: 1,
      title: 'Resort Manager',
      payRange: '$85,000 – $120,000',
      skillMatches: expect.arrayContaining(['Leadership']),
    });
    expect(first?.skillMatches?.length).toBeGreaterThan(0);
  });

  it('converts career growth paths into milestone-backed panel rows', () => {
    const panelData = careerDatasetToPanelData(SANDALS_CAREER_DATASET);
    const first = panelData.growthPaths?.[0];
    expect(first).toMatchObject({
      id: 'path-front-office',
      title: 'Front desk → Front Office Manager',
      match: 91,
    });
    expect(first?.milestones?.length).toBe(5);
    expect(first?.milestones?.[0]?.title).toBe('Front Desk Agent');
  });

  it('detects committed sandals fixture JSON as career schema', () => {
    const raw: unknown = JSON.parse(readFileSync(SANDALS_FIXTURE_PATH, 'utf8'));
    expect(isCareerDatasetPanelPayload(raw)).toBe(true);
    const coalesced = coalesceCareerPanelDataPayload(raw) as {
      jobs?: Array<{ skillMatches?: string[] }>;
      growthPaths?: Array<{ milestones?: unknown[] }>;
    };
    expect(coalesced.jobs?.[0]?.skillMatches?.length).toBeGreaterThan(0);
    expect(coalesced.growthPaths?.[0]?.milestones?.length).toBeGreaterThan(0);
  });

  it('passes through legacy panel-data payloads unchanged', () => {
    expect(isCareerDatasetPanelPayload(panelDataMinimal)).toBe(false);
    const coalesced = coalesceCareerPanelDataPayload(panelDataMinimal) as typeof panelDataMinimal;
    expect(coalesced.jobs?.[0]?.title).toBe('Safety Manager');
  });

  it('normalizePanelDataPayload coalesces career fixtures before hydration', () => {
    const raw: unknown = JSON.parse(readFileSync(SANDALS_FIXTURE_PATH, 'utf8'));
    const normalized = normalizePanelDataPayload(raw as never);
    const growthPath = normalized.growthPaths?.[0] as { milestones?: unknown[] } | undefined;
    const job = normalized.jobs?.[0] as { skillMatches?: string[] } | undefined;
    expect(Array.isArray(growthPath?.milestones)).toBe(true);
    expect(Array.isArray(job?.skillMatches)).toBe(true);
  });

  it('coalesces applications into ApplicationsPanel rows with statusTone', () => {
    const raw: unknown = JSON.parse(readFileSync(SANDALS_FIXTURE_PATH, 'utf8'));
    const normalized = normalizePanelDataPayload(raw as never);
    const apps = normalized.applications as
      | Array<{ id: string; role: string; statusTone: string; stages: unknown[] }>
      | undefined;
    expect(apps?.length).toBeGreaterThanOrEqual(3);
    expect(apps?.[0]).toMatchObject({
      id: 'app-1',
      role: 'Resort Manager',
      statusTone: 'teal',
    });
    expect(Array.isArray(apps?.[0]?.stages)).toBe(true);
  });

  it('coalesces growth paths with non-empty milestones for GrowthPathsPanel', () => {
    const raw: unknown = JSON.parse(readFileSync(SANDALS_FIXTURE_PATH, 'utf8'));
    const normalized = normalizePanelDataPayload(raw as never);
    const paths = normalized.growthPaths as
      | Array<{ id: string; milestones: unknown[]; Icon?: unknown }>
      | undefined;
    expect(paths?.length).toBeGreaterThanOrEqual(1);
    expect(paths?.every((p) => Array.isArray(p.milestones) && p.milestones.length > 0)).toBe(true);
    expect(paths?.[0]?.Icon).toBeTruthy();
  });
});
