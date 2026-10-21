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
  });

  it('affiche l’annexe formulaires dans le rapport HTML', () => {
    const html = renderReportHtml({
      report: makeReport(),
      allCollected: [{ url: 'https://example.com/', collectedData: makeCollectedData() }],
    });

    expect(html).toContain('Annexe — Formulaires');
    expect(html).toContain('Adresse électronique');
    expect(html).toContain('Email invalide');
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
