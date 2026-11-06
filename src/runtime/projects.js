// Shared project picker, compact navigation, and transactional browser drafts.
const hubContent = (pack) =>
  JSON.stringify({
    state: pack.state,
    checkpoints: pack.checkpoints,
    history: pack.history,
  });
let hubRecords = [],
  hubSaveState = "opened",
  hubSavedAt = "",
  hubSwitchAction = null,
  hubWorking = false,
  hubSaving = null;
function hubMenusClose() {
  for (const d of document.querySelectorAll(".hub-menu[open]")) d.open = false;
}
function hubMessage(text) {
  $("hub-message").textContent = text;
}
function hubStatus() {
  if (!projectReady) return;
  $("fe-title").textContent = projectMeta.name;
  $("fe-title").title = projectMeta.name;
  const status = projectDraftPending
    ? "Recovery draft available"
    : {
        opened: "Opened project · export a ZIP for a backup",
        pending: "Changes pending · saving locally…",
        saving: "Saving locally…",
        saved:
          "Saved locally" +
          (hubSavedAt
            ? " · " + new Date(hubSavedAt).toLocaleTimeString()
            : "") +
          (mediaDirty ? " · ZIP backup not updated" : ""),
        failed: "Local save failed · export a backup",
        unavailable: "Local storage unavailable · export a backup",
      }[hubSaveState];
  $("fe-status").textContent = status || "Project ready";
  $("fe-status").dataset.saveState = hubSaveState;
  $("open-full-editor").textContent = "Edit";
  $("open-full-editor").title = projectDraftPending ? "Review draft recovery (J)" : "Edit presentation (J)";
}
const hubOldStatus = projectStatus;
projectStatus = function () {
  hubOldStatus();
  hubStatus();
};
const hubOldSchedule = projectScheduleDraft;
projectScheduleDraft = function () {
  hubSaveState = "pending";
  hubStatus();
  return hubOldSchedule();
};
async function hubDatabase() {
  if (!projectDB) projectDB = await projectOpenDB();
  return projectDB;
}
async function hubPersist(pack, assets, savedAt = new Date().toISOString()) {
  const refs = [...projectReferenced(pack)],
    missing = refs.filter((path) => !assets.has(path));
  if (missing.length)
    throw new Error(
      "Some media or recovery assets are not loaded. Import the complete editable ZIP before saving or switching.",
    );
  const db = await hubDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["projects", "assets"], "readwrite");
    tx.objectStore("projects").put({ pack, savedAt }, pack.meta.id);
    for (const path of refs)
      tx.objectStore("assets").put(assets.get(path), pack.meta.id + "|" + path);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Local save was interrupted."));
  });
  return savedAt;
}
projectSaveDraft = async function () {
  if (!projectReady || projectPlayback || projectDraftPending) return false;
  projectFlush();
  clearTimeout(projectDraftTimer);
  const pack = projectPack(),
    assets = new Map(mediaBlobs),
    stateText = hubContent(pack);
  hubSaveState = "saving";
  hubStatus();
  // Serial writes prevent an older background save from overwriting a switch-time save.
  const previous = hubSaving;
  const operation = (async () => {
    if (previous) await previous;
    try {
      const savedAt = await hubPersist(pack, assets);
      if (projectMeta.id === pack.meta.id) {
        hubSavedAt = savedAt;
        hubSaveState =
          hubContent(projectPack()) === stateText ? "saved" : "pending";
        $("fe-draft-status").textContent =
          "Browser draft saved " +
          new Date(savedAt).toLocaleTimeString() +
          ". Export an editable ZIP for a portable backup.";
        hubStatus();
      }
      return true;
    } catch (e) {
      if (projectMeta.id === pack.meta.id) {
        hubSaveState = "failed";
        hubStatus();
        $("fe-draft-status").textContent = "Browser save failed: " + e.message;
      }
      projectMessage("Local save failed: " + e.message);
      return false;
    }
  })();
  hubSaving = operation;
  return operation;
};
const hubAccept = projectAcceptPack;
projectAcceptPack = function (pack) {
  hubSaveState = "opened";
  hubSavedAt = "";
  return hubAccept(pack);
};
async function hubAllRecords() {
  const db = await hubDatabase();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("projects", "readonly")
      .objectStore("projects")
      .getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function hubReadAssets(pack) {
  await hubDatabase();
  const assets = new Map();
  for (const path of projectReferenced(pack)) {
    const blob = await projectDBGet("assets", pack.meta.id + "|" + path);
    if (!blob)
      throw new Error(
        "This draft is missing media. Open its complete editable ZIP instead.",
      );
    assets.set(path, blob);
  }
  return assets;
}
async function hubReadRecord(record) {
  const pack = projectValidatePack(record.pack);
  if (pack.playbackOnly)
    throw new Error(
      "Open the editable project instead of a playback-only export.",
    );
  return { pack, assets: await hubReadAssets(pack) };
}
function hubClosePicker() {
  $("hub-picker").close();
  activity();
}
async function hubRefresh() {
  try {
    const records = await hubAllRecords();
    let skipped = 0;
    hubRecords = records
      .flatMap((record) => {
        try {
          const pack = projectValidatePack(record.pack);
          return pack.playbackOnly ? [] : [{ ...record, pack }];
        } catch {
          skipped++;
          return [];
        }
      })
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    hubRenderList();
    hubMessage(
      (hubRecords.length
        ? "Saved in this browser · " + hubRecords.length + " presentation(s)."
        : "No saved projects yet. Edit a presentation to create its local draft, or open an editable ZIP.") +
        (skipped
          ? " " + skipped + " unreadable draft(s) were left untouched."
          : ""),
    );
  } catch (e) {
    hubRecords = [];
    hubRenderList();
    hubMessage(
      "Recent projects unavailable: " +
        e.message +
        ". You can still keep exported ZIP backups.",
    );
  }
  $("hub-review-recovery").hidden = !projectDraftPending;
}
function hubRenderList() {
  const list = $("hub-project-list"),
    query = $("hub-search").value.trim().toLowerCase();
  list.replaceChildren();
  const records = hubRecords.filter((r) =>
    String(r.pack.meta.name).toLowerCase().includes(query),
  );
  for (const record of records) {
    const pack = record.pack,
      current = pack.meta.id === projectMeta.id,
      card = document.createElement("article");
    card.className = "hub-project-card";
    card.dataset.projectId = pack.meta.id;
    const thumb = document.createElement("div");
    thumb.className = "hub-project-thumb";
    thumb.setAttribute("aria-hidden", "true");
    const brand = pack.state.brand || {},
      accent = nxColor(brand.accent, "#0066ff");
    thumb.style.setProperty("--hub-accent", accent);
    thumb.style.background = nxColor(brand.background, "#f4f6f8");
    thumb.style.color = nxColor(brand.ink, "#101c2f");
    const miniHeader = document.createElement("small"),
      miniTitle = document.createElement("strong");
    miniHeader.textContent = brand.headerTitle || "PRESENTATION";
    miniTitle.textContent =
      pack.state.slides?.find((s) => !s.hidden)?.title || pack.meta.name;
    thumb.append(miniHeader, miniTitle);
    const content = document.createElement("div"),
      title = document.createElement("h3"),
      meta = document.createElement("p"),
      actions = document.createElement("div");
    actions.className = "hub-card-actions";
    title.textContent = pack.meta.name + (current ? " · Current" : "");
    meta.textContent =
      "Browser draft · " +
      (pack.state.slides?.length || 0) +
      " slides · saved " +
      (Number.isNaN(Date.parse(record.savedAt))
        ? "at an unknown time"
        : new Date(record.savedAt).toLocaleString());
    const add = (label, handler, disabled = false) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.disabled = disabled || hubWorking;
      b.onclick = handler;
      actions.append(b);
    };
    add(
      current ? "Current presentation" : "Open",
      () => hubOpenRecord(record),
      current,
    );
    add("Export backup", () => hubRecordExport(record));
    add("Duplicate", () => hubDuplicate(record));
    add("Remove local copy", () => hubRemove(record), current);
    content.append(title, meta, actions);
    card.append(thumb, content);
    list.append(card);
  }
  if (!records.length) {
    const p = document.createElement("p");
    p.className = "hub-empty";
    p.textContent = query
      ? "No recent presentations match your search."
      : "Your saved browser drafts will appear here.";
    list.append(p);
  }
}
function hubError(e) {
  const message = e?.message || String(e);
  hubMessage(message);
  projectMessage(message);
}
async function hubOpenPicker() {
  if (projectPlayback || document.body.classList.contains("obs")) return;
  projectFlush();
  nxCancelTransition();
  setPlaying(false);
  mediaPauseAll();
  hubMenusClose();
  $("hub-search").value = "";
  hubMessage("Loading recent projects…");
  $("hub-picker").showModal();
  await hubRefresh();
}
function hubSetWorking(value) {
  hubWorking = value;
  for (const id of [
    "hub-export-switch",
    "hub-save-switch",
    "hub-cancel-switch",
    "hub-open-file",
    "hub-new",
    "hub-refresh",
  ])
    $(id).disabled = value;
}
async function hubGuard(action) {
  projectFlush();
  if (projectDraftPending) {
    hubMessage(
      "Recover or discard the current recovery draft before switching projects.",
    );
    $("hub-review-recovery").hidden = false;
    return;
  }
  if (mediaDirty) {
    hubSwitchAction = action;
    $("hub-switch-text").textContent =
      "Save “" +
      projectMeta.name +
      "” before opening another presentation. Saving locally keeps this project in the recent list.";
    $("hub-switch-message").textContent = "";
    $("hub-switch").showModal();
    return;
  }
  await hubRunSwitch(action, false);
}
async function hubRunSwitch(action, exportFirst) {
  if (hubWorking) return;
  hubSetWorking(true);
  try {
    if (exportFirst) {
      await hubExportPack(projectPack(), new Map(mediaBlobs));
      mediaDirty = false;
      mediaSaved = projectCopy(projectState.media);
      projectStatus();
    }
    if (!(await projectSaveDraft()))
      throw new Error(
        "The current project could not be saved locally. It remains open. Check the save status, or export a backup.",
      );
    $("hub-switch").close();
    hubSwitchAction = null;
    await action();
    hubClosePicker();
  } catch (e) {
    if ($("hub-switch").open) $("hub-switch-message").textContent = e.message;
    else hubError(e);
  } finally {
    hubSetWorking(false);
  }
}
async function hubOpenRecord(record) {
  if (hubWorking) return;
  try {
    const loaded = await hubReadRecord(record);
    await hubGuard(async () => {
      clearTimeout(projectDraftTimer);
      for (const [path, blob] of loaded.assets) mediaRemember(path, blob);
      projectDraftPending = null;
      projectAcceptPack(loaded.pack);
      hubSaveState = "saved";
      hubSavedAt = record.savedAt;
      projectStatus();
      projectRecoveryBanner();
      if ($("full-editor").open) {
        projectList();
        projectForm();
        projectPreview();
      }
      projectMessage("Opened browser draft: " + projectMeta.name);
      setPlaying(false);
    });
  } catch (e) {
    hubError(e);
  }
}
function hubMime(path) {
  return (
    {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      svg: "image/svg+xml",
      gif: "image/gif",
      avif: "image/avif",
      mp4: "video/mp4",
      webm: "video/webm",
      ogg: "video/ogg",
    }[path.split(".").pop().toLowerCase()] || "application/octet-stream"
  );
}
async function hubChooseFile(file) {
  if (!file || hubWorking) return;
  try {
    hubMessage("Reading " + file.name + "…");
    let raw, zip;
    if (file.name.toLowerCase().endsWith(".zip")) {
      zip = await JSZip.loadAsync(file);
      const config = zip.file("presentation.json");
      if (!config)
        throw new Error(
          "This ZIP does not contain presentation.json. Choose an editable project ZIP.",
        );
      raw = JSON.parse(await config.async("string"));
    } else raw = JSON.parse(await file.text());
    const pack = projectValidatePack(raw);
    if (pack.playbackOnly)
      throw new Error(
        "This is a playback-only export. Choose the editable project ZIP.",
      );
    const assets = new Map();
    for (const path of projectReferenced(pack)) {
      const entry = zip?.file(path);
      if (entry)
        assets.set(
          path,
          new Blob([await entry.async("uint8array")], { type: hubMime(path) }),
        );
      else if (!zip) {
        await hubDatabase();
        const blob = await projectDBGet("assets", pack.meta.id + "|" + path);
        if (blob) assets.set(path, blob);
      }
      if (!assets.has(path))
        throw new Error(
          "Media is missing from this file. Open the complete editable ZIP; JSON alone does not include media bytes.",
        );
    }
    await hubGuard(async () => {
      // Commit the incoming project before replacing the active state.
      const priorName = await hubKeepPriorVersion(pack);
      await hubPersist(pack, assets);
      for (const [path, blob] of assets) mediaRemember(path, blob);
      projectDraftPending = null;
      projectAcceptPack(pack);
      hubSaveState = "saved";
      hubSavedAt = new Date().toISOString();
      projectStatus();
      projectRecoveryBanner();
      if ($("full-editor").open) {
        projectList();
        projectForm();
        projectPreview();
      }
      projectMessage(
        "Opened " +
          pack.meta.name +
          ". A browser draft is available in Presentations." +
          (priorName ? " Previous content kept as “" + priorName + "”." : ""),
      );
    });
  } catch (e) {
    hubError(e);
  }
}
async function hubExportPack(pack, assets) {
  const refs = [...projectReferenced(pack)];
  if (refs.some((path) => !assets.has(path)))
    throw new Error(
      "Load the complete editable project ZIP before exporting its media.",
    );
  const json = JSON.stringify(pack, null, 2),
    escaped = json.replace(/</g, "\\u003c"),
    config = JSON.stringify({
      schemaVersion: 1,
      slides: pack.state.media,
    }).replace(/</g, "\\u003c");
  const output = sourceTemplate
    .replace(
      /<script\b(?=[^>]*\bid=["']project-config["'])[^>]*>[\s\S]*?<\/script>/i,
      () =>
        '<script id="project-config" type="application/json">' +
        escaped +
        "<\/script>",
    )
    .replace(
      /<script\b(?=[^>]*\bid=["']media-config["'])[^>]*>[\s\S]*?<\/script>/i,
      () =>
        '<script id="media-config" type="application/json">' +
        config +
        "<\/script>",
    );
  const zip = new JSZip();
  zip.file("index.html", output, { compression: "DEFLATE" });
  zip.file("presentation.json", json, { compression: "DEFLATE" });
  for (const path of refs) zip.file(path, assets.get(path));
  zip.file(
    "README.txt",
    "Editable Presentation Studio project. Unzip the entire package, keep assets beside index.html, and open index.html. Browser drafts are recovery copies; this ZIP is a portable backup.",
  );
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  mediaDownload(
    blob,
    (mediaFilename(pack.meta.name).replace(/\.+$/, "") || "presentation") +
      "-editable.zip",
  );
}
async function hubRecordExport(record) {
  if (hubWorking) return;
  try {
    const { pack, assets } = await hubReadRecord(record);
    await hubExportPack(pack, assets);
    hubMessage("Editable backup download started for " + pack.meta.name + ".");
  } catch (e) {
    hubError(e);
  }
}
async function hubDuplicate(record) {
  if (hubWorking) return;
  try {
    const { pack, assets } = await hubReadRecord(record);
    pack.meta.id = projectID("project");
    pack.meta.name = (pack.meta.name + " copy").slice(0, 200);
    pack.meta.updatedAt = new Date().toISOString();
    pack.state.projectName = pack.meta.name;
    await hubPersist(pack, assets);
    await hubRefresh();
    hubMessage(
      "Created " + pack.meta.name + " with an independent project ID.",
    );
  } catch (e) {
    hubError(e);
  }
}
function hubRemove(record) {
  if (hubWorking) return;
  if (record.pack.meta.id === projectMeta.id) return;
  projectConfirm(
    "Remove local copy?",
    "Remove “" +
      record.pack.meta.name +
      "” and its media from this browser? This cannot be undone here. Export a backup first. Downloaded ZIPs and other projects are not deleted.",
    async () => {
      try {
        const db = await hubDatabase(),
          id = record.pack.meta.id,
          prefix = id + "|";
        await new Promise((resolve, reject) => {
          const tx = db.transaction(["projects", "assets"], "readwrite");
          tx.objectStore("projects").delete(id);
          const cursor = tx
            .objectStore("assets")
            .openCursor(IDBKeyRange.bound(prefix, prefix + "\uffff"));
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (c) {
              c.delete();
              c.continue();
            }
          };
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
        await hubRefresh();
        hubMessage(
          "Removed the browser copy. Exported ZIP files are unchanged.",
        );
      } catch (e) {
        hubError(e);
      }
    },
  );
}
async function hubKeepPriorVersion(pack) {
  const previous = await projectDBGet("projects", pack.meta.id);
  if (!previous?.pack) return "";
  const old = projectValidatePack(previous.pack);
  const content = (p) =>
    JSON.stringify({
      state: p.state,
      checkpoints: p.checkpoints,
      history: p.history,
    });
  if (content(old) === content(pack)) return "";
  const assets = await hubReadAssets(old);
  old.meta.id = projectID("project");
  old.meta.name = (old.meta.name + " (previous local version)").slice(0, 200);
  old.state.projectName = old.meta.name;
  old.meta.updatedAt = new Date().toISOString();
  await hubPersist(old, assets);
  return old.meta.name;
}
function hubMount() {
  const controls = $("controls"),
    more = $("hub-player-more").querySelector(".hub-menu-items"),
    compat = $("hub-compat");
  for (const id of ["kiosk", "notes", "info", "detection"]) more.append($(id));
  for (const id of [
    "qa",
    "steps",
    "edit-media",
    "nx-setup-open",
    "fe-new-template",
    "fe-add",
  ])
    compat.append($(id));
  $("open-full-editor").textContent = "Edit";
  $("info").textContent = "Help";
  for (const id of [
    "hub-presentations",
    "prev",
    "play",
    "next",
    "menu",
    "full",
    "browse-questions",
    "open-full-editor",
    "hub-player-more",
  ])
    controls.append($(id));
  const projectMenu = $("hub-project-menu").querySelector(
      ":scope > .hub-menu-items",
    ),
    exportMenu = $("hub-export-menu").querySelector(".hub-menu-items");
  $("studio-new-open").textContent = "New presentation";
  $("fe-import").textContent = "Open file…";
  for (const id of ["fe-export", "fe-playback", "fe-export-json"])
    exportMenu.append($(id));
  $("fe-export").textContent = "Editable ZIP · recommended";
  $("fe-playback").textContent = "Playback ZIP";
  $("fe-export-json").textContent = "Project JSON · no media";
  for (const id of [
    "studio-new-open",
    "fe-import",
    "hub-editor-projects",
    "hub-export-menu",
    "hub-recovery",
  ])
    projectMenu.append($(id));
  const actions = document.querySelector(".fe-top-actions");
  $("fe-show").textContent = "Present";
  for (const id of [
    "hub-project-menu",
    "fe-undo",
    "fe-redo",
    "fe-show",
    "fe-close",
  ])
    actions.append($(id));
  $("studio-gallery-open").textContent = "Add slide";
  $("studio-gallery-open").title = "Choose a slide type in the visual gallery";
  document
    .querySelector(".fe-sidebar .fe-inline")
    .prepend($("studio-gallery-open"));
  $("fe-media").textContent = "Media";
  // Keep logo previews prominent; advanced controls and presets are expandable.
  const brandRight = $("fe-font").parentElement;
  const swatches = document.querySelector(".nx-logo-swatches"),
    heading =
      $("nx-logo-variant").previousElementSibling.previousElementSibling;
  if (heading?.tagName === "H3") heading.textContent = "Logo";
  const change = document.createElement("button");
  change.id = "hub-change-logo";
  change.textContent = "Change logo";
  change.onclick = () => $("fe-logo-file").click();
  const logoGroup = document.createElement("details");
  logoGroup.id = "hub-logo-controls";
  logoGroup.className = "hub-brand-group";
  logoGroup.innerHTML = "<summary>Logo variants, size, and placement</summary>";
  const logoStart = $("nx-logo-variant").previousElementSibling,
    presetStart = $("nx-preset-name").previousElementSibling;
  let node = logoStart;
  while (node && node !== presetStart) {
    const next = node.nextSibling;
    logoGroup.append(node);
    node = next;
  }
  swatches.remove();
  logoGroup.querySelector("#nx-logo-drop").before(swatches); // moved again below to stay visible
  brandRight.insertBefore(logoGroup, presetStart);
  brandRight.insertBefore(swatches, logoGroup);
  brandRight.insertBefore(change, logoGroup);
  const presetGroup = document.createElement("details");
  presetGroup.id = "hub-brand-presets";
  presetGroup.className = "hub-brand-group";
  presetGroup.innerHTML = "<summary>Brand presets</summary>";
  node = presetStart;
  while (node) {
    const next = node.nextSibling;
    presetGroup.append(node);
    node = next;
  }
  brandRight.append(presetGroup);
  $("nx-logo-variant").onchange = () => {
    logoGroup.open = true;
  };
  for (const d of document.querySelectorAll(".hub-menu"))
    d.addEventListener("toggle", () => {
      if (d.open) {
        for (const sibling of d.parentElement.querySelectorAll(
          ":scope > .hub-menu[open]",
        ))
          if (sibling !== d) sibling.open = false;
        activity();
      }
    });
  document.addEventListener("click", (e) => {
    const details = e.target.closest(".hub-menu");
    if (!details) hubMenusClose();
    else if (e.target.closest("button")) hubMenusClose();
  });
  document.addEventListener(
    "keydown",
    (e) => {
      if (document.body.classList.contains("mf-active")) return;
      if (e.key === "Escape" && document.querySelector(".hub-menu[open]")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const active = document.activeElement?.closest(".hub-menu");
        hubMenusClose();
        active?.querySelector("summary")?.focus();
      }
      if (
        e.key.toLowerCase() === "p" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) &&
        !e.target.isContentEditable &&
        !document.querySelector("dialog[open]:not(#full-editor)")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        hubOpenPicker();
      }
    },
    true,
  );
  $("hub-presentations").title = "Open and resume presentations (P)";
  $("hub-presentations").onclick = hubOpenPicker;
  $("hub-editor-projects").onclick = hubOpenPicker;
  $("hub-close").onclick = () => {
    if (!hubWorking) hubClosePicker();
  };
  $("hub-refresh").onclick = hubRefresh;
  $("hub-search").oninput = hubRenderList;
  $("hub-review-recovery").onclick = () => {
    hubClosePicker();
    projectOpen();
  };
  $("hub-recovery").onclick = () => {
    projectFlush();
    projectSelectTab("recovery");
    $("fe-recovery-panel").scrollIntoView({ block: "nearest" });
  };
  $("hub-new").onclick = () =>
    hubGuard(() => {
      hubClosePicker();
      nxOpenWizard();
    });
  $("studio-new-open").onclick = () => hubGuard(() => nxOpenWizard());
  $("hub-open-file").onclick = () => $("hub-file").click();
  $("fe-import").onclick = async () => {
    await hubOpenPicker();
    $("hub-file").click();
  };
  $("hub-file").onchange = (e) => {
    hubChooseFile(e.target.files[0]);
    e.target.value = "";
  };
  $("hub-drop").onclick = () => $("hub-file").click();
  $("hub-drop").onkeydown = (e) => {
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      $("hub-file").click();
    }
  };
  for (const type of ["dragover", "dragenter"])
    $("hub-drop").addEventListener(type, (e) => {
      e.preventDefault();
      $("hub-drop").classList.add("drag");
    });
  for (const type of ["drop", "dragleave"])
    $("hub-drop").addEventListener(type, (e) => {
      e.preventDefault();
      $("hub-drop").classList.remove("drag");
      if (type === "drop") hubChooseFile(e.dataTransfer.files[0]);
    });
  $("hub-export-switch").onclick = () => {
    if (hubSwitchAction) hubRunSwitch(hubSwitchAction, true);
  };
  $("hub-save-switch").onclick = () => {
    if (hubSwitchAction) hubRunSwitch(hubSwitchAction, false);
  };
  $("hub-cancel-switch").onclick = () => {
    if (!hubWorking) {
      hubSwitchAction = null;
      $("hub-switch").close();
    }
  };
  for (const id of ["hub-picker", "hub-switch"]) {
    $(id).addEventListener("cancel", (e) => {
      e.preventDefault();
      if (!hubWorking) {
        if (id === "hub-switch") hubSwitchAction = null;
        $(id).close();
      }
    });
    $(id).addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!hubWorking) {
          if (id === "hub-switch") hubSwitchAction = null;
          $(id).close();
        }
      }
    });
  }
  // Wizard and compatibility import entry points must respect the same save guard.
  const oldWizard = nxFinishWizard;
  nxFinishWizard = async function (defaults = false) {
    const choice = document.querySelector(
      'input[name="nx-start"]:checked',
    ).value;
    if (choice === "import") {
      $("nx-wizard").close();
      await hubOpenPicker();
      $("hub-file").click();
      return;
    }
    const id = projectMeta.id,
      dirty = mediaDirty;
    if (hubSaveState === "saved" && !projectDraftPending) mediaDirty = false;
    try {
      return await oldWizard(defaults);
    } finally {
      if (projectMeta.id === id && dirty) {
        mediaDirty = true;
        projectStatus();
      }
    }
  };
  hubStatus();
}
const hubInit = projectInit;
projectInit = function () {
  hubInit();
  hubMount();
};
