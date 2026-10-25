import { describe, expect, it } from 'vitest';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';
import type { JourneyRunState } from '../../../core/journey/journey';
import { buildReportFromSession, formatContrastRatio, redactCollectedData, toPublicComparisons, toPublicReportData } from '../report.service';

describe('formatContrastRatio', () => {
  it.each([
    [2.71, '2.71:1'],
    ['4.5', '4.5:1'],
    ['4.5:1', '4.5:1'],
    ['4.5:1:1', '4.5:1'],
  ])('normalise %s en %s', (value, expected) => {
    expect(formatContrastRatio(value)).toBe(expected);
  });
});

describe('buildReportFromSession', () => {
  it('rédige les relations de formulaires dans les réponses publiques', () => {
    const publicData = redactCollectedData({
      images: [], frames: [], links: [], headings: { documentTitle: 'Test', headings: [], flags: [] },
      forms: [{
        selector: 'form[data-url="https://example.com/form?token=secret"]', action: 'https://example.com/submit?token=secret', method: 'post', flags: [],
        controls: [{
          selector: '#name', tagName: 'input', type: 'text', id: 'name', name: 'name', label: 'Nom https://example.com/label?token=secret', labelSource: 'label', required: false, invalid: false,
          autocomplete: null, describedByIds: [], helpText: null, errorMessage: null, flags: ['FORM_LABEL_PRESENT'], labelSelector: 'label[for="name"]', labelAdjacent: true, groupSelector: 'fieldset#profile', groupLegend: 'Profil',
          optionGroups: [{ selector: '#group', label: 'Équipe https://example.com/group?token=secret', optionCount: 2, flags: [] }],
          validationConstraints: ['required'], validationMessage: 'Message https://example.com/message?token=secret', sensitive: false,
        }],
        groups: [{ selector: 'fieldset#profile', legend: 'Profil', controlSelectors: ['#name'], flags: ['FORM_GROUP_REVIEW'] }],
      }],
    });

    expect(JSON.stringify(publicData)).not.toContain('secret');
    expect(publicData?.forms?.[0]?.action).toBe('https://example.com/submit');
    expect(publicData?.forms?.[0]?.controls[0]?.label).toBe('Nom https://example.com/label');
    expect(publicData?.forms?.[0]?.controls[0]?.validationMessage).toBe('Message https://example.com/message');
  });

  it('inclut une photographie versionnée des parcours rattachés et la rédige publiquement', () => {
    const session: SessionState = {
      sessionId: 'journey-report-session',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 0,
      completedPages: [],
      pendingPages: [],
      results: {},
    };
    const run: JourneyRunState = {
      schemaVersion: 1,
      runId: 'run-report-001',
      journeyId: 'journey-001',
      journeyDefinitionHash: 'hash',
      sessionId: session.sessionId,
      status: 'completed',
      startedAt: '2026-10-20T00:00:01.000Z',
      finishedAt: '2026-10-20T00:00:02.000Z',
      run: {
        runId: 'run-report-001',
        journeyId: 'journey-001',
        startedAt: '2026-10-20T00:00:01.000Z',
        finishedAt: '2026-10-20T00:00:02.000Z',
        steps: [{
          stepId: 'step-1',
          action: 'navigate',
          url: 'https://example.com/private?token=secret',
          observedAt: '2026-10-20T00:00:01.000Z',
          title: 'Accueil',
          evidence: [{
            selector: 'https://example.com/proof?token=secret',
            html: '<main data-token="secret">Accueil</main>',
            resultId: 'result-1',
            proofId: 'proof-1',
            criterionIds: ['1.1'],
            elementIndex: 0,
          }],
          keyboard: {
            key: 'Tab',
            componentSelector: 'https://example.com/component?token=secret',
            before: { selector: 'https://example.com/before?token=secret', tagName: 'A', role: null, text: 'https://example.com/text?token=secret', withinComponent: false, focusVisible: false },
            after: null,
            entered: true,
            exited: false,
            focusVisible: true,
            blocked: false,
            criterionIds: ['12.8'],
            requiresHumanReview: true,
          },
          context: {
            trigger: { stepId: 'step-1', action: 'navigate', selector: 'https://example.com/trigger?token=secret' },
            urlBefore: 'https://example.com/before?token=secret',
            urlAfter: 'https://example.com/after?token=secret',
            titleBefore: 'Before https://example.com/title?token=secret',
            titleAfter: 'After',
            changed: true,
            changeTypes: ['navigation'],
            disruptions: [{ kind: 'motion', selector: 'https://example.com/disruption?token=secret', detail: 'https://example.com/detail?token=secret' }],
            disclosures: [{ kind: 'aria-expanded', selector: 'https://example.com/disclosure?token=secret', detail: 'https://example.com/disclosure-detail?token=secret' }],
            timeLimits: [{ kind: 'meta-refresh', selector: 'meta', detail: 'content=120;url=/renewed?token=secret' }],
            newWindows: [{ kind: 'target-blank', selector: 'a#external', detail: 'href=/resource?token=secret; avertissement=non observé' }],
            crypticContent: [{ selector: '#emoji', content: '🙂', alternative: 'Information', detail: 'alternative observée=Information' }],
            scriptAlternatives: [{ selector: 'https://example.com/script?token=secret', alternativeSelector: 'https://example.com/noscript?token=secret', alternative: 'Version https://example.com/alternative?token=secret', detail: 'https://example.com/script-detail?token=secret' }],
            scriptControls: [{ selector: 'https://example.com/control?token=secret', pointerEvents: ['pointerdown'], keyboardEvents: ['keydown'], detail: 'https://example.com/control-detail?token=secret' }],
            interactions: [{
              kind: 'complex-gesture',
              selector: 'https://example.com/interaction?token=secret',
              detail: 'https://example.com/interaction-detail?token=secret',
              criterionIds: ['13.10'],
              requiresHumanReview: true,
            }],
            criterionIds: ['7.1'],
            requiresHumanReview: true,
          },
          result: null,
        }, {
          stepId: 'legacy-step',
          action: 'wait',
          url: 'https://example.com/legacy?token=secret',
          observedAt: '2026-10-20T00:00:01.500Z',
          title: 'Ancien parcours',
          evidence: [],
          context: {
            trigger: { stepId: 'legacy-step', action: 'wait' },
            urlBefore: 'https://example.com/legacy?token=secret',
            urlAfter: 'https://example.com/legacy?token=secret',
            titleBefore: 'Ancien parcours',
            titleAfter: 'Ancien parcours',
            changed: false,
            changeTypes: [],
            disruptions: [],
            criterionIds: [],
            requiresHumanReview: true,
          },
          result: null,
        }],
      },
    };

    const internal = buildReportFromSession(session, undefined, [run]);
    const publicData = toPublicReportData(internal, session.sessionId);

    expect(internal.journeyAnnex).toMatchObject({ schemaVersion: 1, sessionId: session.sessionId, runs: [run] });
    expect(publicData.journeyAnnex.runs[0]?.run?.steps[0]?.url).toBe('https://example.com/private');
    const publicStep = publicData.journeyAnnex.runs[0]?.run?.steps[0];
    expect(publicStep?.evidence[0]?.selector).toBe('https://example.com/proof');
    expect(publicStep?.keyboard?.componentSelector).toBe('https://example.com/component');
    expect(publicStep?.context?.trigger.selector).toBe('https://example.com/trigger');
    expect(publicStep?.context?.disruptions[0]?.detail).toBe('https://example.com/detail');
    expect(publicStep?.context?.disclosures?.[0]).toMatchObject({
      selector: 'https://example.com/disclosure',
      detail: 'https://example.com/disclosure-detail',
    });
    expect(publicStep?.context?.timeLimits?.[0]?.detail).toBe('content=120;url=/renewed');
    expect(publicStep?.context?.newWindows?.[0]?.detail).toBe('href=/resource; avertissement=non observé');
    expect(publicStep?.context?.scriptAlternatives?.[0]).toMatchObject({
      selector: 'https://example.com/script',
      alternativeSelector: 'https://example.com/noscript',
      alternative: 'Version https://example.com/alternative',
      detail: 'https://example.com/script-detail',
    });
    expect(publicStep?.context?.scriptControls?.[0]).toMatchObject({
      selector: 'https://example.com/control',
      detail: 'https://example.com/control-detail',
    });
    expect(publicStep?.context?.interactions?.[0]).toMatchObject({
      selector: 'https://example.com/interaction',
      detail: 'https://example.com/interaction-detail',
    });
    expect(publicData.journeyAnnex.runs[0]?.run?.steps[1]?.context?.interactions).toEqual([]);
    expect(JSON.stringify(publicData.journeyAnnex)).not.toContain('token=secret');
    expect(JSON.stringify(publicData.journeyAnnex)).not.toContain('https://example.com/private?token=secret');
  });

  it('keeps exact URLs internally but exposes only a redacted URL and page id publicly', () => {
    const secretUrl = 'https://example.com/audit?token=secret-value';
    const session: SessionState = {
      sessionId: 'public-report-test',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: [secretUrl],
      pendingPages: [],
      results: {
        [secretUrl]: {
          url: secretUrl,
          auditedAt: '2026-10-20T00:00:01.000Z',
          axeResults: null,
          collectedData: {
            images: [{
              selector: 'img.hero',
              tagName: 'IMG',
              src: 'https://example.com/hero.png?token=secret-value',
              altAttribute: 'Hero',
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
              screenshotPath: '/var/lib/rgaaudit/screenshots/secret.png',
            }],
            frames: [],
            links: [],
            headings: { documentTitle: 'Test', headings: [], flags: [] },
            structure: {
              pageFlags: [],
              tables: [{
                selector: 'table[data-proof="https://example.com/table?token=secret-value"]',
                dataFeatures: ['https://example.com/feature?token=secret-value'],
                flags: ['TABLE_DATA_CANDIDATE'],
                tableKind: 'data_candidate',
                complexitySignals: ['COLSPAN_PRESENT'],
                captionText: 'Titre https://example.com/caption?token=secret-value',
                summaryText: 'Résumé https://example.com/summary?token=secret-value',
                linearizedText: 'Cellule https://example.com/text?token=secret-value',
              }],
              styles: { stylesheetCount: 0, inlineStyleCount: 0, presentationMarkupCount: 0, flags: [] },
              colors: [],
              fieldGroups: [],
              landmarks: [],
            },
            presentation: {
              snapshots: [{
                scenario: 'baseline',
                status: 'observed',
                viewportWidth: 1280,
                viewportHeight: 720,
                devicePixelRatio: 1,
                visualViewportScale: 1,
                documentScrollWidth: 1280,
                documentScrollHeight: 720,
                documentClientWidth: 1280,
                documentClientHeight: 720,
                bodyTextLength: 10,
                visibleTextLength: 10,
                focusableCount: 1,
                visibleFocusableCount: 1,
                cssZoom: null,
                focusObservations: [{
                  selector: '[data-focus="https://example.com/focus?token=secret-value"]',
                  tagName: 'button',
                  role: null,
                  text: 'Action https://example.com/focus-text?token=secret-value',
                  focusVisible: false,
                  flags: ['PRESENTATION_FOCUS_REVIEW'],
                }],
                flags: ['PRESENTATION_FOCUS_REVIEW'],
              }],
              perceptualCues: [{
                selector: '[data-proof="https://example.com/cue?token=secret-value"]',
                tagName: 'p',
                text: 'État https://example.com/text?token=secret-value',
                accessibleName: 'État https://example.com/name?token=secret-value',
                kinds: ['color'],
                color: 'rgb(255, 0, 0)',
                backgroundColor: 'rgb(255, 255, 255)',
                fontSize: '16px',
                borderRadius: '0px',
                position: 'static',
                dimensions: { width: 100, height: 20 },
                flags: ['PERCEPTUAL_COLOR_CUE'],
              }],
              flags: [],
              manualChecks: [],
            },
            navigation: {
              systems: [{
                kind: 'search',
                selector: 'form[action="https://example.com/recherche?token=secret-value"]',
                label: 'Rechercher https://example.com/label?token=secret-value',
                href: 'https://example.com/recherche?token=secret-value',
                domIndex: 0,
                position: { top: 0, left: 0, width: 100, height: 40 },
                flags: ['NAVIGATION_SEARCH_PRESENT'],
              }],
              flags: ['NAVIGATION_SEARCH_PRESENT'],
              manualChecks: ['Vérifier https://example.com/check?token=secret-value'],
            },
          },
          heuristicResults: [],
          error: null,
        },
      },
    };

    const internal = buildReportFromSession(session);
    const publicData = toPublicReportData(internal, session.sessionId);

    expect(internal.allCollected[0]?.url).toBe(secretUrl);
    expect(publicData.allCollected[0]?.url).toBe('https://example.com/audit');
    expect(publicData.allCollected[0]?.pageId).toMatch(/^page-[0-9a-f]{32}$/);
    expect(publicData.allCollected[0]?.collectedData?.images[0]?.screenshotPath).toBeNull();
    expect(publicData.allCollected[0]?.collectedData?.navigation?.systems[0]).toMatchObject({
      href: 'https://example.com/recherche',
      label: 'Rechercher https://example.com/label',
    });
    expect(publicData.allCollected[0]?.collectedData?.presentation?.perceptualCues?.[0]).toMatchObject({
      selector: '[data-proof="https://example.com/cue"]',
      text: 'État https://example.com/text',
      accessibleName: 'État https://example.com/name',
    });
    expect(publicData.allCollected[0]?.collectedData?.presentation?.snapshots[0]?.focusObservations?.[0]).toMatchObject({
      selector: '[data-focus="https://example.com/focus"]',
      text: 'Action https://example.com/focus-text',
    });
    expect(publicData.allCollected[0]?.collectedData?.structure?.tables[0]).toMatchObject({
      selector: 'table[data-proof="https://example.com/table"]',
      captionText: 'Titre https://example.com/caption',
      summaryText: 'Résumé https://example.com/summary',
      linearizedText: 'Cellule https://example.com/text',
    });
    expect(JSON.stringify(publicData)).not.toContain('secret-value');
    expect(JSON.stringify(publicData)).not.toContain('/var/lib/rgaaudit/screenshots/secret.png');
  });

  it('expose l’historique des décisions révisées dans la revue', () => {
    const session: SessionState = {
      sessionId: 'history-test',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: ['https://example.com/'],
      pendingPages: [],
      results: {},
    };

    const data = buildReportFromSession(session, {
      schemaVersion: 1,
      sessionId: 'history-test',
      decisions: [],
      decisionHistory: [{
        pageUrl: 'https://example.com/',
        criterionId: '1.1',
        status: 'not_tested',
        comment: 'À vérifier',
        reviewedAt: null,
      }],
      imageDecisions: [],
      imageDecisionHistory: [],
      updatedAt: '2026-10-20T00:00:02.000Z',
    });

    expect(data.review.decisionHistory).toEqual([expect.objectContaining({ criterionId: '1.1', comment: 'À vérifier' })]);
  });

  it('ne transforme pas une session sans page exploitable en conformité', () => {
    const session: SessionState = {
      sessionId: 'failed-audit',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: [],
      pendingPages: [],
      results: {
        'https://example.com/': {
          url: 'https://example.com/',
          auditedAt: '2026-10-20T00:00:01.000Z',
          axeResults: null,
          collectedData: null,
          heuristicResults: [],
          error: 'Navigation timeout',
        },
      },
    };

    const data = buildReportFromSession(session);

    expect(data.report.summary.passes).toBe(0);
    expect(data.report.summary.manual).toBe(106);
    expect(data.report.summary.criteria.every((criterion) => criterion.status === 'manual')).toBe(true);
  });

  it('expose les preuves axe avec leur cible, HTML et contexte dans la revue', () => {
    const session: SessionState = {
      sessionId: 'evidence-test',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: ['https://example.com/'],
      pendingPages: [],
      results: {
        'https://example.com/': {
          url: 'https://example.com/',
          auditedAt: '2026-10-20T00:00:01.000Z',
          axeResults: {
            violations: [{
              rule: 'image-alt',
              impact: 'critical',
              description: 'Images must have alternate text',
              helpUrl: 'https://dequeuniversity.com/rules/axe/image-alt',
              elements: [{
                target: ['main img:nth-of-type(1)'],
                html: '<img src="photo.jpg">',
                context: 'Parent HTML: <main>…</main>\nParent text: Catalogue',
                elementIndex: 0,
              }],
            }],
            passes: [],
            incomplete: [],
          },
          collectedData: {
            images: [],
            frames: [],
            links: [],
            headings: { documentTitle: 'Test', headings: [], flags: [] },
          },
          heuristicResults: [],
          error: null,
        },
      },
    };

    const data = buildReportFromSession(session);
    const criterion = data.review.pages[0]?.criteria.find((item) => item.rgaaId === '1.1');
    expect(criterion?.evidence).toEqual([expect.objectContaining({
      kind: 'violation',
      rule: 'image-alt',
      selector: 'main img:nth-of-type(1)',
      html: '<img src="photo.jpg">',
      context: expect.stringContaining('Parent HTML:'),
      elementIndex: 0,
      proofId: expect.stringContaining('proof-'),
      resultId: expect.stringContaining('result-'),
      pageUrl: 'https://example.com/',
      criterionId: '1.1',
    })]);
  });

  it('propage la couverture et sépare le signal machine de la décision humaine', () => {
    const session: SessionState = {
      sessionId: 'coverage-test',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: ['https://example.com/'],
      pendingPages: [],
      results: {
        'https://example.com/': {
          url: 'https://example.com/',
          auditedAt: '2026-10-20T00:00:01.000Z',
          axeResults: {
            violations: [],
            passes: [{ rule: 'frame-title', description: 'ok', elements: [] }],
            incomplete: [],
          },
          collectedData: {
            images: [],
            frames: [],
            links: [],
            headings: {
              documentTitle: 'Test',
              headings: [{ level: 1, text: 'Title', selector: 'h1', flags: [] }],
              flags: [],
            },
          },
          heuristicResults: [],
          error: null,
        },
      },
    };

    const data = buildReportFromSession(session);

    expect(data.extractorRuns).toEqual([
      expect.objectContaining({
        extractorId: 'contrast-violations',
        extractorVersion: 1,
        schemaVersion: 1,
        itemCount: 0,
        truncated: false,
      }),
    ]);
    expect(data.report.coverage).toMatchObject({
      total: 106,
      integrated: 33,
      machineSignal: 26,
      humanReview: 101,
    });
    expect(data.review.coverage).toEqual(data.report.coverage);

    const criterion11 = data.review.pages[0]?.criteria.find((criterion) => criterion.rgaaId === '1.1');
    expect(criterion11).toMatchObject({
      machineStatus: 'needs_review',
      humanStatus: 'not_tested',
      coverageStatuses: ['integrated', 'machine_signal', 'not_tested'],
      proofStatus: 'missing',
    });
    expect(criterion11?.missingProofs).toHaveLength(1);

    const plannedCriterion = data.review.pages[0]?.criteria.find((criterion) => criterion.rgaaId === '13.4');
    expect(plannedCriterion?.coverageStatuses).toEqual(['planned', 'not_tested']);
  });
});

