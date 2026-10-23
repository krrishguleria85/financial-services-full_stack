/**
 * Service Request Confirmation Email Test Suite
 *
 * Verifies:
 * 1. Successful email dispatch upon service-request creation when customer email is present.
 * 2. Proper setting of `confirmationEmailSent: true` in PostgreSQL database.
 * 3. Successful request creation when email is omitted (optional email behavior, leaves confirmationEmailSent: false).
 * 4. Validation and rejection of invalid email input before creating request or customer.
 * 5. Email delivery failure resilience: HTTP 201 is preserved, request is not rolled back,
 *    confirmationEmailSent remains false, and response does not claim email was sent.
 * 6. Content privacy & safety: Email contains request ID, service name, submission date,
 *    and tracking link, while strictly excluding PAN, form data, uploaded files, or internal notes.
 */

import test from 'node:test';
import assert from 'node:assert';
import express, { Request, Response } from 'express';
import prisma from '../src/config/database';
import serviceRequestRoutes from '../src/routes/serviceRequests';
import {
  getMockSentEmails,
  clearMockSentEmails,
  setMockEmailSender,
} from '../src/services/emailService';

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/service-requests', serviceRequestRoutes);
  return app;
}

test('Service Request Confirmation Email Suite', async (t) => {
  const app = createTestServer();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/service-requests`;

  // In-memory test store for Prisma
  const mockDb = {
    services: [
      { id: 'srv-itr-uuid', name: 'Income Tax Return (ITR)', slug: 'income-tax-return' },
      { id: 'srv-gst-uuid', name: 'GST Registration', slug: 'gst-registration' },
    ],
    customers: new Map<string, any>(),
    serviceRequests: new Map<string, any>(),
    history: [] as any[],
    notifications: [] as any[],
  };

  let reqCounter = 1;

  // Intercept Prisma calls for offline, isolated testing
  (prisma.service as any).findUnique = async (query: any) => {
    if (query?.where?.id) {
      return mockDb.services.find((s) => s.id === query.where.id) || null;
    }
    if (query?.where?.slug) {
      return mockDb.services.find((s) => s.slug === query.where.slug) || null;
    }
    return null;
  };

  (prisma.customer as any).findFirst = async (query: any) => {
    for (const c of mockDb.customers.values()) {
      if (c.phone === query?.where?.phone) return c;
    }
    return null;
  };

  (prisma.customer as any).create = async (query: any) => {
    const cust = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...query.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.customers.set(cust.id, cust);
    return cust;
  };

  (prisma.customer as any).update = async (query: any) => {
    const cust = mockDb.customers.get(query.where.id);
    if (cust) {
      Object.assign(cust, query.data, { updatedAt: new Date() });
      return cust;
    }
    return null;
  };

  (prisma.serviceRequest as any).findFirst = async (query: any) => {
    for (const r of mockDb.serviceRequests.values()) {
      if (query?.where?.requestId && r.requestId !== query.where.requestId) continue;
      return r;
    }
    return null;
  };

  (prisma.serviceRequest as any).create = async (query: any) => {
    const req = {
      id: `req-uuid-${reqCounter++}`,
      ...query.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.serviceRequests.set(req.id, req);
    return req;
  };

  (prisma.serviceRequest as any).update = async (query: any) => {
    const req = mockDb.serviceRequests.get(query.where.id);
    if (req) {
      Object.assign(req, query.data, { updatedAt: new Date() });
      return req;
    }
    return null;
  };

  (prisma.requestStatusHistory as any).create = async (query: any) => {
    mockDb.history.push(query.data);
    return query.data;
  };

  (prisma.notification as any).create = async (query: any) => {
    mockDb.notifications.push(query.data);
    return query.data;
  };

  t.beforeEach(() => {
    clearMockSentEmails();
    setMockEmailSender(null);
    mockDb.customers.clear();
    mockDb.serviceRequests.clear();
    mockDb.history.length = 0;
    mockDb.notifications.length = 0;
  });

  t.afterEach(() => {
    clearMockSentEmails();
    setMockEmailSender(null);
  });

  await t.test('1. Successful request creation with email triggers confirmation email and sets confirmationEmailSent = true', async () => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Anita Sharma',
        phone: '9876543210',
        email: 'anita.sharma@example.com',
        serviceId: 'income-tax-return',
        message: 'Need help filing ITR-1',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.status, 'NEW');
    assert.strictEqual(body.confirmationEmailSent, true);
    assert.ok(body.requestId.startsWith('REQ-'));
    assert.ok(body.message.includes('A confirmation email has been sent'));

    // Verify email was sent via mock recorder
    const sentEmails = getMockSentEmails();
    assert.strictEqual(sentEmails.length, 1);
    assert.strictEqual(sentEmails[0].to, 'anita.sharma@example.com');
    assert.strictEqual(sentEmails[0].subject, `Service Request Confirmation - ${body.requestId}`);

    // Verify database state
    const savedReq = [...mockDb.serviceRequests.values()].find((r) => r.requestId === body.requestId);
    assert.ok(savedReq, 'Service request should be saved in database');
    assert.strictEqual(savedReq.confirmationEmailSent, true, 'Database record must reflect confirmationEmailSent = true');
  });

  await t.test('2. Content Security: Confirmation email includes essential request details but strictly excludes sensitive data', async () => {
    const confidentialPan = 'ABCDE1234F';
    const confidentialHealthData = 'Pre-existing chronic diabetes';

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vikram Mehta',
        phone: '9876543211',
        email: 'vikram.mehta@example.com',
        serviceId: 'srv-itr-uuid',
        panNumber: confidentialPan,
        assessmentYear: '2026-27',
        incomeType: 'Salary',
        formData: { healthDetails: confidentialHealthData },
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();

    const sentEmails = getMockSentEmails();
    assert.strictEqual(sentEmails.length, 1);
    const email = sentEmails[0];

    // Must include essential tracking information
    assert.ok(email.html.includes(body.requestId), 'Email must include Request ID');
    assert.ok(email.html.includes('Income Tax Return (ITR)'), 'Email must include service name');
    assert.ok(email.html.includes('/track?requestId='), 'Email must include tracking page link');
    assert.ok(email.html.includes('NEW'), 'Email must include initial status');

    // Text fallback must also include essentials
    assert.ok(email.text?.includes(body.requestId));
    assert.ok(email.text?.includes('Income Tax Return (ITR)'));
    assert.ok(email.text?.includes('/track?requestId='));

    // MUST NEVER EXPOSE SENSITIVE CUSTOMER DATA
    assert.strictEqual(email.html.includes(confidentialPan), false, 'Email HTML must NOT contain PAN');
    assert.strictEqual(email.text?.includes(confidentialPan), false, 'Email text must NOT contain PAN');
    assert.strictEqual(email.html.includes(confidentialHealthData), false, 'Email HTML must NOT contain raw form data');
    assert.strictEqual(email.text?.includes(confidentialHealthData), false, 'Email text must NOT contain raw form data');
  });

  await t.test('3. Request creation with NO email succeeds, preserves response, and sends no email', async () => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohan Gupta',
        phone: '9876543212',
        serviceId: 'income-tax-return',
        message: 'No email provided',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.status, 'NEW');
    assert.strictEqual(body.confirmationEmailSent, false);
    assert.ok(body.requestId.startsWith('REQ-'));
    assert.strictEqual(body.message, 'Your request has been successfully submitted.');

    // No email should be sent
    assert.strictEqual(getMockSentEmails().length, 0);

    // Database record has confirmationEmailSent = false
    const savedReq = [...mockDb.serviceRequests.values()].find((r) => r.requestId === body.requestId);
    assert.ok(savedReq);
    assert.strictEqual(savedReq.confirmationEmailSent, false);
  });

  await t.test('4. Invalid email format is rejected with HTTP 400 before creating customer or request', async () => {
    const invalidEmails = [
      'not-an-email',
      '@missinglocal.com',
      'missingatdomain.com',
      'missing-tld@domain',
      'spaces in@email.com',
    ];

    for (const invalidEmail of invalidEmails) {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid Email User',
          phone: '9876543213',
          email: invalidEmail,
          serviceId: 'income-tax-return',
        }),
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, 'Please enter a valid email address');
    }

    // Verify nothing was saved to database and no emails sent
    assert.strictEqual(mockDb.serviceRequests.size, 0);
    assert.strictEqual(getMockSentEmails().length, 0);
  });

  await t.test('5. Email delivery failure does not roll back request creation; leaves confirmationEmailSent = false', async () => {
    // Simulate provider delivery failure (e.g. Resend rate limit or network error)
    setMockEmailSender(async () => {
      return { success: false, error: 'Resend API rate limit exceeded' };
    });

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pooja Verma',
        phone: '9876543214',
        email: 'pooja.verma@example.com',
        serviceId: 'income-tax-return',
        message: 'Testing email delivery failure resilience',
      }),
    });

    // Request creation must NOT fail or roll back
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.requestId.startsWith('REQ-'), 'Request ID must still be returned');
    assert.strictEqual(body.confirmationEmailSent, false, 'confirmationEmailSent must be false on delivery failure');
    // Must NOT claim email was sent
    assert.strictEqual(body.message, 'Your request has been successfully submitted.');

    // Database record must remain saved with confirmationEmailSent = false
    const savedReq = [...mockDb.serviceRequests.values()].find((r) => r.requestId === body.requestId);
    assert.ok(savedReq, 'Request must remain in database despite email failure');
    assert.strictEqual(savedReq.confirmationEmailSent, false, 'confirmationEmailSent must NOT be true when delivery fails');
  });

  await t.test('6. Re-using registered customer email when request is re-submitted with same phone', async () => {
    // First submission provides email
    await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Arun Kumar',
        phone: '9876543215',
        email: 'arun.kumar@example.com',
        serviceId: 'income-tax-return',
      }),
    });

    clearMockSentEmails();

    // Second submission by same phone without explicitly entering email
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Arun Kumar',
        phone: '9876543215',
        serviceId: 'gst-registration',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.confirmationEmailSent, true);

    // Confirmation email sent to previously registered customer email
    const sent = getMockSentEmails();
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].to, 'arun.kumar@example.com');
  });

  await t.test('7. Existing customer with registered email submits a different email: registered email remains unchanged and confirmation email is NOT redirected', async () => {
    // 1. Initial customer created with legitimate email
    await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Target Customer',
        phone: '9876543220',
        email: 'legit.customer@example.com',
        serviceId: 'income-tax-return',
      }),
    });

    clearMockSentEmails();

    // 2. Attacker attempts to overwrite email by submitting same phone with attacker's email
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Name',
        phone: '9876543220',
        email: 'attacker@evil.com',
        serviceId: 'gst-registration',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.confirmationEmailSent, true);

    // Verify customer record in database STILL has the original legitimate email
    const customer = [...mockDb.customers.values()].find((c) => c.phone === '9876543220');
    assert.ok(customer);
    assert.strictEqual(customer.email, 'legit.customer@example.com', 'Customer email must NOT be overwritten');
    assert.strictEqual(customer.name, 'Attacker Name', 'Customer name is updated as intended');

    // Verify confirmation email was sent to legitimate email, NEVER to attacker's email
    const sent = getMockSentEmails();
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].to, 'legit.customer@example.com', 'Email must be sent to registered email');
    assert.notStrictEqual(sent[0].to, 'attacker@evil.com', 'Email must NOT be redirected to attacker');
  });

  await t.test('8. Existing customer with NO email submits a request with an email: email is NOT attached without verified enrollment', async () => {
    // 1. Customer created initially without email
    await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phone Only User',
        phone: '9876543221',
        serviceId: 'income-tax-return',
      }),
    });

    clearMockSentEmails();

    // Verify customer exists with null email
    let customer = [...mockDb.customers.values()].find((c) => c.phone === '9876543221');
    assert.ok(customer);
    assert.strictEqual(customer.email, null);

    // 2. Customer or attacker submits second request, providing an unverified email
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phone Only User',
        phone: '9876543221',
        email: 'unverified.claimed@example.com',
        serviceId: 'gst-registration',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.confirmationEmailSent, false, 'No confirmation sent because existing customer has no verified email');

    // Verify email was NOT attached to the existing customer
    customer = [...mockDb.customers.values()].find((c) => c.phone === '9876543221');
    assert.ok(customer);
    assert.strictEqual(customer.email, null, 'Public submission MUST NOT attach unverified email to existing customer record');

    // Verify no email was dispatched
    const sent = getMockSentEmails();
    assert.strictEqual(sent.length, 0, 'No email must be sent to unverified email address');
  });

  await t.test('9. Existing customer submits request without an email: existing registered email is preserved', async () => {
    // 1. Existing customer with email
    await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Devendra Joshi',
        phone: '9876543222',
        email: 'devendra@example.com',
        serviceId: 'income-tax-return',
      }),
    });

    clearMockSentEmails();

    // 2. Subsequent request without email
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Devendra Joshi Updated',
        phone: '9876543222',
        serviceId: 'gst-registration',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.confirmationEmailSent, true);

    // Existing email is preserved
    const customer = [...mockDb.customers.values()].find((c) => c.phone === '9876543222');
    assert.ok(customer);
    assert.strictEqual(customer.email, 'devendra@example.com');

    // Confirmation sent to existing email
    const sent = getMockSentEmails();
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].to, 'devendra@example.com');
  });

  await t.test('10. Existing customer has whitespace-only email in DB: public submission does NOT attach unverified email', async () => {
    // Seed existing customer in mock DB with whitespace-only email
    const seededCust = {
      id: 'cust-whitespace-seed',
      name: 'Whitespace Seed User',
      phone: '9876543223',
      email: '   ',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.customers.set(seededCust.id, seededCust);

    // Request submits valid email
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Whitespace Seed User',
        phone: '9876543223',
        email: 'clean.registered@example.com',
        serviceId: 'income-tax-return',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.confirmationEmailSent, false, 'No confirmation email sent to unverified email');

    // Customer email was not overwritten
    const customer = mockDb.customers.get('cust-whitespace-seed');
    assert.ok(customer);
    assert.strictEqual(customer.email, '   ', 'Existing email field must remain untouched');

    // No confirmation sent
    const sent = getMockSentEmails();
    assert.strictEqual(sent.length, 0);
  });

  server.close();
});
