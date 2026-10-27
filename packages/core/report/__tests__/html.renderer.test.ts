import { describe, it, expect, afterEach } from 'vitest';
import { renderReportHtml, _resetLocaleCache } from '../html.renderer';
import type { Report } from '../../mapping/mapper';
import type { CollectedData } from '../../analyzer/data-collector';

afterEach(() => {
  _resetLocaleCache();
});

function makeReport(overrides?: Partial<Report>): Report {
  return {
    metadata: {
      url: 'https://example.com',
      date: '2025-01-15',
      version: '0.1.0',
      pagesAudited: 2,
      coveredThemes: ['Images', 'Liens'],
      totalRgaaCriteria: 106,
      coveredCriteria: 12,
    },
    limitBanner: 'Ce rapport ne couvre que 12 critères RGAA sur 106.',
    overlaysDetected: [],
    summary: {
      totalCriteria: 12,
      automated: 8,
      violations: 3,
      passes: 5,
      manual: 4,
      incomplete: 0,
      topIssues: [
        { rgaaId: '1.1', title: 'Image a un texte alternatif', pagesAffected: 2 },
      ],
      criteria: [
        {
          rgaaId: '1.1',
          title: 'Image a un texte alternatif',
          theme: 'Images',
          coverage: 'partial',
          humanLevel: 'H2',
          implementationLot: 0,
          status: 'violation',
          pagesViolating: ['https://example.com/'],
          pagesPass: [],
          pagesManual: [],
          pagesIncomplete: [],
        },
        {
          rgaaId: '6.1',
          title: 'Chaque lien est-il explicite ?',
          theme: 'Liens',
          coverage: 'partial',
          humanLevel: 'H2',
          implementationLot: 0,
          status: 'pass',
          pagesViolating: [],
          pagesPass: ['https://example.com/'],
          pagesManual: [],
          pagesIncomplete: [],
          manualChecks: ['Vérifier manuellement le critère 6.1'],
        },
      ],
      coverage: {
        total: 106,
        integrated: 27,
        machineSignal: 26,
        humanReview: 101,
        full: 5,
        partial: 21,
        manualShell: 80,
      },
    },
    coverage: {
      total: 106,
      integrated: 27,
      machineSignal: 26,
      humanReview: 101,
      full: 5,
      partial: 21,
      manualShell: 80,
    },
    uncoveredThemes: [
      {
        id: '4',
        name: 'Multimédia',
        manualChecklist: ['Vérifier les sous-titres'],
      },
    ],
    ...overrides,
  };
}

function makeCollectedData(): CollectedData {
  return {
    images: [
      {
        selector: 'img#hero',
        tagName: 'img',
        src: '/hero.jpg',
        altAttribute: null,
        altStatus: 'absent' as const,
        ariaLabel: null,
        ariaLabelledby: null,
        rolePresentation: false,
        surroundingText: 'Bienvenue',
        parentFigcaption: null,
        isInLink: false,
        linkHref: null,
        linkText: null,
        axeViolations: [],
        automatedStatus: 'violation' as const,
        flags: ['ALT_ABSENT'],
        screenshotPath: null,
        evidence: [{
          criterionId: '1.4',
          state: 'not_applicable',
          proof: ['Aucun indice de CAPTCHA ou image-test observé.'],
          limits: ['Validation humaine requise'],
          humanChecks: ['1.4 — Vérifier le CAPTCHA'],
        }],
      },
    ],
    frames: [],
    links: [],
    headings: {
      documentTitle: 'Accueil',
      headings: [{ level: 1, text: 'Bienvenue', selector: 'h1', flags: [] }],
      flags: [],
    },
    forms: [{
      selector: 'form#account',
      action: '/account',
      method: 'post',
      flags: [],
      controls: [{
        selector: '#email',
        tagName: 'input',
        type: 'email',
        id: 'email',
        name: 'email',
        label: 'Adresse électronique',
        labelSource: 'label',
        required: true,
        invalid: true,
        autocomplete: 'email',
        describedByIds: ['email-help'],
        helpText: 'Aide email',
        errorMessage: 'Email invalide',
        flags: [],
      }],
    }],
  };
}

