// Express wiring only — no business logic lives here.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import config from './config/env.js';
import AppError from './lib/AppError.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Behind a reverse proxy (Railway, Fly, nginx) the client IP arrives in
  // X-Forwarded-For. Without this the rate limiter sees one shared proxy IP
  // and throttles every user together.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // No Origin header = same-origin, curl, or a mobile app; those aren't
        // what CORS defends against, so they pass.
        if (!origin) return cb(null, true);
        if (config.corsOrigins.includes(origin)) return cb(null, true);
        // A rejected origin is an expected outcome, not a server fault. Raised
        // as an AppError so it answers 403 instead of a 500 that also spams the
        // logs as an unhandled bug on every probe.
        return cb(AppError.forbidden(`Origin not allowed: ${origin}`));
      },
      credentials: true,
    })
  );

  // 1MB is generous for JSON but small enough that an import package can't be
  // used to exhaust memory. The import route raises its own limit explicitly.
  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    })
  );

  // Deliberately outside /api and before auth: a load balancer must be able to
  // probe liveness without credentials or a database.
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), env: config.nodeEnv });
  });

  // Feature modules mount here as they are built:
  //   app.use('/api/auth', authRoutes);
  //   app.use('/api/universities', universityRoutes);
  //   app.use('/api/majors', majorRoutes);
  //   app.use('/api/me/progress', progressRoutes);
  //   app.use('/api/import', importRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
