// Structured presentation project model. No imported HTML or commands are executed.
  let projectReady = false,
    projectPlayback = false,
    projectState = null,
    projectMeta = null,
    projectCheckpoints = [],
    projectPast = [],
    projectFuture = [],
    projectBaseline = null,
    projectBuiltIn = null,
    projectSelected = "",
    projectTab = "content",
    projectBlockPath = "",
    projectTablePath = "",
    projectLoop = "combined",
    projectPending = null,
    projectPendingTimer = null,
    projectDraftTimer = null,
    projectDB = null,
    projectDraftPending = null,
    projectApplying = false,
    projectPreviewNode = null,
    projectConfirmAction = null;
  const projectGroupInfo = mediaGroups.map(([id, label]) => ({ id, label }));
  const projectLoopDefaults = [
    "showcase",
    "remshowcase",
    "overview",
    "combined",
  ];
  const projectAllowedTags = new Set([
    "div",
    "p",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "em",
    "strong",
    "b",
    "i",
    "small",
    "br",
    "ul",
    "ol",
    "li",
    "pre",
    "code",
    "a",
    "button",
    "label",
    "select",
    "option",
    "table",
    "caption",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
  ]);
  function projectID(prefix = "slide") {
    return (
      prefix +
      "-" +
      (crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2))
    );
  }
  function projectCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function projectText(node) {
    if (!node) return "";
    if ("text" in node) return node.text;
    if (node.tag === "br") return " ";
    return (node.children || [])
      .map(projectText)
      .join(node.tag === "ul" || node.tag === "ol" ? "\n" : "");
  }
  function projectNode(tag, cls = "", children = []) {
    return {
      tag,
      attrs: cls ? { class: cls } : {},
      children: children.map((c) => (typeof c === "string" ? { text: c } : c)),
    };
  }
  function projectSafeStyle(style) {
    return String(style || "")
      .split(";")
      .filter(
        (rule) =>
          /^\s*(color|background-color|font-size|font-weight|margin|margin-top|margin-bottom|max-width|align-self|letter-spacing|line-height)\s*:\s*[-#a-zA-Z0-9.%\s(),]+$/.test(
            rule,
          ) && !/url|expression|javascript|var\(/i.test(rule),
      )
      .join(";");
  }
  function projectSerialize(node) {
    if (node.nodeType === 3) return { text: node.textContent };
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    if (!projectAllowedTags.has(tag)) return null;
    const attrs = {};
    for (const a of node.attributes) {
      if (a.name === "class") attrs.class = a.value;
      if (a.name === "style") {
        const style = projectSafeStyle(a.value);
        if (style) attrs.style = style;
      }
      if (
        [
          "colspan",
          "rowspan",
          "scope",
          "target",
          "rel",
          "type",
          "aria-label",
          "value",
        ].includes(a.name)
      )
        attrs[a.name] = a.value;
      if (a.name === "href" && /^https?:\/\//i.test(a.value))
        attrs.href = a.value;
    }
    return {
      tag,
      attrs,
      children: [...node.childNodes].map(projectSerialize).filter(Boolean),
    };
  }
  function projectValidateTree(tree, depth = 0, budget = { count: 0 }) {
    if (!Array.isArray(tree) || depth > 30)
      throw new Error("Invalid slide content structure.");
    return tree.map((n) => {
      if (++budget.count > 50000)
        throw new Error("Slide content is too large.");
      if (n && typeof n.text === "string")
        return { text: n.text.slice(0, 100000) };
      if (!n || !projectAllowedTags.has(n.tag))
        throw new Error("Unsupported slide content.");
      const attrs = {};
      for (const [k, v] of Object.entries(n.attrs || {})) {
        if (k === "class")
          attrs.class = String(v)
            .replace(/[^\w\s-]/g, "")
            .slice(0, 500);
        else if (k === "style") attrs.style = projectSafeStyle(v);
        else if (k === "href" && /^https?:\/\//i.test(v))
          attrs.href = String(v);
        else if (
          [
            "colspan",
            "rowspan",
            "scope",
            "target",
            "rel",
            "type",
            "aria-label",
            "value",
          ].includes(k)
        )
          attrs[k] = String(v).slice(0, 1000);
      }
      return {
        tag: n.tag,
        attrs,
        children: projectValidateTree(n.children || [], depth + 1, budget),
      };
    });
  }
  function projectDOM(node) {
    if ("text" in node) return document.createTextNode(node.text);
    const el = document.createElement(node.tag);
    for (const [k, v] of Object.entries(node.attrs || {}))
      el.setAttribute(k, v);
    if (node.tag === "a") {
      el.target = "_blank";
      el.rel = "noopener";
    }
    for (const c of node.children || []) el.append(projectDOM(c));
    return el;
  }
  function projectWalk(tree, callback, path = []) {
    tree.forEach((n, i) => {
      const p = [...path, i];
      callback(n, p);
      if (n.children) projectWalk(n.children, callback, [...p, "children"]);
    });
  }
  function projectAt(model, path) {
    if (!path) return null;
    return path.split(".").reduce((v, k) => v?.[k], model.tree);
  }
  function projectSetText(node, text) {
    if (node.tag === "ul" || node.tag === "ol")
      node.children = text
        .split("\n")
        .filter((x) => x.trim())
        .map((x) => projectNode("li", "", [x]));
    else node.children = [{ text }];
  }
  function projectHeading(model) {
    let found = null;
    projectWalk(model.tree, (n, p) => {
      if (!found && ["h1", "h2"].includes(n.tag))
        found = { node: n, path: p.join(".") };
    });
    return found;
  }
  function projectFind(model, predicate) {
    const result = [];
    projectWalk(model.tree, (n, p) => {
      if (predicate(n)) result.push({ node: n, path: p.join(".") });
    });
    return result;
  }
  function projectFields(model) {
    return projectFind(
      model,
      (n) =>
        ["h1", "h2", "h3", "h4", "p", "ul", "ol", "caption"].includes(n.tag) ||
        (["div", "span"].includes(n.tag) &&
          /\b(num|tag|code)\b/.test(n.attrs?.class || "")),
    ).filter(({ path, node }) => {
      const ancestors = path.split(".").slice(0, -1);
      for (let i = 1; i < ancestors.length; i += 2) {
        const a = ancestors.slice(0, i).reduce((v, k) => v?.[k], model.tree);
        if (a && ["ul", "ol", "pre", "table"].includes(a.tag)) return false;
      }
      return (
        node !== projectHeading(model)?.node &&
        (!["qa", "remqa"].includes(model.group) ||
          !/\beyebrow\b/.test(node.attrs?.class || ""))
      );
    });
  }
  function projectModel(id = projectSelected) {
    return projectState.slides.find((s) => s.id === id);
  }
  function projectMessage(text) {
    $("fe-message").textContent = text;
  }
  function projectIsLoop(id) {
    return projectReady
      ? !!projectState.loops[id]
      : projectLoopDefaults.includes(id);
  }
  function projectCreateTemplate(template, title = "New slide") {
    const h = (tag, cls, text) => projectNode(tag, cls, [text]),
      eyebrow = h("p", "eyebrow", "CUSTOMER PRESENTATION"),
      head = h("h2", "", title),
      lead = h("p", "lead", "Add your customer-facing explanation.");
    const card = (name, body) =>
      projectNode("div", "card", [h("h3", "", name), h("p", "", body)]);
    let classes = "wide",
      tree = [];
    if (template === "hero") {
      classes = "";
      tree = [
        projectNode("div", "", [eyebrow, h("h1", "", title), lead]),
        projectNode("div", "card accent", [
          h("div", "num", "KEY MESSAGE"),
          h("h3", "", "Add your key message"),
          h("p", "", "Add supporting context."),
        ]),
      ];
    } else if (template === "comparison") {
      tree = [
        projectNode("div", "", [eyebrow, head, lead]),
        projectNode("div", "duo", [
          card("First option", "Describe the first option."),
          card("Second option", "Describe the second option."),
        ]),
      ];
    } else if (template === "workflow") {
      tree = [
        projectNode("div", "", [eyebrow, head, lead]),
        projectNode("div", "editor-workflow", [
          card("1. Prepare", "Describe the first step."),
          card("2. Perform", "Describe the second step."),
          card("3. Review", "Describe the outcome."),
        ]),
      ];
    } else if (template === "table") {
      classes = "wide editor-table-slide";
      tree = [
        projectNode("div", "", [eyebrow, head, lead]),
        projectNode("div", "detection-table-wrap", [
          projectNode("table", "detection-table", [
            projectNode("thead", "", [
              projectNode("tr", "", [
                h("th", "", "Item"),
                h("th", "", "Description"),
              ]),
            ]),
            projectNode("tbody", "", [
              projectNode("tr", "", [
                h("td", "", "Example"),
                h("td", "", "Add details"),
              ]),
              projectNode("tr", "", [
                h("td", "", "Example 2"),
                h("td", "", "Add details"),
              ]),
            ]),
          ]),
        ]),
      ];
    } else if (template === "qa") {
      classes = "qa-slide";
      tree = [
        projectNode("div", "", [
          h("p", "eyebrow", "CUSTOMER Q&A"),
          head,
          h("p", "qa-answer", "Write a concise customer-facing answer."),
          h("button", "qa-browse", "Browse all questions"),
        ]),
        projectNode("div", "card accent", [
          h("div", "num", "CONVERSATION TAKEAWAY"),
          h("p", "", "Add a discussion point."),
        ]),
      ];
    } else if (template === "code") {
      classes = "steps-slide";
      tree = [
        projectNode("div", "", [eyebrow, head, lead]),
        projectNode("div", "", [
          projectNode("div", "terminal", [
            h("div", "panelhead", "COMMAND EXAMPLE"),
            h("pre", "", "Replace with your command"),
            h("button", "copy-command", "Copy command"),
            h("div", "copy-status", ""),
          ]),
          h("p", "steps-note", "Add prerequisites and expected results."),
        ]),
      ];
    } else {
      tree = [
        projectNode("div", "", [eyebrow, head, lead]),
        projectNode("div", "card", [
          h("h3", "", "Add an image or video"),
          h("p", "", "Use Edit Media to attach a visual to this slide."),
        ]),
      ];
    }
    return { tree, classes };
  }
  function projectCaptureBuiltIn() {
    const slidesData = mediaEntries.map((entry) => {
      const clone = entry.slide.cloneNode(true),
        wrapper = clone.querySelector(":scope>.media-original");
      if (wrapper) wrapper.replaceWith(...wrapper.childNodes);
      clone.querySelector(":scope>.media-box")?.remove();
      let tree = [...clone.childNodes].map(projectSerialize).filter(Boolean);
      const qa = entry.group === "qa" || entry.group === "remqa",
        bank = entry.group === "remqa" ? remQuestions : questions,
        notes =
          entry.slide.dataset.notes ||
          (qa
            ? bank[entry.index]?.[3]
            : entry.group === "showcase"
              ? showcaseNotes[entry.index]
              : entry.group === "steps"
                ? walkthrough[entry.index]?.[4]
                : "") ||
          "";
      const pre = entry.slide.querySelector("pre"),
        command = entry.slide._command;
      let commands = null;
      if (pre) {
        commands = { powershell: pre.textContent, bash: pre.textContent };
        if (command && entry.group === "steps" && entry.index === 0) {
          commands.powershell =
            "Set-Location 'C:\\src\\customer-app'\n" + command;
          commands.bash = "cd '/srv/customer-app'\n" + command;
        } else if (command) commands = { powershell: command, bash: command };
      }
      return {
        id: entry.id,
        title: entry.title,
        group: entry.group,
        template: "original",
        classes: [...clone.classList]
          .filter(
            (c) =>
              c !== "slide" &&
              c !== "active" &&
              !c.startsWith("media-") &&
              !c.startsWith("corner-"),
          )
          .join(" "),
        tree,
        templateBase: projectCopy(tree),
        templateClasses: [...clone.classList]
          .filter(
            (c) =>
              c !== "slide" &&
              c !== "active" &&
              !c.startsWith("media-") &&
              !c.startsWith("corner-"),
          )
          .join(" "),
        duration: Number(entry.slide.dataset.time) || 12,
        hidden: false,
        notes,
        templateCommands: projectCopy(commands),
        topic: qa
          ? (entry.group === "remqa" ? remGroups : questionGroups).find(
              ([, indices]) => indices.includes(entry.index),
            )?.[0] ||
            bank[entry.index]?.[0] ||
            "General"
          : "",
        commands,
      };
    });
    const loops = {};
    for (const key of projectLoopDefaults)
      loops[key] = {
        name: {
          showcase: "Presentation showcase",
          remshowcase: "Workshop showcase",
          overview: "Presentation overview",
          combined: "Combined showcase loop",
        }[key],
        slideIds: decks[key].map((s) => s.dataset.mediaId),
      };
    return {
      projectName: "Presentation Studio",
      slides: slidesData,
      trash: [],
      loops,
      brand: {
        accent: "#0066ff",
        background: "#f4f6f8",
        ink: "#101c2f",
        font: "Arial",
        logo: "",
      },
      media: {},
    };
  }
  function projectValidateState(raw) {
    if (!raw || !Array.isArray(raw.slides) || raw.slides.length > 1000)
      throw new Error("Invalid presentation project.");
    const seen = new Set();
    function slide(s) {
      if (
        !s ||
        typeof s.id !== "string" ||
        !/^[\w-]+$/.test(s.id) ||
        seen.has(s.id) ||
        !projectGroupInfo.some((g) => g.id === s.group)
      )
        throw new Error("Invalid or duplicate slide identity.");
      seen.add(s.id);
      const template = [
        "original",
        "hero",
        "comparison",
        "workflow",
        "table",
        "qa",
        "code",
        "media",
      ].includes(s.template)
        ? s.template
        : "hero";
      return {
        id: s.id,
        title: String(s.title || "Untitled slide").slice(0, 500),
        group: s.group,
        template,
        classes: String(s.classes || "")
          .replace(/[^\w\s-]/g, "")
          .slice(0, 300),
        tree: projectValidateTree(s.tree),
        templateBase: projectValidateTree(s.templateBase || s.tree),
        templateClasses: String(s.templateClasses || s.classes || "")
          .replace(/[^\w\s-]/g, "")
          .slice(0, 300),
        duration: Math.max(3, Math.min(600, Number(s.duration) || 12)),
        hidden: !!s.hidden,
        notes: String(s.notes || "").slice(0, 20000),
        topic: String(s.topic || "General").slice(0, 150),
        commands: s.commands
          ? {
              powershell: String(s.commands.powershell || "").slice(0, 100000),
              bash: String(s.commands.bash || "").slice(0, 100000),
            }
          : null,
        templateCommands: s.templateCommands
          ? {
              powershell: String(s.templateCommands.powershell || ""),
              bash: String(s.templateCommands.bash || ""),
            }
          : null,
        _trashIndex: Number(s._trashIndex) || 0,
      };
    }
    const active = raw.slides.map(slide),
      trash = (raw.trash || []).map(slide);
    if (!active.some((s) => !s.hidden))
      throw new Error("A project must contain at least one visible slide.");
    const loops = {};
    for (const [id, loop] of Object.entries(raw.loops || {})) {
      if (!/^[\w-]+$/.test(id) || !Array.isArray(loop.slideIds))
        throw new Error("Invalid kiosk loop.");
      loops[id] = {
        name: String(loop.name || "Custom loop").slice(0, 150),
        slideIds: [
          ...new Set(loop.slideIds.filter((x) => typeof x === "string")),
        ],
      };
    }
    const b = raw.brand || {},
      color = (x, f) => (/^#[0-9a-f]{6}$/i.test(x) ? x : f);
    return {
      projectName: String(raw.projectName || "Untitled presentation").slice(
        0,
        200,
      ),
      slides: active,
      trash,
      loops,
      brand: {
        accent: color(b.accent, "#0066ff"),
        background: color(b.background, "#f4f6f8"),
        ink: color(b.ink, "#101c2f"),
        font: ["Arial", "Segoe UI", "Verdana", "Georgia"].includes(b.font)
          ? b.font
          : "Arial",
        logo: mediaSafePath(b.logo) ? b.logo : "",
      },
      media: mediaValidate({ schemaVersion: 1, slides: raw.media || {} })
        .slides,
    };
  }
  function projectPack(playback = false) {
    projectFlush();
    const state = projectCopy(projectState);
    if (playback) {
      state.trash = [];
      state.slides = state.slides.filter((s) => !s.hidden);
      state.slides.forEach((s) => {
        s.notes = "";
        delete s.templateBase;
        delete s.templateClasses;
        delete s.templateCommands;
      });
      const keep = new Set(state.slides.map((s) => s.id));
      state.media = Object.fromEntries(
        Object.entries(state.media).filter(([id]) => keep.has(id)),
      );
    }
    return {
      schemaVersion: 2,
      kind: "presentation-studio-project",
      meta: projectCopy(projectMeta),
      playbackOnly: playback,
      state,
      checkpoints: playback ? [] : projectCopy(projectCheckpoints),
      history: playback
        ? { past: [], future: [] }
        : projectCopy({ past: projectPast, future: projectFuture }),
    };
  }
  function projectValidatePack(raw) {
    if (raw?.schemaVersion !== 2 || !studioCompatibleKind(raw.kind))
      throw new Error("Unsupported project format.");
    const state = projectValidateState(raw.state);
    return {
      schemaVersion: 2,
      kind: "presentation-studio-project",
      meta: {
        id: /^[\w-]+$/.test(raw.meta?.id || "")
          ? raw.meta.id
          : projectID("project"),
        name: String(raw.meta?.name || "Untitled presentation").slice(0, 200),
        updatedAt: raw.meta?.updatedAt || new Date().toISOString(),
      },
      playbackOnly: !!raw.playbackOnly,
      state,
      checkpoints: (raw.checkpoints || [])
        .slice(-40)
        .map((c) => ({
          id: String(c.id || projectID("checkpoint")),
          name: String(c.name || "Checkpoint").slice(0, 200),
          created: String(c.created || ""),
          state: projectValidateState(c.state),
        })),
      history: {
        past: (raw.history?.past || []).slice(-80).map(projectValidateState),
        future: (raw.history?.future || [])
          .slice(-80)
          .map(projectValidateState),
      },
    };
  }
  function projectReferenced(pack = projectPack()) {
    const refs = new Set();
    function walk(x) {
      if (typeof x === "string") {
        if (mediaSafePath(x)) refs.add(x);
      } else if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === "object") Object.values(x).forEach(walk);
    }
    walk(pack);
    return refs;
  }
  function projectModified() {
    mediaDirty = true;
    projectMeta.updatedAt = new Date().toISOString();
    mediaState();
    projectStatus();
    projectScheduleDraft();
  }
  function projectStatus() {
    $("fe-status").textContent =
      (mediaDirty ? "Unsaved changes" : "Exported / opened project") +
      " · " +
      projectMeta.name;
    $("fe-undo").disabled =
      !!projectDraftPending || (!projectPast.length && !projectPending);
    $("fe-redo").disabled = !!projectDraftPending || !projectFuture.length;
    $("fe-summary").textContent =
      projectState.slides.length +
      " slides · " +
      projectState.slides.filter((s) => !s.hidden).length +
      " visible · " +
      projectState.trash.length +
      " in Trash";
    $("open-full-editor").textContent = projectDraftPending
      ? "Editor · draft"
      : mediaDirty
        ? "Editor •"
        : "Editor";
  }
  function projectPush(before) {
    if (JSON.stringify(before) === JSON.stringify(projectState)) return;
    projectPast.push(before);
    if (projectPast.length > 80) projectPast.shift();
    projectFuture = [];
    projectModified();
  }
  function projectFlush() {
    if (projectPending) {
      clearTimeout(projectPendingTimer);
      const before = projectPending;
      projectPending = null;
      projectPush(before);
      projectRender(false);
    }
  }
  function projectChange(fn, { form = true } = {}) {
    if (projectPlayback) return;
    if (projectDraftPending) {
      projectMessage(
        "Recover or discard the available browser draft before editing.",
      );
      return;
    }
    projectFlush();
    const before = projectCopy(projectState);
    fn();
    projectPush(before);
    projectRender(form);
  }
  function projectEdit(fn) {
    if (projectPlayback || projectDraftPending) return;
    if (!projectPending) projectPending = projectCopy(projectState);
    fn();
    mediaDirty = true;
    projectStatus();
    clearTimeout(projectPendingTimer);
    projectPendingTimer = setTimeout(projectFlush, 300);
  }
  function projectMediaChanged() {
    if (!projectReady || projectApplying || projectPlayback) return;
    projectEdit(() => (projectState.media = projectCopy(mediaConfig.slides)));
  }
  function projectUndo() {
    if (projectDraftPending) return;
    projectFlush();
    if (!projectPast.length) return;
    projectFuture.push(projectCopy(projectState));
    projectState = projectPast.pop();
    projectModified();
    projectRender(true);
    projectMessage("Undid the last change.");
  }
  function projectRedo() {
    if (projectDraftPending) return;
    projectFlush();
    if (!projectFuture.length) return;
    projectPast.push(projectCopy(projectState));
    projectState = projectFuture.pop();
    projectModified();
    projectRender(true);
    projectMessage("Redid the change.");
  }
  function projectSnapshot(name, baseline = false) {
    projectFlush();
    projectCheckpoints.push({
      id: projectID("checkpoint"),
      name: name || "Checkpoint",
      created: new Date().toISOString(),
      state: projectCopy(projectState),
    });
    if (projectCheckpoints.length > 40) projectCheckpoints.shift();
    if (baseline) projectBaseline = projectCopy(projectState);
    projectModified();
    projectRecoveryList();
  }
  function projectConfirm(title, message, action) {
    projectFlush();
    $("fe-confirm-title").textContent = title;
    $("fe-confirm-message").textContent = message;
    projectConfirmAction = action;
    $("fe-confirm").showModal();
  }
  function projectTheme() {
    const b = projectState.brand;
    let style = $("project-theme");
    if (!style) {
      style = document.createElement("style");
      style.id = "project-theme";
      document.head.append(style);
    }
    style.textContent =
      ":root{--project-accent:" +
      b.accent +
      ";--project-bg:" +
      b.background +
      ";--project-ink:" +
      b.ink +
      ";--cyan:" +
      b.accent +
      "}#stage,.me-preview-stage{background:radial-gradient(ellipse at 80% 45%,color-mix(in srgb," +
      b.accent +
      " 13%," +
      b.background +
      ") 0,transparent 50%)," +
      b.background +
      ";color:" +
      b.ink +
      ';font-family:"' +
      b.font +
      '",Arial,sans-serif}#stage .eyebrow,#stage .num,#stage em,#stage .brand b,#stage .result-number,.me-preview-stage .eyebrow,.me-preview-stage .num,.me-preview-stage em{color:' +
      b.accent +
      "}#stage .fill,#stage .dot.selected{background:" +
      b.accent +
      "}#stage button{background:" +
      b.accent +
      ";color:#fff}#stage .media-background .media-original h1,#stage .media-background .media-original h2,#stage .media-background .media-original em,#stage .media-background .media-original p{color:#fff}";
    projectDecorateBrand();
  }
  function projectDecorateBrand() {
    if (!projectReady || !projectState) return;
    const brand = document.querySelector("#stage .brand"),
      b = projectState.brand;
    if (!brand) return;
    brand.querySelector(".project-logo")?.remove();
    if (b.logo) {
      const img = document.createElement("img");
      img.className = "project-logo";
      img.alt = projectMeta.name + " logo";
      img.src = mediaAssetURL(b.logo);
      brand.prepend(img);
      const glyph = brand.querySelector("b");
      if (glyph) glyph.style.display = "none";
      img.onerror = () => {
        img.remove();
        if (glyph) glyph.style.display = "";
      };
    }
  }
  function projectBindSlide(node, model) {
    if (["qa", "remqa"].includes(model.group)) {
      const eyebrow = node.querySelector(".eyebrow");
      if (eyebrow) {
        const ordinal =
          projectState.slides
            .filter((s) => s.group === model.group && !s.hidden)
            .findIndex((s) => s.id === model.id) + 1;
        eyebrow.textContent =
          (model.group === "remqa"
            ? "WORKSHOP Q&A"
            : "CUSTOMER Q&A") +
          " / " +
          String(Math.max(1, ordinal)).padStart(2, "0") +
          " / " +
          (model.topic || "General");
      }
    }
    node
      .querySelectorAll(".qa-browse")
      .forEach(
        (b) =>
          (b.onclick = () =>
            openQuestions(model.group === "remqa" ? "rem" : "faa")),
      );
    node
      .querySelectorAll(".open-detection")
      .forEach((b) => (b.onclick = () => switchDeck("detection")));
    node.querySelectorAll(".copy-command").forEach(
      (button) =>
        (button.onclick = async () => {
          const text =
              node.querySelector("pre")?.textContent.replace(/\n  /g, " ") ||
              "",
            status = node.querySelector(".copy-status");
          try {
            await Promise.race([
              navigator.clipboard.writeText(text),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error()), 1500),
              ),
            ]);
            if (status) status.textContent = "Copied";
          } catch (e) {
            if (status)
              status.textContent =
                "Select the command text and copy with Ctrl/Cmd+C.";
          }
        }),
    );
    if (model.commands) {
      let select = node.querySelector("select");
      if (!select) {
        const terminal = node.querySelector(".terminal");
        if (terminal) {
          const label = document.createElement("label");
          label.className = "command-env";
          label.textContent = "Terminal environment";
          select = document.createElement("select");
          select.setAttribute("aria-label", "Terminal environment");
          for (const [val, text] of [
            ["powershell", "Windows · PowerShell"],
            ["bash", "Linux / macOS · Bash"],
          ]) {
            const o = document.createElement("option");
            o.value = val;
            o.textContent = text;
            select.append(o);
          }
          label.append(select);
          terminal.insertBefore(label, terminal.querySelector("pre"));
        }
      }
      node._commands = model.commands;
      if (select) {
        select.value = environment;
        select.onchange = (e) => {
          environment = e.target.value;
          updateEnvironment();
        };
      }
      const pre = node.querySelector("pre");
      if (pre) pre.textContent = model.commands[environment] || "";
    }
  }
  function projectUpdateQABanks() {
    function fill(group, bank, groups) {
      const models = projectState.slides.filter(
        (s) => s.group === group && !s.hidden,
      );
      bank.splice(
        0,
        bank.length,
        ...models.map((s) => {
          const fields = projectFields(s);
          const answer =
            projectFind(
              s,
              (n) =>
                n.tag === "p" && /\bqa-answer\b/.test(n.attrs?.class || ""),
            )[0]?.node ||
            fields.find(
              (f) =>
                f.node.tag === "p" &&
                !/eyebrow/.test(f.node.attrs?.class || ""),
            )?.node;
          const takeaway = fields
            .filter(
              (f) =>
                f.node.tag === "p" &&
                !/eyebrow|qa-answer/.test(f.node.attrs?.class || ""),
            )
            .at(-1)?.node;
          return [
            s.topic || "General",
            s.title,
            projectText(answer),
            projectText(takeaway) || s.notes,
          ];
        }),
      );
      const names = [...new Set(bank.map((q) => q[0]))];
      groups.splice(
        0,
        groups.length,
        ...names.map((name) => [
          name,
          bank.map((q, i) => (q[0] === name ? i : -1)).filter((i) => i >= 0),
        ]),
      );
    }
    fill("qa", questions, questionGroups);
    fill("remqa", remQuestions, remGroups);
  }
  function projectRender(refreshForm = true) {
    if (!projectReady) return;
    projectMeta.name = projectState.projectName || projectMeta.name;
    projectApplying = true;
    mediaPauseAll();
    const activeID = slides[index]?.dataset.mediaId;
    const containers = {
      showcase: $("stage"),
      qa: $("qa-slides"),
      steps: $("steps-slides"),
      detection: $("detection-slides"),
      remshowcase: $("rem-showcase"),
      remqa: $("rem-qa"),
      remsteps: $("rem-steps"),
      overview: $("overview-slides"),
    };
    document.querySelectorAll("#stage>.slide").forEach((s) => s.remove());
    for (const [id, c] of Object.entries(containers))
      if (id !== "showcase") c.replaceChildren();
    const nodes = new Map();
    for (const model of projectState.slides) {
      const node = document.createElement("section");
      node.className = "slide " + model.classes;
      node.dataset.mediaId = model.id;
      node.dataset.title = model.title;
      node.dataset.time = model.duration;
      node.dataset.notes = model.notes;
      node.dataset.product = model.group.startsWith("rem")
        ? "rem"
        : model.group === "overview"
          ? "overview"
          : "faa";
      model.tree.forEach((n) => node.append(projectDOM(n)));
      projectBindSlide(node, model);
      if (model.group === "showcase")
        containers.showcase.insertBefore(
          node,
          containers.showcase.querySelector(":scope>footer"),
        );
      else containers[model.group].append(node);
      nodes.set(model.id, node);
    }
    const groupArrays = {
      showcase,
      qa: qaSlides,
      steps: stepSlides,
      detection: detectionSlides,
      remshowcase: remSlides,
      remqa: remQASlides,
      remsteps: remStepSlides,
      overview: overviewSlides,
    };
    for (const [id, array] of Object.entries(groupArrays))
      array.splice(
        0,
        array.length,
        ...projectState.slides
          .filter((s) => s.group === id && !s.hidden)
          .map((s) => nodes.get(s.id)),
      );
    for (const id of Object.keys(decks))
      if (!groupArrays[id] && !projectState.loops[id]) delete decks[id];
    for (const [id, loop] of Object.entries(projectState.loops)) {
      const loopNodes = loop.slideIds
        .filter((sid) =>
          projectState.slides.some((s) => s.id === sid && !s.hidden),
        )
        .map((sid) => nodes.get(sid));
      if (groupArrays[id])
        groupArrays[id].splice(0, groupArrays[id].length, ...loopNodes);
      else if (decks[id]) decks[id].splice(0, decks[id].length, ...loopNodes);
      else decks[id] = loopNodes;
    }
    for (const [id, array] of Object.entries(groupArrays)) decks[id] = array;
    allSlides.splice(0, allSlides.length, ...nodes.values());
    mediaEntries.splice(
      0,
      mediaEntries.length,
      ...projectState.slides.map((s) => ({
        id: s.id,
        title: s.title,
        group: s.group,
        label:
          projectGroupInfo.find((g) => g.id === s.group).label +
          (s.hidden ? " · hidden" : ""),
        slide: nodes.get(s.id),
        index: projectState.slides
          .filter((x) => x.group === s.group)
          .findIndex((x) => x.id === s.id),
      })),
    );
    mediaConfig = { schemaVersion: 1, slides: projectCopy(projectState.media) };
    allSlides.forEach(mediaApply);
    projectUpdateQABanks();
    if (!decks[deck]?.length)
      deck = Object.keys(decks).find((id) => decks[id].length) || "showcase";
    if (!decks[lastLoop]?.length)
      lastLoop =
        Object.keys(projectState.loops).find((id) => decks[id]?.length) || deck;
    slides = decks[deck];
    index = Math.max(
      0,
      slides.findIndex((s) => s.dataset.mediaId === activeID),
    );
    index = Math.min(index, slides.length - 1);
    for (const id of Object.keys(decks))
      if (!memory[id]) memory[id] = { index: 0, playing: false };
    for (const [id, m] of Object.entries(memory))
      if (decks[id])
        m.index = Math.max(0, Math.min(m.index, decks[id].length - 1));
    if (!nodes.has(projectSelected))
      projectSelected = projectState.slides[0]?.id;
    projectTheme();
    buildDots();
    render();
    progress();
    projectMenu();
    projectList();
    if (refreshForm) projectForm();
    projectPreview();
    if ($("media-editor").open) {
      if (!nodes.has(mediaSelected)) mediaSelected = projectSelected;
      mediaSelect(mediaSelected);
    }
    projectApplying = false;
    projectStatus();
  }
  const projectLegacyEnvironment = updateEnvironment;
  updateEnvironment = function () {
    if (!projectReady) return projectLegacyEnvironment();
    allSlides.forEach((node) => {
      if (node._commands) {
        const pre = node.querySelector("pre");
        if (pre) pre.textContent = node._commands[environment] || "";
        const select = node.querySelector("select");
        if (select) select.value = environment;
      }
    });
  };
  function projectMenu() {
    document.querySelectorAll(".custom-loop-entry").forEach((b) => b.remove());
    for (const [id, loop] of Object.entries(projectState.loops))
      if (!projectLoopDefaults.includes(id)) {
        const b = document.createElement("button");
        b.dataset.deck = id;
        b.className = "custom-loop-entry";
        const strong = document.createElement("b"),
          span = document.createElement("span");
        strong.textContent = loop.name;
        span.textContent = (decks[id]?.length || 0) + " slides · custom loop";
        b.append(strong, span);
        document.querySelector(".section-options").append(b);
      }
    document.querySelectorAll("[data-deck]").forEach((button) => {
      const target = button.dataset.deck;
      button.disabled =
        target === "pilot"
          ? !allSlides.some(
              (s) =>
                s.classList.contains("pilot-slide") &&
                !projectModel(s.dataset.mediaId)?.hidden,
            )
          : !decks[target]?.length;
      button.onclick = () => {
        closeMenu(false);
        if (target === "pilot") {
          switchDeck("showcase", false);
          const found = showcase.findIndex((s) =>
            s.classList.contains("pilot-slide"),
          );
          if (found >= 0) show(found);
          setPlaying(false);
        } else {
          switchDeck(target, false);
          setPlaying(false);
        }
      };
    });
    const qaButtons = document.querySelectorAll(
      '[data-deck="qa"] span,[data-deck="remqa"] span',
    );
    qaButtons.forEach(
      (span) =>
        (span.textContent =
          (span.parentElement.dataset.deck === "qa"
            ? questions.length
            : remQuestions.length) + " searchable customer questions"),
    );
  }
  function projectList() {
    const query = $("fe-search").value.toLowerCase().trim(),
      group = $("fe-group-filter").value;
    const models = projectState.slides.filter(
      (s) =>
        (group === "all" || s.group === group) &&
        (!query || (s.title + " " + s.topic).toLowerCase().includes(query)),
    );
    $("fe-slide-list").replaceChildren();
    $("fe-count").textContent =
      models.length + " of " + projectState.slides.length + " slides";
    models.forEach((s) => {
      const button = document.createElement("button");
      button.className =
        "fe-slide-button" +
        (s.id === projectSelected ? " selected" : "") +
        (s.hidden ? " is-hidden" : "");
      button.dataset.slideId = s.id;
      button.setAttribute(
        "aria-current",
        s.id === projectSelected ? "true" : "false",
      );
      const title = document.createElement("strong"),
        detail = document.createElement("small");
      title.textContent = s.title;
      detail.textContent =
        projectGroupInfo.find((g) => g.id === s.group).label +
        (s.hidden ? " · Hidden" : "") +
        (projectState.media[s.id] ? " · Media" : "");
      button.append(title, detail);
      button.onclick = () => {
        projectFlush();
        projectSelected = s.id;
        projectBlockPath = "";
        projectTablePath = "";
        projectList();
        projectForm();
        projectPreview();
      };
      $("fe-slide-list").append(button);
    });
  }
  function projectPreview() {
    if (!projectReady || !projectModel() || !$("full-editor").open) return;
    const model = projectModel(),
      node = allSlides.find((n) => n.dataset.mediaId === model.id);
    if (!node) return;
    projectPreviewNode?.querySelectorAll("video").forEach((v) => v.pause());
    $("fe-preview").replaceChildren();
    const root = document.createElement("div");
    root.className = "me-preview-stage";
    for (const selector of [".grid", ".orb", "header"]) {
      const n = $("stage").querySelector(":scope>" + selector);
      if (n) root.append(n.cloneNode(true));
    }
    const clone = node.cloneNode(true);
    const previewBrand = root.querySelector(".brand");
    if (previewBrand) {
      const logo = previewBrand.querySelector(".project-logo")?.cloneNode(true);
      previewBrand.textContent = model.group.startsWith("rem")
        ? "PRESENTATION / WORKSHOP"
        : model.group === "overview"
          ? "PRESENTATION / OVERVIEW"
          : "PRESENTATION / PRESENTATION";
      if (logo) previewBrand.prepend(logo);
    }
    clone.inert = false;
    clone.classList.add("active");
    clone.setAttribute("aria-hidden", "false");
    root.append(clone);
    const footer = $("stage").querySelector(":scope>footer").cloneNode(true);
    footer.querySelector(".meta").firstElementChild.textContent =
      projectMeta.name;
    footer.querySelector(".meta").lastElementChild.textContent =
      "Editor preview";
    root.append(footer);
    root.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    root.querySelectorAll("video").forEach((v) => {
      v.pause();
      v.controls = false;
      v.muted = true;
    });
    root.inert = true;
    $("fe-preview").append(root);
    projectPreviewNode = root;
    projectResizePreview();
    $("fe-slide-name").textContent = model.title;
    $("fe-slide-id").textContent =
      projectGroupInfo.find((g) => g.id === model.group).label +
      " · " +
      model.id;
  }
  function projectResizePreview() {
    if (projectPreviewNode) {
      projectPreviewNode.style.transform =
        "scale(" + $("fe-preview").clientWidth / 1920 + ")";
      projectCheckLayout();
    }
  }
  function projectCheckLayout() {
    if (!$("full-editor").open || !projectPreviewNode) return;
    const slide = projectPreviewNode.querySelector(".slide"),
      footer = projectPreviewNode.querySelector("footer"),
      r = slide.getBoundingClientRect(),
      f = footer.getBoundingClientRect();
    const overflow = [
      ...slide.querySelectorAll(
        "h1,h2,h3,p,pre,table,.card,.terminal,.media-box",
      ),
    ].some((e) => {
      const x = e.getBoundingClientRect();
      return (
        x.width > 0 &&
        x.height > 0 &&
        (x.bottom > f.top - 2 || x.left < r.left - 1 || x.right > r.right + 1)
      );
    });
    $("fe-layout-warning").hidden = !overflow;
    $("fe-layout-warning").textContent = overflow
      ? "Some content reaches the slide edge or footer. Shorten the text, reduce table rows, or choose another layout."
      : "";
  }
  function projectSelectTab(tab) {
    projectTab = tab;
    document.querySelectorAll("[data-fe-tab]").forEach((b) => {
      b.setAttribute("aria-selected", b.dataset.feTab === tab);
      b.tabIndex = b.dataset.feTab === tab ? 0 : -1;
    });
    for (const key of [
      "content",
      "table",
      "commands",
      "notes",
      "brand",
      "loops",
      "recovery",
    ])
      $("fe-" + key + "-panel").hidden = key !== tab;
    if (tab === "recovery") projectRecoveryList();
    if (tab === "loops") projectLoopForm();
    if (tab === "table") projectTableForm();
  }
  function projectForm() {
    const s = projectModel();
    if (!s) return;
    const set = (id, v) => ($(id).value = v ?? "");
    set("fe-slide-title", s.title);
    set("fe-slide-group", s.group);
    set("fe-slide-template", s.template);
    set("fe-duration", s.duration);
    $("fe-hidden").checked = s.hidden;
    set("fe-topic", s.topic);
    $("fe-topic").disabled = !["qa", "remqa"].includes(s.group);
    const fields = projectFields(s);
    $("fe-block-select").replaceChildren();
    fields.forEach(({ node, path }, i) => {
      const option = document.createElement("option");
      option.value = path;
      option.textContent =
        i +
        1 +
        ". " +
        node.tag.toUpperCase() +
        " · " +
        projectText(node).slice(0, 65);
      $("fe-block-select").append(option);
    });
    if (!fields.some((f) => f.path === projectBlockPath))
      projectBlockPath = fields[0]?.path || "";
    $("fe-block-select").value = projectBlockPath;
    set("fe-block-text", projectText(projectAt(s, projectBlockPath)));
    $("fe-block-text").disabled = !projectBlockPath;
    $("fe-remove-block").disabled = !projectBlockPath;
    set("fe-notes-text", s.notes);
    set("fe-command-ps", s.commands?.powershell || "");
    set("fe-command-bash", s.commands?.bash || "");
    $("fe-command-ps").disabled = !s.commands;
    $("fe-command-bash").disabled = !s.commands;
    set("fe-project-name", projectMeta.name);
    set("fe-accent", projectState.brand.accent);
    set("fe-bg", projectState.brand.background);
    set("fe-ink", projectState.brand.ink);
    set("fe-font", projectState.brand.font);
    $("fe-revert").disabled = !projectBaseline.slides.some(
      (x) => x.id === s.id,
    );
    projectSelectTab(projectTab);
    projectStatus();
  }
  function projectTableData(table) {
    const thead = table.children.find((n) => n.tag === "thead"),
      tbody = table.children.find((n) => n.tag === "tbody");
    let heads =
        thead?.children
          .find((n) => n.tag === "tr")
          ?.children.filter((n) => n.tag === "th" || n.tag === "td") || [],
      rows = (tbody?.children || [])
        .filter((n) => n.tag === "tr")
        .map((row) =>
          row.children.filter((n) => n.tag === "td" || n.tag === "th"),
        );
    if (!heads.length) {
      const trs = table.children.filter((n) => n.tag === "tr");
      heads = trs[0]?.children || [];
      rows = trs.slice(1).map((row) => row.children || []);
    }
    return { heads, rows };
  }
  function projectWriteTable(table, heads, rows) {
    const captions = table.children.filter((n) => n.tag === "caption");
    table.children = [
      ...captions,
      projectNode("thead", "", [
        projectNode(
          "tr",
          "",
          heads.map((v) => projectNode("th", "", [v])),
        ),
      ]),
      projectNode(
        "tbody",
        "",
        rows.map((row) =>
          projectNode(
            "tr",
            "",
            heads.map((_, i) => projectNode("td", "", [row[i] || ""])),
          ),
        ),
      ),
    ];
  }
  function projectTableForm() {
    const s = projectModel(),
      tables = projectFind(s, (n) => n.tag === "table");
    $("fe-table-select").replaceChildren();
    tables.forEach((t, i) => {
      const o = document.createElement("option");
      o.value = t.path;
      o.textContent = "Table " + (i + 1);
      $("fe-table-select").append(o);
    });
    if (!tables.some((t) => t.path === projectTablePath))
      projectTablePath = tables[0]?.path || "";
    $("fe-table-select").value = projectTablePath;
    $("fe-table-grid").replaceChildren();
    for (const id of ["fe-row-add", "fe-column-add", "fe-column-remove"])
      $(id).disabled = !projectTablePath;
    if (!projectTablePath) {
      $("fe-table-grid").textContent =
        "This slide has no table. Add one or choose the Table template.";
      return;
    }
    const table = projectAt(s, projectTablePath),
      data = projectTableData(table),
      grid = document.createElement("table"),
      header = document.createElement("tr");
    function cell(node, r, c) {
      const td = document.createElement(r < 0 ? "th" : "td"),
        input = document.createElement("input");
      input.type = "text";
      input.value = projectText(node);
      input.setAttribute(
        "aria-label",
        r < 0
          ? "Column " + (c + 1) + " heading"
          : "Row " + (r + 1) + " column " + (c + 1),
      );
      input.oninput = () =>
        projectEdit(() => projectSetText(node, input.value));
      td.append(input);
      return td;
    }
    data.heads.forEach((n, c) => header.append(cell(n, -1, c)));
    header.append(document.createElement("th"));
    grid.append(header);
    data.rows.forEach((row, r) => {
      const tr = document.createElement("tr");
      row.forEach((n, c) => tr.append(cell(n, r, c)));
      const td = document.createElement("td"),
        button = document.createElement("button");
      button.textContent = "Delete row";
      button.onclick = () =>
        projectChange(() => {
          const d = projectTableData(table);
          projectWriteTable(
            table,
            d.heads.map(projectText),
            d.rows.filter((_, i) => i !== r).map((row) => row.map(projectText)),
          );
        });
      td.append(button);
      tr.append(td);
      grid.append(tr);
    });
    $("fe-table-grid").append(grid);
  }
  function projectLoopForm() {
    const keys = Object.keys(projectState.loops);
    if (!keys.includes(projectLoop)) projectLoop = keys[0];
    $("fe-loop-select").replaceChildren();
    keys.forEach((id) => {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = projectState.loops[id].name;
      $("fe-loop-select").append(o);
    });
    $("fe-loop-select").value = projectLoop;
    const loop = projectState.loops[projectLoop];
    if (!loop) return;
    $("fe-loop-name").value = loop.name;
    $("fe-loop-delete").disabled = projectLoopDefaults.includes(projectLoop);
    $("fe-loop-order").replaceChildren();
    loop.slideIds.forEach((id, i) => {
      const model = projectModel(id),
        row = document.createElement("div");
      row.className = "fe-list-row";
      const label = document.createElement("span");
      label.textContent =
        i +
        1 +
        ". " +
        (model?.title || "Deleted slide") +
        (model?.hidden ? " · Hidden" : "");
      const tools = document.createElement("div");
      tools.className = "fe-inline";
      for (const [txt, move] of [
        ["↑", -1],
        ["↓", 1],
        ["Remove", 0],
      ]) {
        const b = document.createElement("button");
        b.textContent = txt;
        b.setAttribute("aria-label", txt + " " + (model?.title || "slide"));
        b.onclick = () =>
          projectChange(() => {
            if (!move) loop.slideIds.splice(i, 1);
            else {
              const dest = i + move;
              if (dest >= 0 && dest < loop.slideIds.length)
                [loop.slideIds[i], loop.slideIds[dest]] = [
                  loop.slideIds[dest],
                  loop.slideIds[i],
                ];
            }
          });
        tools.append(b);
      }
      row.append(label, tools);
      $("fe-loop-order").append(row);
    });
    projectLoopAvailable();
  }
  function projectLoopAvailable() {
    const loop = projectState.loops[projectLoop];
    if (!loop) return;
    const query = $("fe-loop-search").value.toLowerCase().trim();
    $("fe-loop-available").replaceChildren();
    projectState.slides
      .filter(
        (s) =>
          !s.hidden &&
          !loop.slideIds.includes(s.id) &&
          (!query || s.title.toLowerCase().includes(query)),
      )
      .forEach((s) => {
        const row = document.createElement("div");
        row.className = "fe-list-row";
        const label = document.createElement("span"),
          button = document.createElement("button");
        label.textContent = s.title;
        button.textContent = "Add";
        button.setAttribute("aria-label", "Add " + s.title + " to loop");
        button.onclick = () => projectChange(() => loop.slideIds.push(s.id));
        row.append(label, button);
        $("fe-loop-available").append(row);
      });
  }
  function projectRecoveryList() {
    if (!projectReady) return;
    $("fe-checkpoints").replaceChildren();
    if (!projectCheckpoints.length)
      $("fe-checkpoints").textContent = "No checkpoints yet.";
    projectCheckpoints
      .slice()
      .reverse()
      .forEach((c) => {
        const row = document.createElement("div");
        row.className = "fe-list-row";
        const label = document.createElement("span"),
          small = document.createElement("small"),
          button = document.createElement("button");
        label.textContent = c.name;
        small.textContent = new Date(c.created).toLocaleString();
        label.append(small);
        button.textContent = "Restore";
        button.onclick = () =>
          projectConfirm(
            "Restore checkpoint?",
            "Restore the entire project to “" +
              c.name +
              "”? A recovery checkpoint will preserve the current project first.",
            () => {
              projectSnapshot("Before restore: " + c.name);
              projectChange(() => (projectState = projectCopy(c.state)));
              projectBaseline = projectCopy(projectState);
              projectForm();
              projectMessage(
                "Checkpoint restored. Undo or the recovery checkpoint can return to the previous state.",
              );
            },
          );
        row.append(label, button);
        $("fe-checkpoints").append(row);
      });
    $("fe-trash-list").replaceChildren();
    if (!projectState.trash.length)
      $("fe-trash-list").textContent = "Trash is empty.";
    projectState.trash.forEach((s) => {
      const row = document.createElement("div");
      row.className = "fe-list-row";
      const label = document.createElement("span"),
        button = document.createElement("button");
      label.textContent = s.title;
      button.textContent = "Restore slide";
      button.onclick = () =>
        projectChange(() => {
          projectState.trash = projectState.trash.filter((x) => x.id !== s.id);
          const restored = projectCopy(s);
          delete restored._trashIndex;
          projectState.slides.splice(
            Math.min(s._trashIndex, projectState.slides.length),
            0,
            restored,
          );
          projectSelected = s.id;
        });
      row.append(label, button);
      $("fe-trash-list").append(row);
    });
  }
  function projectOpen() {
    if (projectPlayback || document.body.classList.contains("obs")) return;
    projectFlush();
    setPlaying(false);
    mediaPauseAll();
    if (!$("full-editor").open) $("full-editor").showModal();
    projectSelected = slides[index]?.dataset.mediaId || projectSelected;
    projectList();
    projectForm();
    projectPreview();
    projectRecoveryBanner();
    projectStatus();
  }
  function projectClose() {
    projectFlush();
    projectPreviewNode?.querySelectorAll("video").forEach((v) => v.pause());
    $("full-editor").close();
    $("fe-preview").replaceChildren();
    projectPreviewNode = null;
    setPlaying(false);
    activity();
  }
  function projectRecoveryBanner() {
    $("fe-recovery").hidden = !projectDraftPending;
    document.querySelector("#full-editor .fe-work").inert =
      !!projectDraftPending;
    document.querySelector("#full-editor .fe-sidebar").inert =
      !!projectDraftPending;
    if (projectDraftPending)
      $("fe-recovery-text").textContent =
        "A browser draft for “" +
        projectDraftPending.pack.meta.name +
        "” from " +
        new Date(projectDraftPending.pack.meta.updatedAt).toLocaleString() +
        " is available. Recover or discard it before editing.";
    projectStatus();
  }
  function projectOpenDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("Draft storage is unavailable."));
        return;
      }
      const req = indexedDB.open("presentation-studio-editor-v1", 1);
      req.onupgradeneeded = () => {
        for (const name of ["projects", "assets"])
          if (!req.result.objectStoreNames.contains(name))
            req.result.createObjectStore(name);
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = async () => {
        try { await studioMigrateDrafts(req.result); resolve(req.result); }
        catch (error) { req.result.close(); reject(error); }
      };
    });
  }
  function projectDBGet(store, key) {
    return new Promise((resolve, reject) => {
      const req = projectDB
        .transaction(store, "readonly")
        .objectStore(store)
        .get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function projectScheduleDraft() {
    if (projectPlayback || projectDraftPending) return;
    clearTimeout(projectDraftTimer);
    projectDraftTimer = setTimeout(projectSaveDraft, 600);
  }
  async function projectSaveDraft() {
    if (!projectReady || projectPlayback || projectDraftPending || !projectDB)
      return;
    try {
      const pack = projectPack(),
        refs = projectReferenced(pack);
      await new Promise((resolve, reject) => {
        const tx = projectDB.transaction(["projects", "assets"], "readwrite");
        tx.objectStore("projects").put(
          { pack, savedAt: new Date().toISOString() },
          projectMeta.id,
        );
        for (const asset of refs)
          if (mediaBlobs.has(asset))
            tx.objectStore("assets").put(
              mediaBlobs.get(asset),
              projectMeta.id + "|" + asset,
            );
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      $("fe-draft-status").textContent =
        "Browser recovery draft saved " +
        new Date().toLocaleTimeString() +
        ". Export a ZIP for a portable backup.";
    } catch (e) {
      $("fe-draft-status").textContent =
        "Browser draft could not be saved: " +
        e.message +
        ". Export a project ZIP.";
    }
  }
  async function projectFindDraft() {
    if (!projectDB || projectPlayback) return;
    try {
      const record = await projectDBGet("projects", projectMeta.id);
      if (record?.pack) {
        const validated = projectValidatePack(record.pack);
        const current = projectValidatePack(projectPack());
        if (
          JSON.stringify({
            state: validated.state,
            checkpoints: validated.checkpoints,
            history: validated.history,
          }) !==
          JSON.stringify({
            state: current.state,
            checkpoints: current.checkpoints,
            history: current.history,
          })
        ) {
          projectDraftPending = { ...record, pack: validated };
          projectRecoveryBanner();
        } else
          $("fe-draft-status").textContent =
            "The browser recovery draft matches this project.";
      } else
        $("fe-draft-status").textContent =
          "Draft recovery is ready. Changes will be saved in this browser automatically.";
    } catch (e) {
      $("fe-draft-status").textContent =
        "Draft recovery could not be read. Export ZIPs to preserve work.";
    }
  }
  async function projectRecoverDraft() {
    if (!projectDraftPending) return;
    try {
      const pack = projectDraftPending.pack;
      for (const asset of projectReferenced(pack)) {
        const blob = await projectDBGet("assets", pack.meta.id + "|" + asset);
        if (blob) mediaRemember(asset, blob);
      }
      projectDraftPending = null;
      projectAcceptPack(pack);
      mediaDirty = true;
      projectRecoveryBanner();
      projectMessage(
        "Recovered the browser draft, including available media and undo history. Export a ZIP for a portable copy.",
      );
    } catch (e) {
      projectMessage("Draft recovery failed: " + e.message);
    }
  }
  function projectAcceptPack(pack) {
    projectFlush();
    projectState = projectCopy(pack.state);
    projectMeta = projectCopy(pack.meta);
    projectCheckpoints = projectCopy(pack.checkpoints);
    projectPast = projectCopy(pack.history.past);
    projectFuture = projectCopy(pack.history.future);
    projectBaseline = projectCopy(projectState);
    projectSelected = projectState.slides[0].id;
    projectPlayback = !!pack.playbackOnly;
    document.body.classList.toggle("playback-only", projectPlayback);
    setPlaying(false);
    mediaDirty = false;
    projectRender(true);
    mediaSaved = projectCopy(projectState.media);
  }
  async function projectImport(file) {
    if (!file) return;
    if (projectDraftPending) {
      projectOpen();
      projectMessage(
        "Recover or discard the browser draft before importing another project.",
      );
      return;
    }
    projectFlush();
    projectMessage("Reading project…");
    try {
      let raw,
        zip = null;
      if (file.name.toLowerCase().endsWith(".zip")) {
        zip = await JSZip.loadAsync(file);
        const config = zip.file("presentation.json");
        if (!config) throw new Error("The ZIP is missing presentation.json.");
        raw = JSON.parse(await config.async("string"));
      } else raw = JSON.parse(await file.text());
      if (raw.schemaVersion === 1) {
        await projectLegacyMediaImport(file);
        projectFlush();
        projectMessage(
          "Imported legacy media settings into the current project.",
        );
        return;
      }
      const pack = projectValidatePack(raw);
      if (pack.playbackOnly)
        throw new Error(
          "This is a playback-only export. Import the editable project ZIP to continue editing.",
        );
      const assets = new Map();
      if (zip)
        for (const asset of projectReferenced(pack)) {
          const entry = zip.file(asset);
          if (!entry) throw new Error("The project ZIP is missing " + asset);
          const ext = asset.split(".").pop().toLowerCase(),
            mime =
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
              }[ext] || "application/octet-stream";
          assets.set(
            asset,
            new Blob([await entry.async("uint8array")], { type: mime }),
          );
        }
      const beforeImport = projectCopy(projectState),
        wasDirty = mediaDirty;
      const accept = () => {
        if (wasDirty) {
          const remap = new Map();
          for (const [path, blob] of assets)
            if (mediaBlobs.has(path)) {
              const recoveryPath =
                "assets/" +
                projectID("import-recovery") +
                "-" +
                mediaFilename(path.split("/").pop());
              mediaRemember(recoveryPath, mediaBlobs.get(path));
              remap.set(path, recoveryPath);
            }
          const rename = (value) =>
            typeof value === "string"
              ? remap.get(value) || value
              : Array.isArray(value)
                ? value.map(rename)
                : value && typeof value === "object"
                  ? Object.fromEntries(
                      Object.entries(value).map(([k, v]) => [k, rename(v)]),
                    )
                  : value;
          const recovery = rename(beforeImport);
          pack.checkpoints.push({
            id: projectID("checkpoint"),
            name: "Before project import",
            created: new Date().toISOString(),
            state: recovery,
          });
          pack.history.past.push(recovery);
        }
        for (const [path, blob] of assets) mediaRemember(path, blob);
        projectDraftPending = null;
        projectAcceptPack(pack);
        mediaDirty = true;
        projectModified();
        projectRecoveryBanner();
        if ($("media-editor").open) {
          mediaSelected = projectSelected;
          mediaSelect(mediaSelected);
        }
        projectMessage(
          "Imported editable project, media, checkpoints, Trash, and undo history.",
        );
        mediaMessage(
          "Editable project imported. Open Editor to change content.",
        );
      };
      if (wasDirty)
        projectConfirm(
          "Replace opened project?",
          "Importing this project replaces the opened presentation. A recovery checkpoint of your current work will be included in the imported editable project.",
          accept,
        );
      else accept();
    } catch (e) {
      projectMessage("Import failed: " + e.message);
      mediaMessage("Import failed: " + e.message);
    }
  }
  const projectLegacyMediaImport = mediaImport;
  mediaImport = projectImport;
  async function projectExport(playback = false) {
    if (projectPlayback || mediaExporting) return;
    projectFlush();
    const pack = projectPack(playback),
      refs = [...projectReferenced(pack)],
      missing = refs.filter((asset) => !mediaBlobs.has(asset));
    if (missing.length) {
      const message =
        "Import the editable project ZIP before exporting, so media in slides, Trash, and recovery history is available. " +
        missing.length +
        " asset(s) are not loaded.";
      projectMessage(message);
      mediaMessage(message);
      return;
    }
    mediaExporting = true;
    mediaState();
    projectMessage(
      "Building " + (playback ? "playback" : "editable project") + " package…",
    );
    try {
      const json = JSON.stringify(pack, null, 2),
        escaped = json.replace(/</g, "\u003c"),
        media = JSON.stringify({
          schemaVersion: 1,
          slides: pack.state.media,
        }).replace(/</g, "\u003c");
      const projectPattern =
          /<script\b(?=[^>]*\bid=["']project-config["'])[^>]*>[\s\S]*?<\/script>/i,
        mediaPattern =
          /<script\b(?=[^>]*\bid=["']media-config["'])[^>]*>[\s\S]*?<\/script>/i;
      let output = sourceTemplate
        .replace(
          projectPattern,
          () =>
            '<script id="project-config" type="application/json">' +
            escaped +
            "<\/script>",
        )
        .replace(
          mediaPattern,
          () =>
            '<script id="media-config" type="application/json">' +
            media +
            "<\/script>",
        );
      const zip = new JSZip();
      zip.file("index.html", output, { compression: "DEFLATE" });
      zip.file("presentation.json", json, { compression: "DEFLATE" });
      for (const asset of refs) zip.file(asset, mediaBlobs.get(asset));
      zip.file(
        "README.txt",
        "Presentation Studio " +
          (playback ? "playback export" : "editable project") +
          "\n\nUnzip the complete package and open index.html. No server or database is required. Keep assets beside index.html.\n\n" +
          (playback
            ? "Editor controls, recovery history, Trash, and custom presenter notes are omitted from this export. HTML and included content remain inspectable; this is not access control or copy protection. Keep the editable project separately.\n"
            : "Open Editor or press J to edit content, tables, questions, commands, branding, and loops. Edit Media or E opens the Media Manager. Import this editable ZIP before re-exporting so all media bytes, including checkpoint and Trash assets, are available. Undo/redo history and recovery snapshots are included.\n") +
          "\nBrowser drafts are recovery aids on the same browser/computer, not backups. Export an editable ZIP for a durable portable copy. Exporting does not clear undo history or reset the presentation.\n\nOBS: Browser Source, Local File, index.html, 1920 x 1080. Actual OBS testing is performed on your OBS installation.\n\nUse New presentation for a blank project or the built-in demo. Import an editable ZIP to open another presentation.\n",
      );
      const blob = await zip.generateAsync(
        { type: "blob", compression: "STORE" },
        (p) => {
          const message = "Building package · " + Math.round(p.percent) + "%";
          projectMessage(message);
          mediaMessage(message);
        },
      );
      const filename =
        (projectMeta.name.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") ||
          "presentation") +
        (playback ? "-playback" : "-editable") +
        ".zip";
      mediaDownload(blob, filename);
      if (!playback) {
        mediaDirty = false;
        mediaSaved = projectCopy(projectState.media);
        projectStatus();
        mediaState();
      }
      projectMessage(
        (playback ? "Playback" : "Editable project") +
          " ZIP export created. " +
          (playback
            ? "Keep the editable project separately."
            : "Undo history remains available."),
      );
      mediaMessage(
        "Presentation ZIP export created. Unzip it before playback.",
      );
    } catch (e) {
      projectMessage("Export failed: " + e.message);
      mediaMessage("Export failed: " + e.message);
    } finally {
      mediaExporting = false;
      mediaState();
    }
  }
  mediaExport = () => projectExport(false);
  const projectOldMediaOpen = mediaOpen;
  mediaOpen = function () {
    if (projectPlayback) return;
    if (projectDraftPending) {
      projectOpen();
      return;
    }
    projectFlush();
    projectOldMediaOpen();
  };
  function projectAddSlide(template) {
    projectChange(() => {
      const current = projectModel(),
        group =
          template === "qa"
            ? current.group.startsWith("rem")
              ? "remqa"
              : "qa"
            : current.group,
        preset = projectCreateTemplate(
          template,
          template === "qa"
            ? "New customer question"
            : "New " + template + " slide",
        ),
        id = projectID(),
        model = {
          id,
          title:
            template === "qa"
              ? "New customer question"
              : "New " + template + " slide",
          group,
          template,
          classes: preset.classes,
          tree: preset.tree,
          templateBase: projectCopy(preset.tree),
          templateClasses: preset.classes,
          duration: 12,
          hidden: false,
          notes: "",
          topic: "General",
          commands:
            template === "code"
              ? {
                  powershell: 'Write-Output "Replace with your command"',
                  bash: 'printf "%s\\n" "Replace with your command"',
                }
              : null,
        };
      model.templateCommands = projectCopy(model.commands);
      const pos =
        group === current.group
          ? projectState.slides.findIndex((s) => s.id === current.id)
          : (projectState.slides
              .map((s, i) => (s.group === group ? i : -1))
              .filter((i) => i >= 0)
              .at(-1) ?? projectState.slides.length - 1);
      projectState.slides.splice(pos + 1, 0, model);
      if (projectState.loops[group])
        projectState.loops[group].slideIds.push(id);
      projectSelected = id;
      projectBlockPath = "";
      projectTablePath = "";
    });
  }
  function projectDeleteSlide() {
    if (
      projectState.slides.filter((s) => !s.hidden).length <= 1 &&
      !projectModel().hidden
    ) {
      projectMessage("Keep at least one visible slide in the project.");
      return;
    }
    projectChange(() => {
      const at = projectState.slides.findIndex((s) => s.id === projectSelected),
        s = projectState.slides.splice(at, 1)[0];
      s._trashIndex = at;
      projectState.trash.push(s);
      projectSelected =
        projectState.slides[Math.min(at, projectState.slides.length - 1)].id;
    });
    projectMessage(
      "Slide moved to Trash. Undo or Restore slide can recover it.",
    );
  }
  function projectMove(delta) {
    projectChange(() => {
      const s = projectModel(),
        indices = projectState.slides
          .map((x, i) => (x.group === s.group ? i : -1))
          .filter((i) => i >= 0),
        i = indices.indexOf(projectState.slides.indexOf(s)),
        dest = indices[i + delta];
      if (dest === undefined) return;
      const from = indices[i];
      [projectState.slides[from], projectState.slides[dest]] = [
        projectState.slides[dest],
        projectState.slides[from],
      ];
      const loop = projectState.loops[s.group];
      if (loop) {
        const a = loop.slideIds.indexOf(s.id),
          other = projectState.slides[from].id,
          b = loop.slideIds.indexOf(other);
        if (a >= 0 && b >= 0)
          [loop.slideIds[a], loop.slideIds[b]] = [
            loop.slideIds[b],
            loop.slideIds[a],
          ];
      }
    });
  }
  function projectSetTabEvents() {
    document.querySelectorAll("[data-fe-tab]").forEach((b) => {
      b.onclick = () => {
        projectFlush();
        projectSelectTab(b.dataset.feTab);
      };
      b.onkeydown = (e) => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        e.preventDefault();
        const buttons = [...document.querySelectorAll("[data-fe-tab]")],
          index = buttons.indexOf(b),
          next =
            buttons[
              (index + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) %
                buttons.length
            ];
        next.focus();
        next.click();
      };
    });
  }
  function projectInit() {
    const openedMedia = projectCopy(mediaConfig.slides);
    projectBuiltIn = projectCaptureBuiltIn();
    projectState = projectCopy(projectBuiltIn);
    projectState.media = openedMedia;
    projectMeta = {
      id: studioBuild === "generic" ? "presentation-studio-demo-v1" : "presentation-studio-demo-v1",
      name: projectBuiltIn.projectName,
      updatedAt: new Date().toISOString(),
    };
    projectBaseline = projectCopy(projectState);
    projectSelected = projectState.slides[0].id;
    let initial = null;
    try {
      const raw = JSON.parse($("project-config").textContent);
      if (raw?.schemaVersion === 2) initial = projectValidatePack(raw);
    } catch (e) {
      console.warn("Project content could not be loaded:", e.message);
    }
    if (initial) {
      projectState = initial.state;
      projectMeta = initial.meta;
      projectCheckpoints = initial.checkpoints;
      projectPast = initial.history.past;
      projectFuture = initial.history.future;
      projectPlayback = initial.playbackOnly;
      projectBaseline = projectCopy(projectState);
      projectSelected = projectState.slides[0].id;
    }
    projectReady = true;
    document.body.classList.toggle("playback-only", projectPlayback);
    for (const group of projectGroupInfo)
      for (const id of ["fe-group-filter", "fe-slide-group"]) {
        const o = document.createElement("option");
        o.value = group.id;
        o.textContent = group.label;
        $(id).append(o);
      }
    projectBindEvents();
    projectRender(true);
    projectSetTabEvents();
    new ResizeObserver(projectResizePreview).observe($("fe-preview"));
    if (!projectPlayback)
      projectOpenDB()
        .then((db) => {
          projectDB = db;
          projectFindDraft();
        })
        .catch((e) => {
          $("fe-draft-status").textContent =
            "Browser draft recovery unavailable. Export project ZIPs to preserve your changes.";
        });
  }
  function projectBindEvents() {
    $("open-full-editor").onclick = projectOpen;
    $("fe-close").onclick = projectClose;
    $("full-editor").addEventListener("cancel", (e) => {
      e.preventDefault();
      projectClose();
    });
    $("full-editor").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) projectRedo();
        else projectUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        e.stopPropagation();
        projectRedo();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        projectClose();
      }
    });
    $("fe-confirm-cancel").onclick = () => {
      $("fe-confirm").close();
      projectConfirmAction = null;
    };
    $("fe-confirm-accept").onclick = () => {
      const fn = projectConfirmAction;
      projectConfirmAction = null;
      $("fe-confirm").close();
      if (fn) fn();
    };
    $("fe-undo").onclick = projectUndo;
    $("fe-redo").onclick = projectRedo;
    $("fe-search").oninput = projectList;
    $("fe-group-filter").onchange = projectList;
    $("fe-add").onclick = () => projectAddSlide($("fe-new-template").value);
    $("fe-up").onclick = () => projectMove(-1);
    $("fe-down").onclick = () => projectMove(1);
    $("fe-trash-slide").onclick = projectDeleteSlide;
    $("fe-duplicate").onclick = () =>
      projectChange(() => {
        const source = projectModel(),
          copy = projectCopy(source);
        copy.id = projectID();
        copy.title = source.title + " (copy)";
        const heading = projectHeading(copy);
        if (heading) projectSetText(heading.node, copy.title);
        const at = projectState.slides.indexOf(source);
        projectState.slides.splice(at + 1, 0, copy);
        if (projectState.media[source.id])
          projectState.media[copy.id] = projectCopy(
            projectState.media[source.id],
          );
        for (const loop of Object.values(projectState.loops)) {
          const i = loop.slideIds.indexOf(source.id);
          if (i >= 0) loop.slideIds.splice(i + 1, 0, copy.id);
        }
        projectSelected = copy.id;
      });
    $("fe-slide-title").oninput = (e) =>
      projectEdit(() => {
        const s = projectModel();
        s.title = e.target.value || "Untitled slide";
        const h = projectHeading(s);
        if (h) projectSetText(h.node, s.title);
      });
    $("fe-slide-group").onchange = (e) => {
      const group = e.target.value;
      if (
        projectState.sections.find((s) => s.id === group)?.hidden &&
        studioEffectiveVisible(projectModel()) &&
        projectState.slides.filter(studioEffectiveVisible).length <= 1
      ) {
        e.target.value = projectModel().group;
        projectMessage("Keep a visible slide in a visible section.");
        return;
      }
      projectChange(() => {
        const s = projectModel(),
          old = s.group;
        s.group = group;
        if (["qa", "remqa"].includes(group) && !s.topic) s.topic = "General";
        if (projectState.loops[old])
          projectState.loops[old].slideIds = projectState.loops[
            old
          ].slideIds.filter((id) => id !== s.id);
        if (
          projectState.loops[group] &&
          !projectState.loops[group].slideIds.includes(s.id)
        )
          projectState.loops[group].slideIds.push(s.id);
      });
    };
    $("fe-duration").oninput = (e) =>
      projectEdit(
        () =>
          (projectModel().duration = Math.max(
            3,
            Math.min(600, Number(e.target.value) || 12),
          )),
      );
    $("fe-hidden").onchange = (e) => {
      const hidden = e.target.checked;
      if (hidden && projectState.slides.filter((s) => !s.hidden).length <= 1) {
        e.target.checked = false;
        projectMessage("Keep at least one visible slide.");
        return;
      }
      projectChange(() => (projectModel().hidden = hidden));
    };
    $("fe-topic").oninput = (e) =>
      projectEdit(() => (projectModel().topic = e.target.value || "General"));
    $("fe-slide-template").onchange = (e) => {
      const template = e.target.value;
      projectChange(() => {
        const s = projectModel();
        if (template === "original") {
          const original = projectBuiltIn.slides.find((x) => x.id === s.id);
          if (original) {
            s.tree = projectCopy(original.tree);
            s.classes = original.classes;
            s.commands = projectCopy(original.commands);
            s.title = original.title;
          } else {
            s.tree = projectCopy(s.templateBase);
            s.classes = s.templateClasses;
          }
        } else {
          const preset = projectCreateTemplate(template, s.title);
          s.tree = preset.tree;
          s.classes = preset.classes;
          s.templateBase = projectCopy(preset.tree);
          s.templateClasses = preset.classes;
          s.commands =
            template === "code"
              ? {
                  powershell: 'Write-Output "Replace with your command"',
                  bash: 'printf "%s\\n" "Replace with your command"',
                }
              : null;
        }
        s.templateCommands = projectCopy(s.commands);
        s.template = template;
        projectBlockPath = "";
        projectTablePath = "";
      });
    };
    $("fe-block-select").onchange = (e) => {
      projectFlush();
      projectBlockPath = e.target.value;
      $("fe-block-text").value = projectText(
        projectAt(projectModel(), projectBlockPath),
      );
    };
    $("fe-block-text").oninput = (e) =>
      projectEdit(() => {
        const node = projectAt(projectModel(), projectBlockPath);
        if (node) projectSetText(node, e.target.value);
      });
    $("fe-remove-block").onclick = () =>
      projectChange(() => {
        if (!projectBlockPath) return;
        const parts = projectBlockPath.split("."),
          last = Number(parts.pop()),
          parent = parts.reduce((v, k) => v[k], projectModel().tree);
        parent.splice(last, 1);
        projectBlockPath = "";
      });
    $("fe-add-paragraph").onclick = () =>
      projectChange(() => {
        const s = projectModel(),
          first = s.tree.find((n) => n.tag === "div");
        (first?.children || s.tree).push(
          projectNode("p", "lead", ["New paragraph"]),
        );
        projectBlockPath = "";
      });
    $("fe-add-bullets").onclick = () =>
      projectChange(() => {
        const s = projectModel(),
          first = s.tree.find((n) => n.tag === "div");
        (first?.children || s.tree).push(
          projectNode("ul", "editor-bullets", [
            projectNode("li", "", ["First point"]),
            projectNode("li", "", ["Second point"]),
          ]),
        );
        projectBlockPath = "";
      });
    $("fe-table-select").onchange = (e) => {
      projectFlush();
      projectTablePath = e.target.value;
      projectTableForm();
    };
    $("fe-table-add").onclick = () =>
      projectChange(() => {
        const s = projectModel(),
          table = projectCreateTemplate("table", s.title).tree[1];
        s.tree.push(table);
        s.classes = "wide editor-table-slide";
        projectTablePath = "";
      });
    $("fe-row-add").onclick = () =>
      projectChange(() => {
        const t = projectAt(projectModel(), projectTablePath),
          d = projectTableData(t);
        projectWriteTable(t, d.heads.map(projectText), [
          ...d.rows.map((r) => r.map(projectText)),
          d.heads.map(() => "New value"),
        ]);
      });
    $("fe-column-add").onclick = () =>
      projectChange(() => {
        const t = projectAt(projectModel(), projectTablePath),
          d = projectTableData(t);
        projectWriteTable(
          t,
          [...d.heads.map(projectText), "New column"],
          d.rows.map((r) => [...r.map(projectText), ""]),
        );
      });
    $("fe-column-remove").onclick = () =>
      projectChange(() => {
        const t = projectAt(projectModel(), projectTablePath),
          d = projectTableData(t);
        if (d.heads.length > 1)
          projectWriteTable(
            t,
            d.heads.slice(0, -1).map(projectText),
            d.rows.map((r) => r.slice(0, -1).map(projectText)),
          );
      });
    for (const [id, key] of [
      ["fe-command-ps", "powershell"],
      ["fe-command-bash", "bash"],
    ])
      $(id).oninput = (e) =>
        projectEdit(() => {
          projectModel().commands[key] = e.target.value;
        });
    $("fe-enable-commands").onclick = () =>
      projectChange(() => {
        const s = projectModel();
        if (s.commands) return;
        s.commands = {
          powershell: 'Write-Output "Replace with your command"',
          bash: 'printf "%s\\n" "Replace with your command"',
        };
        const terminal = projectCreateTemplate("code", s.title).tree[1];
        s.tree.push(terminal);
        s.classes = "steps-slide";
      });
    $("fe-notes-text").oninput = (e) =>
      projectEdit(() => (projectModel().notes = e.target.value));
    $("fe-project-name").oninput = (e) =>
      projectEdit(() => {
        projectState.projectName = e.target.value || "Untitled presentation";
        projectMeta.name = projectState.projectName;
      });
    for (const [id, key] of [
      ["fe-accent", "accent"],
      ["fe-bg", "background"],
      ["fe-ink", "ink"],
      ["fe-font", "font"],
    ])
      $(id).oninput = (e) =>
        projectEdit(() => (projectState.brand[key] = e.target.value));
    $("fe-logo-file").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        projectMessage("Choose an image for the logo.");
        return;
      }
      const path =
        "assets/" + projectID("logo") + "-" + mediaFilename(file.name);
      mediaRemember(path, file);
      projectChange(() => (projectState.brand.logo = path));
      e.target.value = "";
    };
    $("fe-logo-remove").onclick = () =>
      projectChange(() => (projectState.brand.logo = ""));
    $("fe-loop-select").onchange = (e) => {
      projectFlush();
      projectLoop = e.target.value;
      projectLoopForm();
    };
    $("fe-loop-name").oninput = (e) =>
      projectEdit(
        () =>
          (projectState.loops[projectLoop].name =
            e.target.value || "Custom loop"),
      );
    $("fe-loop-search").oninput = projectLoopAvailable;
    $("fe-loop-new").onclick = () =>
      projectChange(() => {
        const id = projectID("loop");
        projectState.loops[id] = {
          name: "Custom kiosk loop",
          slideIds: [projectSelected],
        };
        projectLoop = id;
      });
    $("fe-loop-delete").onclick = () => {
      if (projectLoopDefaults.includes(projectLoop)) return;
      projectChange(() => {
        delete projectState.loops[projectLoop];
        projectLoop = "combined";
      });
    };
    $("fe-loop-present").onclick = () => {
      projectFlush();
      if (!decks[projectLoop]?.length) {
        projectMessage("Add at least one visible slide to this loop.");
        return;
      }
      switchDeck(projectLoop, false);
      show(0);
      projectClose();
      setPlaying(true);
    };
    $("fe-checkpoint-create").onclick = () => {
      projectSnapshot(
        $("fe-checkpoint-name").value.trim() ||
          "Checkpoint " + (projectCheckpoints.length + 1),
        true,
      );
      $("fe-checkpoint-name").value = "";
      projectForm();
      projectMessage(
        "Checkpoint created. Revert Slide now uses this checkpoint as its baseline.",
      );
    };
    $("fe-revert").onclick = () => {
      const baseline = projectBaseline.slides.find(
        (s) => s.id === projectSelected,
      );
      if (!baseline) return;
      projectConfirm(
        "Revert selected slide?",
        "Restore this slide’s content, layout, notes, visibility, and media to its opened or last-checkpoint state? Other slides stay as they are.",
        () => {
          projectSnapshot("Before reverting " + projectModel().title);
          projectChange(() => {
            const at = projectState.slides.findIndex(
              (s) => s.id === projectSelected,
            );
            projectState.slides[at] = projectCopy(baseline);
            if (projectBaseline.media[projectSelected])
              projectState.media[projectSelected] = projectCopy(
                projectBaseline.media[projectSelected],
              );
            else delete projectState.media[projectSelected];
          });
        },
      );
    };
    $("fe-reset-slide").onclick = () =>
      projectConfirm(
        "Reset selected slide to template?",
        "Restore the starting content and layout of this template and remove the slide’s media. Notes and other slides stay as they are. A recovery checkpoint is created first.",
        () => {
          projectSnapshot("Before resetting " + projectModel().title);
          projectChange(() => {
            const s = projectModel();
            s.tree = projectCopy(s.templateBase);
            s.classes = s.templateClasses;
            s.commands = projectCopy(s.templateCommands);
            const h = projectHeading(s);
            s.title = projectText(h?.node) || "New slide";
            delete projectState.media[s.id];
          });
        },
      );
    $("fe-reset-project").onclick = () =>
      projectConfirm(
        "Reset entire presentation?",
        "Replace all custom slides, text, media assignments, branding, kiosk loops, and Trash with the built-in Studio demo? A recovery checkpoint preserves the current project first.",
        () => {
          projectSnapshot("Before full presentation reset");
          projectChange(() => (projectState = projectCopy(projectBuiltIn)));
          projectMessage(
            "Built-in presentation restored. Undo or the recovery checkpoint can restore your customization.",
          );
        },
      );
    $("me-export").onclick = () => projectExport(false);
    $("me-json").textContent = "Media settings JSON";
    $("me-show-slide").onclick = () => {
      const entry = mediaGetEntry(),
        model = projectModel(entry.id);
      if (model.hidden) {
        mediaMessage("Unhide this slide in Editor before presenting it.");
        return;
      }
      let target = entry.group;
      if (!decks[target]?.some((n) => n.dataset.mediaId === entry.id)) {
        target = "editor-preview";
        decks[target] = [entry.slide];
        memory[target] = { index: 0, playing: false };
      }
      switchDeck(target, false);
      show(decks[target].findIndex((n) => n.dataset.mediaId === entry.id));
      setPlaying(false);
      mediaClose();
    };
    $("fe-import").onclick = () => $("fe-import-file").click();
    $("fe-import-file").onchange = (e) => {
      projectImport(e.target.files[0]);
      e.target.value = "";
    };
    $("fe-export").onclick = () => projectExport(false);
    $("fe-playback").onclick = () => projectExport(true);
    $("fe-export-json").onclick = () => {
      mediaDownload(
        new Blob([JSON.stringify(projectPack(), null, 2)], {
          type: "application/json",
        }),
        "presentation.json",
      );
      projectMessage(
        "Project JSON exported without media bytes. Export an editable ZIP for the complete project.",
      );
    };
    $("fe-show").onclick = () => {
      projectFlush();
      const s = projectModel();
      if (s.hidden) {
        projectMessage("Unhide this slide before presenting it.");
        return;
      }
      let target = s.group;
      if (!decks[target]?.some((n) => n.dataset.mediaId === s.id)) {
        target = "editor-preview";
        decks[target] = [allSlides.find((n) => n.dataset.mediaId === s.id)];
        memory[target] = { index: 0, playing: false };
      }
      switchDeck(target, false);
      show(decks[target].findIndex((n) => n.dataset.mediaId === s.id));
      projectClose();
    };
    $("fe-media").onclick = () => {
      projectFlush();
      const id = projectSelected;
      projectClose();
      mediaOpen();
      mediaSelect(id);
    };
    $("fe-recover").onclick = projectRecoverDraft;
    $("fe-discard-draft").onclick = () =>
      projectConfirm(
        "Discard browser recovery draft?",
        "Delete the browser recovery draft for this project? The currently opened project is unchanged. Exported ZIPs are unaffected.",
        async () => {
          projectDraftPending = null;
          if (projectDB)
            await new Promise((resolve, reject) => {
              const tx = projectDB.transaction("projects", "readwrite");
              tx.objectStore("projects").delete(projectMeta.id);
              tx.oncomplete = resolve;
              tx.onerror = () => reject(tx.error);
            });
          projectRecoveryBanner();
          projectMessage(
            "Browser draft discarded. The opened project is unchanged.",
          );
        },
      );
  }
