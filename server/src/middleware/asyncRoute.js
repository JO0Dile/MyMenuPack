// Express 4 does not catch a rejected promise from an async handler — the
// request just hangs until it times out. Wrapping every async controller
// funnels rejections into the shared error handler instead.
export const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export default asyncRoute;
