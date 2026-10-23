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
  /** Alternative sources discovered around the image, kept as evidence for human review. */
  alternativeSources?: Array<'alt' | 'aria-label' | 'aria-labelledby' | 'figcaption' | 'link-text' | 'surrounding-text'>;
  /** Explicit checks for the specialized image criteria covered by the backlog. */
  manualChecks?: string[];
  axeViolations: string[];
  automatedStatus: 'violation' | 'pass' | 'manual';
  flags: string[];
  screenshotPath: string | null;
}

export type MediaKind = 'audio' | 'video' | 'canvas' | 'object' | 'embed';
export type MediaTrackKind = 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata' | 'unknown';

export interface MediaTrackData {
  kind: MediaTrackKind;
  src: string | null;
  srcLang: string | null;
  label: string | null;
  isDefault: boolean;
}

/** Inventory of a temporal media element; all conformance decisions remain human. */
export interface MediaData {
  selector: string;
  kind: MediaKind;
  sources: string[];
  accessibleName: string | null;
  fallbackText: string | null;
  surroundingText: string;
  controls: boolean;
  autoplay: boolean;
  tracks: MediaTrackData[];
  alternativeSources: Array<'aria-label' | 'aria-labelledby' | 'title' | 'fallback-text' | 'surrounding-text'>;
  criterionIds: string[];
  manualChecks: string[];
  flags: string[];
  requiresHumanReview: true;
  /** True when collection caps were reached for this element or its evidence. */
  truncated?: boolean;
}

export type SpecializedContentKind = 'media' | 'captcha' | 'document';

/** Cross-theme inventory used by US-17; every entry remains a human review shell. */
export interface SpecializedContentData {
  kind: SpecializedContentKind;
  selector: string;
  source: string | null;
  label: string | null;
  context: string;
  criterionIds: string[];
  status: 'review_required';
  evidence: string[];
  flags: string[];
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

export interface StructureTableData {
  selector: string;
  dataFeatures: string[];
  flags: string[];
}

export interface StructureFieldGroupData {
  selector: string;
  legend: string | null;
  controlCount: number;
  flags: string[];
}

export interface StructureColorData {
  selector: string;
  color: string | null;
  backgroundColor: string | null;
  flags: string[];
}

export interface StructureLandmarkData {
  selector: string;
  role: string;
  accessibleName: string | null;
  flags: string[];
}

/** Evidence shared by the DOM/CSS/form/navigation criteria of lot 1. */
export interface StructureData {
  pageFlags: string[];
  tables: StructureTableData[];
  styles: {
    stylesheetCount: number;
    inlineStyleCount: number;
    presentationMarkupCount: number;
    flags: string[];
  };
  colors: StructureColorData[];
  fieldGroups: StructureFieldGroupData[];
  landmarks: StructureLandmarkData[];
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
  /** Temporal and non-temporal media inventory for the dedicated multimedia review backlog. */
  media?: MediaData[];
  /** Cross-theme inventory for media, CAPTCHA candidates and downloadable documents. */
  specializedContent?: SpecializedContentData[];
  frames: FrameData[];
  links: LinkData[];
  headings: HeadingTree;
  /** DOM/CSS/form/navigation evidence for the foundational lot-1 criteria. */
  structure?: StructureData;
  /** Form fields, labels, help instructions and observable validation messages. */
  forms?: FormDataItem[];
  /** Optional for backwards-compatible persisted sessions. */
  figcaptions?: FigureCaptionData[];
}

const SPECIALIZED_IMAGE_CRITERIA = ['1.4', '1.5', '1.6', '1.7', '1.8'] as const;
// US-16 scope: temporal media (4.1–4.6) and non-temporal media (4.8–4.9).
// Criteria 4.7, 4.10–4.13 remain separate manual/backlog work and are not
// silently presented as covered by this inventory.
const TEMPORAL_MEDIA_CRITERIA = ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6'] as const;
const NON_TEMPORAL_MEDIA_CRITERIA = ['4.8', '4.9'] as const;
const MEDIA_LIMITS = {
  items: 100,
  sources: 20,
  tracks: 20,
  urlLength: 2_000,
  textLength: 500,
} as const;

function getSpecializedImageChecks(): string[] {
  return SPECIALIZED_IMAGE_CRITERIA.flatMap((id) => {
    const checks = getCriterion(id)?.heuristicPatterns.manualChecks ?? [];
    return checks.map((check) => `${id} — ${check}`);
  });
}

function getSpecializedMediaChecks(ids: readonly string[]): string[] {
  return ids.flatMap((id) => {
    const checks = getCriterion(id)?.heuristicPatterns.manualChecks ?? [];
    return checks.map((check) => `${id} — ${check}`);
  });
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
      const ariaLabelledbyText = (ariaLabelledby ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
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

      const alternativeSources: Array<'alt' | 'aria-label' | 'aria-labelledby' | 'figcaption' | 'link-text' | 'surrounding-text'> = [];
      if (altAttr !== null) alternativeSources.push('alt');
      if (ariaLabel?.trim()) alternativeSources.push('aria-label');
      if (ariaLabelledbyText) alternativeSources.push('aria-labelledby');
      if (parentFigcaption) alternativeSources.push('figcaption');
      if (linkText) alternativeSources.push('link-text');
      if (surroundingText) alternativeSources.push('surrounding-text');

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
        alternativeSources,
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
      manualChecks: getSpecializedImageChecks(),
      altStatus,
      axeViolations: [],
      automatedStatus,
      flags,
      screenshotPath: null,
    };
  });
}

