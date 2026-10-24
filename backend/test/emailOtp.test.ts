/**
 * Secure Email OTP Verification Test Suite
 *
 * Verifies:
 * 1. Cryptographic OTP generation (6 digits, CSPRNG, randomInt), HMAC-SHA256 hashing, timingSafeEqual comparison, and email masking.
 * 2. OTP generation, database persistence with unique salt and hash, and delivery via Resend service.
 * 3. Never logging or storing plaintext OTPs or sensitive secrets.
 * 4. Invalidation of previous active OTPs upon replacement issue.
 * 5. 60-second cooldown enforcement against rapid resends.
 * 6. Successful OTP verification issuing narrowly scoped JWT uploadToken and sanitized tracking details.
 * 7. Single-use replay rejection (consumedAt prevents reuse).
 * 8. Incremental attempt counting and lockout after 5 failed attempts.
 * 9. Expiry enforcement (10 minutes).
 * 10. Fail-closed email ownership: customer without email or non-existent request yields generic response without email dispatch.
 * 11. Atomic database concurrency protection: concurrent verifications prevent double consumption.
 * 12. Pre-Multer authorization integration: document upload requires valid OTP-issued uploadToken.
 * 13. Rate limiting for OTP request and OTP verification.
 * 14. Email delivery failure handling in production vs dev/test mode.
 */

import test from 'node:test';
import assert from 'node:assert';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';
import { config } from '../src/config';
import serviceRequestRoutes from '../src/routes/serviceRequests';
import documentRoutes from '../src/routes/documents';
import {
  generateOtp,
  generateSalt,
  hashOtp,
  verifyOtpHash,
  maskEmail,
  getOtpHmacKey,
} from '../src/utils/otp';
import {
  getMockSentEmails,
  clearMockSentEmails,
  setMockEmailSender,
} from '../src/services/emailService';
import {
  getMulterStorageInvocations,
  resetMulterStorageInvocations,
} from '../src/middleware/upload';

function createTestServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/service-requests', serviceRequestRoutes);
  app.use('/api/documents', documentRoutes);

  // Global error handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

