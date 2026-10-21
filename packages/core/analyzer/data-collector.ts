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

export interface FrameData {
  selector: string;
  tagName: string;
  src: string | null;
  /** Absolute source URL when the frame declares a src attribute. */
  sourceUrl?: string | null;
  /** Origin associated with the frame source, or the audited page for inline frames. */
  origin?: string | null;
  /** Whether the frame document was readable from the audited page. */
  evidenceStatus?: 'readable' | 'unreadable';
  /** Stable position among iframe/frame elements on the audited page. */
  elementIndex?: number;
  titleAttribute: string | null;
  titleStatus: 'absent' | 'empty' | 'present';
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

export interface FormControlData {
  selector: string;
  tagName: string;
  type: string;
  id: string | null;
  name: string | null;
  label: string | null;
  labelSource: 'aria-labelledby' | 'aria-label' | 'label' | null;
  required: boolean;
  invalid: boolean;
  autocomplete: string | null;
  describedByIds: string[];
  helpText: string | null;
  errorMessage: string | null;
  flags: string[];
}

export interface FormDataItem {
  selector: string;
  action: string | null;
  method: string;
  controls: FormControlData[];
  flags: string[];
}

export interface FigureCaptionData {
  selector: string;
  text: string;
  imageSelectors: string[];
  flags: string[];
}

export interface CollectedData {
  images: ImageData[];
  frames: FrameData[];
  links: LinkData[];
  headings: HeadingTree;
  /** Form fields, labels, help instructions and observable validation messages. */
  forms?: FormDataItem[];
  /** Optional for backwards-compatible persisted sessions. */
  figcaptions?: FigureCaptionData[];
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
    const getUniqueSelector = (element: Element): string => {
      const parts: string[] = [];
      let current: Element | null = element;

      while (current && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase();
        const id = current.getAttribute('id');
        const idSelector = id ? `${tag}#${CSS.escape(id)}` : null;
        if (idSelector && document.querySelectorAll(idSelector).length === 1) {
          parts.unshift(idSelector);
          break;
        }

        const parentElement: Element | null = current.parentElement;
        if (!parentElement) {
          parts.unshift(tag);
          break;
        }
        const sameTagSiblings = (Array.from(parentElement.children) as Element[])
          .filter((sibling: Element) => sibling.tagName === current!.tagName);
        const suffix = sameTagSiblings.length > 1
          ? `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`
          : '';
        parts.unshift(`${idSelector ?? tag}${suffix}`);
        current = parentElement;
      }

      return parts.join(' > ');
    };

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

