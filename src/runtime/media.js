// Media assignments are keyed by content-derived IDs, independent of slide order.
  const mediaGroups = [
    ["showcase", "Presentation · Showcase", showcase],
    ["qa", "Presentation · Q&A", qaSlides],
    ["steps", "Presentation · Commands", stepSlides],
    ["detection", "Presentation · Detection results", detectionSlides],
    ["remshowcase", "Workshop · Showcase", remSlides],
    ["remqa", "Workshop · Q&A", remQASlides],
    ["remsteps", "Workshop · Commands", remStepSlides],
    ["overview", "Presentation · Overview", overviewSlides],
  ];
  function mediaHash(text) {
    let n = 2166136261;
    for (let i = 0; i < text.length; i++)
      n = Math.imul(n ^ text.charCodeAt(i), 16777619);
    return (n >>> 0).toString(36);
  }
  const mediaEntries = [];
  mediaGroups.forEach(([group, label, items]) =>
    items.forEach((slide, i) => {
      const heading = slide.querySelector("h1,h2")?.cloneNode(true);
      heading?.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
      const title =
        heading?.textContent.replace(/\s+/g, " ").trim() || slide.dataset.title;
      const id =
        slide.dataset.mediaId || group + "-" + mediaHash(group + "|" + title);
      slide.dataset.mediaId = id;
      mediaEntries.push({ id, title, group, label, slide, index: i });
    }),
  );
  const mediaDefaults = {
    layout: "right",
    ratio: "equal",
    fit: "contain",
    position: "center",
    frame: "none",
    corner: "right bottom",
    caption: "",
    captionPlace: "below",
    alt: "",
    overlay: 55,
    autoplay: true,
    muted: true,
    loop: true,
    advance: "fixed",
  };
  let mediaConfig = { schemaVersion: 1, slides: {} },
    mediaSaved = {},
    mediaDirty = false,
    mediaSelected = mediaEntries[0].id,
    mediaLastSlide = null,
    mediaPreviewNode = null,
    mediaExporting = false;
  const mediaBlobs = new Map(),
    mediaURLs = new Map();
  try {
    const initial = JSON.parse($("media-config").textContent);
    if (
      initial.schemaVersion === 1 &&
      initial.slides &&
      typeof initial.slides === "object"
    )
      mediaConfig = mediaValidate(initial);
  } catch (e) {
    console.warn("Media configuration could not be loaded");
  }
  function mediaClone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  mediaSaved = mediaClone(mediaConfig.slides);
  function mediaSafePath(path) {
    return (
      typeof path === "string" &&
      /^assets\/[a-zA-Z0-9_./-]+$/.test(path) &&
      !path.split("/").some((x) => x === ".." || x === ".")
    );
  }
  function mediaAssetURL(path) {
    return mediaURLs.get(path) || path;
  }
  function mediaRemember(path, blob) {
    const previous = mediaURLs.get(path);
    if (previous) URL.revokeObjectURL(previous);
    mediaBlobs.set(path, blob);
    mediaURLs.set(path, URL.createObjectURL(blob));
  }
  function mediaBytes(size) {
    return size >= 1048576
      ? (size / 1048576).toFixed(1) + " MB"
      : (size / 1024).toFixed(0) + " KB";
  }
  function mediaState() {
    let count = Object.keys(mediaConfig.slides).length,
      total = 0;
    for (const blob of mediaBlobs.values()) total += blob.size;
    $("me-save-state").textContent = mediaDirty
      ? "Unsaved changes · export a ZIP to save"
      : "No unsaved changes";
    $("me-save-state").classList.toggle("dirty", mediaDirty);
    $("edit-media").textContent = mediaDirty ? "Edit Media •" : "Edit Media";
    $("me-size").textContent =
      count +
      " media slide" +
      (count === 1 ? "" : "s") +
      " · " +
      mediaBytes(total) +
      " loaded";
    $("me-export").disabled = mediaExporting;
  }
  function mediaMark() {
    mediaDirty = true;
    mediaState();
    if (projectReady) projectMediaChanged();
  }
  function mediaMessage(message) {
    $("me-message").textContent = message;
  }
  function mediaGetEntry() {
    return mediaEntries.find((x) => x.id === mediaSelected);
  }
  function mediaGetAssignment(id = mediaSelected) {
    return mediaConfig.slides[id];
  }
  function mediaPauseAll(except = null) {
    allSlides.forEach((s) =>
      s.querySelectorAll("video.media-asset").forEach((v) => {
        if (v !== except) v.pause();
      }),
    );
  }
  function mediaPlayCurrent() {
    const s = slides[index],
      cfg = mediaGetAssignment(s?.dataset.mediaId),
      v = s?.querySelector("video.media-asset");
    if (!v) return;
    v.muted = cfg.muted;
    v.loop = cfg.loop && cfg.advance !== "ended";
    if (playing && cfg.autoplay && !$("media-editor").open) {
      const play = v.play();
      if (play)
        play.catch(() => {
          v.controls = true;
        });
    } else if (!playing) v.pause();
  }
  function mediaOnRender() {
    if (!slides[index]) return;
    const current = slides[index];
    if (mediaLastSlide !== current) {
      mediaPauseAll();
      const v = current.querySelector("video.media-asset");
      if (v) {
        try {
          v.currentTime = 0;
        } catch (e) {}
      }
      mediaLastSlide = current;
    }
    mediaPlayCurrent();
  }
  function mediaHoldSlide() {
    const current = slides[index],
      cfg = mediaGetAssignment(current?.dataset.mediaId);
    if (!cfg || cfg.kind !== "video") return false;
    const v = current.querySelector("video.media-asset");
    if (!v || v.closest(".media-box")?.classList.contains("is-missing"))
      return false;
    if (cfg.advance === "manual") return true;
    if (cfg.advance === "ended") return true;
    return false;
  }
  function mediaRestore(slide) {
    slide.querySelectorAll("video").forEach((v) => v.pause());
    const original = slide.querySelector(":scope > .media-original");
    if (original) {
      const children = [...original.childNodes];
      original.replaceWith(...children);
    }
    slide.querySelector(":scope > .media-box")?.remove();
    for (const name of [...slide.classList])
      if (name.startsWith("media-") || name.startsWith("corner-"))
        slide.classList.remove(name);
    slide.style.removeProperty("--media-share");
  }
  function mediaApply(slide) {
    const cfg = mediaGetAssignment(slide.dataset.mediaId);
    mediaRestore(slide);
    if (!cfg) return;
    const original = document.createElement("div");
    original.className = "media-original";
    while (slide.firstChild) original.append(slide.firstChild);
    slide.append(original);
    slide.classList.add(
      "media-on",
      "media-" + cfg.layout,
      "corner-" + cfg.corner.replace(" ", "-"),
    );
    slide.style.setProperty(
      "--media-share",
      cfg.ratio === "media" ? "62%" : cfg.ratio === "text" ? "38%" : "50%",
    );
    const box = document.createElement("figure");
    box.className =
      "media-box frame-" +
      cfg.frame +
      (cfg.captionPlace === "overlay" ? " caption-overlay" : "");
    box.style.setProperty("--media-fit", cfg.fit);
    box.style.setProperty("--media-pos", cfg.position);
    box.style.setProperty("--media-overlay", cfg.overlay / 100);
    const viewport = document.createElement("div");
    viewport.className = "media-viewport";
    const asset = document.createElement(
      cfg.kind === "video" ? "video" : "img",
    );
    asset.className = "media-asset";
    if (cfg.kind === "video") {
      asset.controls = true;
      asset.preload = "metadata";
      asset.playsInline = true;
      asset.muted = cfg.muted;
      asset.loop = cfg.loop && cfg.advance !== "ended";
      if (cfg.poster) asset.poster = mediaAssetURL(cfg.poster);
      asset.addEventListener("ended", () => {
        if (
          slides[index] === slide &&
          playing &&
          mediaGetAssignment(slide.dataset.mediaId)?.advance === "ended"
        )
          show(index + 1);
      });
    } else {
      asset.alt = cfg.alt || cfg.name || "Slide image";
      asset.loading = "lazy";
      asset.decoding = "async";
    }
    const fallback = document.createElement("div");
    fallback.className = "media-fallback";
    fallback.hidden = true;
    fallback.textContent =
      cfg.kind === "video" ? "Video unavailable" : "Image unavailable";
    asset.addEventListener("error", () => {
      box.classList.add("is-missing");
      fallback.hidden = false;
      if (cfg.kind === "video" && cfg.poster) {
        const poster = document.createElement("img");
        poster.className = "media-asset";
        poster.src = mediaAssetURL(cfg.poster);
        poster.alt = cfg.alt || "Video poster";
        poster.onerror = () => poster.remove();
        fallback.prepend(poster);
      }
    });
    asset.src = mediaAssetURL(cfg.src);
    const shade = document.createElement("div");
    shade.className = "media-shade";
    viewport.append(asset, shade, fallback);
    box.append(viewport);
    if (cfg.caption) {
      const caption = document.createElement("figcaption");
      caption.textContent = cfg.caption;
      box.append(caption);
    }
    slide.append(box);
    if (cfg.layout === "below") {
      original.style.height = "auto";
      const top = Math.max(
        slide.clientHeight * 0.33,
        (original.firstElementChild?.scrollHeight || 0) + 24,
      );
      box.style.top = top + "px";
    }
  }
  function mediaApplyAll() {
    allSlides.forEach(mediaApply);
    mediaOnRender();
  }
  function mediaList() {
    const query = $("me-search").value.toLowerCase().trim(),
      section = $("me-section").value;
    const shown = mediaEntries.filter(
      (e) =>
        (section === "all" || e.group === section) &&
        (!query || (e.title + " " + e.label).toLowerCase().includes(query)),
    );
    $("me-count").textContent =
      shown.length + " of " + mediaEntries.length + " slides";
    $("me-slides").replaceChildren();
    shown.forEach((entry) => {
      const button = document.createElement("button");
      button.className = "me-slide-option";
      button.classList.toggle("selected", entry.id === mediaSelected);
      button.setAttribute(
        "aria-current",
        entry.id === mediaSelected ? "true" : "false",
      );
      button.dataset.mediaTarget = entry.id;
      const cfg = mediaGetAssignment(entry.id);
      if (cfg && (cfg.kind === "image" || cfg.poster)) {
        const thumb = document.createElement("img");
        thumb.className = "me-slide-thumb";
        thumb.alt = "";
        thumb.src = mediaAssetURL(cfg.kind === "image" ? cfg.src : cfg.poster);
        button.append(thumb);
      } else {
        const icon = document.createElement("span");
        icon.className = "me-slide-thumb me-slide-icon";
        icon.textContent = cfg
          ? "▶"
          : String(entry.index + 1).padStart(2, "0");
        button.append(icon);
      }
      const text = document.createElement("span"),
        title = document.createElement("b"),
        detail = document.createElement("small");
      title.textContent = entry.title;
      detail.textContent = entry.label + (cfg ? " · " + cfg.kind : "");
      text.append(title, detail);
      button.append(text);
      button.onclick = () => mediaSelect(entry.id);
      $("me-slides").append(button);
    });
    if (!shown.length) {
      const p = document.createElement("p");
      p.className = "me-empty";
      p.textContent = "No matching slides.";
      $("me-slides").append(p);
    }
  }
  function mediaResizePreview() {
    if (mediaPreviewNode) {
      mediaPreviewNode.style.transform =
        "scale(" + $("me-preview").clientWidth / 1920 + ")";
    }
  }
  function mediaPreview() {
    const entry = mediaGetEntry();
    if (!entry) return;
    mediaPreviewNode?.querySelectorAll("video").forEach((v) => v.pause());
    $("me-preview").replaceChildren();
    const root = document.createElement("div");
    root.className = "me-preview-stage";
    for (const selector of [".grid", ".orb", "header"]) {
      const e = $("stage").querySelector(":scope > " + selector);
      if (e) root.append(e.cloneNode(true));
    }
    const clone = entry.slide.cloneNode(true);
    clone.classList.add("active");
    clone.inert = false;
    clone.setAttribute("aria-hidden", "false");
    clone.removeAttribute("style");
    const cfg = mediaGetAssignment(entry.id);
    if (cfg)
      clone.style.setProperty(
        "--media-share",
        cfg.ratio === "media" ? "62%" : cfg.ratio === "text" ? "38%" : "50%",
      );
    root.append(clone);
    const footer = $("stage").querySelector(":scope > footer").cloneNode(true);
    footer.querySelector(".meta").firstElementChild.textContent =
      entry.label + " · Preview";
    footer.querySelector(".meta").lastElementChild.textContent = String(
      entry.index + 1,
    );
    root.append(footer);
    root.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    root.querySelectorAll("video").forEach((v) => {
      v.autoplay = false;
      v.muted = true;
      v.controls = false;
      v.pause();
    });
    root.querySelectorAll("button,a,select,input").forEach((e) => {
      e.tabIndex = -1;
    });
    const brand = root.querySelector(".brand");
    const logo = brand.querySelector(".project-logo")?.cloneNode(true);
    brand.textContent = entry.group.startsWith("rem")
      ? "PRESENTATION / WORKSHOP"
      : entry.group === "overview"
        ? "PRESENTATION / OVERVIEW"
        : "PRESENTATION / PRESENTATION";
    if (logo) brand.prepend(logo);
    root.inert = true;
    $("me-preview").append(root);
    mediaPreviewNode = root;
    $("me-play-preview").hidden = cfg?.kind !== "video";
    $("me-play-preview").textContent = "Preview clip (muted)";
    mediaResizePreview();
  }
  const mediaControlMap = {
    layout: "me-layout",
    ratio: "me-ratio",
    fit: "me-fit",
    position: "me-position",
    frame: "me-frame",
    corner: "me-corner",
    caption: "me-caption",
    captionPlace: "me-caption-place",
    alt: "me-alt",
    overlay: "me-overlay",
    autoplay: "me-autoplay",
    muted: "me-muted",
    loop: "me-loop",
    advance: "me-advance",
  };
  function mediaSelect(id) {
    mediaSelected = id;
    const entry = mediaGetEntry(),
      cfg = mediaGetAssignment() || mediaDefaults;
    $("me-slide-title").textContent = entry.title;
    $("me-slide-id").textContent = entry.label + " · ID " + entry.id;
    for (const [key, input] of Object.entries(mediaControlMap)) {
      if (["autoplay", "muted", "loop"].includes(key))
        $(input).checked = !!cfg[key];
      else $(input).value = cfg[key] ?? mediaDefaults[key];
    }
    $("me-file-info").textContent = cfg.src
      ? cfg.name + " · " + cfg.kind
      : "No media attached to this slide.";
    $("me-poster-info").textContent = cfg.poster
      ? "Poster: " + (cfg.posterName || cfg.poster)
      : "No poster image";
    $("me-video-settings").hidden = cfg.kind !== "video";
    $("me-remove").disabled = !cfg.src;
    $("me-loop").disabled = cfg.advance === "ended";
    $("me-overlay-value").textContent = (cfg.overlay ?? 55) + "%";
    mediaList();
    mediaPreview();
    mediaState();
  }
  function mediaReadControls() {
    const cfg = mediaGetAssignment();
    if (!cfg) return;
    for (const [key, id] of Object.entries(mediaControlMap)) {
      if (["autoplay", "muted", "loop"].includes(key)) cfg[key] = $(id).checked;
      else cfg[key] = key === "overlay" ? Number($(id).value) : $(id).value;
    }
    if (cfg.advance === "ended") cfg.loop = false;
    mediaApply(mediaGetEntry().slide);
    mediaMark();
    $("me-loop").checked = cfg.loop;
    $("me-loop").disabled = cfg.advance === "ended";
    $("me-overlay-value").textContent = cfg.overlay + "%";
    mediaPreview();
  }
  function mediaFilename(name) {
    return (
      name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/^\.+/, "")
        .slice(-100) || "media.bin"
    );
  }
  async function mediaChooseFile(file, poster = false) {
    if (!file) return;
    const isImage = file.type.startsWith("image/"),
      isVideo = file.type.startsWith("video/");
    if ((poster && !isImage) || (!poster && !isImage && !isVideo)) {
      mediaMessage("Choose an image or supported video file.");
      return;
    }
    const path =
      "assets/" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7) +
      "-" +
      mediaFilename(file.name);
    mediaRemember(path, file);
    const old = mediaGetAssignment();
    if (poster) {
      if (!old || old.kind !== "video") {
        mediaMessage("Attach a video before choosing its poster.");
        return;
      }
      old.poster = path;
      old.posterName = file.name;
    } else {
      const next = {
        ...mediaDefaults,
        ...old,
        src: path,
        name: file.name,
        kind: isVideo ? "video" : "image",
        alt: old?.alt || file.name,
        size: file.size,
      };
      if (next.kind === "image") {
        delete next.poster;
        delete next.posterName;
      }
      mediaConfig.slides[mediaSelected] = next;
    }
    mediaApply(mediaGetEntry().slide);
    mediaMark();
    mediaSelect(mediaSelected);
    mediaMessage(
      "Preview updated. Export a presentation ZIP to save these changes.",
    );
  }
  function mediaOpen() {
    if (document.body.classList.contains("obs")) return;
    setPlaying(false);
    mediaPauseAll();
    const current = slides[index];
    mediaSelected = current?.dataset.mediaId || mediaSelected;
    $("me-search").value = "";
    $("me-section").value = "all";
    $("media-editor").showModal();
    mediaSelect(mediaSelected);
  }
  function mediaClose() {
    $("media-editor").close();
    mediaPreviewNode?.querySelectorAll("video").forEach((v) => v.pause());
    $("me-preview").replaceChildren();
    mediaPreviewNode = null;
    mediaOnRender();
    activity();
  }
  function mediaDownload(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function mediaConfigText() {
    return JSON.stringify(mediaConfig, null, 2);
  }
  function mediaValidate(raw) {
    if (
      !raw ||
      raw.schemaVersion !== 1 ||
      !raw.slides ||
      Array.isArray(raw.slides) ||
      typeof raw.slides !== "object"
    )
      throw new Error("This is not a supported presentation configuration.");
    const clean = { schemaVersion: 1, slides: {} };
    for (const [id, item] of Object.entries(raw.slides)) {
      if (
        !/^[a-z0-9-]+$/i.test(id) ||
        !item ||
        !["image", "video"].includes(item.kind) ||
        !mediaSafePath(item.src)
      )
        throw new Error("Invalid media assignment.");
      if (item.poster && !mediaSafePath(item.poster))
        throw new Error("Invalid poster path.");
      const cfg = {
        ...mediaDefaults,
        src: item.src,
        kind: item.kind,
        name: String(item.name || item.src).slice(0, 300),
      };
      const enums = {
        layout: ["right", "left", "below", "full", "background", "inset"],
        ratio: ["equal", "media", "text"],
        fit: ["contain", "cover"],
        position: [
          "center",
          "top",
          "bottom",
          "left",
          "right",
          "left top",
          "right top",
          "left bottom",
          "right bottom",
        ],
        frame: ["none", "border", "browser"],
        corner: ["right bottom", "left bottom", "right top", "left top"],
        captionPlace: ["below", "overlay"],
        advance: ["fixed", "ended", "manual"],
      };
      for (const [key, values] of Object.entries(enums))
        if (values.includes(item[key])) cfg[key] = item[key];
      for (const key of ["caption", "alt", "posterName"])
        if (typeof item[key] === "string") cfg[key] = item[key].slice(0, 3000);
      for (const key of ["autoplay", "muted", "loop"])
        if (typeof item[key] === "boolean") cfg[key] = item[key];
      cfg.overlay = Math.max(0, Math.min(90, Number(item.overlay) || 0));
      if (item.poster) cfg.poster = item.poster;
      if (cfg.advance === "ended") cfg.loop = false;
      clean.slides[id] = cfg;
    }
    return clean;
  }
  function mediaReferenced(config = mediaConfig) {
    const paths = new Set();
    for (const cfg of Object.values(config.slides)) {
      paths.add(cfg.src);
      if (cfg.poster) paths.add(cfg.poster);
    }
    return paths;
  }
  async function mediaImport(file) {
    if (!file) return;
    mediaMessage("Reading " + file.name + "…");
    try {
      let next,
        newAssets = new Map();
      if (file.name.toLowerCase().endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file),
          configFile = zip.file("presentation.json");
        if (!configFile)
          throw new Error(
            "The ZIP must contain presentation.json at its root.",
          );
        next = mediaValidate(JSON.parse(await configFile.async("string")));
        for (const path of mediaReferenced(next)) {
          const entry = zip.file(path);
          if (!entry) throw new Error("The ZIP is missing " + path);
          const ext = path.split(".").pop().toLowerCase(),
            mime =
              {
                mp4: "video/mp4",
                webm: "video/webm",
                ogg: "video/ogg",
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                webp: "image/webp",
                gif: "image/gif",
                svg: "image/svg+xml",
                avif: "image/avif",
              }[ext] || "application/octet-stream";
          newAssets.set(
            path,
            new Blob([await entry.async("uint8array")], { type: mime }),
          );
        }
      } else next = mediaValidate(JSON.parse(await file.text()));
      mediaPauseAll();
      for (const [path, blob] of newAssets) mediaRemember(path, blob);
      mediaConfig = next;
      mediaApplyAll();
      mediaMark();
      mediaSelect(mediaSelected);
      const unknown = Object.keys(next.slides).filter(
          (id) => !mediaEntries.some((e) => e.id === id),
        ).length,
        missing = [...mediaReferenced()].filter(
          (path) => !mediaBlobs.has(path),
        ).length;
      mediaMessage(
        "Imported " +
          Object.keys(next.slides).length +
          " assignments." +
          (unknown
            ? " " + unknown + " refer to slides not in this presentation."
            : "") +
          (missing
            ? " Import the saved ZIP to load its media bytes before re-exporting."
            : " Ready to preview and export."),
      );
    } catch (e) {
      mediaMessage("Import failed: " + e.message);
    }
  }
  async function mediaExport() {
    if (mediaExporting) return;
    const paths = [...mediaReferenced()],
      missing = paths.filter((path) => !mediaBlobs.has(path));
    if (missing.length) {
      mediaMessage(
        "Import the saved presentation ZIP before re-exporting, or reattach missing media. " +
          missing.length +
          " asset(s) are not loaded into the editor.",
      );
      return;
    }
    mediaExporting = true;
    mediaState();
    mediaMessage("Building presentation package…");
    try {
      const safeJSON = mediaConfigText().replace(/</g, "\\u003c");
      const configPattern =
        /<script\b(?=[^>]*\bid=["']media-config["'])[^>]*>[\s\S]*?<\/script>/i;
      const output = sourceTemplate.replace(
        configPattern,
        () =>
          '<script id="media-config" type="application/json">' +
          safeJSON +
          "<\/script>",
      );
      const zip = new JSZip();
      zip.file("index.html", output);
      zip.file("presentation.json", mediaConfigText());
      for (const path of paths) zip.file(path, mediaBlobs.get(path));
      zip.file(
        "README.txt",
        "Presentation Studio presentation\n\nUnzip the entire package, then open index.html in a modern browser. Keep the assets folder beside index.html. No server is required.\n\nFor OBS: Browser Source > Local File > index.html, width 1920, height 1080.\n\nMedia editing: click Edit Media or press E. To re-edit a saved package and export it again, import this ZIP in the editor so all media bytes are available. Export configuration saves settings only; the presentation ZIP includes media.\n\nKiosk URLs: ?kiosk=1, ?loop=loop-id. For a hosted OBS source, add obs=1 to hide controls. Use & between multiple parameters.\n\nChanges made in the editor stay in memory until exported. Screenshots and videos included in this package are distributed with it.\n",
      );
      const blob = await zip.generateAsync(
        { type: "blob", compression: "STORE" },
        (p) =>
          mediaMessage("Building package · " + Math.round(p.percent) + "%"),
      );
      mediaDownload(blob, "presentation.zip");
      mediaSaved = mediaClone(mediaConfig.slides);
      mediaDirty = false;
      mediaState();
      mediaMessage(
        "ZIP export created. Keep the downloaded ZIP, then unzip it before playback.",
      );
    } catch (e) {
      mediaMessage("Export failed: " + e.message);
    } finally {
      mediaExporting = false;
      mediaState();
    }
  }
  for (const [group, label] of mediaGroups) {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = label;
    $("me-section").append(option);
  }
  for (const id of Object.values(mediaControlMap))
    $(id).addEventListener("input", mediaReadControls);
  $("me-play-preview").onclick = () => {
    const v = mediaPreviewNode?.querySelector("video");
    if (!v) return;
    if (v.paused) {
      v.play()
        .then(() => {
          $("me-play-preview").textContent = "Pause preview";
        })
        .catch(() =>
          mediaMessage(
            "This clip could not play. Try MP4 or WebM, or choose a poster image.",
          ),
        );
    } else {
      v.pause();
      $("me-play-preview").textContent = "Preview clip (muted)";
    }
  };
  $("edit-media").onclick = mediaOpen;
  $("me-close").onclick = mediaClose;
  $("media-editor").addEventListener("cancel", (e) => {
    e.preventDefault();
    mediaClose();
  });
  $("media-editor").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      mediaClose();
    }
  });
  $("me-search").oninput = mediaList;
  $("me-section").onchange = mediaList;
  $("me-drop").onclick = () => $("me-file").click();
  $("me-drop").onkeydown = (e) => {
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      $("me-file").click();
    }
  };
  for (const name of ["dragover", "dragenter"])
    $("me-drop").addEventListener(name, (e) => {
      e.preventDefault();
      $("me-drop").classList.add("drag");
    });
  for (const name of ["dragleave", "drop"])
    $("me-drop").addEventListener(name, (e) => {
      e.preventDefault();
      $("me-drop").classList.remove("drag");
    });
  $("me-drop").addEventListener("drop", (e) =>
    mediaChooseFile(e.dataTransfer.files[0]),
  );
  $("me-file").onchange = (e) => {
    mediaChooseFile(e.target.files[0]);
    e.target.value = "";
  };
  $("me-poster-choose").onclick = () => $("me-poster").click();
  $("me-poster").onchange = (e) => {
    mediaChooseFile(e.target.files[0], true);
    e.target.value = "";
  };
  $("me-poster-remove").onclick = () => {
    const cfg = mediaGetAssignment();
    if (cfg) {
      delete cfg.poster;
      delete cfg.posterName;
      mediaApply(mediaGetEntry().slide);
      mediaMark();
      mediaSelect(mediaSelected);
    }
  };
  $("me-remove").onclick = () => {
    delete mediaConfig.slides[mediaSelected];
    mediaApply(mediaGetEntry().slide);
    mediaMark();
    mediaSelect(mediaSelected);
  };
  $("me-revert").onclick = () => {
    if (mediaSaved[mediaSelected])
      mediaConfig.slides[mediaSelected] = mediaClone(mediaSaved[mediaSelected]);
    else delete mediaConfig.slides[mediaSelected];
    mediaApply(mediaGetEntry().slide);
    mediaMark();
    mediaSelect(mediaSelected);
    mediaMessage(
      "Slide reverted to its last exported or initial configuration.",
    );
  };
  $("me-show-slide").onclick = () => {
    const entry = mediaGetEntry();
    switchDeck(entry.group, false);
    show(entry.index);
    setPlaying(false);
    mediaClose();
  };
  $("me-import").onclick = () => $("me-import-file").click();
  $("me-import-file").onchange = (e) => {
    mediaImport(e.target.files[0]);
    e.target.value = "";
  };
  $("me-json").onclick = () => {
    mediaDownload(
      new Blob([mediaConfigText()], { type: "application/json" }),
      "presentation.json",
    );
    mediaMessage(
      "Configuration exported. It contains settings, not media files; export a ZIP to save the complete presentation.",
    );
  };
  $("me-export").onclick = mediaExport;
  new ResizeObserver(mediaResizePreview).observe($("me-preview"));
  window.addEventListener("beforeunload", (e) => {
    if (mediaDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