test('Email OTP Verification Suite', async (t) => {
  const app = createTestServer();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/service-requests`;
  const docBaseUrl = `http://localhost:${port}/api/documents`;

  // In-memory mock database for isolated testing
  const mockDb = {
    services: [
      { id: 'srv-1', name: 'Income Tax Return (ITR)', category: 'TAXATION', slug: 'itr' },
    ],
    customers: new Map<string, any>(),
    serviceRequests: new Map<string, any>(),
    emailOtps: new Map<string, any>(),
    statusHistory: [] as any[],
  };

  // Seed initial customer and request
  const testCustomer = {
    id: 'cust-otp-1',
    name: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul.sharma@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockDb.customers.set(testCustomer.id, testCustomer);

  const testCustomerNoEmail = {
    id: 'cust-otp-no-email',
    name: 'Anita Verma',
    phone: '9812345678',
    email: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockDb.customers.set(testCustomerNoEmail.id, testCustomerNoEmail);

  const testRequest = {
    id: 'req-otp-uuid-1',
    requestId: 'REQ-2026-OTP01',
    customerId: testCustomer.id,
    serviceId: 'srv-1',
    status: 'DOCUMENTS_REQUIRED',
    panEncrypted: null as string | null,
    formDataEncrypted: null as string | null,
    documents: [],
    statusHistory: [
      { id: 'sh-1', newStatus: 'DOCUMENTS_REQUIRED', note: 'Please upload Form 16', createdAt: new Date() },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockDb.serviceRequests.set(testRequest.id, testRequest);

  const testRequestNoEmail = {
    id: 'req-otp-uuid-no-email',
    requestId: 'REQ-2026-NOEMAIL',
    customerId: testCustomerNoEmail.id,
    serviceId: 'srv-1',
    status: 'DOCUMENTS_REQUIRED',
    panEncrypted: null as string | null,
    formDataEncrypted: null as string | null,
    documents: [],
    statusHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockDb.serviceRequests.set(testRequestNoEmail.id, testRequestNoEmail);

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

  (prisma.emailOtp as any).create = async (query: any) => {
    const id = `otp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record = {
      id,
      consumedAt: null,
      ...query.data,
      createdAt: query.data.createdAt || new Date(),
      updatedAt: new Date(),
    };
    mockDb.emailOtps.set(id, record);
    return record;
  };

  (prisma.emailOtp as any).update = async (query: any) => {
    const record = mockDb.emailOtps.get(query.where.id);
    if (!record) throw new Error('Record not found');

    if (query.data?.attempts?.increment) {
      record.attempts += query.data.attempts.increment;
    } else if (typeof query.data?.attempts === 'number') {
      record.attempts = query.data.attempts;
    }

    if (query.data?.consumedAt) {
      record.consumedAt = query.data.consumedAt;
    }
    record.updatedAt = new Date();
    return record;
  };

  (prisma.emailOtp as any).updateMany = async (query: any) => {
    let count = 0;
    for (const record of mockDb.emailOtps.values()) {
      if (query.where?.id && record.id !== query.where.id) continue;
      if (query.where?.serviceRequestId && record.serviceRequestId !== query.where.serviceRequestId) continue;
      if (query.where?.consumedAt === null && record.consumedAt !== null && record.consumedAt !== undefined) continue;

      if (query.data?.consumedAt) {
        record.consumedAt = query.data.consumedAt;
      }
      count++;
    }
    return { count };
  };

  (prisma.emailOtp as any).findUnique = async (query: any) => {
    return mockDb.emailOtps.get(query?.where?.id) || null;
  };

  const rowLocks = new Map<string, Promise<void>>();
  const releaseFns = new Map<string, () => void>();

  (prisma as any).$executeRaw = async () => 1;

  (prisma as any).$transaction = async (fnOrOps: any) => {
    if (typeof fnOrOps === 'function') {
      const activeLocks: string[] = [];
      const txPrisma = Object.create(prisma);
      txPrisma.$executeRaw = async (strings: any, ...values: any[]) => {
        const sql = strings ? (typeof strings === 'string' ? strings : strings.join('?')) : '';
        if (sql.toUpperCase().includes('FOR UPDATE') && values.length > 0) {
          const lockKey = String(values[0]);
          while (rowLocks.has(lockKey) && !activeLocks.includes(lockKey)) {
            await rowLocks.get(lockKey);
          }
          if (!activeLocks.includes(lockKey)) {
            let release: () => void;
            const promise = new Promise<void>((resolve) => {
              release = resolve;
            });
            rowLocks.set(lockKey, promise);
            releaseFns.set(lockKey, release!);
            activeLocks.push(lockKey);
          }
        }
        return 1;
      };

      try {
        const result = await fnOrOps(txPrisma);
        return result;
      } finally {
        for (const lockKey of activeLocks) {
          const release = releaseFns.get(lockKey);
          if (release) release();
          rowLocks.delete(lockKey);
          releaseFns.delete(lockKey);
        }
      }
    }
    return Promise.all(fnOrOps);
  };

  t.after(() => {
    server.close();
  });

  await t.test('1. Cryptographic OTP primitives and email masking', async () => {
    // 6-digit uniform CSPRNG check
    for (let i = 0; i < 50; i++) {
      const code = generateOtp();
      assert.match(code, /^\d{6}$/, 'OTP must be exactly 6 decimal digits');
      const num = parseInt(code, 10);
      assert.ok(num >= 100000 && num <= 999999, 'OTP must be between 100000 and 999999');
    }

    // Salt generation
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    assert.strictEqual(salt1.length, 64, 'Salt should be 64 hex characters (32 bytes)');
    assert.notStrictEqual(salt1, salt2, 'Salts must be uniquely generated');

    // Hashing and timing-safe verification
    const testOtp = '482915';
    const hash = hashOtp(testOtp, salt1);
    assert.strictEqual(hash.length, 64, 'HMAC-SHA256 hex output must be 64 characters');

    assert.strictEqual(verifyOtpHash(testOtp, salt1, hash), true, 'Valid code and salt must verify');
    assert.strictEqual(verifyOtpHash('123456', salt1, hash), false, 'Wrong code must fail verification');
    assert.strictEqual(verifyOtpHash(testOtp, salt2, hash), false, 'Wrong salt must fail verification');

    // Email masking
    assert.strictEqual(maskEmail('rahul.sharma@example.com'), 'r***a@example.com');
    assert.strictEqual(maskEmail('a@b.com'), 'a*@b.com');
    assert.strictEqual(maskEmail('ab@test.org'), 'a*@test.org');
    assert.strictEqual(maskEmail('invalid-email'), '***@***.***');
  });

  await t.test('2. Successful OTP request: generates hash, salt, expiry, and sends branded email', async () => {
    clearMockSentEmails();
    mockDb.emailOtps.clear();

    const res = await fetch(`${baseUrl}/track/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.1.1',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.maskedEmail, undefined, 'Must NOT expose maskedEmail in standardized public response');
    assert.strictEqual(body.cooldownSeconds, undefined, 'Must NOT expose cooldownSeconds in standardized 200 response');
    assert.deepStrictEqual(Object.keys(body).sort(), ['message', 'success'], 'Response keys must be standardized to prevent oracle leakage');

    // Verify OTP record in DB
    const otps = Array.from(mockDb.emailOtps.values());
    assert.strictEqual(otps.length, 1);
    const otpRecord = otps[0];
    assert.strictEqual(otpRecord.serviceRequestId, testRequest.id);
    assert.strictEqual(otpRecord.email, testCustomer.email);
    assert.strictEqual(otpRecord.attempts, 0);
    assert.strictEqual(otpRecord.maxAttempts, 5);
    assert.strictEqual(otpRecord.consumedAt, null);
    assert.strictEqual(otpRecord.salt.length, 64);
    assert.strictEqual(otpRecord.codeHash.length, 64);
    // Plaintext OTP should NEVER be stored
    assert.strictEqual((otpRecord as any).otp, undefined);
    assert.strictEqual((otpRecord as any).code, undefined);

    // Verify email was dispatched with the matching code
    const sent = getMockSentEmails();
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].to, testCustomer.email);
    assert.ok(sent[0].subject.includes('Verification Code'));
    assert.ok(sent[0].html.includes('REQ-2026-OTP01'));

    // Extract OTP from email
    const match = sent[0].text?.match(/\b\d{6}\b/);
    assert.ok(match, 'Email text should contain the 6-digit OTP');
    const sentOtp = match[0];

    // Verify hash matches
    assert.strictEqual(verifyOtpHash(sentOtp, otpRecord.salt, otpRecord.codeHash), true);
  });

  await t.test('3. Cooldown enforcement: prevents rapid re-requesting within 60s', async () => {
    // An active OTP exists with createdAt = now
    const res = await fetch(`${baseUrl}/track/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.1.2',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
      }),
    });

    assert.strictEqual(res.status, 429);
    const body = await res.json();
    assert.ok(body.error.includes('Please wait'));
  });

  await t.test('4. Replacement code invalidates previous unconsumed active OTP', async () => {
    clearMockSentEmails();
    // Simulate cooldown elapsed by setting latest OTP createdAt to 70 seconds ago
    const otps = Array.from(mockDb.emailOtps.values());
    const firstOtp = otps[0];
    firstOtp.createdAt = new Date(Date.now() - 70 * 1000);

    const res = await fetch(`${baseUrl}/track/resend-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.1.3',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
      }),
    });

    assert.strictEqual(res.status, 200);

    // The first OTP must now be marked consumed/invalidated
    assert.ok(firstOtp.consumedAt !== null, 'Previous unconsumed OTP must be marked consumed');

    // A new unconsumed OTP must exist
    const allOtps = Array.from(mockDb.emailOtps.values());
    assert.strictEqual(allOtps.length, 2);
    const secondOtp = allOtps.find((o) => o.id !== firstOtp.id);
    assert.ok(secondOtp);
    assert.strictEqual(secondOtp.consumedAt, null);
  });

  await t.test('5. Incorrect verification code increments attempt count and returns attempts remaining', async () => {
    const res = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.1.4',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: '000000', // Incorrect
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('4 attempts remaining'));

    // Check attempt increment in DB
    const otps = Array.from(mockDb.emailOtps.values()).filter((o) => o.consumedAt === null);
    assert.strictEqual(otps.length, 1);
    assert.strictEqual(otps[0].attempts, 1);
  });

  await t.test('6. Lockout after 5 failed attempts: marks OTP consumed and rejects further attempts', async () => {
    // Send 3 more incorrect attempts (reaching 4 total attempts)
    for (let i = 2; i <= 4; i++) {
      const res = await fetch(`${baseUrl}/track/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `10.1.2.${i}`,
        },
        body: JSON.stringify({
          requestId: 'REQ-2026-OTP01',
          phone: '9876543210',
          otp: '000000',
        }),
      });
      assert.strictEqual(res.status, 400);
    }

    // 5th attempt triggers lockout
    const fifthRes = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.2.5',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: '000000',
      }),
    });
    assert.strictEqual(fifthRes.status, 400);
    const fifthBody = await fifthRes.json();
    assert.ok(fifthBody.error.includes('Maximum verification attempts exceeded'));

    // Verify all active OTPs are now consumed/locked
    const active = Array.from(mockDb.emailOtps.values()).filter((o) => o.consumedAt === null);
    assert.strictEqual(active.length, 0);

    // Subsequent attempt is rejected
    const sixthRes = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.2.6',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: '000000',
      }),
    });
    assert.strictEqual(sixthRes.status, 400);
  });

  await t.test('7. Expiry check: expired OTP cannot be verified', async () => {
    // Create an expired OTP in mockDb
    const expiredOtp = {
      id: 'otp-expired',
      serviceRequestId: testRequest.id,
      email: testCustomer.email,
      salt: generateSalt(),
      codeHash: hashOtp('112233', generateSalt()),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      consumedAt: null,
      createdAt: new Date(Date.now() - 11 * 60 * 1000),
    };
    mockDb.emailOtps.set(expiredOtp.id, expiredOtp);

    const res = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.3.1',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: '112233',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('expired'));
    assert.ok(expiredOtp.consumedAt !== null, 'Expired OTP should be marked consumed');
  });

  await t.test('8. Successful verification: marks consumed, issues uploadToken, sanitizes data', async () => {
    clearMockSentEmails();
    // Issue fresh OTP
    const validSalt = generateSalt();
    const validCode = '739104';
    const validHash = hashOtp(validCode, validSalt);

    const freshOtp = {
      id: 'otp-success-test',
      serviceRequestId: testRequest.id,
      email: testCustomer.email,
      salt: validSalt,
      codeHash: validHash,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    };
    mockDb.emailOtps.set(freshOtp.id, freshOtp);

    const res = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.4.1',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: validCode,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.uploadToken, 'uploadToken must be issued for DOCUMENTS_REQUIRED status');

    // Verify token validity
    const decoded = jwt.verify(body.uploadToken, config.jwt.secret) as any;
    assert.strictEqual(decoded.sub, testRequest.id);
    assert.strictEqual(decoded.requestId, testRequest.requestId);
    assert.ok(
      decoded.purpose === 'customer_tracking_session' || decoded.purpose === 'customer_document_upload',
      `Expected token purpose to be customer_tracking_session or customer_document_upload, got ${decoded.purpose}`
    );

    // Verify data sanitization
    assert.strictEqual(body.request.requestId, 'REQ-2026-OTP01');
    assert.strictEqual(body.request.status, 'DOCUMENTS_REQUIRED');
    assert.strictEqual((body.request as any).customer, undefined, 'Customer object must not be exposed');
    assert.strictEqual((body.request as any).panEncrypted, undefined, 'PAN must not be exposed');
    assert.strictEqual((body.request as any).policyNumber, undefined, 'Policy number must not be exposed');
    assert.strictEqual((body.request as any).priority, undefined, 'Priority must not be exposed');
    assert.strictEqual((body as any).timeline, undefined, 'Timeline must not be exposed');
    assert.strictEqual(body.request.adminNotes, null, 'Internal notes must not be leaked');
    // Ensure raw hashes/salts are never returned
    assert.strictEqual((body as any).codeHash, undefined);
    assert.strictEqual((body as any).salt, undefined);

    // Verify OTP is atomically consumed
    assert.ok(freshOtp.consumedAt !== null, 'OTP must be marked consumed');

    // Replay attack prevention: attempting to verify same OTP again immediately fails
    const replayRes = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.4.2',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: validCode,
      }),
    });

    assert.strictEqual(replayRes.status, 400);
    const replayBody = await replayRes.json();
    assert.ok(replayBody.error.includes('Invalid or expired') || replayBody.error.includes('already used'));
  });

  await t.test('9. Fail-closed ownership: customer without email or non-existent request yields generic response without email dispatch', async () => {
    clearMockSentEmails();
    const countBefore = mockDb.emailOtps.size;

    // 1. Request for customer with NO email registered
    const noEmailRes = await fetch(`${baseUrl}/track/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.5.1',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-NOEMAIL',
        phone: '9812345678',
      }),
    });

    assert.strictEqual(noEmailRes.status, 200);
    const noEmailBody = await noEmailRes.json();
    assert.strictEqual(noEmailBody.success, true);
    assert.strictEqual(noEmailBody.maskedEmail, undefined, 'Must NOT return maskedEmail when no email exists');
    assert.deepStrictEqual(Object.keys(noEmailBody).sort(), ['message', 'success']);
    assert.strictEqual(getMockSentEmails().length, 0, 'Must NOT dispatch any email');
    assert.strictEqual(mockDb.emailOtps.size, countBefore, 'Must NOT create any OTP record');

    // 2. Request for completely non-existent request
    const notFoundRes = await fetch(`${baseUrl}/track/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.5.2',
      },
      body: JSON.stringify({
        requestId: 'REQ-NON-EXISTENT',
        phone: '9999999999',
      }),
    });

    assert.strictEqual(notFoundRes.status, 200);
    const notFoundBody = await notFoundRes.json();
    assert.strictEqual(notFoundBody.success, true);
    assert.deepStrictEqual(Object.keys(notFoundBody).sort(), ['message', 'success']);
    assert.strictEqual(notFoundBody.message, noEmailBody.message, 'Message must be identical to prevent enumeration');
    assert.strictEqual(getMockSentEmails().length, 0);
  });

  await t.test('10. Pre-Multer authorization integration with verified uploadToken', async () => {
    resetMulterStorageInvocations();

    // Generate a legitimate token from verified OTP flow
    const validToken = jwt.sign(
      {
        sub: testRequest.id,
        requestId: testRequest.requestId,
        purpose: 'customer_document_upload',
        jti: 'test-jti-1',
      },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    // Mismatched request token (cross-request token attack)
    const mismatchedToken = jwt.sign(
      {
        sub: 'other-request-uuid',
        requestId: 'REQ-OTHER-99',
        purpose: 'customer_document_upload',
        jti: 'test-jti-2',
      },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    // Attempt 1: Upload without token -> Rejected with 401 before Multer
    const noTokenRes = await fetch(`${docBaseUrl}/upload/${testRequest.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.6.1',
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(noTokenRes.status, 401);
    assert.strictEqual(getMulterStorageInvocations(), 0, 'Multer must NOT be called without token');

    // Attempt 2: Upload with mismatched request token -> Rejected with 403 before Multer
    const mismatchRes = await fetch(`${docBaseUrl}/upload/${testRequest.id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mismatchedToken}`,
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.6.2',
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(mismatchRes.status, 403);
    assert.strictEqual(getMulterStorageInvocations(), 0, 'Multer must NOT be called with mismatched token');

    // Attempt 3: Expired token -> Rejected with 401 before Multer
    const expiredToken = jwt.sign(
      {
        sub: testRequest.id,
        requestId: testRequest.requestId,
        purpose: 'customer_document_upload',
        jti: 'test-jti-3',
      },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: '-1s' }
    );
    const expiredRes = await fetch(`${docBaseUrl}/upload/${testRequest.id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.1.6.3',
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(expiredRes.status, 401);
    assert.strictEqual(getMulterStorageInvocations(), 0, 'Multer must NOT be called with expired token');
  });

  await t.test('11. Atomic concurrency check: concurrent requests cannot double-consume OTP', async () => {
    const salt = generateSalt();
    const code = '654321';
    const concurrentOtp = {
      id: 'otp-concurrent-test',
      serviceRequestId: testRequest.id,
      email: testCustomer.email,
      salt,
      codeHash: hashOtp(code, salt),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    };
    mockDb.emailOtps.set(concurrentOtp.id, concurrentOtp);

    // Fire 2 concurrent verification requests from unique IPs
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/track/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.1.7.1',
        },
        body: JSON.stringify({
          requestId: 'REQ-2026-OTP01',
          phone: '9876543210',
          otp: code,
        }),
      }),
      fetch(`${baseUrl}/track/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.1.7.2',
        },
        body: JSON.stringify({
          requestId: 'REQ-2026-OTP01',
          phone: '9876543210',
          otp: code,
        }),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // One must succeed (200) and the other must fail (400)
    assert.deepStrictEqual(statuses, [200, 400], 'Exactly one concurrent verification must succeed');
  });

  await t.test('12. Rate limiting enforcement on request and verify endpoints', async () => {
    const testIpReq = '10.200.1.1';
    // 5 requests allowed, 6th must return 429
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${baseUrl}/track/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testIpReq,
        },
        body: JSON.stringify({
          requestId: 'REQ-NON-EXISTENT',
          phone: '9876543210',
        }),
      });
      assert.strictEqual(r.status, 200);
    }

    const blockedReq = await fetch(`${baseUrl}/track/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': testIpReq,
      },
      body: JSON.stringify({
        requestId: 'REQ-NON-EXISTENT',
        phone: '9876543210',
      }),
    });
    assert.strictEqual(blockedReq.status, 429);
    const blockedReqBody = await blockedReq.json();
    assert.ok(blockedReqBody.error.includes('Too many verification code requests'));

    // Verify rate limit on verify endpoint: 10 allowed, 11th must return 429
    const testIpVer = '10.200.2.2';
    for (let i = 0; i < 10; i++) {
      const r = await fetch(`${baseUrl}/track/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testIpVer,
        },
        body: JSON.stringify({
          requestId: 'REQ-NON-EXISTENT',
          phone: '9876543210',
          otp: '123456',
        }),
      });
      assert.strictEqual(r.status, 400);
    }

    const blockedVer = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': testIpVer,
      },
      body: JSON.stringify({
        requestId: 'REQ-NON-EXISTENT',
        phone: '9876543210',
        otp: '123456',
      }),
    });
    assert.strictEqual(blockedVer.status, 429);
    const blockedVerBody = await blockedVer.json();
    assert.ok(blockedVerBody.error.includes('Too many verification attempts'));
  });

  await t.test('13. Legacy GET /track route unconditionally denies access (HTTP 403) and cannot bypass OTP', async () => {
    // Attempt to access tracking details and obtain uploadToken via GET /track
    const res = await fetch(`${baseUrl}/track?requestId=REQ-2026-OTP01&phone=9876543210`, {
      method: 'GET',
      headers: {
        'X-Forwarded-For': '10.99.1.1',
      },
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.uploadToken, undefined, 'Legacy GET /track must NEVER issue uploadToken');
    assert.strictEqual(body.request, undefined, 'Legacy GET /track must NEVER return request details');
    assert.ok(body.error.includes('Direct tracking without email OTP verification is disabled'));
  });

  await t.test('14. HKDF OTP key derivation: domain separation and empty secret fail-safe', async () => {
    // Derivation produces 32-byte key buffer
    const key = getOtpHmacKey();
    assert.ok(Buffer.isBuffer(key));
    assert.strictEqual(key.length, 32);

    // Derivation is deterministic with same secret
    const key2 = getOtpHmacKey();
    assert.deepStrictEqual(key, key2);

    // Derivation differs from raw secret (domain separation)
    const rawSecretBuffer = Buffer.from(config.jwt.secret);
    assert.notDeepStrictEqual(key, rawSecretBuffer.slice(0, 32));

    // Fails fast when secret is empty or whitespace
    assert.throws(() => getOtpHmacKey(''), /FATAL: Cannot derive OTP HMAC key because JWT secret is missing or empty/);
    assert.throws(() => getOtpHmacKey('   '), /FATAL: Cannot derive OTP HMAC key because JWT secret is missing or empty/);
  });

  await t.test('15. Concurrent OTP requests: simultaneous requests cannot bypass 60s cooldown or duplicate active OTPs', async () => {
    clearMockSentEmails();
    mockDb.emailOtps.clear();

    // Fire 2 concurrent requests for the exact same service request from unique IPs
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/track/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.50.1.1',
        },
        body: JSON.stringify({
          requestId: 'REQ-2026-OTP01',
          phone: '9876543210',
        }),
      }),
      fetch(`${baseUrl}/track/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '10.50.1.2',
        },
        body: JSON.stringify({
          requestId: 'REQ-2026-OTP01',
          phone: '9876543210',
        }),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(statuses, [200, 429], 'Exactly one request must succeed and the other must hit cooldown (429)');

    const errRes = res1.status === 429 ? res1 : res2;
    const errBody = await errRes.json();
    assert.ok(errBody.error.includes('Please wait'));
    assert.strictEqual(typeof errBody.cooldownSeconds, 'number');

    // Exactly one active OTP should have been created in the database
    const unconsumedOtps = Array.from(mockDb.emailOtps.values()).filter((o) => o.consumedAt === null);
    assert.strictEqual(unconsumedOtps.length, 1, 'Only one active OTP must exist');

    // Exactly one email should have been dispatched via Resend
    assert.strictEqual(getMockSentEmails().length, 1, 'Only one email must be sent');
  });

  await t.test('16. Concurrent OTP lockout: parallel incorrect guesses cannot exceed maxAttempts without lockout', async () => {
    mockDb.emailOtps.clear();

    // Create an active OTP record with 0 attempts
    const validSalt = generateSalt();
    const correctCode = '888888';
    const otpId = 'otp-concurrent-lockout';
    const concurrentLockoutOtp = {
      id: otpId,
      serviceRequestId: testRequest.id,
      email: testCustomer.email,
      salt: validSalt,
      codeHash: hashOtp(correctCode, validSalt),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    };
    mockDb.emailOtps.set(otpId, concurrentLockoutOtp);

    // Fire 5 parallel incorrect guesses from different IP addresses
    const responses = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        fetch(`${baseUrl}/track/verify-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `10.60.1.${i}`,
          },
          body: JSON.stringify({
            requestId: 'REQ-2026-OTP01',
            phone: '9876543210',
            otp: `00000${i}`,
          }),
        })
      )
    );

    // All 5 must fail with status 400
    for (const r of responses) {
      assert.strictEqual(r.status, 400);
    }

    const bodies = await Promise.all(responses.map((r) => r.json()));
    const lockoutBodies = bodies.filter((b) => b.error.includes('Maximum verification attempts exceeded'));
    assert.ok(lockoutBodies.length >= 1, 'Lockout message must be triggered when maxAttempts reached');

    // The record in mockDb must have reached attempts 5 and consumedAt must NOT be null
    const finalOtp = mockDb.emailOtps.get(otpId);
    assert.strictEqual(finalOtp.attempts, 5, 'Attempts must strictly equal maxAttempts (5)');
    assert.ok(finalOtp.consumedAt !== null, 'OTP must be marked consumed upon reaching maxAttempts');

    // A 6th attempt must be rejected as locked out / consumed without increasing attempts
    const sixthRes = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.60.1.6',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: '000006',
      }),
    });
    assert.strictEqual(sixthRes.status, 400);
    const sixthBody = await sixthRes.json();
    assert.ok(sixthBody.error.includes('Maximum verification attempts exceeded') || sixthBody.error.includes('Invalid or expired'));
    assert.strictEqual(finalOtp.attempts, 5, 'Attempts must not increment beyond 5');
  });

  await t.test('17. Failed email delivery does not leave usable orphan OTP and leaves newer OTP intact', async () => {
    clearMockSentEmails();
    mockDb.emailOtps.clear();

    // 1. Simulate email delivery failure
    setMockEmailSender(async () => ({ success: false, error: 'Resend API rate limit or network failure' }));

    const failReqRes = await fetch(`${baseUrl}/track/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.70.1.1',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
      }),
    });

    // In non-production, returns 200 genericSuccess, but OTP must be neutralized
    assert.strictEqual(failReqRes.status, 200);
    const failedOtps = Array.from(mockDb.emailOtps.values());
    assert.strictEqual(failedOtps.length, 1);
    const orphanOtp = failedOtps[0];
    assert.ok(orphanOtp.consumedAt !== null, 'Unsent OTP must be immediately marked consumed so it cannot be used');

    // Attempting to verify this orphan OTP must fail
    const orphanVerifyRes = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.70.1.2',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: '123456',
      }),
    });
    assert.strictEqual(orphanVerifyRes.status, 400);

    // 2. Restore working email sender
    setMockEmailSender(null);

    // 3. Fast-forward past cooldown to generate a successful new OTP
    orphanOtp.createdAt = new Date(Date.now() - 70 * 1000);

    const successReqRes = await fetch(`${baseUrl}/track/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.70.1.3',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
      }),
    });
    assert.strictEqual(successReqRes.status, 200);

    const newOtps = Array.from(mockDb.emailOtps.values()).filter((o) => o.id !== orphanOtp.id);
    assert.strictEqual(newOtps.length, 1);
    const validOtp = newOtps[0];
    assert.strictEqual(validOtp.consumedAt, null, 'New OTP must be unconsumed and usable');

    // 4. Extract code from sent email and verify that the new OTP verifies successfully
    const sent = getMockSentEmails();
    const match = sent[sent.length - 1].text?.match(/\b\d{6}\b/);
    assert.ok(match);
    const validCode = match[0];

    const verifyRes = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.70.1.4',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: validCode,
      }),
    });
    assert.strictEqual(verifyRes.status, 200);
    assert.ok(validOtp.consumedAt !== null, 'New OTP is now consumed');
  });

  await t.test('18. Customer verification response strictly minimizes fields and hides internal notes', async () => {
    // Seed request with sensitive fields and internal notes
    (testRequest as any).panEncrypted = 'ENC:SENSITIVE_PAN';
    (testRequest as any).policyNumber = 'LIC-987654321';
    (testRequest as any).priority = 'urgent';
    (testRequest as any).statusHistory = [
      { id: 'sh-1', newStatus: 'DOCUMENTS_REQUIRED', note: 'Customer under internal review for discrepancies', createdAt: new Date() },
      { id: 'sh-2', newStatus: 'UNDER_REVIEW', note: 'Admin internal note: verify tax filings with authorities', createdAt: new Date() },
    ];

    const validSalt = generateSalt();
    const validCode = '555123';
    const minTestOtp = {
      id: 'otp-minimized-payload',
      serviceRequestId: testRequest.id,
      email: testCustomer.email,
      salt: validSalt,
      codeHash: hashOtp(validCode, validSalt),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    };
    mockDb.emailOtps.set(minTestOtp.id, minTestOtp);

    const res = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.80.1.1',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: validCode,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();

    // Required fields must exist
    assert.strictEqual(body.success, true);
    assert.ok(body.uploadToken);
    assert.strictEqual(body.request.id, testRequest.id);
    assert.strictEqual(body.request.requestId, testRequest.requestId);
    assert.strictEqual(body.request.status, 'DOCUMENTS_REQUIRED');
    assert.strictEqual(body.request.service.name, 'Income Tax Return (ITR)');
    assert.ok(Array.isArray(body.documents));

    // Excluded fields must be strictly undefined
    assert.strictEqual((body.request as any).panEncrypted, undefined, 'panEncrypted must NOT be returned');
    assert.strictEqual((body.request as any).policyNumber, undefined, 'policyNumber must NOT be returned');
    assert.strictEqual((body.request as any).priority, undefined, 'priority must NOT be returned');
    assert.strictEqual((body.request as any).customer, undefined, 'customer object must NOT be returned');
    assert.strictEqual((body.request as any).message, undefined, 'message must NOT be returned');
    assert.strictEqual((body.request as any).assessmentYear, undefined, 'assessmentYear must NOT be returned');
    assert.strictEqual((body.request as any).incomeType, undefined, 'incomeType must NOT be returned');
    assert.strictEqual((body.request as any).businessName, undefined, 'businessName must NOT be returned');
    assert.strictEqual((body.request as any).gstStatus, undefined, 'gstStatus must NOT be returned');
    assert.strictEqual((body as any).timeline, undefined, 'timeline array must NOT be returned');

    // adminNotes must be null (no internal statusHistory or AdminNote leak)
    assert.strictEqual(body.request.adminNotes, null, 'adminNotes must be null to prevent internal notes leak');
  });

  await t.test('19. Replaced and expired OTP verification rejection', async () => {
    // 1. Expired OTP
    const expiredSalt = generateSalt();
    const expiredCode = '111222';
    const expiredOtp = {
      id: 'otp-expired-test',
      serviceRequestId: testRequest.id,
      email: testCustomer.email,
      salt: expiredSalt,
      codeHash: hashOtp(expiredCode, expiredSalt),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() - 5 * 1000), // Expired 5 seconds ago
      consumedAt: null,
      createdAt: new Date(Date.now() - 11 * 60 * 1000),
    };
    mockDb.emailOtps.set(expiredOtp.id, expiredOtp);

    const expRes = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.90.1.1',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: expiredCode,
      }),
    });
    assert.strictEqual(expRes.status, 400);
    const expBody = await expRes.json();
    assert.ok(expBody.error.includes('expired'));
    assert.ok(expiredOtp.consumedAt !== null, 'Expired OTP must be marked consumed');

    // 2. Replaced OTP (an older OTP whose consumedAt is not null because a newer one was issued)
    const replacedSalt = generateSalt();
    const replacedCode = '333444';
    const replacedOtp = {
      id: 'otp-replaced-test',
      serviceRequestId: testRequest.id,
      email: testCustomer.email,
      salt: replacedSalt,
      codeHash: hashOtp(replacedCode, replacedSalt),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: new Date(), // Already invalidated/consumed
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
    };
    mockDb.emailOtps.set(replacedOtp.id, replacedOtp);

    const replacedRes = await fetch(`${baseUrl}/track/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.90.1.2',
      },
      body: JSON.stringify({
        requestId: 'REQ-2026-OTP01',
        phone: '9876543210',
        otp: replacedCode,
      }),
    });
    assert.strictEqual(replacedRes.status, 400);
    const replacedBody = await replacedRes.json();
    assert.ok(replacedBody.error.includes('Invalid or expired'));
  });
});
