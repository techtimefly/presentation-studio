import {legacyHTML} from './legacy-fixture.mjs';
import { click, reveal, addSlide } from './ui.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), args: ['--no-sandbox'] });
const path = fileURLToPath(new URL('../', import.meta.url));
async function setup(file) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('file://' + (file === 'synthetic-legacy.html' ? await legacyHTML(path) : path + 'dist/' + file));
  return { page, errors };
}
test.after(() => browser.close());
test('legacy template retains all 9 slides and both customer question banks', async () => {
  const { page, errors } = await setup('synthetic-legacy.html');
  try {
    await page.locator('#open-full-editor').click();
    assert.equal(await page.locator('.fe-slide-button').count(), 9);
    await page.locator('#fe-close').click();
    for (const [section, count] of [['qa', 1], ['remqa', 1]]) {
      await page.locator('#menu').click(); await page.locator(`[data-deck="${section}"]`).click();
      await page.locator('#browse-questions').click();
      assert.equal(await page.locator('.question-option').count(), count);
      await page.locator('#questions-close').click();
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
test('blank editing, section recovery, gallery, independent themes, and ZIP export', async () => {
  const { page, errors } = await setup('presentation-studio-blank.html');
  const tab = name => page.getByRole('tab', { name, exact: true }).click();
  try {
    await page.locator('#open-full-editor').click();
    assert.equal(await page.locator('.fe-slide-button').count(), 1);
    assert(!(await page.locator('#fe-preview').innerText()).includes('VENDOR'));
    await tab('Sections');
    const id = await page.locator('#studio-section-id').textContent();
    await page.locator('#studio-section-name').fill('Welcome'); await page.waitForTimeout(400);
    assert.equal(await page.locator('#studio-section-id').textContent(), id);
    await page.locator('#studio-section-add').click();
    await page.locator('#studio-section-name').fill('Questions'); await page.waitForTimeout(400);
    await page.locator('#studio-section-kind').selectOption('qa');
    await page.locator('#studio-gallery-open').click(); await page.locator('[data-template="qa"]').click();
    await page.locator('#studio-gallery-section').selectOption({ label: 'Questions' });
    await page.locator('#studio-gallery-apply').click();
    await tab('Sections'); await page.locator('.studio-section-row').filter({ hasText: 'Questions' }).click();
    await page.locator('#studio-section-trash').click(); await page.locator('#fe-confirm-accept').click();
    assert.equal(await page.locator('.fe-slide-button').count(), 1);
    await page.locator('#studio-section-trash-list button').click();
    assert.equal(await page.locator('.fe-slide-button').count(), 2);
    await tab('Branding'); await page.locator('#studio-editor-theme').selectOption('dark');
    await page.locator('#studio-presentation-theme').selectOption('dark'); await page.locator('#studio-theme-close').click();
    assert.equal(await page.locator('#studio-presentation-theme').inputValue(), 'light');
    await page.locator('#studio-presentation-theme').selectOption('dark'); await page.locator('#studio-theme-apply').click();
    await page.locator('#fe-undo').click();
    assert(await page.locator('body').evaluate(e => e.classList.contains('editor-dark') && !e.classList.contains('presentation-dark')));
    await page.locator('#fe-redo').click();
    await mkdir(path + 'test-results', { recursive: true });
    const download = page.waitForEvent('download'); await click(page, '#fe-export');
    const file = path + 'test-results/editable.zip'; await (await download).saveAs(file);
    assert((await readFile(file)).byteLength > 1000);
    // Import validates the full pack including section history and checkpoints.
    await page.locator('#fe-import-file').setInputFiles(file); await page.waitForTimeout(500);
    if (await page.locator('#fe-confirm').isVisible()) await page.locator('#fe-confirm-accept').click();
    assert.equal(await page.locator('.fe-slide-button').count(), 2);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
test('layout example imports and OBS mode suppresses editor controls', async () => {
  const { page, errors } = await setup('presentation-studio-blank.html');
  try {
    await page.locator('#open-full-editor').click();
    await page.locator('#fe-import-file').setInputFiles(path + 'examples/layout-sampler.json');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.fe-slide-button').count(), 7);
    await page.goto('file://' + path + 'dist/presentation-studio.html?obs=1');
    await page.keyboard.press('j');
    assert.equal(await page.locator('#full-editor').isVisible(), false);
    assert.equal(await page.locator('#controls').evaluate(e => getComputedStyle(e).opacity), '0');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});


test('presentation canvas matches the theme preview in dark and light modes', async () => {
  const { page, errors } = await setup('synthetic-legacy.html');
  try {
    await page.locator('#open-full-editor').click();
    await page.getByRole('tab', { name: 'Branding', exact: true }).click();
    for (const [mode, background] of [['dark', 'rgb(7, 17, 31)'], ['light', 'rgb(244, 246, 248)']]) {
      await page.locator('#studio-presentation-theme').selectOption(mode);
      await page.locator('#studio-theme-apply').click();
      const palette = async selector => page.locator(selector).evaluate(e => { const s = getComputedStyle(e); return { background: s.backgroundColor, gradient: s.backgroundImage, ink: s.color }; });
      const preview = await palette('#fe-preview .me-preview-stage');
      assert.equal(preview.background, background);
      assert.deepEqual(await palette('#stage'), preview);
      await page.locator('#fe-close').click();
      assert.deepEqual(await palette('#stage'), preview);
      await page.locator('#open-full-editor').click();
      await page.getByRole('tab', { name: 'Branding', exact: true }).click();
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
