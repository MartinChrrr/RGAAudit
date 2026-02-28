import { describe, it, expect } from 'vitest';
import { name } from '../index';

describe('@rgaaudit/core', () => {
  it('should be defined', () => {
    expect(name).toBe('@rgaaudit/core');
  });
});
