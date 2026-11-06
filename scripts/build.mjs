import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");
const config = JSON.parse(await read("build.config.json"));
const styles = (await Promise.all(config.styles.map(read))).join("\n");
const vendor = await read(config.vendor);
new vm.Script(vendor, { filename: config.vendor });
const licenseFiles = (await readdir(resolve(root, "vendor/licenses"))).sort();
const notices =
  (await read("LICENSE")) + "\n\n" + (await read("THIRD_PARTY_NOTICES.md")) +
  "\n\n" +
  (
    await Promise.all(
      licenseFiles.map(
        async (name) => name + "\n" + (await read("vendor/licenses/" + name)),
      ),
    )
  ).join("\n\n");
const source = (await read("src/shell.html")).replace(
  "</body>",
  () =>
    '<script id="third-party-notices" type="application/json">' +
    JSON.stringify(notices).replace(/</g, "\\u003c") +
    "</script></body>",
);
const demo = JSON.parse(await read("templates/studio/presentation.json"));
const blank = JSON.parse(await read("templates/blank/presentation.json"));
const image = await read("examples/sample-diagram.svg");
const assets = {
  "assets/studio-demo-workflow.svg": {
    type: "image/svg+xml",
    data: Buffer.from(image).toString("base64"),
  },
};
for (const [name, kind, project] of [
  ["presentation-studio.html", "generic", demo],
  ["presentation-studio-blank.html", "generic", blank],
]) {
  const paths = [...config.scripts];
  const boot = paths.pop();
  let app =
    (await Promise.all(paths.map(read))).join("\n") +
    "\n" +
    (await read("templates/studio/runtime.js")) +
    "\n" +
    (await read(boot));
  app = app.replace("/* @BUILD_KIND */", JSON.stringify(kind));
  new vm.Script(app, { filename: name + ".js" });
  let output = source;
  const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  for (const [token, value] of [
    ["/* @STYLES */", styles],
    [
      "<!-- @PRESENTATION_SLIDES -->",
      await read("templates/studio/initial.html"),
    ],
    ["@PROJECT_CONFIG", json(project)],
    [
      "@MEDIA_CONFIG",
      json({ schemaVersion: 1, slides: project?.state.media || {} }),
    ],
    ["@STUDIO_TEMPLATE", json(kind === "generic" ? demo : null)],
    ["@THEME_SCHEMES", json(JSON.parse(await read("src/themes.json")))],
    ["@STUDIO_ASSETS", json(kind === "generic" ? assets : {})],
    ["/* @ZIP_RUNTIME */", vendor],
    ["/* @APPLICATION */", app],
  ]) {
    if (output.split(token).length !== 2)
      throw new Error("Expected one " + token);
    output = output.replace(token, () => value);
  }
  const destination = resolve(root, "dist", name);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, output);
  console.log(
    "Built dist/" + name + " (" + Buffer.byteLength(output) + " bytes)",
  );
}
