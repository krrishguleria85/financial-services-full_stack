import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import settingsRouter from '../src/routes/settings';
import { config } from '../src/config';
import prisma from '../src/config/database';

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/settings', settingsRouter);
  return app;
}

function makeRequest(
  app: any,
  options: { path: string; method?: string; body?: any; token?: string }
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address() as any;
      const port = addr.port;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
      }
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: options.path,
          method: options.method || 'GET',
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            server.close(() => {
              try {
                const parsed = JSON.parse(data);
                resolve({ statusCode: res.statusCode || 500, body: parsed });
              } catch {
                resolve({ statusCode: res.statusCode || 500, body: data });
              }
            });
          });
        }
      );
      req.on('error', (err) => {
        server.close(() => reject(err));
      });
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  });
}

test('Settings & Social Profile Central Management Suite', async (t) => {
  // In-memory store for test isolation
  const mockSettings = new Map<string, string>();
  mockSettings.set('businessName', 'Rajesh Guleria Official');
  mockSettings.set('youtubeChannelUrl', 'https://www.youtube.com/@rajeshguleria1973');
  mockSettings.set('instagramUrl', 'https://www.instagram.com/guleria2877');

  const mockAdmin = {
    id: 'test-admin-uuid',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    isActive: true,
  };

  // Mock prisma models used in settings and auth
  (prisma as any).admin = {
    findUnique: async (query: any) => {
      if (query.where?.id === mockAdmin.id) return mockAdmin;
      return null;
    },
  };

  (prisma as any).businessSetting = {
    findMany: async () => {
      return Array.from(mockSettings.entries()).map(([key, value]) => ({ key, value }));
    },
    upsert: async (params: { where: { key: string }; update: { value: string }; create: { key: string; value: string } }) => {
      mockSettings.set(params.where.key, params.update.value);
      return { key: params.where.key, value: params.update.value };
    },
  };

  (prisma as any).auditLog = {
    create: async () => ({ id: 'log-1' }),
  };

  const adminToken = jwt.sign(
    { id: mockAdmin.id, email: mockAdmin.email },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  const app = createTestServer();

  await t.test('1. Public GET /api/settings retrieves stored settings map', async () => {
    const res = await makeRequest(app, { path: '/api/settings' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.businessName, 'Rajesh Guleria Official');
    assert.strictEqual(res.body.youtubeChannelUrl, 'https://www.youtube.com/@rajeshguleria1973');
    assert.strictEqual(res.body.instagramUrl, 'https://www.instagram.com/guleria2877');
  });

  await t.test('2. PUT /api/settings requires admin authorization', async () => {
    const res = await makeRequest(app, {
      path: '/api/settings',
      method: 'PUT',
      body: { youtubeChannelUrl: 'https://youtube.com/@new' },
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await t.test('3. PUT /api/settings rejects malformed or invalid social URL formats', async () => {
    const res = await makeRequest(app, {
      path: '/api/settings',
      method: 'PUT',
      token: adminToken,
      body: { snapchatUrl: 'not_a_valid_url' },
    });
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.error.includes('Invalid URL format for Snapchat'));
  });

  await t.test('4. PUT /api/settings rejects insecure/disallowed protocols for social URLs', async () => {
    const res = await makeRequest(app, {
      path: '/api/settings',
      method: 'PUT',
      token: adminToken,
      body: { mojUrl: 'javascript:alert(1)' },
    });
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.error.includes('Invalid URL protocol for Moj'));
  });

  await t.test('5. PUT /api/settings persists all 5 social URLs (YouTube, Instagram, Facebook, Snapchat, Moj)', async () => {
    const socialPayload = {
      youtubeChannelUrl: 'https://www.youtube.com/@rajeshguleria1973',
      instagramUrl: 'https://www.instagram.com/guleria2877',
      facebookUrl: 'https://www.facebook.com/rajeshguleriaofficial',
      snapchatUrl: 'https://www.snapchat.com/add/rguleria2026',
      mojUrl: 'https://mojapp.in/@rajesh_dance_live',
    };

    const putRes = await makeRequest(app, {
      path: '/api/settings',
      method: 'PUT',
      token: adminToken,
      body: socialPayload,
    });
    assert.strictEqual(putRes.statusCode, 200);
    assert.strictEqual(putRes.body.message, 'Settings updated successfully');

    // Verify GET reflects the newly saved values
    const getRes = await makeRequest(app, { path: '/api/settings' });
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.body.youtubeChannelUrl, socialPayload.youtubeChannelUrl);
    assert.strictEqual(getRes.body.instagramUrl, socialPayload.instagramUrl);
    assert.strictEqual(getRes.body.facebookUrl, socialPayload.facebookUrl);
    assert.strictEqual(getRes.body.snapchatUrl, socialPayload.snapchatUrl);
    assert.strictEqual(getRes.body.mojUrl, socialPayload.mojUrl);
  });

  await t.test('6. PUT /api/settings allows unsetting or clearing social links with empty string', async () => {
    const putRes = await makeRequest(app, {
      path: '/api/settings',
      method: 'PUT',
      token: adminToken,
      body: { snapchatUrl: '', mojUrl: '' },
    });
    assert.strictEqual(putRes.statusCode, 200);

    const getRes = await makeRequest(app, { path: '/api/settings' });
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.body.snapchatUrl, '');
    assert.strictEqual(getRes.body.mojUrl, '');
    // Ensure others were preserved
    assert.strictEqual(getRes.body.youtubeChannelUrl, 'https://www.youtube.com/@rajeshguleria1973');
  });
});
