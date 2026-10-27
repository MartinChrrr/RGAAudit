import { chromium, type BrowserContext, type Page } from 'playwright';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { analyzeLoadedPage, type PageResult } from '../analyzer/analyzer';
import { mapPageResults } from '../mapping/mapper';
import type { PageComparison } from '../report/comparison';
import type { HumanStatus } from '../domain/review';

export const JOURNEY_ACTIONS = ['navigate', 'click', 'fill', 'press', 'wait'] as const;
export type JourneyAction = typeof JOURNEY_ACTIONS[number];
export const JOURNEY_RUN_SCHEMA_VERSION = 1 as const;
/** Version of the immutable journey annex embedded in an audit report. */
export const JOURNEY_REPORT_ANNEX_SCHEMA_VERSION = 1 as const;

export interface JourneyStep {
  id: string;
  action: JourneyAction;
  url?: string;
  selector?: string;
  value?: string;
  /** When true, the value is kept out of public journey responses and evidence. */
  sensitive?: boolean;
  /** Runtime-only reference used to rehydrate a sensitive value in the local process. */
  secretRef?: string;
  key?: string;
  waitMs?: number;
}

export interface JourneyDefinition {
  id: string;
  name: string;
  startUrl: string;
  steps: JourneyStep[];
  createdAt: string;
}

export interface JourneyEvidence {
  selector: string;
  html: string;
  context?: string;
  resultId: string;
  proofId: string;
  criterionIds: string[];
  elementIndex: number;
}

/** Stable, redacted description of the element that owned focus. */
export interface JourneyFocusTarget {
  selector: string;
  tagName: string;
  role: string | null;
  text: string | null;
  withinComponent: boolean;
  focusVisible: boolean;
}

/** Keyboard-specific observation attached to the component targeted by a press step. */
export interface JourneyKeyboardObservation {
  key: string;
  componentSelector: string;
  before: JourneyFocusTarget | null;
  after: JourneyFocusTarget | null;
  entered: boolean;
  exited: boolean;
  focusVisible: boolean;
  blocked: boolean;
  criterionIds: string[];
  /** Viewport at which the focus transition was observed. */
  viewport?: { width: number; height: number } | null;
  /** Keyboard and focus heuristics never replace a human RGAA decision. */
  requiresHumanReview: true;
}

export interface JourneyDisruptionObservation {
  kind: 'motion' | 'sound' | 'flash';
  selector: string;
  detail: string;
}

export interface JourneyInteractionObservation {
  kind: 'complex-gesture' | 'single-pointer' | 'device-motion';
  selector: string;
  detail: string;
  criterionIds: string[];
  requiresHumanReview: true;
}

/** Candidate disclosure or state change observed after a journey action. */
export interface JourneyDisclosureObservation {
  kind: 'aria-expanded' | 'details';
  selector: string;
  detail: string;
}

/** Candidate content that appears around a hover, focus or activation target. */
export interface JourneyAdditionalContentObservation {
  selector: string;
  trigger: 'hover' | 'focus' | 'activation' | 'unknown';
  detail: string;
}

/** Candidate time limit or refresh observed during a replay. */
export interface JourneyTimeLimitObservation {
  kind: 'timer' | 'meta-refresh' | 'countdown';
  selector: string;
  detail: string;
}

/** Candidate new-window opening observed during a replay. */
export interface JourneyNewWindowObservation {
  kind: 'window-open' | 'target-blank';
  selector: string;
  detail: string;
}

/** Candidate cryptic content and its observable alternative. */
export interface JourneyCrypticContentObservation {
  selector: string;
  content: string;
  alternative: string | null;
  detail: string;
}

/** Candidate pause/stop/hide control for an animated content review. */
export interface JourneyAnimationControlObservation {
  selector: string;
  kind: 'pause' | 'stop' | 'hide';
  label: string;
  detail: string;
  criterionIds: ['13.8'];
  requiresHumanReview: true;
}

/** Candidate alternative exposed for a script; relevance remains human-reviewed. */
export interface JourneyScriptAlternativeObservation {
  selector: string;
  alternativeSelector: string | null;
  alternative: string | null;
  detail: string;
}

/** Pointer and keyboard events observed on a script-driven control candidate. */
export interface JourneyScriptControlObservation {
  selector: string;
  pointerEvents: string[];
  keyboardEvents: string[];
  detail: string;
}

export interface JourneyContextObservation {
  trigger: {
    stepId: string;
    action: JourneyAction;
    selector?: string;
    key?: string;
  };
  urlBefore: string;
  urlAfter: string;
  titleBefore: string;
  titleAfter: string;
  changed: boolean;
  changeTypes: Array<'navigation' | 'title' | 'dialog' | 'live-region' | 'disclosure' | 'disruption' | 'additional-content' | 'time-limit' | 'new-window' | 'cryptic-content' | 'script-alternative' | 'script-control' | 'animation-control'>;
  disruptions: JourneyDisruptionObservation[];
  /** Optional for runs persisted before disclosure observations were added. */
  disclosures?: JourneyDisclosureObservation[];
  /** Optional evidence for RGAA 12.11. */
  additionalContent?: JourneyAdditionalContentObservation[];
  /** Optional evidence for RGAA 13.1. */
  timeLimits?: JourneyTimeLimitObservation[];
  /** Optional evidence for RGAA 13.2. */
  newWindows?: JourneyNewWindowObservation[];
  /** Optional evidence for RGAA 13.6 (and 13.5 when no alternative is exposed). */
  crypticContent?: JourneyCrypticContentObservation[];
  /** Candidate controls observed for an animated content review (RGAA 13.8). */
  animationControls?: JourneyAnimationControlObservation[];
  /** Optional evidence for RGAA 7.2. */
  scriptAlternatives?: JourneyScriptAlternativeObservation[];
  /** Optional evidence for RGAA 7.3. */
  scriptControls?: JourneyScriptControlObservation[];
  /** Optional for runs persisted before controlled-interaction observations. */
  interactions?: JourneyInteractionObservation[];
  criterionIds: string[];
  requiresHumanReview: true;
}

