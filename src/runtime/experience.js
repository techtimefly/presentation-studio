// Guided project setup, portable branding, and cancellable slide transitions.
const nxTypes = ["none", "fade", "slide", "zoom"];
const nxSpeeds = { quick: 200, normal: 400, slow: 700 };
const nxColor = (value, fallback) =>
  /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
function nxBrand(raw = {}, base = raw) {
  const colors = {};
  for (const mode of ["light", "dark"]) {
    const p = raw.themeColors?.[mode];
    if (p)
      colors[mode] = {
        accent: nxColor(p.accent, base.accent),
        background: nxColor(p.background, base.background),
        ink: nxColor(p.ink, base.ink),
      };
  }
  return {
    ...base,
    logoLight: mediaSafePath(raw.logoLight) ? raw.logoLight : "",
    logoDark: mediaSafePath(raw.logoDark) ? raw.logoDark : "",
    logoSize: Math.max(20, Math.min(64, Number(raw.logoSize) || 40)),
    logoPlacement: ["left", "right", "hidden"].includes(raw.logoPlacement)
      ? raw.logoPlacement
      : "left",
    titleLogo: !!raw.titleLogo,
    themeColors: colors,
  };
}
function nxSettings(raw = {}) {
  return {
    transition: nxTypes.includes(raw.transition) ? raw.transition : "none",
    speed: Object.hasOwn(nxSpeeds, raw.speed) ? raw.speed : "normal",
    sectionTransition: ["inherit", ...nxTypes].includes(raw.sectionTransition)
      ? raw.sectionTransition
      : "inherit",
    disableMotion: !!raw.disableMotion,
  };
}
const nxValidate = projectValidateState;
projectValidateState = function (raw, nested = false) {
  const state = nxValidate(raw, nested);
  state.brand = nxBrand(raw.brand, state.brand);
  state.presentation = nxSettings(raw.presentation);
  const originals = [
    ...raw.slides,
    ...(raw.trash || []),
    ...(raw.sectionTrash || []).flatMap((a) => a.slides || []),
  ];
  for (const model of [
    ...state.slides,
    ...state.trash,
    ...state.sectionTrash.flatMap((a) => a.slides),
  ]) {
    const value = originals.find((s) => s.id === model.id)?.transition;
    model.transition = nxTypes.includes(value) ? value : "inherit";
  }
  return state;
};
function nxLogo(brand, mode = brand.presentationTheme) {
  return (
    (mode === "dark" ? brand.logoDark : brand.logoLight) || brand.logo || ""
  );
}
const nxHeader = studioPaintHeader;
studioPaintHeader = function (element, section, brand = projectState.brand) {
  nxHeader(element, section, {
    ...brand,
    logo: brand.logoPlacement === "hidden" ? "" : nxLogo(brand),
  });
  if (!element) return;
  const img = element.querySelector(".project-logo");
  if (img) {
    img.style.height = (brand.logoSize || 40) + "px";
    img.style.maxHeight = "none";
    img.style.maxWidth = "240px";
    img.dataset.placement = brand.logoPlacement || "left";
  }
  element
    .closest("header")
    ?.classList.toggle(
      "nx-right-logo",
      !!img && brand.logoPlacement === "right",
    );
};
function nxDecorateCanvas(root, brand, model) {
  if (!root) return;
  studioPaintHeader(
    root.querySelector(".brand"),
    projectState.sections.find((s) => s.id === model?.group),
    brand,
  );
  root.querySelectorAll(".nx-title-logo").forEach((e) => e.remove());
  const title = root.querySelector(".slide.active h1"),
    path = nxLogo(brand);
  if (title && brand.titleLogo && path) {
    const img = document.createElement("img");
    img.className = "nx-title-logo";
    img.alt = projectMeta.name + " logo";
    img.src = mediaAssetURL(path);
    title.before(img);
  }
}
const nxBrandDecoration = projectDecorateBrand;
projectDecorateBrand = function () {
  nxBrandDecoration();
  if (projectReady)
    nxDecorateCanvas(
      $("stage"),
      projectState.brand,
      projectModel(slides[index]?.dataset.mediaId),
    );
};
const nxProjectPreview = projectPreview;
projectPreview = function () {
  nxProjectPreview();
  if (projectReady)
    nxDecorateCanvas(projectPreviewNode, projectState.brand, projectModel());
};
const nxMediaPreview = mediaPreview;
mediaPreview = function () {
  nxMediaPreview();
  if (projectReady)
    nxDecorateCanvas(
      mediaPreviewNode,
      projectState.brand,
      projectModel(mediaGetEntry()?.id),
    );
};
const nxModelPreview = studioPreviewModel;
studioPreviewModel = function (model, parent, palette) {
  const root = nxModelPreview(model, parent, palette);
  nxDecorateCanvas(root, projectState.brand, model);
  return root;
};

