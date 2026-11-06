// Booth controls deter casual in-app tampering; they are not an OS security boundary.
let boothActive = false,
  boothRecord = null,
  boothInternal = false,
  boothLast = Date.now(),
  boothRestorePlaying = true;
function boothDefaults(raw = {}) {
  return {
    navigation: raw.navigation !== false,
    questions: raw.questions !== false,
    focus: raw.focus !== false,
    video: raw.video !== false,
    links: !!raw.links,
    idle: Math.round(ceClamp(raw.idle, 0, 3600, 120)),
    loop: String(raw.loop || "").slice(0, 160),
  };
}
const boothNx = nxSettings;
nxSettings = function (raw = {}) {
  return { ...boothNx(raw), booth: boothDefaults(raw.booth) };
};
function boothKey() {
  return (
    "presentation-studio-booth:" + location.pathname + ":" + projectMeta.id
  );
}
function boothOptions() {
  return (
    boothRecord?.options || boothDefaults(projectState.presentation?.booth)
  );
}
async function boothHash(password, salt) {
  if (!crypto.subtle)
    throw new Error(
      "Passphrase protection requires a secure browser context (localhost or HTTPS).",
    );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: Uint8Array.from(salt),
      iterations: 150000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits));
}
function boothEqual(a, b) {
  return (
    a.length === b.length &&
    a.reduce((value, n, i) => value | (n ^ b[i]), 0) === 0
  );
}
function boothStore(record) {
  localStorage.setItem(boothKey(), JSON.stringify(record));
  if (localStorage.getItem(boothKey()) !== JSON.stringify(record))
    throw new Error("Cannot persist booth lock in this browser.");
}
function boothNotice(text) {
  $("booth-message").textContent = text;
}
function boothApply() {
  document.body.classList.toggle("booth-active", boothActive);
  const p = boothOptions();
  document.body.classList.toggle("booth-no-focus", boothActive && !p.focus);
  document.body.classList.toggle("booth-no-video", boothActive && !p.video);
  document.body.classList.toggle("booth-no-nav", boothActive && !p.navigation);
  document.body.classList.toggle(
    "booth-no-questions",
    boothActive && !p.questions,
  );
  $("booth-unlock").hidden = !boothActive;
  $("booth-indicator").hidden = !boothActive;
  $("booth-audience-questions").hidden = !boothActive || !p.questions;
  $("booth-return").hidden = !boothActive;
  for (const v of document.querySelectorAll("#stage video"))
    v.controls = !boothActive || p.video;
}
function boothHome() {
  const p = boothOptions();
  if (mfState) mfAbort();
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  mediaPauseAll();
  const target =
    p.loop && decks[p.loop]?.length
      ? p.loop
      : projectLoopDefaults.find((key) => decks[key]?.length) ||
        Object.keys(decks).find((key) => decks[key]?.length);
  if (target) switchDeck(target, false);
  show(0);
  setPlaying(true);
  boothLast = Date.now();
}
function boothLock(record, persist = true) {
  if (persist) boothStore(record);
  boothRecord = record;
  boothActive = true;
  boothInternal = true;
  try {
    if (mfState) mfAbort();
    vbEnd(false);
    projectFlush();
    if ($("full-editor").open) projectClose();
    if ($("media-editor").open) mediaClose();
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    hubMenusClose();
    $("presenter-notes").hidden = true;
    $("help").classList.remove("open");
    boothApply();
    boothHome();
  } finally {
    boothInternal = false;
  }
}
async function boothStart() {
  try {
    const password = $("booth-password").value;
    if (password.length < 8)
      throw new Error("Use a presenter passphrase of at least 8 characters.");
    if (password !== $("booth-confirm").value)
      throw new Error("The passphrases do not match.");
    if (!decks[$("booth-loop").value]?.length)
      throw new Error("Choose a loop with visible slides.");
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))),
      hash = await boothHash(password, salt),
      options = boothReadOptions();
    projectChange(() => {
      projectState.presentation = nxSettings({
        ...projectState.presentation,
        booth: options,
      });
    });
    if (!(await projectSaveDraft()))
      throw new Error(
        "Save the complete project locally before starting booth mode.",
      );
    const record = { version: 1, salt, hash, options, locked: true };
    boothRestorePlaying = playing;
    boothLock(record);
    $("booth-password").value = "";
    $("booth-confirm").value = "";
  } catch (e) {
    boothNotice(e.message);
  }
}
async function boothUnlock() {
  try {
    const hash = await boothHash(
      $("booth-unlock-password").value,
      boothRecord.salt,
    );
    $("booth-unlock-password").value = "";
    if (!boothEqual(hash, boothRecord.hash)) {
      boothNotice("Incorrect presenter passphrase.");
      return;
    }
    localStorage.removeItem(boothKey());
    boothActive = false;
    boothRecord = null;
    $("booth-dialog").close();
    boothApply();
    setPlaying(false);
  } catch (e) {
    boothNotice("Could not unlock: " + e.message);
  }
}
function boothReadOptions() {
  const p = {
    idle: Number($("booth-idle").value),
    loop: $("booth-loop").value,
  };
  for (const key of ["navigation", "questions", "focus", "video", "links"])
    p[key] = $("booth-" + key).checked;
  return boothDefaults(p);
}
function boothOpen(unlock = false) {
  const dialog = $("booth-dialog");
  $("booth-setup").hidden = unlock;
  $("booth-unlock-form").hidden = !unlock;
  boothNotice("");
  if (!unlock) {
    const options = boothDefaults(projectState.presentation?.booth);
    for (const key of ["navigation", "questions", "focus", "video", "links"])
      $("booth-" + key).checked = options[key];
    $("booth-idle").value = options.idle;
    const select = $("booth-loop");
    select.replaceChildren();
    for (const [id, nodes] of Object.entries(decks)) {
      if (!nodes.length) continue;
      const option = document.createElement("option");
      option.value = id;
      option.textContent =
        projectState.loops[id]?.name ||
        projectState.sections.find((s) => s.id === id)?.name ||
        id;
      select.append(option);
    }
    select.value =
      options.loop && decks[options.loop]?.length
        ? options.loop
        : Object.keys(projectState.loops).find((id) => decks[id]?.length) ||
          select.options[0]?.value ||
          "";
  }
  dialog.showModal();
  (unlock ? $("booth-unlock-password") : $("booth-password")).focus();
}
function boothBlocked(
  message = "Unlock booth mode to use presenter or editing controls.",
) {
  if (boothActive && !boothInternal) {
    if ($("booth-message")) boothNotice(message);
    return true;
  }
  return false;
}
// Guard action entry points as well as buttons, shortcuts, and drop handlers.
const boothChange = projectChange;
projectChange = function (...args) {
  if (!boothBlocked()) return boothChange(...args);
};
const boothEdit = projectEdit;
projectEdit = function (...args) {
  if (!boothBlocked()) return boothEdit(...args);
};
const boothOpenEditor = projectOpen;
projectOpen = function (...args) {
  if (!boothBlocked()) return boothOpenEditor(...args);
};
const boothMediaOpen = mediaOpen;
mediaOpen = function (...args) {
  if (!boothBlocked()) return boothMediaOpen(...args);
};
const boothImport = projectImport;
projectImport = function (...args) {
  if (!boothBlocked()) return boothImport(...args);
};
const boothAccept = projectAcceptPack;
projectAcceptPack = function (...args) {
  if (!boothBlocked()) return boothAccept(...args);
};
const boothPicker = hubOpenPicker;
hubOpenPicker = function (...args) {
  if (!boothBlocked()) return boothPicker(...args);
};
const boothFile = hubChooseFile;
hubChooseFile = function (...args) {
  if (!boothBlocked()) return boothFile(...args);
};
const boothWizard = nxOpenWizard;
nxOpenWizard = function (...args) {
  if (!boothBlocked()) return boothWizard(...args);
};
const boothMediaFile = mediaChooseFile;
mediaChooseFile = function (...args) {
  if (boothBlocked() || ceLocked(mediaSelected, "primary")) return;
  return boothMediaFile(...args);
};
const boothReadMedia = mediaReadControls;
mediaReadControls = function (...args) {
  if (boothBlocked() || ceLocked(mediaSelected, "primary")) return;
  return boothReadMedia(...args);
};
const boothUndo = projectUndo;
projectUndo = function (...args) {
  if (!boothBlocked()) return boothUndo(...args);
};
const boothRedo = projectRedo;
projectRedo = function (...args) {
  if (!boothBlocked()) return boothRedo(...args);
};
const boothRender = projectRender;
projectRender = function (...args) {
  if (ceDrag) ceEnd(true);
  boothRender(...args);
  if ($("booth-indicator")) boothApply();
};
const boothFocusAllowed = mfAllowed;
mfAllowed = function (figure) {
  return (!boothActive || boothOptions().focus) && boothFocusAllowed(figure);
};
function boothExportData(options) {
  const pack = projectPack(true),
    state = pack.state;
  const loop = decks[options.loop] || [],
    ids = new Set(loop.map((s) => s.dataset.mediaId));
  if (options.questions)
    for (const section of state.sections.filter((s) => s.kind === "qa"))
      for (const slide of state.slides.filter((s) => s.group === section.id))
        ids.add(slide.id);
  state.slides = state.slides.filter((s) => ids.has(s.id));
  const groups = new Set(state.slides.map((s) => s.group));
  state.sections = state.sections.filter((s) => groups.has(s.id));
  for (const slide of state.slides) {
    delete slide.notes;
    delete slide.templateBase;
    delete slide.templateClasses;
    delete slide.templateCommands;
    delete slide.editLocked;
  }
  state.media = Object.fromEntries(
    Object.entries(state.media).filter(
      ([id, cfg]) => ids.has(id) && !cfg.canvas?.hidden,
    ),
  );
  state.mediaObjects = Object.fromEntries(
    Object.entries(state.mediaObjects || {})
      .filter(([id]) => ids.has(id))
      .map(([id, objects]) => [
        id,
        objects.filter((o) => !o.media.canvas?.hidden),
      ]),
  );
  const ordered = loop
    .map((s) => s.dataset.mediaId)
    .filter((id) => ids.has(id));
  return {
    version: 1,
    name: state.projectName,
    brand: state.brand,
    sections: state.sections,
    slides: state.slides,
    media: state.media,
    mediaObjects: state.mediaObjects,
    options,
    loop: ordered,
    presentation: state.presentation,
  };
}
async function boothExport() {
  try {
    const password = $("booth-password").value;
    if (password.length < 8 || password !== $("booth-confirm").value)
      throw new Error(
        "Enter and confirm a passphrase of at least 8 characters.",
      );
    const options = boothReadOptions();
    if (!decks[options.loop]?.length)
      throw new Error("Select a nonempty loop.");
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))),
      hash = await boothHash(password, salt),
      data = boothExportData(options);
    data.lock = { salt, hash };
    const css = [...document.querySelectorAll("style")]
      .map((s) => s.textContent)
      .join("\n");
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    const html =
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Presentation booth</title><style>' +
      css +
      "\n" +
      boothStandaloneStyles +
      '</style><main id="stage"><header><div class="brand"></div><div class="edition"></div></header><div id="booth-slides"></div><footer><span id="booth-title"></span></footer></main><nav id="booth-controls"><button id="booth-prev">Previous</button><button id="booth-play">Pause</button><button id="booth-next">Next</button><button id="booth-questions">Questions</button><button id="booth-home">Return to loop</button><button id="booth-full">Fullscreen</button><button id="booth-access">🔒 Presenter unlock</button></nav><dialog id="booth-question-dialog"><label>Find a question<input id="booth-search" type="search"></label><div id="booth-question-list"></div><button data-close>Close</button></dialog><dialog id="booth-access-dialog"><form id="booth-access-form"><label>Presenter passphrase<input id="booth-passphrase" type="password" autocomplete="off"></label><p id="booth-access-status" role="status"></p><button>Unlock presenter controls</button><button type="button" data-close>Cancel</button></form></dialog><script id="booth-data" type="application/json">' +
      json +
      "<\/script><script>(" +
      boothStandalone.toString() +
      ")();<\/script></html>";
    const refs = projectReferenced({
      brand: data.brand,
      media: data.media,
      mediaObjects: data.mediaObjects,
      slides: data.slides,
    });
    const missing = [...refs].filter((p) => !mediaBlobs.has(p));
    if (missing.length)
      throw new Error(
        "Import the editable ZIP first; " +
          missing.length +
          " media assets are missing.",
      );
    const zip = new JSZip();
    zip.file("index.html", html);
    for (const path of refs) zip.file(path, mediaBlobs.get(path));
    zip.file(
      "README.txt",
      "Booth playback only. Unzip the entire package and open index.html. Authoring tools, presenter notes, recovery history, and omitted slides are not included. Keep your editable project separately. Presenter unlock never enables authoring. Refresh relocks this export. Passphrase protection deters casual in-app tampering; use a restricted OS account or managed kiosk for unattended machines.",
    );
    mediaDownload(
      await zip.generateAsync({ type: "blob", compression: "DEFLATE" }),
      "presentation-booth.zip",
    );
    boothNotice("Booth ZIP created. Keep the editable project separately.");
    $("booth-password").value = "";
    $("booth-confirm").value = "";
  } catch (e) {
    boothNotice("Export failed: " + e.message);
  }
}
function boothBind() {
  const indicator = document.createElement("span");
  indicator.id = "booth-indicator";
  indicator.textContent = "🔒 Booth locked";
  indicator.hidden = true;
  document.body.append(indicator);
  const questionsButton = document.createElement("button");
  questionsButton.id = "booth-audience-questions";
  questionsButton.textContent = "Browse questions";
  questionsButton.hidden = true;
  questionsButton.onclick = () => studioOpenQuestions();
  document.body.append(questionsButton);
  const homeButton = document.createElement("button");
  homeButton.id = "booth-return";
  homeButton.textContent = "Return to loop";
  homeButton.hidden = true;
  homeButton.onclick = boothHome;
  document.body.append(homeButton);
  const unlock = document.createElement("button");
  unlock.id = "booth-unlock";
  unlock.textContent = "Presenter unlock";
  unlock.hidden = true;
  unlock.onclick = () => boothOpen(true);
  document.body.append(unlock);
  const start = document.createElement("button");
  start.id = "booth-open";
  start.textContent = "Booth mode / export";
  start.onclick = () => boothOpen();
  $("fe-settings-panel").append(start);
  const dialog = document.createElement("dialog");
  dialog.id = "booth-dialog";
  dialog.innerHTML =
    '<h2>Conference booth mode</h2><section id="booth-setup"><p>Choose audience interactions, a return loop, and a presenter passphrase. Keep your editable backup separately. This protects against casual in-app tampering, not control of this computer.</p>' +
    ["navigation", "questions", "focus", "video", "links"]
      .map(
        (key) =>
          '<label class="fe-check"><input id="booth-' +
          key +
          '" type="checkbox"> ' +
          {
            navigation: "Slide navigation and pause",
            questions: "Question browser",
            focus: "Media Focus",
            video: "Video controls",
            links: "External links",
          }[key] +
          "</label>",
      )
      .join("") +
    '<label>Return loop<select id="booth-loop"></select></label><label>Idle return seconds (0 disables)<input id="booth-idle" type="number" min="0" max="3600"></label><label>Presenter passphrase<input id="booth-password" type="password" autocomplete="new-password" minlength="8"></label><label>Confirm passphrase<input id="booth-confirm" type="password" autocomplete="new-password"></label><div class="ce-row"><button id="booth-start">Start locked booth</button><button id="booth-export">Export booth ZIP</button></div></section><form id="booth-unlock-form" hidden><label>Presenter passphrase<input id="booth-unlock-password" type="password" autocomplete="off"></label><button>Unlock presenter controls</button></form><p id="booth-message" role="status"></p><button id="booth-close">Close</button>';
  document.body.append(dialog);
  dialog.addEventListener("close", () =>
    dialog
      .querySelectorAll("input[type=password]")
      .forEach((input) => (input.value = "")),
  );
  $("booth-start").onclick = boothStart;
  $("booth-export").onclick = boothExport;
  $("booth-close").onclick = () => dialog.close();
  $("booth-unlock-form").onsubmit = (e) => {
    e.preventDefault();
    boothUnlock();
  };
  window.addEventListener(
    "click",
    (e) => {
      if (!boothActive) return;
      boothLast = Date.now();
      const target = e.target;
      if (target.closest("#booth-dialog,#booth-unlock")) return;
      const options = boothOptions(),
        allowed =
          target.closest("#full,#booth-return") ||
          (options.navigation && target.closest("#prev,#next,#play,.dot")) ||
          (options.questions &&
            target.closest(
              "#booth-audience-questions,#browse-questions,#question-browser,.qa-browse,.qa-next,.qa-prev",
            )) ||
          (options.focus && target.closest(".mf-expand,#media-focus")) ||
          (options.focus && target.closest("img.media-asset")) ||
          (options.focus &&
            target.closest("video.media-asset") &&
            e.clientY < target.getBoundingClientRect().bottom - 50) ||
          (options.video && target.closest("video")) ||
          (options.links && target.closest("a"));
      if (!allowed) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  for (const type of ["auxclick", "contextmenu"])
    window.addEventListener(
      type,
      (e) => {
        if (boothActive && !boothOptions().links && e.target.closest("a")) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  window.addEventListener(
    "keydown",
    (e) => {
      if (!boothActive) return;
      boothLast = Date.now();
      if (e.target.closest("#booth-dialog")) return;
      if (mfState) {
        if (boothOptions().focus) {
          if (
            !boothOptions().video &&
            mfState.asset.tagName === "VIDEO" &&
            e.key === " " &&
            !e.target.closest("button")
          ) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
          return;
        }
      }
      const allowed =
        ["Tab", "Escape", "f", "F"].includes(e.key) ||
        (boothOptions().navigation &&
          ["ArrowLeft", "ArrowRight", "Home", "End", " "].includes(e.key)) ||
        (boothOptions().questions && ["b", "B"].includes(e.key)) ||
        ((e.key === "Enter" || e.key === " ") &&
          (e.target.closest(
            "#booth-unlock,#booth-audience-questions,#booth-return,#question-browser,#prev,#next,#play,#full,video",
          ) ||
            (boothOptions().focus && e.target.closest(".mf-expand")) ||
            (boothOptions().links && e.target.closest("a"))));
      if (!allowed) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  window.addEventListener(
    "change",
    (e) => {
      if (boothActive && !e.target.closest("#booth-dialog")) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  for (const event of ["pointerdown", "pointermove", "touchstart", "wheel"])
    window.addEventListener(
      event,
      () => {
        if (boothActive) boothLast = Date.now();
      },
      { passive: true },
    );
  setInterval(() => {
    if (!boothActive || !boothOptions().idle || $("booth-dialog").open) return;
    if (
      [...document.querySelectorAll("#stage video,#media-focus video")].some(
        (v) => !v.paused && !v.ended,
      )
    ) {
      boothLast = Date.now();
      return;
    }
    if (Date.now() - boothLast > boothOptions().idle * 1000) boothHome();
  }, 1000);
  $("open-full-editor").onclick = projectOpen;
  $("edit-media").onclick = mediaOpen;
  $("hub-presentations").onclick = hubOpenPicker;
  $("hub-editor-projects").onclick = hubOpenPicker;
  $("studio-new-open").onclick = nxOpenWizard;
  try {
    const saved = JSON.parse(localStorage.getItem(boothKey()) || "null");
    if (
      saved?.locked &&
      saved.hash?.length === 32 &&
      saved.salt?.length === 16
    ) {
      saved.options = boothDefaults(saved.options);
      boothLock(saved, false);
      boothRestoreDraft(saved);
    }
  } catch (e) {
    projectMessage("Booth lock could not be restored: " + e.message);
  }
  boothApply();
}
const boothInit = projectInit;
projectInit = function () {
  boothInit();
  boothBind();
};

async function boothRestoreDraft(record) {
  try {
    await hubDatabase();
    const stored = await projectDBGet("projects", projectMeta.id);
    if (!stored?.pack) return;
    const pack = projectValidatePack(stored.pack);
    for (const path of projectReferenced(pack)) {
      const blob = await projectDBGet("assets", pack.meta.id + "|" + path);
      if (blob) mediaRemember(path, blob);
    }
    if (!boothActive || boothRecord !== record) return;
    boothInternal = true;
    try {
      projectDraftPending = null;
      projectAcceptPack(pack);
      boothLock(record, false);
    } finally {
      boothInternal = false;
    }
  } catch (e) {
    boothNotice("Booth stays locked. Draft restore failed: " + e.message);
  }
}

const boothFocusOpen = mfOpen;
mfOpen = function (...args) {
  boothFocusOpen(...args);
  if (boothActive && mfState?.asset.tagName === "VIDEO")
    mfState.asset.controls = boothOptions().video;
};
