// Direct manipulation of the existing safe slide AST. Preview-only attributes
// never enter the project model or exported presentation content.
const vbIDs = new WeakMap();
let vbSerial = 0,
  vbMode = "edit",
  vbSession = null,
  vbSelected = null,
  vbRange = null,
  vbSkipPreview = false,
  vbClosing = false;
const vbDOM = projectDOM;
projectDOM = function (node) {
  const el = vbDOM(node);
  if (el.nodeType === 1) {
    if (!vbIDs.has(node)) vbIDs.set(node, String(++vbSerial));
    el.dataset.vbNode = vbIDs.get(node);
  }
  return el;
};
const vbSafeStyle = projectSafeStyle;
projectSafeStyle = function (style) {
  return String(style || "")
    .split(";")
    .map((rule) =>
      /^\s*text-align\s*:\s*(left|center|right)\s*$/i.test(rule)
        ? rule
        : vbSafeStyle(rule),
    )
    .filter(Boolean)
    .join(";");
};
const vbTextTags = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "li",
  "td",
  "th",
  "caption",
]);
function vbIsText(node) {
  if (vbTextTags.has(node.tag)) return true;
  return (
    node.tag === "div" &&
    /\bnum\b/.test(node.attrs?.class || "") &&
    !node.children?.some(
      (c) => c.tag && ["div", "p", "button", "select", "label"].includes(c.tag),
    )
  );
}
function vbNode() {
  return vbSelected?.path
    ? projectAt(projectModel(vbSelected.slideID), vbSelected.path)
    : null;
}
function vbCanRemove() {
  if (!vbSelected) return false;
  if (vbSelected.kind === "media")
    return !!projectState.media[vbSelected.slideID];
  if (vbSelected.kind === "logo") return true;
  const node = vbNode();
  if (
    !node ||
    ["td", "th", "caption"].includes(node.tag) ||
    vbSelected.kind === "commands"
  )
    return false;
  const heading = projectHeading(projectModel(vbSelected.slideID));
  return (
    !heading ||
    !(
      heading.path === vbSelected.path ||
      heading.path.startsWith(vbSelected.path + ".")
    )
  );
}
function vbCanDuplicate() {
  const n = vbNode();
  return (
    !!n &&
    vbCanRemove() &&
    !["media", "logo", "commands"].includes(vbSelected.kind)
  );
}
function vbToolbar() {
  const selected = vbSelected,
    node = vbNode(),
    text = selected?.kind === "text",
    toolbar = $("vb-toolbar");
  toolbar.hidden = !selected || vbMode !== "edit";
  if (!selected) return;
  $("vb-selection-label").textContent =
    {
      media: "Media",
      logo: "Logo",
      card: "Card",
      commands: "Commands · use panel",
      list: "List",
    }[selected.kind] ||
    (["td", "th"].includes(node?.tag)
      ? "Table cell"
      : node?.tag?.toUpperCase() + " block");
  for (const id of ["vb-bold", "vb-italic", "vb-align"]) $(id).disabled = !text;
  $("vb-bullets").disabled = !(text && node?.tag === "p");
  $("vb-duplicate").disabled = !vbCanDuplicate();
  $("vb-delete").disabled = !vbCanRemove();
  $("vb-delete").textContent =
    selected.kind === "media"
      ? "Remove media"
      : selected.kind === "logo"
        ? "Remove logo"
        : "Delete block";
  $("vb-edit-text").hidden =
    selected.kind !== "card" && selected.kind !== "list";
  $("vb-panel").textContent =
    selected.kind === "media"
      ? "Media settings"
      : selected.kind === "logo"
        ? "Branding"
        : selected.kind === "commands"
          ? "Commands panel"
          : "Edit in panel";
  $("vb-align").value =
    (node?.attrs?.style || "").match(
      /text-align\s*:\s*(left|center|right)/i,
    )?.[1] || "left";
  for (const [id, tags] of [
    ["vb-bold", "strong,b"],
    ["vb-italic", "i"],
  ]) {
    const anchor = window.getSelection()?.anchorNode;
    const element = anchor?.nodeType === 1 ? anchor : anchor?.parentElement;
    $(id).setAttribute(
      "aria-pressed",
      !!(
        text &&
        element?.closest(tags) &&
        vbSession?.el.contains(element.closest(tags))
      ),
    );
  }
}
function vbSetSelection(selection) {
  projectPreviewNode
    ?.querySelectorAll(".vb-selected")
    .forEach((e) => e.classList.remove("vb-selected"));
  vbSelected = selection;
  selection?.el.classList.add("vb-selected");
  vbToolbar();
}
function vbSyncPanel() {
  const selected = vbSelected,
    model = selected && projectModel(selected.slideID);
  if (!model) return;
  $("fe-slide-title").value = model.title;
  $("fe-slide-name").textContent = model.title;
  if (selected.kind === "text" || selected.kind === "list") {
    const node = projectAt(model, selected.path);
    if (!node) return;
    const fields = projectFields(model);
    fields.forEach(({ node, path }, i) => {
      const option = [...$("fe-block-select").options].find(
        (o) => o.value === path,
      );
      if (option)
        option.textContent =
          i +
          1 +
          ". " +
          node.tag.toUpperCase() +
          " · " +
          projectText(node).slice(0, 65);
    });
    const field =
      fields.find((f) => f.path === selected.path) ||
      fields.find(
        (f) =>
          ["ul", "ol"].includes(f.node.tag) &&
          selected.path.startsWith(f.path + "."),
      );
    if (field) {
      projectBlockPath = field.path;
      $("fe-block-select").value = field.path;
      $("fe-block-text").value = projectText(field.node);
    }
    if (["td", "th", "caption"].includes(node.tag)) {
      const table = projectFind(model, (n) => n.tag === "table").find((t) =>
        selected.path.startsWith(t.path + "."),
      );
      if (table) {
        projectTablePath = table.path;
        projectTableForm();
      }
    }
  }
}
function vbReadInline(element) {
  let count = 0;
  const parse = (node) => {
    if (++count > 12000) return [];
    if (node.nodeType === 3)
      return [{ text: node.textContent.slice(0, 100000) }];
    if (node.nodeType !== 1) return [];
    const tag = node.tagName.toLowerCase();
    if (
      ["script", "style", "iframe", "object", "svg", "img", "video"].includes(
        tag,
      )
    )
      return [];
    if (tag === "br") return [{ tag: "br", attrs: {}, children: [] }];
    const children = [...node.childNodes].flatMap(parse);
    if (["div", "p"].includes(tag))
      return [...children, { tag: "br", attrs: {}, children: [] }];
    if (!["strong", "b", "i", "em", "span", "small", "a", "code"].includes(tag))
      return children;
    const safe = projectSerialize(node);
    return [{ tag, attrs: safe?.attrs || {}, children }];
  };
  return [...element.childNodes].flatMap(parse);
}
function vbWrite() {
  if (!vbSession) return;
  const { el, path, slideID } = vbSession,
    children = vbReadInline(el);
  projectEdit(() => {
    const model = projectModel(slideID),
      node = projectAt(model, path);
    if (!node) return;
    node.children = children;
    const heading = projectHeading(model);
    if (heading?.path === path) {
      model.title =
        projectText(node).replace(/\s+/g, " ").trim().slice(0, 500) ||
        "Untitled slide";
    }
  });
  vbSyncPanel();
  projectCheckLayout();
}
function vbEnd(rebuild = true) {
  if (vbClosing) return;
  vbClosing = true;
  const session = vbSession;
  vbSession = null;
  vbRange = null;
  if (session) {
    session.el.removeAttribute("contenteditable");
    session.el.removeAttribute("role");
    session.el.classList.remove("vb-editing");
  }
  vbSkipPreview = true;
  projectFlush();
  vbSkipPreview = false;
  if (session) vbSyncPanel();
  vbClosing = false;
  if (rebuild) {
    vbSelected = null;
    $("vb-toolbar").hidden = true;
    projectPreview();
  }
}
function vbStart(selection) {
  if (projectDraftPending || projectPlayback || vbMode !== "edit") return;
  if (vbSession?.el === selection.el) {
    vbToolbar();
    return;
  }
  vbEnd(false);
  vbSetSelection(selection);
  if (selection.kind !== "text") return;
  vbSession = selection;
  const el = selection.el;
  el.contentEditable = "true";
  el.setAttribute("role", "textbox");
  el.setAttribute("aria-multiline", "true");
  el.classList.add("vb-editing");
  el.spellcheck = true;
  el.focus({ preventScroll: true });
  vbSyncPanel();
}
function vbInsertText(text) {
  const el = vbSession?.el;
  if (!el || text === "") return;
  let range = window.getSelection()?.rangeCount
    ? window.getSelection().getRangeAt(0)
    : null;
  if (!range || !el.contains(range.commonAncestorContainer)) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.deleteContents();
  const fragment = document.createDocumentFragment(),
    lines = String(text).slice(0, 100000).split(/\r?\n/);
  let last = null;
  lines.forEach((line, i) => {
    if (i) fragment.append(document.createElement("br"));
    last = document.createTextNode(line);
    fragment.append(last);
  });
  range.insertNode(fragment);
  range.setStartAfter(last);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  vbRange = range.cloneRange();
  vbWrite();
}
function vbFormat(tag) {
  if (!vbSession || vbSelected.kind !== "text") return;
  const el = vbSession.el;
  el.focus({ preventScroll: true });
  let range = vbRange?.cloneRange();
  if (
    !range ||
    !el.contains(range.commonAncestorContainer) ||
    range.collapsed
  ) {
    range = document.createRange();
    range.selectNodeContents(el);
  }
  const common = range.commonAncestorContainer,
    ancestor = (common.nodeType === 1 ? common : common.parentElement).closest(
      tag === "strong" ? "strong,b" : "i",
    );
  if (ancestor && el.contains(ancestor) && ancestor !== el) {
    const before = document.createRange(),
      after = document.createRange();
    before.selectNodeContents(ancestor);
    before.setEnd(range.startContainer, range.startOffset);
    after.selectNodeContents(ancestor);
    after.setStart(range.endContainer, range.endOffset);
    const prefix = before.cloneContents(),
      suffix = after.cloneContents();
    let selected = range.cloneContents();
    selected
      .querySelectorAll(tag === "strong" ? "strong,b" : "i")
      .forEach((n) => n.replaceWith(...n.childNodes));
    let context = common.nodeType === 1 ? common : common.parentElement;
    while (context && context !== ancestor) {
      if (
        ["EM", "I", "STRONG", "B", "SPAN", "SMALL", "A", "CODE"].includes(
          context.tagName,
        ) &&
        !context.matches(tag === "strong" ? "strong,b" : "i")
      ) {
        const wrapper = context.cloneNode(false);
        wrapper.append(selected);
        const f = document.createDocumentFragment();
        f.append(wrapper);
        selected = f;
      }
      context = context.parentElement;
    }
    const fragment = document.createDocumentFragment(),
      start = document.createTextNode(""),
      end = document.createTextNode("");
    if (prefix.hasChildNodes()) {
      const wrapper = ancestor.cloneNode(false);
      wrapper.append(prefix);
      fragment.append(wrapper);
    }
    fragment.append(start, selected, end);
    if (suffix.hasChildNodes()) {
      const wrapper = ancestor.cloneNode(false);
      wrapper.append(suffix);
      fragment.append(wrapper);
    }
    ancestor.replaceWith(fragment);
    range = document.createRange();
    range.setStartAfter(start);
    range.setEndBefore(end);
    start.remove();
    end.remove();
  } else if (
    el.children.length === 1 &&
    el.firstElementChild.matches(tag === "strong" ? "strong,b" : "i") &&
    range.toString() === el.textContent
  ) {
    el.firstElementChild.replaceWith(...el.firstElementChild.childNodes);
  } else {
    const wrapper = document.createElement(tag);
    wrapper.append(range.extractContents());
    range.insertNode(wrapper);
    range.selectNodeContents(wrapper);
  }
  const selection = window.getSelection();
  selection.removeAllRanges();
  try {
    selection.addRange(range);
  } catch {}
  vbRange = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  vbWrite();
  vbToolbar();
}
function vbFocusPath(path, kind) {
  const el = projectPreviewNode?.querySelector('[data-vb-path="' + path + '"]');
  if (el)
    vbStart({
      el,
      path,
      kind: kind || el.dataset.vbKind,
      slideID: projectSelected,
    });
}
function vbModify(action) {
  if (!vbSelected) return;
  const selected = { ...vbSelected },
    path = selected.path,
    model = projectModel(selected.slideID);
  if (
    (action === "duplicate" && !vbCanDuplicate()) ||
    (action === "delete" && !vbCanRemove())
  )
    return;
  vbEnd(false);
  vbSelected = null;
  let nextPath = "";
  projectChange(() => {
    if (selected.kind === "media") {
      if (action === "delete") delete projectState.media[selected.slideID];
      return;
    }
    if (selected.kind === "logo") {
      const b = projectState.brand,
        key =
          b.presentationTheme === "dark" && b.logoDark
            ? "logoDark"
            : b.presentationTheme !== "dark" && b.logoLight
              ? "logoLight"
              : "logo";
      b[key] = "";
      return;
    }
    const parts = path.split("."),
      index = Number(parts.pop()),
      parent = parts.reduce((v, k) => v[k], model.tree),
      node = parent[index];
    if (action === "duplicate") {
      parent.splice(index + 1, 0, projectCopy(node));
      nextPath = [...parts, String(index + 1)].join(".");
    }
    if (action === "delete") parent.splice(index, 1);
    if (action === "bullets" && node.tag === "p") {
      const text = (function plain(n) {
        return "text" in n
          ? n.text
          : n.tag === "br"
            ? "\n"
            : (n.children || []).map(plain).join("");
      })(node);
      node.tag = "ul";
      node.attrs = {
        ...node.attrs,
        class: (
          (node.attrs?.class || "").replace(/\blead\b/g, "").trim() +
          " editor-bullets"
        ).trim(),
      };
      node.children = text
        .split(/\n+/)
        .filter(Boolean)
        .map((text) => projectNode("li", "", [text]));
      nextPath = path;
    }
  });
  if (nextPath)
    vbFocusPath(nextPath, action === "bullets" ? "list" : selected.kind);
  else vbToolbar();
}
function vbPanel() {
  const selection = vbSelected;
  if (!selection) return;
  vbEnd(false);
  if (selection.kind === "media") {
    $("fe-media").click();
    return;
  }
  if (selection.kind === "logo") {
    projectSelectTab("brand");
    $("fe-brand-panel").scrollIntoView({ block: "nearest" });
    return;
  }
  if (selection.kind === "commands") {
    projectSelectTab("commands");
    $("fe-command-ps").focus();
    return;
  }
  const node = projectAt(projectModel(selection.slideID), selection.path);
  if (["td", "th", "caption"].includes(node?.tag)) {
    projectSelectTab("table");
    vbSyncPanel();
    $("fe-table-panel").scrollIntoView({ block: "nearest" });
    return;
  }
  projectSelectTab("content");
  projectForm();
  if (projectFields(projectModel()).some((f) => f.path === selection.path)) {
    projectBlockPath = selection.path;
    $("fe-block-select").value = selection.path;
    $("fe-block-text").value = projectText(node);
    $("fe-block-text").focus();
  }
}
function vbAttach(root) {
  if (!root) return;
  root.inert = false;
  root.dataset.blockMode = vbMode;
  root.setAttribute("role", "group");
  root.setAttribute(
    "aria-label",
    vbMode === "edit"
      ? "Slide preview: edit blocks"
      : "Slide preview: interactive preview",
  );
  root
    .querySelector("header")
    ?.setAttribute("aria-label", "Presentation header");
  root.querySelector("footer").inert = true;
  const slide = root.querySelector(".slide"),
    model = projectModel(),
    paths = new Map();
  projectWalk(model.tree, (node, path) => {
    const id = vbIDs.get(node);
    if (id) paths.set(id, { node, path: path.join(".") });
  });
  for (const el of slide.querySelectorAll("[data-vb-node]")) {
    const item = paths.get(el.dataset.vbNode);
    if (!item) continue;
    const n = item.node;
    let kind = vbIsText(n)
      ? "text"
      : /\bcard\b/.test(n.attrs?.class || "")
        ? "card"
        : n.tag === "ul" || n.tag === "ol"
          ? "list"
          : /\bterminal\b/.test(n.attrs?.class || "")
            ? "commands"
            : "";
    if (!kind) continue;
    el.dataset.vbPath = item.path;
    el.dataset.vbKind = kind;
    if (vbMode === "edit") {
      el.classList.add("vb-target");
      el.tabIndex = 0;
      el.setAttribute(
        "aria-label",
        "Edit " +
          (kind === "text" ? n.tag : kind) +
          ": " +
          projectText(n).slice(0, 90),
      );
    }
  }
  const media = slide.querySelector(".media-box");
  if (media && vbMode === "edit") {
    media.classList.add("vb-target");
    media.tabIndex = 0;
    media.setAttribute("aria-label", "Select media and open media settings");
  }
  if (vbMode === "preview") {
    projectBindSlide(slide, model);
    const env = slide.querySelector(".terminal select");
    if (env && model.commands)
      env.onchange = (e) => {
        environment = e.target.value;
        updateEnvironment();
        slide.querySelector("pre").textContent =
          model.commands[environment] || "";
      };
    for (const v of root.querySelectorAll("video")) {
      v.controls = true;
      v.autoplay = false;
      v.muted = true;
      v.pause();
    }
    root.querySelector("header").inert = true;
  } else {
    root.querySelectorAll("video").forEach((v) => {
      v.pause();
      v.controls = false;
    });
    root.addEventListener(
      "click",
      (event) => {
        const logo = event.target.closest(".project-logo,.nx-title-logo");
        if (logo) {
          event.preventDefault();
          event.stopImmediatePropagation();
          vbEnd(false);
          vbSetSelection({ el: logo, kind: "logo", slideID: model.id });
          return;
        }
        if (!slide.contains(event.target)) return;
        const figure = event.target.closest(".media-box");
        if (figure) {
          event.preventDefault();
          event.stopImmediatePropagation();
          vbEnd(false);
          vbSetSelection({ el: figure, kind: "media", slideID: model.id });
          return;
        }
        const el = event.target.closest("[data-vb-path]");
        if (!el) {
          event.preventDefault();
          return;
        }
        const kind = el.dataset.vbKind;
        if (kind !== "text" || event.target.closest("a,button,select"))
          event.preventDefault();
        event.stopPropagation();
        vbStart({ el, path: el.dataset.vbPath, kind, slideID: model.id });
      },
      true,
    );
    root.addEventListener("focusin", (e) => {
      const el = e.target.closest("[data-vb-path]");
      if (el)
        vbStart({
          el,
          path: el.dataset.vbPath,
          kind: el.dataset.vbKind,
          slideID: model.id,
        });
    });
    root.addEventListener("input", (e) => {
      if (vbSession?.el.contains(e.target) || vbSession?.el === e.target)
        vbWrite();
    });
    root.addEventListener("paste", (e) => {
      if (vbSession?.el.contains(e.target) || vbSession?.el === e.target) {
        e.preventDefault();
        e.stopPropagation();
        vbInsertText(e.clipboardData.getData("text/plain"));
      }
    });
    root.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files.length) {
        projectMessage("Use Media settings to add an image or video.");
        return;
      }
      if (vbSession) vbInsertText(e.dataTransfer.getData("text/plain"));
    });
    root.addEventListener("dragover", (e) => e.preventDefault());
    root.addEventListener("focusout", () =>
      setTimeout(() => {
        if (
          vbSession &&
          !vbSession.el.contains(document.activeElement) &&
          !$("vb-toolbar").contains(document.activeElement)
        ) {
          vbEnd(true);
        }
      }, 0),
    );
    root.addEventListener("keydown", (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["b", "i", "z", "y"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        e.stopPropagation();
        const key = e.key.toLowerCase();
        if (key === "b") vbFormat("strong");
        else if (key === "i") vbFormat("i");
        else {
          vbEnd(false);
          vbSelected = null;
          if (key === "y" || e.shiftKey) projectRedo();
          else projectUndo();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        vbEnd(true);
        $("vb-edit-mode").focus();
        return;
      }
      if (e.key === "Enter" && vbSession) {
        e.preventDefault();
        e.stopPropagation();
        vbInsertText("\n");
        return;
      }
      if (
        e.key === "Tab" &&
        vbSession &&
        ["td", "th"].includes(vbNode()?.tag)
      ) {
        const cells = [
            ...slide.querySelectorAll("td[data-vb-path],th[data-vb-path]"),
          ],
          i = cells.indexOf(vbSession.el),
          next = cells[i + (e.shiftKey ? -1 : 1)];
        if (next) {
          e.preventDefault();
          vbStart({
            el: next,
            path: next.dataset.vbPath,
            kind: "text",
            slideID: model.id,
          });
        }
        return;
      }
      if (e.key === "Delete" && !vbSession && vbSelected) {
        e.preventDefault();
        e.stopPropagation();
        vbModify("delete");
      }
    });
  }
  $("vb-edit-mode").setAttribute("aria-pressed", vbMode === "edit");
  $("vb-preview-mode").setAttribute("aria-pressed", vbMode === "preview");
  $("vb-mode-hint").textContent =
    vbMode === "edit"
      ? "Click text, a card, a table cell, or media. Escape finishes editing."
      : "Preview links, question navigation, copy controls, and muted video. Content is not editable.";
}
const vbPreview = projectPreview;
projectPreview = function () {
  if (vbSkipPreview) return;
  if (
    vbSession &&
    projectSelected === vbSession.slideID &&
    vbSession.el.isConnected
  )
    return;
  vbSession = null;
  vbSelected = null;
  vbRange = null;
  vbPreview();
  if (projectPreviewNode && $("full-editor").open) vbAttach(projectPreviewNode);
  if ($("vb-toolbar")) $("vb-toolbar").hidden = true;
};
function vbBind() {
  try {
    vbMode =
      localStorage.getItem("presentation-studio-block-mode") === "preview"
        ? "preview"
        : "edit";
  } catch {}
  for (const [id, mode] of [
    ["vb-edit-mode", "edit"],
    ["vb-preview-mode", "preview"],
  ])
    $(id).onclick = () => {
      vbEnd(false);
      vbSession = null;
      vbSelected = null;
      vbMode = mode;
      try {
        localStorage.setItem("presentation-studio-block-mode", mode);
      } catch {}
      projectPreview();
    };
  for (const b of $("vb-toolbar").querySelectorAll("button"))
    b.addEventListener("mousedown", (e) => e.preventDefault());
  $("vb-bold").onclick = () => vbFormat("strong");
  $("vb-italic").onclick = () => vbFormat("i");
  $("vb-bullets").onclick = () => vbModify("bullets");
  $("vb-duplicate").onclick = () => vbModify("duplicate");
  $("vb-delete").onclick = () => vbModify("delete");
  $("vb-panel").onclick = vbPanel;
  $("vb-done").onclick = () => vbEnd(true);
  $("vb-edit-text").onclick = () => {
    const el =
      vbSelected?.el.querySelector(
        ':is(h1,h2,h3,h4,p)[data-vb-path][data-vb-kind="text"]',
      ) || vbSelected?.el.querySelector('[data-vb-path][data-vb-kind="text"]');
    if (el)
      vbStart({
        el,
        path: el.dataset.vbPath,
        kind: "text",
        slideID: projectSelected,
      });
  };
  $("vb-align").onchange = (e) => {
    if (!vbSelected || vbSelected.kind !== "text") return;
    const path = vbSelected.path,
      el = vbSelected.el,
      value = e.target.value;
    projectChange(() => {
      const node = projectAt(projectModel(), path);
      node.attrs = {
        ...node.attrs,
        style: projectSafeStyle(
          (node.attrs?.style || "").replace(/text-align\s*:[^;]+;?/gi, "") +
            ";text-align:" +
            value,
        ),
      };
    });
    el.style.textAlign = value;
  };
  document.addEventListener("selectionchange", () => {
    if (vbSession) {
      const selection = window.getSelection();
      if (
        selection.rangeCount &&
        vbSession.el.contains(selection.getRangeAt(0).commonAncestorContainer)
      )
        vbRange = selection.getRangeAt(0).cloneRange();
      vbToolbar();
    }
  });
  $("question-browser").addEventListener("click", (e) => {
    if (
      vbMode === "preview" &&
      $("full-editor").open &&
      e.target.closest(".question-option")
    ) {
      const id = slides[index]?.dataset.mediaId;
      if (projectModel(id)) {
        projectSelected = id;
        projectList();
        projectForm();
        projectPreview();
      }
    }
  });
  $("full-editor").addEventListener("close", () => {
    vbEnd(false);
    vbSession = null;
    vbSelected = null;
  });
  projectPreview();
}
const vbInit = projectInit;
projectInit = function () {
  vbInit();
  vbBind();
};
