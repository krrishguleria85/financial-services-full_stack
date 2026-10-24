/**
 * Document Upload Security & File Validation Test Suite
 *
 * ARCHITECTURAL TEST SCOPE & LIMITATIONS:
 * ---------------------------------------
 * What this test suite exercises directly:
 * 1. ACTUAL Express Routes: Imports and mounts `backend/src/routes/documents.ts`
 *    and `backend/src/routes/serviceRequests.ts`.
 * 2. ACTUAL Pre-Multer Authorization: Verifies `verifyUploadAuthorization` runs
 *    BEFORE Multer disk storage, preventing unauthorized files from reaching disk.
 * 3. ACTUAL Status Allowlist: Proves all allowed statuses (NEW, DOCUMENTS_REQUIRED,
 *    DOCUMENTS_RECEIVED, UNDER_REVIEW, IN_PROGRESS) succeed past authorization, while
 *    disallowed statuses (COMPLETED, CANCELLED, ARCHIVED) are rejected prior to Multer.
 * 4. ACTUAL Partial File Cleanup: Verifies `uploadSingleFile` and error handlers unlink
 *    both `req.file?.path` and `req._multerPendingFilePath` on LIMIT_FILE_SIZE and stream errors.
 * 5. ACTUAL Security Middleware: `validateFileMagicBytes`, `isSignatureMatchingExtensionAndMime`,
 *    `uploadLimiter`, and `trackingLimiter`.
 * 6. ACTUAL Cryptography: Real `jsonwebtoken` HS256 signature signing and verification.
 * 7. ACTUAL Network Transport: Starts a real HTTP server on an ephemeral port (`app.listen(0)`)
 *    and executes real multipart/form-data HTTP requests via standard `fetch` and `FormData`.
 *
 * Known Test Limitations:
 * 1. Prisma ORM Database Mocking:
 *    `backend/prisma/schema.prisma` is configured for PostgreSQL (Neon in production),
 *    whereas local offline testing has no live PostgreSQL server. Therefore, Prisma model
 *    calls (`findFirst`, `findUnique`, `update`, `create`) are intercepted and backed by an
 *    in-memory JavaScript store to guarantee fast, deterministic, offline test execution
 *    without modifying production database URLs.
 * 2. Surrounding Application Middleware:
 *    Admin authentication (`authenticateAdmin`) and CORS restrictions from `src/index.ts`
 *    are not tested here (they are covered in separate admin/security test suites).
 */

import test from 'node:test';
import assert from 'node:assert';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import prisma from '../src/config/database';
import { config } from '../src/config';
import documentRoutes from '../src/routes/documents';
import serviceRequestRoutes from '../src/routes/serviceRequests';
import {
  getMulterStorageInvocations,
  resetMulterStorageInvocations,
  UPLOAD_ELIGIBLE_STATUSES,
} from '../src/middleware/upload';
import { encryptData } from '../src/utils/helpers';

function createTestServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Upload-Token', 'x-upload-token'],
    maxAge: 86400,
  }));
  app.use(express.json());
  app.use('/api/documents', documentRoutes);
  app.use('/api/service-requests', serviceRequestRoutes);

  // Global error handler matching src/index.ts
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const pendingFile = (req as any)._multerPendingFilePath;
    if (pendingFile && fs.existsSync(pendingFile)) {
      try {
        fs.unlinkSync(pendingFile);
      } catch {
        // Ignore cleanup error
      }
    }
    if ((req as any).file?.path && fs.existsSync((req as any).file.path)) {
      try {
        fs.unlinkSync((req as any).file.path);
      } catch {
        // Ignore cleanup error
      }
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: `File size exceeds the allowed limit of ${config.upload.maxFileSizeMB}MB` });
      return;
    }
    if (
      err.message?.includes('Invalid file type') ||
      err.message?.includes('Invalid file extension') ||
      err.message?.includes('Invalid MIME type') ||
      err.message?.includes('does not match file extension')
    ) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message });
  });

  return app;
}

