/**
 * Regression Test Suite: Tracking Session, Customer Document Request Message,
 * and Email Deduplication
 *
 * Verifies:
 * 1. Customer-visible document request message visibility:
 *    - Dedicated customerMessage returned through authenticated tracking flow.
 *    - Internal admin notes strictly protected (adminNotes: null).
 *    - Fallback to DOCUMENTS_REQUIRED statusHistory note for legacy requests.
 * 2. Short-lived scoped tracking session token:
 *    - Issued only after successful OTP verification.
 *    - Scoped to verified request ID and permissions (['track', 'upload']).
 *    - Session reuse via GET /track/session on page refresh without sending another email OTP.
 * 3. Expired, invalid, and missing session token handling:
 *    - Returns HTTP 401 with explicit SESSION_EXPIRED or INVALID_TOKEN error.
 * 4. Authorization scope enforcement:
 *    - Token restricted to its verified service request ID.
 *    - Upload requires explicit 'upload' permission in token.
 *    - Admin JWT cannot be used as customer upload or tracking token.
 * 5. Email quota protection & document-request email deduplication:
 *    - Zero emails sent on tracking refresh or polling.
 *    - Admin status change to DOCUMENTS_REQUIRED sends branded notification email.
 *    - Repeated admin saves/retries within deduplication window do not spam customer.
 */

import test from 'node:test';
import assert from 'node:assert';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';
import { config } from '../src/config';
import serviceRequestRoutes from '../src/routes/serviceRequests';
import documentRoutes from '../src/routes/documents';
import {
  generateOtp,
  generateSalt,
  hashOtp,
} from '../src/utils/otp';
import {
  getMockSentEmails,
  clearMockSentEmails,
} from '../src/services/emailService';

function createTestServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Upload-Token', 'x-upload-token', 'X-Tracking-Token', 'x-tracking-token'],
    maxAge: 86400,
  }));
  app.use(express.json());

  app.use('/api/service-requests', serviceRequestRoutes);
  app.use('/api/documents', documentRoutes);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

