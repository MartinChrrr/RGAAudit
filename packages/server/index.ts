import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { crawlRouter } from './routes/crawl.routes';
import { auditRouter } from './routes/audit.routes';
import { reportRouter } from './routes/report.routes';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use(crawlRouter);
app.use(auditRouter);
app.use(reportRouter);

// Serve web frontend in production
const webDist = resolve(__dirname, '../web/dist');
if (process.env.NODE_ENV === 'production' && existsSync(webDist)) {
  app.use(express.static(webDist));
}

const PORT = Number(process.env.PORT) || 3001;

export function startServer(port = PORT): ReturnType<typeof app.listen> {
  return app.listen(port, () => {
    console.log(`RGAAudit server → http://localhost:${port}`);
  });
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
