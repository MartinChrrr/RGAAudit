import type { CollectedData } from '../analyzer/data-collector';

export interface ObservationSnapshot {
  url: string;
  observedAt: string | null;
  stepId?: string;
  comparisonKey?: string;
  available: boolean;
  selectors: string[];
}

export interface PageComparison {
  before: ObservationSnapshot;
  after: ObservationSnapshot;
  changed: boolean;
  added: string[];
  removed: string[];
}

function selectorsOf(collectedData: CollectedData | null): string[] {
  if (!collectedData) return [];
  return [
    ...collectedData.images.map((item) => `image:${item.selector}`),
    ...(collectedData.media ?? []).map((item) => `media:${item.selector}`),
    ...collectedData.frames.map((item) => `frame:${item.selector}`),
    ...collectedData.links.map((item) => `link:${item.selector}`),
    ...(collectedData.forms ?? []).flatMap((form) => [
      `form:${form.selector}`,
      ...form.controls.map((control) => `form-control:${control.selector}`),
    ]),
    ...collectedData.headings.headings.map((item) => `heading:${item.selector}`),
    ...(collectedData.specializedContent ?? []).map((item) => (
      `specialized:${item.kind}:${item.selector}:${item.source ?? ''}:${item.criterionIds.join(',')}:${item.status}:${item.flags.join(',')}:${item.evidence.join(',')}`
    )),
  ].sort();
}

export function compareCollectedData(
  entries: Array<{
    url: string;
    observedAt?: string;
    stepId?: string;
    comparisonKey?: string;
    collectedData: CollectedData | null;
  }>,
): PageComparison[] {
  const comparisons: PageComparison[] = [];
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    const linked = previous.url === current.url
      || Boolean(previous.comparisonKey && current.comparisonKey && previous.comparisonKey === current.comparisonKey);
    if (!linked) continue;
    const beforeSelectors = selectorsOf(previous.collectedData);
    const afterSelectors = selectorsOf(current.collectedData);
    const available = Boolean(previous.collectedData && current.collectedData);
    const before = new Set(beforeSelectors);
    const after = new Set(afterSelectors);
    const added = afterSelectors.filter((selector) => !before.has(selector));
    const removed = beforeSelectors.filter((selector) => !after.has(selector));
    comparisons.push({
      before: {
        url: previous.url,
        observedAt: previous.observedAt ?? null,
        ...(previous.stepId ? { stepId: previous.stepId } : {}),
        ...(previous.comparisonKey ? { comparisonKey: previous.comparisonKey } : {}),
        available: Boolean(previous.collectedData),
        selectors: beforeSelectors,
      },
      after: {
        url: current.url,
        observedAt: current.observedAt ?? null,
        ...(current.stepId ? { stepId: current.stepId } : {}),
        ...(current.comparisonKey ? { comparisonKey: current.comparisonKey } : {}),
        available: Boolean(current.collectedData),
        selectors: afterSelectors,
      },
      changed: !available || added.length > 0 || removed.length > 0,
      added,
      removed,
    });
  }
  return comparisons;
}
