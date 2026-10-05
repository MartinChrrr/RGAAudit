import { describe, expect, it } from 'vitest';
import type { AuditReviewState, ImageAuditDecision } from '@rgaaudit/core/domain/review';
import { applyImageDecision, applyImageDecisions } from '../session.store';

const pageUrl = 'https://example.com/';
const reviewedAt = '2026-09-11T12:00:00.000Z';

function emptyReview(): AuditReviewState {
  return {
    schemaVersion: 1,
    sessionId: 'session-1',
    decisions: [],
    imageDecisions: [],
    updatedAt: reviewedAt,
  };
}

function imageDecision(
  elementIndex: number,
  status: ImageAuditDecision['status'],
): ImageAuditDecision {
  return {
    pageUrl,
    selector: 'main > img',
    elementIndex,
    decision: 'informative',
    status,
    correctedAlt: '',
    notes: '',
    reviewedAt: status === 'not_tested' ? null : reviewedAt,
  };
}

describe('applyImageDecision', () => {
  it('garde les lignes dupliquées distinctes et remonte une non-conformité au critère 1.1', () => {
    const review = emptyReview();
    const selectors = ['main > img', 'main > img'];

    applyImageDecision(review, imageDecision(0, 'compliant'), selectors, reviewedAt);
    expect(review.decisions[0]?.status).toBe('not_tested');

    applyImageDecision(review, imageDecision(1, 'non_compliant'), selectors, reviewedAt);

    expect(review.imageDecisions).toHaveLength(2);
    expect(review.decisions[0]).toEqual(expect.objectContaining({
      criterionId: '1.1',
      status: 'non_compliant',
      source: 'annex_images',
      reviewedAt,
    }));
  });

  it('ne remplace pas une décision prise directement sur le critère', () => {
    const review = emptyReview();
    review.decisions.push({
      pageUrl,
      criterionId: '1.1',
      status: 'compliant',
      comment: 'Validation directe',
      reviewedAt,
      source: 'criterion',
    });

    applyImageDecision(review, imageDecision(0, 'non_compliant'), ['main > img'], reviewedAt);

    expect(review.decisions[0]).toEqual(expect.objectContaining({
      status: 'compliant',
      comment: 'Validation directe',
      source: 'criterion',
    }));
  });
});

describe('applyImageDecisions', () => {
  it('agrège une sauvegarde globale conforme ou non conforme', () => {
    const review = emptyReview();
    const selectors = { [pageUrl]: ['main > img', 'main > img:nth-of-type(2)'] };

    applyImageDecisions(review, [
      imageDecision(0, 'compliant'),
      { ...imageDecision(1, 'compliant'), selector: 'main > img:nth-of-type(2)' },
    ], selectors, false, reviewedAt);
    expect(review.decisions[0]).toEqual(expect.objectContaining({
      criterionId: '1.1',
      status: 'compliant',
      source: 'annex_images',
    }));

    applyImageDecisions(review, [imageDecision(0, 'non_compliant')], selectors, false, reviewedAt);
    expect(review.decisions[0]).toEqual(expect.objectContaining({ status: 'non_compliant' }));
  });
});
