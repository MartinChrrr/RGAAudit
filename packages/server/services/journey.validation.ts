import { z } from 'zod';
import { JOURNEY_ACTIONS, type JourneyDefinition, type JourneyStep } from '../../core/journey/journey';
import { isAllowedAuditUrl } from '../security/url.policy';

const commonStepFields = {
  id: z.string().trim().min(1).max(100),
  action: z.enum(JOURNEY_ACTIONS),
  url: z.string().url().refine(isAllowedAuditUrl, 'URL publique http(s) invalide.').optional(),
  selector: z.string().trim().min(1).max(2_000).optional(),
  value: z.string().max(10_000).optional(),
  sensitive: z.boolean().optional(),
  secretRef: z.string().trim().min(1).max(128).optional(),
  key: z.string().trim().min(1).max(100).optional(),
  waitMs: z.number().int().min(0).max(30_000).optional(),
};

export const journeyStepInputSchema = z.object({
  ...commonStepFields,
  id: commonStepFields.id.optional(),
});

export const journeyInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  startUrl: z.string().url().refine(isAllowedAuditUrl, 'URL publique http(s) invalide.'),
  steps: z.array(journeyStepInputSchema).min(1).max(100),
});

export const journeyDefinitionSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  startUrl: z.string().url().refine(isAllowedAuditUrl, 'URL publique http(s) invalide.'),
  steps: z.array(z.object(commonStepFields)).min(1).max(100),
  createdAt: z.string().datetime(),
});

export function validateJourneySteps(steps: Array<Pick<JourneyStep, 'action' | 'url' | 'selector' | 'key'>>): string | null {
  for (const step of steps) {
    if (step.action === 'navigate' && !step.url) return 'Une étape navigate doit contenir une URL.';
    if ((step.action === 'click' || step.action === 'fill' || step.action === 'press') && !step.selector) {
      return `Une étape ${step.action} doit contenir un sélecteur.`;
    }
    if (step.action === 'press' && !step.key) return 'Une étape press doit contenir une touche.';
  }
  return null;
}

export function parseJourney(value: unknown): JourneyDefinition | null {
  const parsed = journeyDefinitionSchema.safeParse(value);
  if (!parsed.success) return null;
  if (validateJourneySteps(parsed.data.steps)) return null;
  return parsed.data as JourneyDefinition;
}

