#!/usr/bin/env node
// ==========================
// BUILD THE LANDING SCENE
//
// web/scene/**  — the source: small ES modules, one responsibility each.
// web/bundles/landing-scene.js — the only thing a browser ever fetches.
//
// three.js is vendored under vendor/three (source, not a build) so this runs
// with no network, and esbuild tree-shakes exactly the parts web/scene/
// imports. That matters: the difference between "import * from three" and
// what this scene actually touches is around 50 KB gzipped.
//
//   node tools/build-scene.mjs            build
//   node tools/build-scene.mjs --watch    rebuild on change
//
// esbuild is a dev dependency and is not committed. If it is missing:
//   npm i --no-save esbuild
// ==========================
import { execFileSync } from 'node:child_process';
import { existsSync, statSync, mkdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'web/scene/main.js');
const out = join(root, 'web/bundles/landing-scene.js');

const bin = ['node_modules/.bin/esbuild', '../node_modules/.bin/esbuild']
  .map(p => join(root, p)).find(existsSync);
if (!bin) {
  console.error('esbuild not found. Install it first:\n\n  npm i --no-save esbuild\n');
  process.exit(1);
}
if (!existsSync(entry)) { console.error('no entry at ' + entry); process.exit(1); }
mkdirSync(dirname(out), { recursive: true });

const args = [
  entry,
  '--bundle',
  '--format=esm',
  '--target=es2020',
  '--minify',
  '--legal-comments=inline',        // three is MIT and says so; keep it saying so
  '--alias:three=' + join(root, 'vendor/three/build/three.module.js'),
  '--alias:three/addons=' + join(root, 'vendor/three/examples/jsm'),
  '--alias:three/examples/jsm=' + join(root, 'vendor/three/examples/jsm'),
  '--outfile=' + out,
  '--log-level=warning'
];
if (process.argv.includes('--watch')) args.push('--watch');

execFileSync(bin, args, { stdio: 'inherit' });

const raw = readFileSync(out);
const gz = gzipSync(raw, { level: 9 });
const kb = n => (n / 1024).toFixed(0).padStart(4) + ' KB';
console.log(`landing-scene.js  ${kb(raw.length)} raw   ${kb(gz.length)} gzipped`);

// A guard rail, not a hard failure: this is the one file in the project big
// enough to undo the promise the rest of it makes about weight, so a jump
// should be noticed rather than discovered by a student on campus wifi.
const BUDGET = 240 * 1024;
if (gz.length > BUDGET) {
  console.warn(`\n  ! over the ${kb(BUDGET).trim()} gzipped budget by ${kb(gz.length - BUDGET).trim()}.`);
  console.warn('    It is lazy-loaded and runtime-cached, so it never blocks the app shell —');
  console.warn('    but check what was added before letting it grow further.\n');
}
