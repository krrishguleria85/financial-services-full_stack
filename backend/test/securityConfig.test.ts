import test from 'node:test';
import assert from 'node:assert';
import {
  validateAndGetJwtSecret,
  validateAndGetEncryptionKey,
  INSECURE_SECRET_PLACEHOLDERS,
} from '../src/config';
import { encryptData, decryptData, maskPAN } from '../src/utils/helpers';

test('1. Production fail-fast when JWT_SECRET is missing or empty', () => {
  assert.throws(
    () => validateAndGetJwtSecret('', true),
    /FATAL: JWT_SECRET environment variable is missing or empty in production/
  );
  assert.throws(
    () => validateAndGetJwtSecret(null, true),
    /FATAL: JWT_SECRET environment variable is missing or empty in production/
  );
});

test('2. Production fail-fast when JWT_SECRET is an insecure placeholder', () => {
  for (const placeholder of INSECURE_SECRET_PLACEHOLDERS) {
    assert.throws(
      () => validateAndGetJwtSecret(placeholder, true),
      /FATAL: JWT_SECRET is set to an insecure default placeholder value in production/
    );
  }
});

test('3. Production fail-fast when JWT_SECRET is too short (< 16 characters)', () => {
  assert.throws(
    () => validateAndGetJwtSecret('short-secret', true),
    /FATAL: JWT_SECRET must be at least 16 characters long in production/
  );
});

test('4. Production fail-fast when ENCRYPTION_KEY and JWT_SECRET are missing', () => {
  assert.throws(
    () => validateAndGetEncryptionKey('', '', true),
    /FATAL: ENCRYPTION_KEY or JWT_SECRET environment variable is required in production/
  );
  assert.throws(
    () => validateAndGetEncryptionKey(undefined, '', true),
    /FATAL: ENCRYPTION_KEY or JWT_SECRET environment variable is required in production/
  );
});

test('5. Production fail-fast when ENCRYPTION_KEY is an insecure placeholder', () => {
  for (const placeholder of INSECURE_SECRET_PLACEHOLDERS) {
    assert.throws(
      () => validateAndGetEncryptionKey(placeholder, '', true),
      /FATAL: ENCRYPTION_KEY is set to an insecure default placeholder value in production/
    );
  }
});

test('6. 32-byte encryption key derivation maintains backwards compatibility', () => {
  const derived1 = validateAndGetEncryptionKey('custom-render-encryption-key-1234', '', false);
  assert.strictEqual(derived1.length, 32);
  assert.strictEqual(derived1, 'custom-render-encryption-key-1234'.padEnd(32, '0').slice(0, 32));

  // Falls back to JWT_SECRET if ENCRYPTION_KEY is not explicitly set
  const derived2 = validateAndGetEncryptionKey(undefined, 'my-super-secret-jwt-key-for-testing', false);
  assert.strictEqual(derived2.length, 32);
  assert.strictEqual(derived2, 'my-super-secret-jwt-key-for-testing'.padEnd(32, '0').slice(0, 32));
});

test('7. Sensitive data encryption (AES-256-CBC) and decryption round-trip', () => {
  const testPan = 'ABCDE1234F';
  const encrypted = encryptData(testPan);

  assert.notStrictEqual(encrypted, null);
  assert.ok(encrypted!.includes(':'), 'Encrypted data must contain IV and ciphertext separated by colon');

  // Verify it does not leak raw PAN in ciphertext
  assert.ok(!encrypted!.includes(testPan), 'Ciphertext must not contain plaintext PAN');

  // Verify decryption recovers exact original PAN
  const decrypted = decryptData(encrypted);
  assert.strictEqual(decrypted, testPan);

  // Verify masking
  const masked = maskPAN(decrypted);
  assert.strictEqual(masked, 'AB****4F');

  // Verify null / undefined safe handling
  assert.strictEqual(encryptData(null), null);
  assert.strictEqual(encryptData(undefined), null);
  assert.strictEqual(decryptData(null), null);
  assert.strictEqual(decryptData('plaintext-without-colon'), 'plaintext-without-colon');
});
