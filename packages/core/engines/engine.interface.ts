import type { Page } from 'playwright';

export interface AxeElement {
  html: string;
  target: string[];
  failureSummary?: string;
}

export interface AxeViolation {
  rule: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  helpUrl: string;
  elements: AxeElement[];
}

export interface AxePass {
  rule: string;
  description: string;
  elements: AxeElement[];
}

export interface AxeIncomplete {
  rule: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  elements: AxeElement[];
}

export interface EngineResult {
  violations: AxeViolation[];
  passes: AxePass[];
  incomplete: AxeIncomplete[];
  error?: undefined;
}

export interface EngineError {
  violations?: undefined;
  passes?: undefined;
  incomplete?: undefined;
  error: string;
}

export type AnalyzeResult = EngineResult | EngineError;

export interface EngineConfig {
  timeout?: number;
}

export interface AuditEngine {
  analyze(page: Page): Promise<AnalyzeResult>;
}