test('Document Upload Security & File Validation Suite', async (t) => {
  const app = createTestServer();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  let ipCounter = 1;
  function getNextIp() {
    return `192.168.20.${ipCounter++}`;
  }

  resetMulterStorageInvocations();

  // Helper factory for mock requests with different statuses
  function createMockRequest(id: string, reqId: string, status: string) {
    return {
      id,
      requestId: reqId,
      customerId: 'cust-security-uuid',
      serviceId: 'srv-consultation-uuid',
      status,
      message: `Test request in ${status} status`,
      assessmentYear: '2026-27',
      incomeType: 'Salary',
      businessName: null,
      gstStatus: null,
      policyNumber: null,
      priority: 'normal',
      panEncrypted: encryptData('ABCDE1234F'),
      formData: JSON.stringify({ confidentialDetail: 'secret-bank-data' }),
      createdAt: new Date(),
      updatedAt: new Date(),
      service: { id: 'srv-consultation-uuid', name: 'Tax Consultation', category: 'consultation' },
      customer: {
        id: 'cust-security-uuid',
        name: 'Test Security Customer',
        phone: '9876543001',
        email: 'security.test@example.com',
        address: '123 Confidential Street, Apartment 4B',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      documents: [
        {
          id: 'doc-existing-01',
          documentType: 'Identity Proof',
          originalName: 'passport.pdf',
          storedName: '1730000000-secret-uuid-on-disk.pdf',
          mimeType: 'application/pdf',
          fileSize: 102400,
          status: 'VERIFIED',
          createdAt: new Date(),
        },
      ] as any[],
      statusHistory: [
        { newStatus: 'NEW', createdAt: new Date(), note: 'Request created' },
        { newStatus: status, createdAt: new Date(), note: 'Please upload identity proof' },
      ],
      notes: [{ id: 'note-1', content: 'CONFIDENTIAL: Internal fraud check passed' }],
    };
  }

  // In-memory test state for isolated, deterministic offline testing
  const mockDb = {
    customer: {
      id: 'cust-security-uuid',
      name: 'Test Security Customer',
      phone: '9876543001',
      email: 'security.test@example.com',
    },
    requests: {
      'req-status-new': createMockRequest('req-status-new', 'REQ-STATUS-01', 'NEW'),
      'req-status-docs-required': createMockRequest('req-status-docs-required', 'REQ-STATUS-02', 'DOCUMENTS_REQUIRED'),
      'req-status-docs-received': createMockRequest('req-status-docs-received', 'REQ-STATUS-03', 'DOCUMENTS_RECEIVED'),
      'req-status-under-review': createMockRequest('req-status-under-review', 'REQ-STATUS-04', 'UNDER_REVIEW'),
      'req-status-in-progress': createMockRequest('req-status-in-progress', 'REQ-STATUS-05', 'IN_PROGRESS'),
      'req-status-completed': createMockRequest('req-status-completed', 'REQ-STATUS-06', 'COMPLETED'),
      'req-status-cancelled': createMockRequest('req-status-cancelled', 'REQ-STATUS-07', 'CANCELLED'),
      'req-status-archived': createMockRequest('req-status-archived', 'REQ-STATUS-08', 'ARCHIVED'),
    } as Record<string, any>,
    createdDocuments: [] as any[],
    createdHistory: [] as any[],
  };

  // Wire Prisma handlers to in-memory test store
  (prisma.serviceRequest as any).findFirst = async (query: any) => {
    for (const r of Object.values(mockDb.requests)) {
      if (r.requestId === query?.where?.requestId && r.customer?.phone === query?.where?.customer?.phone) {
        return r;
      }
    }
    return null;
  };

  (prisma.serviceRequest as any).findUnique = async (query: any) => {
    return mockDb.requests[query?.where?.id] || null;
  };

  (prisma.serviceRequest as any).update = async (query: any) => {
    const r = mockDb.requests[query?.where?.id];
    if (r) {
      r.status = query.data.status;
      return r;
    }
    return null;
  };

  (prisma.document as any).create = async (query: any) => {
    const doc = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...query.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.createdDocuments.push(doc);
    return doc;
  };

  (prisma.document as any).findUnique = async (query: any) => {
    return mockDb.createdDocuments.find((d) => d.id === query?.where?.id) || null;
  };

  (prisma.requestStatusHistory as any).create = async (query: any) => {
    mockDb.createdHistory.push(query.data);
    return query.data;
  };

  // Helper to count files currently stored in upload directory
  function countUploadFiles(): number {
    if (!fs.existsSync(config.upload.dir)) return 0;
    return fs.readdirSync(config.upload.dir).length;
  }

  // Realistic binary byte payloads:
  const validPdfBytes = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const validJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48]);
  const validPngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);

  function makeValidToken(requestId = 'req-status-docs-required', reqTrackingId = 'REQ-STATUS-02') {
    return jwt.sign(
      {
        sub: requestId,
        requestId: reqTrackingId,
        purpose: 'customer_document_upload',
      },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: '15m' }
    );
  }

  await t.test('1. Legacy GET /track is disabled (HTTP 403) and cannot bypass OTP to issue uploadToken', async () => {
    const res = await fetch(`${baseUrl}/api/service-requests/track?requestId=REQ-STATUS-02&phone=9876543001`, {
      headers: { 'X-Forwarded-For': getNextIp() },
    });
    assert.strictEqual(res.status, 403);
    const body: any = await res.json();

    assert.strictEqual(body.uploadToken, undefined, 'Legacy GET /track must NOT issue uploadToken');
    assert.strictEqual(body.request, undefined, 'Legacy GET /track must NOT return request details');
    assert.ok(body.error.includes('Direct tracking without email OTP verification is disabled'));

    // Verify valid signed token structure for upload authorization
    const token = makeValidToken('req-status-docs-required', 'REQ-STATUS-02');
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as any;
    assert.strictEqual(decoded.sub, 'req-status-docs-required');
    assert.strictEqual(decoded.requestId, 'REQ-STATUS-02');
    assert.strictEqual(decoded.purpose, 'customer_document_upload');
  });

  await t.test('2. Missing upload token is rejected with HTTP 401 BEFORE Multer writes file to disk', async () => {
    const storageBefore = getMulterStorageInvocations();
    const filesBefore = countUploadFiles();

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'identity.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: { 'X-Forwarded-For': getNextIp() },
      body: formData,
    });

    assert.strictEqual(res.status, 401);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Upload authorization token is required');
    assert.strictEqual(getMulterStorageInvocations(), storageBefore, 'Multer storage must NOT be invoked on missing token');
    assert.strictEqual(countUploadFiles(), filesBefore, 'No file must be written to disk on missing token');
  });

  await t.test('3. Expired upload token is rejected with HTTP 401 BEFORE Multer writes file to disk', async () => {
    const storageBefore = getMulterStorageInvocations();
    const filesBefore = countUploadFiles();

    const expiredToken = jwt.sign(
      {
        sub: 'req-status-docs-required',
        requestId: 'REQ-STATUS-02',
        purpose: 'customer_document_upload',
      },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: -10 }
    );

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'identity.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': expiredToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 401);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Upload session has expired. Please track your request again.');
    assert.strictEqual(getMulterStorageInvocations(), storageBefore, 'Multer storage must NOT be invoked on expired token');
    assert.strictEqual(countUploadFiles(), filesBefore, 'No file must be written to disk on expired token');
  });

  await t.test('4. Tampered / invalid token is rejected with HTTP 401 BEFORE Multer writes file to disk', async () => {
    const storageBefore = getMulterStorageInvocations();
    const filesBefore = countUploadFiles();

    const invalidToken = jwt.sign(
      {
        sub: 'req-status-docs-required',
        purpose: 'customer_document_upload',
      },
      'attacker-forged-secret-key-12345',
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'identity.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': invalidToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 401);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Invalid upload authorization token');
    assert.strictEqual(getMulterStorageInvocations(), storageBefore, 'Multer storage must NOT be invoked on tampered token');
    assert.strictEqual(countUploadFiles(), filesBefore, 'No file must be written to disk on tampered token');
  });

  await t.test('5. Wrong-request token (mismatched target sub) is rejected with HTTP 403 BEFORE Multer writes file to disk', async () => {
    const storageBefore = getMulterStorageInvocations();
    const filesBefore = countUploadFiles();

    const otherRequestId = 'c0000000-0000-0000-0000-000000000001';
    const mismatchedToken = jwt.sign(
      {
        sub: otherRequestId,
        purpose: 'customer_document_upload',
      },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'identity.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': mismatchedToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 403);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Token is not authorized for this service request');
    assert.strictEqual(getMulterStorageInvocations(), storageBefore, 'Multer storage must NOT be invoked on wrong-request token');
    assert.strictEqual(countUploadFiles(), filesBefore, 'No file must be written to disk on wrong-request token');
  });

  await t.test('6. Non-existent service request ID is rejected with HTTP 404 BEFORE Multer writes file to disk', async () => {
    const storageBefore = getMulterStorageInvocations();
    const filesBefore = countUploadFiles();

    const nonExistentId = '00000000-0000-0000-0000-000000000999';
    const token = makeValidToken(nonExistentId, 'REQ-NON-EXISTENT');

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'identity.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/${nonExistentId}`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': token,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 404);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Service request not found');
    assert.strictEqual(getMulterStorageInvocations(), storageBefore, 'Multer storage must NOT be invoked on missing request');
    assert.strictEqual(countUploadFiles(), filesBefore, 'No file must be written to disk on missing request');
  });

  await t.test('7. Explicit Allowlist: Every allowed status succeeds past authorization and completes upload', async () => {
    const allowedStatuses = [
      { id: 'req-status-new', reqId: 'REQ-STATUS-01', status: 'NEW' },
      { id: 'req-status-docs-required', reqId: 'REQ-STATUS-02', status: 'DOCUMENTS_REQUIRED' },
      { id: 'req-status-docs-received', reqId: 'REQ-STATUS-03', status: 'DOCUMENTS_RECEIVED' },
      { id: 'req-status-under-review', reqId: 'REQ-STATUS-04', status: 'UNDER_REVIEW' },
      { id: 'req-status-in-progress', reqId: 'REQ-STATUS-05', status: 'IN_PROGRESS' },
    ];

    for (const item of allowedStatuses) {
      assert.ok(UPLOAD_ELIGIBLE_STATUSES.has(item.status), `${item.status} must be in UPLOAD_ELIGIBLE_STATUSES allowlist`);

      const token = makeValidToken(item.id, item.reqId);
      const formData = new FormData();
      formData.append('documentType', `Proof for ${item.status}`);
      const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
      formData.append('file', blob, `${item.status.toLowerCase()}_doc.pdf`);

      const res = await fetch(`${baseUrl}/api/documents/upload/${item.id}`, {
        method: 'POST',
        headers: {
          'X-Upload-Token': token,
          'X-Forwarded-For': getNextIp(),
        },
        body: formData,
      });

      assert.strictEqual(res.status, 201, `Upload for status ${item.status} must succeed with 201`);
      const body: any = await res.json();
      assert.strictEqual(body.message, 'Document uploaded successfully');
      assert.ok(body.document.id);

      // Clean up uploaded file on disk
      const createdDoc = mockDb.createdDocuments.find((d) => d.id === body.document.id);
      if (createdDoc) {
        const filePath = path.join(config.upload.dir, createdDoc.storedName);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
      }
    }
  });

  await t.test('8. Explicit Disallowlist: Every disallowed status is rejected with HTTP 400 BEFORE Multer writes file to disk', async () => {
    const disallowedStatuses = [
      { id: 'req-status-completed', reqId: 'REQ-STATUS-06', status: 'COMPLETED' },
      { id: 'req-status-cancelled', reqId: 'REQ-STATUS-07', status: 'CANCELLED' },
      { id: 'req-status-archived', reqId: 'REQ-STATUS-08', status: 'ARCHIVED' }, // Unknown/non-allowlisted status
    ];

    for (const item of disallowedStatuses) {
      assert.ok(!UPLOAD_ELIGIBLE_STATUSES.has(item.status), `${item.status} must NOT be in UPLOAD_ELIGIBLE_STATUSES allowlist`);

      const storageBefore = getMulterStorageInvocations();
      const filesBefore = countUploadFiles();
      const token = makeValidToken(item.id, item.reqId);

      const formData = new FormData();
      formData.append('documentType', 'Identity Proof');
      const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
      formData.append('file', blob, 'disallowed.pdf');

      const res = await fetch(`${baseUrl}/api/documents/upload/${item.id}`, {
        method: 'POST',
        headers: {
          'X-Upload-Token': token,
          'X-Forwarded-For': getNextIp(),
        },
        body: formData,
      });

      assert.strictEqual(res.status, 400, `Upload for disallowed status ${item.status} must be rejected with 400`);
      const body: any = await res.json();
      assert.ok(body.error.includes(item.status), `Error message must cite the disallowed status ${item.status}`);
      assert.strictEqual(
        getMulterStorageInvocations(),
        storageBefore,
        `Multer disk storage must NOT be invoked for disallowed status ${item.status}`
      );
      assert.strictEqual(
        countUploadFiles(),
        filesBefore,
        `No file must be written to disk for disallowed status ${item.status}`
      );
    }
  });

  await t.test('9. Spoofed file signature (HTML disguised as PDF) is rejected with HTTP 400 and unlinked', async () => {
    const filesBefore = countUploadFiles();
    const validToken = makeValidToken();

    const fakeHtmlBytes = Buffer.from('<html><script>alert("XSS")</script></html>');
    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([fakeHtmlBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'invoice.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'File signature verification failed: contents do not match allowed formats');
    assert.strictEqual(countUploadFiles(), filesBefore, 'Temporary file must be unlinked after magic bytes failure');
  });

  await t.test('10. Disallowed file extension (.exe) is rejected with HTTP 400 and leaves no partial file', async () => {
    const filesBefore = countUploadFiles();
    const validToken = makeValidToken();

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'exploit.exe');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.ok(body.error.includes('Invalid file extension'));
    assert.strictEqual(countUploadFiles(), filesBefore, 'No partial or temporary file must remain on rejected extension');
  });

  await t.test('11. Mismatched declared MIME type (.pdf with image/png) is rejected with HTTP 400 and leaves no partial file', async () => {
    const filesBefore = countUploadFiles();
    const validToken = makeValidToken();

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'image/png' });
    formData.append('file', blob, 'document.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.ok(body.error.includes('does not match file extension'));
    assert.strictEqual(countUploadFiles(), filesBefore, 'No partial or temporary file must remain on MIME mismatch');
  });

  await t.test('12. JPEG binary renamed as PDF (.pdf) is rejected with HTTP 400 and unlinked', async () => {
    const filesBefore = countUploadFiles();
    const validToken = makeValidToken();

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validJpegBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'disguised_photo.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.ok(body.error.includes('File signature mismatch'));
    assert.ok(body.error.includes('JPEG'));
    assert.strictEqual(countUploadFiles(), filesBefore, 'Temporary file must be unlinked after signature mismatch');
  });

  await t.test('13. PDF binary renamed as JPG (.jpg) is rejected with HTTP 400 and unlinked', async () => {
    const filesBefore = countUploadFiles();
    const validToken = makeValidToken();

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'image/jpeg' });
    formData.append('file', blob, 'disguised_pdf.jpg');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.ok(body.error.includes('File signature mismatch'));
    assert.ok(body.error.includes('PDF'));
    assert.strictEqual(countUploadFiles(), filesBefore, 'Temporary file must be unlinked after signature mismatch');
  });

  await t.test('14. PNG binary renamed as PDF (.pdf) is rejected with HTTP 400 and unlinked', async () => {
    const filesBefore = countUploadFiles();
    const validToken = makeValidToken();

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPngBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'disguised_png.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.ok(body.error.includes('File signature mismatch'));
    assert.ok(body.error.includes('PNG'));
    assert.strictEqual(countUploadFiles(), filesBefore, 'Temporary file must be unlinked after signature mismatch');
  });

  await t.test('15. Oversized file (>10MB) is rejected by Multer with HTTP 400 and immediately unlinks partial file', async () => {
    const filesBefore = countUploadFiles();
    const validToken = makeValidToken();

    // Allocate buffer slightly larger than 10MB limit (10.5 MB)
    const oversizedBytes = Buffer.alloc(10.5 * 1024 * 1024);
    validPdfBytes.copy(oversizedBytes, 0);

    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([oversizedBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'oversized.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.ok(body.error.includes('File size exceeds the allowed limit'));
    assert.strictEqual(countUploadFiles(), filesBefore, 'Oversized partial file must NOT remain in uploads directory');
  });

  await t.test('16. Legitimate JPEG upload succeeds and derives customerId from DB', async () => {
    const validToken = makeValidToken();

    const formData = new FormData();
    formData.append('documentType', 'Address Proof (Passport)');
    const blob = new Blob([validJpegBytes], { type: 'image/jpeg' });
    formData.append('file', blob, 'passport_photo.jpg');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 201);
    const body: any = await res.json();
    assert.strictEqual(body.message, 'Document uploaded successfully');
    assert.ok(body.document.id);

    const savedDoc = mockDb.createdDocuments.find((d) => d.id === body.document.id);
    assert.ok(savedDoc);
    assert.strictEqual(savedDoc.customerId, 'cust-security-uuid');
    assert.strictEqual(savedDoc.mimeType, 'image/jpeg');

    const filePath = path.join(config.upload.dir, savedDoc.storedName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  });

  await t.test('17. Legitimate PNG upload succeeds and derives customerId from DB', async () => {
    const validToken = makeValidToken();

    const formData = new FormData();
    formData.append('documentType', 'Signature Proof');
    const blob = new Blob([validPngBytes], { type: 'image/png' });
    formData.append('file', blob, 'signature.png');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 201);
    const body: any = await res.json();
    assert.strictEqual(body.message, 'Document uploaded successfully');
    assert.ok(body.document.id);

    const savedDoc = mockDb.createdDocuments.find((d) => d.id === body.document.id);
    assert.ok(savedDoc);
    assert.strictEqual(savedDoc.customerId, 'cust-security-uuid');
    assert.strictEqual(savedDoc.mimeType, 'image/png');

    const filePath = path.join(config.upload.dir, savedDoc.storedName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  });

  await t.test('18. Upload rate limiter restricts excessive attempts (>10) from the same IP to HTTP 429', async () => {
    const spamIp = '198.51.100.99';
    const validToken = makeValidToken();

    for (let i = 0; i < 10; i++) {
      const formData = new FormData();
      formData.append('documentType', 'Spam Test');
      const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
      formData.append('file', blob, `spam_${i}.pdf`);

      await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
        method: 'POST',
        headers: {
          'X-Upload-Token': validToken,
          'X-Forwarded-For': spamIp,
        },
        body: formData,
      });
    }

    const formData = new FormData();
    formData.append('documentType', 'Spam Test');
    const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'spam_11.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'X-Upload-Token': validToken,
        'X-Forwarded-For': spamIp,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 429);
    const body: any = await res.json();
    assert.ok(body.error.includes('Too many upload attempts'));
  });

  await t.test('19. Removed dead routes return HTTP 404', async () => {
    const resRoot = await fetch(`${baseUrl}/api/documents`, { method: 'POST' });
    assert.strictEqual(resRoot.status, 404);

    const resUploadWithReq = await fetch(`${baseUrl}/api/documents/upload-with-request`, { method: 'POST' });
    assert.strictEqual(resUploadWithReq.status, 404);
  });

  await t.test('20. Legacy GET /track route unconditionally denies access (HTTP 403) for any request ID or phone', async () => {
    const res = await fetch(`${baseUrl}/api/service-requests/track?requestId=REQ-STATUS-02&phone=9876543001`, {
      method: 'GET',
      headers: {
        'X-Forwarded-For': getNextIp(),
      },
    });

    assert.strictEqual(res.status, 403);
    const body: any = await res.json();
    assert.ok(body.error.includes('Direct tracking without email OTP verification is disabled'));
    assert.strictEqual(body.uploadToken, undefined, 'No uploadToken issued by disabled GET /track');
    assert.strictEqual(body.request, undefined, 'No request details leaked by disabled GET /track');
  });

  await t.test('21. Legacy GET /track route rejects invalid parameters with HTTP 403 without leaking data', async () => {
    // Valid requestId, wrong phone
    const resWrongPhone = await fetch(`${baseUrl}/api/service-requests/track?requestId=REQ-STATUS-02&phone=9999999999`, {
      method: 'GET',
      headers: {
        'X-Forwarded-For': getNextIp(),
      },
    });
    assert.strictEqual(resWrongPhone.status, 403);
    const bodyPhone: any = await resWrongPhone.json();
    assert.ok(bodyPhone.error.includes('Direct tracking without email OTP verification is disabled'));

    // Nonexistent requestId
    const resWrongId = await fetch(`${baseUrl}/api/service-requests/track?requestId=REQ-NONEXISTENT&phone=9876543001`, {
      method: 'GET',
      headers: {
        'X-Forwarded-For': getNextIp(),
      },
    });
    assert.strictEqual(resWrongId.status, 403);
    const bodyId: any = await resWrongId.json();
    assert.ok(bodyId.error.includes('Direct tracking without email OTP verification is disabled'));
  });

  await t.test('22. Direct tracking route GET /track cannot bypass OTP verification even under repeated calls', async () => {
    const probeIp = '198.51.100.88';

    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/service-requests/track?requestId=REQ-STATUS-01&phone=9876543001`, {
        method: 'GET',
        headers: {
          'X-Forwarded-For': probeIp,
        },
      });
      assert.strictEqual(res.status, 403);
    }
  });

  await t.test('23. Upload authorization accepts standard Authorization Bearer token header', async () => {
    const validToken = makeValidToken('req-status-docs-required', 'REQ-STATUS-02');
    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'identity-bearer.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 201, 'Upload must succeed with Authorization Bearer header');
    const body: any = await res.json();
    assert.strictEqual(body.message, 'Document uploaded successfully');
    assert.strictEqual(body.document.documentType, 'Identity Proof');
  });

  await t.test('24. CORS preflight OPTIONS request permits X-Upload-Token header', async () => {
    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-docs-required`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://financial-services-web.onrender.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, x-upload-token, authorization',
      },
    });

    assert.strictEqual(res.status, 204, 'CORS preflight OPTIONS must return 204');
    const allowHeaders = (res.headers.get('access-control-allow-headers') || '').toLowerCase();
    assert.ok(allowHeaders.includes('x-upload-token'), `CORS must permit x-upload-token in allowed headers, got: ${allowHeaders}`);
    assert.ok(allowHeaders.includes('authorization'), `CORS must permit authorization in allowed headers, got: ${allowHeaders}`);
  });

  await t.test('25. Exact production request shape: multipart upload succeeds for status=NEW with dual auth headers (Bearer and X-Upload-Token)', async () => {
    const validToken = makeValidToken('req-status-new', 'REQ-STATUS-01');
    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob([validPdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'identity-proof.pdf');

    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: formData,
    });

    assert.strictEqual(res.status, 201, 'Exact production request shape must succeed with 201 Created');
    const body: any = await res.json();
    assert.strictEqual(body.message, 'Document uploaded successfully');
    assert.strictEqual(body.document.documentType, 'Identity Proof');
    assert.strictEqual(body.document.originalName, 'identity-proof.pdf');
  });

  await t.test('26. Exact production failure reproduction: Content-Type application/json with serialized FormData yields 400 No file uploaded', async () => {
    const validToken = makeValidToken('req-status-new', 'REQ-STATUS-01');
    const res = await fetch(`${baseUrl}/api/documents/upload/req-status-new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'X-Upload-Token': validToken,
        'X-Forwarded-For': getNextIp(),
      },
      body: JSON.stringify({ file: {}, documentType: 'Identity Proof' }),
    });

    assert.strictEqual(res.status, 400, 'JSON body without multipart boundary must be rejected with 400');
    const body: any = await res.json();
    assert.strictEqual(body.error, 'No file uploaded');
  });

  server.close();
});
