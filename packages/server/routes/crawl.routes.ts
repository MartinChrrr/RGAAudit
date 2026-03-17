import { Router } from 'express';
import { z } from 'zod';
import { parseSitemap } from '@rgaaudit/core/crawler/sitemap.parser';
import { asyncHandler } from '../middleware/error.handler';
import { validateBody } from '../middleware/validate';
import { config } from '../config';

const crawlBodySchema = z.object({
  url: z.string()
    .min(1, 'Le champ "url" est requis.')
    .refine(
      (v) => v.startsWith('http://') || v.startsWith('https://'),
      'L\'URL doit commencer par http:// ou https://.',
    ),
});

export const crawlRouter = Router();

crawlRouter.post('/api/crawl', validateBody(crawlBodySchema), asyncHandler(async (req, res) => {
  const { url } = req.body;

  const result = await parseSitemap(url, { timeout: config.crawl.timeoutMs });
  res.json({
    urls: result.urls,
    count: result.count,
    source: result.source,
  });
}));
