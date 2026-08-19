import type { CareerDataset } from '../types';
import raw from './helios.json';

/** Schema-validated helios career fixture (117 jobs from helios-panel-data.json). */
export const HELIOS_CAREER_DATASET: CareerDataset = raw as CareerDataset;
