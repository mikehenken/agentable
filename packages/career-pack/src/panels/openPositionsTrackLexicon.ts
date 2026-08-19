import { createLexicon } from '../../../../src/components/primitives/lexicon';

/** Moss/Sandals employment track chips for Open Positions filters. */
export const openPositionsTrackLexicon = createLexicon({
  canonical: [
    'All',
    'Professionals',
    'Solar Hourly',
    'CM Project Management',
    'Craft Hourly',
    'Internship',
  ],
  synonyms: {
    all: 'All',
    professional: 'Professionals',
    professionals: 'Professionals',
    salaried: 'Professionals',
    'full-time · salary': 'Professionals',
    hourly: 'Solar Hourly',
    'solar hourly': 'Solar Hourly',
    solar: 'Solar Hourly',
    cm: 'CM Project Management',
    'cm project management': 'CM Project Management',
    'project management': 'CM Project Management',
    craft: 'Craft Hourly',
    'craft hourly': 'Craft Hourly',
    intern: 'Internship',
    internship: 'Internship',
  },
});

/** Infer track label from job type / department text for filter chips. */
export function inferJobTrack(type: string, department: string): string {
  const combined = `${type} ${department}`.toLowerCase();
  if (/intern/.test(combined)) return 'Internship';
  if (/cm|project management|construction management/.test(combined)) {
    return 'CM Project Management';
  }
  if (/hourly|solar|craft/.test(combined)) {
    if (/craft/.test(combined)) return 'Craft Hourly';
    return 'Solar Hourly';
  }
  if (/salary|professional|full-time/.test(combined)) return 'Professionals';
  const normalized = openPositionsTrackLexicon.normalize(type);
  return normalized ?? 'Professionals';
}
