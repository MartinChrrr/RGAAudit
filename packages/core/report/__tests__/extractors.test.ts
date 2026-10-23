import { describe, expect, it } from 'vitest';
import { runReportExtractor } from '../extractors';

describe('runReportExtractor', () => {
  it('versionne l’extraction et limite une annexe trop volumineuse', () => {
    const result = runReportExtractor({
      id: 'fixture',
      version: 3,
      maxItems: 2,
      extract: () => ['a', 'b', 'c'],
    }, null);

    expect(result).toEqual({
      schemaVersion: 1,
      extractorId: 'fixture',
      extractorVersion: 3,
      items: ['a', 'b'],
      truncated: true,
    });
  });

  it('ne laisse pas une limite invalide désactiver la protection', () => {
    const result = runReportExtractor({
      id: 'fixture',
      version: 1,
      maxItems: 0,
      extract: () => ['a', 'b'],
    }, null);

    expect(result.items).toEqual(['a']);
    expect(result.truncated).toBe(true);
  });
});
