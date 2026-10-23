/**
 * Cloudflare R2 Object Storage & Secure Document Management Test Suite
 *
 * Verifies:
 * 1. Configuration validation: Account ID, Access Key, Secret Key, Bucket Name, and Endpoint resolution.
 * 2. Production fail-fast when R2 credentials are placeholders or partially configured.
 * 3. Successful R2 upload: file is saved to R2 private bucket, temporary local file is unlinked,
 *    and R2 object key is stored in the database.
 * 4. Unauthorized upload and download rejection (pre-Multer token check and admin JWT auth).
 * 5. Successful authorized download: streams file directly from R2 with proper attachment headers.
 * 6. Compatibility with existing local documents: seamlessly streams legacy local files from disk.
 * 7. R2 upload failure handling: cleans up local file, creates no DB record, and returns HTTP 500.
 * 8. Database failure and orphaned R2 cleanup: if Prisma insert fails, uploaded R2 object is purged immediately.
 * 9. Document deletion: deletes R2 objects and local files when service request or customer is deleted.
 * 10. Idempotent deletion: non-existent R2 objects do not cause delete routes to fail.
 */

import test from 'node:test';
import assert from 'node:assert';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import prisma from '../src/config/database';
import { config, validateAndGetR2Config } from '../src/config';
import documentRoutes from '../src/routes/documents';
import serviceRequestRoutes from '../src/routes/serviceRequests';
import customerRoutes from '../src/routes/customers';
import {
  setMockStorage,
  uploadDocumentFile,
  getDocumentStream,
  deleteDocumentFile,
  deleteOrphanedR2Object,
  isR2ObjectKey,
  normalizeR2Key,
  buildR2ObjectKey,
} from '../src/services/storageService';

// PDF magic byte sample
const testPdfBytes = Buffer.from('%PDF-1.7\nTest PDF content for Cloudflare R2 test\n%%EOF');

function createTestServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/documents', documentRoutes);
  app.use('/api/service-requests', serviceRequestRoutes);
  app.use('/api/admin/customers', customerRoutes);

  // Global error handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const pendingFile = (req as any)._multerPendingFilePath;
    if (pendingFile && fs.existsSync(pendingFile)) {
      try { fs.unlinkSync(pendingFile); } catch {}
    }
    if ((req as any).file?.path && fs.existsSync((req as any).file.path)) {
      try { fs.unlinkSync((req as any).file.path); } catch {}
    }
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}

