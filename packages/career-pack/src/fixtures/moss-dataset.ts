import type { CareerDataset } from '../types';
import raw from './moss.json';

/** Schema-validated moss career fixture (117 jobs from moss-panel-data.json). */
export const MOSS_CAREER_DATASET: CareerDataset = raw as CareerDataset;
