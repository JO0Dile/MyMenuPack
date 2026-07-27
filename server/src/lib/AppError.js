// A thrown AppError is a *deliberate* answer to the client. Anything else that
// reaches the error handler is a bug, and gets a generic 500 with no internals
// leaked — that split is what keeps stack traces and SQL out of responses.
export default class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
    this.expected = true;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message, details) { return new AppError(400, message, details); }
  static unauthorized(message = 'Authentication required') { return new AppError(401, message); }
  static forbidden(message = 'You do not have access to this') { return new AppError(403, message); }
  static notFound(message = 'Not found') { return new AppError(404, message); }
  static conflict(message, details) { return new AppError(409, message, details); }
  static unprocessable(message, details) { return new AppError(422, message, details); }
}