describe('renderReportHtml', () => {
  it('produit un HTML valide avec DOCTYPE et lang fr', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('</html>');
  });

  it('embarque ses styles sans dépendance CDN', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('<style>');
    expect(html).not.toContain('cdn.tailwindcss.com');
  });

  it('affiche le bandeau de limite', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('data-testid="limit-banner"');
    expect(html).toContain('12 critères RGAA sur 106');
  });

  it('affiche la séparation entre critères intégrés, signaux machine et revue humaine', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('data-testid="coverage-summary"');
    expect(html).toContain('Critères intégrés');
    expect(html).toContain('Signal automatique');
    expect(html).toContain('Revue humaine requise');
    expect(html).toContain('Couverture partielle');
  });

  it('affiche les cartes de synthèse (violations, passes, manual)', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('>3<'); // violations count
    expect(html).toContain('>5<'); // passes count
    expect(html).toContain('>4<'); // manual count
    expect(html).toContain('Action de vérification humaine');
    expect(html).toContain('Vérifier manuellement le critère 6.1');
  });

  it('affiche les critères groupés par thématique', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('1.1');
    expect(html).toContain('6.1');
    expect(html).toContain('Anomalies détectées');
    expect(html).toContain('Aucune anomalie détectée');
  });

  it('affiche les top issues', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('Image a un texte alternatif');
    expect(html).toContain('1.1');
  });

  it('affiche les thématiques non couvertes', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('Multimédia');
    expect(html).toContain('sous-titres');
  });

  it('inclut les données annexes dans un script tag (REGLE 8 — offline)', () => {
    const collected = [
      { url: 'https://example.com/', collectedData: makeCollectedData() },
    ];
    const html = renderReportHtml({ report: makeReport(), allCollected: collected });

    expect(html).toContain('id="rgaaudit-data"');
    expect(html).toContain('type="application/json"');
    expect(html).toContain('img#hero');
    expect(html).toContain('data-testid="images-section"');
    expect(html).toContain('1.4 — Vérifier le CAPTCHA');
  });

  it('affiche l’annexe versionnée des parcours rattachés', () => {
    const html = renderReportHtml({
      report: makeReport(),
      journeyAnnex: {
        schemaVersion: 1,
        generatedAt: '2026-10-20T00:00:00.000Z',
        sessionId: 'session-1',
        runs: [{
          schemaVersion: 1,
          runId: 'run-1',
          journeyId: 'journey-1',
          journeyDefinitionHash: 'hash',
          sessionId: 'session-1',
          status: 'completed',
          startedAt: '2026-10-20T00:00:00.000Z',
          finishedAt: '2026-10-20T00:01:00.000Z',
          run: {
            runId: 'run-1',
            journeyId: 'journey-1',
            startedAt: '2026-10-20T00:00:00.000Z',
            finishedAt: '2026-10-20T00:01:00.000Z',
            steps: [{
              stepId: 'step-1',
              action: 'wait',
              url: 'https://example.com',
              observedAt: '2026-10-20T00:00:10.000Z',
              title: 'Accueil',
              evidence: [],
              keyboard: {
                key: 'Tab',
                componentSelector: '#slider',
                before: null,
                after: { selector: '#slider', tagName: 'button', role: null, text: 'Slider', withinComponent: true, focusVisible: false },
                entered: true,
                exited: false,
                focusVisible: false,
                blocked: false,
                criterionIds: ['10.7'],
                viewport: { width: 320, height: 256 },
                requiresHumanReview: true,
              },
              context: {
                trigger: { stepId: 'step-1', action: 'wait' },
                urlBefore: 'https://example.com',
                urlAfter: 'https://example.com',
                titleBefore: 'Accueil',
                titleAfter: 'Accueil',
                changed: false,
                changeTypes: ['disruption'],
                disruptions: [{ kind: 'flash', selector: '#flash', detail: 'animation=flash' }],
                disclosures: [{ kind: 'details', selector: '#details', detail: 'open=true' }],
                additionalContent: [{ selector: '#tooltip', trigger: 'focus', detail: 'clavier=atteignable' }],
                timeLimits: [{ kind: 'timer', selector: 'window', detail: 'setTimeout enregistré avec un délai de 1000 ms' }],
                newWindows: [{ kind: 'window-open', selector: 'window.open', detail: 'target=_blank' }],
                crypticContent: [{ selector: '#emoji', content: '🙂', alternative: 'Information', detail: 'alternative observée=Information' }],
                scriptAlternatives: [{ selector: 'script#app', alternativeSelector: 'noscript', alternative: 'Version sans JavaScript', detail: 'alternative candidate observée dans noscript' }],
                scriptControls: [{ selector: '#script-action', pointerEvents: ['pointerdown', 'pointerup'], keyboardEvents: ['keydown', 'keyup'], detail: 'événements observés' }],
                interactions: [{
                  kind: 'complex-gesture',
                  selector: '#slider',
                  detail: 'Mouvement pointermove observé',
                  criterionIds: ['13.10'],
                  requiresHumanReview: true,
                }],
                criterionIds: ['13.7', '13.10'],
                requiresHumanReview: true,
              },
              result: null,
            }],
          },
        }],
      },
    });

    expect(html).toContain('data-testid="journey-annex"');
    expect(html).toContain('run-1');
    expect(html).toContain('photographie versionnée');
    expect(html).toContain('Flash ou variation lumineuse candidate');
    expect(html).toContain('Élément details');
    expect(html).toContain('Contenus additionnels');
    expect(html).toContain('Limites de temps et rafraîchissements');
    expect(html).toContain('Ouvertures de fenêtres');
    expect(html).toContain('Contenus cryptiques');
    expect(html).toContain('Alternatives de scripts');
    expect(html).toContain('Contrôles des scripts');
    expect(html).toContain('Geste complexe candidat');
    expect(html).toContain('320 × 256');
    expect(html).toContain('indicateur non observé');
  });

  it('affiche l’annexe formulaires dans le rapport HTML', () => {
    const collected = makeCollectedData();
    collected.forms![0].flags = ['FORM_SUBMISSION_REVIEW', 'FORM_SUBMISSION_NOT_EXECUTED'];
    collected.forms![0].submitControls = ['#submit'];
    collected.forms![0].groups = [{ selector: 'fieldset#profile', legend: 'Profil', controlSelectors: ['#email'], flags: ['FORM_GROUP_REVIEW'] }];
    collected.forms![0].controls[0].labelSelector = 'label[for="email"]';
    collected.forms![0].controls[0].labelAdjacent = true;
    collected.forms![0].controls[0].validationConstraints = ['required', 'type=email'];
    collected.forms![0].controls[0].validationMessage = 'Email invalide';
    const html = renderReportHtml({
      report: makeReport(),
      allCollected: [{ url: 'https://example.com/', collectedData: collected }],
    });

    expect(html).toContain('Annexe — Formulaires');
    expect(html).toContain('Adresse électronique');
    expect(html).toContain('Email invalide');
    expect(html).toContain('aucune soumission exécutée');
    expect(html).toContain('required, type=email');
    expect(html).toContain('Groupes de champs');
    expect(html).toContain('fieldset#profile');
  });

  it('affiche l’inventaire des médias et les contrôles manuels', () => {
    const collected = makeCollectedData();
    collected.media = [{
      selector: 'video#demo',
      kind: 'video',
      sources: ['https://example.com/demo.mp4'],
      accessibleName: 'Démonstration',
      fallbackText: 'Lecteur vidéo',
      surroundingText: 'Présentation',
      controls: true,
      autoplay: false,
      tracks: [{
        kind: 'captions',
        src: 'https://example.com/captions.vtt',
        srcLang: 'fr',
        label: 'Français',
        isDefault: true,
      }],
      alternativeSources: ['aria-label', 'fallback-text'],
      criterionIds: ['4.1', '4.3'],
      manualChecks: ['4.1 — Vérifier la transcription'],
      flags: ['MEDIA_REQUIRES_HUMAN_REVIEW'],
      requiresHumanReview: true,
      evidence: [{
        criterionId: '4.3',
        state: 'observed',
        proof: ['piste captions (fr)'],
        limits: ['Vérification humaine requise'],
        humanChecks: ['4.3 — Vérifier la synchronisation'],
      }],
    }, {
      selector: 'canvas#chart',
      kind: 'canvas',
      sources: [],
      accessibleName: 'Graphique des ventes',
      fallbackText: 'Graphique des ventes du trimestre.',
      surroundingText: 'Chiffre d’affaires trimestriel',
      controls: false,
      autoplay: false,
      tracks: [],
      alternativeSources: ['aria-label', 'fallback-text'],
      criterionIds: ['4.8', '4.9', '4.12', '4.13'],
      manualChecks: ['4.8 — Vérifier la présence d’une alternative', '4.9 — Vérifier la pertinence de l’alternative'],
      flags: ['MEDIA_REQUIRES_HUMAN_REVIEW'],
      requiresHumanReview: true,
      evidence: [{
        criterionId: '4.8',
        state: 'observed',
        proof: ['contenu de secours textuel candidat observé'],
        limits: ['Validation humaine requise'],
        humanChecks: ['4.8 — Vérifier la présence d’une alternative'],
      }, {
        criterionId: '4.9',
        state: 'observed',
        proof: ['contenu de secours textuel candidat observé'],
        limits: ['Validation humaine requise'],
        humanChecks: ['4.9 — Vérifier la pertinence de l’alternative'],
      }],
    }];

    const html = renderReportHtml({
      report: makeReport(),
      allCollected: [{ url: 'https://example.com/', collectedData: collected }],
    });

    expect(html).toContain('Annexe — Médias');
    expect(html).toContain('video#demo');
    expect(html).toContain('4.1 — Vérifier la transcription');
    expect(html).toContain('captions (fr)');
    expect(html).toContain('Contrôles : oui · Autoplay : non');
    expect(html).toContain('Contexte : Présentation');
    expect(html).toContain('Signaux : MEDIA_REQUIRES_HUMAN_REVIEW');
    expect(html).toContain('Critères : 4.1, 4.3');
    expect(html).toContain('piste captions (fr)');
    expect(html).toContain('Vérification humaine requise');
    expect(html).toContain('Validation humaine : 4.3 — Vérifier la synchronisation');
    expect(html).toContain('canvas#chart');
    expect(html).toContain('4.8 — Vérifier la présence d’une alternative');
    expect(html).toContain('4.9 — Vérifier la pertinence de l’alternative');
    expect(html).toContain('role="region" tabindex="0" aria-label="Annexe Médias — faites défiler horizontalement pour consulter toutes les colonnes"');
  });

  it('affiche l’annexe structurelle pour les critères langue, direction, régions et citations', () => {
    const collected = makeCollectedData();
    collected.structure = {
      pageFlags: ['HTML_VALIDITY_REVIEW'],
      tables: [],
      styles: { stylesheetCount: 1, inlineStyleCount: 0, presentationMarkupCount: 0, flags: ['STYLESHEET_PRESENT'] },
      colors: [],
      fieldGroups: [],
      landmarks: [],
      languages: [{ selector: 'p[lang="en"]', tagName: 'p', text: 'Hello', declaredLanguage: 'en', effectiveLanguage: 'en', languageSource: 'attribute', flags: ['LANGUAGE_DECLARATION_PRESENT'] }],
      directions: [{ selector: '#rtl', tagName: 'p', text: 'مرحبا', dirAttribute: 'rtl', effectiveDirection: 'rtl', cssDirection: 'rtl', unicodeBidi: 'normal', flags: ['DIRECTION_DECLARATION_PRESENT'] }],
      regions: [{ selector: 'main', tagName: 'main', role: 'main', accessibleName: 'Contenu', parentSelector: null, depth: 0, childRegionCount: 0, flags: ['REGION_PRESENT'] }],
      citations: [{ selector: 'blockquote', tagName: 'blockquote', kind: 'blockquote', text: 'Citation', citeAttribute: 'https://example.com/source', flags: ['CITATION_SEMANTIC_MARKUP'] }],
    };

    const html = renderReportHtml({
      report: makeReport(),
      allCollected: [{ url: 'https://example.com/', collectedData: collected }],
    });

    expect(html).toContain('data-testid="structure-section"');
    expect(html).toContain('RGAA 8.7');
    expect(html).toContain('LANGUAGE_DECLARATION_PRESENT');
    expect(html).toContain('DIRECTION_DECLARATION_PRESENT');
    expect(html).toContain('REGION_PRESENT');
    expect(html).toContain('CITATION_SEMANTIC_MARKUP');
    expect(html).toContain('aucun verdict automatique');
  });

  it('affiche l’annexe des états de présentation', () => {
    const collected = makeCollectedData();
    collected.presentation = {
      snapshots: [{
        scenario: 'viewport-320x256',
        status: 'observed',
        viewportWidth: 320,
        viewportHeight: 256,
        devicePixelRatio: 1,
        visualViewportScale: 1,
        documentScrollWidth: 480,
        documentScrollHeight: 256,
        documentClientWidth: 320,
        documentClientHeight: 256,
        bodyTextLength: 40,
        visibleTextLength: 40,
        focusableCount: 2,
        visibleFocusableCount: 2,
        cssZoom: '1',
        focusObservations: [{
          selector: '#action',
          tagName: 'button',
          role: null,
          text: 'Action',
          focusVisible: false,
          flags: ['PRESENTATION_FOCUS_REVIEW', 'PRESENTATION_FOCUS_INDICATOR_NOT_OBSERVED'],
        }],
        flags: ['PRESENTATION_VIEWPORT_320_CAPTURED', 'PRESENTATION_HORIZONTAL_OVERFLOW'],
        note: 'Revue humaine requise',
      }],
      perceptualCues: [{
        selector: '#visual-cue',
        tagName: 'p',
        text: 'Alerte',
        accessibleName: 'État important',
        kinds: ['color', 'shape', 'size', 'position'],
        color: 'rgb(255, 0, 0)',
        backgroundColor: 'rgb(255, 255, 255)',
        fontSize: '20px',
        borderRadius: '4px',
        position: 'relative',
        dimensions: { width: 120, height: 24 },
        flags: ['PERCEPTUAL_CUE_REVIEW', 'PERCEPTUAL_COLOR_CUE'],
      }],
      hiddenContent: [{
        selector: '#hidden-panel',
        reasons: ['hidden-attribute'],
        focusable: false,
        flags: ['HIDDEN_CONTENT_REVIEW'],
      }],
      flags: ['PRESENTATION_VIEWPORT_320_CAPTURED', 'PRESENTATION_HORIZONTAL_OVERFLOW'],
      manualChecks: [],
    };

    const html = renderReportHtml({
      report: makeReport(),
      allCollected: [{ url: 'https://example.com/', collectedData: collected }],
    });

    expect(html).toContain('data-testid="presentation-section"');
    expect(html).toContain('Annexe — Présentation et responsive');
    expect(html).toContain('Viewport 320 × 256');
    expect(html).toContain('PRESENTATION_HORIZONTAL_OVERFLOW');
    expect(html).toContain('#hidden-panel');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('défilement horizontal disponible');
    expect(html).toContain('Repères visuels candidats');
    expect(html).toContain('#visual-cue');
    expect(html).toContain('État important');
    expect(html).toContain('#action');
    expect(html).toContain('indicateur non observé');
  });

  it('affiche l’inventaire des systèmes de navigation', () => {
    const collected = makeCollectedData();
    collected.navigation = {
      systems: [{
        kind: 'search',
        selector: '#search',
        label: 'Rechercher',
        href: '/recherche',
        domIndex: 0,
        position: { top: 10, left: 20, width: 300, height: 40 },
        flags: ['NAVIGATION_SEARCH_PRESENT', 'NAVIGATION_POSITION_CAPTURED'],
      }],
      flags: ['NAVIGATION_SEARCH_PRESENT', 'NAVIGATION_POSITION_CAPTURED'],
      manualChecks: ['12.5 — Comparer la présence du moteur de recherche.'],
    };

    const html = renderReportHtml({
      report: makeReport(),
      allCollected: [{ url: 'https://example.com/', collectedData: collected }],
    });

    expect(html).toContain('data-testid="navigation-section"');
    expect(html).toContain('role="region"');
    expect(html).toContain('Annexe — Systèmes de navigation');
    expect(html).toContain('Moteur de recherche');
    expect(html).toContain('#search');
    expect(html).toContain('Tableau des systèmes de navigation');
  });

  it('affiche le bilan des contenus spécialisés avec le statut de revue', () => {
    const collected = makeCollectedData();
    collected.specializedContent = [{
      kind: 'document',
      selector: 'a[href="guide.pdf"]',
      source: 'https://example.com/guide.pdf',
      label: 'Guide accessible',
      context: 'Télécharger le guide',
      criterionIds: ['13.3', '13.4'],
      status: 'review_required',
      evidence: ['label observed'],
      flags: ['DOCUMENT_REQUIRES_HUMAN_REVIEW'],
      documentEvidence: {
        state: 'to_review',
        declaredMime: 'application/pdf',
        declaredSizeBytes: 4096,
        downloadDeclared: true,
        sourceExtension: 'pdf',
        localAnalysis: 'not_executed',
        proof: ['MIME déclaré: application/pdf'],
        limits: ['Document distant non exécuté'],
        humanChecks: ['13.3 — version accessible', '13.4 — même information'],
      },
    }];

    const html = renderReportHtml({
      report: makeReport(),
      allCollected: [{ url: 'https://example.com/', collectedData: collected }],
    });

    expect(html).toContain('Annexe — Contenus spécialisés');
    expect(html).toContain('a[href=&quot;guide.pdf&quot;]');
    expect(html).toContain('Revue humaine requise: 1');
    expect(html).toContain('13.3, 13.4');
    expect(html).toContain('Contrôles document (13.3–13.4)');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('application/pdf');
    expect(html).toContain('Limites : Document distant non exécuté');
    expect(html).toContain('Validation humaine : 13.3 — version accessible');
    expect(html).toContain('aucun verdict automatique');
  });

  it('affiche la pertinence candidate des titres de cadres dans le rapport', () => {
    const collected = makeCollectedData();
    collected.frames = [{
      selector: 'iframe#help', tagName: 'iframe', src: '/help', sourceUrl: 'https://example.com/help',
      origin: 'https://example.com', evidenceStatus: 'readable', elementIndex: 0,
      titleAttribute: 'Aide', titleStatus: 'present', flags: [],
      titleEvidence: {
        criterionId: '2.2', state: 'to_review', proof: ['Titre de cadre observé : Aide'],
        limits: ['Pertinence à vérifier'], humanChecks: ['2.2 — pertinence du titre'],
      },
    }];

    const html = renderReportHtml({
      report: makeReport(),
      allCollected: [{ url: 'https://example.com/', collectedData: collected }],
    });

    expect(html).toContain('data-testid="frames-section"');
    expect(html).toContain('Pertinence RGAA 2.2');
    expect(html).toContain('Titre de cadre observé : Aide');
    expect(html).toContain('aucun verdict automatique');
    expect(html).toContain('role="region"');
  });

  it('affiche les différences horodatées entre observations', () => {
    const html = renderReportHtml({
      report: {
        ...makeReport(),
        comparisons: [{
          before: { url: 'https://example.com/before', observedAt: '2026-10-21T10:00:00.000Z', stepId: 'step-1', available: true, selectors: ['link:a#old'] },
          after: { url: 'https://example.com/after', observedAt: '2026-10-21T10:01:00.000Z', stepId: 'step-2', available: true, selectors: ['link:a#new'] },
          changed: true,
          added: ['link:a#new'],
          removed: ['link:a#old'],
        }],
      },
    });

    expect(html).toContain('data-testid="comparison-section"');
    expect(html).toContain('2026-10-21T10:01:00.000Z');
    expect(html).toContain('Étape : step-1');
    expect(html).toContain('Étape : step-2');
    expect(html).toContain('link:a#new');
  });

  it('échappe les caractères HTML dangereux dans les données', () => {
    const report = makeReport({
      metadata: {
        url: 'https://example.com/<script>alert(1)</script>',
        date: '2025-01-15',
        version: '0.1.0',
        pagesAudited: 1,
        coveredThemes: [],
        totalRgaaCriteria: 106,
        coveredCriteria: 12,
      },
    });
    const html = renderReportHtml({ report });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('utilise les locales pour tous les textes (REGLE 4)', () => {
    const html = renderReportHtml({ report: makeReport() });

    // From locales: report.title
    expect(html).toContain('RGAA 4.1');
    // From locales: report.htmlFooter
    expect(html).toContain('RGAAudit');
  });

  it('fonctionne sans données annexes', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('id="rgaaudit-data"');
    expect(html).toContain('[]');
  });

  it('affiche l’annexe des tableaux avec les preuves et la décision humaine', () => {
    const html = renderReportHtml({
      report: makeReport(),
      allCollected: [{
        url: 'https://example.com/tables',
        pageId: 'page-table',
        collectedData: {
          ...makeCollectedData(),
          structure: {
            pageFlags: [],
            tables: [{
              selector: '#complex-data',
              dataFeatures: ['TH', 'SCOPE'],
              flags: ['TABLE_COMPLEX_CANDIDATE'],
              tableKind: 'data_candidate',
              complexitySignals: ['ROWSPAN_PRESENT', 'MULTIPLE_HEADER_ROWS'],
              captionText: 'Résultats',
              summaryText: 'Résumé du tableau',
              linearizedText: 'Nom | Score',
            }],
            styles: { stylesheetCount: 0, inlineStyleCount: 0, presentationMarkupCount: 0, flags: [] },
            colors: [],
            fieldGroups: [],
            landmarks: [],
          },
        },
      }],
    });

    expect(html).toContain('data-testid="tables-section"');
    expect(html).toContain('#complex-data');
    expect(html).toContain('Nom | Score');
    expect(html).toContain('Caractéristiques observées');
    expect(html).toContain('Revue humaine requise');
    expect(html).toContain('role="region"');
    expect(html).toContain('<th scope="col"');
  });

  it('affiche une jauge pour un contraste insuffisant', () => {
    const html = renderReportHtml({
      report: makeReport(),
      contrastViolations: [{
        pageUrl: 'https://example.com/',
        rgaaId: '3.2',
        selector: 'p.low-contrast',
        contrastRatio: '2.5:1',
        expectedContrastRatio: '4.5:1',
        fgColor: '#aaaaaa',
        bgColor: '#ffffff',
      }],
    });

    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="2.5"');
    expect(html).toContain('aria-valuemax="4.5"');
    expect(html).toContain('Insuffisant');
  });
});
