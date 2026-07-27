// Environment is validated once, at boot, and the process refuses to start if
// anything required is missing or obviously unsafe.
//
// The alternative — reading process.env.FOO at the call site — fails silently:
// a missing JWT secret becomes `undefined`, jsonwebtoken happily signs with
// the string "undefined", and every token the service issues is forgeable.
// Crashing on a misconfigured boot is the cheapest possible failure.
import 'dotenv/config';

const errors = [];

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    errors.push(`${name} is required`);
    return '';
  }
  return v.trim();
}

function secret(name) {
  const v = required(name);
  // 32 chars is the floor for an HMAC secret worth the name. Short secrets are
  // brute-forceable offline once an attacker holds a single valid token.
  if (v && v.length < 32) {
    errors.push(`${name} must be at least 32 characters (got ${v.length})`);
  }
  return v;
}

function optional(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

const nodeEnv = optional('NODE_ENV', 'development');
const isProd = nodeEnv === 'production';

const config = {
  nodeEnv,
  isProd,
  port: Number(optional('PORT', '4000')),
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET'),
    refreshSecret: secret('JWT_REFRESH_SECRET'),
    accessTtl: optional('JWT_ACCESS_TTL', '15m'),
    refreshTtl: optional('JWT_REFRESH_TTL', '30d'),
  },
  corsOrigins: optional('CORS_ORIGINS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

if (config.jwt.accessSecret && config.jwt.accessSecret === config.jwt.refreshSecret) {
  // Sharing one secret means a stolen access token can be replayed as a
  // refresh token, which defeats having short-lived access tokens at all.
  errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
}

if (isProd && config.corsOrigins.includes('*')) {
  errors.push('CORS_ORIGINS must list exact origins in production, not "*"');
}

if (errors.length) {
  console.error('\nInvalid environment configuration:');
  for (const e of errors) console.error(`  - ${e}`);
  console.error('\nSee .env.example.\n');
  process.exit(1);
}

export default config;
