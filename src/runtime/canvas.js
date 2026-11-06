// Optional canvas data augments the original one-media layout without rewriting it.
let ceSelected = "primary",
  ceDrag = null,
  ceLockAction = false;
const ceClamp = (value, min, max, fallback) =>
  Math.max(
    min,
    Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback),
  );
function cePlacement(raw) {
  if (!raw) return null;
  const w = ceClamp(raw.w, 0.05, 1, 0.35),
    h = ceClamp(raw.h, 0.05, 1, 0.4);
  return {
    x: ceClamp(raw.x, 0, 1 - w, 0.6),
    y: ceClamp(raw.y, 0, 1 - h, 0.5),
    w,
    h,
  };
}
function ceObject(raw = {}) {
  return {
    placement: cePlacement(raw.placement),
    locked: !!raw.locked,
    hidden: !!raw.hidden,
    z: Math.round(ceClamp(raw.z, 0, 40, 3)),
    crop: {
      x: ceClamp(raw.crop?.x, 0, 100, 50),
      y: ceClamp(raw.crop?.y, 0, 100, 50),
    },
  };
}
const ceMediaValidate = mediaValidate;
mediaValidate = function (raw) {
  const result = ceMediaValidate(raw);
  for (const [id, cfg] of Object.entries(result.slides))
    if (raw.slides[id].canvas) cfg.canvas = ceObject(raw.slides[id].canvas);
  return result;
};
const ceValidate = projectValidateState;
projectValidateState = function (raw, nested = false) {
  const state = ceValidate(raw, nested);
  state.editLocked = !!raw.editLocked;
  state.mediaObjects = {};
  const originals = [
    ...(raw.slides || []),
    ...(raw.trash || []),
    ...(raw.sectionTrash || []).flatMap((s) => s.slides || []),
  ];
  for (const model of [
    ...state.slides,
    ...state.trash,
    ...(state.sectionTrash || []).flatMap((s) => s.slides),
  ])
    model.editLocked = !!originals.find((s) => s.id === model.id)?.editLocked;
  for (const [id, objects] of Object.entries(raw.mediaObjects || {})) {
    if (!/^[\w-]+$/.test(id) || !Array.isArray(objects) || objects.length > 30)
      throw new Error("Invalid media object list.");
    const seen = new Set();
    state.mediaObjects[id] = objects.map((item) => {
      if (!item || !/^object-[\w-]+$/.test(item.id) || seen.has(item.id))
        throw new Error("Invalid media object identity.");
      seen.add(item.id);
      const cfg = mediaValidate({
        schemaVersion: 1,
        slides: { object: item.media },
      }).slides.object;
      cfg.canvas = ceObject({
        ...cfg.canvas,
        placement: cfg.canvas?.placement || { x: 0.6, y: 0.5, w: 0.35, h: 0.4 },
      });
      cfg.advance = "fixed";
      return { id: item.id, media: cfg };
    });
  }
  return state;
};
function ceObjects(id = projectSelected) {
  return projectState.mediaObjects?.[id] || [];
}
function ceConfig(object = ceSelected, id = projectSelected) {
  return object === "primary"
    ? projectState.media[id]
    : ceObjects(id).find((o) => o.id === object)?.media;
}
function ceFigureConfig(figure) {
  return ceConfig(
    figure.dataset.objectId || "primary",
    figure.closest(".slide")?.dataset.mediaId ||
      mfState?.slide?.dataset.mediaId,
  );
}
function ceLocked(id = projectSelected, object = null) {
  return (
    projectPlayback ||
    projectState.editLocked ||
    projectModel(id)?.editLocked ||
    (object && ceConfig(object, id)?.canvas?.locked)
  );
}
function ceViolates(before, after) {
  if (ceLockAction) return false;
  if (before.editLocked)
    return JSON.stringify(before) !== JSON.stringify(after);
  const find = (state, id) =>
    [
      ...state.slides,
      ...state.trash,
      ...(state.sectionTrash || []).flatMap((s) => s.slides),
    ].find((s) => s.id === id);
  for (const model of [
    ...before.slides,
    ...before.trash,
    ...(before.sectionTrash || []).flatMap((s) => s.slides),
  ]) {
    if (
      model.editLocked &&
      (JSON.stringify(model) !== JSON.stringify(find(after, model.id)) ||
        JSON.stringify(before.media[model.id]) !==
          JSON.stringify(after.media[model.id]) ||
        JSON.stringify(before.mediaObjects?.[model.id]) !==
          JSON.stringify(after.mediaObjects?.[model.id]) ||
        JSON.stringify(before.sections.find((s) => s.id === model.group)) !==
          JSON.stringify(after.sections.find((s) => s.id === model.group)))
    )
      return true;
    const items = [
      { id: "primary", media: before.media[model.id] },
      ...(before.mediaObjects?.[model.id] || []),
    ];
    for (const item of items)
      if (item.media?.canvas?.locked) {
        const next =
          item.id === "primary"
            ? after.media[model.id]
            : after.mediaObjects?.[model.id]?.find((o) => o.id === item.id)
                ?.media;
        if (
          !find(after, model.id) ||
          JSON.stringify(next) !== JSON.stringify(item.media)
        )
          return true;
      }
  }
  return false;
}
const cePush = projectPush;
projectPush = function (before) {
  if (ceViolates(before, projectState)) {
    projectState = projectCopy(before);
    projectMessage("Unlock the protected slide or object before changing it.");
    return;
  }
  cePush(before);
};
for (const direction of ["undo", "redo"]) {
  const operation = direction === "undo" ? projectUndo : projectRedo;
  const guarded = function () {
    const target = (direction === "undo" ? projectPast : projectFuture).at(-1);
    if (target && ceViolates(projectState, target)) {
      projectMessage("Unlock protected content before undo or redo.");
      return;
    }
    operation();
  };
  if (direction === "undo") projectUndo = guarded;
  else projectRedo = guarded;
}
const ceApply = mediaApply;
function ceStyle(figure, cfg, slide) {
  const c = cfg.canvas;
  if (!c) return;
  figure.dataset.objectId = figure.dataset.objectId || "primary";
  figure.hidden = c.hidden;
  figure.classList.toggle("ce-hidden", c.hidden);
  figure.style.zIndex = c.z;
  figure.style.setProperty("--media-pos", c.crop.x + "% " + c.crop.y + "%");
  if (c.placement) {
    const p = c.placement;
    figure.classList.add("ce-floating");
    Object.assign(figure.style, {
      left: p.x * 100 + "%",
      top: p.y * 100 + "%",
      width: p.w * 100 + "%",
      height: p.h * 100 + "%",
      right: "auto",
      bottom: "auto",
    });
    if (figure.dataset.objectId === "primary") {
      slide.classList.add("ce-free");
    }
  }
}
mediaApply = function (slide) {
  slide
    .querySelectorAll(
      ':scope > [data-object-id]:not([data-object-id="primary"])',
    )
    .forEach((el) => el.remove());
  slide.classList.remove("ce-free");
  ceApply(slide);
  const id = slide.dataset.mediaId,
    primary = slide.querySelector(":scope > .media-box");
  if (primary) {
    primary.dataset.objectId = "primary";
    ceStyle(primary, mediaGetAssignment(id), slide);
  }
  if (!projectReady) return;
  const original = mediaConfig.slides[id];
  try {
    for (const item of ceObjects(id)) {
      mediaConfig.slides[id] = item.media;
      const holder = document.createElement("section");
      holder.dataset.mediaId = id;
      ceApply(holder);
      const figure = holder.querySelector(".media-box");
      if (!figure) continue;
      figure.dataset.objectId = item.id;
      slide.append(figure);
      ceStyle(figure, item.media, slide);
      if (mfSettings().enabled && !figure.querySelector(".mf-expand")) {
        const b = document.createElement("button");
        b.className = "mf-expand";
        b.textContent = "Expand";
        b.setAttribute("aria-label", "Expand media to focus");
        figure.append(b);
      }
    }
  } finally {
    if (original) mediaConfig.slides[id] = original;
    else delete mediaConfig.slides[id];
  }
};
const cePlay = mediaPlayCurrent;
mediaPlayCurrent = function () {
  cePlay();
  if (mfState) return;
  const slide = slides[index];
  for (const v of slide?.querySelectorAll(
    '[data-object-id]:not([data-object-id="primary"]) video',
  ) || []) {
    const cfg = ceFigureConfig(v.closest("figure"));
    if (playing && cfg?.autoplay && !cfg.canvas?.hidden)
      v.play().catch(() => {});
    else if (!playing) v.pause();
  }
};
const cePack = projectPack;
projectPack = function (playback = false) {
  const p = cePack(playback);
  if (playback) {
    const ids = new Set(p.state.slides.map((s) => s.id));
    p.state.mediaObjects = Object.fromEntries(
      Object.entries(p.state.mediaObjects || {}).filter(([id]) => ids.has(id)),
    );
  }
  return p;
};
function ceChange(fn) {
  if (ceLocked(projectSelected, ceSelected)) {
    projectMessage("This presentation, slide, or object is locked.");
    return;
  }
  projectChange(fn);
}
function ceSetConfig(cfg, object = ceSelected, id = projectSelected) {
  if (object === "primary") projectState.media[id] = cfg;
  else {
    const item = ceObjects(id).find((o) => o.id === object);
    if (item) item.media = cfg;
  }
}
function ceFigure(root = projectPreviewNode) {
  return root?.querySelector('.media-box[data-object-id="' + ceSelected + '"]');
}
function ceDefaultRect(figure) {
  const slide = figure.closest(".slide"),
    r = figure.getBoundingClientRect(),
    s = slide.getBoundingClientRect();
  return cePlacement({
    x: (r.left - s.left) / s.width,
    y: (r.top - s.top) / s.height,
    w: r.width / s.width,
    h: r.height / s.height,
  });
}
function ceSelect(id) {
  ceSelected = id;
  cePanel();
  ceDecorate(projectPreviewNode);
}
function cePanel() {
  if (!$("ce-objects") || !projectReady) return;
  const list = $("ce-objects");
  list.replaceChildren();
  for (const item of [
    { id: "primary", media: projectState.media[projectSelected] },
    ...ceObjects(),
  ]) {
    if (!item.media) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent =
      (item.media.canvas?.locked ? "🔒 " : "") +
      (item.media.canvas?.hidden ? "Hidden · " : "") +
      (item.media.name || item.id);
    b.setAttribute("aria-pressed", String(item.id === ceSelected));
    b.onclick = () => ceSelect(item.id);
    list.append(b);
  }
  const cfg = ceConfig(),
    c = ceObject(cfg?.canvas);
  $("ce-selected").textContent = cfg ? cfg.name : "No media selected";
  for (const key of ["x", "y", "w", "h"])
    $("ce-" + key).value =
      Math.round(
        (c.placement || { x: 0.6, y: 0.5, w: 0.35, h: 0.4 })[key] * 1000,
      ) / 10;
  $("ce-object-lock").textContent = c.locked ? "Unlock object" : "Lock object";
  $("ce-slide-lock").textContent = projectModel()?.editLocked
    ? "Unlock slide"
    : "Lock slide";
  $("ce-project-lock").textContent = projectState.editLocked
    ? "Unlock presentation"
    : "Make presentation read-only";
  $("ce-hidden").checked = c.hidden;
  $("ce-fit").value = cfg?.fit || "contain";
  $("ce-caption").value = cfg?.caption || "";
  $("ce-alt").value = cfg?.alt || "";
  $("ce-readonly").textContent = ceLocked()
    ? "🔒 Read-only selection: unlock to edit."
    : "Drop files on the preview or select a media object. Shift + arrows nudges faster. Escape cancels a gesture.";
}
function ceDecorate(root) {
  if (!root) return;
  root.querySelector(".ce-guides")?.remove();
  root.querySelectorAll(".ce-handle").forEach((el) => el.remove());
  for (const figure of root.querySelectorAll(".media-box")) {
    figure.classList.toggle(
      "ce-selected",
      vbMode === "edit" && figure.dataset.objectId === ceSelected,
    );
    figure.tabIndex = 0;
    if (
      vbMode === "edit" &&
      figure.dataset.objectId === ceSelected &&
      !ceLocked(projectSelected, ceSelected) &&
      ceConfig()?.canvas?.placement
    ) {
      for (const corner of ["nw", "ne", "sw", "se"]) {
        const h = document.createElement("button");
        h.type = "button";
        h.className = "ce-handle ce-" + corner;
        h.dataset.corner = corner;
        h.setAttribute("aria-label", "Resize media " + corner);
        figure.append(h);
      }
    }
  }
  root.querySelector(".slide").inert = vbMode === "edit" && ceLocked();
  if (vbMode === "edit" && ceLocked()) {
    root
      .querySelectorAll("[contenteditable]")
      .forEach((el) => el.removeAttribute("contenteditable"));
    root.querySelector(".slide").inert = true;
  }
}
const cePreview = projectPreview;
projectPreview = function (...args) {
  cePreview(...args);
  ceDecorate(projectPreviewNode);
  cePanel();
};
function ceGesture(e) {
  const root = projectPreviewNode,
    figure = e.target.closest(".media-box");
  if (!root?.contains(figure) || vbMode !== "edit" || e.button !== 0) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  vbEnd(false);
  ceSelected = figure.dataset.objectId || "primary";
  cePanel();
  ceDecorate(root);
  figure.focus({ preventScroll: true });
  if (ceLocked(projectSelected, ceSelected)) return;
  const cfg = ceConfig(),
    corner = e.target.dataset.corner,
    crop = $("ce-crop").checked && cfg.kind === "image";
  if (!cfg.canvas?.placement && !corner && !crop) return;
  const slide = figure.closest(".slide"),
    bounds = slide.getBoundingClientRect(),
    p = cfg.canvas?.placement || ceDefaultRect(figure);
  ceDrag = {
    figure,
    id: projectSelected,
    object: ceSelected,
    root,
    bounds,
    p,
    startX: e.clientX,
    startY: e.clientY,
    corner,
    crop,
    oldCrop: ceObject(cfg.canvas).crop,
    next: projectCopy(p),
    nextCrop: ceObject(cfg.canvas).crop,
    pointer: e.pointerId,
  };
  try {
    root.setPointerCapture(e.pointerId);
  } catch {}
  figure.classList.add("ce-dragging");
  const guides = document.createElement("div");
  guides.className = "ce-guides";
  slide.append(guides);
}
function ceMove(e) {
  const d = ceDrag;
  if (!d || d.pointer !== e.pointerId) return;
  e.preventDefault();
  const dx = (e.clientX - d.startX) / d.bounds.width,
    dy = (e.clientY - d.startY) / d.bounds.height;
  if (d.crop) {
    d.nextCrop = {
      x: ceClamp(d.oldCrop.x - dx * 100, 0, 100, 50),
      y: ceClamp(d.oldCrop.y - dy * 100, 0, 100, 50),
    };
    d.figure.style.setProperty(
      "--media-pos",
      d.nextCrop.x + "% " + d.nextCrop.y + "%",
    );
    return;
  }
  const p = { ...d.p };
  if (d.corner) {
    const sx = d.corner.includes("w") ? -1 : 1,
      sy = d.corner.includes("n") ? -1 : 1;
    let w = ceClamp(p.w + sx * dx, 0.05, 1, p.w),
      h = ceClamp(p.h + sy * dy, 0.05, 1, p.h);
    if (!e.shiftKey) {
      const ratio = p.w / p.h;
      h = w / ratio;
      if (h > 1) {
        h = 1;
        w = ratio;
      }
    }
    if (sx < 0) p.x += p.w - w;
    if (sy < 0) p.y += p.h - h;
    p.w = w;
    p.h = h;
  } else {
    p.x += dx;
    p.y += dy;
    if (!e.altKey) {
      const snap = (value, size) => {
        for (const guide of [0, 0.025, 0.5 - size / 2, 0.975 - size, 1 - size])
          if (Math.abs(value - guide) < 0.012) return guide;
        return value;
      };
      p.x = snap(p.x, p.w);
      p.y = snap(p.y, p.h);
    }
  }
  d.next = cePlacement(p);
  ceStyle(
    d.figure,
    {
      ...ceConfig(d.object, d.id),
      canvas: {
        ...ceObject(ceConfig(d.object, d.id).canvas),
        placement: d.next,
      },
    },
    d.figure.closest(".slide"),
  );
}
function ceEnd(cancel = false) {
  const d = ceDrag;
  if (!d) return;
  ceDrag = null;
  try {
    d.root.releasePointerCapture(d.pointer);
  } catch {}
  d.root.querySelector(".ce-guides")?.remove();
  d.figure.classList.remove("ce-dragging");
  if (cancel) {
    projectPreview();
    return;
  }
  if (
    !d.figure.isConnected ||
    projectSelected !== d.id ||
    ceLocked(d.id, d.object)
  )
    return;
  const cfg = ceConfig(d.object, d.id),
    next = {
      ...cfg,
      canvas: {
        ...ceObject(cfg.canvas),
        placement: d.crop ? cfg.canvas?.placement : d.next,
        crop: d.nextCrop,
      },
    };
  projectChange(() => ceSetConfig(next, d.object, d.id));
}
async function ceDrop(files, zone) {
  if (ceLocked() || vbMode !== "edit" || !$("full-editor").open || boothActive)
    return;
  const file = files[0];
  if (files.length !== 1) {
    projectMessage(
      "Drop one image or video at a time. Use Add media for additional objects.",
    );
    return;
  }
  if (
    !file ||
    !["image/", "video/"].some((type) => file.type.startsWith(type)) ||
    file.size > 250 * 1024 * 1024
  ) {
    projectMessage("Choose an image or video up to 250 MB.");
    return;
  }
  if (zone === "replace" && ceLocked(projectSelected, ceSelected)) {
    projectMessage("Unlock the selected object before replacing it.");
    return;
  }
  if ($("ce-add-object").checked && ceObjects().length >= 30) {
    projectMessage("A slide supports up to 30 additional media objects.");
    return;
  }
  const id = projectSelected,
    path = "assets/" + projectID("media") + "-" + mediaFilename(file.name);
  mediaRemember(path, file);
  const existing = zone === "replace" ? ceConfig() : null;
  const cfg = {
    ...mediaDefaults,
    ...existing,
    src: path,
    name: file.name,
    alt: existing?.alt || file.name,
    kind: file.type.startsWith("video/") ? "video" : "image",
  };
  if (zone !== "replace") {
    cfg.layout = ["left", "right", "background"].includes(zone)
      ? zone
      : "inset";
    cfg.canvas = ceObject({
      placement:
        zone === "floating" ? { x: 0.6, y: 0.5, w: 0.35, h: 0.4 } : null,
    });
  }
  if (cfg.kind === "image") {
    delete cfg.poster;
    delete cfg.posterName;
  }
  projectChange(() => {
    if (zone === "replace" && existing) ceSetConfig(cfg);
    else if ($("ce-add-object").checked && projectState.media[id]) {
      const object = {
        id: projectID("object"),
        media: {
          ...cfg,
          canvas: ceObject({
            ...cfg.canvas,
            placement: cfg.canvas?.placement || {
              x: 0.6,
              y: 0.5,
              w: 0.35,
              h: 0.4,
            },
          }),
        },
      };
      projectState.mediaObjects ??= {};
      (projectState.mediaObjects[id] ??= []).push(object);
      ceSelected = object.id;
    } else {
      projectState.media[id] = cfg;
      ceSelected = "primary";
    }
  });
}
function ceDropZones() {
  const host = $("fe-preview");
  if (host.querySelector(".ce-drop-zones")) return;
  const layer = document.createElement("div");
  layer.className = "ce-drop-zones";
  layer.innerHTML = ["replace", "left", "right", "background", "floating"]
    .map(
      (zone) =>
        '<div data-drop-zone="' +
        zone +
        '">' +
        (zone === "replace"
          ? "Replace selected"
          : zone[0].toUpperCase() + zone.slice(1)) +
        "</div>",
    )
    .join("");
  host.append(layer);
}
function ceBind() {
  const panel = document.createElement("details");
  panel.id = "ce-panel";
  panel.className = "hub-brand-group";
  panel.open = true;
  panel.innerHTML =
    '<summary>On-slide media and locks</summary><p id="ce-readonly" role="status"></p><div class="ce-row"><button id="ce-slide-lock">Lock slide</button><button id="ce-project-lock">Make presentation read-only</button></div><div id="ce-objects" aria-label="Media objects"></div><b id="ce-selected"></b><label class="fe-check"><input id="ce-add-object" type="checkbox"> Add dropped media as another floating object</label><button id="ce-upload">Add / replace media file</button><input id="ce-file" type="file" accept="image/*,video/*" hidden><label>Upload placement<select id="ce-zone"><option value="replace">Replace selected</option><option value="floating">Floating</option><option value="left">Left</option><option value="right">Right</option><option value="background">Background</option></select></label><div class="ce-row">' +
    ["x", "y", "w", "h"]
      .map(
        (key) =>
          "<label>" +
          { x: "Left", y: "Top", w: "Width", h: "Height" }[key] +
          ' %<input id="ce-' +
          key +
          '" type="number" min="0" max="100" step="0.5"></label>',
      )
      .join("") +
    '</div><div class="ce-row"><button id="ce-float">Free placement</button><button id="ce-reset">Reset to right layout</button></div><label>Image fit<select id="ce-fit"><option value="contain">Fit</option><option value="cover">Fill / crop</option></select></label><label class="fe-check"><input id="ce-crop" type="checkbox"> Drag image to crop (Fill)</label><label>Caption<input id="ce-caption"></label><label>Alternative text<input id="ce-alt"></label><div class="ce-row"><button id="ce-back">Send backward</button><button id="ce-front">Bring forward</button><button id="ce-delete">Delete media</button><button id="ce-object-lock">Lock object</button></div><label class="fe-check"><input id="ce-hidden" type="checkbox"> Hide object</label><p class="fe-hint">Select objects in this list when they overlap. Drag a floating frame to move; use corner handles to resize. Hold Shift for free proportions or Alt to bypass snapping. One gesture is one undo step.</p>';
  const workspace = document.createElement("div");
  workspace.className = "ce-workspace";
  $("fe-preview").before(workspace);
  workspace.append($("fe-preview"), panel);
  const bind = (id, fn) => ($(id).onclick = fn);
  bind("ce-upload", () => {
    if (!ceLocked()) $("ce-file").click();
  });
  $("ce-file").onchange = (e) => {
    ceDrop(e.target.files, $("ce-zone").value);
    e.target.value = "";
  };
  for (const type of ["slide", "project", "object"])
    bind("ce-" + type + "-lock", () => {
      if (boothActive || projectPlayback) return;
      vbEnd(false);
      ceLockAction = true;
      try {
        projectChange(() => {
          if (type === "project")
            projectState.editLocked = !projectState.editLocked;
          else if (type === "slide") {
            if (projectState.editLocked) return;
            projectModel().editLocked = !projectModel().editLocked;
          } else {
            if (ceLocked()) return;
            const cfg = ceConfig();
            if (cfg)
              cfg.canvas = {
                ...ceObject(cfg.canvas),
                locked: !cfg.canvas?.locked,
              };
          }
        });
      } finally {
        ceLockAction = false;
      }
    });
  const update = (fn) =>
    ceChange(() => {
      const cfg = ceConfig();
      if (cfg) fn(cfg);
    });
  bind("ce-float", () => {
    const figure = ceFigure(),
      rect = figure
        ? ceDefaultRect(figure)
        : { x: 0.6, y: 0.5, w: 0.35, h: 0.4 };
    update(
      (cfg) => (cfg.canvas = { ...ceObject(cfg.canvas), placement: rect }),
    );
  });
  bind("ce-reset", () =>
    update((cfg) => {
      cfg.layout = "right";
      cfg.canvas = {
        ...ceObject(cfg.canvas),
        placement:
          ceSelected === "primary" ? null : { x: 0.6, y: 0.5, w: 0.35, h: 0.4 },
        crop: { x: 50, y: 50 },
      };
    }),
  );
  for (const key of ["x", "y", "w", "h"])
    $("ce-" + key).onchange = () =>
      update(
        (cfg) =>
          (cfg.canvas = {
            ...ceObject(cfg.canvas),
            placement: cePlacement(
              Object.fromEntries(
                ["x", "y", "w", "h"].map((k) => [
                  k,
                  Number($("ce-" + k).value) / 100,
                ]),
              ),
            ),
          }),
      );
  for (const [id, key] of [
    ["ce-fit", "fit"],
    ["ce-caption", "caption"],
    ["ce-alt", "alt"],
  ])
    $(id).onchange = (e) => update((cfg) => (cfg[key] = e.target.value));
  $("ce-crop").onchange = (e) => {
    if (e.target.checked) update((cfg) => (cfg.fit = "cover"));
  };
  $("ce-hidden").onchange = (e) =>
    update(
      (cfg) =>
        (cfg.canvas = { ...ceObject(cfg.canvas), hidden: e.target.checked }),
    );
  for (const [id, delta] of [
    ["ce-back", -1],
    ["ce-front", 1],
  ])
    bind(id, () =>
      update(
        (cfg) =>
          (cfg.canvas = {
            ...ceObject(cfg.canvas),
            z: ceClamp((cfg.canvas?.z ?? 3) + delta, 0, 40, 3),
          }),
      ),
    );
  bind("ce-delete", () =>
    ceChange(() => {
      if (ceSelected === "primary") delete projectState.media[projectSelected];
      else
        projectState.mediaObjects[projectSelected] = ceObjects().filter(
          (o) => o.id !== ceSelected,
        );
      ceSelected = "primary";
    }),
  );
  $("fe-preview").addEventListener("pointerdown", ceGesture, true);
  window.addEventListener("pointermove", ceMove);
  window.addEventListener("pointerup", () => ceEnd());
  window.addEventListener("pointercancel", () => ceEnd(true));
  window.addEventListener(
    "keydown",
    (e) => {
      if (ceDrag && e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        ceEnd(true);
        return;
      }
      if (
        !e.target.closest?.("#fe-preview") ||
        vbMode !== "edit" ||
        !e.target.closest(".media-box")
      )
        return;
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        update((cfg) => {
          const p = cfg.canvas?.placement;
          if (!p) return;
          const step = e.shiftKey ? 0.01 : 0.001;
          cfg.canvas = {
            ...ceObject(cfg.canvas),
            placement: cePlacement({
              ...p,
              x:
                p.x +
                (e.key === "ArrowRight"
                  ? step
                  : e.key === "ArrowLeft"
                    ? -step
                    : 0),
              y:
                p.y +
                (e.key === "ArrowDown"
                  ? step
                  : e.key === "ArrowUp"
                    ? -step
                    : 0),
            }),
          };
        });
      }
    },
    true,
  );
  for (const event of ["dragenter", "dragover", "drop"])
    window.addEventListener(
      event,
      (e) => {
        if (!e.dataTransfer?.types.includes("Files")) return;
        e.preventDefault();
        if (
          boothActive ||
          !$("full-editor").open ||
          vbMode !== "edit" ||
          ceLocked()
        ) {
          e.stopImmediatePropagation();
          return;
        }
        if (!e.target.closest?.("#fe-preview")) return;
        e.stopImmediatePropagation();
        if (event !== "drop") {
          ceDropZones();
          const zone = e.target.closest("[data-drop-zone]");
          document
            .querySelectorAll("[data-drop-zone]")
            .forEach((z) => z.classList.toggle("ce-drop-active", z === zone));
        } else {
          const zone =
            e.target.closest("[data-drop-zone]")?.dataset.dropZone || "replace";
          $("fe-preview").querySelector(".ce-drop-zones")?.remove();
          ceDrop(e.dataTransfer.files, zone);
        }
      },
      true,
    );
  window.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget)
      $("fe-preview").querySelector(".ce-drop-zones")?.remove();
  });
  window.addEventListener("drop", () =>
    document.querySelector(".ce-drop-zones")?.remove(),
  );
  cePanel();
}
const ceInit = projectInit;
projectInit = function () {
  ceInit();
  ceBind();
};
