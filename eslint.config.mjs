// ESLint configuration for web/js/ — the static, no-build browser app.
//
// Scoped deliberately to the rules that catch REAL defects in this codebase
// rather than style opinions. The app is hand-written ES5 in IIFEs with
// cross-file window.* globals; a config built for modern modules would bury
// three genuine bugs under three hundred complaints about `var`.
//
// The rules here are the ones a browser cannot check for itself at runtime:
// unreachable code, duplicate object keys, a typo'd global, a `debugger` left
// behind. The Fix panel inside the app covers what only a running browser can
// see (real errors, missing files, broken data); this covers the source.
//
//   npx eslint            — from the repo root
export default [
  {
    files: ['web/js/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', localStorage: 'readonly',
        navigator: 'readonly', location: 'readonly', console: 'readonly',
        fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        requestAnimationFrame: 'readonly', performance: 'readonly',
        caches: 'readonly', MutationObserver: 'readonly',
        getComputedStyle: 'readonly', matchMedia: 'readonly',
        alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        getSelection: 'readonly', self: 'readonly',
        Blob: 'readonly', File: 'readonly', FileReader: 'readonly', AbortController: 'readonly',
        URL: 'readonly', Image: 'readonly', XMLHttpRequest: 'readonly',
        // Defined in js/02-shared-cross.js and called from other modules and
        // from inline onclick="" attributes, so they are genuinely global.
        showPage: 'readonly', toggleLang: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      // The one the "detect unreachable code" requirement actually needs.
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-func-assign': 'error',
      'no-obj-calls': 'error',
      'no-sparse-arrays': 'error',
      'valid-typeof': 'error',
      // builtinGlobals off: this app defines showPage/toggleLang as real
      // globals on purpose, and declaring them is not a redeclaration bug.
      'no-redeclare': ['error', { builtinGlobals: false }],
      'getter-return': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-condition': 'error',
      'no-debugger': 'error',
      'no-self-assign': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // `catch (e) {}` where e is unused is the app's normal way of saying
      // "storage may be unavailable, carry on" — not a finding.
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
    }
  }
];
