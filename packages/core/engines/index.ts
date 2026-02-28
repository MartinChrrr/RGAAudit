import { AxeCoreAdapter } from './axe-core.adapter';
import type { AuditEngine, EngineConfig } from './engine.interface';

export type { AuditEngine, EngineConfig, AnalyzeResult, EngineResult, EngineError } from './engine.interface';
export type { AxeViolation, AxePass, AxeIncomplete, AxeElement } from './engine.interface';

export function getEngine(config?: EngineConfig): AuditEngine {
  return new AxeCoreAdapter(config);
}
