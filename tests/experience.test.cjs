const { chromium } = require("playwright"),
  assert = require("assert"),
  fs = require("fs"),
  path = require("path");
(async () => {
  const {click,reveal,addSlide} = await import("./ui.mjs");
  const b = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const p = await b.newPage({
      viewport: { width: 1366, height: 768 },
      acceptDownloads: true,
    }),
    errors = [];
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("ERROR", e.message);
  });
  const root = process.cwd() + "/";
  const tab = (n) => p.getByRole("tab", { name: n, exact: true }).click();
  const download = async (sel, name) => {
    const d = p.waitForEvent("download");
    await click(p,sel);
    await (await d).saveAs("/tmp/" + name);
    return JSON.parse(fs.readFileSync("/tmp/" + name));
  };
  await p.goto("file://" + root + "dist/presentation-studio.html");
  await p.locator("#open-full-editor").click();
  await click(p,"#studio-new-open");
  if(await p.locator("#hub-switch").isVisible()) await p.locator("#hub-save-switch").click();
  await p.locator("#nx-wizard").waitFor({state:"visible"});
  assert(await p.locator("#nx-wizard").isVisible());
  await p.locator("#nx-wizard-next").click();
  await p.locator("#nx-wizard-name").fill("Customer workshop");
  await p.locator("#nx-wizard-header").fill("ISLAND TECH");
  await p.locator("#nx-wizard-accent").fill("#aa33cc");
  await p.locator("#nx-wizard-next").click();
  await p.locator("#nx-wizard-layout").selectOption("qa");
  await p.locator("#nx-wizard-next").click();
  await p.locator("#nx-wizard-theme").selectOption("dark");
  await p.locator("#nx-wizard-editor").selectOption("dark");
  await p.locator("#nx-wizard-transition").selectOption("slide");
  await p.locator("#nx-wizard-next").click();
  await p
    .locator("#nx-wizard")
    .waitFor({ state: "hidden", timeout: 5000 })
    .catch(async (e) => {
      console.log(await p.locator("#nx-wizard-message").innerText());
      throw e;
    });
  assert.equal(await p.locator(".fe-slide-button").count(), 1);
  let pack = await download("#fe-export-json", "experience.json");
  assert.equal(pack.state.brand.headerTitle, "ISLAND TECH");
  assert.equal(pack.state.presentation.transition, "slide");
  assert.equal(pack.state.sections[0].kind, "qa");
  await tab("Branding");
  await p
    .locator("#fe-logo-file")
    .setInputFiles(root + "examples/sample-diagram.svg");
  await p.waitForTimeout(200);
  await reveal(p,"#nx-logo-size");
  await p.locator("#nx-logo-size").fill("55");
  await reveal(p,"#nx-logo-size");
  await p.locator("#nx-logo-size").dispatchEvent("input");
  await p.waitForTimeout(400);
  await reveal(p,"#nx-logo-placement");
  await p.locator("#nx-logo-placement").selectOption("right");
  await reveal(p,"#nx-preset-name");
  await p.locator("#nx-preset-name").fill("Island workshop");
  await reveal(p,"#nx-preset-save");
  await p.locator("#nx-preset-save").click();
  await p.waitForTimeout(300);
  assert.equal(await p.locator("#nx-preset option").count(), 2);
  const preset = await download("#nx-preset-export", "experience-brand.json");
  assert(preset.assets[preset.brand.logo]);
  await reveal(p, "#fe-accent");
  await p.locator("#fe-accent").fill("#00aa22");
  await p.waitForTimeout(400);
  await reveal(p,"#nx-preset-apply");
  await p.locator("#nx-preset-apply").click();
  assert.equal(await p.locator("#fe-accent").inputValue(), "#aa33cc");
  await p.locator("#studio-presentation-theme").selectOption("light");
  await p.locator("#studio-theme-apply").click();
  assert.equal(await p.locator("#fe-accent").inputValue(), "#aa33cc");
  await p.locator("#studio-presentation-theme").selectOption("dark");
  await p.locator("#nx-theme-defaults").check();
  await p.locator("#studio-theme-apply").click();
  assert.equal(await p.locator("#fe-accent").inputValue(), "#78adff");
  await p
    .locator("#nx-preset-file")
    .setInputFiles("/tmp/experience-brand.json");
  await p.waitForTimeout(300);
  assert.equal(await p.locator("#nx-preset option").count(), 3);
  await click(p,"#studio-new-open");
  if(await p.locator("#hub-switch").isVisible()) await p.locator("#hub-save-switch").click();
  await p.locator("#nx-wizard").waitFor({state:"visible"});
  await p.locator("#nx-wizard-defaults").click();
  if (await p.locator("#fe-confirm").isVisible())
    await p.locator("#fe-confirm-accept").click();
  await p.waitForTimeout(200);
  await p
    .locator("#fe-import-file")
    .setInputFiles(root + "examples/layout-sampler.json");
  await p.waitForTimeout(300);
  if (await p.locator("#fe-confirm").isVisible())
    await p.locator("#fe-confirm-accept").click();
  await tab("Presentation settings");
  await p.locator("#nx-transition").selectOption("slide");
  await p.locator("#nx-speed").selectOption("slow");
  await p.locator("#fe-close").click();
  await p.emulateMedia({ reducedMotion: "no-preference" });
  await p.locator("#next").click();
  assert(await p.locator("#stage .nx-transition-ghost").count());
  await p.locator("#prev").click();
  await p.locator("#next").click();
  await p.waitForTimeout(800);
  assert.equal(await p.locator("#stage .nx-transition-ghost").count(), 0);
  assert.equal(await p.locator("#stage .slide.active").count(), 1);
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.locator("#next").click();
  assert.equal(await p.locator("#stage .nx-transition-ghost").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS new wizard/custom header/theme/layout; logo upload/size/placement; preset save/apply/import/export; custom colors/theme reset; rapid transitions/reduced motion.",
  );
  await b.close();
})();
