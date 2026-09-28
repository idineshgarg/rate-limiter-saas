export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Invalid or missing API key') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT';

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
