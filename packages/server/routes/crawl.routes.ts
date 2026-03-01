import { Router, type Request, type Response } from 'express';
import { parseSitemap } from '@rgaaudit/core/crawler/sitemap.parser';

export const crawlRouter = Router();

crawlRouter.post('/api/crawl', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Le champ "url" est requis.' });
    return;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    res.status(400).json({ error: 'L\'URL doit commencer par http:// ou https://.' });
    return;
  }

  try {
    const result = await parseSitemap(url, { timeout: 30_000 });
    res.json({
      urls: result.urls,
      count: result.count,
      source: result.source,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
