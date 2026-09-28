import type { z } from 'zod';
import { ValidationError } from './errors.js';

export function parseOrThrow<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError('Request validation failed', result.error.issues);
  }
  return result.data;
}
