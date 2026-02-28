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

function flattenTarget(target: NodeResult['target']): string[] {
  return target.map((selector) =>
    Array.isArray(selector) ? selector.join(' > ') : String(selector)
  );
}

function mapElements(nodes: NodeResult[]): AxeElement[] {
  return nodes.map((node) => ({
    html: node.html,
    target: flattenTarget(node.target),
    ...(node.failureSummary ? { failureSummary: node.failureSummary } : {}),
  }));
}

export class AxeCoreAdapter implements AuditEngine {
  private readonly timeout: number;

  constructor(config?: EngineConfig) {
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
  }

  async analyze(page: Page): Promise<AnalyzeResult> {
    try {
      const axeResults = await Promise.race([
        new AxeBuilder({ page }).analyze(),
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
