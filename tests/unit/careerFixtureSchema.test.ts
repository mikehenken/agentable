/**
 * automated_check: fixture schema validation in CI.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  HELIOS_CAREER_DATASET,
  ARCHIPELAGO_CAREER_DATASET,
  MINIMAL_CAREER_DATASET,
  convertHeliosPanelData,
  convertArchipelagoCareerData,
  parseCareerDataset,
  validateCareerDataset,
} from '@agentable/career-pack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(
  __dirname,
  '../../packages/career-pack/src/fixtures');

describe('career fixture schema validation ', () => {
  it('validates minimal dataset export', () => {
    const result = validateCareerDataset(MINIMAL_CAREER_DATASET);
    expect(result.ok).toBe(true);
  });

  it('validates committed helios.json on disk', () => {
    const raw = JSON.parse(readFileSync(path.join(FIXTURES_DIR, 'helios.json'), 'utf8'));
    const parsed = parseCareerDataset(raw);
    expect(parsed.jobs.length).toBe(117);
    expect(parsed.growthPaths.length).toBeGreaterThan(0);
    expect(parsed.resources.length).toBeGreaterThan(0);
  });

  it('validates committed archipelago.json on disk', () => {
    const raw = JSON.parse(readFileSync(path.join(FIXTURES_DIR, 'archipelago.json'), 'utf8'));
    const parsed = parseCareerDataset(raw);
    expect(parsed.jobs.length).toBe(5);
    expect(parsed.applications?.length).toBe(3);
  });

  it('validates exported HELIOS_CAREER_DATASET constant', () => {
    expect(HELIOS_CAREER_DATASET.jobs).toHaveLength(117);
    expect(HELIOS_CAREER_DATASET.jobs[0]?.source).toBe('fixture');
  });

  it('validates exported ARCHIPELAGO_CAREER_DATASET constant', () => {
    expect(ARCHIPELAGO_CAREER_DATASET.jobs).toHaveLength(5);
    expect(ARCHIPELAGO_CAREER_DATASET.growthPaths).toHaveLength(3);
  });

  it('converts helios-panel-data.json shape into schema-valid dataset', () => {
    const heliosPanelDataPath = path.resolve(__dirname, '../../../helios/data/helios-panel-data.json');
    const raw = JSON.parse(readFileSync(heliosPanelDataPath, 'utf8'));
    const converted = convertHeliosPanelData(raw);
    const result = validateCareerDataset(converted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.jobs.length).toBe(raw.jobCount);
    }
  });

  it('converts archipelago legacy shapes into schema-valid dataset', () => {
    const converted = convertArchipelagoCareerData({
      jobs: ARCHIPELAGO_CAREER_DATASET.jobs.map((job) => ({
        id: Number(job.id),
        title: job.title,
        department: job.department,
        location: job.location,
        description: job.description,
      })),
      growthPaths: ARCHIPELAGO_CAREER_DATASET.growthPaths.map((path) => ({
        id: path.id,
        title: `${path.fromRole} → ${path.toRole}`,
        tagline: path.summary,
        match: path.fitScore,
        milestones: (path.steps ?? []).map((title) => ({ title })),
      })),
      applications: (ARCHIPELAGO_CAREER_DATASET.applications ?? []).map((app) => ({
        id: app.id,
        role: ARCHIPELAGO_CAREER_DATASET.jobs.find((job) => job.id === app.jobId)?.title ?? 'Unknown',
        status: app.status,
        submitted: app.submittedAt,
      })),
      resources: ARCHIPELAGO_CAREER_DATASET.resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        type: resource.category,
        description: resource.description,
      })),
    });
    expect(validateCareerDataset(converted).ok).toBe(true);
  });
});