test('Tracking Session & Customer Document Request Message Suite', async (t) => {
  const app = createTestServer();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/service-requests`;
  const docBaseUrl = `http://localhost:${port}/api/documents`;

  const mockDb = {
    services: [
      { id: 'srv-tax-1', name: 'Income Tax Return (ITR)', category: 'TAXATION', slug: 'itr' },
      { id: 'srv-gst-1', name: 'GST Registration', category: 'TAXATION', slug: 'gst' },
    ],
    customers: new Map<string, any>(),
    serviceRequests: new Map<string, any>(),
    emailOtps: new Map<string, any>(),
    statusHistory: [] as any[],
    adminNotes: [] as any[],
    auditLogs: [] as any[],
    notifications: [] as any[],
  };

  const testCustomer = {
    id: 'cust-sess-1',
    name: 'Priya Sharma',
    phone: '9876543210',
    email: 'priya.sharma@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockDb.customers.set(testCustomer.id, testCustomer);

  const testRequest = {
    id: 'req-uuid-sess-1',
    requestId: 'REQ-2026-SESS01',
    customerId: testCustomer.id,
    serviceId: 'srv-tax-1',
    status: 'DOCUMENTS_REQUIRED',
    panEncrypted: null as string | null,
    formDataEncrypted: null as string | null,
    formData: JSON.stringify({
      customerMessage: 'Please provide Form 16 Part A and Part B for FY 2025-26.',
    }),
    documents: [],
    statusHistory: [
      {
        id: 'sh-1',
        newStatus: 'DOCUMENTS_REQUIRED',
        note: 'Please provide Form 16 Part A and Part B for FY 2025-26.',
        createdAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockDb.serviceRequests.set(testRequest.id, testRequest);

  // Hook Prisma methods
  (prisma.serviceRequest as any).findFirst = async (query: any) => {
    for (const r of mockDb.serviceRequests.values()) {
      if (query?.where?.requestId && r.requestId !== query.where.requestId) continue;
      if (query?.where?.id && r.id !== query.where.id) continue;
      if (query?.where?.customer?.phone) {
        const cust = mockDb.customers.get(r.customerId);
        if (!cust || cust.phone !== query.where.customer.phone) continue;
      }

      const cust = mockDb.customers.get(r.customerId);
      const srv = mockDb.services.find((s) => s.id === r.serviceId);
      return {
        ...r,
        customer: cust,
        service: srv,
        statusHistory: r.statusHistory || [],
        documents: r.documents || [],
      };
    }
    return null;
  };

  (prisma.serviceRequest as any).findUnique = async (query: any) => {
    const r = mockDb.serviceRequests.get(query?.where?.id);
    if (!r) return null;
    const cust = mockDb.customers.get(r.customerId);
    const srv = mockDb.services.find((s) => s.id === r.serviceId);
    return {
      ...r,
      customer: cust,
      service: srv,
      statusHistory: r.statusHistory || [],
      documents: r.documents || [],
    };
  };

  (prisma.serviceRequest as any).update = async (query: any) => {
    const r = mockDb.serviceRequests.get(query.where.id);
    if (!r) throw new Error('Request not found');
    Object.assign(r, query.data);
    r.updatedAt = new Date();
    const cust = mockDb.customers.get(r.customerId);
    const srv = mockDb.services.find((s) => s.id === r.serviceId);
    return {
      ...r,
      customer: cust,
      service: srv,
      statusHistory: r.statusHistory || [],
      documents: r.documents || [],
    };
  };

  (prisma.emailOtp as any).findFirst = async (query: any) => {
    let matches: any[] = [];
    for (const otp of mockDb.emailOtps.values()) {
      if (query?.where?.serviceRequestId && otp.serviceRequestId !== query.where.serviceRequestId) continue;
      if (query?.where?.consumedAt === null && otp.consumedAt !== null && otp.consumedAt !== undefined) continue;
      matches.push(otp);
    }
    if (query?.orderBy?.createdAt === 'desc') {
      matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return matches[0] || null;
  };

  (prisma.emailOtp as any).findUnique = async (query: any) => {
    return mockDb.emailOtps.get(query?.where?.id) || null;
  };

  (prisma.emailOtp as any).update = async (query: any) => {
    const record = mockDb.emailOtps.get(query.where.id);
    if (!record) throw new Error('Record not found');
    if (query.data?.consumedAt) record.consumedAt = query.data.consumedAt;
    record.updatedAt = new Date();
    return record;
  };

  (prisma.requestStatusHistory as any).create = async (query: any) => {
    const rec = { id: `sh-${Date.now()}`, ...query.data, createdAt: new Date() };
    mockDb.statusHistory.push(rec);
    const r = mockDb.serviceRequests.get(query.data.serviceRequestId);
    if (r) {
      if (!r.statusHistory) r.statusHistory = [];
      r.statusHistory.push(rec);
    }
    return rec;
  };

  (prisma.adminNote as any).create = async (query: any) => {
    const rec = { id: `note-${Date.now()}`, ...query.data, createdAt: new Date() };
    mockDb.adminNotes.push(rec);
    return rec;
  };

  (prisma.auditLog as any).create = async (query: any) => {
    const rec = { id: `audit-${Date.now()}`, ...query.data, createdAt: new Date() };
    mockDb.auditLogs.push(rec);
    return rec;
  };

  (prisma.notification as any).create = async (query: any) => {
    const rec = { id: `notif-${Date.now()}`, ...query.data, createdAt: new Date() };
    mockDb.notifications.push(rec);
    return rec;
  };

  (prisma as any).admin = {
    findUnique: async (_query: any) => ({
      id: 'admin-uuid-1',
      email: 'admin@example.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    }),
  };

  (prisma as any).$executeRaw = async () => 1;
  (prisma as any).$transaction = async (fnOrOps: any) => {
    if (typeof fnOrOps === 'function') {
      const txPrisma = Object.assign(Object.create(prisma), {
        $executeRaw: async () => 1,
        emailOtp: prisma.emailOtp,
        serviceRequest: prisma.serviceRequest,
      });
      return fnOrOps(txPrisma);
    }
    return Promise.all(fnOrOps);
  };

  t.after(() => {
    server.close();
  });

  await t.test('1. Customer message visibility: authenticated tracking returns customerMessage and keeps adminNotes null', async () => {
    clearMockSentEmails();
    const validOtp = '654321';
    const salt = generateSalt();
    const otpRecord = {
      id: 'otp-sess-test-1',
      serviceRequestId: testRequest.id,
      email: testCustomer.email,
      salt,
      codeHash: hashOtp(validOtp, salt),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    };
    mockDb.emailOtps.set(otpRecord.id, otpRecord);

    const res = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.200.1.1',
      },
      body: JSON.stringify({
        requestId: testRequest.requestId,
        phone: testCustomer.phone,
        otp: validOtp,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.sessionToken, 'sessionToken must be returned');

    // Verify customerMessage is populated with admin requested document details
    assert.strictEqual(
      body.request.customerMessage,
      'Please provide Form 16 Part A and Part B for FY 2025-26.',
      'customerMessage must match what admin specified'
    );
    assert.strictEqual(
      body.request.documentRequestMessage,
      'Please provide Form 16 Part A and Part B for FY 2025-26.',
      'documentRequestMessage alias must also be populated'
    );

    // Private admin notes must remain strictly null
    assert.strictEqual(body.request.adminNotes, null, 'Private adminNotes must be null to prevent leaking internal notes');
  });

  await t.test('2. Refresh session reuse: GET /track/session restores tracking state with 0 emails sent', async () => {
    clearMockSentEmails();
    const initialEmailCount = getMockSentEmails().length;

    // Issue a valid scoped tracking session token
    const token = jwt.sign(
      {
        sub: testRequest.id,
        requestId: testRequest.requestId,
        purpose: 'customer_tracking_session',
        permissions: ['track', 'upload'],
      },
      config.jwt.secret,
      { expiresIn: '15m' }
    );

    // Simulate page refresh restoring session
    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tracking-Token': token,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.request.requestId, testRequest.requestId);
    assert.strictEqual(data.request.status, 'DOCUMENTS_REQUIRED');
    assert.strictEqual(data.request.customerMessage, 'Please provide Form 16 Part A and Part B for FY 2025-26.');
    assert.strictEqual(data.request.adminNotes, null);
    assert.strictEqual(data.uploadToken, token, 'uploadToken should be provided for DOCUMENTS_REQUIRED');

    // CRITICAL: Ensure absolutely 0 emails were triggered by page refresh / session restoration
    assert.strictEqual(
      getMockSentEmails().length,
      initialEmailCount,
      'Page refresh via GET /track/session must NEVER dispatch OTP or notification emails'
    );
  });

  await t.test('3. Expired tracking session token returns HTTP 401 SESSION_EXPIRED', async () => {
    const expiredToken = jwt.sign(
      {
        sub: testRequest.id,
        requestId: testRequest.requestId,
        purpose: 'customer_tracking_session',
        permissions: ['track', 'upload'],
      },
      config.jwt.secret,
      { expiresIn: '-1s' } // Expired in the past
    );

    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${expiredToken}`,
      },
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'SESSION_EXPIRED');
    assert.ok(body.error.toLowerCase().includes('expired'));
  });

  await t.test('4. Tampered or invalid signature token returns HTTP 401 INVALID_TOKEN', async () => {
    const tamperedToken = jwt.sign(
      {
        sub: testRequest.id,
        requestId: testRequest.requestId,
        purpose: 'customer_tracking_session',
      },
      'wrong-secret-key',
      { expiresIn: '15m' }
    );

    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tamperedToken}`,
      },
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'INVALID_TOKEN');
  });

  await t.test('5. Missing session token returns HTTP 401 TOKEN_REQUIRED', async () => {
    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'TOKEN_REQUIRED');
  });

  await t.test('6. Authorization scope: token without "track" permission is rejected on /track/session', async () => {
    const nonTrackToken = jwt.sign(
      {
        sub: testRequest.id,
        requestId: testRequest.requestId,
        purpose: 'customer_tracking_session',
        permissions: ['upload'], // missing 'track'
      },
      config.jwt.secret,
      { expiresIn: '15m' }
    );

    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${nonTrackToken}`,
      },
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.code, 'INSUFFICIENT_PERMISSIONS');
  });

  await t.test('7. Authorization scope: token for Request A cannot upload to Request B', async () => {
    const tokenReqA = jwt.sign(
      {
        sub: testRequest.id,
        requestId: testRequest.requestId,
        purpose: 'customer_tracking_session',
        permissions: ['track', 'upload'],
      },
      config.jwt.secret,
      { expiresIn: '15m' }
    );

    // Attempt to upload to a different service request ID
    const formData = new FormData();
    formData.append('documentType', 'Identity Proof');
    const blob = new Blob(['%PDF-1.4 dummy content'], { type: 'application/pdf' });
    formData.append('file', blob, 'id_proof.pdf');

    const res = await fetch(`${docBaseUrl}/upload/different-request-id`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenReqA}`,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.toLowerCase().includes('not authorized for this service request'));
  });

  await t.test('8. Admin JWT cannot be reused as customer tracking or upload token', async () => {
    const adminToken = jwt.sign(
      {
        id: 'admin-uuid-1',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN',
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    // Fails because purpose is not customer_tracking_session
    assert.strictEqual(res.status, 403);
  });

  await t.test('9. Admin status update to DOCUMENTS_REQUIRED sends customer email and deduplicates on repeat', async () => {
    clearMockSentEmails();

    const adminJwt = jwt.sign(
      { id: 'admin-uuid-1', email: 'admin@example.com' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // 1. Initial admin status change to DOCUMENTS_REQUIRED
    const updateRes1 = await fetch(`${baseUrl}/${testRequest.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({
        status: 'DOCUMENTS_REQUIRED',
        note: 'Please provide Bank Statement for last 6 months',
        customerMessage: 'Please provide Bank Statement for last 6 months',
      }),
    });

    assert.strictEqual(updateRes1.status, 200);
    const sentEmails1 = getMockSentEmails();
    assert.strictEqual(sentEmails1.length, 1, 'First document request must trigger an email');
    assert.strictEqual(sentEmails1[0].to, testCustomer.email);
    assert.ok(sentEmails1[0].subject.includes('Action Required'), 'Subject should indicate document request');
    assert.ok(sentEmails1[0].html.includes('Bank Statement for last 6 months'), 'Email content must contain admin note');

    // 2. Immediate repeated save by admin with same note (e.g. double-click or editing note without change)
    const updateRes2 = await fetch(`${baseUrl}/${testRequest.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({
        status: 'DOCUMENTS_REQUIRED',
        note: 'Please provide Bank Statement for last 6 months',
        customerMessage: 'Please provide Bank Statement for last 6 months',
      }),
    });

    assert.strictEqual(updateRes2.status, 200);
    const sentEmails2 = getMockSentEmails();
    assert.strictEqual(
      sentEmails2.length,
      1,
      'Repeated save within 15-minute window must be deduplicated (no duplicate email sent)'
    );

    // 3. Status change to DOCUMENTS_REQUIRED with a DIFFERENT note should send a new notification
    const updateRes3 = await fetch(`${baseUrl}/${testRequest.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({
        status: 'DOCUMENTS_REQUIRED',
        note: 'Additional document: Also upload Salary Slip for March 2026',
        customerMessage: 'Additional document: Also upload Salary Slip for March 2026',
      }),
    });

    assert.strictEqual(updateRes3.status, 200);
    const sentEmails3 = getMockSentEmails();
    assert.strictEqual(sentEmails3.length, 2, 'Different document request message must trigger a new email');
    assert.ok(sentEmails3[1].html.includes('Salary Slip for March 2026'));
  });

  await t.test('10. Legacy request fallback: customerMessage falls back to statusHistory note if formData has none', async () => {
    const legacyRequest = {
      id: 'req-legacy-uuid-1',
      requestId: 'REQ-LEGACY-001',
      customerId: testCustomer.id,
      serviceId: 'srv-tax-1',
      status: 'DOCUMENTS_REQUIRED',
      formData: null,
      documents: [],
      statusHistory: [
        {
          id: 'sh-legacy-1',
          newStatus: 'DOCUMENTS_REQUIRED',
          note: 'Legacy note: Upload PAN card photo',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.serviceRequests.set(legacyRequest.id, legacyRequest);

    const token = jwt.sign(
      {
        sub: legacyRequest.id,
        requestId: legacyRequest.requestId,
        purpose: 'customer_tracking_session',
        permissions: ['track', 'upload'],
      },
      config.jwt.secret,
      { expiresIn: '15m' }
    );

    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.request.customerMessage, 'Legacy note: Upload PAN card photo');
    assert.strictEqual(body.request.adminNotes, null);
  });

  await t.test('11. CORS preflight OPTIONS request permits X-Tracking-Token and Authorization headers', async () => {
    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://financial-services-web.onrender.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization, x-tracking-token',
      },
    });

    assert.strictEqual(res.status, 204, 'CORS preflight OPTIONS must return 204');
    const allowHeaders = (res.headers.get('access-control-allow-headers') || '').toLowerCase();
    assert.ok(allowHeaders.includes('x-tracking-token'), `CORS must permit x-tracking-token in allowed headers, got: ${allowHeaders}`);
    assert.ok(allowHeaders.includes('authorization'), `CORS must permit authorization in allowed headers, got: ${allowHeaders}`);
  });

  await t.test('12. Expired tracking session token via X-Tracking-Token header returns HTTP 401 SESSION_EXPIRED', async () => {
    const expiredToken = jwt.sign(
      {
        sub: testRequest.id,
        requestId: testRequest.requestId,
        purpose: 'customer_tracking_session',
        permissions: ['track', 'upload'],
      },
      config.jwt.secret,
      { expiresIn: '-1s' }
    );

    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'X-Tracking-Token': expiredToken,
      },
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'SESSION_EXPIRED');
    assert.ok(body.error.toLowerCase().includes('expired'));
  });

  await t.test('13. Tampered or invalid token signature via X-Tracking-Token header returns HTTP 401 INVALID_TOKEN', async () => {
    const tamperedToken = jwt.sign(
      {
        sub: testRequest.id,
        requestId: testRequest.requestId,
        purpose: 'customer_tracking_session',
      },
      'wrong-secret-key',
      { expiresIn: '15m' }
    );

    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'X-Tracking-Token': tamperedToken,
      },
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'INVALID_TOKEN');
  });

  await t.test('14. Malformed non-JWT token string returns HTTP 401 INVALID_TOKEN', async () => {
    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer totally-malformed-not-a-jwt',
        'X-Tracking-Token': 'totally-malformed-not-a-jwt',
      },
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'INVALID_TOKEN');
  });

  await t.test('15. Token sub referencing non-existent service request returns HTTP 404 NOT_FOUND', async () => {
    const orphanToken = jwt.sign(
      {
        sub: 'non-existent-uuid',
        requestId: 'REQ-DOES-NOT-EXIST',
        purpose: 'customer_tracking_session',
        permissions: ['track'],
      },
      config.jwt.secret,
      { expiresIn: '15m' }
    );

    const res = await fetch(`${baseUrl}/track/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${orphanToken}`,
        'X-Tracking-Token': orphanToken,
      },
    });

    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.code, 'NOT_FOUND');
  });
});
