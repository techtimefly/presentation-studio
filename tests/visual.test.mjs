import { selectTab } from './ui.mjs';
import { archivePath } from './archive-path.mjs';
import {legacyHTML} from './legacy-fixture.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import { click, reveal, addSlide } from "./ui.mjs";
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
const tab = (p, name) => selectTab(p, name);
async function download(p, selector, name) {
  const event = p.waitForEvent("download");
  await click(p, selector);
  const file = resolve(root, "test-results", name);
  await mkdir(dirname(file), { recursive: true });
  await (await event).saveAs(file);
  return file;
}
async function pack(p, name = "visual-project.json") {
  return JSON.parse(
    await readFile(await download(p, "#fe-export-json", name), "utf8"),
  );
}
async function setup(file = "presentation-studio-blank.html") {
  const p = await browser.newPage({
      acceptDownloads: true,
      viewport: { width: 1366, height: 768 },
    }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("file://" + (file === "synthetic-legacy.html" ? await legacyHTML(root) : resolve(root, "dist", file)));
  await p.locator("#open-full-editor").click();
  return { p, errors };
}
async function unpack(file, folder) {
  const zip = await sandbox.JSZip.loadAsync(
    new Uint8Array(await readFile(file)),
  );
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const path = archivePath(folder, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, await entry.async("uint8array"));
  }
  return JSON.parse(await zip.file("presentation.json").async("string"));
}
async function selectText(p, selector, start = 0, end = null) {
  await p.locator(selector).evaluate(
    (el, { start, end }) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT),
        nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push(n);
      const range = document.createRange();
      if (end === null) {
        range.selectNodeContents(el);
      } else {
        range.setStart(nodes[0], start);
        range.setEnd(nodes[0], end);
      }
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    },
    { start, end },
  );
}
test("six paired schemes meet text contrast and keep fonts, logos, legacy colors, and portable theme presets", async () => {
  const { p, errors } = await setup();
  try {
    await tab(p, "Branding");
    await p.locator("#fe-font").selectOption("Georgia");
    await p
      .locator("#fe-logo-file")
      .setInputFiles(resolve(root, "examples/sample-diagram.svg"));
    await reveal(p, "#fe-accent");
    await p.locator("#fe-accent").fill("#b12644");
    await p.waitForTimeout(400);
    const before = await pack(p, "visual-before.json");
    await p.locator("#te-open-gallery").click();
    assert.equal(await p.locator(".te-card").count(), 6);
    await p.locator('[data-scheme="indigo"]').click();
    await p.locator("#te-appearance").selectOption("dark");
    assert.equal(await p.locator("#fe-accent").inputValue(), "#b12644");
    await p.locator("#te-close").click();
    assert.equal(await p.locator("#fe-accent").inputValue(), "#b12644");
    await p.locator("#te-open-gallery").click();
    await p.locator('[data-scheme="indigo"]').click();
    await p.locator("#te-appearance").selectOption("dark");
    await p.locator("#te-apply").click();
    assert.equal(await p.locator("#fe-font").inputValue(), "Georgia");
    await p.waitForFunction(
      () =>
        document.querySelector("#fe-preview .project-logo")?.naturalWidth > 0,
    );
    assert.equal(await p.locator("#fe-bg").inputValue(), "#151024");
    assert.equal(
      await p
        .locator("#stage")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(21, 16, 36)",
    );
    const themed = await pack(p, "visual-themed.json");
    assert.deepEqual(themed.state.slides, before.state.slides);
    assert.deepEqual(themed.state.sections, before.state.sections);
    assert.equal(themed.state.brand.logo, before.state.brand.logo);
    await p.locator("#fe-undo").click();
    assert.equal(await p.locator("#fe-accent").inputValue(), "#b12644");
    await p.locator("#fe-redo").click();
    assert.equal(await p.locator("#fe-accent").inputValue(), "#bba3ff");
    await p.locator("#studio-presentation-theme").selectOption("light");
    await p.locator("#studio-theme-apply").click();
    assert.equal(await p.locator("#fe-accent").inputValue(), "#6241b5");
    await reveal(p, "#fe-accent");
    await p.locator("#fe-accent").fill("#005577");
    await p.waitForTimeout(400);
    assert((await p.locator("#te-current").innerText()).startsWith("Custom"));
    await p.locator("#studio-presentation-theme").selectOption("dark");
    await p.locator("#studio-theme-apply").click();
    assert.equal(await p.locator("#fe-accent").inputValue(), "#bba3ff");
    await p.locator("#studio-presentation-theme").selectOption("light");
    await p.locator("#studio-theme-apply").click();
    assert.equal(await p.locator("#fe-accent").inputValue(), "#005577");
    await p.locator("#te-open-gallery").click();
    await p.locator("#te-custom-name").fill("Workshop colors");
    await p.locator("#te-save-custom").click();
    await p.waitForFunction(() =>
      document.getElementById("te-message").textContent.includes("saved"),
    );
    await p.locator("#te-close").click();
    const presetFile = await download(
      p,
      "#nx-preset-export",
      "custom-theme.json",
    );
    const preset = JSON.parse(await readFile(presetFile, "utf8"));
    assert.equal(preset.scope, "theme");
    assert(!("font" in preset.brand));
    assert(!("logo" in preset.brand));
    await p.locator("#fe-font").selectOption("Verdana");
    await p.locator("#te-open-gallery").click();
    await p.locator('[data-scheme="forest"]').click();
    await p.locator("#te-apply").click();
    await click(p, "#nx-preset-apply");
    assert.equal(await p.locator("#fe-font").inputValue(), "Verdana");
    assert.equal(await p.locator("#fe-accent").inputValue(), "#005577");
    assert.equal(await p.locator("#fe-preview .project-logo").count(), 1);
    await p.locator("#nx-preset-file").setInputFiles(presetFile);
    await p.waitForFunction(
      () => document.querySelectorAll("#nx-preset option").length === 3,
    );
    const last = await p
      .locator("#nx-preset option")
      .last()
      .getAttribute("value");
    await reveal(p, "#nx-preset");
    await p.locator("#nx-preset").selectOption(last);
    await click(p, "#nx-preset-apply");
    assert.equal(await p.locator("#fe-font").inputValue(), "Verdana");
    assert((await p.locator("#te-current").innerText()).startsWith("Custom"));
    // A pre-theme-gallery brand clears new palette tokens instead of inheriting them.
    const legacy = {
      schemaVersion: 1,
      kind: "presentation-studio-brand",
      name: "Legacy brand",
      brand: {
        accent: "#902233",
        background: "#fff4e8",
        ink: "#241b15",
        font: "Georgia",
        headerTitle: "LEGACY",
        presentationTheme: "light",
      },
      assets: {},
    };
    const legacyFile = resolve(root, "test-results/legacy-brand.json");
    await writeFile(legacyFile, JSON.stringify(legacy));
    await p.locator("#nx-preset-file").setInputFiles(legacyFile);
    await p.waitForFunction(
      () => document.querySelectorAll("#nx-preset option").length === 4,
    );
    await p
      .locator("#nx-preset")
      .selectOption(
        await p.locator("#nx-preset option").last().getAttribute("value"),
      );
    await click(p, "#nx-preset-apply");
    assert.equal(await p.locator("#fe-accent").inputValue(), "#902233");
    assert.equal(
      await p
        .locator("#fe-preview .card")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(255, 255, 255)",
    );
    assert.deepEqual(errors, []);
  } finally {
    await p.close();
  }
});
test("inline text, formatting, cards, lists, safe paste, tables, and commands use the existing model and undo", async () => {
  const { p, errors } = await setup();
  try {
    const heading = p.locator("#fe-preview h1");
    await heading.click();
    await heading.fill("Hello visual editor");
    await p.waitForTimeout(700);
    assert.equal(await heading.getAttribute("contenteditable"), "true");
    await heading.press("End");
    await heading.pressSequentially("!");
    await p.waitForTimeout(450);
    assert.equal(
      await p.locator("#fe-slide-title").inputValue(),
      "Hello visual editor!",
    );
    await selectText(p, "#fe-preview h1", 0, 5);
    await p.locator("#vb-bold").click();
    assert.equal(await p.locator("#fe-preview h1 strong").innerText(), "Hello");
    await p.locator("#vb-italic").click();
    assert.equal(await p.locator("#fe-preview h1 i").innerText(), "Hello");
    await p.locator("#vb-align").selectOption("center");
    await heading.press("Escape");
    assert.equal(await p.locator("#full-editor").isVisible(), true);
    assert.equal(
      await p.locator("#fe-preview h1").getAttribute("contenteditable"),
      null,
    );
    await p.locator("#fe-undo").click();
    await p.locator("#fe-redo").click();
    assert.equal(
      await p
        .locator("#fe-preview h1")
        .evaluate((e) => getComputedStyle(e).textAlign),
      "center",
    );
    await p.locator("#fe-preview h1").click();
    await selectText(p, "#fe-preview h1 strong", 1, 4);
    await p.locator("#vb-bold").click();
    await p.locator("#vb-done").click();
    assert.deepEqual(
      await p.locator("#fe-preview h1 strong").allTextContents(),
      ["H", "o"],
    );
    await p.locator("#fe-undo").click();
    assert.equal(await p.locator("#fe-preview h1 strong").innerText(), "Hello");
    const lead = p.locator("#fe-preview .lead");
    await lead.click();
    await lead.fill("");
    await p.evaluate(() => {
      const d = new DataTransfer();
      d.setData("text/plain", "Safe <img> text\nSecond line");
      d.setData(
        "text/html",
        '<img src=x onerror="window.visualInjected=true"><script>window.visualInjected=true</script>',
      );
      document
        .querySelector("#fe-preview .lead")
        .dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: d,
            bubbles: true,
            cancelable: true,
          }),
        );
    });
    assert.equal(await p.evaluate(() => window.visualInjected), undefined);
    assert.equal(await p.locator("#fe-preview .lead img").count(), 0);
    await p.locator("#vb-bullets").click();
    assert.equal(await p.locator("#fe-preview .editor-bullets li").count(), 2);
    await p.locator("#fe-preview .editor-bullets li").first().click();
    await p.locator("#vb-duplicate").click();
    assert.equal(await p.locator("#fe-preview .editor-bullets li").count(), 3);
    await p.locator("#vb-delete").click();
    assert.equal(await p.locator("#fe-preview .editor-bullets li").count(), 2);
    await p.locator("#fe-undo").click();
    assert.equal(await p.locator("#fe-preview .editor-bullets li").count(), 3);
    await p.locator("#fe-redo").click();
    await p.locator("#fe-preview .card").click({ position: { x: 2, y: 2 } });
    assert.equal(await p.locator("#vb-selection-label").innerText(), "Card");
    await p.locator("#vb-duplicate").click();
    assert.equal(await p.locator("#fe-preview .card").count(), 2);
    await p.locator("#vb-delete").click();
    assert.equal(await p.locator("#fe-preview .card").count(), 1);
    await p.locator("#fe-preview h1").click();
    assert.equal(await p.locator("#vb-delete").isDisabled(), true);
    await p.locator("#fe-preview h1").press("Escape");
    await addSlide(p, "table");
    const first = p.locator("#fe-preview tbody td").first();
    await first.click();
    await first.fill("Edited cell");
    await first.press("Tab");
    await p.keyboard.type("Updated detail");
    await p.locator("#vb-bold").click();
    await p.locator("#vb-done").click();
    await tab(p, "Tables");
    assert.equal(
      await p.getByLabel("Row 1 column 1", { exact: true }).inputValue(),
      "Edited cell",
    );
    await p.getByLabel("Row 1 column 2", { exact: true }).fill("Panel update");
    await p.waitForTimeout(400);
    assert.equal(
      await p.locator("#fe-preview tbody td").nth(1).innerText(),
      "Panel update",
    );
    await addSlide(p, "code");
    await p.locator("#fe-preview pre").click();
    assert(
      (await p.locator("#vb-selection-label").innerText()).includes("Commands"),
    );
    await p.locator("#vb-panel").click();
    assert.equal(await p.locator("#fe-commands-panel").isVisible(), true);
    const data = await pack(p, "blocks-project.json");
    assert(!JSON.stringify(data.state.slides).includes("data-vb-"));
    assert(!JSON.stringify(data.state.slides).includes("vb-target"));
    assert(!JSON.stringify(data.state.slides).includes("contenteditable"));
    assert.deepEqual(errors, []);
  } finally {
    await p.close();
  }
});
test("media selection, preview interaction, and muted video remain separate from block editing", async () => {
  const { p, errors } = await setup("presentation-studio.html");
  try {
    await p
      .locator(".fe-slide-button")
      .filter({ hasText: "Bring your content to life" })
      .click();
    await p.locator("#fe-preview .media-box").click();
    assert.equal(await p.locator("#vb-selection-label").innerText(), "Media");
    assert.equal(await p.locator("#vb-bold").isDisabled(), true);
    await p.locator("#vb-panel").click();
    assert.equal(await p.locator("#media-editor").isVisible(), true);
    const bytes = await p.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 180;
      const g = c.getContext("2d");
      g.fillStyle = "#0066ff";
      g.fillRect(0, 0, 320, 180);
      const stream = c.captureStream(8),
        recorder = new MediaRecorder(stream, { mimeType: "video/webm" }),
        chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));
      recorder.start();
      let frame = 0;
      const drawing = setInterval(() => {
        g.fillStyle = frame++ % 2 ? "#0066ff" : "#78adff";
        g.fillRect(0, 0, 320, 180);
      }, 50);
      await new Promise((resolve) => setTimeout(resolve, 650));
      clearInterval(drawing);
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      return [
        ...new Uint8Array(
          await new Blob(chunks, { type: "video/webm" }).arrayBuffer(),
        ),
      ];
    });
    await p
      .locator("#me-file")
      .setInputFiles({
        name: "preview.webm",
        mimeType: "video/webm",
        buffer: Buffer.from(bytes),
      });
    await p.waitForTimeout(300);
    await p.locator("#me-close").click();
    await p.locator("#open-full-editor").click();
    await p
      .locator(".fe-slide-button")
      .filter({ hasText: "Bring your content to life" })
      .click();
    await p.locator("#vb-preview-mode").click();
    await p.waitForFunction(
      () => document.querySelector("#fe-preview video")?.readyState >= 2,
    );
    assert.equal(
      await p
        .locator("#fe-preview video")
        .evaluate((v) => v.controls && v.muted),
      true,
    );
    await p.locator("#fe-preview video").evaluate((v) => v.play());
    await p.waitForTimeout(150);
    assert(
      (await p.locator("#fe-preview video").evaluate((v) => v.currentTime)) > 0,
    );
    await p.locator("#vb-edit-mode").click();
    assert.equal(
      await p
        .locator("#fe-preview video")
        .evaluate((v) => v.paused && !v.controls),
      true,
    );
    await p
      .locator(".fe-slide-button")
      .filter({ hasText: "How do I make this presentation my own?" })
      .click();
    await p.locator("#fe-preview .qa-browse").click();
    assert.equal(await p.locator("#question-browser").isVisible(), false);
    await p.locator("#vb-preview-mode").click();
    await p.locator("#fe-preview .qa-browse").click();
    assert.equal(await p.locator("#question-browser").isVisible(), true);
    await p.locator(".question-option").first().click();
    assert.equal(await p.locator("#full-editor").isVisible(), true);
    assert.equal(
      await p.locator("#fe-preview [contenteditable=true]").count(),
      0,
    );
    assert.deepEqual(errors, []);
  } finally {
    await p.close();
  }
});
test("legacy ZIP supports theme and block editing through export and reopen", async () => {
  const { p: archive } = await setup("synthetic-legacy.html"),
    { p, errors } = await setup("presentation-studio.html");
  try {
    const legacyFile = await download(
      archive,
      "#fe-export",
      "visual-legacy-v2.zip",
    );
    await p.locator("#fe-close").click();
    await p.locator("#hub-presentations").click();
    await p.locator("#hub-file").setInputFiles(legacyFile);
    await p.locator("#hub-picker").waitFor({ state: "hidden" });
    await p.locator("#open-full-editor").click();
    assert.equal(await p.locator(".fe-slide-button").count(), 9);
    const initial = await pack(p, "legacy-visual-before.json");
    const h = p.locator("#fe-preview h1");
    await h.click();
    await h.fill("Customer security workshop");
    await selectText(p, "#fe-preview h1");
    await p.locator("#vb-bold").click();
    await p.locator("#vb-align").selectOption("center");
    await h.press("Escape");
    await tab(p, "Branding");
    await p.locator("#te-open-gallery").click();
    await p.locator('[data-scheme="midnight"]').click();
    await p.locator("#te-appearance").selectOption("dark");
    await p.locator("#te-apply").click();
    assert.equal(
      await p.locator("#fe-font").inputValue(),
      initial.state.brand.font,
    );
    const file = await download(p, "#fe-export", "visual-legacy-edited.zip"),
      folder = resolve(root, "test-results/visual-legacy-reopened"),
      data = await unpack(file, folder);
    assert.equal(data.state.slides.length, 9);
    assert.equal(data.state.brand.colorScheme, "midnight");
    assert.deepEqual(data.state.sections, initial.state.sections);
    assert.deepEqual(data.state.loops, initial.state.loops);
    assert.equal(data.state.slides[0].title, "Customer security workshop");
    assert(!JSON.stringify(data.state.slides).includes("data-vb-"));
    const q = await browser.newPage();
    q.on("pageerror", (e) => errors.push(e.message));
    await q.goto("file://" + resolve(folder, "index.html"));
    assert.equal(
      await q.locator("#stage .slide.active h1").innerText(),
      "Customer security workshop",
    );
    assert.equal(
      await q
        .locator("#stage .slide.active h1")
        .evaluate((e) => getComputedStyle(e).textAlign),
      "center",
    );
    assert.equal(
      await q.locator("#stage .slide.active h1 strong").innerText(),
      "Customer security workshop",
    );
    assert.equal(
      await q
        .locator("#stage")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(7, 24, 35)",
    );
    await q.locator("#menu").click();
    await q.locator('[data-deck="qa"]').click();
    await q.locator("#browse-questions").click();
    assert.equal(await q.locator(".question-option").count(), 1);
    await q.close();
    assert.deepEqual(errors, []);
  } finally {
    await archive.close();
    await p.close();
  }
});
