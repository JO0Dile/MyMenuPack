import AppError from '../lib/AppError.js';
import config from '../config/env.js';

// 404 for anything no route claimed.
export function notFoundHandler(req, res, next) {
  next(new AppError(404, `No route for ${req.method} ${req.originalUrl}`));
}

// The single exit point for every failure in the app. Controllers never format
// their own errors — they throw, and this decides what the client is told.
export function errorHandler(err, req, res, _next) {
  // Prisma's own errors carry table and column names; they are translated to
  // flat messages rather than passed through.
  if (err?.code === 'P2002') {
    err = AppError.conflict('That already exists', { fields: err.meta?.target });
  } else if (err?.code === 'P2025') {
    err = AppError.notFound('The record you referenced does not exist');
  }

  const expected = err instanceof AppError && err.expected;
  const status = expected ? err.status : 500;

  // An unexpected error is a bug: log it in full server-side, tell the client
  // nothing beyond "something broke".
  if (!expected) {
    console.error('[unhandled]', req.method, req.originalUrl, err);
  }

  const body = {
    error: {
      message: expected ? err.message : 'Something went wrong on our end',
      ...(expected && err.details ? { details: err.details } : {}),
    },
  };

  // Stack traces only ever in development, and only for genuine bugs.
  if (!config.isProd && !expected) body.error.stack = err?.stack;

  res.status(status).json(body);
}
