// Optional paired theme tokens; old projects keep their exact stored colors.
const teSchemes = JSON.parse($("theme-schemes-config").textContent);
const teTokens = [
  "background",
  "ink",
  "accent",
  "surface",
  "surfaceAlt",
  "muted",
  "border",
  "accentInk",
  "terminal",
  "secondary",
];
const teScheme = (id) => teSchemes.find((s) => s.id === id);
function teColors(raw, fallback) {
  return Object.fromEntries(
    teTokens.map((key) => [key, nxColor(raw?.[key], fallback[key])]),
  );
}
function teBrandExtras(raw, base) {
  const palettes = {};
  for (const mode of ["light", "dark"])
    if (
      raw?.themePalettes?.[mode] &&
      typeof raw.themePalettes[mode] === "object"
    )
      palettes[mode] = teColors(raw.themePalettes[mode], teSchemes[0][mode]);
  const result = {
    ...base,
    ...(Object.keys(palettes).length ? { themePalettes: palettes } : {}),
    ...(teScheme(raw?.colorScheme) || raw?.colorScheme === "custom"
      ? { colorScheme: raw.colorScheme }
      : {}),
    ...(teScheme(raw?.schemeBase) ? { schemeBase: raw.schemeBase } : {}),
  };
  const scheme = teScheme(result.colorScheme),
    mode = result.presentationTheme || "light";
  if (
    scheme &&
    palettes[mode] &&
    (["accent", "background", "ink"].some(
      (key) => result[key] !== scheme[mode][key],
    ) ||
      ["light", "dark"].some(
        (m) =>
          palettes[m] &&
          teTokens.some((key) => palettes[m][key] !== scheme[m][key]),
      ))
  ) {
    result.colorScheme = "custom";
    result.schemeBase = scheme.id;
  }
  return result;
}
const teValidate = projectValidateState;
projectValidateState = function (raw, nested = false) {
  const state = teValidate(raw, nested);
  state.brand = teBrandExtras(raw.brand, state.brand);
  return state;
};
const teOldPalette = studioPalette;
studioPalette = function (brand) {
  const mode = brand.presentationTheme === "dark" ? "dark" : "light";
  return {
    ...teOldPalette(brand),
    ...(brand.themePalettes?.[mode] || {}),
    accent: brand.accent,
    background: brand.background,
    ink: brand.ink,
    font: brand.font || "Arial",
  };
};
function tePair(brand) {
  const result = {};
  for (const mode of ["light", "dark"]) {
    const legacy = brand.themeColors?.[mode] || {};
    result[mode] = teColors(brand.themePalettes?.[mode], {
      ...teSchemes[0][mode],
      ...legacy,
    });
  }
  result[brand.presentationTheme || "light"] = teColors(
    studioPalette(brand),
    teSchemes[0][brand.presentationTheme || "light"],
  );
  return result;
}
const teOldThemeBrand = nxThemeBrand;
nxThemeBrand = function (mode, defaults = false, input = projectState.brand) {
  if (!input.themePalettes) return teOldThemeBrand(mode, defaults, input);
  const palettes = tePair(input),
    base = teScheme(input.schemeBase || input.colorScheme) || teSchemes[0];
  if (defaults) palettes[mode] = projectCopy(base[mode]);
  const p = palettes[mode];
  const exact = ["light", "dark"].every((m) =>
    teTokens.every((key) => palettes[m][key] === base[m][key]),
  );
  return {
    ...projectCopy(input),
    themePalettes: palettes,
    background: p.background,
    ink: p.ink,
    accent: p.accent,
    presentationTheme: mode,
    colorScheme: exact ? base.id : "custom",
    schemeBase: base.id,
  };
};
function teLabel(brand = projectState.brand) {
  const scheme = teScheme(brand.colorScheme),
    mode = brand.presentationTheme === "dark" ? "Dark" : "Light";
  if (scheme) return scheme.name + " · " + mode;
  if (
    !brand.colorScheme &&
    (["background", "ink", "accent"].every(
      (k) => brand[k] === teSchemes[0][brand.presentationTheme || "light"][k],
    ) ||
      ["background", "ink", "accent"].every(
        (k) =>
          brand[k] === studioPalettes[brand.presentationTheme || "light"][k],
      ))
  )
    return "Studio Blue · " + mode;
  const base = teScheme(brand.schemeBase);
  return (
    "Custom" + (base ? " (based on " + base.name + ")" : "") + " · " + mode
  );
}
const teOldTheme = projectTheme;
projectTheme = function () {
  teOldTheme();
  if ($("te-current") && projectReady) $("te-current").textContent = teLabel();
};
function teChangeColor(key, value) {
  projectEdit(() => {
    const b = projectState.brand,
      pair = tePair(b),
      mode = b.presentationTheme || "light";
    pair[mode][key] = value;
    b.themePalettes = pair;
    b.colorScheme = "custom";
    b.schemeBase = b.schemeBase || "studio-blue";
    if (["accent", "background", "ink"].includes(key)) b[key] = value;
  });
}
const tePresetFields = nxBrandFields;
nxBrandFields = function (brand) {
  return {
    ...tePresetFields(brand),
    themePalettes: brand.themePalettes
      ? projectCopy(brand.themePalettes)
      : null,
    colorScheme: brand.colorScheme || "custom",
    schemeBase: brand.schemeBase || "studio-blue",
  };
};
const tePresetValidate = nxValidatePreset;
nxValidatePreset = async function (raw) {
  const p = await tePresetValidate(raw);
  p.brand = teBrandExtras(raw.brand, p.brand);
  if (!raw.brand?.themePalettes) {
    p.brand.themePalettes = null;
    p.brand.colorScheme = raw.brand?.colorScheme || "custom";
    p.brand.schemeBase = raw.brand?.schemeBase || "studio-blue";
  }
  if (raw.scope === "theme") {
    p.scope = "theme";
    p.brand = teThemeFields(p.brand);
    p.assets = {};
  }
  return p;
};
function teThemeFields(brand) {
  const fields = Object.fromEntries(
    [
      "accent",
      "background",
      "ink",
      "presentationTheme",
      "themeColors",
      "themePalettes",
      "colorScheme",
      "schemeBase",
    ]
      .filter((k) => brand[k] !== undefined)
      .map((k) => [k, projectCopy(brand[k])]),
  );
  return {
    ...fields,
    colorScheme: brand.colorScheme || "custom",
    schemeBase: brand.schemeBase || "studio-blue",
    themePalettes: brand.themePalettes || tePair(brand),
  };
}
const tePresetList = nxPresetList;
nxPresetList = function () {
  tePresetList();
  for (const id of ["nx-preset", "nx-wizard-preset"])
    for (const option of $(id).options) {
      const p = nxPresets.find((p) => p.id === option.value);
      if (p?.scope === "theme") option.textContent = "Theme · " + p.name;
    }
};
let teSelected = "",
  teRoot = null,
  teThumbs = [];
