import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { crawlRouter } from './routes/crawl.routes';
import { auditRouter } from './routes/audit.routes';
import { reportRouter } from './routes/report.routes';
import { journeyRouter } from './routes/journey.routes';
import { errorHandler } from './middleware/error.handler';
import { config } from './config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const app = express();

app.disable('x-powered-by');
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

if (process.env.NODE_ENV !== 'production' || config.corsOrigin) {
  const localOrigin = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origine CORS non autorisée.'));
  };
  app.use(cors({ origin: config.corsOrigin ?? localOrigin }));
}
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use(crawlRouter);
app.use(auditRouter);
app.use(reportRouter);
app.use(journeyRouter);

// Serve web frontend in production
const webDist = resolve(__dirname, '../web/dist');
if (process.env.NODE_ENV === 'production' && existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api(?:\/|$)).*/, (_, res) => {
    res.sendFile(resolve(webDist, 'index.html'));
  });
}

app.use('/api', (_, res) => {
  res.status(404).json({ error: 'Route API introuvable.' });
});

// Error handler (must be last)
app.use(errorHandler);

export function startServer(port = config.port, host = config.host): ReturnType<typeof app.listen> {
  return app.listen(port, host, () => {
    console.log(`RGAAudit server → http://${host}:${port}`);
  });
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
