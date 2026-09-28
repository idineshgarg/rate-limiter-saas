import { z } from 'zod';

const ruleScopeSchema = z.enum(['API_KEY', 'IDENTIFIER']).default('API_KEY');

const baseFields = {
  resource: z.string().min(1).max(200),
  scope: ruleScopeSchema,
  limit: z.number().int().positive(),
};

const fixedWindowSchema = z.object({
  ...baseFields,
  algorithm: z.literal('FIXED_WINDOW'),
  windowMs: z.number().int().positive(),
});

const slidingWindowSchema = z.object({
  ...baseFields,
  algorithm: z.literal('SLIDING_WINDOW'),
  windowMs: z.number().int().positive(),
});

const leakyBucketSchema = z.object({
  ...baseFields,
  algorithm: z.literal('LEAKY_BUCKET'),
  capacity: z.number().int().positive().optional(),
  leakRatePerMs: z.number().positive(),
});

const tokenBucketSchema = z.object({
  ...baseFields,
  algorithm: z.literal('TOKEN_BUCKET'),
  capacity: z.number().int().positive().optional(),
  refillRatePerMs: z.number().positive(),
});

export const createRuleSchema = z.discriminatedUnion('algorithm', [
  fixedWindowSchema,
  slidingWindowSchema,
  leakyBucketSchema,
  tokenBucketSchema,
]);

export type CreateRuleDto = z.infer<typeof createRuleSchema>;

// Algorithm and resource are immutable once a rule exists — updates only tune
// its numeric parameters or toggle it on/off.
export const updateRuleSchema = z
  .object({
    limit: z.number().int().positive(),
    windowMs: z.number().int().positive(),
    capacity: z.number().int().positive(),
    refillRatePerMs: z.number().positive(),
    leakRatePerMs: z.number().positive(),
    isActive: z.boolean(),
  })
  .partial();

export type UpdateRuleDto = z.infer<typeof updateRuleSchema>;

export const checkRequestSchema = z.object({
  resource: z.string().min(1).max(200),
  identifier: z.string().min(1).max(200).optional(),
  cost: z.number().int().positive().default(1),
});

export type CheckRequestDto = z.infer<typeof checkRequestSchema>;
