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
  /** A non-empty alternative is a candidate for the human relevance review of RGAA 1.3. */
  altRelevanceStatus?: 'not_applicable' | 'to_review';
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
  /** Candidate evidence for image criteria 1.4–1.8; never a conformance verdict. */
  evidence?: ImageCriterionEvidence[];
  /** Resolved detailed description candidate, when declared with aria-describedby or longdesc. */
  detailedDescription?: string | null;
  /** Source attribute for the detailed description candidate, when available. */
  detailedDescriptionSource?: 'aria-describedby' | 'longdesc' | null;
  axeViolations: string[];
  automatedStatus: 'violation' | 'pass' | 'manual';
  flags: string[];
  screenshotPath: string | null;
}

export type ImageEvidenceState = 'observed' | 'missing' | 'not_applicable' | 'to_review';

export interface ImageCriterionEvidence {
  criterionId: string;
  state: ImageEvidenceState;
  proof: string[];
  limits: string[];
  humanChecks?: string[];
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

/** Candidate state for a temporal-media criterion; it is never a conformance verdict. */
export type MediaEvidenceState = 'observed' | 'missing' | 'not_applicable' | 'to_review';

/** Observable proof and explicit limits attached to one criterion for one media element. */
export interface MediaCriterionEvidence {
  criterionId: string;
  state: MediaEvidenceState;
  proof: string[];
  limits: string[];
  /** Mapping question to validate manually; never an automated decision. */
  humanChecks?: string[];
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
  /** Candidate evidence only; a human must determine applicability and conformance. */
  evidence?: MediaCriterionEvidence[];
}

export type SpecializedContentKind = 'media' | 'captcha' | 'document';

/** Candidate evidence for RGAA 13.3/13.4; it never decides conformance. */
export type DocumentEvidenceState = 'proof' | 'violation' | 'to_review' | 'manual';

export interface DocumentEvidenceData {
  state: DocumentEvidenceState;
  declaredMime: string | null;
  declaredSizeBytes: number | null;
  downloadDeclared: boolean;
  sourceExtension: string | null;
  /** Remote documents are deliberately not downloaded or executed by collection. */
  localAnalysis: 'not_executed';
  proof: string[];
  limits: string[];
  humanChecks: string[];
}

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
  /** Present only for document candidates (RGAA 13.3 and 13.4). */
  documentEvidence?: DocumentEvidenceData;
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
  /** Candidate evidence for the human relevance review of RGAA 2.2. */
  titleEvidence?: FrameCriterionEvidence;
  flags: string[];
}

export type FrameEvidenceState = 'not_applicable' | 'to_review';

