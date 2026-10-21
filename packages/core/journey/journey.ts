import { chromium, type BrowserContext, type Page } from 'playwright';
import { randomUUID } from 'node:crypto';
import { analyzeLoadedPage, type PageResult } from '../analyzer/analyzer';
import { mapPageResults } from '../mapping/mapper';

export const JOURNEY_ACTIONS = ['navigate', 'click', 'fill', 'press', 'wait'] as const;
export type JourneyAction = typeof JOURNEY_ACTIONS[number];

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
  /** Keyboard and focus heuristics never replace a human RGAA decision. */
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
  result: PageResult | null;
  error?: string;
}

export interface JourneyRun {
  runId: string;
  journeyId: string;
  startedAt: string;
  finishedAt: string;
  steps: JourneyStepObservation[];
}

export interface JourneyRunState {
  runId: string;
  journeyId: string;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
  startedAt: string;
  finishedAt?: string;
  run?: JourneyRun;
  error?: string;
}

export interface JourneyRunOptions {
  runId?: string;
  sessionId?: string;
  timeout?: number;
  isRequestAllowed?: (url: string) => Promise<boolean>;
}

const MAX_EVIDENCE_LENGTH = 2_000;

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
    await page.goto(journey.startUrl, { waitUntil: 'networkidle', timeout: options.timeout ?? 30_000 });
    const steps: JourneyStepObservation[] = [];
    const focusHistory: string[] = [];
    let previousUrl = page.url();
    for (const step of journey.steps) {
      const observedAt = new Date().toISOString();
      try {
        const urlBeforeStep = page.url();
        if (urlBeforeStep !== previousUrl || step.action === 'navigate') focusHistory.length = 0;
        const beforeFocus = step.action === 'press' && step.selector
          ? await captureFocus(page, step.selector)
          : null;
        await applyStep(page, step, options.timeout ?? 30_000);
        const afterFocus = step.action === 'press' && step.selector
          ? await captureFocus(page, step.selector)
          : null;
        const url = page.url();
        if (url !== urlBeforeStep) focusHistory.length = 0;
        previousUrl = url;
        const result = await analyzeLoadedPage(page, url, sessionId, { timeout: options.timeout });
        const resultId = `journey-result-${runId}-${step.id}`;
        const mappedCriteria = mapCriteriaForEvidence(result, url);
        const evidence = step.selector
          ? await collectStepEvidence(page, step.selector, resultId, mappedCriteria)
          : [];
        const keyboard = step.action === 'press' && step.selector && step.key
          ? buildKeyboardObservation(step, beforeFocus, afterFocus, focusHistory)
          : undefined;
        steps.push({
          stepId: step.id,
          action: step.action,
          url,
          observedAt,
          title: await page.title(),
          evidence,
          ...(keyboard ? { keyboard } : {}),
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

function buildKeyboardObservation(
  step: JourneyStep,
  before: JourneyFocusTarget | null,
  after: JourneyFocusTarget | null,
  focusHistory: string[],
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
