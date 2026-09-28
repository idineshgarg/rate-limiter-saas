export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    readonly issues?: unknown,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RuleNotFoundError extends Error {
  readonly code = 'RULE_NOT_FOUND';

  constructor(message = 'No matching rate-limit rule found') {
    super(message);
    this.name = 'RuleNotFoundError';
  }
}
