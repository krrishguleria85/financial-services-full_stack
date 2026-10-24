/**
 * Customer & Service Request Deletion with Cloudflare R2 Cleanup Regression Suite
 *
 * Covers:
 * 1. Successful customer deletion with multiple R2 documents.
 * 2. Successful service-request deletion without affecting other requests.
 * 3. R2 deletion failure and subsequent retry.
 * 4. Database failure during cleanup.
 * 5. Admin notes referencing service requests (customerId = null).
 * 6. Ensuring other customers' documents remain untouched.
 * 7. Preventing a false success response when cleanup is incomplete.
 */

import test from 'node:test';
import assert from 'node:assert';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';
import { config } from '../src/config';
import customerRoutes from '../src/routes/customers';
import serviceRequestRoutes from '../src/routes/serviceRequests';
import { setMockStorage } from '../src/services/storageService';

function createServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/admin/customers', customerRoutes);
  app.use('/api/service-requests', serviceRequestRoutes);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}

test('Customer Deletion & Cloudflare R2 Cleanup Suite', async (t) => {
  const app = createServer();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  const adminToken = jwt.sign(
    { id: 'admin-cleanup-test-id', email: 'admin@finance.com' },
    config.jwt.secret,
    { algorithm: 'HS256' }
  );

  // In-memory data store for this test suite
  let mockAdmins = new Map<string, any>([
    ['admin-cleanup-test-id', { id: 'admin-cleanup-test-id', email: 'admin@finance.com', name: 'Admin', role: 'admin', isActive: true }],
  ]);
  let mockCustomers = new Map<string, any>();
  let mockServiceRequests = new Map<string, any>();
  let mockDocuments = new Map<string, any>();
  let mockAdminNotes = new Map<string, any>();
  let mockStatusHistory = new Map<string, any>();
  let mockAppointments = new Map<string, any>();
  let mockEmailOtps = new Map<string, any>();

  // In-memory simulated R2 bucket
  const simulatedR2 = new Set<string>();

  // Storage mock that tracks R2 calls and can simulate failures
  let failR2DeleteOnKeys: Set<string> = new Set();
  let failAllR2Deletes = false;
  let simulateDatabaseFailure = false;

  setMockStorage({
    upload: async (p) => {
      simulatedR2.add(p.key);
    },
    download: async () => null,
    delete: async (p) => {
      if (failAllR2Deletes || failR2DeleteOnKeys.has(p.key)) {
        throw new Error(`R2 503 Service Unavailable: simulated error on ${p.key}`);
      }
      simulatedR2.delete(p.key);
    },
  });

  // Wire Prisma mocks
  (prisma.admin as any).findUnique = async (q: any) => mockAdmins.get(q.where.id) || null;

  (prisma.customer as any).findUnique = async (q: any) => mockCustomers.get(q.where.id) || null;
  (prisma.customer as any).delete = async (q: any) => {
    mockCustomers.delete(q.where.id);
    return { id: q.where.id };
  };

  (prisma.serviceRequest as any).findUnique = async (q: any) => mockServiceRequests.get(q.where.id) || null;
  (prisma.serviceRequest as any).findMany = async (q: any) => {
    return Array.from(mockServiceRequests.values()).filter((sr) => sr.customerId === q.where?.customerId);
  };
  (prisma.serviceRequest as any).delete = async (q: any) => {
    mockServiceRequests.delete(q.where.id);
    return { id: q.where.id };
  };
  (prisma.serviceRequest as any).deleteMany = async (q: any) => {
    for (const [id, sr] of Array.from(mockServiceRequests.entries())) {
      if (sr.customerId === q.where?.customerId) {
        mockServiceRequests.delete(id);
      }
    }
    return { count: 1 };
  };

  (prisma.document as any).findMany = async (q: any) => {
    const orClauses = q.where?.OR;
    if (orClauses && Array.isArray(orClauses)) {
      return Array.from(mockDocuments.values()).filter((doc) => {
        return orClauses.some((clause: any) => {
          if (clause.customerId && doc.customerId === clause.customerId) return true;
          if (clause.serviceRequestId?.in && clause.serviceRequestId.in.includes(doc.serviceRequestId)) return true;
          return false;
        });
      });
    }
    return Array.from(mockDocuments.values()).filter((doc) => {
      if (q.where?.customerId && doc.customerId !== q.where.customerId) return false;
      if (q.where?.serviceRequestId && doc.serviceRequestId !== q.where.serviceRequestId) return false;
      return true;
    });
  };
  (prisma.document as any).deleteMany = async (q: any) => {
    const orClauses = q.where?.OR;
    if (orClauses && Array.isArray(orClauses)) {
      for (const [id, doc] of Array.from(mockDocuments.entries())) {
        const matches = orClauses.some((clause: any) => {
          if (clause.customerId && doc.customerId === clause.customerId) return true;
          if (clause.serviceRequestId?.in && clause.serviceRequestId.in.includes(doc.serviceRequestId)) return true;
          return false;
        });
        if (matches) mockDocuments.delete(id);
      }
      return { count: 1 };
    }
    for (const [id, doc] of Array.from(mockDocuments.entries())) {
      if (q.where?.customerId && doc.customerId === q.where.customerId) mockDocuments.delete(id);
      if (q.where?.serviceRequestId && doc.serviceRequestId === q.where.serviceRequestId) mockDocuments.delete(id);
    }
    return { count: 1 };
  };

  (prisma.adminNote as any).deleteMany = async (q: any) => {
    const orClauses = q.where?.OR;
    if (orClauses && Array.isArray(orClauses)) {
      for (const [id, note] of Array.from(mockAdminNotes.entries())) {
        const matches = orClauses.some((clause: any) => {
          if (clause.customerId && note.customerId === clause.customerId) return true;
          if (clause.serviceRequestId?.in && clause.serviceRequestId.in.includes(note.serviceRequestId)) return true;
          return false;
        });
        if (matches) mockAdminNotes.delete(id);
      }
      return { count: 1 };
    }
    for (const [id, note] of Array.from(mockAdminNotes.entries())) {
      if (q.where?.customerId && note.customerId === q.where.customerId) mockAdminNotes.delete(id);
      if (q.where?.serviceRequestId && note.serviceRequestId === q.where.serviceRequestId) mockAdminNotes.delete(id);
    }
    return { count: 1 };
  };

  (prisma.requestStatusHistory as any).deleteMany = async () => ({ count: 1 });
  (prisma.appointment as any).deleteMany = async () => ({ count: 1 });
  (prisma.emailOtp as any).deleteMany = async () => ({ count: 1 });

  (prisma.$transaction as any) = async (ops: any[]) => {
    if (simulateDatabaseFailure) {
      throw new Error('Simulated DB transaction failure');
    }
    return Promise.all(ops);
  };

  t.after(() => {
    setMockStorage(null);
    server.close();
  });

  // Helper to reset test fixture state
  function resetFixtures() {
    mockCustomers.clear();
    mockServiceRequests.clear();
    mockDocuments.clear();
    mockAdminNotes.clear();
    mockStatusHistory.clear();
    mockAppointments.clear();
    mockEmailOtps.clear();
    simulatedR2.clear();
    failR2DeleteOnKeys.clear();
    failAllR2Deletes = false;
    simulateDatabaseFailure = false;
  }

  // 1. Successful customer deletion with multiple R2 documents
  await t.test('1. Successful customer deletion with multiple R2 documents across requests', async () => {
    resetFixtures();

    const customerA = { id: 'cust-A', name: 'Alice Smith', phone: '9000000001', email: 'alice@example.com' };
    mockCustomers.set(customerA.id, customerA);

    const srA1 = { id: 'sr-A1', requestId: 'REQ-A1', customerId: customerA.id };
    const srA2 = { id: 'sr-A2', requestId: 'REQ-A2', customerId: customerA.id };
    mockServiceRequests.set(srA1.id, srA1);
    mockServiceRequests.set(srA2.id, srA2);

    const docA1 = { id: 'doc-1', customerId: customerA.id, serviceRequestId: srA1.id, storedName: 'documents/sr-A1/pan.pdf' };
    const docA2 = { id: 'doc-2', customerId: customerA.id, serviceRequestId: srA1.id, storedName: 'documents/sr-A1/form16.pdf' };
    const docA3 = { id: 'doc-3', customerId: customerA.id, serviceRequestId: srA2.id, storedName: 'documents/sr-A2/gst_cert.pdf' };
    mockDocuments.set(docA1.id, docA1);
    mockDocuments.set(docA2.id, docA2);
    mockDocuments.set(docA3.id, docA3);

    simulatedR2.add(docA1.storedName);
    simulatedR2.add(docA2.storedName);
    simulatedR2.add(docA3.storedName);

    const res = await fetch(`${baseUrl}/api/admin/customers/${customerA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.message, 'Customer deleted successfully');

    // All 3 files must be purged from Cloudflare R2
    assert.strictEqual(simulatedR2.has(docA1.storedName), false, 'docA1 must be deleted from R2');
    assert.strictEqual(simulatedR2.has(docA2.storedName), false, 'docA2 must be deleted from R2');
    assert.strictEqual(simulatedR2.has(docA3.storedName), false, 'docA3 must be deleted from R2');

    // Database records must be purged
    assert.strictEqual(mockCustomers.has(customerA.id), false, 'Customer must be deleted from DB');
    assert.strictEqual(mockDocuments.has(docA1.id), false, 'docA1 DB record must be deleted');
    assert.strictEqual(mockDocuments.has(docA2.id), false, 'docA2 DB record must be deleted');
    assert.strictEqual(mockDocuments.has(docA3.id), false, 'docA3 DB record must be deleted');
  });

  // 2. Successful service-request deletion without affecting other requests
  await t.test('2. Successful service-request deletion preserves customer and other requests', async () => {
    resetFixtures();

    const customer = { id: 'cust-multi-req', name: 'Bob Jones', phone: '9000000002' };
    mockCustomers.set(customer.id, customer);

    const sr1 = { id: 'sr-to-delete', requestId: 'REQ-DEL', customerId: customer.id };
    const sr2 = { id: 'sr-to-keep', requestId: 'REQ-KEEP', customerId: customer.id };
    mockServiceRequests.set(sr1.id, sr1);
    mockServiceRequests.set(sr2.id, sr2);

    const doc1 = { id: 'doc-del', customerId: customer.id, serviceRequestId: sr1.id, storedName: 'documents/sr-to-delete/file.pdf' };
    const doc2 = { id: 'doc-keep', customerId: customer.id, serviceRequestId: sr2.id, storedName: 'documents/sr-to-keep/file.pdf' };
    mockDocuments.set(doc1.id, doc1);
    mockDocuments.set(doc2.id, doc2);

    simulatedR2.add(doc1.storedName);
    simulatedR2.add(doc2.storedName);

    const res = await fetch(`${baseUrl}/api/service-requests/${sr1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);

    // Only sr1 file deleted from R2
    assert.strictEqual(simulatedR2.has(doc1.storedName), false, 'sr1 file must be removed from R2');
    assert.strictEqual(simulatedR2.has(doc2.storedName), true, 'sr2 file must remain intact in R2');

    // Only sr1 deleted from DB
    assert.strictEqual(mockServiceRequests.has(sr1.id), false, 'sr1 must be deleted from DB');
    assert.strictEqual(mockServiceRequests.has(sr2.id), true, 'sr2 must remain in DB');
    assert.strictEqual(mockCustomers.has(customer.id), true, 'Customer must remain in DB');
    assert.strictEqual(mockDocuments.has(doc2.id), true, 'doc2 record must remain in DB');
  });

  // 3. R2 deletion failure and subsequent retry
  await t.test('3. R2 deletion failure halts DB delete; subsequent retry succeeds', async () => {
    resetFixtures();

    const customer = { id: 'cust-retry-test', name: 'Carol Danvers', phone: '9000000003' };
    mockCustomers.set(customer.id, customer);

    const sr = { id: 'sr-retry', requestId: 'REQ-RETRY', customerId: customer.id };
    mockServiceRequests.set(sr.id, sr);

    const doc = { id: 'doc-retry', customerId: customer.id, serviceRequestId: sr.id, storedName: 'documents/sr-retry/file.pdf' };
    mockDocuments.set(doc.id, doc);
    simulatedR2.add(doc.storedName);

    // Simulate R2 outage
    failAllR2Deletes = true;

    // First attempt: should fail cleanly
    const res1 = await fetch(`${baseUrl}/api/admin/customers/${customer.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res1.status, 502);
    const body1: any = await res1.json();
    assert.strictEqual(body1.code, 'STORAGE_CLEANUP_FAILED');

    // Records must be preserved in DB to avoid orphaned R2 files
    assert.strictEqual(mockCustomers.has(customer.id), true, 'Customer must NOT be deleted when R2 fails');
    assert.strictEqual(mockDocuments.has(doc.id), true, 'Document must NOT be deleted when R2 fails');
    assert.strictEqual(simulatedR2.has(doc.storedName), true, 'R2 file still exists');

    // Second attempt: R2 restored
    failAllR2Deletes = false;
    const res2 = await fetch(`${baseUrl}/api/admin/customers/${customer.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(simulatedR2.has(doc.storedName), false, 'R2 file deleted on retry');
    assert.strictEqual(mockCustomers.has(customer.id), false, 'Customer deleted on retry');
    assert.strictEqual(mockDocuments.has(doc.id), false, 'Document deleted on retry');
  });

  // 4. Database failure during cleanup
  await t.test('4. Database failure during cleanup returns 500 without false success', async () => {
    resetFixtures();

    const customer = { id: 'cust-db-fail', name: 'Dave Miller', phone: '9000000004' };
    mockCustomers.set(customer.id, customer);

    const sr = { id: 'sr-db-fail', requestId: 'REQ-DBFAIL', customerId: customer.id };
    mockServiceRequests.set(sr.id, sr);

    simulateDatabaseFailure = true;

    const res = await fetch(`${baseUrl}/api/admin/customers/${customer.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 500);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'Failed to delete customer');

    simulateDatabaseFailure = false;
  });

  // 5. Admin notes referencing service requests (customerId = null)
  await t.test('5. Admin notes with customerId = null referencing service request are cleaned up', async () => {
    resetFixtures();

    const customer = { id: 'cust-notes-test', name: 'Eve Adams', phone: '9000000005' };
    mockCustomers.set(customer.id, customer);

    const sr = { id: 'sr-notes', requestId: 'REQ-NOTES', customerId: customer.id };
    mockServiceRequests.set(sr.id, sr);

    // Note with customerId set
    const note1 = { id: 'note-1', customerId: customer.id, serviceRequestId: null, content: 'Customer note' };
    // Note created during status update with customerId = null
    const note2 = { id: 'note-2', customerId: null, serviceRequestId: sr.id, content: 'Internal status note' };
    mockAdminNotes.set(note1.id, note1);
    mockAdminNotes.set(note2.id, note2);

    const res = await fetch(`${baseUrl}/api/admin/customers/${customer.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(mockAdminNotes.has(note1.id), false, 'Customer note must be deleted');
    assert.strictEqual(mockAdminNotes.has(note2.id), false, 'Orphaned note referencing service request must be deleted');
    assert.strictEqual(mockCustomers.has(customer.id), false, 'Customer deleted');
  });

  // 6. Ensuring other customers' documents remain untouched
  await t.test('6. Deleting customer A does not touch customer B documents in R2 or DB', async () => {
    resetFixtures();

    const custA = { id: 'cust-A-isolation', name: 'Alice', phone: '9000000006' };
    const custB = { id: 'cust-B-isolation', name: 'Bob', phone: '9000000007' };
    mockCustomers.set(custA.id, custA);
    mockCustomers.set(custB.id, custB);

    const srA = { id: 'sr-A-iso', customerId: custA.id };
    const srB = { id: 'sr-B-iso', customerId: custB.id };
    mockServiceRequests.set(srA.id, srA);
    mockServiceRequests.set(srB.id, srB);

    const docA = { id: 'doc-A-iso', customerId: custA.id, serviceRequestId: srA.id, storedName: 'documents/sr-A/pan.pdf' };
    const docB = { id: 'doc-B-iso', customerId: custB.id, serviceRequestId: srB.id, storedName: 'documents/sr-B/aadhaar.pdf' };
    mockDocuments.set(docA.id, docA);
    mockDocuments.set(docB.id, docB);

    simulatedR2.add(docA.storedName);
    simulatedR2.add(docB.storedName);

    const res = await fetch(`${baseUrl}/api/admin/customers/${custA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);

    // Customer A wiped
    assert.strictEqual(simulatedR2.has(docA.storedName), false, 'Customer A R2 file deleted');
    assert.strictEqual(mockCustomers.has(custA.id), false, 'Customer A deleted');
    assert.strictEqual(mockDocuments.has(docA.id), false, 'Customer A doc deleted');

    // Customer B preserved 100%
    assert.strictEqual(simulatedR2.has(docB.storedName), true, 'Customer B R2 file must remain untouched');
    assert.strictEqual(mockCustomers.has(custB.id), true, 'Customer B must remain in DB');
    assert.strictEqual(mockDocuments.has(docB.id), true, 'Customer B doc must remain in DB');
    assert.strictEqual(mockServiceRequests.has(srB.id), true, 'Customer B service request must remain in DB');
  });

  // 7. Preventing a false success response when cleanup is incomplete
  await t.test('7. Partial R2 cleanup failure returns 502 without false success and preserves state', async () => {
    resetFixtures();

    const customer = { id: 'cust-partial-fail', name: 'Frank', phone: '9000000008' };
    mockCustomers.set(customer.id, customer);

    const sr = { id: 'sr-partial', customerId: customer.id };
    mockServiceRequests.set(sr.id, sr);

    const doc1 = { id: 'doc-p1', customerId: customer.id, serviceRequestId: sr.id, storedName: 'documents/sr-partial/file1.pdf' };
    const doc2 = { id: 'doc-p2', customerId: customer.id, serviceRequestId: sr.id, storedName: 'documents/sr-partial/file2.pdf' };
    mockDocuments.set(doc1.id, doc1);
    mockDocuments.set(doc2.id, doc2);

    simulatedR2.add(doc1.storedName);
    simulatedR2.add(doc2.storedName);

    // Fail only on doc2
    failR2DeleteOnKeys.add(doc2.storedName);

    const res = await fetch(`${baseUrl}/api/admin/customers/${customer.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Must NOT return 200
    assert.strictEqual(res.status, 502);
    const body: any = await res.json();
    assert.strictEqual(body.code, 'STORAGE_CLEANUP_FAILED');
    assert.ok(body.failedFiles.some((f: any) => f.key === doc2.storedName));

    // Database records must NOT be purged
    assert.strictEqual(mockCustomers.has(customer.id), true, 'Customer must remain in DB');
    assert.strictEqual(mockDocuments.has(doc1.id), true, 'doc1 DB record preserved');
    assert.strictEqual(mockDocuments.has(doc2.id), true, 'doc2 DB record preserved');
  });
});
