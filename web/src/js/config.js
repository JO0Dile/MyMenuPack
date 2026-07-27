// Sets window.__API_BASE__ for a hosted deployment. api.js falls back to
// http://localhost:4010/api on its own, so this file only needs to say
// anything once the API has a real production URL — see DEPLOY.md.
//
// Loaded as a plain <script> (not a module import) before app.js, specifically
// so it can be edited or overridden by hand on a static host with no build
// step, the same way the API URL itself is not a secret.
if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  window.__API_BASE__ = 'https://REPLACE-WITH-YOUR-RENDER-URL.onrender.com/api';
}
