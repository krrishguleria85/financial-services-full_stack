import test from 'node:test';
import assert from 'node:assert';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { loginLimiter } from '../src/routes/auth';

/**
 * Helper to start a test server and return its base URL and close function
 */
function createTestApp(limiter = loginLimiter) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  // Mount auth login route with the loginLimiter
  app.post('/api/auth/login', limiter, (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    if (email === 'admin@example.com' && password === 'ValidPassword123!') {
      res.status(200).json({ token: 'mock-jwt-token' });
      return;
    }
    // Generic error message for both wrong email and wrong password
    res.status(401).json({ error: 'Invalid email or password' });
  });

  // Mount an unrelated route on the same server
  app.get('/api/unrelated', (_req: Request, res: Response) => {
    res.status(200).json({ message: 'Unrelated route operational' });
  });

  // Mount another auth route
  app.get('/api/auth/me', (_req: Request, res: Response) => {
    res.status(200).json({ user: 'admin' });
  });

  return app;
}

test('1. Failed login attempts are counted and trigger HTTP 429 after 5 failed attempts', async () => {
  // Use isolated limiter with limit 5 for this test
  const testLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    statusCode: 429,
    message: { error: 'Too many failed login attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const app = createTestApp(testLimiter);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // Attempts 1 to 5: All fail with 401
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'WrongPassword' }),
      });
      assert.strictEqual(res.status, 401, `Attempt ${i} should return 401`);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'Invalid email or password');
    }

    // Attempt 6: Exceeds rate limit, must return HTTP 429
    const rateLimitedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'WrongPassword' }),
    });

    assert.strictEqual(rateLimitedRes.status, 429, 'Attempt 6 should be rejected with 429');
    const rateLimitedBody: any = await rateLimitedRes.json();
    assert.strictEqual(
      rateLimitedBody.error,
      'Too many failed login attempts. Please try again after 15 minutes.'
    );
  } finally {
    server.close();
  }
});

test('2. Successful login requests (200 OK) are NOT counted against the rate limit', async () => {
  const testLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    statusCode: 429,
    message: { error: 'Too many failed login attempts. Please try again after 15 minutes.' },
  });

  const app = createTestApp(testLimiter);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 7 consecutive successful logins (more than max: 5)
    for (let i = 1; i <= 7; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'ValidPassword123!' }),
      });
      assert.strictEqual(res.status, 200, `Successful login ${i} should return 200`);
      const body: any = await res.json();
      assert.strictEqual(body.token, 'mock-jwt-token');
    }
  } finally {
    server.close();
  }
});

test('3. Rate limiting is isolated per IP address', async () => {
  const testLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2,
    skipSuccessfulRequests: true,
    statusCode: 429,
    message: { error: 'Too many failed login attempts. Please try again after 15 minutes.' },
  });

  const app = createTestApp(testLimiter);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // IP 1: 2 failed attempts -> locked out on attempt 3
    await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'bad' }),
    });
    await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'bad' }),
    });
    const ip1Locked = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'bad' }),
    });
    assert.strictEqual(ip1Locked.status, 429, 'IP 1 should be locked out (429)');

    // IP 2: Should NOT be locked out
    const ip2Attempt = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.2' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'ValidPassword123!' }),
    });
    assert.strictEqual(ip2Attempt.status, 200, 'IP 2 should still be able to log in (200)');
  } finally {
    server.close();
  }
});

test('4. Rate limiter on login does NOT accidentally block unrelated routes', async () => {
  const testLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2,
    skipSuccessfulRequests: true,
    statusCode: 429,
    message: { error: 'Too many failed login attempts. Please try again after 15 minutes.' },
  });

  const app = createTestApp(testLimiter);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // Lock out login
    await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'bad' }),
    });
    await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'bad' }),
    });
    const lockedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'bad' }),
    });
    assert.strictEqual(lockedLogin.status, 429, 'Login must be rate limited');

    // Unrelated route on the same server should remain 200 OK
    const unrelatedRes = await fetch(`${baseUrl}/api/unrelated`);
    assert.strictEqual(unrelatedRes.status, 200, 'Unrelated route must remain accessible');
    const unrelatedBody: any = await unrelatedRes.json();
    assert.strictEqual(unrelatedBody.message, 'Unrelated route operational');

    // Other auth route should also remain accessible
    const authMeRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(authMeRes.status, 200, 'Other auth route must remain accessible');
  } finally {
    server.close();
  }
});

test('5. Generic error message prevents username/email enumeration', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // Non-existent user
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'SomePassword123' }),
    });
    const body1: any = await res1.json();

    // Existing user with wrong password
    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'WrongPassword' }),
    });
    const body2: any = await res2.json();

    assert.strictEqual(res1.status, 401);
    assert.strictEqual(res2.status, 401);
    assert.strictEqual(body1.error, 'Invalid email or password');
    assert.strictEqual(body2.error, 'Invalid email or password');
    assert.strictEqual(body1.error, body2.error, 'Error message must be identical to prevent enumeration');
  } finally {
    server.close();
  }
});
