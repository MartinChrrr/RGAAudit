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

function mapElements(nodes: NodeResult[]): AxeElement[] {
  return nodes.map((node) => {
    const checkData = extractCheckData(node);
    return {
      html: node.html,
      target: flattenTarget(node.target),
      ...(node.failureSummary ? { failureSummary: node.failureSummary } : {}),
      ...(checkData ? { data: checkData } : {}),
    };
  });
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

      const violations: AxeViolation[] = axeResults.violations.map((v) => ({
        rule: v.id,
        impact: v.impact as AxeViolation['impact'],
        description: v.description,
        helpUrl: v.helpUrl,
        elements: mapElements(v.nodes),
      }));

      const passes: AxePass[] = axeResults.passes.map((p) => ({
        rule: p.id,
        description: p.description,
        elements: mapElements(p.nodes),
      }));

      const incomplete: AxeIncomplete[] = axeResults.incomplete.map((i) => ({
        rule: i.id,
        impact: i.impact as AxeIncomplete['impact'],
        description: i.description,
        elements: mapElements(i.nodes),
      }));

      return { violations, passes, incomplete };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }
}
