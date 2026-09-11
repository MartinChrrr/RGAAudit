import { afterEach, describe, expect, it } from 'vitest';
import { isAllowedAuditUrl } from '../url.policy';

afterEach(() => {
  delete process.env.RGAAUDIT_ALLOW_PRIVATE_NETWORKS;
});

describe('isAllowedAuditUrl', () => {
  it('accepte une URL web publique', () => {
    expect(isAllowedAuditUrl('https://example.com/page')).toBe(true);
  });

  it('refuse les protocoles non web et les identifiants intégrés', () => {
    expect(isAllowedAuditUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedAuditUrl('https://user:secret@example.com')).toBe(false);
  });

  it('refuse localhost et les adresses privées', () => {
    expect(isAllowedAuditUrl('http://localhost:3000')).toBe(false);
    expect(isAllowedAuditUrl('http://127.0.0.1')).toBe(false);
    expect(isAllowedAuditUrl('http://192.168.1.2')).toBe(false);
    expect(isAllowedAuditUrl('http://[::1]')).toBe(false);
  });

  it('peut autoriser explicitement le réseau local pour la CLI', () => {
    process.env.RGAAUDIT_ALLOW_PRIVATE_NETWORKS = 'true';
    expect(isAllowedAuditUrl('http://localhost:3000')).toBe(true);
  });
});
