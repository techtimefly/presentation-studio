import { click, reveal } from './ui.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
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
async function unpack(file, destination) {
  const zip = await sandbox.JSZip.loadAsync(
    new Uint8Array(await readFile(file)),
  );
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const path = resolve(destination, name);
    assert(path.startsWith(resolve(destination) + "/"));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, await entry.async("uint8array"));
  }
  return JSON.parse(await zip.file("presentation.json").async("string"));
}
test("theme logos, brand presets, and transition overrides survive editable and playback packages", async () => {
  const page = await browser.newPage({
    acceptDownloads: true,
    viewport: { width: 1366, height: 768 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const tab = (name) => page.getByRole("tab", { name, exact: true }).click();
  const download = async (selector, name) => {
    const event = page.waitForEvent("download");
    await click(page, selector);
    const path = resolve(root, "test-results", name);
    await mkdir(dirname(path), { recursive: true });
    await (await event).saveAs(path);
    return path;
  };
  try {
    await page.goto("file://" + resolve(root, "dist/presentation-studio.html"));
    await page.locator("#open-full-editor").click();
    await page
      .locator("#fe-import-file")
      .setInputFiles(resolve(root, "examples/layout-sampler.json"));
    await page.waitForTimeout(250);
    await tab("Branding");
    await reveal(page, "#nx-logo-variant");
    await page.locator("#nx-logo-variant").selectOption("logoDark");
    await page
      .locator("#fe-logo-file")
      .setInputFiles(resolve(root, "examples/sample-diagram.svg"));
    await page.waitForTimeout(200);
    await reveal(page, "#nx-preset-name");
    await page.locator("#nx-preset-name").fill("Portable sample");
    await reveal(page, "#nx-preset-save");
    await page.locator("#nx-preset-save").click();
    await page.waitForTimeout(200);
    await reveal(page, "#nx-preset-apply");
    await page.locator("#nx-preset-apply").click();
    await reveal(page, "#nx-title-logo");
    await page.locator("#nx-title-logo").check();
    await reveal(page, "#nx-logo-placement");
    await page.locator("#nx-logo-placement").selectOption("right");
    await page.locator("#studio-presentation-theme").selectOption("dark");
    await page.locator("#studio-theme-apply").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#fe-preview .project-logo")?.naturalWidth > 0,
    );
    await tab("Presentation settings");
    await page.locator("#nx-transition").selectOption("fade");
    await page.locator("#nx-speed").selectOption("slow");
    await page.locator("#nx-section-transition").selectOption("zoom");
    await page.locator("#nx-slide-transition").selectOption("slide");
    await page.locator("#nx-disable-motion").check();
    const editable = await download("#fe-export", "experience-editable.zip");
    const playback = await download("#fe-playback", "experience-playback.zip");
    for (const [file, kind] of [
      [editable, "editable"],
      [playback, "playback"],
    ]) {
      const folder = resolve(root, "test-results/experience-" + kind),
        pack = await unpack(file, folder);
      assert.equal(pack.state.presentation.transition, "fade");
      assert.equal(pack.state.presentation.sectionTransition, "zoom");
      assert.equal(pack.state.presentation.disableMotion, true);
      assert.equal(pack.state.slides[0].transition, "slide");
      assert.equal(pack.state.brand.logoPlacement, "right");
      assert.equal(pack.state.brand.titleLogo, true);
      assert(pack.state.brand.logoDark.endsWith(".svg"));
      const reopened = await browser.newPage();
      reopened.on("pageerror", (e) => errors.push(e.message));
      await reopened.goto("file://" + resolve(folder, "index.html"));
      await reopened.waitForFunction(
        () => document.querySelector("#stage .project-logo")?.naturalWidth > 0,
      );
      assert.equal(await reopened.locator("#stage").evaluate(e => getComputedStyle(e).backgroundColor), "rgb(7, 17, 31)");
      assert(
        await reopened
          .locator("body")
          .evaluate((e) => e.classList.contains("nx-no-motion")),
      );
      if (kind === "editable") {
        await reopened.locator("#open-full-editor").click();
        await reopened
          .getByRole("tab", { name: "Presentation settings", exact: true })
          .click();
        assert.equal(
          await reopened.locator("#nx-slide-transition").inputValue(),
          "slide",
        );
      } else {
        assert.equal(pack.checkpoints.length, 0);
        assert(
          await reopened
            .locator("body")
            .evaluate((e) => e.classList.contains("playback-only")),
        );
      }
      await reopened.close();
    }
    // Check real playback without project motion suppression.
    await page.locator("#nx-disable-motion").uncheck();
    await page.locator("#fe-close").click();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#play").click();
    await page.locator("#next").click();
    await page.waitForTimeout(200);
    assert.equal(
      await page.locator("#fill").evaluate((e) => e.style.width),
      "0%",
    );
    await page.waitForTimeout(650);
    assert(
      parseFloat(await page.locator("#fill").evaluate((e) => e.style.width)) >
        0,
    );
    await page.locator("#menu").click();
    const qa = page
      .locator(".section-options button")
      .filter({ hasText: "Questions" });
    await qa.click();
    assert.equal(await page.locator("#stage .nx-transition-ghost").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