export interface JourneyStepObservation {
  stepId: string;
  action: JourneyAction;
  url: string;
  observedAt: string;
  title: string;
  evidence: JourneyEvidence[];
  keyboard?: JourneyKeyboardObservation;
  context?: JourneyContextObservation;
  screenshotPath?: string;
  /** Public URL exposed by the server when a context screenshot is available. */
  screenshotUrl?: string;
  /** Explains why an optional context screenshot was deliberately not stored. */
  screenshotSkippedReason?: 'sensitive_step' | 'quota' | 'too_large' | 'capture_error';
  result: PageResult | null;
  error?: string;
}

/** A human RGAA decision attached to one observed evidence item. */
export interface JourneyEvidenceDecision {
  stepId: string;
  evidenceIndex: number;
  criterionId: string;
  status: HumanStatus;
  comment: string;
  reviewedAt: string | null;
}

export interface JourneyRun {
  runId: string;
  journeyId: string;
  startedAt: string;
  finishedAt: string;
  steps: JourneyStepObservation[];
  comparisons?: PageComparison[];
  decisions?: JourneyEvidenceDecision[];
  decisionHistory?: JourneyEvidenceDecision[];
}

export interface JourneyRunState {
  schemaVersion: typeof JOURNEY_RUN_SCHEMA_VERSION;
  runId: string;
  journeyId: string;
  /** SHA-256 of the non-secret journey definition used for this run. */
  journeyDefinitionHash: string;
  /** Optional audit session to which the run may later be attached. */
  sessionId?: string;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
  startedAt: string;
  finishedAt?: string;
  run?: JourneyRun;
  error?: string;
}

/**
 * Snapshot of journey runs attached to a report. The server serializes a
 * redacted copy of each run so that report consumers never receive the
 * private replay URLs or sensitive execution details.
 */
export interface JourneyReportAnnex {
  schemaVersion: typeof JOURNEY_REPORT_ANNEX_SCHEMA_VERSION;
  generatedAt: string;
  sessionId: string;
  runs: JourneyRunState[];
}

export interface JourneyRunOptions {
  runId?: string;
  sessionId?: string;
  timeout?: number;
  isRequestAllowed?: (url: string) => Promise<boolean>;
  /** Optional directory where context-change screenshots are saved. */
  screenshotDir?: string;
}

const MAX_EVIDENCE_LENGTH = 2_000;
const MAX_CONTEXT_SCREENSHOTS_PER_RUN = 20;
const MAX_CONTEXT_SCREENSHOT_BYTES = 2_000_000;

