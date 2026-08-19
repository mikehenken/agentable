import type { CareerDataset } from '../types';
import raw from './archipelago.json';

/** Schema-validated archipelago career fixture (career-canvas demo data). */
export const ARCHIPELAGO_CAREER_DATASET: CareerDataset = raw as CareerDataset;
