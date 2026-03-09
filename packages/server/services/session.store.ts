import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';

const SESSIONS_DIR = join(homedir(), '.rgaaudit', 'sessions');

export function getSessionPath(sessionId: string): string {
  return join(SESSIONS_DIR, `audit-${sessionId}.json`);
}

export async function loadSession(sessionId: string): Promise<SessionState | null> {
  try {
    const content = await readFile(getSessionPath(sessionId), 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch {
    return null;
  }
}
