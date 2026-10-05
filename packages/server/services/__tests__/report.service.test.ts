import { describe, expect, it } from 'vitest';
import { formatContrastRatio } from '../report.service';

describe('formatContrastRatio', () => {
  it.each([
    [2.71, '2.71:1'],
    ['4.5', '4.5:1'],
    ['4.5:1', '4.5:1'],
    ['4.5:1:1', '4.5:1'],
  ])('normalise %s en %s', (value, expected) => {
    expect(formatContrastRatio(value)).toBe(expected);
  });
});
