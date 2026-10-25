import test from 'node:test';
import assert from 'node:assert';
import { RECOGNITION_PHOTOS } from '../src/lib/recognitionPhotos.ts';
import fs from 'node:fs';
import path from 'node:path';

test('Frontend Photo Lightbox Modal & Recognition Assets Suite', async (t) => {
  await t.test('1. RECOGNITION_PHOTOS contains correct metadata for all recognition & award items', () => {
    // 1. Milestone
    assert.ok(RECOGNITION_PHOTOS.milestone, 'Milestone photo should be defined');
    assert.strictEqual(RECOGNITION_PHOTOS.milestone.title, 'A Proud LIC Milestone');
    assert.strictEqual(RECOGNITION_PHOTOS.milestone.subtitle, 'Chandigarh');
    assert.strictEqual(RECOGNITION_PHOTOS.milestone.src, '/images/lic-milestone.jpg');
    assert.ok(RECOGNITION_PHOTOS.milestone.alt.length > 0, 'Milestone should have descriptive alt text');

    // 2. Recognition
    assert.ok(RECOGNITION_PHOTOS.recognition, 'Recognition photo should be defined');
    assert.strictEqual(RECOGNITION_PHOTOS.recognition.title, 'LIC Recognition');
    assert.strictEqual(RECOGNITION_PHOTOS.recognition.subtitle, 'Chandigarh');
    assert.strictEqual(RECOGNITION_PHOTOS.recognition.src, '/images/lic-presentation.jpg');
    assert.ok(RECOGNITION_PHOTOS.recognition.alt.length > 0, 'Recognition should have descriptive alt text');

    // 3. Trophy
    assert.ok(RECOGNITION_PHOTOS.trophy, 'Trophy photo should be defined');
    assert.strictEqual(RECOGNITION_PHOTOS.trophy.title, 'LIC ZM’s Trophy 2026');
    assert.strictEqual(RECOGNITION_PHOTOS.trophy.subtitle, 'North Zone');
    assert.strictEqual(RECOGNITION_PHOTOS.trophy.src, '/images/trophy-cutout.png');
    assert.ok(RECOGNITION_PHOTOS.trophy.alt.length > 0, 'Trophy should have descriptive alt text');

    // 4. LIC 70 Years
    assert.ok(RECOGNITION_PHOTOS.anniversary70, '70 Years artwork should be defined');
    assert.strictEqual(RECOGNITION_PHOTOS.anniversary70.title, 'LIC 70 Years');
    assert.strictEqual(RECOGNITION_PHOTOS.anniversary70.subtitle, 'Our Journey, Your Trust');
    assert.strictEqual(RECOGNITION_PHOTOS.anniversary70.src, '/images/lic-70-years.png');
    assert.ok(RECOGNITION_PHOTOS.anniversary70.alt.length > 0, '70 Years should have descriptive alt text');
  });

  await t.test('2. Underlying original image assets exist in public directory without alterations', () => {
    const publicDir = path.resolve(process.cwd(), 'public');

    for (const key of ['milestone', 'recognition', 'trophy', 'anniversary70'] as const) {
      const item = RECOGNITION_PHOTOS[key];
      const relativePath = item.src.replace(/^\//, '');
      const fullPath = path.join(publicDir, relativePath);
      assert.ok(fs.existsSync(fullPath), `${item.src} must exist in public/`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 0, `${item.src} must not be empty`);
    }
  });

  await t.test('3. HomePage template contains click/keyboard triggers for all 4 cards and lightbox modal integration', () => {
    const homePagePath = path.resolve(process.cwd(), 'src', 'pages', 'HomePage.tsx');
    const content = fs.readFileSync(homePagePath, 'utf-8');

    assert.ok(content.includes('PhotoLightboxModal'), 'HomePage should import/render PhotoLightboxModal');
    assert.ok(content.includes('RECOGNITION_PHOTOS.milestone'), 'HomePage should trigger milestone photo');
    assert.ok(content.includes('RECOGNITION_PHOTOS.recognition'), 'HomePage should trigger recognition photo');
    assert.ok(content.includes('RECOGNITION_PHOTOS.trophy'), 'HomePage should trigger trophy photo');
    assert.ok(content.includes('RECOGNITION_PHOTOS.anniversary70'), 'HomePage should trigger 70 Years artwork');
    assert.ok(content.includes('role="button"'), 'Recognition cards should have role="button" for accessibility');
    assert.ok(content.includes('tabIndex={0}'), 'Recognition cards should be keyboard focusable');
    assert.ok(content.includes("e.key === 'Enter' || e.key === ' '"), 'Recognition cards should support Enter and Space keys');
  });

  await t.test('4. PhotoLightboxModal component file defines accessible dialog semantics and keyboard navigation', () => {
    const modalPath = path.resolve(process.cwd(), 'src', 'components', 'home', 'PhotoLightboxModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf-8');

    assert.ok(content.includes('role="dialog"'), 'Modal should have role="dialog"');
    assert.ok(content.includes('aria-modal="true"'), 'Modal should have aria-modal="true"');
    assert.ok(content.includes('aria-labelledby='), 'Modal should have aria-labelledby');
    assert.ok(content.includes("e.key === 'Escape'"), 'Modal should handle Escape key to close');
    assert.ok(content.includes("e.key === 'Tab'"), 'Modal should support Tab key focus trapping');
    assert.ok(content.includes("e.stopPropagation()"), 'Clicking inside the image container should not close the modal');
    assert.ok(content.includes("document.body.style.overflow = 'hidden'"), 'Modal should lock background scrolling when open');
    assert.ok(content.includes("motion-reduce:"), 'Modal should respect prefers-reduced-motion');
  });
});