// ---------------------------------------------------------------------------
// collectMedia
// ---------------------------------------------------------------------------

export async function collectMedia(page: Page): Promise<MediaData[]> {
  const rawMedia = await page.evaluate((limits) => {
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
        const parent: Element | null = current.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }
        const siblings = (Array.from(parent.children) as Element[]).filter((child) => child.tagName === current!.tagName);
        const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : '';
        parts.unshift(`${tag}${suffix}`);
        current = parent;
      }
      return parts.join(' > ');
    };

    const elements = Array.from(document.querySelectorAll('audio, video, canvas, object, embed'));
    const truncatedItems = elements.length > limits.items;
    return elements.slice(0, limits.items).map((element) => {
      let truncated = truncatedItems;
      const normalizeText = (value: string | null | undefined, max = 160): string | null => {
        const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
        const limit = Math.min(max, limits.textLength);
        if (normalized.length > limit) truncated = true;
        return normalized ? normalized.slice(0, limit) : null;
      };

      const resolveUrl = (value: string | null): string | null => {
        if (!value) return null;
        let resolved: string;
        try {
          resolved = new URL(value, document.baseURI).href;
        } catch {
          resolved = value;
        }
        if (resolved.length > limits.urlLength) truncated = true;
        return resolved.slice(0, limits.urlLength);
      };

      const temporal = element instanceof HTMLMediaElement;
      const media = temporal ? element : null;
      const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
      const ariaLabel = normalizeText(element.getAttribute('aria-label'));
      const title = normalizeText(element.getAttribute('title'));
      const accessibleName = ariaLabel ?? normalizeText(labelledBy) ?? title;

      const fallbackClone = element.cloneNode(true) as HTMLElement;
      fallbackClone.querySelectorAll('source, track').forEach((child) => child.remove());
      const fallbackText = normalizeText(fallbackClone.textContent);

      const parent = element.parentElement;
      const contextClone = parent?.cloneNode(true) as HTMLElement | undefined;
      contextClone?.querySelectorAll('audio, video, canvas, object, embed').forEach((child) => child.remove());
      const surroundingText = normalizeText(contextClone?.textContent) ?? '';

      const trackElements = Array.from(element.querySelectorAll('track'));
      if (trackElements.length > limits.tracks) truncated = true;
      const tracks = temporal ? trackElements.slice(0, limits.tracks).map((track) => {
        const rawKind = track.getAttribute('kind')?.toLowerCase() ?? 'unknown';
        const kind: MediaTrackKind = ['subtitles', 'captions', 'descriptions', 'chapters', 'metadata'].includes(rawKind)
          ? rawKind as MediaTrackKind
          : 'unknown';
        return {
          kind,
          src: resolveUrl(track.getAttribute('src')),
          srcLang: track.getAttribute('srclang'),
          label: normalizeText(track.getAttribute('label')),
          isDefault: track.hasAttribute('default'),
        };
      }) : [];

      const sourceValues = [
        resolveUrl(element.getAttribute('src')),
        resolveUrl(element.getAttribute('data')),
        ...Array.from(element.querySelectorAll('source')).map((source) => resolveUrl(source.getAttribute('src'))),
      ].filter((source): source is string => Boolean(source));
      if (sourceValues.length > limits.sources) truncated = true;
      const sources = sourceValues.slice(0, limits.sources);

      const alternativeSources: MediaData['alternativeSources'] = [];
      if (ariaLabel) alternativeSources.push('aria-label');
      if (normalizeText(labelledBy)) alternativeSources.push('aria-labelledby');
      if (title) alternativeSources.push('title');
      if (fallbackText) alternativeSources.push('fallback-text');
      if (surroundingText) alternativeSources.push('surrounding-text');

      return {
        selector: getUniqueSelector(element),
        kind: element.tagName.toLowerCase() as MediaKind,
        sources,
        accessibleName,
        fallbackText,
        surroundingText,
        controls: media?.controls ?? false,
        autoplay: media?.autoplay ?? false,
        tracks,
        alternativeSources,
        truncated,
      };
    });
  }, MEDIA_LIMITS);

  return rawMedia.map((media) => {
    const criterionIds = media.kind === 'audio' || media.kind === 'video'
      ? [...TEMPORAL_MEDIA_CRITERIA]
      : [...NON_TEMPORAL_MEDIA_CRITERIA];
    const flags: string[] = ['MEDIA_REQUIRES_HUMAN_REVIEW'];
    if (media.sources.length === 0) flags.push('MEDIA_SOURCE_ABSENT');
    if (media.truncated) flags.push('MEDIA_EVIDENCE_TRUNCATED');
    // Context, title and accessible names are useful evidence, but are not
    // themselves a transcript or an audio description.
    if (!media.fallbackText && media.tracks.length === 0) {
      flags.push('MEDIA_ALTERNATIVE_ABSENT');
    }
    if (media.kind === 'video' && !media.tracks.some((track) => track.kind === 'subtitles' || track.kind === 'captions')) {
      flags.push('MEDIA_CAPTIONS_TO_VERIFY');
    }
    return {
      ...media,
      criterionIds,
      manualChecks: getSpecializedMediaChecks(criterionIds),
      flags,
      requiresHumanReview: true as const,
    };
  });
}

