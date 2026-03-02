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
          status: 'pass',
          pagesViolating: [],
          pagesPass: ['https://example.com/'],
          pagesManual: [],
          pagesIncomplete: [],
        },
      ],
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
    links: [],
    headings: {
      documentTitle: 'Accueil',
      headings: [{ level: 1, text: 'Bienvenue', selector: 'h1', flags: [] }],
      flags: [],
    },
  };
}

describe('renderReportHtml', () => {
  it('produit un HTML valide avec DOCTYPE et lang fr', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('</html>');
  });

  it('contient le Tailwind CDN pour le styling', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('cdn.tailwindcss.com');
  });

  it('affiche le bandeau de limite', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('data-testid="limit-banner"');
    expect(html).toContain('12 critères RGAA sur 106');
  });

  it('affiche les cartes de synthèse (violations, passes, manual)', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('>3<'); // violations count
    expect(html).toContain('>5<'); // passes count
    expect(html).toContain('>4<'); // manual count
  });

  it('affiche les critères groupés par thématique', () => {
    const html = renderReportHtml({ report: makeReport() });

    expect(html).toContain('1.1');
    expect(html).toContain('6.1');
    expect(html).toContain('Non conforme'); // violation status label
    expect(html).toContain('Conforme'); // pass status label
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
});
