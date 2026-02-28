import { describe, it, expect } from 'vitest';
import { name } from '../index';

describe('@rgaaudit/server', () => {
  it('should be defined', () => {
    expect(name).toBe('@rgaaudit/server');
  });
});
