import { selectTab } from './ui.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { click } from "./ui.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const options = {
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox"],
};
const browser = await chromium.launch(options);
test.after(() => browser.close());
const tab = (page, name) =>
  selectTab(page, name);
async function saved(page) {
  await page.waitForFunction(
    () => document.getElementById("fe-status").dataset.saveState === "saved",
  );
}
async function picker(page) {
  if (!(await page.locator("#hub-picker").isVisible())) {
    if (await page.locator("#full-editor").isVisible())
      await click(page, "#hub-editor-projects");
    else await page.locator("#hub-presentations").click();
  }
  await page.waitForFunction(
    () =>
      !document.getElementById("hub-message").textContent.startsWith("Loading"),
  );
}
const card = (page, name) =>
  page
    .locator(".hub-project-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
async function nextProject(page, name) {
  await picker(page);
  await page.locator("#hub-new").click();
  if (await page.locator("#hub-switch").isVisible())
    await page.locator("#hub-save-switch").click();
  await page.locator("#nx-wizard").waitFor({ state: "visible" });
  await page.locator("#nx-wizard-next").click();
  await page.locator("#nx-wizard-name").fill(name);
  await page.locator("#nx-wizard-defaults").click();
  if (await page.locator("#fe-confirm").isVisible())
    await page.locator("#fe-confirm-accept").click();
  await page.locator("#nx-wizard").waitFor({ state: "hidden" });
  await saved(page);
}
test("compact controls and recent drafts support safe switching, duplication, backup, and deletion", async () => {
  const page = await browser.newPage({
      acceptDownloads: true,
      viewport: { width: 1366, height: 768 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("file://" + resolve(root, "dist/presentation-studio.html"));
    assert.equal(await page.locator("#controls>button:visible").count(), 7);
    await page.locator("#open-full-editor").click();
    assert.equal(
      await page.locator(".fe-top-actions>button:visible").count(),
      5,
    );
    await tab(page, "Branding");
    await page.locator("#fe-project-name").fill("Customer A");
    await page
      .locator("#fe-logo-file")
      .setInputFiles(resolve(root, "examples/sample-diagram.svg"));
    await saved(page);
    assert.equal(await page.locator("#open-full-editor").textContent(), "Edit");
    await picker(page);
    assert.equal(await page.locator(".hub-project-card").count(), 1);
    await card(page, "Customer A · Current")
      .getByRole("button", { name: "Duplicate", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll(".hub-project-card").length === 2,
    );
    await card(page, "Customer A copy")
      .getByRole("button", { name: "Open", exact: true })
      .click();
    await page.locator("#hub-switch").waitFor({ state: "visible" });
    await page.locator("#hub-cancel-switch").click();
    assert.equal(await page.locator("#fe-title").textContent(), "Customer A");
    await card(page, "Customer A copy")
      .getByRole("button", { name: "Open", exact: true })
      .click();
    const download = page.waitForEvent("download");
    await page.locator("#hub-export-switch").click();
    const path = resolve(root, "test-results/customer-a-backup.zip");
    await mkdir(resolve(root, "test-results"), { recursive: true });
    await (await download).saveAs(path);
    assert((await readFile(path)).byteLength > 10000);
    await page.locator("#hub-picker").waitFor({ state: "hidden" });
    assert.equal(
      await page.locator("#fe-title").textContent(),
      "Customer A copy",
    );
    await page.waitForFunction(
      () =>
        document.querySelector("#fe-preview .project-logo")?.naturalWidth > 0,
    );
    await tab(page, "Content");
    await page.locator("#fe-slide-title").fill("Customer B content");
    await saved(page);
    await picker(page);
    await card(page, "Customer A")
      .getByRole("button", { name: "Open", exact: true })
      .click();
    await page.locator("#hub-save-switch").click();
    await page.locator("#hub-picker").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#fe-title").textContent(), "Customer A");
    // Reopening an older same-ID file retains the newer local state independently.
    await tab(page, "Content");
    await page.locator("#fe-slide-title").fill("Newer local heading");
    await saved(page);
    await picker(page);
    await page.locator("#hub-file").setInputFiles(path);
    await page.locator("#hub-switch").waitFor({ state: "visible" });
    await page.locator("#hub-save-switch").click();
    await page.locator("#hub-picker").waitFor({ state: "hidden" });
    await picker(page);
    const prior = page
      .locator(".hub-project-card")
      .filter({ hasText: "Customer A (previous local version)" });
    assert.equal(await prior.count(), 1);
    await prior.getByRole("button", { name: "Open", exact: true }).click();
    await page.locator("#hub-picker").waitFor({ state: "hidden" });
    assert.equal(
      await page.locator("#fe-slide-title").inputValue(),
      "Newer local heading",
    );
    await picker(page);
    await page.locator("#hub-search").fill("copy");
    assert.equal(await page.locator(".hub-project-card").count(), 1);
    await page.locator("#hub-search").fill("");
    await card(page, "Customer A copy")
      .getByRole("button", { name: "Remove local copy", exact: true })
      .click();
    await page.locator("#fe-confirm-accept").click();
    await page.waitForFunction(
      () =>
        !document
          .getElementById("hub-project-list")
          .textContent.includes("Customer A copy"),
    );
    assert.equal(await page.locator(".hub-project-card").count(), 2);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
test("failed local writes and incomplete draft media do not replace the active project", async () => {
  const page = await browser.newPage({
      viewport: { width: 1366, height: 768 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("file://" + resolve(root, "dist/presentation-studio.html"));
    await page.locator("#open-full-editor").click();
    await tab(page, "Branding");
    await page.locator("#fe-project-name").fill("Safe original");
    await saved(page);
    await nextProject(page, "Target");
    await tab(page, "Branding");
    await page
      .locator("#fe-logo-file")
      .setInputFiles(resolve(root, "examples/sample-diagram.svg"));
    await saved(page);
    await picker(page);
    await card(page, "Safe original")
      .getByRole("button", { name: "Open", exact: true })
      .click();
    await page.locator("#hub-save-switch").click();
    await page.locator("#hub-picker").waitFor({ state: "hidden" });
    await tab(page, "Content");
    await page.locator("#fe-slide-title").fill("Must remain open");
    await saved(page);
    await page.evaluate(() => {
      window.hubTestTransaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
        if (mode === "readwrite")
          throw new DOMException(
            "Simulated quota exhaustion",
            "QuotaExceededError",
          );
        return window.hubTestTransaction.call(this, stores, mode, ...args);
      };
    });
    await picker(page);
    await card(page, "Target")
      .getByRole("button", { name: "Open", exact: true })
      .click();
    await page.locator("#hub-save-switch").click();
    await page.waitForFunction(() =>
      document
        .getElementById("hub-switch-message")
        .textContent.includes("could not be saved"),
    );
    assert.equal(
      await page.locator("#fe-title").textContent(),
      "Safe original",
    );
    assert.equal(
      await page.locator("#fe-slide-title").inputValue(),
      "Must remain open",
    );
    await page.locator("#hub-cancel-switch").click();
    await page.evaluate(() => {
      IDBDatabase.prototype.transaction = window.hubTestTransaction;
    });
    const id = await card(page, "Target").getAttribute("data-project-id");
    await page.evaluate(async (id) => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("presentation-studio-editor-v1", 1);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("assets", "readwrite"),
          r = tx.objectStore("assets").openCursor();
        r.onsuccess = () => {
          const c = r.result;
          if (c) {
            if (String(c.key).startsWith(id + "|")) c.delete();
            c.continue();
          }
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, id);
    await card(page, "Target")
      .getByRole("button", { name: "Open", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .getElementById("hub-message")
        .textContent.includes("missing media"),
    );
    assert.equal(
      await page.locator("#fe-title").textContent(),
      "Safe original",
    );
    assert.equal(await page.locator("#hub-switch").isVisible(), false);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
test("recent drafts and media survive closing and reopening the browser profile", async () => {
  const profile = await mkdtemp(resolve(tmpdir(), "studio-profile-"));
  let context = await chromium.launchPersistentContext(profile, options);
  let page = await context.newPage();
  try {
    await page.goto("file://" + resolve(root, "dist/presentation-studio.html"));
    await page.locator("#open-full-editor").click();
    await tab(page, "Branding");
    await page.locator("#fe-project-name").fill("Persistent workshop");
    await page
      .locator("#fe-logo-file")
      .setInputFiles(resolve(root, "examples/sample-diagram.svg"));
    await saved(page);
    await context.close();
    context = await chromium.launchPersistentContext(profile, options);
    page = await context.newPage();
    await page.goto("file://" + resolve(root, "dist/presentation-studio.html"));
    await page.locator("#open-full-editor").click();
    await page.locator("#fe-recovery").waitFor({ state: "visible" });
    await page.locator("#fe-recover").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#fe-preview .project-logo")?.naturalWidth > 0,
    );
    await picker(page);
    assert.equal(await card(page, "Persistent workshop · Current").count(), 1);
  } finally {
    await context.close();
  }
});