export interface FrameCriterionEvidence {
  criterionId: '2.2';
  state: FrameEvidenceState;
  proof: string[];
  limits: string[];
  humanChecks: string[];
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
  /** Candidate classification only; the table's actual purpose remains human-reviewed. */
  tableKind?: 'data_candidate' | 'presentation_candidate' | 'undetermined';
  complexitySignals?: string[];
  captionText?: string | null;
  summaryText?: string | null;
  linearizedText?: string;
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

/** Explicit and contextual language observations retained for manual review of RGAA 8.7. */
export interface LanguageObservationData {
  selector: string;
  tagName: string;
  text: string;
  declaredLanguage: string | null;
  effectiveLanguage: string | null;
  languageSource: 'attribute' | 'inherited' | 'missing';
  flags: string[];
}

/** Reading-direction declarations and bidi text candidates for manual review of RGAA 8.10. */
export interface DirectionObservationData {
  selector: string;
  tagName: string;
  text: string;
  dirAttribute: string | null;
  effectiveDirection: 'ltr' | 'rtl' | 'auto' | null;
  cssDirection: 'ltr' | 'rtl' | null;
  unicodeBidi: string | null;
  flags: string[];
}

/** Semantic region tree used as evidence for RGAA 9.2; it is not a conformance verdict. */
export interface StructureRegionData {
  selector: string;
  tagName: string;
  role: string | null;
  accessibleName: string | null;
  parentSelector: string | null;
  depth: number;
  childRegionCount: number;
  flags: string[];
}

/** Explicit and probable textual citation observations for manual review of RGAA 9.4. */
export interface CitationObservationData {
  selector: string;
  tagName: string;
  kind: 'q' | 'blockquote' | 'cite' | 'text-quote';
  text: string;
  citeAttribute: string | null;
  flags: string[];
}

/**
 * A bounded set of presentation-state observations. These snapshots are
 * evidence for the manual RGAA presentation checks; they are not conformance
 * decisions. The 200% probe uses CSS zoom and must therefore be confirmed with
 * the browser's text-zoom setting by an auditor.
 */
export type PresentationScenario = 'baseline' | 'styles-disabled' | 'viewport-320x256' | 'zoom-200-probe';

/** Focus candidates observed in one presentation state; never a compliance verdict. */
export interface PresentationFocusObservation {
  selector: string;
  tagName: string;
  role: string | null;
  text: string | null;
  focusVisible: boolean;
  flags: string[];
}

export interface PresentationSnapshot {
  scenario: PresentationScenario;
  status: 'observed' | 'not_observed';
  viewportWidth: number | null;
  viewportHeight: number | null;
  devicePixelRatio: number | null;
  visualViewportScale: number | null;
  documentScrollWidth: number | null;
  documentScrollHeight: number | null;
  documentClientWidth: number | null;
  documentClientHeight: number | null;
  bodyTextLength: number | null;
  visibleTextLength: number | null;
  focusableCount: number | null;
  visibleFocusableCount: number | null;
  cssZoom: string | null;
  /** Focus evidence is state-specific (baseline, viewport and zoom). */
  focusObservations?: PresentationFocusObservation[];
  flags: string[];
  note?: string;
}

export type PresentationCueKind = 'color' | 'shape' | 'size' | 'position';

/** Observable visual cues retained for the manual review of RGAA 3.1, 10.9 and 10.10. */
export interface PresentationCueObservation {
  selector: string;
  tagName: string;
  text: string | null;
  accessibleName: string | null;
  kinds: PresentationCueKind[];
  color: string | null;
  backgroundColor: string | null;
  fontSize: string | null;
  borderRadius: string | null;
  position: string | null;
  dimensions: { width: number; height: number } | null;
  flags: string[];
}

export interface HiddenContentObservation {
  selector: string;
  reasons: Array<'hidden-attribute' | 'aria-hidden' | 'inert' | 'css-hidden'>;
  focusable: boolean;
  flags: string[];
}

export type NavigationSystemKind = 'navigation' | 'search' | 'sitemap';

export interface NavigationSystemData {
  kind: NavigationSystemKind;
  selector: string;
  label: string | null;
  href: string | null;
  domIndex: number;
  position: { top: number; left: number; width: number; height: number } | null;
  flags: string[];
}

/** Page-level inventory used for the cross-page navigation review (12.1–12.5). */
export interface NavigationData {
  systems: NavigationSystemData[];
  flags: string[];
  manualChecks: string[];
}

/** Presentation probes used by RGAA 10.2–10.4 and 10.11. */
export interface PresentationData {
  snapshots: PresentationSnapshot[];
  /** Optional inventory of CSS/DOM cues; it never determines a criterion verdict. */
  perceptualCues?: PresentationCueObservation[];
  /** Optional for presentation collections persisted before hidden inventory was added. */
  hiddenContent?: HiddenContentObservation[];
  flags: string[];
  manualChecks: string[];
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
  /** Optional to keep persisted collections from older versions readable. */
  languages?: LanguageObservationData[];
  directions?: DirectionObservationData[];
  regions?: StructureRegionData[];
  citations?: CitationObservationData[];
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
  /** DOM evidence retained for the manual label/grouping criteria. */
  labelSelector?: string | null;
  labelAdjacent?: boolean | null;
  groupSelector?: string | null;
  groupLegend?: string | null;
  optionGroups?: Array<{ selector: string; label: string | null; optionCount: number; flags: string[] }>;
  validationConstraints?: string[];
  validationMessage?: string | null;
  sensitive?: boolean;
}

export interface FormDataItem {
  selector: string;
  action: string | null;
  method: string;
  controls: FormControlData[];
  flags: string[];
  groups?: Array<{ selector: string; legend: string | null; controlSelectors: string[]; flags: string[] }>;
  submitControls?: string[];
  sensitiveControlSelectors?: string[];
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
  /** Optional presentation-state probes, absent in older persisted sessions. */
  presentation?: PresentationData;
  /** Optional navigation inventory, absent in older persisted sessions. */
  navigation?: NavigationData;
}

const IMAGE_MANUAL_CRITERIA = ['1.3', '1.4', '1.5', '1.6', '1.7', '1.8'] as const;
const IMAGE_SPECIALIZED_CRITERIA = ['1.4', '1.5', '1.6', '1.7', '1.8'] as const;
const IMAGE_CAPTCHA_HINT = /captcha|recaptcha|hcaptcha|challenge|image[-_ ]?test/i;
// Media inventory scope: temporal media (4.1–4.7, 4.11, 4.13) and
// non-temporal media (4.8, 4.9, 4.12, 4.13). Criteria 4.10 remains separate
// manual/backlog work and is not silently presented as covered by this inventory.
const TEMPORAL_MEDIA_CRITERIA = ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6'] as const;
const NON_TEMPORAL_MEDIA_CRITERIA = ['4.8', '4.9'] as const;
const MEDIA_ACCESSIBILITY_CRITERIA = ['4.7', '4.11', '4.12', '4.13'] as const;
const MEDIA_LIMITS = {
  items: 100,
  sources: 20,
  tracks: 20,
  urlLength: 2_000,
  textLength: 500,
} as const;

function getSpecializedImageChecks(): string[] {
  return IMAGE_MANUAL_CRITERIA.flatMap((id) => {
    const checks = getCriterion(id)?.heuristicPatterns.manualChecks ?? [];
    return checks.map((check) => `${id} — ${check}`);
  });
}

function imageHumanChecks(criterionId: string): string[] {
  const criterion = getCriterion(criterionId);
  if (!criterion) return [];
  const checks = criterion.heuristicPatterns.manualChecks ?? [];
  return (checks.length > 0 ? checks : [criterion.rgaa.title]).map((check) => `${criterionId} — ${check}`);
}

function buildImageEvidence(image: Pick<ImageData, 'altAttribute' | 'src' | 'surroundingText' | 'alternativeSources' | 'detailedDescription'>): ImageCriterionEvidence[] {
  const alternativeSources = image.alternativeSources ?? [];
  const captchaCandidate = IMAGE_CAPTCHA_HINT.test([
    image.src,
    image.altAttribute ?? '',
    image.surroundingText,
  ].join(' '));
  const hasAlternative = alternativeSources.some((source) => source === 'link-text' || source === 'surrounding-text');
  const hasDetailedDescription = Boolean(image.detailedDescription);
  const signalProof: Record<string, string[]> = {
    '1.4': image.altAttribute ? ['alternative textuelle de candidat CAPTCHA observée'] : [],
    '1.5': hasAlternative ? ['alternative d’accès candidate observée'] : [],
    '1.6': hasDetailedDescription ? ['description détaillée candidate observée'] : [],
    '1.7': hasDetailedDescription ? ['description détaillée candidate observée'] : [],
    '1.8': image.src
      ? ['Image observée ; contenu textuel dans les pixels non détecté automatiquement.']
      : ['Contenu textuel dans les pixels non détecté automatiquement.'],
  };

  return IMAGE_SPECIALIZED_CRITERIA.map((criterionId) => {
    const applicable = (criterionId === '1.4' || criterionId === '1.5') ? captchaCandidate : true;
    const signalObserved = signalProof[criterionId].length > 0;
    const state: ImageEvidenceState = !applicable
      ? 'not_applicable'
      : criterionId === '1.8'
        ? 'to_review'
      : criterionId === '1.7' && !hasDetailedDescription
        ? 'to_review'
        : signalObserved
          ? 'observed'
          : criterionId === '1.4' || criterionId === '1.5'
            ? 'missing'
            : 'to_review';
    return {
      criterionId,
      state,
      proof: !applicable
        ? ['Aucun indice de CAPTCHA ou image-test observé.']
        : signalObserved ? signalProof[criterionId] : ['Aucun signal candidat observé pour ce critère.'],
      limits: [
        getCriterion(criterionId)?.limits,
        'La présence d’un signal ne permet pas de conclure à la pertinence ou à la conformité ; la validation humaine reste nécessaire.',
      ].filter((limit): limit is string => Boolean(limit)),
      humanChecks: imageHumanChecks(criterionId),
    };
  });
}

function getSpecializedMediaChecks(ids: readonly string[]): string[] {
  return ids.flatMap((id) => {
    const checks = getCriterion(id)?.heuristicPatterns.manualChecks ?? [];
    return checks.map((check) => `${id} — ${check}`);
  });
}

const MEDIA_EVIDENCE_CRITERIA = [...TEMPORAL_MEDIA_CRITERIA, ...MEDIA_ACCESSIBILITY_CRITERIA];

function mediaCriterionIds(kind: MediaKind): string[] {
  const temporal = kind === 'audio' || kind === 'video';
  return [
    ...(temporal ? TEMPORAL_MEDIA_CRITERIA : NON_TEMPORAL_MEDIA_CRITERIA),
    ...(temporal ? ['4.7', '4.11'] : ['4.12']),
    '4.13',
  ];
}

function mediaHumanChecks(criterionId: string): string[] {
  const criterion = getCriterion(criterionId);
  if (!criterion) return [];
  const checks = criterion.heuristicPatterns.manualChecks ?? [];
  return (checks.length > 0 ? checks : [criterion.rgaa.title]).map((check) => `${criterionId} — ${check}`);
}

function buildMediaEvidence(media: Pick<MediaData, 'kind' | 'sources' | 'accessibleName' | 'alternativeSources' | 'fallbackText' | 'controls' | 'tracks' | 'truncated'>): MediaCriterionEvidence[] {
  const isTemporal = media.kind === 'audio' || media.kind === 'video';
  const trackSummary = media.tracks
    .filter((track) => track.kind === 'subtitles' || track.kind === 'captions' || track.kind === 'descriptions')
    .map((track) => `piste ${track.kind}${track.srcLang ? ` (${track.srcLang})` : ''}${track.label ? ` — ${track.label}` : ''}`);
  const commonProof = [
    ...(media.sources.length > 0 ? [`${media.sources.length} source(s) média observée(s)`] : []),
    ...(media.fallbackText ? ['contenu de secours textuel observé'] : []),
    ...trackSummary,
    ...(media.truncated ? ['collecte tronquée'] : []),
  ];
  const genericLimit = 'La présence d’un signal DOM ne permet pas de conclure à la pertinence, la synchronisation ou la conformité ; une vérification humaine reste nécessaire.';

  const hasAlternative = Boolean(media.fallbackText) || media.tracks.some((track) => track.kind === 'descriptions');
  const hasCaptions = media.tracks.some((track) => track.kind === 'subtitles' || track.kind === 'captions');
  const hasDescriptions = media.tracks.some((track) => track.kind === 'descriptions');
  const hasIdentification = Boolean(media.accessibleName) || media.alternativeSources.length > 0;
  const hasNativeControls = isTemporal && media.controls;
  const hasAccessibleName = Boolean(media.accessibleName) || media.alternativeSources.length > 0;
  const identificationProof = [
    ...(media.accessibleName ? ['nom accessible observé'] : []),
    ...(media.alternativeSources.length > 0 ? [`alternative déclarée observée (${media.alternativeSources.join(', ')})`] : []),
  ];
  const controlsProof = hasNativeControls ? ['contrôles natifs observés'] : [];
  const candidateSignals: Record<string, boolean> = {
    '4.1': hasAlternative,
    '4.2': hasAlternative,
    '4.3': hasCaptions,
    '4.4': hasCaptions,
    '4.5': hasDescriptions,
    '4.6': hasDescriptions,
    '4.7': hasIdentification,
    '4.11': hasNativeControls,
    '4.12': false,
    '4.13': hasAccessibleName,
  };
  const presenceCriteria = new Set(['4.1', '4.3', '4.5']);

  return MEDIA_EVIDENCE_CRITERIA.map((criterionId) => {
    const applicable = mediaCriterionIds(media.kind).includes(criterionId);
    const humanChecks = mediaHumanChecks(criterionId);
    const signalObserved = candidateSignals[criterionId];
    const criterionProof = criterionId === '4.7' || criterionId === '4.13'
      ? identificationProof
      : criterionId === '4.11'
        ? controlsProof
        : commonProof;
    return {
      criterionId,
      state: !applicable ? 'not_applicable' : signalObserved ? 'observed' : presenceCriteria.has(criterionId) ? 'missing' : 'to_review',
      proof: !applicable
        ? [`Média de type ${media.kind}, hors périmètre de ce critère.`]
        : signalObserved ? criterionProof : ['Aucun signal candidat observé pour ce critère.'],
      limits: [getCriterion(criterionId)?.limits, genericLimit].filter((limit): limit is string => Boolean(limit)),
      humanChecks,
    };
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
      const ariaDescribedby = el.getAttribute('aria-describedby');
      const describedByText = (ariaDescribedby ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const longdesc = el.getAttribute('longdesc');
      const detailedDescriptionSource: 'aria-describedby' | 'longdesc' | null = describedByText
        ? 'aria-describedby'
        : longdesc
          ? 'longdesc'
          : null;
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
        detailedDescription: describedByText || longdesc || null,
        detailedDescriptionSource,
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

    const altRelevanceStatus: ImageData['altRelevanceStatus'] = altStatus === 'present'
      ? 'to_review'
      : 'not_applicable';

    if (img.altAttribute === null) {
      flags.push('ALT_ABSENT');
    }

    if (altRelevanceStatus === 'to_review') {
      flags.push('ALT_RELEVANCE_REVIEW');
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
      manualChecks: getSpecializedImageChecks().filter((check) => (
        altRelevanceStatus === 'to_review' || !check.startsWith('1.3 —')
      )),
      evidence: buildImageEvidence(img),
      altStatus,
      altRelevanceStatus,
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
    const criterionIds = mediaCriterionIds(media.kind);
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
      evidence: buildMediaEvidence({
        kind: media.kind,
        sources: media.sources,
        accessibleName: media.accessibleName,
        alternativeSources: media.alternativeSources,
        fallbackText: media.fallbackText,
        controls: media.controls,
        tracks: media.tracks,
        truncated: media.truncated,
      }),
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

    const positiveIntegerAttribute = (element: Element, ...names: string[]): number | null => {
      for (const name of names) {
        const value = element.getAttribute(name);
        if (!value || !/^\d+$/.test(value.trim())) continue;
        const parsed = Number(value);
        if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
      }
      return null;
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
        const declaredMime = element.getAttribute('type')?.trim() || null;
        const declaredSizeBytes = positiveIntegerAttribute(element, 'data-size-bytes', 'data-size');
        const downloadDeclared = element.hasAttribute('download');
        const sourceExtension = source?.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1]?.toLowerCase() ?? null;
        return {
          selector: getUniqueSelector(element),
          source,
          label: normalize(element.textContent || element.getAttribute('aria-label') || element.getAttribute('title')) || null,
          context: contextOf(element),
          declaredMime,
          declaredSizeBytes,
          downloadDeclared,
          sourceExtension,
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

  const documentItems: SpecializedContentData[] = raw.documentCandidates.map((candidate) => {
    const proof = [
      ...(candidate.label ? ['label observed'] : []),
      ...(candidate.declaredMime ? [`MIME déclaré: ${candidate.declaredMime}`] : []),
      ...(candidate.declaredSizeBytes !== null ? [`taille déclarée: ${candidate.declaredSizeBytes} octets`] : []),
      ...(candidate.downloadDeclared ? ['attribut download observé'] : []),
      ...(candidate.sourceExtension ? [`extension de source observée: .${candidate.sourceExtension}`] : []),
    ];
    const flags = [
      'DOCUMENT_REQUIRES_HUMAN_REVIEW',
      'DOCUMENT_ACCESSIBLE_VERSION_UNKNOWN',
      'DOCUMENT_MIME_HTTP_UNKNOWN',
      'DOCUMENT_SIZE_HTTP_UNKNOWN',
      'DOCUMENT_LOCAL_ANALYSIS_NOT_EXECUTED',
      ...(candidate.downloadDeclared ? [] : ['DOCUMENT_DOWNLOAD_ATTRIBUTE_NOT_OBSERVED']),
      ...(candidate.truncated ? ['SPECIALIZED_EVIDENCE_TRUNCATED'] : []),
    ];
    return {
      kind: 'document',
      selector: candidate.selector,
      source: candidate.source,
      label: candidate.label,
      context: candidate.context,
      criterionIds: ['13.3', '13.4'],
      status: 'review_required',
      evidence: proof,
      flags,
      documentEvidence: {
        state: 'to_review',
        declaredMime: candidate.declaredMime,
        declaredSizeBytes: candidate.declaredSizeBytes,
        downloadDeclared: candidate.downloadDeclared,
        sourceExtension: candidate.sourceExtension,
        localAnalysis: 'not_executed',
        proof,
        limits: [
          'Le type MIME et la taille HTTP réels ne sont pas récupérés par la collecte DOM.',
          'Le document distant n’est ni téléchargé ni exécuté ; analyser localement le fichier et sa version accessible.',
        ],
        humanChecks: ['13.3', '13.4'].flatMap((criterionId) => {
          const criterion = getCriterion(criterionId);
          return criterion ? [`${criterion.rgaa.id} — ${criterion.rgaa.title}`] : [];
        }),
      },
    };
  });

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

    const criterion = getCriterion('2.2');
    const hasTitle = titleStatus === 'present';
    const titleEvidence: FrameCriterionEvidence = {
      criterionId: '2.2',
      state: 'to_review',
      proof: hasTitle
        ? [`Titre de cadre observé : ${frame.titleAttribute}`]
        : ['Aucun titre de cadre observé ; la pertinence du titre ne peut pas être appréciée.'],
      limits: [
        criterion?.limits,
        'La collecte ne détermine pas la pertinence du titre ; une vérification humaine du contexte et de la fonction du cadre reste nécessaire.',
      ].filter((limit): limit is string => Boolean(limit)),
      humanChecks: criterion
        ? [`${criterion.rgaa.id} — ${criterion.rgaa.title}`]
        : [],
    };

    return { ...frame, titleStatus, titleEvidence, flags };
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
      const captionText = normalize(table.querySelector('caption')?.textContent);
      const summaryText = normalize(table.getAttribute('summary'));
      const rows = Array.from(table.rows);
      const headerRows = rows.filter((row) => row.querySelector('th')).length;
      const cells = Array.from(table.querySelectorAll('th, td')) as HTMLTableCellElement[];
      const complexitySignals: string[] = [];
      if (cells.some((cell) => cell.rowSpan > 1)) complexitySignals.push('ROWSPAN_PRESENT');
      if (cells.some((cell) => cell.colSpan > 1)) complexitySignals.push('COLSPAN_PRESENT');
      if (headerRows > 1) complexitySignals.push('MULTIPLE_HEADER_ROWS');
      if (cells.some((cell) => cell.hasAttribute('headers'))) complexitySignals.push('HEADERS_ATTRIBUTE_PRESENT');
      const hasDataSemantics = Boolean(
        table.querySelector('th, [scope], [headers], [summary]')
        || summaryText,
      );
      const tableKind: StructureTableData['tableKind'] = cells.length === 0
        ? 'undetermined'
        : hasDataSemantics ? 'data_candidate' : 'presentation_candidate';
      const flags = dataFeatures.length > 0
        ? ['TABLE_LAYOUT_DATA_FEATURE']
        : ['TABLE_LAYOUT_NO_DATA_FEATURE'];
      if (tableKind === 'data_candidate') flags.push('TABLE_DATA_CANDIDATE');
      if (tableKind === 'presentation_candidate') flags.push('TABLE_PRESENTATION_CANDIDATE');
      if (tableKind === 'undetermined') flags.push('TABLE_CLASSIFICATION_REVIEW');
      if (complexitySignals.length > 0) flags.push('TABLE_COMPLEX_CANDIDATE');
      if (complexitySignals.length > 0 && summaryText) flags.push('TABLE_COMPLEX_SUMMARY_PRESENT');
      if (complexitySignals.length > 0 && !summaryText) flags.push('TABLE_COMPLEX_SUMMARY_ABSENT');
      if (tableKind === 'data_candidate' && captionText) flags.push('TABLE_DATA_TITLE_PRESENT');
      if (tableKind === 'data_candidate' && !captionText) flags.push('TABLE_DATA_TITLE_ABSENT');
      if (tableKind === 'data_candidate') flags.push('TABLE_HEADER_ASSOCIATION_REVIEW');
      const linearizedText = rows.map((row) => Array.from(row.cells)
        .map((cell) => normalize(cell.textContent, 160) ?? '')
        .join(' | ')).join(' / ').slice(0, 2_000);
      return {
        selector: getUniqueSelector(table),
        dataFeatures,
        flags,
        tableKind,
        complexitySignals,
        captionText,
        summaryText,
        linearizedText,
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

    const directText = (element: Element): string => [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);

    const inheritedAttribute = (element: Element, attribute: string): string | null => {
      let current: Element | null = element;
      while (current) {
        const value = current.getAttribute(attribute);
        if (value !== null) return value.trim() || null;
        current = current.parentElement;
      }
      return null;
    };

    const languageElements = Array.from(document.querySelectorAll('*'))
      .filter((element) => Boolean(element.getAttribute('lang'))
        || element.hasAttribute('lang')
        || Boolean(directText(element)))
      .slice(0, MAX_ITEMS);
    const languages: LanguageObservationData[] = languageElements.map((element) => {
      const declaredLanguage = element.getAttribute('lang');
      const effectiveLanguage = inheritedAttribute(element, 'lang');
      const text = directText(element);
      const flags: string[] = [];
      const parentLanguage = element.parentElement ? inheritedAttribute(element.parentElement, 'lang') : null;
      if (element === document.documentElement && declaredLanguage === null) {
        flags.push('LANGUAGE_DEFAULT_ABSENT');
      }
      if (declaredLanguage !== null && !declaredLanguage.trim()) {
        flags.push('LANGUAGE_DECLARATION_EMPTY');
      } else if (declaredLanguage !== null && declaredLanguage.trim()) {
        flags.push('LANGUAGE_DECLARATION_PRESENT');
        if (parentLanguage !== declaredLanguage.trim()) flags.push('LANGUAGE_CHANGE_DECLARED');
      } else if (text) {
        flags.push('LANGUAGE_TEXT_REQUIRES_REVIEW');
      }
      return {
        selector: getUniqueSelector(element),
        tagName: element.tagName.toLowerCase(),
        text,
        declaredLanguage,
        effectiveLanguage,
        languageSource: declaredLanguage !== null
          ? 'attribute'
          : effectiveLanguage
            ? 'inherited'
            : 'missing',
        flags,
      };
    });

    const bidiTextPattern = /[\u0590-\u08ff]/;
    const directionElements = Array.from(document.querySelectorAll('*'))
      .filter((element) => {
        const text = directText(element);
        const styleAttribute = element.getAttribute('style') ?? '';
        const computed = getComputedStyle(element);
        return element.hasAttribute('dir')
          || /(?:^|;)\s*(?:direction|unicode-bidi)\s*:/i.test(styleAttribute)
          || computed.direction === 'rtl'
          || computed.unicodeBidi !== 'normal'
          || bidiTextPattern.test(text);
      })
      .slice(0, MAX_ITEMS);
    const directions: DirectionObservationData[] = directionElements.map((element) => {
      const rawDir = element.getAttribute('dir')?.trim().toLowerCase() ?? null;
      const dirAttribute: DirectionObservationData['dirAttribute'] = rawDir;
      const effectiveRaw = inheritedAttribute(element, 'dir')?.toLowerCase() ?? 'ltr';
      const effectiveDirection: DirectionObservationData['effectiveDirection'] = ['ltr', 'rtl', 'auto'].includes(effectiveRaw)
        ? effectiveRaw as DirectionObservationData['effectiveDirection']
        : null;
      const computed = getComputedStyle(element);
      const cssDirection: DirectionObservationData['cssDirection'] = computed.direction === 'rtl' ? 'rtl' : computed.direction === 'ltr' ? 'ltr' : null;
      const text = directText(element);
      const flags: string[] = [];
      const parentDirection = element.parentElement ? inheritedAttribute(element.parentElement, 'dir')?.toLowerCase() ?? 'ltr' : 'ltr';
      const parentCssDirection = element.parentElement ? getComputedStyle(element.parentElement).direction : 'ltr';
      if (rawDir !== null) {
        if (!['ltr', 'rtl', 'auto'].includes(rawDir)) flags.push('DIRECTION_ATTRIBUTE_INVALID');
        else {
          flags.push('DIRECTION_DECLARATION_PRESENT');
          if (rawDir !== parentDirection) flags.push('DIRECTION_CHANGE_DECLARED');
        }
      }
      if (/(?:^|;)\s*direction\s*:/i.test(element.getAttribute('style') ?? '')
        || (rawDir === null && computed.direction !== parentCssDirection)) flags.push('DIRECTION_CSS_DECLARED');
      if (/(?:^|;)\s*unicode-bidi\s*:/i.test(element.getAttribute('style') ?? '')) {
        flags.push('UNICODE_BIDI_DECLARED');
      }
      if (bidiTextPattern.test(text) && rawDir === null) flags.push('DIRECTION_BIDI_TEXT_REVIEW');
      return {
        selector: getUniqueSelector(element),
        tagName: element.tagName.toLowerCase(),
        text,
        dirAttribute,
        effectiveDirection,
        cssDirection,
        unicodeBidi: computed.unicodeBidi,
        flags,
      };
    });

    const regionElements = Array.from(document.querySelectorAll(
      'header, nav, main, footer, aside, section, article, form, [role="banner"], [role="complementary"], [role="contentinfo"], [role="main"], [role="navigation"], [role="region"], [role="search"]',
    )).slice(0, MAX_ITEMS);
    const regionSelectors = new Map<Element, string>(regionElements.map((element) => [element, getUniqueSelector(element)]));
    const regionRoleFor = (element: Element): string | null => {
      const explicitRole = element.getAttribute('role')?.trim().toLowerCase();
      if (explicitRole && ['banner', 'complementary', 'contentinfo', 'main', 'navigation', 'region', 'search'].includes(explicitRole)) return explicitRole;
      const tag = element.tagName.toLowerCase();
      if (tag === 'header') return 'banner';
      if (tag === 'nav') return 'navigation';
      if (tag === 'main') return 'main';
      if (tag === 'footer') return 'contentinfo';
      if (tag === 'aside') return 'complementary';
      if (tag === 'section' || tag === 'article') return 'region';
      if (tag === 'form' && element.getAttribute('role') === 'search') return 'search';
      return null;
    };
    const regions: StructureRegionData[] = regionElements.map((element) => {
      const selector = regionSelectors.get(element)!;
      let parent: Element | null = element.parentElement;
      let parentSelector: string | null = null;
      while (parent) {
        if (regionSelectors.has(parent)) {
          parentSelector = regionSelectors.get(parent)!;
          break;
        }
        parent = parent.parentElement;
      }
      let depth = 0;
      let depthCursor = element.parentElement;
      while (depthCursor) {
        if (regionSelectors.has(depthCursor)) depth += 1;
        depthCursor = depthCursor.parentElement;
      }
      const role = regionRoleFor(element);
      const accessibleName = referencedText(element) ?? normalize(element.tagName.toLowerCase() === 'section' ? element.querySelector('h1, h2, h3, h4, h5, h6')?.textContent : null);
      const childRegionCount = regionElements.filter((candidate) => {
        let ancestor = candidate.parentElement;
        while (ancestor && ancestor !== element) ancestor = ancestor.parentElement;
        return ancestor === element;
      }).length;
      const flags = ['REGION_PRESENT', 'REGION_TREE_REVIEW'];
      if (depth > 0) flags.push('REGION_NESTED');
      if ((element.tagName.toLowerCase() === 'section' || role === 'region') && !accessibleName) flags.push('REGION_NAME_REVIEW');
      return { selector, tagName: element.tagName.toLowerCase(), role, accessibleName, parentSelector, depth, childRegionCount, flags };
    });

    const quotePattern = /(?:«[^»]{2,}»|“[^”]{2,}”|„[^”]{2,}”|"[^"\n]{2,}"|‘[^’]{2,}’)/;
    const explicitCitationElements = Array.from(document.querySelectorAll('q, blockquote, cite')).slice(0, MAX_ITEMS);
    const explicitCitations: CitationObservationData[] = explicitCitationElements.map((element) => ({
      selector: getUniqueSelector(element),
      tagName: element.tagName.toLowerCase(),
      kind: element.tagName.toLowerCase() as CitationObservationData['kind'],
      text: normalize(element.textContent) ?? '',
      citeAttribute: element.getAttribute('cite'),
      flags: ['CITATION_SEMANTIC_MARKUP', 'CITATION_REQUIRES_HUMAN_REVIEW'],
    }));
    const probableTextCitations: CitationObservationData[] = Array.from(document.querySelectorAll('*'))
      .filter((element) => !['q', 'blockquote', 'cite'].includes(element.tagName.toLowerCase()))
      .map((element) => ({ element, text: directText(element) }))
      .filter(({ text }) => quotePattern.test(text))
      .slice(0, Math.max(0, MAX_ITEMS - explicitCitations.length))
      .map(({ element, text }) => ({
        selector: getUniqueSelector(element),
        tagName: element.tagName.toLowerCase(),
        kind: 'text-quote',
        text,
        citeAttribute: null,
        flags: ['CITATION_TEXT_QUOTE_CANDIDATE', 'CITATION_REQUIRES_HUMAN_REVIEW'],
      }));
    const citations = [...explicitCitations, ...probableTextCitations];

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
      languages,
      directions,
      regions,
      citations,
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
      const controls = Array.from(container.querySelectorAll('input:not([type="hidden"]), textarea, select, button'))
        .slice(0, MAX_CONTROLS_PER_FORM);
      return controls.map((control) => {
        const id = control.getAttribute('id');
        const ariaLabelledbyIds = (control.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
        const describedByIds = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
        const labelledByText = getReferencedText(ariaLabelledbyIds);
        const ariaLabel = control.getAttribute('aria-label')?.trim() || null;
        const labelElement = id
          ? document.querySelector(`label[for="${CSS.escape(id)}"]`)
          : control.closest('label');
        const associatedLabel = labelElement ? limitText(labelElement.textContent) : null;
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
        const fieldset = control.closest('fieldset');
        const legendElement = fieldset?.querySelector('legend') ?? null;
        const labelAdjacent = labelElement
          ? labelElement.contains(control)
            || labelElement.nextElementSibling === control
            || control.nextElementSibling === labelElement
          : null;
        const optionGroups = control.tagName.toLowerCase() === 'select'
          ? Array.from(control.querySelectorAll('optgroup')).map((group) => ({
            selector: getUniqueSelector(group),
            label: group.getAttribute('label')?.trim() || null,
            optionCount: group.querySelectorAll('option').length,
            flags: group.getAttribute('label')?.trim() ? ['FORM_OPTION_GROUP_LABEL_PRESENT'] : ['FORM_OPTION_GROUP_LABEL_ABSENT'],
          }))
          : [];
        const controlText = control.tagName.toLowerCase() === 'button'
          ? limitText(control.textContent) || control.getAttribute('aria-label')?.trim() || control.getAttribute('title')?.trim() || null
          : null;
        const effectiveLabel = controlText ?? label;
        const flags: string[] = [];
        const controlTagName = control.tagName.toLowerCase();
        // HTML buttons submit by default when their type is omitted. Normalize
        // the effective type so submission evidence does not include reset or
        // ordinary buttons by accident.
        const controlType = controlTagName === 'button'
          ? (control.getAttribute('type')?.toLowerCase() || 'submit')
          : control.getAttribute('type')?.toLowerCase() ?? controlTagName;
        const validationAttributes = ['required', 'pattern', 'min', 'max', 'minlength', 'maxlength', 'step']
          .filter((attribute) => control.hasAttribute(attribute));
        const nativeValidationType = ['email', 'url', 'number', 'date', 'datetime-local', 'month', 'week', 'time']
          .includes(controlType);
        if (!effectiveLabel) flags.push(control.tagName.toLowerCase() === 'button' ? 'FORM_BUTTON_LABEL_ABSENT' : 'FORM_LABEL_ABSENT');
        if (effectiveLabel && control.tagName.toLowerCase() === 'button') flags.push('FORM_BUTTON_LABEL_PRESENT');
        if (effectiveLabel && control.tagName.toLowerCase() !== 'button') flags.push('FORM_LABEL_PRESENT');
        if (labelAdjacent === true) flags.push('FORM_LABEL_ADJACENT');
        if (labelElement && labelAdjacent === false) flags.push('FORM_LABEL_ADJACENCY_REVIEW');
        if (validationAttributes.length > 0 || nativeValidationType) flags.push('FORM_VALIDATION_CONSTRAINT_OBSERVED');
        if (invalid) flags.push('FORM_VALIDATION_STATE_INVALID');
        if (invalid && (helpText || errorMessage)) flags.push('FORM_VALIDATION_SUGGESTION_PRESENT');
        if (invalid && !helpText && !errorMessage) flags.push('FORM_VALIDATION_SUGGESTION_ABSENT');
        if (control.tagName.toLowerCase() !== 'button' && (validationAttributes.length > 0 || nativeValidationType || invalid)) {
          flags.push('FORM_VALIDATION_REVIEW');
        }
        if (invalid && !errorMessage) flags.push('FORM_ERROR_MESSAGE_ABSENT');
        if (describedByIds.some((ref) => !document.getElementById(ref))) {
          flags.push('FORM_HELP_REFERENCE_MISSING');
        }

        return {
          selector: getUniqueSelector(control),
          tagName: control.tagName.toLowerCase(),
          type: controlType,
          id,
          name: control.getAttribute('name'),
          label: effectiveLabel,
          labelSource,
          required: control.hasAttribute('required') || control.getAttribute('aria-required') === 'true',
          invalid,
          autocomplete: control.getAttribute('autocomplete'),
          describedByIds,
          helpText,
          errorMessage,
          flags,
          labelSelector: labelElement ? getUniqueSelector(labelElement) : null,
          labelAdjacent,
          groupSelector: fieldset ? getUniqueSelector(fieldset) : null,
          groupLegend: legendElement ? limitText(legendElement.textContent) : null,
          optionGroups,
          validationConstraints: [...validationAttributes, ...(nativeValidationType ? [`type=${controlType}`] : [])],
          validationMessage: errorMessage,
          sensitive: controlType === 'password' || ['current-password', 'new-password', 'cc-number', 'cc-csc', 'cc-exp', 'cc-exp-month', 'cc-exp-year'].includes(control.getAttribute('autocomplete') ?? ''),
        };
      });
    };

    const formData = (form: Element | Document) => ({
      controls: controlsFor(form),
      groups: Array.from(form.querySelectorAll('fieldset')).slice(0, MAX_CONTROLS_PER_FORM).map((fieldset) => {
        const legend = fieldset.querySelector('legend');
        const controlSelectors = controlsFor(fieldset).map((control) => control.selector);
        return {
          selector: getUniqueSelector(fieldset),
          legend: legend ? limitText(legend.textContent) : null,
          controlSelectors,
          flags: [
            legend ? (limitText(legend.textContent) ? 'FORM_GROUP_LEGEND_PRESENT' : 'FORM_GROUP_LEGEND_EMPTY') : 'FORM_GROUP_LEGEND_ABSENT',
            'FORM_GROUP_REVIEW',
          ],
        };
      }),
    });
    const forms = Array.from(document.querySelectorAll('form')).slice(0, MAX_FORMS).map((form) => {
      const data = formData(form);
      const hasSubmissionControl = data.controls.some((control) => (
          control.tagName === 'button'
          ? control.type === 'submit'
          : ['submit', 'image'].includes(control.type)
      ));
      return {
        selector: getUniqueSelector(form),
        action: form.getAttribute('action'),
        method: (form.getAttribute('method') ?? 'get').toLowerCase(),
        ...data,
        // The collector never submits a form. A real or sensitive submission
        // must be exercised by an explicitly configured local journey and
        // reviewed by a human.
        flags: hasSubmissionControl ? ['FORM_SUBMISSION_REVIEW', 'FORM_SUBMISSION_NOT_EXECUTED'] : [],
        submitControls: data.controls
          .filter((control) => control.tagName === 'button' ? control.type === 'submit' : ['submit', 'image'].includes(control.type))
          .map((control) => control.selector),
        sensitiveControlSelectors: data.controls.filter((control) => control.sensitive).map((control) => control.selector),
      };
    });

    const controlsOutsideForms = controlsFor(document).filter((control) => {
      const element = document.querySelector(control.selector);
      return !element?.closest('form');
    });
    if (controlsOutsideForms.length > 0) {
      forms.push({ selector: '(contrôles hors formulaire)', action: null, method: 'get', controls: controlsOutsideForms, groups: [], flags: [], submitControls: [], sensitiveControlSelectors: [] });
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
// collectPresentation
// ---------------------------------------------------------------------------

/** Read one presentation state without deciding whether it is conformant. */
async function readPresentationSnapshot(
  page: Page,
  scenario: PresentationScenario,
  note?: string,
): Promise<PresentationSnapshot> {
  return page.evaluate(({ scenario: currentScenario, note: currentNote }) => {
    const root = document.documentElement;
    const body = document.body;
    const normalizeTextLength = (value: string | null | undefined): number | null => (
      value == null ? null : value.replace(/\s+/g, ' ').trim().length
    );
    const isVisible = (element: Element): boolean => {
      const style = getComputedStyle(element);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.visibility !== 'collapse'
        && element.getClientRects().length > 0;
    };
    const hasHiddenAncestor = (element: Element): boolean => {
      let current: Element | null = element;
      while (current) {
        if (current.hasAttribute('hidden')
          || current.getAttribute('aria-hidden')?.toLowerCase() === 'true'
          || current.hasAttribute('inert')) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    };
    const focusableSelector = [
      'a[href]', 'area[href]', 'button', 'input:not([type="hidden"])',
      'select', 'textarea', 'summary', '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const allFocusable = body ? Array.from(body.querySelectorAll(focusableSelector)) : [];
    const visibleFocusable = allFocusable.filter((element) => isVisible(element) && !hasHiddenAncestor(element));
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
    const focusTarget = document.activeElement;
    const focusObservations = visibleFocusable.slice(0, 200).map((element) => {
      const previous = document.activeElement;
      (element as HTMLElement).focus({ preventScroll: true });
      const style = getComputedStyle(element);
      let focusVisible = style.outlineStyle !== 'none'
        && style.outlineWidth !== '0px'
        && style.outlineColor !== 'transparent';
      focusVisible = focusVisible || style.boxShadow !== 'none';
      try {
        focusVisible = focusVisible || element.matches(':focus-visible');
      } catch {
        // Older browser engines may not implement :focus-visible.
      }
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || null;
      const observation = {
        selector: getUniqueSelector(element),
        tagName: element.tagName.toLowerCase(),
        role: element.getAttribute('role'),
        text,
        focusVisible,
        flags: [
          'PRESENTATION_FOCUS_REVIEW',
          focusVisible ? 'PRESENTATION_FOCUS_VISIBLE' : 'PRESENTATION_FOCUS_INDICATOR_NOT_OBSERVED',
        ],
      };
      if (previous && previous !== element && previous instanceof HTMLElement) previous.focus({ preventScroll: true });
      return observation;
    });
    if (focusTarget && focusTarget instanceof HTMLElement) focusTarget.focus({ preventScroll: true });
    const scrollWidth = root?.scrollWidth ?? null;
    const clientWidth = root?.clientWidth ?? null;
    const flags: string[] = ['PRESENTATION_METRICS_CAPTURED'];
    if (scrollWidth !== null && clientWidth !== null && scrollWidth > clientWidth + 1) {
      flags.push('PRESENTATION_HORIZONTAL_OVERFLOW');
    }
    if (currentScenario === 'baseline') flags.push('PRESENTATION_BASELINE_CAPTURED');
    if (currentScenario === 'styles-disabled') flags.push('PRESENTATION_STYLES_DISABLED_CAPTURED');
    if (currentScenario === 'viewport-320x256') flags.push('PRESENTATION_VIEWPORT_320_CAPTURED');
    if (currentScenario === 'zoom-200-probe') flags.push('PRESENTATION_ZOOM_200_PROBE');
    if (focusObservations.length > 0) flags.push('PRESENTATION_FOCUS_REVIEW');
    if (focusObservations.length === 0) flags.push('PRESENTATION_FOCUS_NO_TARGET');
    if (focusObservations.some((observation) => !observation.focusVisible)) flags.push('PRESENTATION_FOCUS_INDICATOR_NOT_OBSERVED');
    if (focusObservations.some((observation) => observation.focusVisible)) flags.push('PRESENTATION_FOCUS_VISIBLE');
    return {
      scenario: currentScenario,
      status: 'observed' as const,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : null,
      visualViewportScale: window.visualViewport?.scale ?? null,
      documentScrollWidth: scrollWidth,
      documentScrollHeight: root?.scrollHeight ?? null,
      documentClientWidth: clientWidth,
      documentClientHeight: root?.clientHeight ?? null,
      bodyTextLength: normalizeTextLength(body?.textContent),
      visibleTextLength: normalizeTextLength(body?.innerText),
      focusableCount: allFocusable.length,
      visibleFocusableCount: visibleFocusable.length,
      cssZoom: root ? getComputedStyle(root).zoom || null : null,
      focusObservations,
      flags,
      ...(currentNote ? { note: currentNote } : {}),
    };
  }, { scenario, note });
}

function notObservedPresentationSnapshot(
  scenario: PresentationScenario,
  note: string,
): PresentationSnapshot {
  return {
    scenario,
    status: 'not_observed',
    viewportWidth: null,
    viewportHeight: null,
    devicePixelRatio: null,
    visualViewportScale: null,
    documentScrollWidth: null,
    documentScrollHeight: null,
    documentClientWidth: null,
    documentClientHeight: null,
    bodyTextLength: null,
    visibleTextLength: null,
    focusableCount: null,
    visibleFocusableCount: null,
    cssZoom: null,
    focusObservations: [],
    flags: [],
    note,
  };
}

async function collectPresentationCues(page: Page): Promise<PresentationCueObservation[]> {
  return page.evaluate(() => {
    const MAX_ITEMS = 200;
    const normalize = (value: string | null | undefined, max = 240): string | null => {
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
    const accessibleName = (element: Element): string | null => {
      const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
      return normalize(labelledBy)
        ?? normalize(element.getAttribute('aria-label'))
        ?? normalize(element.getAttribute('title'));
    };
    const cues: PresentationCueObservation[] = [];
    for (const element of Array.from(document.querySelectorAll('body *'))) {
      if (cues.length >= MAX_ITEMS) break;
      const inlineStyle = element.getAttribute('style') ?? '';
      const has = (pattern: RegExp): boolean => pattern.test(inlineStyle);
      const kinds: PresentationCueKind[] = [];
      if (has(/(?:^|;)\s*(?:color|background(?:-color)?):/i)) kinds.push('color');
      if (has(/(?:^|;)\s*(?:border(?:-[\w-]+)?|border-radius|box-shadow|clip-path):/i)) kinds.push('shape');
      if (has(/(?:^|;)\s*(?:font-size|width|height|padding|margin):/i)
        || has(/(?:^|;)\s*transform:\s*[^;]*scale/i)) kinds.push('size');
      if (has(/(?:^|;)\s*(?:position|inset|top|right|bottom|left):/i)
        || has(/(?:^|;)\s*transform:\s*[^;]*translate/i)) kinds.push('position');
      if (kinds.length === 0) continue;
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      cues.push({
        selector: getUniqueSelector(element),
        tagName: element.tagName.toLowerCase(),
        text: normalize(element.textContent),
        accessibleName: accessibleName(element),
        kinds,
        color: computed.color || null,
        backgroundColor: computed.backgroundColor || null,
        fontSize: computed.fontSize || null,
        borderRadius: computed.borderRadius || null,
        position: computed.position || null,
        dimensions: [rect.width, rect.height].every(Number.isFinite)
          ? { width: Math.round(rect.width), height: Math.round(rect.height) }
          : null,
        flags: [
          'PERCEPTUAL_CUE_REVIEW',
          ...kinds.map((kind) => `PERCEPTUAL_${kind.toUpperCase()}_CUE`),
          ...(accessibleName(element) || normalize(element.textContent) ? ['PERCEPTUAL_TEXT_ALTERNATIVE_PRESENT'] : []),
        ],
      });
    }
    return cues;
  });
}

/**
 * Capture the baseline, no-stylesheet, 320×256 and bounded 200% CSS-zoom
 * states. Every temporary mutation is restored before returning so replay and
 * the other collectors keep seeing the original page state.
 */
export async function collectPresentation(page: Page): Promise<PresentationData> {
  const snapshots: PresentationSnapshot[] = [];
  const initialViewport = page.viewportSize();
  const perceptualCues = await collectPresentationCues(page);
  const baseline = await readPresentationSnapshot(page, 'baseline');
  snapshots.push(baseline);

  const hiddenContent = await page.evaluate(() => {
    const MAX_ITEMS = 200;
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
    const focusableSelector = [
      'a[href]', 'area[href]', 'button', 'input:not([type="hidden"])',
      'select', 'textarea', 'summary', '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const isFocusable = (element: Element): boolean => element.matches(focusableSelector);
    return Array.from(document.querySelectorAll('body *')).flatMap((element) => {
      const reasons: HiddenContentObservation['reasons'] = [];
      let current: Element | null = element;
      while (current) {
        if (current.hasAttribute('hidden')) reasons.push('hidden-attribute');
        if (current.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true') reasons.push('aria-hidden');
        if (current.hasAttribute('inert')) reasons.push('inert');
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') reasons.push('css-hidden');
        current = current.parentElement;
      }
      if (reasons.length === 0) return [];
      return [{
        selector: getUniqueSelector(element),
        reasons: [...new Set(reasons)],
        focusable: isFocusable(element),
        flags: [
          'HIDDEN_CONTENT_REVIEW',
          ...(isFocusable(element) ? ['HIDDEN_FOCUSABLE_CONTENT'] : []),
        ],
      }];
    }).slice(0, MAX_ITEMS);
  });

  const styleState = await page.evaluate(() => Array.from(
    document.querySelectorAll('link[rel~="stylesheet"], style'),
  ).map((element) => {
    const stylesheet = element as HTMLLinkElement | HTMLStyleElement;
    return {
    attributeDisabled: 'disabled' in element
      ? Boolean(stylesheet.disabled)
      : false,
    sheetDisabled: stylesheet.sheet?.disabled ?? false,
    };
  }));
  try {
    await page.evaluate(() => {
      for (const element of Array.from(document.querySelectorAll('link[rel~="stylesheet"], style'))) {
        const stylesheet = element as HTMLLinkElement | HTMLStyleElement;
        if ('disabled' in element) stylesheet.disabled = true;
        if (stylesheet.sheet) stylesheet.sheet.disabled = true;
      }
    });
    const withoutStyles = await readPresentationSnapshot(
      page,
      'styles-disabled',
      'La comparaison porte sur les métriques DOM ; la décision sur le contenu visible reste humaine.',
    );
    if (baseline.bodyTextLength !== withoutStyles.bodyTextLength
      || baseline.visibleTextLength !== withoutStyles.visibleTextLength) {
      withoutStyles.flags.push('PRESENTATION_TEXT_INVENTORY_CHANGED');
    }
    snapshots.push(withoutStyles);
  } catch (error) {
    snapshots.push(notObservedPresentationSnapshot(
      'styles-disabled',
      `Désactivation temporaire des feuilles de styles impossible : ${error instanceof Error ? error.message : String(error)}`,
    ));
  } finally {
    await page.evaluate((states) => {
      const elements = Array.from(document.querySelectorAll('link[rel~="stylesheet"], style'));
      elements.forEach((element, index) => {
        const state = states[index];
        if (state !== undefined) {
          const stylesheet = element as HTMLLinkElement | HTMLStyleElement;
          if ('disabled' in element) {
            stylesheet.disabled = state.attributeDisabled;
          }
          if (stylesheet.sheet) stylesheet.sheet.disabled = state.sheetDisabled;
        }
      });
    }, styleState);
  }

  if (!initialViewport) {
    snapshots.push(notObservedPresentationSnapshot(
      'viewport-320x256',
      'Le contexte Playwright ne fournit pas de viewport redimensionnable ; le scénario 320×256 n’a pas été exécuté.',
    ));
  } else {
    try {
      await page.setViewportSize({ width: 320, height: 256 });
      snapshots.push(await readPresentationSnapshot(
        page,
        'viewport-320x256',
        'Le verdict RGAA 10.11 doit confirmer la perte éventuelle de contenu ou de fonctionnalité.',
      ));
    } catch (error) {
      snapshots.push(notObservedPresentationSnapshot(
        'viewport-320x256',
        `Viewport 320×256 impossible à appliquer : ${error instanceof Error ? error.message : String(error)}`,
      ));
    } finally {
      await page.setViewportSize(initialViewport).catch(() => undefined);
    }
  }

  let previousZoom: string | null = null;
  try {
    previousZoom = await page.evaluate(() => document.documentElement.style.zoom || null);
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    snapshots.push(await readPresentationSnapshot(
      page,
      'zoom-200-probe',
      'Cette sonde utilise CSS zoom ; elle ne remplace pas la vérification du zoom texte navigateur à 200%.',
    ));
  } catch (error) {
    snapshots.push(notObservedPresentationSnapshot(
      'zoom-200-probe',
      `Sonde de zoom 200% impossible à appliquer : ${error instanceof Error ? error.message : String(error)}`,
    ));
  } finally {
    await page.evaluate((zoom) => {
      document.documentElement.style.zoom = zoom ?? '';
    }, previousZoom).catch(() => undefined);
  }

  return {
    snapshots,
    perceptualCues,
    hiddenContent,
    flags: [...new Set([
      ...snapshots.flatMap((snapshot) => snapshot.flags),
      ...perceptualCues.flatMap((cue) => cue.flags),
      ...hiddenContent.flatMap((item) => item.flags),
    ])],
    manualChecks: [
      'Vérifier que toute information portée par la couleur dispose d’une formulation ou d’une alternative non visuelle (RGAA 3.1).',
      'Vérifier que les repères de forme, de taille ou de position disposent d’une formulation ou d’une alternative compréhensible (RGAA 10.9).',
      'Vérifier que l’usage d’une forme, d’une taille ou d’une position est pertinent et accompagné d’une alternative lorsque nécessaire (RGAA 10.10).',
      'Comparer visuellement le contenu porteur d’information et son ordre de lecture avec les feuilles de styles désactivées (RGAA 10.2 et 10.3).',
      'Confirmer avec le zoom texte du navigateur à 200% que le texte reste lisible, sans perte d’information ni de fonctionnalité (RGAA 10.4).',
      'Confirmer à 320×256 que le contenu reste utilisable ; un débordement horizontal est un signal à analyser, pas un verdict automatique (RGAA 10.11).',
      'Vérifier manuellement les contenus additionnels exposés par :hover/:focus et leur accès clavier/pointeur (RGAA 10.14).',
    ],
  };
}

// ---------------------------------------------------------------------------
// collectNavigation
// ---------------------------------------------------------------------------

/**
 * Inventory navigation mechanisms on one page. This intentionally records
 * observable candidates only; the existence of two systems and consistency
 * across a page set remain human decisions.
 */
export async function collectNavigation(page: Page): Promise<NavigationData> {
  const sitemapLabels = getCriterion('12.3')?.heuristicPatterns.navigationLinkLabels ?? [];
  const manualChecks = ['12.1', '12.2', '12.3', '12.4', '12.5'].flatMap((id) => (
    getCriterion(id)?.heuristicPatterns.manualChecks?.map((check) => `${id} — ${check}`) ?? []
  ));
  return page.evaluate(({ sitemapLabels: configuredSitemapLabels, configuredManualChecks }) => {
    const MAX_ITEMS = 100;
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
        ?? normalize(element.getAttribute('title'))
        ?? normalize(element.textContent);
    };
    const positionOf = (element: Element): NavigationSystemData['position'] => {
      const rect = element.getBoundingClientRect();
      if (![rect.top, rect.left, rect.width, rect.height].every(Number.isFinite)) return null;
      return { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    type NavigationCandidate = { element: Element; kind: NavigationSystemKind; href: string | null };
    const candidates: NavigationCandidate[] = [];
    const addCandidate = (element: Element, kind: NavigationSystemKind, href: string | null) => {
      const selector = getUniqueSelector(element);
      if (candidates.some((candidate) => candidate.kind === kind && getUniqueSelector(candidate.element) === selector)) return;
      candidates.push({ element, kind, href });
    };
    const compareDomOrder = (left: Element, right: Element): number => {
      const relation = left.compareDocumentPosition(right);
      if (relation & 4 /* DOCUMENT_POSITION_FOLLOWING */) return -1;
      if (relation & 2 /* DOCUMENT_POSITION_PRECEDING */) return 1;
      return 0;
    };
    for (const element of Array.from(document.querySelectorAll('nav, [role="navigation"]'))) {
      addCandidate(element, 'navigation', null);
    }
    for (const form of Array.from(document.querySelectorAll('form[role="search"]'))) {
      addCandidate(form, 'search', form.getAttribute('action'));
    }
    for (const input of Array.from(document.querySelectorAll('input[type="search"]'))) {
      const form = input.closest('form');
      addCandidate(form ?? input, 'search', form?.getAttribute('action') ?? null);
    }
    const normalizedLabels = configuredSitemapLabels.map((label) => label.toLowerCase().trim()).filter(Boolean);
    for (const link of Array.from(document.querySelectorAll('a[href]'))) {
      const label = referencedText(link)?.toLowerCase() ?? '';
      if (normalizedLabels.some((candidate) => label === candidate)) {
        addCandidate(link, 'sitemap', link.getAttribute('href'));
      }
    }

    const systems = candidates
      .sort((left, right) => compareDomOrder(left.element, right.element))
      .slice(0, MAX_ITEMS)
      .map(({ element, kind, href }, domIndex): NavigationSystemData => {
        const label = referencedText(element);
        const flags = ['NAVIGATION_SYSTEM_PRESENT', 'NAVIGATION_POSITION_CAPTURED'];
        if (kind === 'search') flags.push('NAVIGATION_SEARCH_PRESENT');
        if (kind === 'sitemap') flags.push('NAVIGATION_SITEMAP_CANDIDATE');
        if (label) flags.push('NAVIGATION_LABEL_PRESENT');
        return {
          kind,
          selector: getUniqueSelector(element),
          label,
          href,
          domIndex,
          position: positionOf(element),
          flags,
        };
      });

    return {
      systems,
      flags: [...new Set(systems.flatMap((system) => system.flags))],
      manualChecks: configuredManualChecks,
    };
  }, { sitemapLabels, configuredManualChecks: manualChecks });
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
  const presentation = await collectPresentation(page);
  const navigation = await collectNavigation(page);
  return { images, media, specializedContent, frames, links, headings, structure, forms, figcaptions, presentation, navigation };
}