function nxThemeBrand(mode, defaults = false, input = projectState.brand) {
  const b = projectCopy(input),
    old = b.presentationTheme || "light",
    current = { background: b.background, ink: b.ink, accent: b.accent };
  const history = { ...(b.themeColors || {}), [old]: current };
  const p = studioPalettes[mode],
    before = studioPalettes[old];
  const colors = defaults
    ? { background: p.background, ink: p.ink, accent: p.accent }
    : history[mode] || {
        background:
          b.background === before.background ? p.background : b.background,
        ink: b.ink === before.ink ? p.ink : b.ink,
        accent: b.accent,
      };
  if (!defaults) colors.accent = b.accent;
  history[mode] = colors;
  return { ...b, ...colors, presentationTheme: mode, themeColors: history };
}
studioPreviewTheme = function () {
  projectFlush();
  studioThemeMode = $("studio-presentation-theme").value;
  if (!$("studio-theme-dialog").open) {
    $("nx-theme-defaults").checked = false;
    $("studio-theme-dialog").showModal();
  }
  const brand = nxThemeBrand(studioThemeMode, $("nx-theme-defaults").checked);
  studioThemeRoot = studioPreviewModel(
    projectModel(),
    $("studio-theme-preview"),
    studioPalette(brand),
  );
  nxDecorateCanvas(studioThemeRoot, brand, projectModel());
  $("studio-theme-description").textContent =
    `${studioThemeMode === "dark" ? "Dark" : "Light"} appearance · ${$("nx-theme-defaults").checked ? "replace with theme default colors" : "retain custom colors and restore saved colors for this theme"} · preview only`;
};
studioApplyTheme = function () {
  const brand = nxThemeBrand(studioThemeMode, $("nx-theme-defaults").checked);
  projectChange(() => (projectState.brand = brand));
  $("studio-theme-dialog").close();
  projectForm();
  projectPreview();
};

// Presets are browser-local, and can be transferred as explicit JSON downloads.
let nxPresets = [],
  nxWizardStep = 0,
  nxWizardLogo = null,
  nxWizardLogoURL = null,
  nxWizardRoot = null,
  nxPreviewRoot = null;