      // Keep a valid, unique selector: it identifies the annex row and is reused for screenshots.
      const selector = getUniqueSelector(el);

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
// collectFrames
// ---------------------------------------------------------------------------

export async function collectFrames(page: Page): Promise<FrameData[]> {
  const frames = await page.evaluate(() => {
    const getUniqueSelector = (element: Element): string => {
      const parts: string[] = [];
      let current: Element | null = element;

      while (current && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase();
        const id = current.getAttribute('id');
        const idSelector = id ? `${tag}#${CSS.escape(id)}` : null;
        if (idSelector && document.querySelectorAll(idSelector).length === 1) {
          parts.unshift(idSelector);
          break;
        }

        const parentElement: Element | null = current.parentElement;
        if (!parentElement) {
          parts.unshift(tag);
          break;
        }

        const sameTagSiblings = (Array.from(parentElement.children) as Element[])
          .filter((sibling: Element) => sibling.tagName === current!.tagName);
        const suffix = sameTagSiblings.length > 1
          ? `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`
          : '';
        parts.unshift(`${tag}${suffix}`);
        current = parentElement;
      }

      return parts.join(' > ');
    };

    return [...document.querySelectorAll('iframe, frame')].map((element, elementIndex) => {
      const rawSrc = element.getAttribute('src');
      let sourceUrl: string | null = null;
      let origin: string | null = document.location.origin;
      if (rawSrc) {
        try {
          const resolved = new URL(rawSrc, document.baseURI);
          sourceUrl = resolved.href;
          origin = resolved.origin === 'null' ? null : resolved.origin;
        } catch {
          origin = null;
        }
      }

      let evidenceStatus: 'readable' | 'unreadable' = 'readable';
      try {
        const contentDocument = (element as HTMLIFrameElement).contentDocument;
        if (rawSrc && !contentDocument) evidenceStatus = 'unreadable';
      } catch {
        evidenceStatus = 'unreadable';
      }

      return {
        selector: getUniqueSelector(element),
        tagName: element.tagName.toLowerCase(),
        src: rawSrc,
        sourceUrl,
        origin,
        evidenceStatus,
        elementIndex,
        titleAttribute: element.getAttribute('title'),
      };
    });
  });

  return frames.map((frame) => {
    const titleStatus: FrameData['titleStatus'] = frame.titleAttribute === null
      ? 'absent'
      : frame.titleAttribute.trim() === ''
        ? 'empty'
        : 'present';
    const flags: string[] = [];

    if (titleStatus === 'absent') flags.push('FRAME_TITLE_ABSENT');
    if (titleStatus === 'empty') flags.push('FRAME_TITLE_EMPTY');
    if (frame.evidenceStatus === 'unreadable') flags.push('FRAME_CONTENT_UNREADABLE');

    return { ...frame, titleStatus, flags };
  });
}

// ---------------------------------------------------------------------------
// collectHeadings
// ---------------------------------------------------------------------------

export async function collectHeadings(page: Page): Promise<HeadingTree> {
  const genericTitles = getGenericTitles();

  const rawData = await page.evaluate(() => {
    const documentTitle = document.title?.trim() ?? '';
    const documentFlags: string[] = [];
    if (!document.doctype) {
      documentFlags.push('DOCTYPE_ABSENT');
    } else if (document.doctype.name.toLowerCase() !== 'html') {
      documentFlags.push('DOCTYPE_INVALID');
    }
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

    return { documentTitle, headings, documentFlags };
  });

  // Compute page-level flags
  const pageFlags: string[] = [...rawData.documentFlags];
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
// collectForms
// ---------------------------------------------------------------------------

export async function collectForms(page: Page): Promise<FormDataItem[]> {
  return page.evaluate(() => {
    const getUniqueSelector = (element: Element): string => {
      const id = element.getAttribute('id');
      if (id) {
        const escaped = CSS.escape(id);
        if (document.querySelectorAll(`#${escaped}`).length === 1) return `#${escaped}`;
      }
      const tag = element.tagName.toLowerCase();
      const parent = element.parentElement;
      if (!parent) return tag;
      const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
      const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(element) + 1})` : '';
      const parentSelector = getUniqueSelector(parent);
      return `${parentSelector} > ${tag}${suffix}`;
    };

    const getReferencedText = (ids: string[]): string | null => {
      const text = ids
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text || null;
    };

    const controlsFor = (container: Element | Document): FormControlData[] => {
      const controls = Array.from(container.querySelectorAll('input:not([type="hidden"]), textarea, select'));
      return controls.map((control) => {
        const id = control.getAttribute('id');
        const ariaLabelledbyIds = (control.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
        const describedByIds = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
        const labelledByText = getReferencedText(ariaLabelledbyIds);
        const ariaLabel = control.getAttribute('aria-label')?.trim() || null;
        const associatedLabel = id
          ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() || null
          : control.closest('label')?.textContent?.trim() || null;
        const label = labelledByText || ariaLabel || associatedLabel;
        const labelSource: FormControlData['labelSource'] = labelledByText
          ? 'aria-labelledby'
          : ariaLabel
            ? 'aria-label'
            : associatedLabel
              ? 'label'
              : null;
        const invalid = control.getAttribute('aria-invalid') === 'true';
        const helpText = getReferencedText(describedByIds);
        const errorIds = (control.getAttribute('aria-errormessage') ?? '').split(/\s+/).filter(Boolean);
        const errorMessage = getReferencedText(errorIds);
        const flags: string[] = [];
        if (!label) flags.push('FORM_LABEL_ABSENT');
        if (invalid && !errorMessage) flags.push('FORM_ERROR_MESSAGE_ABSENT');
        if (describedByIds.some((ref) => !document.getElementById(ref))) {
          flags.push('FORM_HELP_REFERENCE_MISSING');
        }

        return {
          selector: getUniqueSelector(control),
          tagName: control.tagName.toLowerCase(),
          type: control.getAttribute('type') ?? control.tagName.toLowerCase(),
          id,
          name: control.getAttribute('name'),
          label,
          labelSource,
          required: control.hasAttribute('required') || control.getAttribute('aria-required') === 'true',
          invalid,
          autocomplete: control.getAttribute('autocomplete'),
          describedByIds,
          helpText,
          errorMessage,
          flags,
        };
      });
    };

    const forms = Array.from(document.querySelectorAll('form')).map((form) => ({
      selector: getUniqueSelector(form),
      action: form.getAttribute('action'),
      method: (form.getAttribute('method') ?? 'get').toLowerCase(),
      controls: controlsFor(form),
      flags: [],
    }));

    const controlsOutsideForms = controlsFor(document).filter((control) => {
      const element = document.querySelector(control.selector);
      return !element?.closest('form');
    });
    if (controlsOutsideForms.length > 0) {
      forms.push({ selector: '(contrôles hors formulaire)', action: null, method: 'get', controls: controlsOutsideForms, flags: [] });
    }
    return forms;
  });
}

// ---------------------------------------------------------------------------
// collectFigureCaptions
// ---------------------------------------------------------------------------

export async function collectFigureCaptions(page: Page): Promise<FigureCaptionData[]> {
  const captions = await page.evaluate(() => {
    const getUniqueSelector = (element: Element): string => {
      const parts: string[] = [];
      let current: Element | null = element;

      while (current && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase();
        const id = current.getAttribute('id');
        const idSelector = id ? `${tag}#${CSS.escape(id)}` : null;
        if (idSelector && document.querySelectorAll(idSelector).length === 1) {
          parts.unshift(idSelector);
          break;
        }

        const parentElement: Element | null = current.parentElement;
        if (!parentElement) {
          parts.unshift(tag);
          break;
        }
        const sameTagSiblings = [...parentElement.children]
          .filter((sibling) => sibling.tagName === current!.tagName);
        const suffix = sameTagSiblings.length > 1
          ? `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`
          : '';
        parts.unshift(`${tag}${suffix}`);
        current = parentElement;
      }

      return parts.join(' > ');
    };

    return [...document.querySelectorAll('figcaption')].map((caption) => {
      const figure = caption.closest('figure');
      const imageSelectors = figure
        ? [...figure.querySelectorAll('img, svg[role="img"], input[type="image"]')]
          .map((image) => getUniqueSelector(image))
        : [];

      return {
        selector: getUniqueSelector(caption),
        text: caption.textContent?.trim() ?? '',
        imageSelectors,
      };
    });
  });

  return captions.map((caption) => ({
    ...caption,
    flags: caption.imageSelectors.length === 0 ? ['FIGCAPTION_ORPHAN'] : [],
  }));
}

// ---------------------------------------------------------------------------
// collectAll
// ---------------------------------------------------------------------------

export async function collectAll(page: Page): Promise<CollectedData> {
  const [images, frames, links, headings, forms, figcaptions] = await Promise.all([
    collectImages(page),
    collectFrames(page),
    collectLinks(page),
    collectHeadings(page),
    collectForms(page),
    collectFigureCaptions(page),
  ]);

  return { images, frames, links, headings, forms, figcaptions };
}
