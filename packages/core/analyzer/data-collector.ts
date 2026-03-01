import type { Page } from 'playwright';
import { getCriterion } from '../mapping';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageData {
  selector: string;
  tagName: string;
  src: string;
  altAttribute: string | null;
  altStatus: 'absent' | 'empty' | 'present';
  ariaLabel: string | null;
  ariaLabelledby: string | null;
  rolePresentation: boolean;
  surroundingText: string;
  parentFigcaption: string | null;
  isInLink: boolean;
  linkHref: string | null;
  linkText: string | null;
  axeViolations: string[];
  automatedStatus: 'violation' | 'pass' | 'manual';
  flags: string[];
  screenshotPath: string | null;
}

export interface LinkData {
  selector: string;
  tagName: string;
  accessibleLabel: string | null;
  href: string | null;
  opensNewWindow: boolean;
  hasNewWindowWarning: boolean;
  flags: string[];
}

export interface HeadingData {
  level: number;
  text: string;
  selector: string;
  flags: Array<string | { flag: string; skipFrom: number; skipTo: number }>;
}

export interface HeadingTree {
  documentTitle: string;
  headings: HeadingData[];
  flags: string[];
}

export interface CollectedData {
  images: ImageData[];
  links: LinkData[];
  headings: HeadingTree;
}

// ---------------------------------------------------------------------------
// Helpers — build patterns from mapping JSON (RÈGLE 1)
// ---------------------------------------------------------------------------

function buildGenericAltRegex(): RegExp {
  const criterion = getCriterion('1.1');
  if (!criterion) return /^$/;

  const patterns = criterion.heuristicPatterns;
  const labels = patterns.genericLabels ?? [];
  const filePatterns = patterns.genericFilePatterns ?? [];

  const labelPart = labels.map((l) => `^${escapeRegExp(l)}$`).join('|');
  const filePart = filePatterns.join('|');

  const combined = [labelPart, filePart].filter(Boolean).join('|');
  return new RegExp(combined, 'i');
}

function getGenericLinkLabels(): Set<string> {
  const criterion = getCriterion('6.1');
  if (!criterion) return new Set();
  const labels = criterion.heuristicPatterns.genericLabels ?? [];
  return new Set(labels.map((l) => l.toLowerCase().trim()));
}

function getGenericTitles(): Set<string> {
  const criterion = getCriterion('8.6');
  if (!criterion) return new Set();
  const titles = criterion.heuristicPatterns.genericTitles ?? [];
  return new Set(titles.map((t) => t.toLowerCase().trim()));
}

