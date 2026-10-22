import type { CollectedData } from '../analyzer/data-collector';

/**
 * A single ordered observation that can participate in an explicit
 * comparison group. Raw URLs stay internal and are redacted at public
 * boundaries by the server layer.
 */
export interface AuditObservation {
  observationId: string;
  order: number;
  url: string;
  observedAt: string;
  comparisonGroup?: string;
  stepId?: string;
  collectedData: CollectedData | null;
}
