import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../locales';

export default function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sitemapNotFound, setSitemapNotFound] = useState(false);

  function validate(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSitemapNotFound(false);

    if (!validate(url)) {
      setError(t('home.urlError'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(t('home.crawlError', { error: data.error ?? String(res.status) }));
        return;
      }

      const data = await res.json();

      if (data.source === 'not_found' || data.count === 0) {
        setSitemapNotFound(true);
        return;
      }

      navigate('/selection', { state: { urls: data.urls, siteUrl: url } });
    } catch (err) {
      setError(t('home.crawlError', { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setLoading(false);
    }
  }

  function handleContinueWithoutSitemap() {
    navigate('/selection', { state: { urls: [], siteUrl: url } });
  }

  function handleManualEntry() {
    navigate('/selection', { state: { urls: [], siteUrl: '' } });
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('app.title')}</h1>
          <p className="text-gray-600">{t('app.subtitle')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('home.heading')}
          </h2>
          <p className="text-sm text-gray-500 mb-6">{t('home.description')}</p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-1">
              {t('home.urlLabel')}
            </label>
            <input
              id="url-input"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); setSitemapNotFound(false); }}
              placeholder={t('home.urlPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={loading}
              aria-describedby={error ? 'url-error' : undefined}
              aria-invalid={error ? 'true' : undefined}
            />

            {error && (
              <p id="url-error" role="alert" className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={loading || !url}
                className="flex-1 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" role="status" aria-label={t('home.analyzing')} />
                    {t('home.analyzing')}
                  </span>
                ) : (
                  t('home.analyzeButton')
                )}
              </button>
              <button
                type="button"
                onClick={handleManualEntry}
                className="flex-1 rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                {t('home.manualEntry')}
              </button>
            </div>
          </form>

          {sitemapNotFound && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800 mb-3">{t('home.sitemapNotFound')}</p>
              <button
                type="button"
                onClick={handleContinueWithoutSitemap}
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors"
              >
                {t('home.continueWithoutSitemap')}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