function getAltMaxLength(): number {
  const criterion = getCriterion('1.1');
  return criterion?.altMaxLength ?? 80;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// collectImages
// ---------------------------------------------------------------------------

export async function collectImages(page: Page): Promise<ImageData[]> {
  const genericAltRegex = buildGenericAltRegex();
  const altMaxLength = getAltMaxLength();

  const rawImages = await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll('img'),
      ...document.querySelectorAll('svg[role="img"]'),
      ...document.querySelectorAll('input[type="image"]'),
    ];

    return elements.map((el) => {
      const tagName = el.tagName.toLowerCase();
      const altAttr = el.getAttribute('alt');
      const src = el.getAttribute('src') ?? '';
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledby = el.getAttribute('aria-labelledby');
      const role = el.getAttribute('role');
      const rolePresentation = role === 'presentation' || role === 'none';

      // Surrounding text (max 100 chars)
      const parent = el.parentElement;
      let surroundingText = '';
      if (parent) {
        const clone = parent.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('img, svg, input[type="image"]').forEach((n) => n.remove());
        surroundingText = (clone.textContent ?? '').trim().slice(0, 100);
      }

      // Figcaption
      const figure = el.closest('figure');
      const figcaption = figure?.querySelector('figcaption');
      const parentFigcaption = figcaption?.textContent?.trim() ?? null;

      // Link context
      const linkEl = el.closest('a');
      const isInLink = linkEl !== null;
      const linkHref = linkEl?.getAttribute('href') ?? null;
      let linkText: string | null = null;
      if (linkEl) {
        const clone = linkEl.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('img, svg, input[type="image"]').forEach((n) => n.remove());
        linkText = clone.textContent?.trim() || null;
      }

      // Build a CSS selector
      let selector = tagName;
      const id = el.getAttribute('id');
      if (id) {
        selector = `${tagName}#${id}`;
      } else if (src) {
        const shortSrc = src.length > 50 ? src.slice(0, 50) : src;
        selector = `${tagName}[src="${shortSrc}"]`;
      }

      return {
        selector,
        tagName,
        src,
        altAttribute: altAttr,
        ariaLabel,
        ariaLabelledby,
        rolePresentation,
        surroundingText,
        parentFigcaption,
        isInLink,
        linkHref,
        linkText,
      };
    });
  });

  return rawImages.map((img) => {
    const altStatus: ImageData['altStatus'] =
      img.altAttribute === null ? 'absent' : img.altAttribute === '' ? 'empty' : 'present';

    const flags: string[] = [];

    if (img.altAttribute === null) {
      flags.push('ALT_ABSENT');
    }

    if (img.altAttribute !== null && img.altAttribute !== '' && genericAltRegex.test(img.altAttribute)) {
      flags.push('ALT_GENERIC');
    }

    if (img.altAttribute !== null && img.altAttribute.length > altMaxLength) {
      flags.push('ALT_TOO_LONG');
    }

    if (img.isInLink && img.altAttribute === '') {
      flags.push('IMG_IN_LINK_ALT_EMPTY');
    }

    if (img.rolePresentation && img.altAttribute !== null && img.altAttribute !== '') {
      flags.push('ROLE_PRESENTATION_SUSPICIOUS');
    }

    const hasViolation = flags.some((f) => f === 'ALT_ABSENT' || f === 'ALT_GENERIC' || f === 'IMG_IN_LINK_ALT_EMPTY');
    const automatedStatus: ImageData['automatedStatus'] = hasViolation ? 'violation' : altStatus === 'present' ? 'pass' : 'manual';

    return {
      ...img,
      altStatus,
      axeViolations: [],
      automatedStatus,
      flags,
      screenshotPath: null,
    };
  });
}

// ---------------------------------------------------------------------------
// collectLinks
// ---------------------------------------------------------------------------