// ---------------------------------------------------------------------------
// collectSpecializedContent — US-17
// ---------------------------------------------------------------------------

const DOCUMENT_EXTENSIONS = /\.(?:pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|csv)(?:[?#].*)?$/i;
const CAPTCHA_HINT = /captcha|recaptcha|hcaptcha|challenge|image[-_ ]?test/i;
const SPECIALIZED_LIMITS = {
  items: 100,
  urlLength: 2_000,
  textLength: 500,
} as const;

export async function collectSpecializedContent(
  page: Page,
  media: MediaData[] = [],
  images: ImageData[] = [],
): Promise<SpecializedContentData[]> {
  const raw = await page.evaluate(({ documentExtensions, captchaHint, limits }) => {
    const documentPattern = new RegExp(documentExtensions, 'i');
    const captchaPattern = new RegExp(captchaHint, 'i');
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
        const parent: Element | null = current.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }
        const siblings = (Array.from(parent.children) as Element[]).filter((child) => child.tagName === current!.tagName);
        const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : '';
        parts.unshift(`${tag}${suffix}`);
        current = parent;
      }
      return parts.join(' > ');
    };

    const normalize = (value: string | null | undefined, max = 300, onTruncate?: () => void): string => {
      const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
      const limit = Math.min(max, limits.textLength);
      if (normalized.length > limit) onTruncate?.();
      return normalized.slice(0, limit);
    };

    const resolveUrl = (value: string | null): string | null => {
      if (!value) return null;
      try {
        return new URL(value, document.baseURI).href.slice(0, limits.urlLength);
      } catch {
        return value.slice(0, limits.urlLength);
      }
    };

    const contextOf = (element: Element): string => {
      const parent = element.parentElement?.cloneNode(true) as HTMLElement | undefined;
      parent?.querySelectorAll('img, audio, video, canvas, object, embed').forEach((child) => child.remove());
      return normalize(parent?.textContent);
    };

    const allCaptchaCandidates = Array.from(document.querySelectorAll('img')).filter((element) => {
      const haystack = [
        element.getAttribute('id'),
        element.getAttribute('class'),
        element.getAttribute('alt'),
        element.getAttribute('aria-label'),
        element.getAttribute('src'),
        contextOf(element),
      ].join(' ');
      return captchaPattern.test(haystack);
    });
    const captchaCandidates = allCaptchaCandidates.slice(0, limits.items).map((element) => {
      let truncated = allCaptchaCandidates.length > limits.items;
      const label = normalize(element.getAttribute('alt') || element.getAttribute('aria-label') || element.getAttribute('title'), 300, () => { truncated = true; }) || null;
      const sourceValue = element.getAttribute('src');
      if (sourceValue && sourceValue.length > limits.urlLength) truncated = true;
      return {
        selector: getUniqueSelector(element),
        source: resolveUrl(sourceValue),
        label,
        context: contextOf(element),
        truncated,
      };
    });

    const allDocumentCandidates = Array.from(document.querySelectorAll('a[href], object[data], embed[src]'))
      .map((element) => {
        const value = element.getAttribute('href') ?? element.getAttribute('data') ?? element.getAttribute('src');
        const source = resolveUrl(value);
        return {
          selector: getUniqueSelector(element),
          source,
          label: normalize(element.textContent || element.getAttribute('aria-label') || element.getAttribute('title')) || null,
          context: contextOf(element),
        };
      })
      .filter((candidate) => candidate.source && documentPattern.test(candidate.source));
    const documentCandidates = allDocumentCandidates.slice(0, limits.items).map((candidate) => ({
      ...candidate,
      truncated: allDocumentCandidates.length > limits.items,
    }));

    return { captchaCandidates, documentCandidates };
  }, { documentExtensions: DOCUMENT_EXTENSIONS.source, captchaHint: CAPTCHA_HINT.source, limits: SPECIALIZED_LIMITS });

  const mediaItems: SpecializedContentData[] = media.map((item) => ({
    kind: 'media',
    selector: item.selector,
    source: item.sources[0] ?? null,
    label: item.accessibleName ?? item.fallbackText,
    context: item.surroundingText,
    criterionIds: item.criterionIds,
    status: 'review_required',
    evidence: [
      ...item.tracks.map((track) => `${track.kind}${track.srcLang ? ` (${track.srcLang})` : ''}`),
      ...item.alternativeSources,
    ],
    flags: item.flags,
  }));

  const captchaItems: SpecializedContentData[] = raw.captchaCandidates.map((candidate) => {
    const image = images.find((item) => item.selector === candidate.selector);
    const flags = ['CAPTCHA_REQUIRES_HUMAN_REVIEW'];
    if (!candidate.label) flags.push('CAPTCHA_ALTERNATIVE_ABSENT');
    if (candidate.truncated) flags.push('SPECIALIZED_EVIDENCE_TRUNCATED');
    return {
      kind: 'captcha',
      selector: candidate.selector,
      source: candidate.source,
      label: candidate.label,
      context: candidate.context,
      criterionIds: ['1.4', '1.5', '1.6', '1.7', '1.8'],
      status: 'review_required',
      evidence: image?.alternativeSources ?? [],
      flags,
    };
  });

  const documentItems: SpecializedContentData[] = raw.documentCandidates.map((candidate) => ({
    kind: 'document',
    selector: candidate.selector,
    source: candidate.source,
    label: candidate.label,
    context: candidate.context,
    criterionIds: ['13.3', '13.4'],
    status: 'review_required',
    evidence: candidate.label ? ['label observed'] : [],
    flags: [
      'DOCUMENT_REQUIRES_HUMAN_REVIEW',
      'DOCUMENT_ACCESSIBLE_VERSION_UNKNOWN',
      ...(candidate.truncated ? ['SPECIALIZED_EVIDENCE_TRUNCATED'] : []),
    ],
  }));

  return [...mediaItems, ...captchaItems, ...documentItems];
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
// collectStructure
// ---------------------------------------------------------------------------

