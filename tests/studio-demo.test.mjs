import {legacyHTML} from './legacy-fixture.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import vm from "node:vm";
import { click } from "./ui.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox"],
});
test.after(() => browser.close());
const sandbox = {
  setImmediate,
  clearImmediate,
  setTimeout,
  clearTimeout,
  Uint8Array,
  ArrayBuffer,
  TextEncoder,
  TextDecoder,
};
vm.runInNewContext(
  await readFile(resolve(root, "vendor/jszip-3.10.1.min.js"), "utf8"),
  sandbox,
);
async function download(page, id, name) {
  const event = page.waitForEvent("download");
  await click(page, id);
  const file = resolve(root, "test-results", name);
  await mkdir(resolve(root, "test-results"), { recursive: true });
  await (await event).saveAs(file);
  return file;
}
test("generic demo is offline, fits both viewports, and exports its bundled image", async () => {
  const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      acceptDownloads: true,
    }),
    errors = [],
    network = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  try {
    await page.goto("file://" + resolve(root, "dist/presentation-studio.html"));
    await page.locator("#play").click();
    assert.equal(await page.locator(".dot").count(), 7);
    assert(!(await page.locator("#stage").innerText()).includes("legacy"));
    assert.equal(await page.locator("#stage .slide").count(), 8);
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(size);
      for (let i = 0; i < 7; i++) {
        await page.locator(".dot").nth(i).click();
        await page.waitForTimeout(450);
        const overflow = await page
          .locator("#stage .slide.active")
          .evaluate((slide) => {
            const stage = document
                .getElementById("stage")
                .getBoundingClientRect(),
              footer = document
                .querySelector("#stage>footer")
                .getBoundingClientRect();
            return [
              ...slide.querySelectorAll(
                "h1,h2,h3,p,pre,table,.card,.media-box",
              ),
            ]
              .filter((e) => {
                const r = e.getBoundingClientRect();
                return (
                  r.bottom > footer.top - 3 ||
                  r.left < stage.left - 1 ||
                  r.right > stage.right + 1
                );
              })
              .map((e) => e.textContent.slice(0, 50));
          });
        assert.deepEqual(
          overflow,
          [],
          "Slide " + i + " overflows at " + size.width,
        );
      }
    }
    await page.locator("#menu").click();
    assert(
      !(await page.locator(".section-options").innerText()).includes("legacy"),
    );
    await page.locator('[data-deck="studio-demonstration"]').click();
    await page.locator(".dot").nth(2).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#stage .slide.active .media-asset")
          ?.naturalWidth > 0,
    );
    await page.keyboard.press("q");
    await page.locator("#browse-questions").click();
    assert.equal(await page.locator(".question-option").count(), 1);
    await page.locator("#questions-close").click();
    await page.locator("#open-full-editor").click();
    assert.equal(await page.locator(".fe-slide-button").count(), 8);
    const file = await download(page, "#fe-export", "studio-demo-editable.zip");
    const zip = await sandbox.JSZip.loadAsync(
      new Uint8Array(await readFile(file)),
    );
    assert(zip.file("assets/studio-demo-workflow.svg"));
    const pack = JSON.parse(
      await zip.file("presentation.json").async("string"),
    );
    assert.equal(pack.state.origin, "studio");
    assert.equal(pack.state.sections.length, 3);
    const folder = resolve(root, "test-results/demo-reopened");
    await mkdir(resolve(folder, "assets"), { recursive: true });
    await writeFile(
      resolve(folder, "index.html"),
      await zip.file("index.html").async("string"),
    );
    await writeFile(
      resolve(folder, "assets/studio-demo-workflow.svg"),
      await zip.file("assets/studio-demo-workflow.svg").async("uint8array"),
    );
    const reopened = await browser.newPage();
    reopened.on("pageerror", (e) => errors.push(e.message));
    await reopened.goto("file://" + resolve(folder, "index.html"));
    await reopened.locator("#menu").click();
    await reopened.locator('[data-deck="studio-demonstration"]').click();
    await reopened.locator(".dot").nth(2).click();
    await reopened.waitForFunction(
      () =>
        document.querySelector("#stage .slide.active .media-asset")
          ?.naturalWidth > 0,
    );
    await reopened.close();
    await click(page, "#studio-new-open");
    if (await page.locator("#hub-switch").isVisible())
      await page.locator("#hub-save-switch").click();
    await page.locator("#nx-wizard").waitFor({ state: "visible" });
    const text = await page.locator("#nx-wizard").innerText();
    assert(text.includes("Studio demo"));
    assert(!text.includes("legacy"));
    assert.deepEqual(network, []);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
test("existing legacy schema-v2 ZIP opens in generic studio and keeps its reset baseline", async () => {
  const archive = await browser.newPage({ acceptDownloads: true }),
    page = await browser.newPage({ acceptDownloads: true }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await archive.goto(
      "file://" + await legacyHTML(root),
    );
    await archive.locator("#open-full-editor").click();
    const file = await download(
      archive,
      "#fe-export",
      "legacy-legacy-editable.zip",
    );
    await archive.close();
    await page.goto("file://" + resolve(root, "dist/presentation-studio.html"));
    await page.locator("#hub-presentations").click();
    await page.locator("#hub-file").setInputFiles(file);
    await page.locator("#hub-picker").waitFor({ state: "hidden" });
    await page.locator("#open-full-editor").click();
    assert.equal(await page.locator(".fe-slide-button").count(), 9);
    await page.locator("#fe-slide-title").fill("Temporary title");
    await page.waitForTimeout(400);
    await page
      .getByRole("tab", { name: "Recovery & reset", exact: true })
      .click();
    await page.locator("#fe-recovery-panel details > summary").click();
    await page.locator("#fe-reset-project").click();
    await page.locator("#fe-confirm-accept").click();
    assert.equal(await page.locator(".fe-slide-button").count(), 9);
    assert.notEqual(
      await page.locator("#fe-slide-title").inputValue(),
      "Temporary title",
    );
    await page.locator("#fe-close").click();
    await page.locator("#menu").click();
    await page.locator('[data-deck="qa"]').click();
    await page.locator("#browse-questions").click();
    assert.equal(await page.locator(".question-option").count(), 1);
    await page.locator("#questions-close").click();
    await page.locator("#menu").click();
    await page.locator('[data-deck="remqa"]').click();
    await page.locator("#browse-questions").click();
    assert.equal(await page.locator(".question-option").count(), 1);
    await page.locator("#questions-close").click();
    await page.locator("#open-full-editor").click();
    await click(page, "#studio-new-open");
    if (await page.locator("#hub-switch").isVisible())
      await page.locator("#hub-save-switch").click();
    await page.locator("#nx-wizard").waitFor({ state: "visible" });
    await page.locator('input[name="nx-start"][value="template"]').check();
    await page.locator("#nx-wizard-defaults").click();
    await page.locator("#nx-wizard").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".fe-slide-button").count(), 8);
    assert(
      !(await page.locator("#fe-preview").innerText()).includes("VENDOR"),
    );
    assert.deepEqual(errors, []);
  } finally {
    if (!archive.isClosed()) await archive.close();
    await page.close();
  }
});
