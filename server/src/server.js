import { createApp } from './app.js';
import config from './config/env.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`StudyPlan API listening on :${config.port} (${config.nodeEnv})`);
});

// Stop accepting new connections, let in-flight requests finish, then close the
// database pool. Without this a deploy can cut a request mid-transaction.
async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down…`);
  server.close(async () => {
    try {
      const { prisma } = await import('./lib/prisma.js');
      await prisma.$disconnect();
    } catch { /* never connected — nothing to close */ }
    process.exit(0);
  });
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