function teCandidate(id = teSelected, mode = $("te-appearance").value) {
  const b = projectCopy(projectState.brand),
    scheme = teScheme(id);
  if (!scheme) return nxThemeBrand(mode, false, b);
  return {
    ...b,
    colorScheme: scheme.id,
    schemeBase: scheme.id,
    themePalettes: {
      light: projectCopy(scheme.light),
      dark: projectCopy(scheme.dark),
    },
    presentationTheme: mode,
    background: scheme[mode].background,
    ink: scheme[mode].ink,
    accent: scheme[mode].accent,
    themeColors: {},
  };
}
function teResize() {
  for (const { root, parent } of teThumbs)
    if (root.isConnected)
      root.style.transform = "scale(" + parent.clientWidth / 1920 + ")";
  if (teRoot?.isConnected)
    teRoot.style.transform =
      "scale(" + $("te-preview").clientWidth / 1920 + ")";
}
function teRefresh() {
  const brand = teCandidate();
  teRoot = studioPreviewModel(
    projectModel(),
    $("te-preview"),
    studioPalette(brand),
  );
  nxDecorateCanvas(teRoot, brand, projectModel());
  $("te-name").textContent =
    teScheme(teSelected)?.name || "Current custom colors";
  $("te-description").textContent =
    teScheme(teSelected)?.description ||
    "Choose a built-in scheme to preview a replacement. Current project colors are unchanged.";
  $("te-apply").disabled = !teScheme(teSelected);
  for (const button of $("te-cards").querySelectorAll("button"))
    button.setAttribute("aria-pressed", button.dataset.scheme === teSelected);
  teThumbs = [];
  for (const button of $("te-cards").querySelectorAll("button")) {
    const parent = button.querySelector(".te-thumb"),
      candidate = teCandidate(button.dataset.scheme);
    const root = studioPreviewModel(
      projectModel(),
      parent,
      studioPalette(candidate),
    );
    nxDecorateCanvas(root, candidate, projectModel());
    teThumbs.push({ root, parent });
  }
  studioGalleryRoots = studioGalleryRoots.filter(
    (item) => item.root.isConnected,
  );
  for (const button of $("te-cards").querySelectorAll("button"))
    [...button.querySelectorAll(".te-swatches span")].forEach(
      (span, i) =>
        (span.style.background = teScheme(button.dataset.scheme)[
          $("te-appearance").value
        ][["accent", "secondary", "background", "surface"][i]]),
    );
  requestAnimationFrame(teResize);
}
function teOpen() {
  if (typeof vbEnd === "function") vbEnd(true);
  projectFlush();
  $("te-appearance").value = projectState.brand.presentationTheme || "light";
  teSelected = teScheme(projectState.brand.colorScheme)
    ? projectState.brand.colorScheme
    : teLabel().startsWith("Studio Blue")
      ? "studio-blue"
      : "";
  $("te-custom-name").value = "";
  $("te-message").textContent = "";
  $("te-cards").replaceChildren();
  for (const scheme of teSchemes) {
    const button = document.createElement("button");
    button.className = "te-card";
    button.dataset.scheme = scheme.id;
    button.setAttribute("aria-label", scheme.name + " color scheme");
    const thumb = document.createElement("div");
    thumb.className = "te-thumb";
    const name = document.createElement("strong");
    name.textContent = scheme.name;
    const swatches = document.createElement("div");
    swatches.className = "te-swatches";
    for (const key of ["accent", "secondary", "background", "surface"]) {
      const color = document.createElement("span");
      color.style.background = scheme[$("te-appearance").value][key];
      swatches.append(color);
    }
    button.append(thumb, name, swatches);
    button.onclick = () => {
      teSelected = scheme.id;
      teRefresh();
    };
    $("te-cards").append(button);
  }
  $("te-gallery").showModal();
  teRefresh();
}
function teForm() {
  if (!projectReady) return;
  $("te-current").textContent = teLabel();
  const p = studioPalette(projectState.brand);
  for (const key of [
    "surface",
    "surfaceAlt",
    "muted",
    "border",
    "accentInk",
    "terminal",
    "secondary",
  ])
    if ($("te-color-" + key))
      $("te-color-" + key).value = p[key] || teSchemes[0].light[key];
}
const teOldForm = projectForm;
projectForm = function () {
  teOldForm();
  teForm();
};
function teBind() {
  $("te-open-gallery").onclick = teOpen;
  $("te-close").onclick = () => $("te-gallery").close();
  $("te-gallery").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      $("te-gallery").close();
    }
  });
  $("te-appearance").onchange = teRefresh;
  $("te-apply").onclick = () => {
    const brand = teCandidate();
    projectChange(() => (projectState.brand = brand));
    $("te-gallery").close();
    projectMessage(
      "Color scheme applied. Logos, fonts, and slide content are preserved. Undo restores the previous colors.",
    );
  };
  $("te-save-custom").onclick = async () => {
    try {
      if (nxPresets.length >= 20)
        throw new Error(
          "Keep up to 20 presets; remove one before saving another.",
        );
      projectFlush();
      const p = await nxValidatePreset({
        schemaVersion: 1,
        kind: "presentation-studio-brand",
        scope: "theme",
        name: $("te-custom-name").value.trim() || "Custom theme",
        brand: teThemeFields(projectState.brand),
        assets: {},
      });
      if (nxStorePresets([...nxPresets, p])) {
        $("nx-preset").value = p.id;
        $("te-message").textContent =
          "Current project colors saved as “" +
          p.name +
          "”. Find it under Brand presets to apply or export it.";
      } else
        $("te-message").textContent =
          "Browser storage is unavailable. Use Brand presets → Export preset JSON to save the current brand.";
    } catch (e) {
      $("te-message").textContent = e.message;
    }
  };
  const left = $("fe-accent").parentElement,
    details = document.createElement("details");
  details.id = "te-customize";
  details.className = "hub-brand-group";
  details.innerHTML = "<summary>Customize colors</summary>";
  const first = $("fe-accent").previousElementSibling,
    last = $("fe-ink").nextSibling;
  let node = first;
  while (node && node !== last) {
    const next = node.nextSibling;
    details.append(node);
    node = next;
  }
  left.append(details);
  for (const [key, label] of [
    ["surface", "Card background"],
    ["surfaceAlt", "Alternate background"],
    ["muted", "Secondary text"],
    ["border", "Borders"],
    ["accentInk", "Text on accent"],
    ["terminal", "Terminal background"],
    ["secondary", "Secondary accent"],
  ]) {
    const l = document.createElement("label");
    l.htmlFor = "te-color-" + key;
    l.textContent = label;
    const input = document.createElement("input");
    input.id = l.htmlFor;
    input.type = "color";
    input.oninput = (e) => teChangeColor(key, e.target.value);
    details.append(l, input);
  }
  for (const [id, key] of [
    ["fe-accent", "accent"],
    ["fe-bg", "background"],
    ["fe-ink", "ink"],
  ])
    $(id).oninput = (e) => teChangeColor(key, e.target.value);
  const oldWizard = $("nx-wizard-preset").onchange;
  $("nx-wizard-preset").onchange = (e) => {
    const p = nxPresets.find((p) => p.id === e.target.value);
    if (p?.scope === "theme") {
      $("nx-wizard-accent").value = p.brand.accent;
      $("nx-wizard-theme").value = p.brand.presentationTheme;
    } else oldWizard?.(e);
  };
  new ResizeObserver(teResize).observe($("te-preview"));
  new ResizeObserver(teResize).observe($("te-cards"));
  teForm();
}
const teInit = projectInit;
projectInit = function () {
  teInit();
  teBind();
};
