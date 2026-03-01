import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuditProgress from '../pages/AuditProgress';

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

type EventSourceListener = (event: MessageEvent) => void;

class MockEventSource {
  static instance: MockEventSource | null = null;

  url: string;
  listeners = new Map<string, EventSourceListener[]>();
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instance = this;
  }

  addEventListener(type: string, listener: EventSourceListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener() {
    // no-op for tests
  }

  close() {
    // no-op for tests
  }

  // Test helper to simulate server events
  emit(type: string, data: unknown) {
    const listeners = this.listeners.get(type) ?? [];
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const listener of listeners) {
      listener(event);
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  MockEventSource.instance = null;
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderProgress(sessionId = 'test-session') {
  return render(
    <MemoryRouter initialEntries={[`/progress/${sessionId}`]}>
      <Routes>
        <Route path="/progress/:sessionId" element={<AuditProgress />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuditProgress', () => {
  it('événement SSE page_complete → statut de la page passe à ✅', async () => {
    renderProgress();

    const es = MockEventSource.instance!;
    expect(es).toBeDefined();
    expect(es.url).toBe('/api/audit/progress/test-session');

    // Simulate page_start
    act(() => {
      es.emit('page_start', { url: 'https://example.com/' });
    });

    await waitFor(() => {
      expect(screen.getByText('https://example.com/')).toBeInTheDocument();
    });

    // Simulate page_complete
    act(() => {
      es.emit('page_complete', { url: 'https://example.com/' });
    });

    await waitFor(() => {
      const listItem = screen.getByText('https://example.com/').closest('li');
      expect(listItem).toBeDefined();
      // Check for the ✅ indicator (done status)
      expect(listItem!.textContent).toContain('\u2705');
    });
  });

  it('affiche le bouton "Voir les résultats" après audit_complete', async () => {
    renderProgress();

    const es = MockEventSource.instance!;

    act(() => {
      es.emit('page_start', { url: 'https://example.com/' });
    });

    act(() => {
      es.emit('page_complete', { url: 'https://example.com/' });
    });

    act(() => {
      es.emit('audit_complete', { summary: {} });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /voir les résultats/i })).toBeInTheDocument();
    });
  });

  it('affiche le bouton "Annuler" pendant l\'audit', async () => {
    renderProgress();

    expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument();
  });
});