export async function collectStructure(page: Page): Promise<StructureData> {
  return page.evaluate(() => {
    const MAX_ITEMS = 200;
    const normalize = (value: string | null | undefined, max = 300): string | null => {
      const text = (value ?? '').replace(/\s+/g, ' ').trim();
      return text ? text.slice(0, max) : null;
    };
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
      return `${getUniqueSelector(parent)} > ${tag}${suffix}`;
    };
    const referencedText = (element: Element): string | null => {
      const ids = (element.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
      return normalize(ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' '))
        ?? normalize(element.getAttribute('aria-label'))
        ?? normalize(element.getAttribute('title'));
    };

    const pageFlags = ['HTML_VALIDITY_REVIEW'];
    const doctype = document.doctype?.name?.toLowerCase() ?? null;
    if (!doctype || doctype !== 'html') pageFlags.push('DOCTYPE_INVALID');

    const tables = Array.from(document.querySelectorAll('table')).slice(0, MAX_ITEMS).map((table) => {
      const dataFeatures = ['caption', 'th', 'scope', 'headers', 'summary']
        .filter((attribute) => attribute === 'caption'
          ? Boolean(table.querySelector('caption'))
          : attribute === 'th'
            ? Boolean(table.querySelector('th'))
            : table.hasAttribute(attribute));
      return {
        selector: getUniqueSelector(table),
        dataFeatures,
        flags: dataFeatures.length > 0
          ? ['TABLE_LAYOUT_DATA_FEATURE']
          : ['TABLE_LAYOUT_NO_DATA_FEATURE'],
      };
    });

    const stylesheetCount = document.querySelectorAll('link[rel~="stylesheet"], style').length;
    const inlineStyleCount = document.querySelectorAll('[style]').length;
    const presentationMarkupCount = document.querySelectorAll(
      'font, center, [align], [bgcolor], [color], [cellpadding], [cellspacing], [border]',
    ).length;
    const styleFlags = [stylesheetCount > 0 ? 'STYLESHEET_PRESENT' : 'STYLESHEET_ABSENT'];
    if (inlineStyleCount > 0) styleFlags.push('INLINE_STYLE_PRESENT');
    if (presentationMarkupCount > 0) styleFlags.push('PRESENTATION_MARKUP_DETECTED');

    const colors = Array.from(document.querySelectorAll('*')).slice(0, MAX_ITEMS).flatMap((element) => {
      const style = getComputedStyle(element);
      const explicitColor = element.hasAttribute('style') && /(?:^|;)\s*color\s*:/i.test(element.getAttribute('style') ?? '');
      const explicitBackground = element.hasAttribute('style') && /background(?:-color)?\s*:/i.test(element.getAttribute('style') ?? '');
      if (!explicitColor && !explicitBackground) return [];
      const flags = ['COLOR_DECLARATION_REVIEW'];
      if (explicitColor && !explicitBackground) flags.push('COLOR_FOREGROUND_ONLY');
      if (!explicitColor && explicitBackground) flags.push('COLOR_BACKGROUND_ONLY');
      if (explicitColor && explicitBackground) flags.push('COLOR_BOTH_DECLARED');
      return [{
        selector: getUniqueSelector(element),
        color: normalize(style.color),
        backgroundColor: normalize(style.backgroundColor),
        flags,
      }];
    });

    const fieldGroups = Array.from(document.querySelectorAll('fieldset, [role="group"]'))
      .slice(0, MAX_ITEMS)
      .map((group) => {
        const legend = normalize(group.querySelector('legend')?.textContent)
          ?? referencedText(group);
        const controlCount = group.querySelectorAll('input:not([type="hidden"]), select, textarea').length;
        return {
          selector: getUniqueSelector(group),
          legend,
          controlCount,
          flags: group.tagName.toLowerCase() === 'fieldset'
            ? [legend ? 'FIELDSET_LEGEND_PRESENT' : 'FIELDSET_LEGEND_ABSENT']
            : [legend ? 'GROUP_LEGEND_PRESENT' : 'GROUP_LEGEND_REVIEW'],
        };
      });

    const roleFor = (element: Element): string | null => {
      const explicitRole = element.getAttribute('role')?.trim().toLowerCase();
      if (explicitRole && ['banner', 'complementary', 'contentinfo', 'main', 'navigation', 'region', 'search'].includes(explicitRole)) {
        return explicitRole;
      }
      const tag = element.tagName.toLowerCase();
      if (tag === 'header') return 'banner';
      if (tag === 'nav') return 'navigation';
      if (tag === 'main') return 'main';
      if (tag === 'footer') return 'contentinfo';
      if (tag === 'aside') return 'complementary';
      if (tag === 'form' && element.getAttribute('role') === 'search') return 'search';
      return null;
    };
    const landmarks = Array.from(document.querySelectorAll('header, nav, main, footer, aside, form[role="search"], [role]'))
      .slice(0, MAX_ITEMS)
      .flatMap((element) => {
        const role = roleFor(element);
        if (!role) return [];
        return [{
          selector: getUniqueSelector(element),
          role,
          accessibleName: referencedText(element),
          flags: ['LANDMARK_PRESENT'],
        }];
      });

    const roles = new Set(landmarks.map((landmark) => landmark.role));
    for (const [role, flag] of [
      ['banner', 'LANDMARK_BANNER_MISSING'],
      ['navigation', 'LANDMARK_NAVIGATION_MISSING'],
      ['main', 'LANDMARK_MAIN_MISSING'],
      ['contentinfo', 'LANDMARK_CONTENTINFO_MISSING'],
      ['search', 'LANDMARK_SEARCH_MISSING'],
    ] as const) {
      if (!roles.has(role)) pageFlags.push(flag);
    }
    if (landmarks.filter((landmark) => landmark.role === 'main').length > 1) {
      pageFlags.push('LANDMARK_MULTIPLE_MAIN');
    }

    return {
      pageFlags,
      tables,
      styles: { stylesheetCount, inlineStyleCount, presentationMarkupCount, flags: styleFlags },
      colors,
      fieldGroups,
      landmarks,
    };
  });
}

