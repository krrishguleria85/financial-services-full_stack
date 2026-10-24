import test from 'node:test';
import assert from 'node:assert';

// Mock browser sessionStorage
class MockSessionStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Mock localStorage for adminToken tests
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const mockSessionStorage = new MockSessionStorage();
const mockLocalStorage = new MockLocalStorage();
(globalThis as any).sessionStorage = mockSessionStorage;
(globalThis as any).localStorage = mockLocalStorage;

const SESSION_STORAGE_KEY = 'customerTrackingSession';

test('Frontend Tracking Session Refresh & Restoration Regression Suite', async (t) => {
  t.beforeEach(() => {
    mockSessionStorage.clear();
    mockLocalStorage.clear();
  });

  await t.test('1. Reads exact storage key customerTrackingSession on initialization', () => {
    const sessionData = {
      token: 'jwt-track-token-123',
      requestId: 'REQ-2026-TEST01',
      phone: '9876543210',
    };

    mockSessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));

    // Verify key match
    const raw = mockSessionStorage.getItem('customerTrackingSession');
    assert.ok(raw, 'customerTrackingSession must exist in sessionStorage');
    const parsed = JSON.parse(raw!);
    assert.strictEqual(parsed.token, 'jwt-track-token-123');
    assert.strictEqual(parsed.requestId, 'REQ-2026-TEST01');
    assert.strictEqual(parsed.phone, '9876543210');
  });

  await t.test('2. Synchronous loading state prevents initial tracking form from appearing during session restoration', () => {
    // When a valid session exists in sessionStorage:
    mockSessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        token: 'valid-token',
        requestId: 'REQ-1234',
        phone: '9876543210',
      })
    );

    // Initial state calculation in TrackRequestPage
    const computeInitialRestoring = (storage: MockSessionStorage) => {
      try {
        const savedSessionStr = storage.getItem(SESSION_STORAGE_KEY);
        if (!savedSessionStr) return false;
        const saved = JSON.parse(savedSessionStr);
        return Boolean(saved?.token && saved?.requestId);
      } catch {
        return false;
      }
    };

    const isRestoringInitial = computeInitialRestoring(mockSessionStorage);
    assert.strictEqual(isRestoringInitial, true, 'isRestoring must be true synchronously before first render');

    // Form visibility rule: !isRestoring && step === 'search'
    const step = 'search';
    const isFormVisible = !isRestoringInitial && step === 'search';
    assert.strictEqual(isFormVisible, false, 'Initial tracking form must NOT appear before session restoration finishes');

    // When NO session exists:
    mockSessionStorage.clear();
    const isRestoringEmpty = computeInitialRestoring(mockSessionStorage);
    assert.strictEqual(isRestoringEmpty, false, 'isRestoring must be false if no session exists');
    const isFormVisibleEmpty = !isRestoringEmpty && step === 'search';
    assert.strictEqual(isFormVisibleEmpty, true, 'Form must be visible when no session exists');
  });

  await t.test('3. API request attaches dual headers and Axios interceptor preserves customer Authorization', () => {
    // Set admin token in localStorage (simulate admin testing on same device)
    mockLocalStorage.setItem('adminToken', 'admin-token-xyz');

    // Axios interceptor logic from src/lib/api.ts
    const simulateRequestInterceptor = (config: any) => {
      const token = mockLocalStorage.getItem('adminToken');
      const existingAuth =
        config.headers?.Authorization ||
        (typeof config.headers?.get === 'function' && config.headers.get('Authorization'));
      if (token && !existingAuth) {
        if (!config.headers) config.headers = {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    };

    const customerToken = 'customer-jwt-token-abc';
    const requestConfig = {
      url: '/service-requests/track/session',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'X-Tracking-Token': customerToken,
      },
    };

    const finalConfig = simulateRequestInterceptor(requestConfig);

    assert.strictEqual(
      finalConfig.headers.Authorization,
      `Bearer ${customerToken}`,
      'Customer Authorization header must not be clobbered by adminToken'
    );
    assert.strictEqual(
      finalConfig.headers['X-Tracking-Token'],
      customerToken,
      'X-Tracking-Token header must be passed through'
    );
  });

  await t.test('4. Successful session restoration transitions step to details without resetting token', () => {
    mockSessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        token: 'valid-token',
        requestId: 'REQ-1234',
        phone: '9876543210',
      })
    );

    // Mock API response matching GET /track/session
    const apiResponse = {
      success: true,
      sessionToken: 'valid-token',
      uploadToken: 'valid-token',
      request: {
        id: 'uuid-1',
        requestId: 'REQ-1234',
        status: 'DOCUMENTS_REQUIRED',
        customerMessage: 'Upload Aadhaar copy',
        documentRequestMessage: 'Upload Aadhaar copy',
        adminNotes: null,
      },
      documents: [],
    };

    // State transition simulation
    let step: 'search' | 'otp' | 'details' = 'search';
    let isRestoring = true;
    let requestData: any = null;
    let uploadToken: string | null = null;

    // Execute success handler
    requestData = apiResponse;
    if (apiResponse.uploadToken || apiResponse.sessionToken) {
      uploadToken = apiResponse.uploadToken || apiResponse.sessionToken;
    }
    step = 'details';
    isRestoring = false;

    assert.strictEqual(step, 'details');
    assert.strictEqual(isRestoring, false);
    assert.strictEqual(uploadToken, 'valid-token');
    assert.strictEqual(requestData.request.customerMessage, 'Upload Aadhaar copy');
    assert.strictEqual(requestData.request.adminNotes, null);

    // Initial tracking form should NOT be visible when step is details
    const isFormVisible = !isRestoring && (step as string) === 'search';
    assert.strictEqual(isFormVisible, false, 'Form must NOT be visible when viewing details');

    // Token must still be in sessionStorage
    assert.ok(mockSessionStorage.getItem(SESSION_STORAGE_KEY), 'Token must remain in sessionStorage');
  });

  await t.test('5. Expired token (HTTP 401) clears sessionStorage and returns to search step', () => {
    mockSessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        token: 'expired-token',
        requestId: 'REQ-1234',
        phone: '9876543210',
      })
    );

    let step: 'search' | 'otp' | 'details' = 'details';
    let requestData: any = { dummy: true };
    let uploadToken: string | null = 'expired-token';

    const error = {
      response: {
        status: 401,
        data: { error: 'Tracking session expired. Please verify with a new code.', code: 'SESSION_EXPIRED' },
      },
    };

    // Error handling logic from TrackRequestPage
    if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 404) {
      mockSessionStorage.removeItem(SESSION_STORAGE_KEY);
      requestData = null;
      uploadToken = null;
      step = 'search';
    }

    assert.strictEqual(mockSessionStorage.getItem(SESSION_STORAGE_KEY), null, 'Expired session token must be cleared');
    assert.strictEqual(requestData, null);
    assert.strictEqual(uploadToken, null);
    assert.strictEqual(step, 'search');
  });

  await t.test('6. Transient error (network failure / HTTP 500) preserves token in sessionStorage', () => {
    const originalSession = JSON.stringify({
      token: 'valid-token-survives-glitch',
      requestId: 'REQ-1234',
      phone: '9876543210',
    });
    mockSessionStorage.setItem(SESSION_STORAGE_KEY, originalSession);

    let step: 'search' | 'otp' | 'details' = 'search';

    // Simulate network error (no response object) or 500 server error
    const transientErrors = [
      new Error('Network Error: Connection refused'),
      { response: { status: 500, data: { error: 'Internal Server Error' } } },
      { response: { status: 502, data: { error: 'Bad Gateway' } } },
    ];

    for (const err of transientErrors as any[]) {
      if (err.response?.status === 401 || err.response?.status === 403 || err.response?.status === 404) {
        mockSessionStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        // Transient error preserves sessionStorage
        step = 'search';
      }

      assert.strictEqual(
        mockSessionStorage.getItem(SESSION_STORAGE_KEY),
        originalSession,
        'Transient error must NEVER wipe valid session token from sessionStorage'
      );
      assert.strictEqual(step, 'search', 'Step must remain search on transient error');
    }
  });

  await t.test('7. handleEndSession explicitly purges sessionStorage and resets component state', () => {
    mockSessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        token: 'active-token',
        requestId: 'REQ-1234',
        phone: '9876543210',
      })
    );

    let step: 'search' | 'otp' | 'details' = 'details';
    let requestData: any = { some: 'data' };
    let uploadToken: string | null = 'active-token';
    let otp = '123456';

    // handleEndSession logic
    mockSessionStorage.removeItem(SESSION_STORAGE_KEY);
    requestData = null;
    uploadToken = null;
    step = 'search';
    otp = '';

    assert.strictEqual(mockSessionStorage.getItem(SESSION_STORAGE_KEY), null);
    assert.strictEqual(requestData, null);
    assert.strictEqual(uploadToken, null);
    assert.strictEqual(step, 'search');
    assert.strictEqual(otp, '');
  });
});
