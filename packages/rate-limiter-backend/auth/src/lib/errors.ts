export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Invalid or missing API key') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
