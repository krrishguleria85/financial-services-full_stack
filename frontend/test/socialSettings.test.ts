import test from 'node:test';
import assert from 'node:assert';
import { SOCIAL_PLATFORMS } from '../src/lib/socialConfig.ts';

test('Frontend Social Settings & Profile Integration Suite', async (t) => {
  await t.test('1. SOCIAL_PLATFORMS contains all 5 required platforms with standard keys', () => {
    const keys = SOCIAL_PLATFORMS.map((p) => p.key);
    assert.deepStrictEqual(keys, [
      'youtubeChannelUrl',
      'instagramUrl',
      'facebookUrl',
      'snapchatUrl',
      'mojUrl',
    ]);

    const platforms = SOCIAL_PLATFORMS.map((p) => p.platform);
    assert.deepStrictEqual(platforms, [
      'youtube',
      'instagram',
      'facebook',
      'snapchat',
      'moj',
    ]);
  });

  await t.test('2. Filters out unconfigured or whitespace-only links', () => {
    const mockSettings: Record<string, string> = {
      youtubeChannelUrl: 'https://www.youtube.com/@rajeshguleria1973',
      instagramUrl: 'https://www.instagram.com/guleria2877',
      facebookUrl: '',
      snapchatUrl: '   ',
      // mojUrl omitted intentionally
    };

    const configured = SOCIAL_PLATFORMS.filter((p) =>
      Boolean(mockSettings[p.key]?.trim())
    );

    assert.strictEqual(configured.length, 2);
    assert.strictEqual(configured[0].key, 'youtubeChannelUrl');
    assert.strictEqual(configured[1].key, 'instagramUrl');
  });

  await t.test('3. Includes all 5 platforms when all are configured in settings', () => {
    const mockSettings: Record<string, string> = {
      youtubeChannelUrl: 'https://www.youtube.com/@rajeshguleria1973',
      instagramUrl: 'https://www.instagram.com/guleria2877',
      facebookUrl: 'https://www.facebook.com/rajeshguleriaofficial',
      snapchatUrl: 'https://www.snapchat.com/add/rguleria2026',
      mojUrl: 'https://mojapp.in/@rajesh_dance_live',
    };

    const configured = SOCIAL_PLATFORMS.filter((p) =>
      Boolean(mockSettings[p.key]?.trim())
    );

    assert.strictEqual(configured.length, 5);
    const configuredKeys = configured.map((c) => c.key);
    assert.deepStrictEqual(configuredKeys, [
      'youtubeChannelUrl',
      'instagramUrl',
      'facebookUrl',
      'snapchatUrl',
      'mojUrl',
    ]);
  });

  await t.test('4. Validates URL protocol safety for http/https', () => {
    const isValidUrl = (urlStr: string) => {
      try {
        const parsed = new URL(urlStr.trim());
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    };

    assert.strictEqual(isValidUrl('https://www.youtube.com/@rajeshguleria1973'), true);
    assert.strictEqual(isValidUrl('http://facebook.com/page'), true);
    assert.strictEqual(isValidUrl('javascript:alert(1)'), false);
    assert.strictEqual(isValidUrl('data:text/html,test'), false);
    assert.strictEqual(isValidUrl('ftp://example.com/file'), false);
    assert.strictEqual(isValidUrl('not-a-valid-url'), false);
  });
});