// ---------------------------------------------------------------------------
// collectForms
// ---------------------------------------------------------------------------

export async function collectForms(page: Page): Promise<FormDataItem[]> {
  return page.evaluate(() => {
    const MAX_TEXT_LENGTH = 500;
    const MAX_FORMS = 100;
    const MAX_CONTROLS_PER_FORM = 200;
    const limitText = (value: string | null | undefined): string | null => {
      const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
      return normalized ? normalized.slice(0, MAX_TEXT_LENGTH) : null;
    };

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
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .filter(Boolean)
        .join(' ')
      return limitText(text);
    };

    const controlsFor = (container: Element | Document): FormControlData[] => {
      const controls = Array.from(container.querySelectorAll('input:not([type="hidden"]), textarea, select'))
        .slice(0, MAX_CONTROLS_PER_FORM);
      return controls.map((control) => {
        const id = control.getAttribute('id');
        const ariaLabelledbyIds = (control.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
        const describedByIds = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
        const labelledByText = getReferencedText(ariaLabelledbyIds);
        const ariaLabel = control.getAttribute('aria-label')?.trim() || null;
        const associatedLabel = id
          ? limitText(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent)
          : limitText(control.closest('label')?.textContent);
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

    const forms = Array.from(document.querySelectorAll('form')).slice(0, MAX_FORMS).map((form) => ({
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
  const [images, media, frames, links, headings, structure, forms, figcaptions] = await Promise.all([
    collectImages(page),
    collectMedia(page),
    collectFrames(page),
    collectLinks(page),
    collectHeadings(page),
    collectStructure(page),
    collectForms(page),
    collectFigureCaptions(page),
  ]);

  const specializedContent = await collectSpecializedContent(page, media, images);
  return { images, media, specializedContent, frames, links, headings, structure, forms, figcaptions };
}
