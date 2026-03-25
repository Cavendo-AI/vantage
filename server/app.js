import './env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import signalsRouter from './routes/signals.js';
import sourcesRouter from './routes/sources.js';
import topicsRouter from './routes/topics.js';
import collectionsRouter from './routes/collections.js';
import contextsRouter from './routes/contexts.js';
import analysesRouter from './routes/analyses.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';

import * as response from './utils/response.js';
import { initializeDatabase } from './db/init.js';
import { securityHeaders, apiLimiter } from './middleware/security.js';
import { mountMcp } from './mcp.js';
import db from './db/adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

export function createApp() {
  const app = express();
  const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

  // Middleware
  app.use(securityHeaders);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use('/api', apiLimiter);
  app.use('/mcp', apiLimiter);

  // Request logging in development
  if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: pkg.version });
  });

  // API routes
  app.use('/api/signals', signalsRouter);
  app.use('/api/sources', sourcesRouter);
  app.use('/api/topics', topicsRouter);
  app.use('/api/collections', collectionsRouter);
  app.use('/api/contexts', contextsRouter);
  app.use('/api/analyses', analysesRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/auth', authRouter);

  // MCP Streamable HTTP endpoint (remote MCP access)
  mountMcp(app);

  // JSON parse error handler
  app.use((err, req, res, next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return response.badRequest(res, 'File too large');
    }
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return response.badRequest(res, 'Invalid JSON body');
    }
    next(err);
  });

  // Generic error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    response.serverError(res, process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message);
  });

  // 404
  app.use((req, res) => {
    response.notFound(res, 'Endpoint');
  });

  // Lifecycle
  let server = null;

  async function start(bindOptions = {}) {
    const port = bindOptions.port ?? (process.env.PORT || 3020);

    await initializeDatabase(db);

    await new Promise((resolve, reject) => {
      server = app.listen(port, () => {
        console.log(`
╔══════════════════════════════════════════╗
║                                          ║
║   Vantage v${pkg.version}                        ║
║   Market Intelligence Platform           ║
║                                          ║
║   Server: http://localhost:${port}          ║
║   API:    http://localhost:${port}/api      ║
║   MCP:    http://localhost:${port}/mcp      ║
║                                          ║
╚══════════════════════════════════════════╝
        `);
        resolve(server);
      });
      server.once('error', reject);
    });

    return server;
  }

  async function stop() {
    if (server) {
      await new Promise(resolve => server.close(resolve));
      server = null;
    }
    db.close();
  }

  return { app, start, stop };
}

export default createApp;
