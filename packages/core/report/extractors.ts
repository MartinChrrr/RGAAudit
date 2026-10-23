/** Version of the contract used by report extractors. */
export const REPORT_EXTRACTOR_SCHEMA_VERSION = 1 as const;

export interface ReportExtractor<TInput, TItem> {
  id: string;
  version: number;
  /** Hard limit preventing an oversized annex from exhausting the report. */
  maxItems: number;
  extract(input: TInput): TItem[];
}

export interface ReportExtractorRun<TItem> {
  schemaVersion: typeof REPORT_EXTRACTOR_SCHEMA_VERSION;
  extractorId: string;
  extractorVersion: number;
  items: TItem[];
  truncated: boolean;
}

/** Run a versioned extractor and enforce its output limit at one boundary. */
export function runReportExtractor<TInput, TItem>(
  extractor: ReportExtractor<TInput, TItem>,
  input: TInput,
): ReportExtractorRun<TItem> {
  const maxItems = Number.isInteger(extractor.maxItems) && extractor.maxItems > 0
    ? extractor.maxItems
    : 1;
  const extracted = extractor.extract(input);
  const items = extracted.slice(0, maxItems);
  return {
    schemaVersion: REPORT_EXTRACTOR_SCHEMA_VERSION,
    extractorId: extractor.id,
    extractorVersion: extractor.version,
    items,
    truncated: extracted.length > items.length,
  };
}
