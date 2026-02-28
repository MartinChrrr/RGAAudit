import { describe, it, expect } from 'vitest';
import { name } from '../index';

describe('rgaaudit CLI', () => {
  it('should be defined', () => {
    expect(name).toBe('rgaaudit');
  });
});