export async function replayJourney(
  journey: JourneyDefinition,
  options: JourneyRunOptions = {},
): Promise<JourneyRun> {
  const runId = options.runId ?? randomUUID();
  const sessionId = options.sessionId ?? runId;
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch();
  let context: BrowserContext | undefined;

  try {
    context = await browser.newContext({ serviceWorkers: 'block' });
    if (options.isRequestAllowed) {
      await context.route('**/*', async (route) => {
        const requestUrl = route.request().url();
        if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) {
          await route.continue();
          return;
        }
        const allowed = await options.isRequestAllowed!(requestUrl).catch(() => false);
        if (allowed) await route.continue();
        else await route.abort('blockedbyclient');
      });
    }

    const page = await context.newPage();
    await installInteractionProbe(page);
    await page.goto(journey.startUrl, { waitUntil: 'networkidle', timeout: options.timeout ?? 30_000 });
    const steps: JourneyStepObservation[] = [];
    const focusHistory: string[] = [];
    let sensitiveStepObserved = false;
    let contextScreenshots = 0;
    let previousUrl = page.url();
    for (const [stepIndex, step] of journey.steps.entries()) {
      const observedAt = new Date().toISOString();
      // Mark the replay as sensitive before executing the action. A failed
      // sensitive action may still have partially changed the DOM, so later
      // context captures must remain disabled.
      if (step.sensitive === true) sensitiveStepObserved = true;
      try {
        const urlBeforeStep = page.url();
        if (urlBeforeStep !== previousUrl || step.action === 'navigate') focusHistory.length = 0;
        const beforeSignals = await captureContextSignals(page);
        const beforeFocus = step.action === 'press' && step.selector
          ? await captureFocus(page, step.selector)
          : null;
        await applyStep(page, step, options.timeout ?? 30_000);
        const afterSignals = await captureContextSignals(page);
        const afterFocus = step.action === 'press' && step.selector
          ? await captureFocus(page, step.selector)
          : null;
        const url = page.url();
        if (url !== urlBeforeStep) focusHistory.length = 0;
        previousUrl = url;
        const result = await analyzeLoadedPage(page, url, sessionId, { timeout: options.timeout });
        const resultId = `journey-result-${runId}-${stepIndex}-${step.id}`;
        const mappedCriteria = mapCriteriaForEvidence(result, url);
        const evidence = step.selector
          ? await collectStepEvidence(page, step.selector, resultId, mappedCriteria)
          : [];
        const keyboard = step.action === 'press' && step.selector && step.key
          ? buildKeyboardObservation(step, beforeFocus, afterFocus, focusHistory, page.viewportSize())
          : undefined;
        const context = buildContextObservation(step, beforeSignals, afterSignals, stepIndex === 0);
        const screenshotBlockedBySensitiveStep = sensitiveStepObserved;
        let screenshotPath: string | undefined;
        let screenshotSkippedReason: JourneyStepObservation['screenshotSkippedReason'];
        if (options.screenshotDir && screenshotBlockedBySensitiveStep) {
          // A replay may still display a secret after the sensitive action. Do not
          // capture this or any later context, even if the DOM no longer exposes
          // the sensitive control.
          screenshotSkippedReason = 'sensitive_step';
        } else if (context.changed && options.screenshotDir) {
          if (contextScreenshots >= MAX_CONTEXT_SCREENSHOTS_PER_RUN) {
            screenshotSkippedReason = 'quota';
          } else {
            const capture = await captureContextScreenshot(page, options.screenshotDir, step.id, stepIndex);
            if (capture.path) {
              screenshotPath = capture.path;
              contextScreenshots += 1;
            } else {
              screenshotSkippedReason = capture.reason;
            }
          }
        }
        steps.push({
          stepId: step.id,
          action: step.action,
          url,
          observedAt,
          title: await page.title(),
          evidence,
          ...(keyboard ? { keyboard } : {}),
          context,
          ...(screenshotPath ? { screenshotPath } : {}),
          ...(screenshotSkippedReason ? { screenshotSkippedReason } : {}),
          result,
          ...(result.error ? { error: result.error } : {}),
        });
      } catch (error) {
        steps.push({
          stepId: step.id,
          action: step.action,
          url: page.url(),
          observedAt,
          title: await page.title().catch(() => ''),
          evidence: [],
          result: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { runId, journeyId: journey.id, startedAt, finishedAt: new Date().toISOString(), steps };
  } finally {
    await context?.close();
    await browser.close();
  }
}

interface JourneyContextSignals {
  url: string;
  title: string;
  dialogs: string[];
  liveRegions: string[];
  disclosures: Array<{
    kind: JourneyDisclosureObservation['kind'];
    selector: string;
    state: string;
    detail: string;
  }>;
  disruptions: JourneyDisruptionObservation[];
  interactions: JourneyInteractionObservation[];
  additionalContent: Array<{ selector: string; trigger: JourneyAdditionalContentObservation['trigger']; state: string; detail: string }>;
  timeLimits: JourneyTimeLimitObservation[];
  newWindows: JourneyNewWindowObservation[];
  crypticContent: JourneyCrypticContentObservation[];
  animationControls: JourneyAnimationControlObservation[];
  scriptAlternatives: JourneyScriptAlternativeObservation[];
  scriptControls: JourneyScriptControlObservation[];
}

async function installInteractionProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const eventTypes = [
      'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
      'touchstart', 'touchmove', 'touchend',
      'keydown', 'keyup',
      'devicemotion', 'deviceorientation',
    ];
    const sensorTypes = new Set(['devicemotion', 'deviceorientation']);
    const state = {
      events: [] as Array<{ type: string; selector: string; scriptTarget: string | null; x: number | null; y: number | null; pointerId: number | null }>,
      registrations: [] as string[],
      scriptListeners: [] as string[],
      timers: [] as Array<{ kind: 'setTimeout' | 'setInterval'; delay: number }>,
      windowOpens: [] as Array<{ url: string; target: string }>,
    };
    const selectorOf = (target: EventTarget | null): string => {
      if (!(target instanceof Element)) return target === window ? 'window' : 'document';
      if (target.id) return `#${CSS.escape(target.id)}`;
      return target.tagName.toLowerCase();
    };
    const scriptListenerTypes = new Set(['click', 'keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchend', 'touchmove']);
    const inlineScriptAttributes = ['onclick', 'onkeydown', 'onkeyup', 'onpointerdown', 'onpointerup', 'ontouchstart', 'ontouchend'];
    const scriptTargetOf = (target: EventTarget | null): string | null => {
      let current = target instanceof Element ? target : null;
      while (current) {
        const selector = selectorOf(current);
        if (state.scriptListeners.includes(selector) || inlineScriptAttributes.some((attribute) => current!.hasAttribute(attribute))) return selector;
        current = current.parentElement;
      }
      return null;
    };
    const record = (event: Event): void => {
      if (state.events.length >= 200) return;
      const pointer = event as PointerEvent;
      const touch = event as TouchEvent;
      const point = touch.touches?.[0] ?? touch.changedTouches?.[0];
      state.events.push({
        type: event.type,
        selector: selectorOf(event.target),
        scriptTarget: scriptTargetOf(event.target),
        x: Number.isFinite(pointer.clientX) ? pointer.clientX : (point?.clientX ?? null),
        y: Number.isFinite(pointer.clientY) ? pointer.clientY : (point?.clientY ?? null),
        pointerId: Number.isFinite(pointer.pointerId) ? pointer.pointerId : null,
      });
    };
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
      const eventName = String(type);
      if (this instanceof Element && scriptListenerTypes.has(eventName)) {
        const selector = selectorOf(this);
        if (!state.scriptListeners.includes(selector)) state.scriptListeners.push(selector);
      }
      if ((this === window || this === document) && sensorTypes.has(String(type)) && !state.registrations.includes(String(type))) {
        state.registrations.push(String(type));
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    Object.defineProperty(window, '__rgauditInteractionProbe', { value: state, configurable: true });
    const originalSetTimeout = window.setTimeout.bind(window);
    const originalSetInterval = window.setInterval.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (state.timers.length < 100) state.timers.push({ kind: 'setTimeout', delay: Number(timeout) || 0 });
      return originalSetTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (state.timers.length < 100) state.timers.push({ kind: 'setInterval', delay: Number(timeout) || 0 });
      return originalSetInterval(handler, timeout, ...args);
    }) as typeof window.setInterval;
    const originalOpen = window.open.bind(window);
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      if (state.windowOpens.length < 50) state.windowOpens.push({ url: String(url ?? ''), target: target ?? '' });
      return originalOpen(url, target, features);
    }) as typeof window.open;
    for (const type of eventTypes) originalAddEventListener.call(window, type, record, true);
  });
}

