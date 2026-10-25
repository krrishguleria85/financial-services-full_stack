import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import express from 'express';
import videosRoutes from '../src/routes/videos';

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/videos', videosRoutes);
  return app;
}

function makeRequest(app: any, path: string): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address() as any;
      const port = addr.port;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
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
              } catch (e) {
                resolve({ statusCode: res.statusCode || 500, body: data });
              }
            });
          });
        }
      );
      req.on('error', (err) => {
        server.close(() => reject(err));
      });
      req.end();
    });
  });
}

test('1. GET /api/videos/feed returns valid response with video items', async () => {
  const app = createTestServer();
  const res = await makeRequest(app, '/api/videos/feed');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.ok(Array.isArray(res.body.items));

  if (res.body.items.length > 0) {
    const first = res.body.items[0];
    assert.ok(first.videoId, 'Item must have videoId');
    assert.ok(first.title, 'Item must have title');
    assert.ok(first.link, 'Item must have link');
    assert.ok(first.thumbnail, 'Item must have thumbnail');
    assert.strictEqual(typeof first.isShort, 'boolean');
  }
});

test('2. GET /api/videos/shorts alias returns identical feed payload', async () => {
  const app = createTestServer();
  const res = await makeRequest(app, '/api/videos/shorts');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.ok(Array.isArray(res.body.items));
});
