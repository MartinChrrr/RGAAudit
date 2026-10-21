import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright';
import type { NodeResult } from 'axe-core';
import type {
  AuditEngine,
  AnalyzeResult,
  AxeViolation,
  AxePass,
  AxeIncomplete,
  AxeElement,
  EngineConfig,
} from './engine.interface';

const DEFAULT_TIMEOUT = 30_000;

// axe-core excludes experimental/best-practice rules from its default run.
// These rules are mapped to deterministic RGAA signals in the current lot,
// so they must be explicitly enabled while preserving the regular rule set.
const ENABLED_DETERMINISTIC_RULES = [
  'td-headers-attr',
  'scope-attr-valid',
  'table-fake-caption',
  'link-in-text-block',
  'avoid-inline-spacing',
  'skip-link',
  'css-orientation-lock',
  'bypass',
] as const;

function flattenTarget(target: NodeResult['target']): string[] {
  return target.map((selector) =>
    Array.isArray(selector) ? selector.join(' > ') : String(selector)
  );
}

function extractCheckData(node: NodeResult): Record<string, unknown> | undefined {
  // axe-core puts detailed data (e.g. contrast ratios) inside CheckResult
  // objects in node.any / node.all / node.none arrays.
  const checks = [...(node.any ?? []), ...(node.all ?? []), ...(node.none ?? [])];
  for (const check of checks) {
    if (check.data && typeof check.data === 'object') {
      return check.data as Record<string, unknown>;
    }
  }
  return undefined;
}

const MAX_CONTEXT_LENGTH = 2_000;

interface DomEvidence {
  context?: string;
  elementIndex?: number;
}

export async function collectDomEvidence(page: Page, target: string[], expectedHtml: string): Promise<DomEvidence> {
  if (target.length === 0) return {};

  try {
    return await page.evaluate(({ selectors, expected }) => {
      const normalizeHtml = (html: string) => html.replace(/\s+/g, ' ').trim();
      const normalizedExpected = normalizeHtml(expected);
      for (const selector of selectors) {
        let matches: Element[];
        try {
          matches = Array.from(document.querySelectorAll(selector));
        } catch {
          continue;
        }
        const matchingIndexes = matches
          .map((candidate, index) => normalizeHtml(candidate.outerHTML) === normalizedExpected ? index : -1)
          .filter((index) => index >= 0);
        const elementIndex = matchingIndexes.length === 1
          ? matchingIndexes[0]
          : matches.length === 1
            ? 0
            : -1;
        const element = elementIndex >= 0 ? matches[elementIndex] : null;
        if (!element) continue;

        const parent = element.parentElement ?? element;
        const parentHtml = parent.outerHTML.slice(0, 2_000);
        const text = (parent.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
        const context = text
          ? `Parent HTML: ${parentHtml}\nParent text: ${text}`
          : `Parent HTML: ${parentHtml}`;
        return { context, elementIndex };
      }
      return {};
    }, { selectors: target, expected: expectedHtml });
  } catch {
    // Evidence must never make an otherwise valid axe run fail.
    return {};
  }
}

async function mapElements(nodes: NodeResult[], page?: Page): Promise<AxeElement[]> {
  return Promise.all(nodes.map(async (node) => {
    const checkData = extractCheckData(node);
    const target = flattenTarget(node.target);
    const domEvidence = page ? await collectDomEvidence(page, target, node.html) : {};
    return {
      html: node.html,
      target,
      ...(node.failureSummary ? { failureSummary: node.failureSummary } : {}),
      ...(checkData ? { data: checkData } : {}),
      ...(domEvidence.context ? { context: domEvidence.context.slice(0, MAX_CONTEXT_LENGTH) } : {}),
      ...(domEvidence.elementIndex !== undefined ? { elementIndex: domEvidence.elementIndex } : {}),
    };
  }));
}

export class AxeCoreAdapter implements AuditEngine {
  private readonly timeout: number;
  private readonly disableRules: string[];

  constructor(config?: EngineConfig) {
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this.disableRules = config?.disableRules ?? [];
  }

  async analyze(page: Page): Promise<AnalyzeResult> {
    try {
      const ruleOptions = Object.fromEntries([
        ...ENABLED_DETERMINISTIC_RULES.map((rule) => [rule, { enabled: true }] as const),
        ...this.disableRules.map((rule) => [rule, { enabled: false }] as const),
      ]);
      const builder = new AxeBuilder({ page }).options({ rules: ruleOptions });

      const axeResults = await Promise.race([
        builder.analyze(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('axe-core timeout')), this.timeout)
        ),
      ]);

      const violations: AxeViolation[] = await Promise.all(axeResults.violations.map(async (v) => ({
        rule: v.id,
        impact: v.impact as AxeViolation['impact'],
        description: v.description,
        helpUrl: v.helpUrl,
        elements: await mapElements(v.nodes, page),
      })));

      const passes: AxePass[] = await Promise.all(axeResults.passes.map(async (p) => ({
        rule: p.id,
        description: p.description,
        elements: await mapElements(p.nodes),
      })));

      const incomplete: AxeIncomplete[] = await Promise.all(axeResults.incomplete.map(async (i) => ({
        rule: i.id,
        impact: i.impact as AxeIncomplete['impact'],
        description: i.description,
        elements: await mapElements(i.nodes, page),
      })));

      return { violations, passes, incomplete };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }
}
