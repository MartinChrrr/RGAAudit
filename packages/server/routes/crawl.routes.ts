import { Router } from 'express';
import { parseSitemap } from '@rgaaudit/core/crawler/sitemap.parser';
import { asyncHandler, HttpError } from '../middleware/error.handler';

export const crawlRouter = Router();

crawlRouter.post('/api/crawl', asyncHandler(async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') {
    throw new HttpError(400, 'Le champ "url" est requis.');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new HttpError(400, 'L\'URL doit commencer par http:// ou https://.');
  }

  const result = await parseSitemap(url, { timeout: 30_000 });
  res.json({
    urls: result.urls,
    count: result.count,
    source: result.source,
  });
}));
