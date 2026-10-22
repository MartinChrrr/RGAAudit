import type { CollectedData } from '../analyzer/data-collector';
export type { AuditObservation } from './observation';

export interface ObservationChange {
  key: string;
  fields: string[];
}

export interface ObservationSnapshot {
  url: string;
  pageId?: string;
  observedAt: string | null;
  observationId?: string;
  comparisonGroup?: string;
  order?: number;
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
  updated?: ObservationChange[];
}

interface ComparisonEntry {
  observationId?: string;
  order?: number;
  url: string;
  observedAt?: string;
  comparisonGroup?: string;
  comparisonKey?: string;
  stepId?: string;
  collectedData: CollectedData | null;
}

type Fingerprint = Record<string, unknown>;

function fingerprintsOf(collectedData: CollectedData | null): Map<string, Fingerprint> {
  const fingerprints = new Map<string, Fingerprint>();
  if (!collectedData) return fingerprints;

  for (const image of collectedData.images) {
    fingerprints.set(`image:${image.selector}`, {
      source: image.src,
      alt: image.altAttribute,
      altStatus: image.altStatus,
      ariaLabel: image.ariaLabel,
      ariaLabelledby: image.ariaLabelledby,
      link: image.linkHref,
      context: image.surroundingText,
    });
  }
  for (const media of collectedData.media ?? []) {
    fingerprints.set(`media:${media.selector}`, {
      sources: media.sources,
      accessibleName: media.accessibleName,
      fallbackText: media.fallbackText,
      surroundingText: media.surroundingText,
      tracks: media.tracks,
      controls: media.controls,
      autoplay: media.autoplay,
    });
  }
  for (const frame of collectedData.frames) {
    fingerprints.set(`frame:${frame.selector}`, {
      source: frame.src,
      origin: frame.origin,
      title: frame.titleAttribute,
      titleStatus: frame.titleStatus,
      evidenceStatus: frame.evidenceStatus,
    });
  }
  for (const link of collectedData.links) {
    fingerprints.set(`link:${link.selector}`, {
      href: link.href,
      accessibleLabel: link.accessibleLabel,
      opensNewWindow: link.opensNewWindow,
      hasNewWindowWarning: link.hasNewWindowWarning,
    });
  }
  for (const form of collectedData.forms ?? []) {
    fingerprints.set(`form:${form.selector}`, { action: form.action });
    for (const control of form.controls) {
      fingerprints.set(`form-control:${control.selector}`, {
        label: control.label,
        helpText: control.helpText,
        errorMessage: control.errorMessage,
        required: control.required,
        invalid: control.invalid,
        autocomplete: control.autocomplete,
        describedByIds: control.describedByIds,
      });
    }
  }
  for (const heading of collectedData.headings.headings) {
    fingerprints.set(`heading:${heading.selector}`, {
      level: heading.level,
      text: heading.text,
    });
  }
  for (const item of collectedData.specializedContent ?? []) {
    fingerprints.set(`specialized:${item.kind}:${item.selector}`, {
      source: item.source,
      label: item.label,
      context: item.context,
      criterionIds: item.criterionIds,
      status: item.status,
      evidence: item.evidence,
      flags: item.flags,
    });
  }
  return fingerprints;
}

function fingerprintFieldsChanged(before: Fingerprint, after: Fingerprint): string[] {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...fields].filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])).sort();
}

export function compareCollectedData(
  entries: ComparisonEntry[],
): PageComparison[] {
  const comparisons: PageComparison[] = [];
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const group = entry.comparisonGroup ?? ('comparisonKey' in entry ? entry.comparisonKey : undefined);
    if (!group) continue;
    const grouped = groups.get(group) ?? [];
    grouped.push(entry);
    groups.set(group, grouped);
  }

  for (const [group, groupedEntries] of groups.entries()) {
    const orderedEntries = [...groupedEntries].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    for (let index = 1; index < orderedEntries.length; index += 1) {
      const previous = orderedEntries[index - 1];
      const current = orderedEntries[index];
      const beforeFingerprints = fingerprintsOf(previous.collectedData);
      const afterFingerprints = fingerprintsOf(current.collectedData);
      const beforeSelectors = [...beforeFingerprints.keys()].sort();
      const afterSelectors = [...afterFingerprints.keys()].sort();
      const available = Boolean(previous.collectedData && current.collectedData);
      const before = new Set(beforeSelectors);
      const after = new Set(afterSelectors);
      const added = afterSelectors.filter((selector) => !before.has(selector));
      const removed = beforeSelectors.filter((selector) => !after.has(selector));
      const updated = [...before].filter((key) => after.has(key)).map((key) => ({
        key,
        fields: fingerprintFieldsChanged(beforeFingerprints.get(key)!, afterFingerprints.get(key)!),
      })).filter((change) => change.fields.length > 0);
      comparisons.push({
        before: {
          url: previous.url,
          observedAt: previous.observedAt ?? null,
          ...(previous.observationId ? { observationId: previous.observationId } : {}),
          comparisonGroup: group,
          ...(previous.order !== undefined ? { order: previous.order } : {}),
          ...(previous.stepId ? { stepId: previous.stepId } : {}),
          available: Boolean(previous.collectedData),
          selectors: beforeSelectors,
        },
        after: {
          url: current.url,
          observedAt: current.observedAt ?? null,
          ...(current.observationId ? { observationId: current.observationId } : {}),
          comparisonGroup: group,
          ...(current.order !== undefined ? { order: current.order } : {}),
          ...(current.stepId ? { stepId: current.stepId } : {}),
          available: Boolean(current.collectedData),
          selectors: afterSelectors,
        },
        changed: !available || added.length > 0 || removed.length > 0 || updated.length > 0,
        added,
        removed,
        updated,
      });
    }
  }
  return comparisons;
}