export async function collectLinks(page: Page): Promise<LinkData[]> {
  const genericLabels = getGenericLinkLabels();

  const rawLinks = await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll('a[href]'),
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('input[type="button"], input[type="submit"], input[type="reset"]'),
    ];

    return elements.map((el) => {
      const tagName = el.tagName.toLowerCase();
      const href = el.getAttribute('href');

      // Accessible label in priority order: aria-labelledby → aria-label → visible text → alt img child → title
      const ariaLabelledbyId = el.getAttribute('aria-labelledby');
      let label: string | null = null;

      if (ariaLabelledbyId) {
        const referencedEl = document.getElementById(ariaLabelledbyId);
        if (referencedEl) {
          label = referencedEl.textContent?.trim() || null;
        }
      }

      if (!label) {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) {
          label = ariaLabel.trim();
        }
      }

      if (!label) {
        // Visible text (excluding images)
        const clone = el.cloneNode(true) as HTMLElement;
        const imgs = clone.querySelectorAll('img');
        imgs.forEach((img) => img.remove());
        const text = clone.textContent?.trim();
        if (text) {
          label = text;
        }
      }

      if (!label) {
        // Alt of child img
        const img = el.querySelector('img[alt]');
        if (img) {
          const alt = img.getAttribute('alt')?.trim();
          if (alt) label = alt;
        }
      }

      if (!label) {
        const title = el.getAttribute('title');
        if (title && title.trim()) {
          label = title.trim();
        }
      }

      // New window detection
      const target = el.getAttribute('target');
      const opensNewWindow = target === '_blank';

      // Warning detection: aria-label mentioning "nouvelle fenêtre" or "new window",
      // or a visually hidden span, or title attribute
      let hasNewWindowWarning = false;
      if (opensNewWindow) {
        const fullText = el.textContent?.toLowerCase() ?? '';
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() ?? '';
        const title = el.getAttribute('title')?.toLowerCase() ?? '';
        const warningTerms = ['nouvelle fenêtre', 'new window', 'nouvel onglet', 'new tab'];
        hasNewWindowWarning = warningTerms.some(
          (term) => fullText.includes(term) || ariaLabel.includes(term) || title.includes(term)
        );
      }

      // Selector
      let selector = tagName;
      const id = el.getAttribute('id');
      if (id) {
        selector = `${tagName}#${id}`;
      } else if (href) {
        const shortHref = href.length > 50 ? href.slice(0, 50) : href;
        selector = `${tagName}[href="${shortHref}"]`;
      }

      return {
        selector,
        tagName,
        accessibleLabel: label,
        href,
        opensNewWindow,
        hasNewWindowWarning,
      };
    });
  });

  return rawLinks.map((link) => {
    const flags: string[] = [];

    if (!link.accessibleLabel || link.accessibleLabel.trim() === '') {
      flags.push('EMPTY_LABEL');
    }

    if (link.accessibleLabel && genericLabels.has(link.accessibleLabel.toLowerCase().trim())) {
      flags.push('GENERIC_LABEL');
    }

    if (link.opensNewWindow && !link.hasNewWindowWarning) {
      flags.push('NEW_WINDOW_NO_WARNING');
    }

    return { ...link, flags };
  });
}

// ---------------------------------------------------------------------------
// collectHeadings
// ---------------------------------------------------------------------------

export async function collectHeadings(page: Page): Promise<HeadingTree> {
  const genericTitles = getGenericTitles();

  const rawData = await page.evaluate(() => {
    const documentTitle = document.title?.trim() ?? '';
    const headingEls = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

    const headings = [...headingEls].map((el) => {
      const tagName = el.tagName.toLowerCase();
      const level = parseInt(tagName.replace('h', ''), 10);
      const text = el.textContent?.trim() ?? '';

      let selector = tagName;
      const id = el.getAttribute('id');
      if (id) {
        selector = `${tagName}#${id}`;
      }

      return { level, text, selector };
    });

    return { documentTitle, headings };
  });

  // Compute page-level flags
  const pageFlags: string[] = [];
  const h1Count = rawData.headings.filter((h) => h.level === 1).length;

  if (h1Count === 0) {
    pageFlags.push('NO_H1');
  } else if (h1Count > 1) {
    pageFlags.push('MULTIPLE_H1');
  }

  if (!rawData.documentTitle) {
    pageFlags.push('TITLE_ABSENT');
  } else if (genericTitles.has(rawData.documentTitle.toLowerCase().trim())) {
    pageFlags.push('TITLE_GENERIC');
  }

  // Compute per-heading flags (level skips)
  const headings: HeadingData[] = rawData.headings.map((h, i) => {
    const flags: HeadingData['flags'] = [];

    if (i > 0) {
      const prevLevel = rawData.headings[i - 1].level;
      if (h.level > prevLevel + 1) {
        flags.push({ flag: 'LEVEL_SKIP', skipFrom: prevLevel, skipTo: h.level });
        if (!pageFlags.includes('LEVEL_SKIP')) {
          pageFlags.push('LEVEL_SKIP');
        }
      }
    }

    return { ...h, flags };
  });

  return {
    documentTitle: rawData.documentTitle,
    headings,
    flags: pageFlags,
  };
}

// ---------------------------------------------------------------------------
// collectAll
// ---------------------------------------------------------------------------

export async function collectAll(page: Page): Promise<CollectedData> {
  const [images, links, headings] = await Promise.all([
    collectImages(page),
    collectLinks(page),
    collectHeadings(page),
  ]);

  return { images, links, headings };
}