test('Cloudflare R2 Object Storage Suite', async (t) => {
  const app = createTestServer();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  const adminToken = jwt.sign(
    { id: 'admin-r2-test-id', email: 'admin@finance.com' },
    config.jwt.secret,
    { algorithm: 'HS256' }
  );

  const mockDb = {
    admins: new Map<string, any>([
      ['admin-r2-test-id', { id: 'admin-r2-test-id', email: 'admin@finance.com', name: 'Admin', role: 'admin', isActive: true }],
    ]),
    customers: new Map<string, any>([
      ['cust-r2-uuid', { id: 'cust-r2-uuid', name: 'R2 User', phone: '9876543210', email: 'user@example.com' }],
    ]),
    serviceRequests: new Map<string, any>([
      [
        'req-r2-uuid',
        {
          id: 'req-r2-uuid',
          requestId: 'REQ-2026-R201',
          customerId: 'cust-r2-uuid',
          status: 'DOCUMENTS_REQUIRED',
          customer: { id: 'cust-r2-uuid', name: 'R2 User', phone: '9876543210', email: 'user@example.com' },
        },
      ],
    ]),
    documents: new Map<string, any>(),
    history: [] as any[],
  };

  // Intercept Prisma calls
  (prisma.admin as any).findUnique = async (q: any) => mockDb.admins.get(q.where.id) || null;
  (prisma.customer as any).findUnique = async (q: any) => mockDb.customers.get(q.where.id) || null;
  (prisma.customer as any).delete = async (q: any) => {
    mockDb.customers.delete(q.where.id);
    return { id: q.where.id };
  };
  (prisma.serviceRequest as any).findUnique = async (q: any) => mockDb.serviceRequests.get(q.where.id) || null;
  (prisma.serviceRequest as any).findMany = async (q: any) => {
    return Array.from(mockDb.serviceRequests.values()).filter((r) => r.customerId === q.where?.customerId);
  };
  (prisma.serviceRequest as any).update = async (q: any) => {
    const r = mockDb.serviceRequests.get(q.where.id);
    if (r) Object.assign(r, q.data);
    return r;
  };
  (prisma.serviceRequest as any).delete = async (q: any) => {
    mockDb.serviceRequests.delete(q.where.id);
    return { id: q.where.id };
  };
  (prisma.document as any).create = async (q: any) => {
    const doc = { id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...q.data, status: 'UPLOADED', createdAt: new Date() };
    mockDb.documents.set(doc.id, doc);
    return doc;
  };
  (prisma.document as any).findUnique = async (q: any) => mockDb.documents.get(q.where.id) || null;
  (prisma.document as any).findMany = async (q: any) => {
    return Array.from(mockDb.documents.values()).filter((d) => {
      if (q.where?.serviceRequestId && d.serviceRequestId !== q.where.serviceRequestId) return false;
      if (q.where?.customerId && d.customerId !== q.where.customerId) return false;
      return true;
    });
  };
  (prisma.document as any).deleteMany = async (q: any) => {
    for (const [id, d] of Array.from(mockDb.documents.entries())) {
      if (q.where?.serviceRequestId === d.serviceRequestId || q.where?.customerId === d.customerId) {
        mockDb.documents.delete(id);
      }
    }
    return { count: 1 };
  };
  (prisma.requestStatusHistory as any).create = async (q: any) => {
    mockDb.history.push(q.data);
    return q.data;
  };
  (prisma.requestStatusHistory as any).deleteMany = async () => ({ count: 1 });
  (prisma.adminNote as any).deleteMany = async () => ({ count: 1 });
  (prisma.appointment as any).deleteMany = async () => ({ count: 1 });
  (prisma.serviceRequest as any).deleteMany = async () => ({ count: 1 });
  (prisma.$transaction as any) = async (ops: any[]) => Promise.all(ops);

  // In-memory simulated R2 bucket
  const simulatedR2 = new Map<string, { body: Buffer; contentType: string; metadata?: any }>();

  // Attach mock R2 storage
  setMockStorage({
    upload: async (p) => {
      simulatedR2.set(p.key, {
        body: Buffer.isBuffer(p.body) ? p.body : Buffer.from(await (p.body as any)),
        contentType: p.contentType,
      });
    },
    download: async (p) => {
      const item = simulatedR2.get(p.key);
      if (!item) return null;
      return {
        stream: Readable.from(item.body),
        contentLength: item.body.length,
        contentType: item.contentType,
      };
    },
    delete: async (p) => {
      simulatedR2.delete(p.key);
    },
  });

  t.after(() => {
    setMockStorage(null);
    server.close();
  });

  await t.test('1. R2 Configuration Validator', () => {
    // Empty config in dev returns isConfigured: false without throwing
    const emptyConfig = validateAndGetR2Config('', '', '', '', '', false);
    assert.strictEqual(emptyConfig.isConfigured, false);
    assert.strictEqual(emptyConfig.bucketName, 'financial-services-private-docs');

    // Endpoint constructed automatically when omitted
    const autoEndpoint = validateAndGetR2Config('acc123', 'key123', 'sec123', 'my-bucket', '', false);
    assert.strictEqual(autoEndpoint.isConfigured, true);
    assert.strictEqual(autoEndpoint.endpoint, 'https://acc123.r2.cloudflarestorage.com');

    // Explicit endpoint preserved
    const customEndpoint = validateAndGetR2Config('acc123', 'key123', 'sec123', 'my-bucket', 'https://custom.endpoint.com', false);
    assert.strictEqual(customEndpoint.endpoint, 'https://custom.endpoint.com');

    // Production: all R2 variables missing throws fatal error
    assert.throws(
      () => validateAndGetR2Config('', '', '', '', '', true),
      /FATAL: Cloudflare R2 configuration is missing in production\. R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be provided\./
    );

    // Production: partial credentials (missing secretAccessKey) throws fatal error
    assert.throws(
      () => validateAndGetR2Config('acc123', 'key123', '', 'my-bucket', '', true),
      /FATAL: Cloudflare R2 configuration is missing in production\. R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be provided\./
    );

    // Production: partial credentials (missing accessKeyId) throws fatal error
    assert.throws(
      () => validateAndGetR2Config('acc123', '', 'sec123', 'my-bucket', '', true),
      /FATAL: Cloudflare R2 configuration is missing in production\. R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be provided\./
    );

    // Production: placeholder credentials throws fatal error
    assert.throws(
      () => validateAndGetR2Config('your_cloudflare_account_id', 'your_r2_access_key_id', 'your_r2_secret_access_key', 'my-bucket', '', true),
      /FATAL: Cloudflare R2 credentials are invalid or contain default placeholders in production\./
    );

    // Production: valid credentials succeeds
    const prodValid = validateAndGetR2Config('real-acc-id', 'real-key-id', 'real-secret-key', 'prod-bucket', '', true);
    assert.strictEqual(prodValid.isConfigured, true);
    assert.strictEqual(prodValid.bucketName, 'prod-bucket');
    assert.strictEqual(prodValid.endpoint, 'https://real-acc-id.r2.cloudflarestorage.com');

    // Local development: missing credentials does not throw and preserves local fallback
    const devMissing = validateAndGetR2Config('', '', '', '', '', false);
    assert.strictEqual(devMissing.isConfigured, false);
  });

  await t.test('2. Key formatting and normalization helpers', () => {
    assert.strictEqual(buildR2ObjectKey('req-99', 'test.pdf'), 'documents/req-99/test.pdf');
    assert.strictEqual(isR2ObjectKey('documents/req-99/test.pdf'), true);
    assert.strictEqual(isR2ObjectKey('r2:documents/req-99/test.pdf'), true);
    assert.strictEqual(isR2ObjectKey('local-file.pdf'), false);
    assert.strictEqual(normalizeR2Key('r2:documents/abc/1.pdf'), 'documents/abc/1.pdf');
    assert.strictEqual(normalizeR2Key('documents/abc/1.pdf'), 'documents/abc/1.pdf');
  });

  await t.test('3. Successful Document Upload to Cloudflare R2', async () => {
    const uploadToken = jwt.sign(
      { sub: 'req-r2-uuid', requestId: 'REQ-2026-R201', purpose: 'customer_document_upload' },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

    const formData = new FormData();
    formData.append('documentType', 'PAN Card');
    const blob = new Blob([testPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'customer_pan.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-r2-uuid`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': uploadToken,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 201);
    const body: any = await res.json();
    assert.strictEqual(body.message, 'Document uploaded successfully');
    assert.ok(body.document.id);
    assert.strictEqual(body.document.originalName, 'customer_pan.pdf');

    // Verify stored in DB with R2 key
    const doc = mockDb.documents.get(body.document.id);
    assert.ok(doc);
    assert.ok(doc.storedName.startsWith('documents/req-r2-uuid/'));
    assert.ok(doc.storedName.endsWith('.pdf'));

    // Verify stored in simulated R2
    const r2Item = simulatedR2.get(doc.storedName);
    assert.ok(r2Item, 'Object must exist in R2 bucket');
    assert.strictEqual(r2Item.contentType, 'application/pdf');
    assert.deepStrictEqual(r2Item.body, testPdfBytes);

    // Verify temporary file on disk was cleaned up
    const localFile = path.join(config.upload.dir, path.basename(doc.storedName));
    assert.strictEqual(fs.existsSync(localFile), false, 'Temporary local file must be unlinked after R2 upload');
  });

  await t.test('4. Unauthorized Upload and Download Attempts are Rejected', async () => {
    // 1. Upload with missing token
    const noTokenRes = await fetch(`${baseUrl}/api/documents/upload/req-r2-uuid`, {
      method: 'POST',
    });
    assert.strictEqual(noTokenRes.status, 401);

    // 2. Upload with expired token
    const expiredToken = jwt.sign(
      { sub: 'req-r2-uuid', requestId: 'REQ-2026-R201', purpose: 'customer_document_upload' },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: '-1s' }
    );
    const expiredRes = await fetch(`${baseUrl}/api/documents/upload/req-r2-uuid`, {
      method: 'POST',
      headers: { 'X-Upload-Token': expiredToken },
    });
    assert.strictEqual(expiredRes.status, 401);

    // 3. Upload with token for wrong request ID
    const wrongToken = jwt.sign(
      { sub: 'req-different-id', requestId: 'REQ-DIFFERENT', purpose: 'customer_document_upload' },
      config.jwt.secret,
      { algorithm: 'HS256' }
    );
    const wrongRes = await fetch(`${baseUrl}/api/documents/upload/req-r2-uuid`, {
      method: 'POST',
      headers: { 'X-Upload-Token': wrongToken },
    });
    assert.strictEqual(wrongRes.status, 403);

    // 4. Download without auth header
    const doc = Array.from(mockDb.documents.values())[0];
    const noAuthDown = await fetch(`${baseUrl}/api/documents/${doc.id}/download`);
    assert.strictEqual(noAuthDown.status, 401);

    // 5. Download with invalid admin token
    const badAuthDown = await fetch(`${baseUrl}/api/documents/${doc.id}/download`, {
      headers: { Authorization: 'Bearer bad-token' },
    });
    assert.strictEqual(badAuthDown.status, 401);
  });

  await t.test('5. Successful Authorized Download Streams from Cloudflare R2', async () => {
    const doc = Array.from(mockDb.documents.values())[0];
    const res = await fetch(`${baseUrl}/api/documents/${doc.id}/download`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
    assert.ok(res.headers.get('content-disposition')?.includes('attachment; filename="customer_pan.pdf"'));

    const arrayBuffer = await res.arrayBuffer();
    const downloadedBuffer = Buffer.from(arrayBuffer);
    assert.deepStrictEqual(downloadedBuffer, testPdfBytes);
  });

  await t.test('6. Compatibility with Existing Legacy Local-File Documents', async () => {
    // Create a legacy file on local disk
    const legacyFilename = 'legacy-doc-12345.pdf';
    const legacyPath = path.join(config.upload.dir, legacyFilename);
    const legacyContent = Buffer.from('%PDF-1.4\nLegacy offline document stored locally\n%%EOF');
    fs.writeFileSync(legacyPath, legacyContent);

    // Add DB record pointing to local filename (no R2 prefix)
    const legacyDoc = {
      id: 'doc-legacy-id',
      customerId: 'cust-r2-uuid',
      serviceRequestId: 'req-r2-uuid',
      documentType: 'Aadhaar',
      originalName: 'aadhaar_card.pdf',
      storedName: legacyFilename,
      mimeType: 'application/pdf',
      fileSize: legacyContent.length,
      status: 'VERIFIED',
      createdAt: new Date(),
    };
    mockDb.documents.set(legacyDoc.id, legacyDoc);

    // Admin downloads legacy document
    const res = await fetch(`${baseUrl}/api/documents/${legacyDoc.id}/download`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
    assert.ok(res.headers.get('content-disposition')?.includes('filename="aadhaar_card.pdf"'));

    const downloaded = Buffer.from(await res.arrayBuffer());
    assert.deepStrictEqual(downloaded, legacyContent);

    // Clean up local test file
    try { fs.unlinkSync(legacyPath); } catch {}
  });

  await t.test('7. R2 Upload Failure: Cleans Up Local File and Returns HTTP 500 Without DB Record', async () => {
    const failingMock: any = {
      upload: async () => {
        throw new Error('Cloudflare R2 service unavailable (connection timeout)');
      },
      download: async () => null,
      delete: async () => {},
    };
    setMockStorage(failingMock);

    const uploadToken = jwt.sign(
      { sub: 'req-r2-uuid', requestId: 'REQ-2026-R201', purpose: 'customer_document_upload' },
      config.jwt.secret,
      { algorithm: 'HS256' }
    );

    const initialDocsCount = mockDb.documents.size;
    const formData = new FormData();
    formData.append('documentType', 'Salary Slip');
    const blob = new Blob([testPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'salary.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-r2-uuid`, {
      method: 'POST',
      headers: { 'X-Upload-Token': uploadToken },
      body: formData,
    });

    assert.strictEqual(res.status, 500);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Failed to upload document');

    // Verify no document was added to the DB
    assert.strictEqual(mockDb.documents.size, initialDocsCount);

    // Restore working mock
    setMockStorage({
      upload: async (p) => {
        simulatedR2.set(p.key, { body: Buffer.isBuffer(p.body) ? p.body : Buffer.from(await (p.body as any)), contentType: p.contentType });
      },
      download: async (p) => {
        const item = simulatedR2.get(p.key);
        if (!item) return null;
        return { stream: Readable.from(item.body), contentLength: item.body.length, contentType: item.contentType };
      },
      delete: async (p) => { simulatedR2.delete(p.key); },
    });
  });

  await t.test('8. Database Write Failure Purges Orphaned R2 Object', async () => {
    let deletedR2Key: string | null = null;
    let uploadedR2Key: string | null = null;

    setMockStorage({
      upload: async (p) => {
        uploadedR2Key = p.key;
        simulatedR2.set(p.key, { body: Buffer.from(testPdfBytes), contentType: p.contentType });
      },
      download: async () => null,
      delete: async (p) => {
        deletedR2Key = p.key;
        simulatedR2.delete(p.key);
      },
    });

    // Temporarily simulate DB error on prisma.document.create
    const originalCreate = (prisma.document as any).create;
    (prisma.document as any).create = async () => {
      throw new Error('Database connection terminated unexpectedly');
    };

    const uploadToken = jwt.sign(
      { sub: 'req-r2-uuid', requestId: 'REQ-2026-R201', purpose: 'customer_document_upload' },
      config.jwt.secret,
      { algorithm: 'HS256' }
    );

    const formData = new FormData();
    formData.append('documentType', 'Voter ID');
    const blob = new Blob([testPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'voter_id.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-r2-uuid`, {
      method: 'POST',
      headers: { 'X-Upload-Token': uploadToken },
      body: formData,
    });

    assert.strictEqual(res.status, 500);

    // Verify orphaned object was immediately purged from R2
    assert.ok(uploadedR2Key, 'File must have been uploaded to R2 initially');
    assert.strictEqual(deletedR2Key, uploadedR2Key, 'Orphaned R2 object must be purged on DB error');
    assert.strictEqual(simulatedR2.has(uploadedR2Key), false, 'Purged object must not remain in R2');

    // Restore create
    (prisma.document as any).create = originalCreate;

    // Restore working mock
    setMockStorage({
      upload: async (p) => {
        simulatedR2.set(p.key, { body: Buffer.isBuffer(p.body) ? p.body : Buffer.from(await (p.body as any)), contentType: p.contentType });
      },
      download: async (p) => {
        const item = simulatedR2.get(p.key);
        if (!item) return null;
        return { stream: Readable.from(item.body), contentLength: item.body.length, contentType: item.contentType };
      },
      delete: async (p) => { simulatedR2.delete(p.key); },
    });
  });

  await t.test('9. Document Deletion Removes Files from R2 and Local Storage', async () => {
    // Upload a doc to delete
    const uploadToken = jwt.sign(
      { sub: 'req-r2-uuid', requestId: 'REQ-2026-R201', purpose: 'customer_document_upload' },
      config.jwt.secret,
      { algorithm: 'HS256' }
    );

    const formData = new FormData();
    formData.append('documentType', 'ITR Acknowledgement');
    const blob = new Blob([testPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'itr_ack.pdf');

    const upRes = await fetch(`${baseUrl}/api/documents/upload/req-r2-uuid`, {
      method: 'POST',
      headers: { 'X-Upload-Token': uploadToken },
      body: formData,
    });
    const upBody: any = await upRes.json();
    const doc = mockDb.documents.get(upBody.document.id);
    assert.ok(doc);
    assert.ok(simulatedR2.has(doc.storedName), 'Document must exist in R2 before delete');

    // Delete service request via admin route
    const delRes = await fetch(`${baseUrl}/api/service-requests/req-r2-uuid`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(delRes.status, 200);

    // Verify document was removed from R2
    assert.strictEqual(simulatedR2.has(doc.storedName), false, 'Document must be deleted from R2');
  });

  await t.test('10. Idempotent Deletion: Deleting non-existent R2 object does not throw or fail', async () => {
    // Calling deleteDocumentFile on a non-existent key must succeed cleanly
    await assert.doesNotReject(async () => {
      await deleteDocumentFile('documents/req-non-existent/random.pdf');
    });
  });

  await t.test('11. R2 Deletion Failure Recovery and Observability', async () => {
    const loggedErrors: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      loggedErrors.push(args.join(' '));
    };

    try {
      // Configure mock storage to fail deletions (simulating R2 downtime or 503 error)
      setMockStorage({
        upload: async () => {},
        download: async () => null,
        delete: async () => {
          throw new Error('Connection reset by Cloudflare R2 endpoint');
        },
      });

      // 1. deleteDocumentFile should not throw; should return failure result and log tagged warning
      const res = await deleteDocumentFile('documents/req-test-fail/invoice.pdf');
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.key, 'documents/req-test-fail/invoice.pdf');
      assert.strictEqual(res.source, 'r2');

      const failedLog = loggedErrors.find((msg) => msg.includes('[STORAGE_DELETION_FAILED]'));
      assert.ok(failedLog, 'Must emit observable [STORAGE_DELETION_FAILED] tag');
      assert.ok(failedLog.includes('documents/req-test-fail/invoice.pdf'), 'Must include sanitized object key');
      assert.ok(!failedLog.includes('secret') && !failedLog.includes('password'), 'Must not log secrets');

      // 2. deleteOrphanedR2Object should not throw on R2 downtime; should log [ORPHAN_CLEANUP_FAILED]
      const orphanRes = await deleteOrphanedR2Object('documents/req-test-fail/orphan.pdf');
      assert.strictEqual(orphanRes, false);

      const orphanLog = loggedErrors.find((msg) => msg.includes('[ORPHAN_CLEANUP_FAILED]'));
      assert.ok(orphanLog, 'Must emit observable [ORPHAN_CLEANUP_FAILED] tag');
      assert.ok(orphanLog.includes('documents/req-test-fail/orphan.pdf'), 'Must include object key');

      // 3. Customer deletion must proceed with database deletion even if R2 fails
      mockDb.customers.set('cust-fail-uuid', {
        id: 'cust-fail-uuid',
        name: 'Test Customer',
        phone: '9999999999',
        email: 'test@customer.com',
      });
      mockDb.documents.set('doc-fail-id', {
        id: 'doc-fail-id',
        customerId: 'cust-fail-uuid',
        serviceRequestId: 'req-fail-id',
        storedName: 'documents/req-fail-id/doc.pdf',
      });

      const custDelRes = await fetch(`${baseUrl}/api/admin/customers/cust-fail-uuid`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(custDelRes.status, 200);
      assert.strictEqual(mockDb.customers.has('cust-fail-uuid'), false, 'Customer must be deleted from DB');
      assert.strictEqual(mockDb.documents.has('doc-fail-id'), false, 'Document records must be removed from DB');
    } finally {
      console.error = originalConsoleError;
      setMockStorage(null);
    }
  });
});