function nxPresetList() {
  for (const id of ["nx-preset", "nx-wizard-preset"]) {
    const select = $(id),
      previous = select.value;
    select.replaceChildren();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent =
      id === "nx-preset"
        ? "Choose a saved brand"
        : "Use starting template branding";
    select.append(blank);
    for (const p of nxPresets) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      select.append(o);
    }
    if (nxPresets.some((p) => p.id === previous)) select.value = previous;
  }
}
function nxStorePresets(next) {
  try {
    localStorage.setItem(
      "presentation-studio-brand-presets-v1",
      JSON.stringify(next),
    );
    nxPresets = next;
    nxPresetList();
    return true;
  } catch {
    projectMessage(
      "Browser preset storage is full or unavailable. Export the preset JSON for a durable copy.",
    );
    return false;
  }
}
async function nxCheckLogo(file) {
  if (
    !file ||
    !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
      file.type,
    )
  )
    throw new Error("Choose a PNG, JPEG, WebP, or SVG logo.");
  if (file.size > 1048576) throw new Error("Choose a logo smaller than 1 MB.");
  if (file.type === "image/svg+xml") {
    const xml = new DOMParser().parseFromString(
      await file.text(),
      "image/svg+xml",
    );
    if (
      xml.querySelector("parsererror,script,foreignObject") ||
      [...xml.querySelectorAll("*")].some((el) =>
        [...el.attributes].some(
          (a) =>
            /^on/i.test(a.name) ||
            (/href$/i.test(a.name) && !a.value.startsWith("#")) ||
            /url\(\s*["']?(?:https?:|data:|\/\/)/i.test(a.value),
        ),
      )
    )
      throw new Error(
        "Use a self-contained SVG without scripts or external references.",
      );
  }
  return file;
}
async function nxChooseLogo(file, key = $("nx-logo-variant").value) {
  try {
    await nxCheckLogo(file);
    const path = "assets/" + projectID("logo") + "-" + mediaFilename(file.name);
    mediaRemember(path, file);
    projectChange(() => (projectState.brand[key] = path));
    projectMessage("Logo updated. Check its light and dark previews.");
  } catch (e) {
    projectMessage(e.message);
  }
}
function nxBrandFields(b) {
  return Object.fromEntries(
    [
      "accent",
      "background",
      "ink",
      "font",
      "logo",
      "logoLight",
      "logoDark",
      "logoSize",
      "logoPlacement",
      "titleLogo",
      "themeColors",
      "headerTitle",
      "headerSubtitle",
      "edition",
      "presentationTheme",
    ].map((k) => [k, b[k]]),
  );
}
async function nxMakePreset() {
  projectFlush();
  const brand = nxBrandFields(nxBrand(projectState.brand)),
    assets = {};
  for (const path of new Set(
    [brand.logo, brand.logoLight, brand.logoDark].filter(Boolean),
  )) {
    const blob = mediaBlobs.get(path);
    if (!blob)
      throw new Error(
        "Import the project ZIP to load its logos before saving a preset.",
      );
    if (blob.size > 1048576)
      throw new Error("Preset logos must each be smaller than 1 MB.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let text = "";
    for (let i = 0; i < bytes.length; i += 8192)
      text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    assets[path] = { type: blob.type, data: btoa(text) };
  }
  return {
    schemaVersion: 1,
    kind: "presentation-studio-brand",
    id: projectID("brand"),
    name: $("nx-preset-name").value.trim() || "Untitled brand",
    brand,
    assets,
  };
}
async function nxValidatePreset(raw) {
  if (
    raw?.schemaVersion !== 1 ||
    raw.kind !== "presentation-studio-brand" ||
    !raw.brand ||
    JSON.stringify(raw).length > 4500000
  )
    throw new Error("Unsupported or oversized brand preset.");
  const b = raw.brand,
    base = {
      accent: nxColor(b.accent, "#0066ff"),
      background: nxColor(b.background, "#f4f6f8"),
      ink: nxColor(b.ink, "#101c2f"),
      font: ["Arial", "Segoe UI", "Verdana", "Georgia"].includes(b.font)
        ? b.font
        : "Arial",
      logo: mediaSafePath(b.logo) ? b.logo : "",
      presentationTheme: b.presentationTheme === "dark" ? "dark" : "light",
      headerTitle: String(b.headerTitle || "").slice(0, 64),
      headerSubtitle: String(b.headerSubtitle || "").slice(0, 80),
      edition: String(b.edition || "").slice(0, 80),
    };
  const brand = nxBrand(b, base),
    assets = {};
  for (const path of new Set(
    [brand.logo, brand.logoLight, brand.logoDark].filter(Boolean),
  )) {
    const a = raw.assets?.[path];
    if (!a || typeof a.data !== "string" || a.data.length > 1500000)
      throw new Error("Preset is missing a valid logo.");
    let bytes;
    try {
      bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
    } catch {
      throw new Error("Invalid logo encoding.");
    }
    await nxCheckLogo(new File([bytes], "preset-logo", { type: a.type }));
    assets[path] = { type: a.type, data: a.data };
  }
  return {
    schemaVersion: 1,
    kind: raw.kind,
    id: projectID("brand"),
    name: String(raw.name || "Imported brand").slice(0, 80),
    brand,
    assets,
  };
}
function nxLoadPreset(preset) {
  const brand = projectCopy(preset.brand);
  for (const key of ["logo", "logoLight", "logoDark"])
    if (brand[key]) {
      const a = preset.assets[brand[key]],
        extension = {
          "image/png": ".png",
          "image/jpeg": ".jpg",
          "image/webp": ".webp",
          "image/svg+xml": ".svg",
        }[a.type],
        path = "assets/" + projectID("brand-logo") + extension;
      const bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
      mediaRemember(path, new Blob([bytes], { type: a.type }));
      brand[key] = path;
    }
  return brand;
}
function nxRefreshBrand() {
  if (!projectReady) return;
  const b = nxBrand(projectState.brand);
  $("nx-logo-size").value = b.logoSize;
  $("nx-logo-size-value").textContent = b.logoSize + " px";
  $("nx-logo-placement").value = b.logoPlacement;
  $("nx-title-logo").checked = b.titleLogo;
  for (const mode of ["light", "dark"]) {
    const img = $("nx-logo-" + mode),
      path = nxLogo(b, mode);
    img.hidden = !path;
    if (path) img.src = mediaAssetURL(path);
    else img.removeAttribute("src");
  }
}

// Transitions use one incoming animation and an inert outgoing snapshot.
let nxAnimations = [],
  nxGhost = null,
  nxBusy = false,
  nxNavigation = null,
  nxGeneration = 0;
const nxReduced = matchMedia("(prefers-reduced-motion: reduce)");
function nxCancelTransition() {
  nxGeneration++;
  nxAnimations.forEach((a) => a.cancel());
  nxAnimations = [];
  nxGhost?.remove();
  nxGhost = null;
  nxBusy = false;
  document.body.classList.remove("nx-transitioning");
}
function nxMotionDisabled() {
  return nxReduced.matches || !!projectState?.presentation?.disableMotion;
}
function nxFrames(type, direction = 1, outgoing = false) {
  if (type === "fade")
    return outgoing
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 1 }];
  if (type === "slide")
    return outgoing
      ? [
          { opacity: 1, transform: "translateX(0)" },
          { opacity: 0, transform: `translateX(${-direction * 100}px)` },
        ]
      : [
          { opacity: 0, transform: `translateX(${direction * 100}px)` },
          { opacity: 1, transform: "translateX(0)" },
        ];
  return outgoing
    ? [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(1.015)" },
      ]
    : [
        { opacity: 0, transform: "scale(.985)" },
        { opacity: 1, transform: "scale(1)" },
      ];
}
const nxRender = render;
render = function () {
  const navigation = nxNavigation;
  nxNavigation = null;
  nxCancelTransition();
  const old = navigation?.old;
  let ghost = null;
  if (old?.isConnected) {
    ghost = old.cloneNode(true);
    ghost.classList.remove("active");
    ghost.classList.add("nx-transition-ghost");
    ghost.inert = true;
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("id");
    ghost.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    ghost.querySelectorAll("video").forEach((v) => {
      const poster = v.getAttribute("poster");
      if (poster) {
        const img = document.createElement("img");
        img.className = v.className;
        img.src = poster;
        v.replaceWith(img);
      } else v.remove();
    });
  }
  nxRender();
  if (
    !navigation ||
    !projectReady ||
    nxMotionDisabled() ||
    $("full-editor").open ||
    $("media-editor").open ||
    $("nx-wizard").open
  )
    return;
  const model = projectModel(slides[index]?.dataset.mediaId),
    settings = nxSettings(projectState.presentation),
    section = projectState.sections.find((s) => s.id === model?.group);
  let type =
    model?.transition && model.transition !== "inherit"
      ? model.transition
      : navigation.group !== model?.group &&
          settings.sectionTransition !== "inherit"
        ? settings.sectionTransition
        : settings.transition;
  if (
    !nxTypes.includes(type) ||
    type === "none" ||
    section?.kind === "qa" ||
    old === slides[index]
  )
    return;
  mediaPauseAll();
  nxBusy = true;
  document.body.classList.add("nx-transitioning");
  const generation = nxGeneration;
  if (ghost) {
    nxGhost = ghost;
    $("stage").append(ghost);
    nxAnimations.push(
      ghost.animate(nxFrames(type, navigation.direction, true), {
        duration: nxSpeeds[settings.speed],
        easing: "ease-out",
        fill: "both",
      }),
    );
  }
  nxAnimations.push(
    slides[index].animate(nxFrames(type, navigation.direction), {
      duration: nxSpeeds[settings.speed],
      easing: "ease-out",
      fill: "both",
    }),
  );
  Promise.all(nxAnimations.map((a) => a.finished.catch(() => {}))).then(() => {
    if (generation !== nxGeneration) return;
    nxCancelTransition();
    elapsed = 0;
    last = performance.now();
    mediaPlayCurrent();
  });
};
const nxShow = show;
show = function (i) {
  const old = slides[index];
  old?.querySelectorAll("video").forEach((v) => v.pause());
  nxNavigation = {
    old,
    group: old?.dataset.group,
    direction: i < index ? -1 : 1,
  };
  nxShow(i);
};
const nxMediaHold = mediaHoldSlide;
mediaHoldSlide = function () {
  return nxBusy || nxMediaHold();
};
const nxPlayMedia = mediaPlayCurrent;
mediaPlayCurrent = function () {
  if (nxBusy) {
    mediaPauseAll();
    return;
  }
  nxPlayMedia();
};
const nxSwitchDeck = switchDeck;
switchDeck = function (...args) {
  nxCancelTransition();
  nxNavigation = null;
  return nxSwitchDeck(...args);
};
const nxOpenEditor = projectOpen;
projectOpen = function () {
  nxCancelTransition();
  return nxOpenEditor();
};
const nxOpenMedia = mediaOpen;
mediaOpen = function () {
  nxCancelTransition();
  return nxOpenMedia();
};
const nxRenderProject = projectRender;
projectRender = function (...args) {
  nxCancelTransition();
  return nxRenderProject(...args);
};
function nxApplyMotion() {
  document.body.classList.toggle("nx-no-motion", nxMotionDisabled());
}
const nxProjectTheme = projectTheme;
projectTheme = function () {
  nxProjectTheme();
  nxApplyMotion();
};
function nxPreviewTransition() {
  projectFlush();
  const model = projectModel(),
    type =
      model.transition && model.transition !== "inherit"
        ? model.transition
        : nxSettings(projectState.presentation).transition;
  nxPreviewRoot = studioPreviewModel(model, $("nx-transition-canvas"));
  nxPreviewRoot.style.transform = `scale(${$("nx-transition-canvas").clientWidth / 1920})`;
  nxPreviewRoot
    .querySelectorAll("*")
    .forEach((e) => e.getAnimations().forEach((a) => a.cancel()));
  if (!nxMotionDisabled() && type !== "none")
    nxPreviewRoot
      .querySelector(".slide")
      .animate(nxFrames(type), {
        duration: nxSpeeds[nxSettings(projectState.presentation).speed],
        easing: "ease-out",
      });
  $("nx-motion-status").textContent = nxMotionDisabled()
    ? "Motion is disabled by your project or browser preference."
    : type === "none"
      ? "No transition: navigation is instant."
      : `${type} transition preview · ${nxSpeeds[nxSettings(projectState.presentation).speed]} ms`;
}
function nxSettingsForm() {
  const p = nxSettings(projectState.presentation);
  $("nx-transition").value = p.transition;
  $("nx-speed").value = p.speed;
  $("nx-section-transition").value = p.sectionTransition;
  $("nx-disable-motion").checked = p.disableMotion;
  $("nx-slide-transition").value = projectModel()?.transition || "inherit";
  nxPreviewTransition();
}
const nxSelectTab = projectSelectTab;
projectSelectTab = function (tab) {
  $("fe-settings-panel").hidden = tab !== "settings";
  nxSelectTab(tab);
  if (tab === "settings") nxSettingsForm();
};
const nxForm = projectForm;
projectForm = function () {
  nxForm();
  if (projectReady) {
    nxRefreshBrand();
    if (projectTab === "settings") nxSettingsForm();
  }
};

