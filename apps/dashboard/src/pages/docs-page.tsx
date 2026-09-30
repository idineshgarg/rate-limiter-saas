import { Link } from 'react-router-dom';
import { ApiTester } from '../components/api-tester.js';
import { API_URL } from '../lib/api-client.js';

const curlExample = `curl -X POST ${API_URL}/v1/rate-limit/check \\
  -H "X-Api-Key: <your-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"resource":"checkout-api"}'`;

const sdkInstallExample = 'npm install @dineshgarg/rate-limiter-client';

const sdkUsageExample = `import { RateLimiterClient } from '@dineshgarg/rate-limiter-client';

const rateLimiter = new RateLimiterClient({
  apiKey: process.env.RATE_LIMITER_API_KEY!,
  baseUrl: '${API_URL}',
});

const result = await rateLimiter.check({ resource: 'checkout-api' });

if (!result.allowed) {
  return res.status(429).json({ error: 'Too many requests' });
}`;

const sdkExpressExample = `import { rateLimitMiddleware } from '@dineshgarg/rate-limiter-client/express';

app.post(
  '/checkout',
  rateLimitMiddleware(rateLimiter, { resource: 'checkout-api' }),
  checkoutHandler,
);`;

const endpoints = [
  { method: 'POST', path: '/v1/rate-limit/check', auth: 'X-Api-Key', desc: 'Check and consume against the active rule for a resource.' },
  { method: 'POST', path: '/v1/rules', auth: 'X-Api-Key', desc: 'Create a rate-limit rule.' },
  { method: 'GET', path: '/v1/rules', auth: 'X-Api-Key', desc: 'List rules for the authenticated key.' },
  { method: 'GET', path: '/v1/rules/:id', auth: 'X-Api-Key', desc: 'Get a single rule.' },
  { method: 'PATCH', path: '/v1/rules/:id', auth: 'X-Api-Key', desc: 'Update a rule.' },
  { method: 'DELETE', path: '/v1/rules/:id', auth: 'X-Api-Key', desc: 'Deactivate a rule.' },
  { method: 'POST', path: '/v1/auth/signup', auth: 'none', desc: 'Create a tenant account (dashboard session).' },
  { method: 'POST', path: '/v1/auth/login', auth: 'none', desc: 'Start a dashboard session.' },
  { method: 'POST', path: '/v1/account/api-keys', auth: 'session', desc: "Create an API key for the logged-in tenant." },
];

export function DocsPage() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>API & SDK Docs</h1>
          <p>Integrate and test the rate-limiter enforcement endpoint.</p>
        </div>
        <Link to="/" className="link-button">
          Back to dashboard
        </Link>
      </header>
      <main className="dashboard-main">
        <section className="panel">
          <h2>Quickstart</h2>
          <p className="panel-description">
            Every request to the enforcement endpoint needs an API key (created from the
            dashboard) and a <code>resource</code> name matching a rule you've configured.
          </p>

          <h3>curl</h3>
          <pre className="code-block">{curlExample}</pre>

          <h3>SDK (Node.js / TypeScript)</h3>
          <pre className="code-block">{sdkInstallExample}</pre>
          <pre className="code-block">{sdkUsageExample}</pre>
          <p className="panel-description">
            The SDK is a thin wrapper — <code>check()</code> makes the exact same HTTP request as
            the curl example above. It never throws for a normal allow/deny outcome (200/429),
            only for auth, validation, or transport failures.
          </p>

          <h3>Express middleware</h3>
          <pre className="code-block">{sdkExpressExample}</pre>
          <p className="panel-description">
            Sets <code>X-RateLimit-*</code> headers on every request, and <code>Retry-After</code>{' '}
            plus a 429 on denied ones — both overridable via <code>onDenied</code>/
            <code>onError</code> options.
          </p>
        </section>

        <section className="panel">
          <h2>Endpoint reference</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Auth</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={`${ep.method} ${ep.path}`}>
                  <td>
                    <code>{ep.method}</code>
                  </td>
                  <td>
                    <code>{ep.path}</code>
                  </td>
                  <td>{ep.auth}</td>
                  <td>{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <ApiTester />
      </main>
    </div>
  );
}
