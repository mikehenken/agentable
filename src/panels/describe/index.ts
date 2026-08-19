export { describePanel, type DescribePanelDependencies } from './describePanel';
export {
  allCuratedExampleEntries,
  buildValidationContextFromHints,
  curatedExampleSummariesForTarget,
  curatedExamplesForTarget,
  CURATED_EXAMPLE_ENTRIES,
} from './curatedExamples';
export type {
  CuratedExampleEntry,
  CuratedExampleSpec,
  CuratedExampleValidationHints,
  DescribeCatalogEntryResult,
  DescribePanelArgs,
  DescribePanelOutcome,
  DescribePanelResult,
  DescribePanelToolResult,
  PropsSchemaDescription,
} from './types';
export { describeCatalogPropsSchema } from './zodPropsSchema';
