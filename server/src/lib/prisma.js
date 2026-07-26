// Single Prisma client for the process.
//
// Imported lazily so the HTTP layer can boot and answer /health without a
// database present — useful in CI and when bringing the stack up in pieces.
// The first query is what actually connects.
import { PrismaClient } from '@prisma/client';
import config from '../config/env.js';

const globalRef = globalThis;

export const prisma =
  globalRef.__studyplanPrisma ??
  new PrismaClient({
    log: config.isProd ? ['warn', 'error'] : ['query', 'warn', 'error'],
  });

// Node's --watch restarts the module graph without ending the process, which
// would otherwise leak a new pool on every reload until Postgres refuses
// connections.
if (!config.isProd) globalRef.__studyplanPrisma = prisma;

export default prisma;
