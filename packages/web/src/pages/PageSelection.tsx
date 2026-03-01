import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { t } from '../locales';

interface LocationState {
  urls: string[];
  siteUrl: string;
}

export default function PageSelection() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [urls, setUrls] = useState<string[]>(state?.urls ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set(state?.urls ?? []));
  const [manualUrl, setManualUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const MAX_PAGES = 50;

  function toggleUrl(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(urls));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function handleAddUrl(e: FormEvent) {
    e.preventDefault();
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    if (!urls.includes(trimmed)) {
      setUrls((prev) => [...prev, trimmed]);
      setSelected((prev) => new Set([...prev, trimmed]));
    }
    setManualUrl('');
  }

  async function handleStartAudit() {
    const selectedUrls = urls.filter((u) => selected.has(u));
    if (selectedUrls.length === 0 || selectedUrls.length > MAX_PAGES) return;

    setLoading(true);
    try {
      const res = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: selectedUrls }),
      });

      if (!res.ok) return;

      const data = await res.json();
      navigate(`/progress/${data.sessionId}`);
    } finally {
      setLoading(false);
    }
  }

  const selectedCount = selected.size;
  const tooMany = selectedCount > MAX_PAGES;

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('pageSelection.heading')}</h1>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              {t('pageSelection.selectAll')}
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              {t('pageSelection.deselectAll')}
            </button>
            <span className="ml-auto text-sm text-gray-600" aria-live="polite">
              {t('pageSelection.selectedCount', { count: selectedCount })}
            </span>
          </div>

          {tooMany && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {t('pageSelection.tooManyPages')}
            </div>
          )}

          {/* URL list */}
          {urls.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('pageSelection.noPages')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {urls.map((url) => (
                <li key={url} className="flex items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(url)}
                    onChange={() => toggleUrl(url)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    aria-label={url}
                  />
                  <span className="text-sm text-gray-700 truncate">{url}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Add URL */}
          <form onSubmit={handleAddUrl} className="mt-4 flex gap-3">
            <label htmlFor="add-url" className="sr-only">{t('pageSelection.addUrlLabel')}</label>
            <input
              id="add-url"
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder={t('pageSelection.addUrlPlaceholder')}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              {t('pageSelection.addButton')}
            </button>
          </form>
        </div>

        {/* Action */}
        <button
          type="button"
          onClick={handleStartAudit}
          disabled={selectedCount === 0 || tooMany || loading}
          className="w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t('pageSelection.startAudit')}
        </button>
      </div>
    </main>
  );
}
