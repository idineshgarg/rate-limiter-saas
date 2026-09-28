# @dg/rate-limiter-client

A minimal client for the rate-limiter SaaS's enforcement endpoint,
`POST /v1/rate-limit/check`. Call `check()` before handling a request to see
whether it's allowed under the rule configured for that resource.

## Install

```sh
npm install @dg/rate-limiter-client
```

## Usage

```ts
import { RateLimiterClient } from '@dg/rate-limiter-client';

const rateLimiter = new RateLimiterClient({
  apiKey: process.env.RATE_LIMITER_API_KEY!,
  baseUrl: 'https://api.example.com',
});

const result = await rateLimiter.check({
  resource: 'checkout-api',
  // required only if the rule's scope is IDENTIFIER (e.g. per-user limits)
  identifier: userId,
});

if (!result.allowed) {
  // result.retryAfterMs tells the caller how long to wait
  return res.status(429).json({ error: 'Too many requests' });
}
```

`check()` resolves normally for both allowed and denied outcomes — it only
throws a `RateLimiterApiError` (with `status` and `code`) for auth,
validation, or transport failures, since a 429 is an expected outcome of
rate limiting, not an error condition.

## Building

Run `nx build rate-limiter-client` to build the library.

## Running unit tests

Run `nx test rate-limiter-client` to execute the unit tests via [Vitest](https://vitest.dev/).