describe('toPublicComparisons', () => {
  it('redacte les URLs présentes dans les différences sans exposer le groupe interne', () => {
    const publicComparisons = toPublicComparisons([{
      before: {
        url: 'https://example.com/before?token=secret-before',
        observedAt: '2026-10-20T00:00:00.000Z',
        observationId: 'internal-before',
        comparisonGroup: 'private-group',
        order: 0,
        available: true,
        selectors: ['specialized:document:https://example.com/file?token=secret'],
      },
      after: {
        url: 'https://example.com/after?token=secret-after',
        observedAt: '2026-10-20T00:01:00.000Z',
        observationId: 'internal-after',
        comparisonGroup: 'private-group',
        order: 1,
        available: true,
        selectors: [],
      },
      changed: true,
      added: ['specialized:document:https://example.com/file?token=secret'],
      removed: [],
      updated: [{ key: 'image:img.hero', fields: ['alt'] }],
    }], 'public-comparison');

    expect(publicComparisons[0]).toMatchObject({
      before: { url: 'https://example.com/before', pageId: expect.stringMatching(/^page-/), selectors: ['specialized:document:https://example.com/file'] },
      after: { url: 'https://example.com/after' },
      updated: [{ key: 'image:img.hero', fields: ['alt'] }],
    });
    expect(JSON.stringify(publicComparisons)).not.toContain('secret');
    expect(JSON.stringify(publicComparisons)).not.toContain('private-group');
    expect(JSON.stringify(publicComparisons)).not.toContain('internal-before');
  });
});