async function captureContextSignals(page: Page): Promise<JourneyContextSignals> {
  const url = page.url();
  const title = await page.title().catch(() => '');
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
      return `${getUniqueSelector(parent)} > ${tag}${suffix}`;
    };
    const visible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const disruptions: JourneyDisruptionObservation[] = [];
    const interactionEvents = (window as typeof window & {
        __rgauditInteractionProbe?: {
          events: Array<{ type: string; selector: string; scriptTarget: string | null; x: number | null; y: number | null; pointerId: number | null }>;
        registrations: string[];
        timers: Array<{ kind: 'setTimeout' | 'setInterval'; delay: number }>;
        windowOpens: Array<{ url: string; target: string }>;
      };
    }).__rgauditInteractionProbe;
    const probeEvents = interactionEvents?.events.splice(0) ?? [];
    const registeredSensors = interactionEvents?.registrations ?? [];
    const timers = interactionEvents?.timers.splice(0) ?? [];
    const windowOpens = interactionEvents?.windowOpens.splice(0) ?? [];
    for (const element of Array.from(document.querySelectorAll('*'))) {
      if (!visible(element)) continue;
      const style = window.getComputedStyle(element);
      if (style.animationName !== 'none' || style.transitionDuration !== '0s') {
        const isFlashCandidate = /(?:flash|blink|flicker|strobe)/i.test(style.animationName)
          || /(?:color|opacity|filter|background)/i.test(style.transitionProperty);
        disruptions.push({
          kind: isFlashCandidate ? 'flash' : 'motion',
          selector: getUniqueSelector(element),
          detail: `animation=${style.animationName}; duration=${style.animationDuration}; transition=${style.transitionProperty}/${style.transitionDuration}`.slice(0, 240),
        });
      }
      if ((element instanceof HTMLAudioElement || element instanceof HTMLVideoElement)
        && (!element.paused || element.autoplay)) {
        disruptions.push({
          kind: 'sound',
          selector: getUniqueSelector(element),
          detail: `media=${element.tagName.toLowerCase()}; autoplay=${element.autoplay}; paused=${element.paused}`,
        });
      }
      if (disruptions.length >= 50) break;
    }
    const interactions: JourneyInteractionObservation[] = [];
    if (registeredSensors.length > 0 || probeEvents.some((event) => event.type === 'devicemotion' || event.type === 'deviceorientation')) {
      interactions.push({
        kind: 'device-motion',
        selector: 'window',
        detail: `API de mouvement observée : ${[...new Set(registeredSensors)].join(', ') || 'événement reçu'}`,
        criterionIds: ['13.12'],
        requiresHumanReview: true,
      });
    }
    const pointerDowns = probeEvents.filter((event) => event.type === 'pointerdown' || event.type === 'touchstart');
    for (const down of pointerDowns.slice(0, 20)) {
      const release = probeEvents.find((event) => (
        (event.type === 'pointerup' || event.type === 'pointercancel' || event.type === 'touchend')
        && (down.pointerId === null || event.pointerId === null || event.pointerId === down.pointerId)
      ));
      interactions.push({
        kind: 'single-pointer',
        selector: down.selector,
        detail: `Séquence ${down.type} → ${release?.type ?? 'sans relâche observée'}`,
        criterionIds: ['13.11'],
        requiresHumanReview: true,
      });
    }
    const moved = probeEvents.find((event) => {
      if (event.type === 'touchmove') return true;
      if (event.type !== 'pointermove') return false;
      const down = pointerDowns.find((candidate) => (
        candidate.pointerId === null || event.pointerId === null || candidate.pointerId === event.pointerId
      ));
      if (!down || down.x === null || down.y === null || event.x === null || event.y === null) return false;
      return Math.hypot(event.x - down.x, event.y - down.y) > 8;
    });
    if (moved) {
      interactions.push({
        kind: 'complex-gesture',
        selector: moved.selector,
        detail: `Mouvement ${moved.type} observé ; vérifier l’équivalent par geste simple.`,
        criterionIds: ['13.10'],
        requiresHumanReview: true,
      });
    }
    const scriptControlEvents = new Map<string, { pointer: Set<string>; keyboard: Set<string> }>();
    for (const event of probeEvents) {
      const isPointer = ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend'].includes(event.type);
      const isKeyboard = ['keydown', 'keyup'].includes(event.type);
      if ((!isPointer && !isKeyboard) || !event.scriptTarget) continue;
      const entry = scriptControlEvents.get(event.scriptTarget) ?? { pointer: new Set<string>(), keyboard: new Set<string>() };
      if (isPointer) entry.pointer.add(event.type);
      if (isKeyboard) entry.keyboard.add(event.type);
      scriptControlEvents.set(event.scriptTarget, entry);
    }
    const scriptControls: JourneyScriptControlObservation[] = [...scriptControlEvents.entries()].slice(0, 50).map(([selector, events]) => ({
      selector,
      pointerEvents: [...events.pointer],
      keyboardEvents: [...events.keyboard],
      detail: `événements observés : ${[...events.pointer, ...events.keyboard].join(', ')} ; vérifier le contrôle du script au clavier et au pointage`,
    }));
    const scriptElements = Array.from(document.querySelectorAll('script')).filter((element) => {
      const type = (element.getAttribute('type') ?? '').toLowerCase();
      return !['application/ld+json', 'application/json', 'importmap'].includes(type);
    });
    const scriptAlternatives: JourneyScriptAlternativeObservation[] = scriptElements.slice(0, 50).map((element) => {
      const sibling = element.nextElementSibling?.tagName.toLowerCase() === 'noscript'
        ? element.nextElementSibling
        : element.previousElementSibling?.tagName.toLowerCase() === 'noscript'
          ? element.previousElementSibling
          : null;
      const alternative = sibling?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 500) || null;
      const alternativeSelector = sibling ? getUniqueSelector(sibling) : null;
      return {
        selector: getUniqueSelector(element),
        alternativeSelector,
        alternative,
        detail: alternative
          ? `alternative candidate observée dans ${alternativeSelector}`
          : 'aucune alternative noscript adjacente observée',
      };
    });
    const disclosureSignals = Array.from(document.querySelectorAll('[aria-expanded], details')).map((element) => {
      const kind: JourneyDisclosureObservation['kind'] = element.tagName.toLowerCase() === 'details'
        ? 'details'
        : 'aria-expanded';
      const expanded = element.getAttribute('aria-expanded');
      const open = element.tagName.toLowerCase() === 'details'
        ? element.hasAttribute('open')
        : expanded === 'true';
      const controlled = (element.getAttribute('aria-controls') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id))
        .filter((target): target is HTMLElement => target instanceof HTMLElement);
      const controlledState = controlled
        .map((target) => `${getUniqueSelector(target)}=${visible(target) ? 'visible' : 'hidden'}`)
        .join(', ');
      const selector = getUniqueSelector(element);
      return {
        kind,
        selector,
        state: `expanded=${expanded ?? (open ? 'true' : 'false')};visible=${visible(element)};controlled=${controlledState}`,
        detail: `${kind === 'details' ? `open=${open}` : `aria-expanded=${expanded ?? 'absent'}`}${controlledState ? `; contrôles : ${controlledState}` : ''}`,
      };
    });
    const selectorForReference = (element: Element): string => getUniqueSelector(element);
    const isFocusable = (element: Element): boolean => {
      if (element.matches('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')) return true;
      return element.getAttribute('tabindex') !== null;
    };
    const additionalContentSignals = Array.from(document.querySelectorAll('[aria-describedby], [aria-details], [popover], [role="tooltip"], [data-tooltip]')).flatMap((element) => {
      const refs = [
        ...(element.getAttribute('aria-describedby') ?? '').split(/\s+/),
        ...(element.getAttribute('aria-details') ?? '').split(/\s+/),
      ].filter(Boolean).map((id) => document.getElementById(id)).filter((target): target is HTMLElement => Boolean(target));
      const popover = element.matches('[popover]') ? element : null;
      const targets: Element[] = [...refs, ...(popover ? [popover] : [])];
      return targets.map((target) => {
        const trigger = element.matches(':focus, :focus-within') ? 'focus' as const
          : element.matches('[aria-expanded="true"], [aria-pressed="true"]') ? 'activation' as const
            : element.hasAttribute('title') || element.hasAttribute('data-tooltip') ? 'hover' as const : 'unknown' as const;
        const targetVisible = visible(target);
        return {
          selector: selectorForReference(target),
          trigger,
          state: `visible=${targetVisible};focusable=${isFocusable(target)}`,
          detail: `déclencheur=${selectorForReference(element)}; contenu=${targetVisible ? 'visible' : 'masqué'}; clavier=${isFocusable(target) ? 'atteignable' : 'à vérifier'}`,
        };
      });
    });
    const timeLimits: JourneyTimeLimitObservation[] = [
      ...timers.map((timer) => ({
        kind: 'timer' as const,
        selector: 'window',
        detail: `${timer.kind} enregistré avec un délai de ${timer.delay} ms`,
      })),
      ...Array.from(document.querySelectorAll('meta[http-equiv]')).filter((element) => (
        (element.getAttribute('http-equiv') ?? '').toLowerCase() === 'refresh'
      )).map((element) => ({
        kind: 'meta-refresh' as const,
        selector: selectorForReference(element),
        detail: `http-equiv=refresh; content=${element.getAttribute('content') ?? ''}`,
      })),
      ...Array.from(document.querySelectorAll('[role="timer"], [data-time-limit], [data-countdown]')).map((element) => ({
        kind: 'countdown' as const,
        selector: selectorForReference(element),
        detail: `contenu=${(element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)}`,
      })),
    ];
    const newWindows: JourneyNewWindowObservation[] = [
      ...windowOpens.map((opening) => ({
        kind: 'window-open' as const,
        selector: 'window.open',
        detail: `url=${opening.url.slice(0, 240)}; target=${opening.target || 'absent'}`,
      })),
      ...Array.from(document.querySelectorAll('a[target="_blank"], area[target="_blank"]')).map((element) => ({
        kind: 'target-blank' as const,
        selector: selectorForReference(element),
        detail: `href=${(element.getAttribute('href') ?? '').slice(0, 240)}; avertissement=${Boolean((element.textContent ?? '').match(/nouvelle fenêtre|nouvel onglet|new window|new tab/i) || element.getAttribute('aria-label')?.match(/nouvelle fenêtre|nouvel onglet|new window|new tab/i) || element.getAttribute('title')?.match(/nouvelle fenêtre|nouvel onglet|new window|new tab/i)) ? 'observé' : 'non observé'}`,
      })),
    ];
    const crypticPattern = /(?:[\u{1F300}-\u{1FAFF}]|(?:^|\s)[!?;:()<>/\\|*_+=~#@$%^&-]{2,}(?:\s|$))/u;
    const crypticContent = Array.from(document.querySelectorAll('pre, code, [role="img"], [aria-label], [title]')).flatMap((element) => {
      const content = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (!content || !crypticPattern.test(content)) return [];
      const alternative = element.getAttribute('aria-label')?.trim()
        || element.getAttribute('title')?.trim()
        || (element.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').filter(Boolean).join(' ')
        || null;
      return [{
        selector: selectorForReference(element),
        content,
        alternative,
        detail: alternative ? `alternative observée=${alternative.slice(0, 160)}` : 'aucune alternative textuelle observée',
      }];
    }).slice(0, 50);
    const animationControls: JourneyAnimationControlObservation[] = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], summary')).flatMap((element) => {
      if (!visible(element)) return [];
      const label = (element.getAttribute('aria-label')
        || element.getAttribute('title')
        || (element instanceof HTMLInputElement ? element.value : '')
        || element.textContent
        || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      if (!label) return [];
      const kind = /pause|mettre en pause|paus/i.test(label) ? 'pause' as const
        : /stop|arr[eê]t|arrêter|arr[êe]ter/i.test(label) ? 'stop' as const
          : /hide|masqu|cacher/i.test(label) ? 'hide' as const : null;
      if (!kind) return [];
      const selector = getUniqueSelector(element);
      const controlled = (element.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean).join(', ');
      return [{
        selector,
        kind,
        label,
        detail: controlled ? `contrôle candidat ; aria-controls=${controlled}` : 'contrôle candidat ; suffisance à vérifier',
        criterionIds: ['13.8'],
        requiresHumanReview: true,
      } satisfies JourneyAnimationControlObservation];
    }).slice(0, 50);
    return {
      dialogs: Array.from(document.querySelectorAll('[role="dialog"], dialog'))
        .filter(visible)
        .map(getUniqueSelector)
        .slice(0, 20),
      liveRegions: Array.from(document.querySelectorAll('[aria-live]'))
        .filter(visible)
        .map((element) => `${getUniqueSelector(element)}:${(element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)}`)
        .slice(0, 20),
      disclosures: disclosureSignals.slice(0, 50),
      additionalContent: additionalContentSignals.slice(0, 50),
      timeLimits: timeLimits.slice(0, 50),
      newWindows: newWindows.slice(0, 50),
      crypticContent,
      animationControls,
      scriptAlternatives,
      scriptControls,
      disruptions,
      interactions,
    };
  }).then((signals) => ({ url, title, ...signals }));
}

