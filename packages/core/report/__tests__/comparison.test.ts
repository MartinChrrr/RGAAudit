import { describe, expect, it } from 'vitest';
import { compareCollectedData } from '../comparison';
import type { CollectedData } from '../../analyzer/data-collector';

function collected(selectors: string[]): CollectedData {
  return {
    images: selectors.filter((selector) => selector.startsWith('img')).map((selector) => ({
      selector,
      tagName: 'img',
      src: '/image.png',
      altAttribute: 'Image',
      altStatus: 'present',
      ariaLabel: null,
      ariaLabelledby: null,
      rolePresentation: false,
      surroundingText: '',
      parentFigcaption: null,
      isInLink: false,
      linkHref: null,
      linkText: null,
      axeViolations: [],
      automatedStatus: 'pass',
      flags: [],
      screenshotPath: null,
    })),
    frames: [],
    links: selectors.filter((selector) => selector.startsWith('a')).map((selector) => ({
      selector,
      tagName: 'a',
      accessibleLabel: 'Lien',
      href: '/page',
      opensNewWindow: false,
      hasNewWindowWarning: false,
      flags: [],
    })),
    headings: { documentTitle: 'Test', headings: [], flags: [] },
  };
}

describe('compareCollectedData', () => {
  it('expose les ajouts, suppressions et horodatages entre deux observations', () => {
    const comparisons = compareCollectedData([
      { url: 'https://example.com/before', observedAt: '2026-10-21T10:00:00.000Z', comparisonKey: 'journey-1', collectedData: collected(['img#hero', 'a#old']) },
      { url: 'https://example.com/after', observedAt: '2026-10-21T10:01:00.000Z', stepId: 'step-2', comparisonKey: 'journey-1', collectedData: collected(['img#hero', 'a#new']) },
    ]);

    expect(comparisons).toHaveLength(1);
    expect(comparisons[0]).toMatchObject({
      changed: true,
      before: { observedAt: '2026-10-21T10:00:00.000Z' },
      after: { observedAt: '2026-10-21T10:01:00.000Z', stepId: 'step-2' },
      added: ['link:a#new'],
      removed: ['link:a#old'],
    });
  });

  it('ignore deux pages indépendantes sans clé de comparaison', () => {
    expect(compareCollectedData([
      { url: 'https://example.com/a', collectedData: collected(['img#a']) },
      { url: 'https://example.com/b', collectedData: collected(['img#b']) },
    ])).toEqual([]);
  });
});
