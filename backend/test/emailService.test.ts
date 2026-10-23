import test from 'node:test';
import assert from 'node:assert';
import {
  sendEmail,
  setMockEmailSender,
  getMockSentEmails,
  clearMockSentEmails,
} from '../src/services/emailService';
import { validateAndGetResendConfig } from '../src/config';

test('Email Service Infrastructure & Production Safety Suite', async (t) => {
  t.beforeEach(() => {
    clearMockSentEmails();
    setMockEmailSender(null);
  });

  t.afterEach(() => {
    clearMockSentEmails();
    setMockEmailSender(null);
  });

  await t.test('1. Configuration validator defaults to onboarding@resend.dev and trims values in dev/test', () => {
    const defaultCfg = validateAndGetResendConfig('', '', false);
    assert.strictEqual(defaultCfg.apiKey, '');
    assert.strictEqual(defaultCfg.fromEmail, 'onboarding@resend.dev');

    const customCfg = validateAndGetResendConfig('  re_test_key_123  ', '  notifications@example.com  ', false);
    assert.strictEqual(customCfg.apiKey, 're_test_key_123');
    assert.strictEqual(customCfg.fromEmail, 'notifications@example.com');
  });

  await t.test('2. Configuration validator throws fatal error when RESEND_API_KEY is missing in production', () => {
    assert.throws(
      () => validateAndGetResendConfig('', 'onboarding@resend.dev', true),
      /FATAL: RESEND_API_KEY environment variable is missing or empty in production/
    );
    assert.throws(
      () => validateAndGetResendConfig(null, 'onboarding@resend.dev', true),
      /FATAL: RESEND_API_KEY environment variable is missing or empty in production/
    );
  });

  await t.test('3. Configuration validator throws fatal error when RESEND_API_KEY is a placeholder in production', () => {
    assert.throws(
      () => validateAndGetResendConfig('re_placeholder_api_key', 'onboarding@resend.dev', true),
      /FATAL: RESEND_API_KEY is set to an insecure default placeholder value in production/
    );
    assert.throws(
      () => validateAndGetResendConfig('re_placeholder_123456789', 'onboarding@resend.dev', true),
      /FATAL: RESEND_API_KEY is set to an insecure default placeholder value in production/
    );
    assert.throws(
      () => validateAndGetResendConfig('change-this-to-a-secure-random-string-in-production', 'onboarding@resend.dev', true),
      /FATAL: RESEND_API_KEY is set to an insecure default placeholder value in production/
    );
  });

  await t.test('4. setMockEmailSender throws fatal error if called in production', () => {
    assert.throws(
      () => setMockEmailSender(async () => ({ success: true }), 'production'),
      /FATAL: setMockEmailSender cannot be used in production/
    );
    // Ensure no mock sender remains registered
    assert.doesNotThrow(() => setMockEmailSender(null, 'test'));
  });

  await t.test('5. sendEmail explicitly fails when RESEND_API_KEY is missing in production (never reports mock success)', async () => {
    const res = await sendEmail(
      { to: 'customer@example.com', subject: 'Production Test', html: '<p>Production</p>' },
      { nodeEnv: 'production', apiKey: '' }
    );

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes('RESEND_API_KEY is missing in production configuration'));
    assert.strictEqual(getMockSentEmails().length, 0, 'No mock email should be recorded when production delivery fails');
  });

  await t.test('6. sendEmail explicitly fails when RESEND_API_KEY is an unconfigured placeholder in production', async () => {
    const res = await sendEmail(
      { to: 'customer@example.com', subject: 'Production Test', html: '<p>Production</p>' },
      { nodeEnv: 'production', apiKey: 're_placeholder_api_key' }
    );

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes('RESEND_API_KEY is an unconfigured placeholder in production'));
    assert.strictEqual(getMockSentEmails().length, 0, 'No mock email should be recorded when production delivery fails');
  });

  await t.test('7. Missing recipient email returns a structured error without throwing', async () => {
    const res = await sendEmail({
      to: '',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes('Recipient email address is required'));
    assert.strictEqual(getMockSentEmails().length, 0);
  });

  await t.test('8. In test/offline mode without API key, email is safely captured in-memory', async () => {
    const res = await sendEmail({
      to: 'customer@example.com',
      subject: 'Your Request Confirmation',
      html: '<p>Your request REQ-2026-0001 has been received.</p>',
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.id?.startsWith('mock-email-'));

    const recorded = getMockSentEmails();
    assert.strictEqual(recorded.length, 1);
    assert.strictEqual(recorded[0].to, 'customer@example.com');
    assert.strictEqual(recorded[0].subject, 'Your Request Confirmation');
  });

  await t.test('9. HTML-to-plaintext fallback automatically strips HTML tags when text is omitted', async () => {
    const res = await sendEmail({
      to: 'customer@example.com',
      subject: 'Formatting Test',
      html: '<h1>Welcome!</h1><p>Your Request ID: <strong>REQ-2026-0001</strong>.</p>',
    });

    assert.strictEqual(res.success, true);
    const recorded = getMockSentEmails();
    assert.strictEqual(recorded.length, 1);
    assert.strictEqual(recorded[0].text, 'Welcome! Your Request ID: REQ-2026-0001.');
  });

  await t.test('10. Custom mock sender can simulate Resend delivery failures for error resilience testing in test mode', async () => {
    setMockEmailSender(async () => {
      return { success: false, error: 'Rate limit exceeded on Resend provider' };
    });

    const res = await sendEmail({
      to: 'customer@example.com',
      subject: 'Test Resend Failure',
      html: '<p>Test</p>',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Rate limit exceeded on Resend provider');
    assert.strictEqual(getMockSentEmails().length, 1);
  });

  await t.test('11. Custom mock sender can simulate successful Resend response with specific ID in test mode', async () => {
    setMockEmailSender(async () => {
      return { success: true, id: 'resend-live-msg-id-12345' };
    });

    const res = await sendEmail({
      to: 'customer@example.com',
      subject: 'Success Simulation',
      html: '<p>Welcome</p>',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.id, 'resend-live-msg-id-12345');
    assert.strictEqual(getMockSentEmails().length, 1);
  });
});