function buildContextObservation(
  step: JourneyStep,
  before: JourneyContextSignals,
  after: JourneyContextSignals,
  includeInitialScriptAlternatives = false,
): JourneyContextObservation {
  const changeTypes: JourneyContextObservation['changeTypes'] = [];
  if (before.url !== after.url) changeTypes.push('navigation');
  if (before.title !== after.title) changeTypes.push('title');
  if (before.dialogs.join('|') !== after.dialogs.join('|')) changeTypes.push('dialog');
  if (before.liveRegions.join('|') !== after.liveRegions.join('|')) changeTypes.push('live-region');
  const beforeDisclosures = new Map(before.disclosures.map((item) => [item.selector, item.state]));
  const disclosures = after.disclosures
    .filter((item) => beforeDisclosures.get(item.selector) !== item.state)
    .map((item) => ({ kind: item.kind, selector: item.selector, detail: item.detail }));
  if (disclosures.length > 0) changeTypes.push('disclosure');
  const beforeAdditionalContent = new Map(before.additionalContent.map((item) => [item.selector, item.state]));
  const additionalContent = after.additionalContent
    .filter((item) => beforeAdditionalContent.get(item.selector) !== item.state)
    .map((item) => ({ selector: item.selector, trigger: item.trigger, detail: item.detail }));
  if (additionalContent.length > 0) changeTypes.push('additional-content');
  const beforeTimeLimits = new Map(before.timeLimits.map((item) => [`${item.kind}|${item.selector}`, item.detail]));
  const timeLimits = after.timeLimits.filter((item) => (
    beforeTimeLimits.get(`${item.kind}|${item.selector}`) !== item.detail
  ));
  if (timeLimits.length > 0) changeTypes.push('time-limit');
  const beforeWindows = new Set(before.newWindows.map((item) => `${item.kind}|${item.selector}|${item.detail}`));
  const newWindows = after.newWindows.filter((item) => (
    !beforeWindows.has(`${item.kind}|${item.selector}|${item.detail}`)
      || (item.kind === 'target-blank' && item.selector === step.selector)
  ));
  if (newWindows.length > 0) changeTypes.push('new-window');
  const beforeCrypticContent = new Map(before.crypticContent.map((item) => [item.selector, `${item.content}|${item.alternative ?? ''}`]));
  const crypticContent = after.crypticContent.filter((item) => (
    beforeCrypticContent.get(item.selector) !== `${item.content}|${item.alternative ?? ''}`
  ));
  if (crypticContent.length > 0) changeTypes.push('cryptic-content');
  const beforeAnimationControls = new Map(before.animationControls.map((item) => [item.selector, `${item.kind}|${item.label}`]));
  const animationControls = after.animationControls;
  const changedAnimationControls = animationControls.filter((item) => (
    beforeAnimationControls.get(item.selector) !== `${item.kind}|${item.label}`
  ));
  if (changedAnimationControls.length > 0) changeTypes.push('animation-control');
  const beforeScriptAlternatives = new Map(before.scriptAlternatives.map((item) => [item.selector, `${item.alternativeSelector ?? ''}|${item.alternative ?? ''}`]));
  const scriptAlternatives = after.scriptAlternatives.filter((item) => (
    includeInitialScriptAlternatives
      || beforeScriptAlternatives.get(item.selector) !== `${item.alternativeSelector ?? ''}|${item.alternative ?? ''}`
  ));
  if (scriptAlternatives.length > 0) changeTypes.push('script-alternative');
  const scriptControls = after.scriptControls;
  if (scriptControls.length > 0) changeTypes.push('script-control');
  const beforeDisruptions = new Map(before.disruptions.map((item) => [`${item.kind}|${item.selector}`, item.detail]));
  const disruptions = after.disruptions.filter((item) => (
    beforeDisruptions.get(`${item.kind}|${item.selector}`) !== item.detail
  ));
  if (disruptions.length > 0) changeTypes.push('disruption');
  const criterionIds = new Set<string>();
  if (changeTypes.some((type) => ['navigation', 'title', 'dialog'].includes(type))) criterionIds.add('7.4');
  if (changeTypes.includes('live-region')) criterionIds.add('7.5');
  if (changeTypes.includes('disclosure')) criterionIds.add('10.13');
  if (changeTypes.includes('additional-content')) criterionIds.add('12.11');
  if (changeTypes.includes('time-limit')) criterionIds.add('13.1');
  if (changeTypes.includes('new-window')) criterionIds.add('13.2');
  if (changeTypes.includes('cryptic-content')) {
    criterionIds.add('13.5');
    if (crypticContent.some((item) => item.alternative)) criterionIds.add('13.6');
  }
  if (changeTypes.includes('script-alternative')) criterionIds.add('7.2');
  if (changeTypes.includes('script-control')) criterionIds.add('7.3');
  for (const disruption of disruptions) {
    if (disruption.kind === 'sound') criterionIds.add('4.10');
    if (disruption.kind === 'motion') criterionIds.add('13.8');
    if (disruption.kind === 'flash') criterionIds.add('13.7');
  }
  if (animationControls.length > 0) criterionIds.add('13.8');
  const interactions = after.interactions;
  for (const interaction of interactions) {
    interaction.criterionIds.forEach((criterionId) => criterionIds.add(criterionId));
  }
  return {
    trigger: {
      stepId: step.id,
      action: step.action,
      ...(step.selector ? { selector: step.selector } : {}),
      ...(step.key ? { key: step.key } : {}),
    },
    urlBefore: before.url,
    urlAfter: after.url,
    titleBefore: before.title,
    titleAfter: after.title,
    changed: changeTypes.length > 0,
    changeTypes,
    disruptions,
    disclosures,
    additionalContent,
    timeLimits,
    newWindows,
    crypticContent,
    animationControls,
    scriptAlternatives,
    scriptControls,
    interactions,
    criterionIds: [...criterionIds],
    requiresHumanReview: true,
  };
}

