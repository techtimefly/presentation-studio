// Editor-only view state. No zoom, pan, selection or thumbnail state enters packs.
let weFormUpdating = false;
let weLastMode = "edit";
let weMounted = false,
  weContext = "slide",
  weKey = "",
  weZoom = "fit",
  wePan = { x: 0, y: 0 },
  wePanning = null,
  weSpace = false,
  weThumbObserver = null,
  weThumbJobs = 0;
const weCollapsed = new Set(),
  weProjectTabs = new Set([
    "brand",
    "settings",
    "sections",
    "loops",
    "recovery",
  ]);
function weEditing() {
  return (
    weMounted &&
    $("full-editor").open &&
    !boothActive &&
    !projectPlayback &&
    !projectDraftPending
  );
}
function weScale() {
  const viewport = $("we-viewport");
  return weZoom === "fit"
    ? Math.max(
        0.05,
        Math.min(
          1,
          (viewport.clientWidth - 48) / 1920,
          (viewport.clientHeight - 48) / 1080,
        ),
      )
    : weZoom;
}
function weView() {
  if (!weMounted || !projectPreviewNode) return;
  const viewport = $("we-viewport"),
    scale = weScale();
  const maxX = Math.max(0, (1920 * scale - viewport.clientWidth) / 2 + 24),
    maxY = Math.max(0, (1080 * scale - viewport.clientHeight) / 2 + 24);
  wePan.x = Math.max(-maxX, Math.min(maxX, wePan.x));
  wePan.y = Math.max(-maxY, Math.min(maxY, wePan.y));
  Object.assign($("fe-preview").style, {
    transform:
      "translate(" +
      ((viewport.clientWidth - 1920 * scale) / 2 + wePan.x) +
      "px," +
      ((viewport.clientHeight - 1080 * scale) / 2 + wePan.y) +
      "px) scale(" +
      scale +
      ")",
  });
  projectPreviewNode.style.transform = "none";
  $("we-zoom").value = weZoom === "fit" ? "fit" : String(weZoom);
  $("we-zoom-value").textContent =
    Math.round(scale * 100) + "%" + (weZoom === "fit" ? " · Fit" : "");
  $("we-zoom-out").disabled = weZoom === "fit" && scale <= 0.5;
  $("we-view-status").textContent = wePanning
    ? "Panning canvas"
    : "View only · Space + drag to pan";
  projectCheckLayout();
}
function weSetZoom(value, anchor = null) {
  if (!weEditing() || mfState) return;
  const old = weScale(),
    vp = $("we-viewport"),
    before = {
      x: (vp.clientWidth - 1920 * old) / 2 + wePan.x,
      y: (vp.clientHeight - 1080 * old) / 2 + wePan.y,
    };
  weZoom =
    value === "fit" ? "fit" : Math.max(0.5, Math.min(2, Number(value) || 1));
  if (weZoom === "fit") wePan = { x: 0, y: 0 };
  else if (anchor) {
    const scale = weScale();
    wePan = {
      x:
        anchor.x -
        ((anchor.x - before.x) / old) * scale -
        (vp.clientWidth - 1920 * scale) / 2,
      y:
        anchor.y -
        ((anchor.y - before.y) / old) * scale -
        (vp.clientHeight - 1080 * scale) / 2,
    };
  }
  weView();
}
function weStepZoom(direction) {
  const levels = [0.5, 0.75, 1, 1.25, 1.5, 2],
    current = weScale();
  const next =
    direction > 0
      ? levels.find((v) => v > current + 0.001)
      : [...levels].reverse().find((v) => v < current - 0.001);
  weSetZoom(next ?? (direction > 0 ? 2 : "fit"));
}
const weResize = projectResizePreview;
projectResizePreview = function () {
  if (!weMounted) return weResize();
  weView();
};
function weCloseSettings() {
  if (!$("we-settings")?.open) return;
  $("we-settings").close();
  projectTab = "content";
  weBaseTab("content");
  weInspect(weContext);
}
function weOpenSettings(tab = "brand") {
  if (!weEditing()) return;
  vbEnd(false);
  if (!$("we-settings").open) $("we-settings").show();
  projectSelectTab(tab);
}
const weBaseTab = projectSelectTab;
projectSelectTab = function (tab) {
  weBaseTab(tab);
  if (!weMounted) return;
  if (weFormUpdating) {
    weInspect(weContext, false);
    return;
  }
  if (weProjectTabs.has(tab)) {
    if (weEditing() && !$("we-settings").open) $("we-settings").show();
    return;
  }
  if ($("we-settings").open) $("we-settings").close();
  weContext =
    tab === "table"
      ? "table"
      : tab === "commands"
        ? "commands"
        : tab === "notes"
          ? "notes"
          : "slide";
  weInspect(weContext, false);
};
function weInspect(context = weContext, select = true) {
  if (!weMounted) return;
  weContext = context;
  const tab =
    context === "table"
      ? "table"
      : context === "commands"
        ? "commands"
        : context === "notes"
          ? "notes"
          : "content";
  if (select) {
    projectTab = tab;
    weBaseTab(tab);
  }
  $("we-inspector").dataset.context = context;
  $("we-inspector-title").textContent =
    {
      slide: "Slide",
      text: "Text and formatting",
      media: "Media",
      table: "Table",
      commands: "Commands",
      notes: "Presenter notes",
    }[context] || "Slide";
  $("ce-panel").hidden = context !== "media";
  $("fe-content-panel").hidden = !["slide", "text"].includes(context);
  $("we-font-controls").hidden = context !== "text";
  $("vb-toolbar").hidden =
    !vbSelected ||
    !(
      ["text", "table", "commands"].includes(context) ||
      (context === "media" && ceSelected === "primary")
    ) ||
    vbMode !== "edit";
  $("we-context-media").setAttribute(
    "aria-selected",
    String(context === "media"),
  );
  $("we-context-slide").setAttribute(
    "aria-selected",
    String(context === "slide"),
  );
  document
    .querySelector("[data-fe-tab=content]")
    .setAttribute("aria-selected", String(context === "text"));
  document.querySelector("[data-fe-tab=content]").tabIndex =
    context === "text" ? 0 : -1;
  for (const [button, active] of [
    [$("we-context-slide"), context === "slide"],
    [$("we-context-media"), context === "media"],
  ])
    button.tabIndex = active ? 0 : -1;
  const target = weTextTarget();
  $("we-font-size").disabled = !target || ceLocked();
  if (context === "text" && target) {
    const size = (target.node.attrs?.style || "").match(
      /(?:^|;)\s*font-size\s*:\s*([\d.]+)px/i,
    )?.[1];
    $("we-font-size").value =
      size ||
      (target.el
        ? Math.round(parseFloat(getComputedStyle(target.el).fontSize))
        : 32);
  }
  $("we-slide-transition").value = projectModel()?.transition || "inherit";
}
const weSelection = vbSetSelection;
vbSetSelection = function (selection) {
  weSelection(selection);
  if (!weMounted || !selection) return;
  const node = vbNode();
  if (selection.kind === "logo") {
    weOpenSettings("brand");
    return;
  }
  weInspect(
    selection.kind === "media"
      ? "media"
      : selection.kind === "commands"
        ? "commands"
        : ["td", "th", "caption"].includes(node?.tag)
          ? "table"
          : "text",
  );
};
const weSelectMedia = ceSelect;
ceSelect = function (...args) {
  weSelectMedia(...args);
  weInspect("media");
};
const weMediaGesture = ceGesture;
ceGesture = function (event) {
  const media = event.target.closest(".media-box");
  weMediaGesture(event);
  if (
    weMounted &&
    media &&
    projectPreviewNode?.contains(media) &&
    vbMode === "edit"
  )
    weInspect("media");
};
const wePreview = projectPreview;
projectPreview = function (...args) {
  const next = projectMeta?.id + ":" + projectSelected,
    changed = next !== weKey;
  wePreview(...args);
  if (!weMounted) return;
  if (vbMode === "preview" && weLastMode !== "preview") {
    weZoom = "fit";
    wePan = { x: 0, y: 0 };
  }
  weLastMode = vbMode;
  if (changed) {
    weEndPan(true);
    weKey = next;
    weZoom = "fit";
    wePan = { x: 0, y: 0 };
    weContext = projectModel()?.template === "media" ? "media" : "slide";
  }
  weInspect(weContext, false);
  weView();
};
const weClose = projectClose;
projectClose = function (...args) {
  weEndPan(true);
  weCloseSettings();
  return weClose(...args);
};
function weTextTarget() {
  const path = vbSelected?.path ?? projectBlockPath;
  if (!path || !projectModel()) return null;
  const node = projectAt(projectModel(), path);
  if (!node || (!vbIsText(node) && !["ul", "ol"].includes(node.tag)))
    return null;
  return {
    path,
    node,
    el: projectPreviewNode?.querySelector('[data-vb-path="' + path + '"]'),
  };
}
function weTextSize() {
  const target = weTextTarget();
  if (!target || ceLocked()) return;
  const size = ceClamp($("we-font-size").value, 8, 200, 32),
    path = target.path;
  vbEnd(false);
  projectChange(() => {
    const node = projectAt(projectModel(), path);
    if (!node) return;
    node.attrs ??= {};
    node.attrs.style = projectSafeStyle(
      (node.attrs.style || "")
        .split(";")
        .filter((rule) => !/^\s*font-size\s*:/i.test(rule))
        .concat("font-size:" + size + "px")
        .join(";"),
    );
  });
  vbFocusPath(path);
}
function weThumb(button, model) {
  const holder = button.querySelector(".we-thumbnail");
  if (!holder || holder.firstChild || !button.isConnected) return;
  const live = allSlides.find((s) => s.dataset.mediaId === model.id);
  if (!live) return;
  const root = document.createElement("span");
  root.className = "me-preview-stage we-thumb-canvas";
  root.setAttribute("aria-hidden", "true");
  root.inert = true;
  const grid = $("stage").querySelector(":scope>.grid");
  if (grid) root.append(grid.cloneNode(true));
  const header = $("stage").querySelector(":scope>header")?.cloneNode(true);
  if (header) {
    studioPaintHeader(
      header.querySelector(".brand"),
      projectState.sections.find((s) => s.id === model.group),
    );
    root.append(header);
  }
  const slide = live.cloneNode(true);
  slide.classList.add("active");
  slide.inert = true;
  root.append(slide);
  for (const video of root.querySelectorAll("video")) {
    const poster = video.poster,
      still = document.createElement(poster ? "img" : "span");
    still.className = "media-asset we-thumb-video";
    if (poster) {
      still.src = poster;
      still.alt = "";
    } else still.textContent = "Video";
    video.replaceWith(still);
  }
  for (const el of root.querySelectorAll("button,select,input,textarea,a")) {
    const text = document.createElement("span");
    text.textContent = el.matches(".mf-expand,.ce-handle,.ce-placement-handle")
      ? ""
      : el.textContent;
    el.replaceWith(text);
  }
  root.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  holder.append(root);
  root.style.transform = "scale(" + holder.clientWidth / 1920 + ")";
}
function weReorder(sourceID, targetID, after = false) {
  if (!weEditing() || $("fe-search").value.trim() || sourceID === targetID)
    return;
  const source = projectModel(sourceID),
    target = projectModel(targetID);
  if (
    !source ||
    !target ||
    source.group !== target.group ||
    ceLocked(sourceID) ||
    ceLocked(targetID)
  ) {
    projectMessage(
      "Reorder unlocked slides within the same section. Clear search before dragging.",
    );
    return;
  }
  vbEnd(false);
  projectFlush();
  projectChange(() => {
    const ids = projectState.slides
        .filter((s) => s.group === source.group)
        .map((s) => s.id),
      ordered = ids.filter((id) => id !== sourceID);
    ordered.splice(ordered.indexOf(targetID) + (after ? 1 : 0), 0, sourceID);
    const byID = new Map(projectState.slides.map((s) => [s.id, s]));
    let i = 0;
    projectState.slides = projectState.slides.map((s) =>
      s.group === source.group ? byID.get(ordered[i++]) : s,
    );
    const loop = projectState.loops[source.group];
    if (loop) {
      const positions = ordered.filter((id) => loop.slideIds.includes(id));
      let j = 0;
      loop.slideIds = loop.slideIds.map((id) =>
        positions.includes(id) ? positions[j++] : id,
      );
    }
  });
}
const weList = projectList;
projectList = function (...args) {
  weList(...args);
  if (!weMounted) return;
  weThumbObserver?.disconnect();
  const generation = ++weThumbJobs,
    list = $("fe-slide-list"),
    buttons = [...list.querySelectorAll(".fe-slide-button")];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting && generation === weThumbJobs) {
          const button = entry.target,
            model = projectModel(button.dataset.slideId);
          if (model) weThumb(button, model);
          observer.unobserve(button);
        }
    },
    { root: list, rootMargin: "100px" },
  );
  weThumbObserver = observer;
  for (const section of projectState.sections) {
    const members = buttons.filter(
      (button) => projectModel(button.dataset.slideId)?.group === section.id,
    );
    if (!members.length) continue;
    const group = document.createElement("section");
    group.className = "we-slide-section";
    const heading = document.createElement("button");
    heading.type = "button";
    heading.className = "we-section-toggle";
    heading.textContent = section.name + " · " + members.length;
    const collapsedKey = projectMeta.id + ":" + section.id,
      container = document.createElement("div");
    container.id = "we-section-" + section.id;
    container.hidden =
      weCollapsed.has(collapsedKey) && !$("fe-search").value.trim();
    heading.setAttribute("aria-expanded", String(!container.hidden));
    heading.setAttribute("aria-controls", container.id);
    heading.onclick = () => {
      container.hidden = !container.hidden;
      heading.setAttribute("aria-expanded", String(!container.hidden));
      if (container.hidden) weCollapsed.add(collapsedKey);
      else weCollapsed.delete(collapsedKey);
    };
    for (const button of members) {
      const model = projectModel(button.dataset.slideId);
      const thumb = document.createElement("span");
      thumb.className = "we-thumbnail";
      button.prepend(thumb);
      const badges = document.createElement("span");
      badges.className = "we-slide-badges";
      badges.textContent = [
        model.hidden ? "Hidden" : "",
        model.editLocked ? "🔒 Locked" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      button.append(badges);
      button.setAttribute(
        "aria-label",
        model.title +
          " · " +
          section.name +
          (badges.textContent ? " · " + badges.textContent : ""),
      );
      button.draggable = !ceLocked(model.id) && !$("fe-search").value.trim();
      const choose = button.onclick;
      button.onclick = (event) => {
        weEndPan(true);
        weCloseSettings();
        return choose(event);
      };
      button.addEventListener("dragstart", (event) => {
        if (!weEditing() || !button.draggable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(
          "application/x-presentation-slide",
          model.id,
        );
        event.dataTransfer.effectAllowed = "move";
        button.classList.add("we-drag-source");
      });
      button.addEventListener("dragover", (event) => {
        if (
          !event.dataTransfer.types.includes("application/x-presentation-slide")
        )
          return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const after =
          event.clientY >
          button.getBoundingClientRect().top + button.clientHeight / 2;
        button.dataset.weDrop = after ? "after" : "before";
      });
      button.addEventListener("drop", (event) => {
        if (
          !event.dataTransfer.types.includes("application/x-presentation-slide")
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const source = event.dataTransfer.getData(
          "application/x-presentation-slide",
        );
        weReorder(
          source,
          model.id,
          event.clientY >
            button.getBoundingClientRect().top + button.clientHeight / 2,
        );
      });
      button.addEventListener("dragleave", () => delete button.dataset.weDrop);
      button.addEventListener("dragend", () => {
        document
          .querySelectorAll("[data-we-drop]")
          .forEach((el) => delete el.dataset.weDrop);
        button.classList.remove("we-drag-source");
      });
      container.append(button);
      observer.observe(button);
    }
    group.append(heading, container);
    list.append(group);
  }
};
function weStartPan(event) {
  if (
    !weEditing() ||
    mfState ||
    (!weSpace && event.button !== 1) ||
    event.target.closest("input,select,textarea,[contenteditable=true]") ||
    ceDrag ||
    ceRelocate
  )
    return;
  event.preventDefault();
  event.stopImmediatePropagation();
  wePanning = {
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    origin: { ...wePan },
  };
  try {
    $("we-viewport").setPointerCapture(event.pointerId);
  } catch {}
  $("we-viewport").classList.add("we-panning");
  weView();
}
function weEndPan(cancel = false) {
  if (!wePanning) return;
  const pan = wePanning;
  wePanning = null;
  if (cancel) wePan = pan.origin;
  try {
    $("we-viewport")?.releasePointerCapture(pan.pointer);
  } catch {}
  $("we-viewport")?.classList.remove("we-panning");
  weView();
}
function weBind() {
  const body = document.querySelector("#full-editor .fe-body"),
    work = document.querySelector("#full-editor .fe-work");
  body.classList.add("we-body");
  work.id = "we-center";
  const inspector = document.createElement("aside");
  inspector.id = "we-inspector";
  inspector.setAttribute("aria-label", "Selection inspector");
  inspector.innerHTML =
    '<h3 id="we-inspector-title">Slide</h3><div class="we-context-buttons"><button id="we-context-slide" aria-pressed="true">Slide</button><button id="we-context-media" aria-pressed="false">Media</button></div><div id="we-common"></div><div id="we-font-controls" hidden><label for="we-font-size">Font size (px)</label><input id="we-font-size" type="number" min="8" max="200"></div>';
  body.append(inspector);
  const workspace = $("fe-preview").closest(".ce-workspace"),
    viewport = document.createElement("div");
  viewport.id = "we-viewport";
  viewport.tabIndex = 0;
  viewport.setAttribute("role", "group");
  viewport.setAttribute(
    "aria-label",
    "Slide editing canvas. Hold Space and drag to pan.",
  );
  workspace.before(viewport);
  viewport.append($("fe-preview"));
  inspector.append($("ce-panel"));
  workspace.remove();
  $("ce-panel").open = true;
  const common = $("we-common"),
    titleLabel = document.querySelector('label[for="fe-slide-title"]');
  common.append(titleLabel, $("fe-slide-title"));
  const lockRow = $("ce-slide-lock").parentElement;
  common.append(lockRow);
  const tabs = document.querySelector("#full-editor .fe-tabs");
  tabs.prepend($("we-context-slide"));
  tabs.append($("we-context-media"));
  for (const button of [$("we-context-slide"), $("we-context-media")]) {
    button.setAttribute("role", "tab");
    button.removeAttribute("aria-pressed");
  }
  inspector.querySelector(".we-context-buttons").remove();
  document.querySelector("[data-fe-tab=content]").textContent = "Text";
  document.querySelector("[data-fe-tab=content]").onclick = () => {
    vbEnd(false);
    weInspect("text");
  };
  inspector.append(tabs, $("vb-toolbar"));
  const settings = document.createElement("dialog");
  settings.id = "we-settings";
  settings.setAttribute("aria-label", "Project settings");
  settings.innerHTML =
    '<div class="we-settings-heading"><h2>Project settings</h2><button id="we-settings-close">Back to canvas</button></div><nav id="we-project-tabs" class="fe-tabs" aria-label="Project settings"></nav><div id="we-project-panels"></div>';
  $("full-editor").append(settings);
  for (const tab of weProjectTabs) {
    const button = document.querySelector('[data-fe-tab="' + tab + '"]');
    if (button) $("we-project-tabs").append(button);
    $("we-project-panels").append($("fe-" + tab + "-panel"));
  }
  for (const tab of ["content", "table", "commands", "notes"])
    inspector.append($("fe-" + tab + "-panel"));
  const extra = document.createElement("label");
  extra.htmlFor = "we-slide-transition";
  extra.textContent = "Slide transition";
  const transition = $("nx-slide-transition").cloneNode(true);
  transition.id = "we-slide-transition";
  $("fe-content-panel").prepend(extra, transition);
  transition.onchange = () => {
    $("nx-slide-transition").value = transition.value;
    $("nx-slide-transition").dispatchEvent(
      new Event("change", { bubbles: true }),
    );
  };
  const projectButton = document.createElement("button");
  projectButton.id = "we-settings-open";
  projectButton.textContent = "Project settings";
  projectButton.onclick = () => weOpenSettings();
  document.querySelector("#full-editor .fe-top-actions").prepend(projectButton);
  $("we-settings-close").onclick = weCloseSettings;
  settings.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      weCloseSettings();
      $("we-settings-open").focus();
    }
  });
  $("full-editor").addEventListener("close", () => {
    weEndPan(true);
    weCloseSettings();
    weSpace = false;
  });
  $("we-context-slide").onclick = () => {
    vbEnd(false);
    vbSelected = null;
    weInspect("slide");
  };
  $("we-context-media").onclick = () => {
    vbEnd(false);
    weInspect("media");
  };
  $("we-font-size").onchange = weTextSize;
  $("fe-block-select").addEventListener("change", () =>
    weInspect("text", false),
  );
  for (const nav of [tabs, $("we-project-tabs")]) {
    nav.setAttribute("role", "tablist");
    nav.addEventListener("keydown", (event) => {
      const current = event.target.closest("[role=tab]");
      if (
        !current ||
        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        return;
      const buttons = [...nav.querySelectorAll("[role=tab]")].filter(
        (b) => !b.hidden,
      );
      const index = buttons.indexOf(current);
      const next =
        event.key === "Home"
          ? buttons[0]
          : event.key === "End"
            ? buttons.at(-1)
            : buttons[
                (index +
                  (event.key === "ArrowRight" ? 1 : -1) +
                  buttons.length) %
                  buttons.length
              ];
      event.preventDefault();
      event.stopImmediatePropagation();
      next.focus();
      next.click();
    });
  }
  const tools = document.createElement("div");
  tools.id = "we-view-tools";
  tools.innerHTML =
    '<button id="we-fit" title="Fit slide to editing viewport">Fit</button><button id="we-zoom-out" aria-label="Zoom out">−</button><label for="we-zoom" class="we-sr-only">Canvas zoom</label><select id="we-zoom"><option value="fit">Fit slide</option>' +
    [0.5, 0.75, 1, 1.25, 1.5, 2]
      .map((n) => '<option value="' + n + '">' + n * 100 + "%</option>")
      .join("") +
    '</select><button id="we-zoom-in" aria-label="Zoom in">+</button><output id="we-zoom-value" aria-live="polite"></output><span id="we-view-status"></span>';
  viewport.before(tools);
  $("we-fit").onclick = () => weSetZoom("fit");
  $("we-zoom-in").onclick = () => weStepZoom(1);
  $("we-zoom-out").onclick = () => weStepZoom(-1);
  $("we-zoom").onchange = (event) => weSetZoom(event.target.value);
  viewport.addEventListener("pointerdown", weStartPan, true);
  window.addEventListener("pointermove", (event) => {
    if (wePanning?.pointer !== event.pointerId) return;
    event.preventDefault();
    wePan = {
      x: wePanning.origin.x + event.clientX - wePanning.x,
      y: wePanning.origin.y + event.clientY - wePanning.y,
    };
    weView();
  });
  window.addEventListener("pointerup", (event) => {
    if (wePanning?.pointer === event.pointerId) weEndPan();
  });
  window.addEventListener("pointercancel", (event) => {
    if (wePanning?.pointer === event.pointerId) weEndPan(true);
  });
  viewport.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.target.closest("input,textarea,select,[contenteditable=true]"))
        return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect(),
        next = weScale() * (event.deltaY < 0 ? 1.1 : 1 / 1.1);
      weSetZoom(next, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    { passive: false },
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        !weEditing() ||
        mfState ||
        event.target.closest(
          "#we-settings,input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (event.key === " " && event.target.closest("button,a,video")) return;
      if (event.key === "Escape" && wePanning) {
        event.preventDefault();
        event.stopImmediatePropagation();
        weEndPan(true);
        return;
      }
      if (event.key === " " && viewport.contains(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        weSpace = true;
        viewport.classList.add("we-can-pan");
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        viewport.contains(event.target) &&
        ["+", "=", "-", "0"].includes(event.key)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "0") weSetZoom("fit");
        else weStepZoom(event.key === "-" ? -1 : 1);
      }
    },
    true,
  );
  window.addEventListener("keyup", (event) => {
    if (event.key === " ") {
      weSpace = false;
      viewport.classList.remove("we-can-pan");
    }
  });
  window.addEventListener("blur", () => {
    weSpace = false;
    weEndPan(true);
    viewport.classList.remove("we-can-pan");
  });
  viewport.addEventListener(
    "click",
    (event) => {
      if (vbMode !== "edit" || wePanning || weSpace || mfState) return;
      const target = event.target;
      if (
        target === viewport ||
        target === projectPreviewNode ||
        target.matches(".slide,.media-original,.grid,.orb")
      ) {
        vbEnd(false);
        vbSelected = null;
        weInspect("slide");
      }
    },
    true,
  );
  new ResizeObserver(() => {
    weView();
    for (const root of document.querySelectorAll(".we-thumb-canvas"))
      root.style.transform =
        "scale(" + root.parentElement.clientWidth / 1920 + ")";
  }).observe(viewport);
  $("fe-close").onclick = projectClose;
  weMounted = true;
  weInspect("slide");
  projectList();
  projectPreview();
}
const weInit = projectInit;
projectInit = function () {
  weInit();
  weBind();
};

const weRecovery = projectRecoveryBanner;
projectRecoveryBanner = function (...args) {
  weRecovery(...args);
  if (weMounted) $("we-inspector").inert = !!projectDraftPending;
};

const weForm = projectForm;
projectForm = function (...args) {
  weFormUpdating = true;
  try {
    return weForm(...args);
  } finally {
    weFormUpdating = false;
  }
};