function nxWizardPage() {
  $("nx-wizard").scrollTop = 0;
  document
    .querySelectorAll("[data-nx-step]")
    .forEach((e) => (e.hidden = Number(e.dataset.nxStep) !== nxWizardStep));
  $("nx-wizard-progress").textContent =
    `Step ${nxWizardStep + 1} of 4 · ${["Starting point", "Branding", "Starter layout", "Appearance and playback"][nxWizardStep]}`;
  $("nx-wizard-back").disabled = nxWizardStep === 0;
  const choice = document.querySelector('input[name="nx-start"]:checked').value;
  $("nx-wizard-next").textContent =
    choice === "import" && nxWizardStep === 0
      ? "Choose project file"
      : nxWizardStep === 3
        ? "Create presentation"
        : "Next";
  $("nx-wizard-layout").disabled = choice === "template";
  $("nx-wizard-layout-hint").textContent =
    choice === "template"
      ? studioTemplateName + " keeps its existing slides. Add slide remains available after setup."
      : "This layout creates your first slide. Add more layouts after setup.";
  if (nxWizardStep === 2) nxWizardPreview();
  if (nxWizardStep === 3) nxWizardPreview();
  if (nxWizardStep === 3)
    $("nx-wizard-summary").textContent =
      `${$("nx-wizard-name").value.trim() || "Untitled presentation"} · ${choice === "template" ? studioTemplateName : $("nx-wizard-layout").selectedOptions[0].textContent + " starter"} · independent project ID and draft.`;
}
function nxWizardPreview() {
  const type = $("nx-wizard-layout").value,
    choice = document.querySelector('input[name="nx-start"]:checked').value;
  const candidate =
    choice === "template"
      ? studioDefaultTemplate.slides[0]
      : {
          id: "wizard-preview",
          group: projectState.sections[0].id,
          template: type,
          ...projectCreateTemplate(type, "Your presentation"),
        };
  const preset = nxPresets.find(p => p.id === $("nx-wizard-preset").value);
  const base = preset?.brand || (choice === "template" ? studioDefaultTemplate.brand : studioBlankState("Preview").brand);
  const brand = {
    ...nxThemeBrand($("nx-wizard-theme").value, false, base),
    accent: $("nx-wizard-accent").value,
    headerTitle: $("nx-wizard-header").value,
    headerSubtitle: $("nx-wizard-name").value,
    logo: nxWizardLogoURL || "",
    logoLight: "",
    logoDark: "",
    presentationTheme: $("nx-wizard-theme").value,
  };
  const parent =
    nxWizardStep === 3 ? $("nx-wizard-final-preview") : $("nx-wizard-preview");
  if (!nxWizardLogoURL && preset) { for (const key of ["logo", "logoLight", "logoDark"]) { const asset = preset.assets[preset.brand[key]]; brand[key] = asset ? "data:" + asset.type + ";base64," + asset.data : ""; } }
  nxWizardRoot = studioPreviewModel(candidate, parent, studioPalette(brand));
  nxWizardRoot.style.transform = `scale(${parent.clientWidth / 1920})`;
  nxDecorateCanvas(nxWizardRoot, brand, candidate);
}
function nxOpenWizard() {
  if (projectPlayback || document.body.classList.contains("obs")) return;
  projectFlush();
  nxCancelTransition();
  setPlaying(false);
  mediaPauseAll();
  nxWizardStep = 0;
  nxWizardLogo = null;
  if (nxWizardLogoURL) URL.revokeObjectURL(nxWizardLogoURL); nxWizardLogoURL = null;
  $("nx-wizard-name").value = "Untitled presentation";
  $("nx-wizard-header").value = "PRESENTATION";
  $("nx-wizard-accent").value = "#0066ff";
  $("nx-wizard-logo").value = "";
  $("nx-wizard-logo-info").textContent = "";
  $("nx-wizard-message").textContent = "";
  $("nx-wizard-editor").value = studioEditorAppearance;
  $("nx-wizard-theme").value = "light";
  $("nx-wizard-transition").value = "fade";
  $("nx-wizard-layout").value = "hero";
  document.querySelector('input[name="nx-start"][value="blank"]').checked =
    true;
  nxPresetList();
  $("nx-wizard-preset").value = "";
  $("nx-wizard").showModal();
  nxWizardPage();
}
async function nxFinishWizard(defaults = false) {
  const choice = document.querySelector('input[name="nx-start"]:checked').value;
  if (choice === "import") {
    $("nx-wizard").close();
    $("fe-import-file").click();
    return;
  }
  const create = async () => {
    try {
      $("nx-wizard-next").disabled = true;
      $("nx-wizard-defaults").disabled = true;
      projectFlush();
      await projectSaveDraft();
      const name = $("nx-wizard-name").value.trim() || "Untitled presentation";
      let state =
        choice === "template"
          ? projectCopy(studioDefaultTemplate)
          : studioBlankState(name);
      state.projectName = name;
      if (!defaults) {
        const selected = nxPresets.find(
          (p) => p.id === $("nx-wizard-preset").value,
        );
        if (selected)
          state.brand = { ...state.brand, ...nxLoadPreset(selected) };
        const theme = $("nx-wizard-theme").value;
        state.brand = nxBrand({
          ...nxThemeBrand(theme, false, state.brand),
          headerTitle:
            $("nx-wizard-header").value.trim() || state.brand.headerTitle,
          accent: $("nx-wizard-accent").value,
          presentationTheme: theme,
        });
        if (nxWizardLogo) {
          const path =
            "assets/" +
            projectID("logo") +
            "-" +
            mediaFilename(nxWizardLogo.name);
          mediaRemember(path, nxWizardLogo);
          state.brand.logo = path;
        }
        if (choice === "blank") {
          const type = $("nx-wizard-layout").value,
            model = state.slides[0],
            preset = projectCreateTemplate(type, "Your presentation");
          Object.assign(model, {
            template: type,
            tree: preset.tree,
            classes: preset.classes,
            templateBase: projectCopy(preset.tree),
            templateClasses: preset.classes,
          });
          if (type === "qa") {
            state.sections[0].kind = "qa";
            state.sections[0].name = "Questions";
            model.title = "Your question";
            projectHeading(model).node.children = [{ text: "Your question" }];
            model.templateBase = projectCopy(model.tree);
          }
          if (type === "code")
            model.commands = model.templateCommands = {
              powershell: 'Write-Output "Your command"',
              bash: 'printf "%s\\n" "Your command"',
            };
        }
      }
      state.brand = nxBrand(state.brand);
      state.presentation = {
        transition: defaults ? "fade" : $("nx-wizard-transition").value,
        speed: "normal",
        sectionTransition: "inherit",
        disableMotion: false,
      };
      if (choice === "blank") state.startingState = projectCopy(state);
      projectDraftPending = null;
      projectAcceptPack({
        schemaVersion: 2,
        kind: "presentation-studio-project",
        meta: {
          id: projectID("project"),
          name,
          updatedAt: new Date().toISOString(),
        },
        playbackOnly: false,
        state,
        history: { past: [], future: [] },
        checkpoints: [],
      });
      if (!defaults) studioSetEditorAppearance($("nx-wizard-editor").value);
      projectModified();
      projectTab = "content";
      projectSelectTab("content");
      $("fe-search").value = "";
      $("fe-group-filter").value = "all";
      studioSection = state.sections[0].id;
      $("nx-wizard").close();
      if (!$("full-editor").open) projectOpen();
      projectList();
      projectForm();
      projectPreview();
      projectRecoveryBanner();
      projectMessage(
        "Presentation created. Export an editable ZIP to save and share it.",
      );
    } catch (e) {
      $("nx-wizard-message").textContent =
        "Setup could not finish: " + e.message;
    } finally {
      $("nx-wizard-next").disabled = false;
      $("nx-wizard-defaults").disabled = false;
    }
  };
  if (mediaDirty || projectDraftPending)
    projectConfirm(
      "Create a separate presentation?",
      "The current project will be saved to its local recovery draft when available. Export an editable ZIP first if you need a portable backup.",
      create,
    );
  else await create();
}
function nxBind() {
  // Existing presentations open directly; New project and Setup wizard start the guide.
  $("studio-new-open").onclick = nxOpenWizard;
  $("nx-setup-open").onclick = nxOpenWizard;
  $("nx-wizard-close").onclick = () => $("nx-wizard").close();
  $("nx-wizard").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      $("nx-wizard").close();
    }
  });
  $("nx-wizard-back").onclick = () => {
    nxWizardStep = Math.max(0, nxWizardStep - 1);
    nxWizardPage();
  };
  $("nx-wizard-next").onclick = () => {
    if (
      nxWizardStep === 3 ||
      document.querySelector('input[name="nx-start"]:checked').value ===
        "import"
    )
      nxFinishWizard();
    else {
      nxWizardStep++;
      nxWizardPage();
    }
  };
  $("nx-wizard-defaults").onclick = () => nxFinishWizard(true);
  document.querySelectorAll('input[name="nx-start"]').forEach(
    (e) =>
      (e.onchange = () => {
        const useTemplate = e.value === "template" && e.checked;
        $("nx-wizard-header").value = useTemplate ? studioDefaultTemplate.brand.headerTitle : "PRESENTATION";
        nxWizardPage();
      }),
  );
  $("nx-wizard-layout").onchange = nxWizardPreview;
  $("nx-wizard-theme").onchange = nxWizardPreview;
  $("nx-wizard-logo").onchange = async (e) => {
    try {
      nxWizardLogo = await nxCheckLogo(e.target.files[0]);
      if (nxWizardLogoURL) URL.revokeObjectURL(nxWizardLogoURL); nxWizardLogoURL = URL.createObjectURL(nxWizardLogo);
      $("nx-wizard-logo-info").textContent = nxWizardLogo.name;
    } catch (err) {
      nxWizardLogo = null;
      e.target.value = "";
      $("nx-wizard-logo-info").textContent = err.message;
    }
  };
  $("nx-wizard-preset").onchange = (e) => {
    const p = nxPresets.find((p) => p.id === e.target.value);
    if (p) {
      $("nx-wizard-header").value = p.brand.headerTitle;
      $("nx-wizard-accent").value = p.brand.accent;
      $("nx-wizard-theme").value = p.brand.presentationTheme;
    }
  };
  $("studio-preview-theme").onclick = studioPreviewTheme;
  $("studio-presentation-theme").onchange = studioPreviewTheme;
  $("studio-theme-apply").onclick = studioApplyTheme;
  $("nx-theme-defaults").onchange = studioPreviewTheme;
  $("fe-logo-file").onchange = (e) => {
    nxChooseLogo(e.target.files[0]);
    e.target.value = "";
  };
  $("fe-logo-remove").onclick = () =>
    projectChange(() => (projectState.brand[$("nx-logo-variant").value] = ""));
  $("nx-logo-drop").onclick = () => $("fe-logo-file").click();
  $("nx-logo-drop").onkeydown = (e) => {
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      $("fe-logo-file").click();
    }
  };
  for (const type of ["dragover", "dragenter"])
    $("nx-logo-drop").addEventListener(type, (e) => {
      e.preventDefault();
      $("nx-logo-drop").classList.add("drag");
    });
  for (const type of ["drop", "dragleave"])
    $("nx-logo-drop").addEventListener(type, (e) => {
      e.preventDefault();
      $("nx-logo-drop").classList.remove("drag");
      if (type === "drop") nxChooseLogo(e.dataTransfer.files[0]);
    });
  $("nx-logo-size").oninput = (e) => {
    $("nx-logo-size-value").textContent = e.target.value + " px";
    projectEdit(() => (projectState.brand.logoSize = Number(e.target.value)));
  };
  $("nx-logo-placement").onchange = (e) =>
    projectChange(() => (projectState.brand.logoPlacement = e.target.value));
  $("nx-title-logo").onchange = (e) =>
    projectChange(() => (projectState.brand.titleLogo = e.target.checked));
  $("nx-preset-save").onclick = async () => {
    try {
      if (nxPresets.length >= 20)
        throw new Error(
          "Keep up to 20 presets; delete an unused preset first.",
        );
      const p = await nxMakePreset();
      if (nxStorePresets([...nxPresets, p])) {
        $("nx-preset").value = p.id;
        projectMessage(
          "Brand preset saved in this browser. Export its JSON to share it.",
        );
      }
    } catch (e) {
      projectMessage(e.message);
    }
  };
  $("nx-preset-apply").onclick = () => {
    const p = nxPresets.find((p) => p.id === $("nx-preset").value);
    if (p)
      projectChange(
        () =>
          (projectState.brand = { ...projectState.brand, ...nxLoadPreset(p) }),
      );
  };
  $("nx-preset-export").onclick = async () => {
    try {
      const p =
        nxPresets.find((p) => p.id === $("nx-preset").value) ||
        (await nxMakePreset());
      mediaDownload(
        new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }),
        mediaFilename(p.name) + "-brand.json",
      );
    } catch (e) {
      projectMessage(e.message);
    }
  };
  $("nx-preset-import").onclick = () => $("nx-preset-file").click();
  $("nx-preset-file").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 4500000)
        throw new Error("Preset JSON must be smaller than 4.5 MB.");
      if (nxPresets.length >= 20)
        throw new Error("Keep up to 20 presets; delete one first.");
      const p = await nxValidatePreset(JSON.parse(await file.text()));
      if (nxStorePresets([...nxPresets, p])) {
        $("nx-preset").value = p.id;
        projectMessage("Brand preset imported. Choose Apply preset to use it.");
      }
    } catch (err) {
      projectMessage("Preset import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  };
  $("nx-preset-delete").onclick = () => {
    const id = $("nx-preset").value;
    if (id)
      projectConfirm(
        "Delete saved brand preset?",
        "This removes the preset from this browser. Applied project branding remains. Export the preset JSON first to keep a copy.",
        () => nxStorePresets(nxPresets.filter((p) => p.id !== id)),
      );
  };
  for (const [id, key] of [
    ["nx-transition", "transition"],
    ["nx-speed", "speed"],
    ["nx-section-transition", "sectionTransition"],
    ["nx-disable-motion", "disableMotion"],
  ])
    $(id).onchange = (e) =>
      projectChange(() => {
        projectState.presentation = {
          ...nxSettings(projectState.presentation),
          [key]:
            e.target.type === "checkbox" ? e.target.checked : e.target.value,
        };
      });
  $("nx-slide-transition").onchange = (e) =>
    projectChange(() => (projectModel().transition = e.target.value));
  $("nx-transition-preview").onclick = nxPreviewTransition;
  nxReduced.addEventListener("change", () => {
    nxCancelTransition();
    nxApplyMotion();
    if (playing) mediaPlayCurrent();
  });
  new ResizeObserver(() => {
    if (nxWizardRoot?.isConnected)
      nxWizardRoot.style.transform = `scale(${nxWizardRoot.parentElement.clientWidth / 1920})`;
  }).observe($("nx-wizard-preview"));
  new ResizeObserver(() => {
    if (nxWizardRoot?.isConnected)
      nxWizardRoot.style.transform = `scale(${nxWizardRoot.parentElement.clientWidth / 1920})`;
  }).observe($("nx-wizard-final-preview"));
  new ResizeObserver(() => {
    if (nxPreviewRoot?.isConnected)
      nxPreviewRoot.style.transform = `scale(${$("nx-transition-canvas").clientWidth / 1920})`;
  }).observe($("nx-transition-canvas"));
  // Load only validated presets; invalid browser data never enters project state.
  try {
    const stored = JSON.parse(
      localStorage.getItem("presentation-studio-brand-presets-v1") || "[]",
    );
    if (Array.isArray(stored))
      Promise.all(
        stored.slice(0, 20).map((p) => nxValidatePreset(p).catch(() => null)),
      ).then((list) => {
        nxPresets = list.filter(Boolean);
        nxPresetList();
      });
  } catch {}
  nxPresetList();
  nxRefreshBrand();
  nxApplyMotion();
  $("open-full-editor").onclick = projectOpen;
  $("edit-media").onclick = mediaOpen;
}
const nxInit = projectInit;
projectInit = function () {
  nxInit();
  projectState = studioNormalize(projectState);
  projectBaseline = studioNormalize(projectBaseline);
  nxBind();
  projectRender(true);
};
