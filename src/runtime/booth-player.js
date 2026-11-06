// Serialized into booth exports: no dependency on authoring code or project history.
const boothStandaloneStyles = `#booth-controls{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:500}#booth-controls button,dialog button{padding:9px 14px;border:1px solid #9db5db;border-radius:7px;background:#10213c;color:white;cursor:pointer}#booth-controls [hidden]{display:none}#booth-title{font:18px Arial}dialog{max-width:620px;width:90vw;padding:24px;border-radius:12px;border:1px solid #9db5db;background:white;color:#10213c;font:16px Arial}dialog::backdrop{background:#081426bb}dialog input{display:block;width:100%;font:18px Arial;margin:12px 0;padding:10px}#booth-question-list{max-height:60vh;overflow:auto;display:grid;gap:10px}#booth-slides .slide.active{opacity:1;visibility:visible;transform:none}#booth-slides .slide:not(.active){display:none}#booth-slides .ce-hidden{display:none}#booth-slides video{object-position:var(--media-pos)}.bp-focus{position:absolute;inset:0;background:#080e18;z-index:300;padding:30px 40px;display:flex;flex-direction:column;gap:15px}.bp-focus nav{display:flex;gap:12px;justify-content:flex-end;position:relative;z-index:5;flex:none;height:60px}.bp-focus button{font:22px Arial;padding:12px;background:#10213c;color:#fff;border:1px solid #97b4da;border-radius:8px}.bp-target{flex:1;min-height:0}.bp-focused.media-box{position:absolute!important;inset:auto;background:#071121;border:0;padding:0;z-index:2;display:flex!important}.bp-focused .media-asset{object-fit:contain!important;object-position:center!important;transform-origin:center}.bp-focused figcaption{background:#10213c;color:#fff}.bp-focused .mf-expand,.bp-focused .media-shade,.bp-focused:before{display:none!important}`;
function boothStandalone() {
  "use strict";
  const data = JSON.parse(document.getElementById("booth-data").textContent),
    p = data.options,
    $ = (id) => document.getElementById(id),
    stage = $("stage"),
    nodes = new Map(),
    configs = new WeakMap();
  let current = data.loop[0],
    playing = true,
    elapsed = 0,
    last = performance.now(),
    idle = Date.now(),
    unlocked = false,
    focus = null;
  document.body.classList.toggle(
    "presentation-dark",
    data.brand.presentationTheme === "dark",
  );
  const reduce = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    data.presentation.disableMotion;
  function dom(node) {
    if ("text" in node) return document.createTextNode(node.text);
    const el = document.createElement(node.tag);
    for (const [key, value] of Object.entries(node.attrs || {}))
      el.setAttribute(key, value);
    if (node.tag === "a") {
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
    for (const child of node.children || []) el.append(dom(child));
    return el;
  }
  function placement(box, cfg) {
    const c = cfg.canvas;
    if (!c) return;
    box.style.zIndex = c.z;
    box.hidden = c.hidden;
    if (c.placement) {
      box.classList.add("ce-floating");
      const r = c.placement;
      Object.assign(box.style, {
        left: r.x * 100 + "%",
        top: r.y * 100 + "%",
        width: r.w * 100 + "%",
        height: r.h * 100 + "%",
        bottom: "auto",
        right: "auto",
      });
    }
    box.style.setProperty("--media-pos", c.crop.x + "% " + c.crop.y + "%");
  }
  function media(cfg, slide) {
    const box = document.createElement("figure");
    box.className =
      "media-box frame-" +
      cfg.frame +
      (cfg.captionPlace === "overlay" ? " caption-overlay" : "");
    box.style.setProperty("--media-fit", cfg.fit);
    box.style.setProperty("--media-pos", cfg.position);
    const view = document.createElement("div");
    view.className = "media-viewport";
    const asset = document.createElement(
      cfg.kind === "video" ? "video" : "img",
    );
    asset.className = "media-asset";
    asset.src = cfg.src;
    if (cfg.kind === "video") {
      asset.controls = p.video;
      asset.muted = cfg.muted;
      asset.loop = cfg.loop;
      asset.playsInline = true;
      if (cfg.poster) asset.poster = cfg.poster;
      asset.onended = () => {
        if (
          !focus &&
          current === slide.id &&
          playing &&
          cfg.advance === "ended"
        )
          next(1, true);
      };
    } else asset.alt = cfg.alt || cfg.name || "Slide image";
    asset.onerror = () => {
      box.classList.add("is-missing");
      const text = document.createElement("span");
      text.textContent = "Media unavailable";
      view.append(text);
    };
    view.append(asset);
    box.append(view);
    if (cfg.caption) {
      const caption = document.createElement("figcaption");
      caption.textContent = cfg.caption;
      box.append(caption);
    }
    if (p.focus) {
      const expand = document.createElement("button");
      expand.className = "mf-expand";
      expand.textContent = "Expand";
      expand.onclick = () => openFocus(box);
      box.append(expand);
      asset.addEventListener("click", (e) => {
        if (
          cfg.kind === "video" &&
          e.clientY >
            asset.getBoundingClientRect().bottom -
              (50 * stage.getBoundingClientRect().width) / 1920
        )
          return;
        openFocus(box);
      });
    }
    configs.set(box, cfg);
    placement(box, cfg);
    return box;
  }
  const brand = $("stage").querySelector(".brand");
  brand.textContent = data.brand.headerTitle || data.name;
  const logo =
    (data.brand.presentationTheme === "dark"
      ? data.brand.logoDark
      : data.brand.logoLight) || data.brand.logo;
  if (logo && data.brand.logoPlacement !== "hidden") {
    const image = document.createElement("img");
    image.src = logo;
    image.alt = "";
    image.style.height = (data.brand.logoSize || 40) + "px";
    if (data.brand.logoPlacement === "right") brand.append(image);
    else brand.prepend(image);
  }
  stage.querySelector(".edition").textContent = data.brand.edition || "";
  for (const model of data.slides) {
    const slide = document.createElement("section");
    slide.id = model.id;
    slide.className = "slide " + model.classes;
    slide.dataset.title = model.title;
    const cfg = data.media[model.id];
    if (cfg) {
      const original = document.createElement("div");
      original.className = "media-original";
      model.tree.forEach((node) => original.append(dom(node)));
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
      slide.append(media(cfg, model));
      if (cfg.canvas?.placement) slide.classList.add("ce-free");
    } else model.tree.forEach((node) => slide.append(dom(node)));
    for (const object of data.mediaObjects[model.id] || [])
      slide.append(media(object.media, model));
    slide.querySelectorAll("a").forEach((a) => {
      if (!p.links) a.onclick = (e) => e.preventDefault();
    });
    slide.querySelectorAll(".qa-browse").forEach((b) => {
      b.hidden = !p.questions;
      b.onclick = questions;
    });
    slide
      .querySelectorAll(".qa-prev,.qa-next")
      .forEach(
        (b) =>
          (b.onclick = () =>
            questionStep(b.classList.contains("qa-prev") ? -1 : 1)),
      );
    slide
      .querySelectorAll(".copy-command")
      .forEach(
        (b) =>
          (b.onclick = () =>
            navigator.clipboard
              ?.writeText(slide.querySelector("pre")?.textContent || "")
              .catch(() => {})),
      );
    const select = slide.querySelector(".terminal select");
    if (select && model.commands) {
      select.value = "powershell";
      const code = slide.querySelector("pre");
      if (code) code.textContent = model.commands.powershell;
      select.onchange = () => {
        if (code) code.textContent = model.commands[select.value] || "";
      };
    }
    $("booth-slides").append(slide);
    nodes.set(model.id, slide);
  }
  function paint() {
    for (const [id, slide] of nodes) {
      slide.classList.toggle("active", id === current);
      for (const v of slide.querySelectorAll("video")) {
        const cfg = configs.get(v.closest("figure"));
        v.controls = p.video || unlocked;
        if (id === current && playing && cfg.autoplay) v.play().catch(() => {});
        else v.pause();
      }
    }
    $("booth-title").textContent =
      data.slides.find((s) => s.id === current)?.title || "";
    $("booth-play").textContent = playing ? "Pause" : "Play";
  }
  function show(id) {
    if (!nodes.has(id)) return;
    if (focus) closeFocus(true);
    for (const v of nodes.get(current)?.querySelectorAll("video") || []) {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {}
    }
    current = id;
    elapsed = 0;
    paint();
  }
  function next(direction, automatic = false) {
    if (!automatic && !p.navigation && !unlocked) return;
    let i = data.loop.indexOf(current);
    show(data.loop[(i + direction + data.loop.length) % data.loop.length]);
  }
  function home() {
    if (focus) closeFocus(true);
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    playing = true;
    show(data.loop[0]);
    idle = Date.now();
  }
  function questions() {
    if (!p.questions && !unlocked) return;
    const dialog = $("booth-question-dialog");
    $("booth-search").value = "";
    questionList();
    dialog.showModal();
    playing = false;
    paint();
  }
  function questionList() {
    const list = $("booth-question-list"),
      query = $("booth-search").value.toLowerCase();
    list.replaceChildren();
    for (const model of data.slides.filter(
      (s) =>
        data.sections.find((g) => g.id === s.group)?.kind === "qa" &&
        s.title.toLowerCase().includes(query),
    )) {
      const button = document.createElement("button");
      button.textContent = model.title;
      button.onclick = () => {
        $("booth-question-dialog").close();
        playing = false;
        show(model.id);
      };
      list.append(button);
    }
  }
  function questionStep(step) {
    const ids = data.slides
      .filter((s) => data.sections.find((g) => g.id === s.group)?.kind === "qa")
      .map((s) => s.id);
    if (p.questions && ids.length) {
      playing = false;
      show(ids[(ids.indexOf(current) + step + ids.length) % ids.length]);
    }
  }
  function rect(el) {
    const r = el.getBoundingClientRect(),
      s = stage.getBoundingClientRect();
    return {
      left: ((r.left - s.left) * 1920) / s.width,
      top: ((r.top - s.top) * 1080) / s.height,
      width: (r.width * 1920) / s.width,
      height: (r.height * 1080) / s.height,
    };
  }
  const frame = (r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v + "px"]));
  function animate(box, from, to) {
    Object.assign(box.style, frame(to));
    if (reduce() || data.presentation.mediaFocus?.animation === "none")
      return Promise.resolve();
    return box
      .animate([frame(from), frame(to)], {
        duration: 350,
        easing: "cubic-bezier(.2,.8,.2,1)",
      })
      .finished.catch(() => {});
  }
  function openFocus(box) {
    if (focus || !p.focus) return;
    const asset = box.querySelector(".media-asset"),
      placeholder = document.createElement("div");
    placeholder.className = box.className;
    placeholder.style.cssText = box.style.cssText;
    placeholder.style.visibility = "hidden";
    box.before(placeholder);
    const origin = rect(box),
      layer = document.createElement("div");
    layer.className = "bp-focus";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "Media focus");
    const controls = document.createElement("nav");
    const close = document.createElement("button");
    close.textContent = "Return to slide (Esc)";
    const target = document.createElement("div");
    target.className = "bp-target";
    controls.append(close);
    layer.append(controls, target);
    stage.append(layer);
    const state = {
      box,
      asset,
      placeholder,
      layer,
      style: box.getAttribute("style"),
      assetStyle: asset.getAttribute("style"),
      playing,
      zoom: 1,
      x: 0,
      y: 0,
      inert: [],
      closing: false,
    };
    focus = state;
    for (const child of stage.children)
      if (child !== layer) {
        state.inert.push([child, child.inert]);
        child.inert = true;
      }
    $("booth-controls").inert = true;
    const time = asset.currentTime || 0,
      wasPlaying = asset.tagName === "VIDEO" && !asset.paused;
    playing = false;
    box.classList.add("bp-focused");
    layer.append(box);
    if (asset.tagName === "VIDEO") {
      asset.controls = p.video || unlocked;
      if (asset.currentTime < time) asset.currentTime = time;
      if (wasPlaying) asset.play().catch(() => {});
    }
    close.onclick = () => closeFocus();
    const caption = box.querySelector("figcaption");
    state.caption = caption;
    state.captionHidden = caption?.hidden;
    if (caption) {
      caption.hidden = data.presentation.mediaFocus?.captions === false;
      const toggle = document.createElement("button");
      toggle.textContent = "Caption";
      toggle.onclick = () => (caption.hidden = !caption.hidden);
      controls.prepend(toggle);
    }
    if (
      asset.tagName === "IMG" &&
      data.presentation.mediaFocus?.zoom !== false
    ) {
      const paintZoom = () => {
        const view = asset.parentElement,
          w = view.clientWidth,
          h = view.clientHeight,
          fit = Math.min(w / asset.naturalWidth, h / asset.naturalHeight);
        const maxX = Math.max(
            0,
            (asset.naturalWidth * fit * state.zoom - w) / 2,
          ),
          maxY = Math.max(0, (asset.naturalHeight * fit * state.zoom - h) / 2);
        state.x = Math.max(-maxX, Math.min(maxX, state.x));
        state.y = Math.max(-maxY, Math.min(maxY, state.y));
        asset.style.transform =
          "translate(" +
          state.x +
          "px," +
          state.y +
          "px) scale(" +
          state.zoom +
          ")";
      };
      for (const [label, fn] of [
        ["−", () => (state.zoom = Math.max(1, state.zoom / 1.25))],
        ["+", () => (state.zoom = Math.min(6, state.zoom * 1.25))],
        [
          "Fit",
          () => {
            state.zoom = 1;
            state.x = state.y = 0;
          },
        ],
      ]) {
        const b = document.createElement("button");
        b.textContent = label;
        b.onclick = () => {
          fn();
          paintZoom();
        };
        controls.prepend(b);
      }
      let drag = null;
      state.down = (e) => {
        if (state.zoom <= 1) return;
        e.preventDefault();
        drag = { x: e.clientX, y: e.clientY, oldX: state.x, oldY: state.y };
        asset.setPointerCapture(e.pointerId);
      };
      state.move = (e) => {
        if (!drag) return;
        const scale = 1920 / stage.getBoundingClientRect().width;
        state.x = drag.oldX + (e.clientX - drag.x) * scale;
        state.y = drag.oldY + (e.clientY - drag.y) * scale;
        paintZoom();
      };
      state.up = () => (drag = null);
      asset.addEventListener("pointerdown", state.down);
      asset.addEventListener("pointermove", state.move);
      asset.addEventListener("pointerup", state.up);
      state.wheel = (e) => {
        e.preventDefault();
        state.zoom = Math.max(
          1,
          Math.min(6, state.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)),
        );
        paintZoom();
      };
      state.double = () => {
        state.zoom = state.zoom === 1 ? 2 : 1;
        paintZoom();
      };
      asset.addEventListener("wheel", state.wheel, { passive: false });
      asset.addEventListener("dblclick", state.double);
    }
    close.focus();
    animate(box, origin, rect(target));
  }
  async function closeFocus(immediate = false) {
    const s = focus;
    if (!s || s.closing) return;
    s.closing = true;
    if (!immediate) {
      if (s.asset.tagName === "IMG" && !reduce())
        s.asset.animate(
          [
            { transform: s.asset.style.transform || "none" },
            { transform: "none" },
          ],
          { duration: 350, easing: "ease-out" },
        );
      await animate(s.box, rect(s.box), rect(s.placeholder));
    }
    if (focus !== s) return;
    const time = s.asset.currentTime || 0,
      wasPlaying =
        s.asset.tagName === "VIDEO" && !s.asset.paused && !s.asset.ended;
    for (const [name, handler] of [
      ["pointerdown", s.down],
      ["pointermove", s.move],
      ["pointerup", s.up],
      ["wheel", s.wheel],
      ["dblclick", s.double],
    ])
      if (handler) s.asset.removeEventListener(name, handler);
    s.placeholder.replaceWith(s.box);
    s.box.classList.remove("bp-focused");
    if (s.style === null) s.box.removeAttribute("style");
    else s.box.setAttribute("style", s.style);
    if (s.assetStyle === null) s.asset.removeAttribute("style");
    else s.asset.setAttribute("style", s.assetStyle);
    if (s.caption) s.caption.hidden = s.captionHidden;
    s.layer.remove();
    for (const [el, inert] of s.inert) el.inert = inert;
    $("booth-controls").inert = false;
    playing = s.playing;
    focus = null;
    last = performance.now();
    if (s.asset.tagName === "VIDEO") {
      s.asset.controls = p.video || unlocked;
      if (s.asset.currentTime < time) s.asset.currentTime = time;
      if (wasPlaying) s.asset.play().catch(() => {});
      else s.asset.pause();
    }
    s.box.querySelector(".mf-expand")?.focus();
    $("booth-play").textContent = playing ? "Pause" : "Play";
  }
  $("booth-prev").onclick = () => next(-1);
  $("booth-next").onclick = () => next(1);
  $("booth-play").onclick = () => {
    if (p.navigation || unlocked) {
      playing = !playing;
      paint();
    }
  };
  $("booth-home").onclick = home;
  $("booth-questions").onclick = questions;
  $("booth-search").oninput = questionList;
  $("booth-full").onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };
  function permissions() {
    for (const id of ["prev", "next", "play"])
      $("booth-" + id).hidden = !p.navigation && !unlocked;
    $("booth-questions").hidden = !p.questions && !unlocked;
    $("booth-access").textContent = unlocked
      ? "Relock booth"
      : "🔒 Presenter unlock";
  }
  $("booth-access").onclick = () => {
    if (unlocked) {
      unlocked = false;
      permissions();
      paint();
      return;
    }
    $("booth-access-status").textContent = "";
    $("booth-passphrase").value = "";
    $("booth-access-dialog").showModal();
  };
  $("booth-access-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const password = $("booth-passphrase").value;
      $("booth-passphrase").value = "";
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
      );
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.deriveBits(
            {
              name: "PBKDF2",
              salt: Uint8Array.from(data.lock.salt),
              iterations: 150000,
              hash: "SHA-256",
            },
            key,
            256,
          ),
        ),
      );
      if (
        hash.length !== data.lock.hash.length ||
        hash.some((n, i) => n !== data.lock.hash[i])
      )
        throw new Error("Incorrect passphrase.");
      unlocked = true;
      $("booth-access-dialog").close();
      permissions();
      paint();
    } catch (e) {
      $("booth-access-status").textContent = e.message;
    }
  };
  document
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
  window.addEventListener("keydown", (e) => {
    idle = Date.now();
    if (e.target.closest("dialog")) return;
    if (focus) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeFocus();
      }
      if (e.key === "Tab") {
        const buttons = [
          ...focus.layer.querySelectorAll("button,video[controls]"),
        ];
        const a = buttons[0],
          b = buttons.at(-1);
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next(1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      next(-1);
    }
    if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      $("booth-play").click();
    }
    if (e.key === "Escape") home();
  });
  for (const event of ["dragover", "drop"])
    window.addEventListener(event, (e) => e.preventDefault());
  for (const event of ["pointerdown", "pointermove", "wheel", "touchstart"])
    window.addEventListener(event, () => (idle = Date.now()), {
      passive: true,
    });
  function resize() {
    stage.style.transform =
      "translate(-50%,-50%) scale(" +
      Math.min(innerWidth / 1920, innerHeight / 1080) +
      ")";
  }
  window.onresize = resize;
  resize();
  permissions();
  paint();
  function tick(now) {
    const dt = Math.min(250, now - last);
    last = now;
    const activeVideos = [...nodes.get(current).querySelectorAll("video")];
    const watching = activeVideos.some((v) => !v.paused && !v.ended);
    if (watching) idle = Date.now();
    if (
      p.idle &&
      Date.now() - idle >= p.idle * 1000 &&
      !document.querySelector("dialog[open]")
    )
      home();
    const model = data.slides.find((s) => s.id === current),
      cfg = data.media[current];
    if (
      playing &&
      !focus &&
      data.loop.includes(current) &&
      !(cfg?.kind === "video" && ["manual", "ended"].includes(cfg.advance))
    ) {
      elapsed += dt;
      if (elapsed >= model.duration * 1000) next(1, true);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
