import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { t } from '../locales';

type PageStatus = 'pending' | 'running' | 'done' | 'error';

interface PageState {
  url: string;
  status: PageStatus;
  error?: string;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AuditProgress() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [pages, setPages] = useState<PageState[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [auditDone, setAuditDone] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`/api/audit/progress/${sessionId}`);
    eventSourceRef.current = es;

    es.addEventListener('page_start', (e) => {
      const data = JSON.parse(e.data);
      setPages((prev) => {
        const existing = prev.find((p) => p.url === data.url);
        if (existing) {
          return prev.map((p) => p.url === data.url ? { ...p, status: 'running' } : p);
        }
        const next = [...prev, { url: data.url, status: 'running' as const }];
        setTotal(next.length);
        return next;
      });
    });

    es.addEventListener('page_complete', (e) => {
      const data = JSON.parse(e.data);
      setPages((prev) =>
        prev.map((p) => p.url === data.url ? { ...p, status: 'done' } : p),
      );
      setCompleted((prev) => prev + 1);
    });

    es.addEventListener('page_error', (e) => {
      const data = JSON.parse(e.data);
      setPages((prev) =>
        prev.map((p) => p.url === data.url ? { ...p, status: 'error', error: data.error } : p),
      );
      setCompleted((prev) => prev + 1);
    });

    es.addEventListener('audit_complete', () => {
      setAuditDone(true);
      es.close();
    });

    es.onerror = () => {
      setConnectionError(true);
      es.close();
    };

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      es.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId]);

  useEffect(() => {
    if (auditDone && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [auditDone]);

  async function handleCancel() {
    if (!sessionId) return;
    await fetch(`/api/audit/${sessionId}`, { method: 'DELETE' });
    eventSourceRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);
    setAuditDone(true);
  }

  function statusIcon(status: PageStatus) {
    switch (status) {
      case 'pending': return <span aria-label={t('auditProgress.statusPending')}>&#x23F3;</span>;
      case 'running': return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" role="status" aria-label={t('auditProgress.statusRunning')} />;
      case 'done': return <span aria-label={t('auditProgress.statusDone')}>&#x2705;</span>;
      case 'error': return <span aria-label={t('auditProgress.statusError')}>&#x274C;</span>;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auditProgress.heading')}</h1>

        {/* Progress bar */}
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <span>{t('auditProgress.progress', { completed, total: total || pages.length })}</span>
          <span>{t('auditProgress.elapsed', { time: formatElapsed(elapsed) })}</span>
        </div>

        {total > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((completed / total) * 100)}%` }}
              role="progressbar"
              aria-valuenow={completed}
              aria-valuemin={0}
              aria-valuemax={total}
            />
          </div>
        )}

        {connectionError && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {t('auditProgress.connectionError')}
          </div>
        )}

        {/* Page list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          {pages.length === 0 ? (
            <p className="text-sm text-gray-500">{t('auditProgress.statusPending')}</p>
          ) : (
            <ul className="space-y-2">
              {pages.map((page) => (
                <li key={page.url} className="flex items-center gap-3 py-2">
                  <span className="flex-shrink-0 w-6 text-center">{statusIcon(page.status)}</span>
                  <span className="text-sm text-gray-700 truncate flex-1">{page.url}</span>
                  {page.status === 'error' && page.error && (
                    <span
                      className="text-xs text-red-500 cursor-help"
                      title={page.error}
                    >
                      {t('auditProgress.statusError')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!auditDone && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-red-300 px-6 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              {t('auditProgress.cancelButton')}
            </button>
          )}
          {auditDone && sessionId && (
            <button
              type="button"
              onClick={() => navigate(`/results/${sessionId}`)}
              className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              {t('auditProgress.viewResults')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