async function captureContextScreenshot(
  page: Page,
  directory: string,
  stepId: string,
  stepIndex: number,
): Promise<{ path?: string; reason: 'too_large' | 'capture_error' }> {
  try {
    await mkdir(directory, { recursive: true });
    const safeStepId = stepId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'step';
    const screenshotPath = `${directory}/${String(stepIndex).padStart(3, '0')}-${safeStepId}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 5_000 });
    const stats = await stat(screenshotPath);
    if (stats.size > MAX_CONTEXT_SCREENSHOT_BYTES) {
      await unlink(screenshotPath).catch(() => undefined);
      return { reason: 'too_large' };
    }
    return { path: screenshotPath, reason: 'capture_error' };
  } catch {
    return { reason: 'capture_error' };
  }
}

function buildKeyboardObservation(
  step: JourneyStep,
  before: JourneyFocusTarget | null,
  after: JourneyFocusTarget | null,
  focusHistory: string[],
  viewport: { width: number; height: number } | null,
): JourneyKeyboardObservation {
  const componentSelector = step.selector!;
  const key = step.key!;
  const isTabNavigation = /^(shift\+)?tab$/i.test(key.replace(/\s+/g, ''));
  const focusChanged = before?.selector !== after?.selector;
  const isRepeatedCycle = Boolean(
    after?.selector
      && focusHistory.length >= 2
      && focusHistory[focusHistory.length - 2] === after.selector,
  );
  const blocked = isTabNavigation && (
    (!focusChanged && (before !== null || after !== null))
      || (!before && !after)
      || isRepeatedCycle
  );

  if (after) focusHistory.push(after.selector);
  if (focusHistory.length > 12) focusHistory.splice(0, focusHistory.length - 12);

  return {
    key,
    componentSelector,
    before,
    after,
    entered: Boolean(after?.withinComponent && !before?.withinComponent),
    exited: Boolean(before?.withinComponent && !after?.withinComponent),
    focusVisible: after?.focusVisible ?? false,
    blocked,
    criterionIds: [
      ...(blocked ? ['7.3', '12.9'] : []),
      ...(after && !after.focusVisible ? ['10.7'] : []),
    ],
    viewport,
    requiresHumanReview: true,
  };
}

async function captureFocus(page: Page, componentSelector: string): Promise<JourneyFocusTarget | null> {
  return page.evaluate((targetSelector) => {
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return null;

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

    let component: Element | null = null;
    try {
      component = document.querySelector(targetSelector);
    } catch {
      component = null;
    }
    const style = window.getComputedStyle(active as Element);
    const hasVisibleOutline = style.outlineStyle !== 'none'
      && style.outlineWidth !== '0px'
      && style.outlineColor !== 'transparent';
    const hasVisibleShadow = style.boxShadow !== 'none';
    let focusVisible = hasVisibleOutline || hasVisibleShadow;
    try {
      focusVisible = focusVisible || active.matches(':focus-visible');
    } catch {
      // Older engines may not implement :focus-visible.
    }

    return {
      selector: getUniqueSelector(active),
      tagName: active.tagName.toLowerCase(),
      role: active.getAttribute('role'),
      text: (active.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || null,
      withinComponent: Boolean(component && (component === active || component.contains(active))),
      focusVisible,
    };
  }, componentSelector);
}

async function applyStep(page: Page, step: JourneyStep, timeout: number): Promise<void> {
  switch (step.action) {
    case 'navigate':
      if (!step.url) throw new Error('Étape navigate invalide : URL absente.');
      await page.goto(step.url, { waitUntil: 'networkidle', timeout });
      return;
    case 'click':
      if (!step.selector) throw new Error('Étape click invalide : sélecteur absent.');
      await page.locator(step.selector).click({ timeout });
      await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
      return;
    case 'fill':
      if (!step.selector) throw new Error('Étape fill invalide : sélecteur absent.');
      if (step.sensitive && step.value === undefined) {
        throw new Error('Valeur sensible indisponible pour cette exécution.');
      }
      await page.locator(step.selector).fill(step.value ?? '', { timeout });
      await settleAfterInteraction(page);
      return;
    case 'press':
      if (!step.selector || !step.key) throw new Error('Étape press invalide : sélecteur ou touche absente.');
      await page.locator(step.selector).press(step.key, { timeout });
      await settleAfterInteraction(page);
      return;
    case 'wait':
      await page.waitForTimeout(Math.min(Math.max(step.waitMs ?? 250, 0), 30_000));
      return;
  }
}

function mapCriteriaForEvidence(result: PageResult, url: string): Array<{ rgaaId: string; selector: string; elementIndex?: number }> {
  const mapped = mapPageResults(result.axeResults, result.collectedData, url, result.heuristicResults);
  return mapped.criteria.flatMap((criterion) => criterion.elements.map((element) => ({
    rgaaId: criterion.rgaaId,
    selector: element.selector,
    ...(element.elementIndex !== undefined ? { elementIndex: element.elementIndex } : {}),
  })));
}

async function settleAfterInteraction(page: Page): Promise<void> {
  await Promise.race([
    page.waitForLoadState('networkidle').catch(() => undefined),
    page.waitForTimeout(250),
  ]);
}

async function collectStepEvidence(
  page: Page,
  selector: string,
  resultId: string,
  mappedCriteria: Array<{ rgaaId: string; selector: string; elementIndex?: number }>,
): Promise<JourneyEvidence[]> {
  return page.evaluate(({ target, criteria }) => {
    let elements: Element[] = [];
    try {
      elements = Array.from(document.querySelectorAll(target));
    } catch {
      return [];
    }
    return elements.slice(0, 20).map((element, elementIndex) => {
      const clone = element.cloneNode(true) as Element;
      const fields = [clone, ...Array.from(clone.querySelectorAll('input, textarea, select'))];
      for (const field of fields) {
        if (field.matches('input, textarea, select')) {
          field.removeAttribute('value');
          field.setAttribute('data-rgaudit-redacted', 'true');
          if ('value' in field) (field as HTMLInputElement).value = '[redacted]';
        }
      }
      const parent = element.parentElement ?? element;
      const context = (parent.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      const criterionIds = criteria.flatMap((criterion) => {
        try {
          return element.matches(criterion.selector) && (
            criterion.selector !== target
              || criterion.elementIndex === undefined
              || criterion.elementIndex === elementIndex
          ) ? [criterion.rgaaId] : [];
        } catch {
          return [];
        }
      });
      return {
        selector: target,
        html: clone.outerHTML.slice(0, 2_000),
        elementIndex,
        criterionIds,
        ...(context ? { context } : {}),
      };
    });
  }, { target: selector, criteria: mappedCriteria }).then((items) => items.map((item) => ({
    ...item,
    html: item.html.slice(0, MAX_EVIDENCE_LENGTH),
    resultId,
    proofId: `${resultId}-proof-${item.elementIndex}`,
  })));
}
