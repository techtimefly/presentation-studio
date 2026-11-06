// Presentation Studio: dynamic sections, independent appearance, and visual templates.
  const studioLegacySections = projectGroupInfo.map((g) => ({
    id: g.id,
    name: g.label,
    kind: ["qa", "remqa"].includes(g.id)
      ? "qa"
      : ["steps", "remsteps"].includes(g.id)
        ? "commands"
        : "slides",
    product: g.id.startsWith("rem")
      ? "rem"
      : g.id === "overview"
        ? "overview"
        : "faa",
    hidden: false,
    headerLabel: g.id.startsWith("rem")
      ? "WORKSHOP"
      : g.id === "overview"
        ? "OVERVIEW"
        : "PRESENTATION",
  }));
  let studioDefaultTemplate = null,
    studioSection = "",
    studioGalleryTemplate = "hero",
    studioGalleryMode = "add",
    studioGalleryRoots = [],
    studioThemeMode = "light",
    studioThemeRoot = null,
    studioEditorAppearance = "system";
  const studioCoreValidateState = projectValidateState;
  function studioSectionValidate(s) {
    if (!s || typeof s.id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(s.id))
      throw new Error("Invalid section identity.");
    return {
      id: s.id,
      name: String(s.name || s.label || "Untitled section").slice(0, 150),
      kind: ["slides", "qa", "commands"].includes(s.kind) ? s.kind : "slides",
      product: ["faa", "rem", "overview", "generic"].includes(s.product)
        ? s.product
        : "generic",
      hidden: !!s.hidden,
      headerLabel: String(s.headerLabel || "").slice(0, 80),
    };
  }
  projectValidateState = function (raw, nested = false) {
    const sections = (raw.sections || studioLegacySections).map(
        studioSectionValidate,
      ),
      archives = (raw.sectionTrash || []).map((a) => ({
        section: studioSectionValidate(a.section),
        index: Math.max(0, Number(a.index) || 0),
        slides: Array.isArray(a.slides) ? a.slides : [],
      }));
    if (
      !sections.length ||
      sections.length > 100 ||
      new Set(sections.map((s) => s.id)).size !== sections.length
    )
      throw new Error("A project needs uniquely identified sections.");
    const known = [...sections, ...archives.map((a) => a.section)],
      oldGroups = projectGroupInfo.map((x) => ({ ...x }));
    projectGroupInfo.splice(
      0,
      projectGroupInfo.length,
      ...known.map((s) => ({ id: s.id, label: s.name })),
    );
    let state;
    try {
      state = studioCoreValidateState(raw);
      const seen = new Set([...state.slides, ...state.trash].map((s) => s.id));
      state.sectionTrash = archives.map((a) => ({
        ...a,
        slides: a.slides.map((s) => {
          if (seen.has(s.id))
            throw new Error(
              "A slide occurs in more than one section or Trash.",
            );
          seen.add(s.id);
          const checked = studioCoreValidateState({
            ...raw,
            slides: [{ ...s, hidden: false }],
            trash: [],
            loops: {},
          }).slides[0];
          checked.hidden = !!s.hidden;
          return checked;
        }),
      }));
    } finally {
      projectGroupInfo.splice(0, projectGroupInfo.length, ...oldGroups);
    }
    state.sections = sections;
    state.origin = ["blank", "studio", "imported"].includes(raw.origin) ? raw.origin : "imported";
    state.brand = {
      ...state.brand,
      family: "generic",
      headerTitle: String(
        raw.brand?.headerTitle ??
          "PRESENTATION",
      ).slice(0, 64),
      headerSubtitle: String(raw.brand?.headerSubtitle || "").slice(0, 80),
      edition: String(raw.brand?.edition ?? "").slice(0, 80),
      presentationTheme:
        raw.brand?.presentationTheme === "dark" ? "dark" : "light",
    };
    if (
      !state.slides.some(
        (s) => !s.hidden && sections.some((g) => g.id === s.group && !g.hidden),
      )
    )
      throw new Error("Keep at least one visible slide in a visible section.");
    if (state.slides.some((s) => !sections.some((g) => g.id === s.group)))
      throw new Error("An active slide refers to a deleted section.");
    if (raw.startingState && !nested)
      state.startingState = projectValidateState(
        { ...raw.startingState, startingState: undefined },
        true,
      );
    return state;
  };
  function studioNormalize(raw) {
    return projectValidateState(projectCopy(raw));
  }
  function studioEffectiveVisible(model) {
    return (
      !!model &&
      !model.hidden &&
      projectState.sections.some((s) => s.id === model.group && !s.hidden)
    );
  }
  function studioCurrentSection() {
    return (
      projectState?.sections.find(
        (s) => s.id === slides[index]?.dataset.group,
      ) ||
      projectState?.sections.find((s) => s.id === projectModel()?.group) ||
      projectState?.sections[0]
    );
  }
  function studioResetBase() {
    if (!studioDefaultTemplate) return;
    projectBuiltIn =
      projectState.startingState
        ? projectCopy(projectState.startingState)
        : projectCopy(studioDefaultTemplate);
  }
  function studioSyncGroups() {
    projectGroupInfo.splice(
      0,
      projectGroupInfo.length,
      ...projectState.sections.map((s) => ({ id: s.id, label: s.name })),
    );
    for (const [id, includeAll] of [
      ["fe-group-filter", true],
      ["fe-slide-group", false],
      ["me-section", true],
    ]) {
      const select = $(id),
        value = select.value;
      select.replaceChildren();
      if (includeAll) {
        const o = document.createElement("option");
        o.value = "all";
        o.textContent = "All sections";
        select.append(o);
      }
      projectState.sections.forEach((s) => {
        const o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.name + (s.hidden ? " · Hidden" : "");
        select.append(o);
      });
      if ([...select.options].some((o) => o.value === value))
        select.value = value;
      else select.value = includeAll ? "all" : projectState.sections[0].id;
    }
  }
  const studioOriginalBind = projectBindSlide;
  projectBindSlide = function (node, model) {
    studioOriginalBind(node, model);
    const section = projectState.sections?.find((s) => s.id === model.group);
    if (section?.kind === "qa") {
      const eyebrow = node.querySelector(".eyebrow");
      if (eyebrow) {
        const ordinal =
          projectState.slides
            .filter((s) => s.group === model.group && studioEffectiveVisible(s))
            .findIndex((s) => s.id === model.id) + 1;
        eyebrow.textContent =
          section.name +
          " / " +
          String(Math.max(1, ordinal)).padStart(2, "0") +
          " / " +
          (model.topic || "General");
      }
    }
    node
      .querySelectorAll(".qa-browse")
      .forEach(
        (button) => (button.onclick = () => studioOpenQuestions(model.group)),
      );
  };
  function studioQuestionData(section) {
    const models = projectState.slides.filter(
      (s) => s.group === section.id && studioEffectiveVisible(s),
    );
    const items = models.map((s) => {
      const fields = projectFields(s),
        answer =
          projectFind(
            s,
            (n) => n.tag === "p" && /\bqa-answer\b/.test(n.attrs?.class || ""),
          )[0]?.node ||
          fields.find(
            (f) =>
              f.node.tag === "p" && !/eyebrow/.test(f.node.attrs?.class || ""),
          )?.node,
        takeaway = fields
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
    });
    const groups = [...new Set(items.map((q) => q[0]))].map((name) => [
      name,
      items.map((q, i) => (q[0] === name ? i : -1)).filter((i) => i >= 0),
    ]);
    return { items, groups, deck: section.id };
  }
  projectUpdateQABanks = function () {
    for (const [id, bank, grouping] of [
      ["qa", questions, questionGroups],
      ["remqa", remQuestions, remGroups],
    ]) {
      const section = projectState.sections.find(
          (s) => s.id === id && s.kind === "qa",
        ),
        data = section
          ? studioQuestionData(section)
          : { items: [], groups: [] };
      bank.splice(0, bank.length, ...data.items);
      grouping.splice(0, grouping.length, ...data.groups);
    }
  };
  let studioQuestionSection = "";
  questionBank = function () {
    if (!projectReady)
      return { items: questions, groups: questionGroups, deck: "qa" };
    const section =
      projectState.sections.find(
        (s) => s.id === studioQuestionSection && s.kind === "qa",
      ) || projectState.sections.find((s) => s.kind === "qa" && !s.hidden);
    return section
      ? studioQuestionData(section)
      : { items: [], groups: [], deck: "" };
  };
  function studioOpenQuestions(id) {
    if (!projectReady) return;
    const eligible = projectState.sections.filter(
      (s) => s.kind === "qa" && !s.hidden && decks[s.id]?.length,
    );
    if (!eligible.length) return;
    let section =
      eligible.find((s) => s.id === id) ||
      eligible.find((s) => s.id === studioCurrentSection()?.id) ||
      eligible.find((s) => s.product === studioCurrentSection()?.product) ||
      eligible[0];
    studioQuestionSection = section.id;
    setPlaying(false);
    const select = $("question-product");
    select.replaceChildren();
    eligible.forEach((s) => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.name;
      select.append(o);
    });
    select.value = section.id;
    $("question-search").value = "";
    renderQuestions();
    $("question-browser").showModal();
    $("question-search").focus();
    $("question-list")
      .querySelector(".current")
      ?.scrollIntoView({ block: "nearest" });
  }
  openQuestions = function (product) {
    let id = typeof product === "string" ? product : "";
    if (id === "rem")
      id = projectState.sections.find(
        (s) => s.kind === "qa" && s.product === "rem",
      )?.id;
    if (id === "faa")
      id = projectState.sections.find(
        (s) => s.kind === "qa" && s.product === "faa",
      )?.id;
    studioOpenQuestions(id);
  };
  function studioNavigateKind(kind) {
    const current = studioCurrentSection();
    if (current?.kind === kind && deck === current.id) {
      switchDeck(lastLoop, false);
      return;
    }
    const target =
      projectState.sections.find(
        (s) =>
          s.kind === kind &&
          s.product === current?.product &&
          !s.hidden &&
          decks[s.id]?.length,
      ) ||
      projectState.sections.find(
        (s) => s.kind === kind && !s.hidden && decks[s.id]?.length,
      );
    if (target) switchDeck(target.id, false);
  }
  function studioPaintHeader(brand, section, settings = projectState.brand) {
    if (!brand) return;
    brand.replaceChildren();
    if (settings.logo) {
      const logo = document.createElement("img");
      logo.className = "project-logo";
      logo.alt = projectMeta.name + " logo";
      logo.src = mediaAssetURL(settings.logo);
      brand.append(logo);
    } else {
      const glyph = document.createElement("b");
      glyph.textContent = "◈";
      brand.append(glyph);
    }
    brand.append(
      document.createTextNode(settings.headerTitle || projectMeta.name),
    );
    const label =
      section?.headerLabel || settings.headerSubtitle || section?.name || "";
    if (label) {
      const span = document.createElement("span");
      span.style.fontWeight = "400";
      span.textContent = " / " + label;
      brand.append(span);
    }
  }
  projectDecorateBrand = function () {
    if (!projectReady || !projectState.sections) return;
    const current = studioCurrentSection(),
      brand = document.querySelector("#stage .brand");
    studioPaintHeader(brand, current);
    const edition = document.querySelector("#stage .edition");
    edition.textContent = projectState.brand.edition;
    edition.hidden = !projectState.brand.edition;
    const qaExists = projectState.sections.some(
        (s) => s.kind === "qa" && !s.hidden && decks[s.id]?.length,
      ),
      commandsExist = projectState.sections.some(
        (s) => s.kind === "commands" && !s.hidden && decks[s.id]?.length,
      );
    $("qa").hidden = !qaExists;
    $("steps").hidden = !commandsExist;
    $("detection").hidden = !(
      projectState.sections.some((s) => s.id === "detection" && !s.hidden) &&
      decks.detection?.length &&
      current?.product !== "rem"
    );
    $("browse-questions").hidden = current?.kind !== "qa";
    $("qa").textContent =
      current?.kind === "qa" && deck === current.id
        ? "Return to loop"
        : current?.product === "rem"
          ? "Remediation Q&A"
          : projectState.brand.family === "generic"
            ? "Questions"
            : "Customer Q&A";
    $("steps").textContent =
      current?.kind === "commands" && deck === current.id
        ? "Return to loop"
        : projectState.brand.family === "generic"
          ? "Commands"
          : current?.product === "rem"
            ? "Remediation Steps"
            : "Steps & Commands";
    $("qa").onclick = () => studioNavigateKind("qa");
    $("steps").onclick = () => studioNavigateKind("commands");
    $("browse-questions").onclick = () => studioOpenQuestions(current?.id);
    document
      .querySelector("#help > a")
      ?.toggleAttribute("hidden", projectState.brand.family === "generic");
  };
  const studioPalettes = {
    light: {
      background: "#f4f6f8",
      ink: "#101c2f",
      accent: "#0066ff",
      surface: "#ffffff",
      surfaceAlt: "#eef3fa",
      muted: "#596575",
      border: "#ccd7e5",
      accentInk: "#ffffff",
      terminal: "#101c2f",
    },
    dark: {
      background: "#07111f",
      ink: "#eef5ff",
      accent: "#78adff",
      surface: "#132238",
      surfaceAlt: "#1a2e49",
      muted: "#b1c3db",
      border: "#36506f",
      accentInk: "#07111f",
      terminal: "#091321",
    },
  };
  function studioPalette(brand) {
    const base =
      studioPalettes[brand.presentationTheme === "dark" ? "dark" : "light"];
    return {
      ...base,
      accent: brand.accent,
      background: brand.background,
      ink: brand.ink,
      font: brand.font || "Arial",
    };
  }
  function studioCanvasVars(root, palette) {
    for (const [key, value] of Object.entries(palette)) {
      const name =
        {
          background: "bg",
          surfaceAlt: "surface-alt",
          accentInk: "accent-ink",
        }[key] || key;
      root.style.setProperty("--project-" + name, value);
    }
  }
  projectTheme = function () {
    const b = projectState.brand,
      palette = studioPalette(b);
    let style = $("project-theme");
    if (!style) {
      style = document.createElement("style");
      style.id = "project-theme";
      document.head.append(style);
    }
    const variables = Object.entries(palette)
      .map(
        ([key, v]) =>
          "--project-" +
          ({
            background: "bg",
            surfaceAlt: "surface-alt",
            accentInk: "accent-ink",
          }[key] || key) +
          ":" +
          v,
      )
      .join(";");
    style.textContent = ":root{" + variables + ";--cyan:" + b.accent + "}";
    document.body.classList.toggle(
      "presentation-dark",
      b.presentationTheme === "dark",
    );
    $("stage").classList.add("presentation-canvas");
    document.title = projectMeta.name + " · Presentation Studio";
    projectDecorateBrand();
  };
  projectRender = function (refreshForm = true) {
    if (!projectReady) return;
    projectState = projectState.sections
      ? projectState
      : studioNormalize(projectState);
    projectMeta.name = projectState.projectName || projectMeta.name;
    projectApplying = true;
    mediaPauseAll();
    const activeID = slides[index]?.dataset.mediaId;
    studioSyncGroups();
    studioResetBase();
    document.querySelectorAll("#stage .slide").forEach((s) => s.remove());
    document
      .querySelectorAll("#stage > [data-studio-container]")
      .forEach((c) => c.remove());
    const nodes = new Map(),
      containers = new Map();
    for (const section of projectState.sections) {
      const container = document.createElement("div");
      container.dataset.studioContainer = section.id;
      $("stage").insertBefore(
        container,
        $("stage").querySelector(":scope>footer"),
      );
      containers.set(section.id, container);
    }
    for (const model of projectState.slides) {
      const section = projectState.sections.find((s) => s.id === model.group);
      if (!section) continue;
      const node = document.createElement("section");
      node.className = "slide " + model.classes;
      node.dataset.mediaId = model.id;
      node.dataset.title = model.title;
      node.dataset.time = model.duration;
      node.dataset.notes = model.notes;
      node.dataset.group = model.group;
      node.dataset.product = section.product;
      model.tree.forEach((n) => node.append(projectDOM(n)));
      projectBindSlide(node, model);
      containers.get(model.group).append(node);
      nodes.set(model.id, node);
    }
    const legacy = {
      showcase,
      qa: qaSlides,
      steps: stepSlides,
      detection: detectionSlides,
      remshowcase: remSlides,
      remqa: remQASlides,
      remsteps: remStepSlides,
      overview: overviewSlides,
    };
    for (const [id, array] of Object.entries(legacy))
      array.splice(
        0,
        array.length,
        ...projectState.slides
          .filter((s) => s.group === id && studioEffectiveVisible(s))
          .map((s) => nodes.get(s.id)),
      );
    for (const id of Object.keys(decks))
      if (
        !projectState.sections.some((s) => s.id === id) &&
        !projectState.loops[id]
      )
        delete decks[id];
    for (const section of projectState.sections) {
      const groupNodes = projectState.slides
        .filter((s) => s.group === section.id && studioEffectiveVisible(s))
        .map((s) => nodes.get(s.id));
      if (legacy[section.id]) decks[section.id] = legacy[section.id];
      else if (decks[section.id])
        decks[section.id].splice(0, decks[section.id].length, ...groupNodes);
      else decks[section.id] = groupNodes;
    }
    for (const [id, loop] of Object.entries(projectState.loops)) {
      const loopNodes = loop.slideIds
        .filter((sid) => studioEffectiveVisible(projectModel(sid)))
        .map((sid) => nodes.get(sid));
      if (legacy[id]) {
        legacy[id].splice(0, legacy[id].length, ...loopNodes);
        decks[id] = legacy[id];
      } else if (decks[id]) decks[id].splice(0, decks[id].length, ...loopNodes);
      else decks[id] = loopNodes;
    }
    allSlides.splice(0, allSlides.length, ...nodes.values());
    mediaEntries.splice(
      0,
      mediaEntries.length,
      ...projectState.slides.map((s) => ({
        id: s.id,
        title: s.title,
        group: s.group,
        label:
          projectState.sections.find((g) => g.id === s.group).name +
          (!studioEffectiveVisible(s) ? " · hidden" : ""),
        slide: nodes.get(s.id),
        index: projectState.slides
          .filter((x) => x.group === s.group && studioEffectiveVisible(x))
          .findIndex((x) => x.id === s.id),
      })),
    );
    mediaConfig = { schemaVersion: 1, slides: projectCopy(projectState.media) };
    allSlides.forEach(mediaApply);
    projectUpdateQABanks();
    if (!decks[deck]?.length)
      deck =
        Object.keys(projectState.loops).find((id) => decks[id]?.length) ||
        projectState.sections.find((s) => decks[s.id]?.length)?.id;
    if (!decks[lastLoop]?.length)
      lastLoop =
        Object.keys(projectState.loops).find((id) => decks[id]?.length) || deck;
    slides = decks[deck];
    index = Math.max(
      0,
      slides.findIndex((s) => s.dataset.mediaId === activeID),
    );
    for (const id of Object.keys(decks))
      if (!memory[id]) memory[id] = { index: 0, playing: false };
    for (const [id, m] of Object.entries(memory))
      if (decks[id])
        m.index = Math.max(0, Math.min(m.index, decks[id].length - 1));
    if (!nodes.has(projectSelected))
      projectSelected = projectState.slides[0].id;
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
  };
  projectMenu = function () {
    const menu = document.querySelector(".section-options");
    menu.replaceChildren();
    const add = (id, title, description, disabled = false) => {
      const b = document.createElement("button");
      b.dataset.deck = id;
      b.disabled = disabled;
      const strong = document.createElement("b"),
        span = document.createElement("span");
      strong.textContent = title;
      span.textContent = description;
      b.append(strong, span);
      b.onclick = () => {
        closeMenu(false);
        if (id === "pilot") {
          const node = allSlides.find((n) =>
              n.classList.contains("pilot-slide"),
            ),
            section = node?.dataset.group;
          if (section) {
            switchDeck(section, false);
            show(decks[section].findIndex((n) => n === node));
          }
        } else switchDeck(id, false);
        setPlaying(false);
      };
      menu.append(b);
    };
    for (const section of projectState.sections) {
      if (section.hidden) continue;
      add(
        section.id,
        projectState.loops[section.id]?.name || section.name,
        (projectState.loops[section.id] ? "Loop / section · " : "Section · ") +
          (decks[section.id]?.length || 0) +
          " slides · " +
          { slides: "Slides", qa: "Questions & answers", commands: "Commands" }[
            section.kind
          ],
        !decks[section.id]?.length,
      );
    }
    for (const [id, loop] of Object.entries(projectState.loops))
      if (!projectState.sections.some((s) => s.id === id))
        add(
          id,
          loop.name,
          "Kiosk loop · " + (decks[id]?.length || 0) + " slides",
          !decks[id]?.length,
        );
  };
  const studioCorePack = projectPack;
  projectPack = function (playback = false) {
    const pack = studioCorePack(playback);
    if (playback) {
      pack.state.sectionTrash = [];
      delete pack.state.startingState;
      const groups = new Set(
        pack.state.slides
          .filter((s) =>
            pack.state.sections.some((g) => g.id === s.group && !g.hidden),
          )
          .map((s) => s.group),
      );
      pack.state.slides = pack.state.slides.filter(
        (s) =>
          groups.has(s.group) &&
          pack.state.sections.some((g) => g.id === s.group && !g.hidden),
      );
      pack.state.sections = pack.state.sections.filter(
        (g) => !g.hidden && groups.has(g.id),
      );
      const ids = new Set(pack.state.slides.map((s) => s.id));
      pack.state.media = Object.fromEntries(
        Object.entries(pack.state.media).filter(([id]) => ids.has(id)),
      );
      for (const loop of Object.values(pack.state.loops))
        loop.slideIds = loop.slideIds.filter((id) => ids.has(id));
    }
    return pack;
  };
  const studioCoreAcceptPack = projectAcceptPack;
  projectAcceptPack = function (pack) {
    pack.state = studioNormalize(pack.state);
    studioCoreAcceptPack(pack);
    studioResetBase();
    studioSection = projectState.sections[0].id;
    studioSyncGroups();
    studioFormExtras();
  };
  const studioCoreFields = projectFields;
  projectFields = function (model) {
    return studioCoreFields(model).filter(
      (f) =>
        projectState?.sections?.find((s) => s.id === model.group)?.kind !==
          "qa" || !/\beyebrow\b/.test(f.node.attrs?.class || ""),
    );
  };
  function studioBlankState(name) {
    const sectionID = projectID("section"),
      slideID = projectID(),
      preset = projectCreateTemplate("hero", "Your presentation");
    const model = {
      id: slideID,
      title: "Your presentation",
      group: sectionID,
      template: "hero",
      classes: preset.classes,
      tree: preset.tree,
      templateBase: projectCopy(preset.tree),
      templateClasses: preset.classes,
      templateCommands: null,
      duration: 12,
      hidden: false,
      notes: "",
      topic: "General",
      commands: null,
    };
    return {
      projectName: name,
      slides: [model],
      trash: [],
      sections: [
        {
          id: sectionID,
          name: "Main",
          kind: "slides",
          product: "generic",
          hidden: false,
          headerLabel: "",
        },
      ],
      sectionTrash: [],
      loops: { main: { name: "Main presentation", slideIds: [slideID] } },
      brand: {
        accent: "#0066ff",
        background: "#f4f6f8",
        ink: "#101c2f",
        font: "Arial",
        logo: "",
        family: "generic",
        headerTitle: "PRESENTATION",
        headerSubtitle: name,
        edition: "",
        presentationTheme: "light",
      },
      media: {},
      origin: "blank",
    };
  }
  async function studioCreateProject() {
    const choice = document.querySelector(
        'input[name="studio-start"]:checked',
      ).value,
      name = $("studio-new-name").value.trim() || "Untitled presentation";
    if (choice === "import") {
      $("studio-new-project").close();
      $("fe-import-file").click();
      return;
    }
    const create = async () => {
      projectFlush();
      await projectSaveDraft();
      const state =
        choice === "blank"
          ? studioBlankState(name)
          : projectCopy(studioDefaultTemplate);
      state.projectName = name;
      if (choice === "blank") state.startingState = projectCopy(state);
      const pack = {
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
      };
      projectDraftPending = null;
      projectAcceptPack(pack);
      projectModified();
      studioSection = state.sections[0].id;
      projectTab = "content";
      $("fe-search").value = "";
      $("fe-group-filter").value = "all";
      $("studio-new-project").close();
      projectList();
      projectForm();
      projectPreview();
      projectRecoveryBanner();
      projectMessage(
        (choice === "blank" ? "Blank project" : studioTemplateName + " project") +
          " created with its own ID and recovery draft. Export an editable ZIP to save it.",
      );
    };
    if (mediaDirty || projectDraftPending)
      projectConfirm(
        "Start a new project?",
        "This opens a separate project. Your currently opened work will be saved to its browser recovery draft when available. Export an editable ZIP first if you need a portable backup.",
        create,
      );
    else await create();
  }
  const studioCoreAddSlide = projectAddSlide;
  projectAddSlide = function (template, sectionID) {
    projectChange(() => {
      const chosen =
        projectState.sections.find((s) => s.id === sectionID) ||
        projectState.sections.find(
          (s) => s.id === $("fe-group-filter").value,
        ) ||
        projectState.sections.find((s) => s.id === projectModel()?.group) ||
        projectState.sections[0];
      let group = chosen;
      if (template === "qa" && group.kind !== "qa") {
        group = projectState.sections.find(
          (s) => s.kind === "qa" && s.product === chosen.product && !s.hidden,
        );
        if (!group) {
          group = {
            id: projectID("section"),
            name: "Questions",
            kind: "qa",
            product: chosen.product,
            hidden: false,
            headerLabel: "",
          };
          projectState.sections.push(group);
        }
      }
      const title =
          template === "qa" ? "New question" : "New " + template + " slide",
        preset = projectCreateTemplate(template, title),
        id = projectID(),
        commands =
          template === "code"
            ? {
                powershell: 'Write-Output "Replace with your command"',
                bash: 'printf "%s\\n" "Replace with your command"',
              }
            : null;
      const model = {
        id,
        title,
        group: group.id,
        template,
        classes: preset.classes,
        tree: preset.tree,
        templateBase: projectCopy(preset.tree),
        templateClasses: preset.classes,
        duration: 12,
        hidden: false,
        notes: "",
        topic: "General",
        commands,
        templateCommands: projectCopy(commands),
      };
      const current = projectModel(),
        last = projectState.slides
          .map((s, i) => (s.group === group.id ? i : -1))
          .filter((i) => i >= 0)
          .at(-1);
      const pos =
        current?.group === group.id
          ? projectState.slides.indexOf(current)
          : (last ?? projectState.slides.length - 1);
      projectState.slides.splice(pos + 1, 0, model);
      if (projectState.loops[group.id])
        projectState.loops[group.id].slideIds.push(id);
      if (
        projectState.origin === "blank" &&
        Object.keys(projectState.loops).length === 1
      )
        Object.values(projectState.loops)[0].slideIds.push(id);
      projectSelected = id;
      projectBlockPath = "";
      projectTablePath = "";
      if ($("fe-group-filter").value !== "all")
        $("fe-group-filter").value = group.id;
    });
  };
  function studioRetainLayout(original, template) {
    if (template === "original") {
      const copy = projectCopy(original);
      copy.tree = projectCopy(original.templateBase);
      copy.classes = original.templateClasses;
      return copy;
    }
    const preset = projectCreateTemplate(template, original.title),
      next = {
        ...projectCopy(original),
        template,
        tree: preset.tree,
        classes: preset.classes,
        templateBase: projectCopy(preset.tree),
        templateClasses: preset.classes,
      };
    const originalFields = studioCoreFields(original).filter(
        (f) =>
          !/\beyebrow\b/.test(f.node.attrs?.class || "") &&
          f.node.tag !== "caption",
      ),
      sources = originalFields.map((f) => projectCopy(f.node));
    const destination = studioCoreFields(next).filter(
      (f) =>
        !/\beyebrow\b/.test(f.node.attrs?.class || "") &&
        f.node.tag !== "caption",
    );
    for (const field of destination) {
      if (!sources.length) break;
      const match = sources.findIndex(
        (n) =>
          n.tag === field.node.tag ||
          (["p", "div", "span"].includes(n.tag) &&
            ["p", "div", "span"].includes(field.node.tag)),
      );
      const source = sources.splice(match >= 0 ? match : 0, 1)[0];
      if (field.node.tag === "ul" || field.node.tag === "ol")
        field.node.children = projectCopy(source.children || []);
      else projectSetText(field.node, projectText(source));
    }
    const tables = projectFind(original, (n) => n.tag === "table").map((f) =>
        projectCopy(f.node),
      ),
      targets = projectFind(next, (n) => n.tag === "table");
    if (tables.length && targets.length) {
      const first = tables.shift();
      targets[0].node.attrs = first.attrs;
      targets[0].node.children = first.children;
    }
    const extras = sources.filter((n) => projectText(n).trim());
    if (tables.length) extras.push(...tables);
    if (
      original.commands &&
      !projectFind(next, (n) => n.tag === "pre").length
    ) {
      const terminal = projectFind(
        original,
        (n) => n.tag === "div" && /\bterminal\b/.test(n.attrs?.class || ""),
      )[0]?.node;
      if (terminal) extras.push(projectCopy(terminal));
    }
    if (extras.length)
      next.tree.push(projectNode("div", "studio-retained", extras));
    if (template === "code" && !next.commands)
      next.commands = {
        powershell: 'Write-Output "Replace with your command"',
        bash: 'printf "%s\\n" "Replace with your command"',
      };
    return next;
  }
  const studioTemplateInfo = {
    hero: ["Hero", "A strong opening with a supporting card."],
    comparison: ["Comparison", "Two options side by side."],
    workflow: ["Workflow", "Three sequential steps."],
    table: ["Table", "Structured information in rows and columns."],
    qa: ["Q&A", "A question, an answer, and a takeaway."],
    code: ["Commands", "An explanation and a terminal example."],
    media: ["Media", "A heading and space for an image or video."],
    original: ["Original", "The slide’s starting layout."],
  };
  function studioPreviewModel(model, parent, palette = null) {
    const root = document.createElement("div");
    root.className = "me-preview-stage";
    const grid = document.createElement("div");
    grid.className = "grid";
    root.append(grid);
    const header = document.createElement("header"),
      brand = document.createElement("div");
    brand.className = "brand";
    studioPaintHeader(
      brand,
      projectState.sections.find((s) => s.id === model.group),
    );
    header.append(brand);
    if (projectState.brand.edition) {
      const edition = document.createElement("div");
      edition.className = "edition";
      edition.textContent = projectState.brand.edition;
      header.append(edition);
    }
    root.append(header);
    const section = document.createElement("section");
    section.className = "slide active " + model.classes;
    section.dataset.mediaId = model.id;
    model.tree.forEach((n) => section.append(projectDOM(n)));
    root.append(section);
    const footer = document.createElement("footer");
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = "Preview · " + studioTemplateInfo[model.template]?.[0];
    footer.append(meta);
    root.append(footer);
    root.inert = true;
    parent.replaceChildren(root);
    mediaApply(section);
    section.querySelectorAll("video").forEach((v) => {
      v.pause();
      v.controls = false;
      v.muted = true;
    });
    if (palette) studioCanvasVars(root, palette);
    studioGalleryRoots.push({ root, parent });
    root.style.transform = "scale(" + parent.clientWidth / 1920 + ")";
    return root;
  }
  function studioGalleryCandidate(template = studioGalleryTemplate) {
    const model = projectModel();
    if (studioGalleryMode === "change") {
      if (template === "original") {
        const candidate = projectCopy(model);
        candidate.tree = projectCopy(model.templateBase);
        candidate.classes = model.templateClasses;
        return candidate;
      }
      if (
        document.querySelector('input[name="studio-layout-mode"]:checked')
          .value === "keep"
      )
        return studioRetainLayout(model, template);
      const preset = projectCreateTemplate(template, model.title);
      return {
        ...projectCopy(model),
        template,
        classes: preset.classes,
        tree: preset.tree,
      };
    }
    const preset = projectCreateTemplate(
      template,
      studioTemplateInfo[template][0] + " slide",
    );
    return {
      id: "gallery-" + template,
      group: $("studio-gallery-section").value || model.group,
      template,
      classes: preset.classes,
      tree: preset.tree,
    };
  }
  function studioGalleryRefresh() {
    document
      .querySelectorAll(".studio-gallery-card")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          b.dataset.template === studioGalleryTemplate,
        ),
      );
    const info = studioTemplateInfo[studioGalleryTemplate];
    $("studio-gallery-name").textContent = info[0];
    $("studio-gallery-description").textContent = info[1];
    studioPreviewModel(studioGalleryCandidate(), $("studio-gallery-preview"));
  }
  function studioOpenGallery(mode = "add", template = "hero") {
    projectFlush();
    studioGalleryMode = mode;
    studioGalleryTemplate = studioTemplateInfo[template] ? template : "hero";
    $("studio-gallery-mode").hidden = mode !== "change";
    $("studio-gallery-section").disabled = mode === "change";
    $("studio-gallery-title").textContent =
      mode === "change" ? "Change slide layout" : "Choose a slide type";
    $("studio-gallery-apply").textContent =
      mode === "change" ? "Apply layout" : "Add slide";
    $("studio-gallery-section").replaceChildren();
    projectState.sections.forEach((section) => {
      const o = document.createElement("option");
      o.value = section.id;
      o.textContent = section.name;
      $("studio-gallery-section").append(o);
    });
    $("studio-gallery-section").value =
      projectModel()?.group || projectState.sections[0].id;
    $("studio-gallery-cards").replaceChildren();
    studioGalleryRoots = [];
    const templates = [
      "hero",
      "comparison",
      "workflow",
      "table",
      "qa",
      "code",
      "media",
    ];
    if (mode === "change") templates.unshift("original");
    $("studio-gallery").showModal();
    for (const type of templates) {
      const button = document.createElement("button");
      button.className = "studio-gallery-card";
      button.dataset.template = type;
      button.setAttribute(
        "aria-label",
        studioTemplateInfo[type][0] + " layout",
      );
      const thumb = document.createElement("div");
      thumb.className = "studio-mini-preview";
      const strong = document.createElement("strong"),
        small = document.createElement("small");
      strong.textContent = studioTemplateInfo[type][0];
      small.textContent = studioTemplateInfo[type][1];
      button.append(thumb, strong, small);
      button.onclick = () => {
        studioGalleryTemplate = type;
        studioGalleryRefresh();
      };
      $("studio-gallery-cards").append(button);
      const preset =
        type === "original"
          ? {
              tree: projectCopy(projectModel().templateBase),
              classes: projectModel().templateClasses,
            }
          : projectCreateTemplate(type, studioTemplateInfo[type][0] + " slide");
      studioPreviewModel(
        {
          id: "thumbnail-" + type,
          group: projectModel().group,
          template: type,
          tree: preset.tree,
          classes: preset.classes,
        },
        thumb,
      );
    }
    studioGalleryRefresh();
  }
  function studioApplyGallery() {
    projectFlush();
    if (studioGalleryMode === "add") {
      const group = $("studio-gallery-section").value;
      $("studio-gallery").close();
      projectAddSlide(studioGalleryTemplate, group);
      projectForm();
      return;
    }
    const candidate = studioGalleryCandidate(),
      defaults =
        document.querySelector('input[name="studio-layout-mode"]:checked')
          .value === "defaults";
    const apply = () => {
      projectChange(() => {
        const old = projectModel(),
          i = projectState.slides.indexOf(old);
        if (defaults) {
          candidate.commands =
            studioGalleryTemplate === "code"
              ? {
                  powershell: 'Write-Output "Replace with your command"',
                  bash: 'printf "%s\\n" "Replace with your command"',
                }
              : null;
          candidate.templateCommands = projectCopy(candidate.commands);
          candidate.templateBase = projectCopy(candidate.tree);
          candidate.templateClasses = candidate.classes;
        }
        projectState.slides[i] = candidate;
        projectBlockPath = "";
        projectTablePath = "";
      });
      $("studio-gallery").close();
      projectForm();
      projectPreview();
    };
    if (defaults)
      projectConfirm(
        "Replace slide content with defaults?",
        "Replace the slide’s text, tables, and commands with the selected template defaults? Notes, media, section, slide ID, and playback settings remain. Undo can restore the previous content.",
        apply,
      );
    else apply();
  }
  function studioResizeGalleries() {
    studioGalleryRoots = studioGalleryRoots.filter((x) => x.root.isConnected);
    for (const { root, parent } of studioGalleryRoots)
      root.style.transform = "scale(" + parent.clientWidth / 1920 + ")";
    if (studioThemeRoot?.isConnected)
      studioThemeRoot.style.transform =
        "scale(" + $("studio-theme-preview").clientWidth / 1920 + ")";
  }
  function studioPreviewTheme() {
    projectFlush();
    studioThemeMode = $("studio-presentation-theme").value;
    const palette = {
      ...studioPalettes[studioThemeMode],
      font: projectState.brand.font,
    };
    $("studio-theme-dialog").showModal();
    studioThemeRoot = studioPreviewModel(
      projectModel(),
      $("studio-theme-preview"),
      palette,
    );
    $("studio-theme-description").textContent =
      (studioThemeMode === "dark" ? "Dark" : "Light") +
      " presentation palette · not applied yet.";
  }
  function studioApplyTheme() {
    projectChange(() => {
      const p = studioPalettes[studioThemeMode];
      projectState.brand = {
        ...projectState.brand,
        presentationTheme: studioThemeMode,
        background: p.background,
        ink: p.ink,
        accent: p.accent,
      };
    });
    $("studio-theme-dialog").close();
    projectForm();
    projectPreview();
  }
  function studioSetEditorAppearance(value) {
    studioEditorAppearance = ["system", "light", "dark"].includes(value)
      ? value
      : "system";
    const dark =
      studioEditorAppearance === "dark" ||
      (studioEditorAppearance === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("editor-dark", dark);
    $("studio-editor-theme").value = studioEditorAppearance;
    try {
      localStorage.setItem(
        "presentation-studio-editor-theme",
        studioEditorAppearance,
      );
    } catch (e) {}
  }
  function studioSectionList() {
    const list = $("studio-section-list");
    list.replaceChildren();
    projectState.sections.forEach((section) => {
      const button = document.createElement("button");
      button.className =
        "studio-section-row" + (section.hidden ? " is-hidden" : "");
      button.setAttribute(
        "aria-current",
        section.id === studioSection ? "true" : "false",
      );
      button.dataset.sectionId = section.id;
      const label = document.createElement("span"),
        small = document.createElement("small"),
        tag = document.createElement("span");
      label.textContent = section.name;
      small.textContent =
        projectState.slides.filter((s) => s.group === section.id).length +
        " slides" +
        (section.hidden ? " · Hidden" : "");
      label.append(small);
      tag.className = "studio-section-tag";
      tag.textContent = section.kind;
      button.append(label, tag);
      button.onclick = () => {
        projectFlush();
        studioSection = section.id;
        studioSectionForm();
      };
      list.append(button);
    });
  }
  function studioSectionForm() {
    if (!projectState.sections.some((s) => s.id === studioSection))
      studioSection = projectState.sections[0].id;
    const section = projectState.sections.find((s) => s.id === studioSection);
    studioSectionList();
    $("studio-section-name").value = section.name;
    $("studio-section-kind").value = section.kind;
    $("studio-section-header").value = section.headerLabel;
    $("studio-section-hidden").checked = section.hidden;
    $("studio-section-id").textContent = "Permanent section ID: " + section.id;
    $("studio-section-destination").replaceChildren();
    projectState.sections
      .filter((s) => s.id !== section.id)
      .forEach((s) => {
        const o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.name;
        $("studio-section-destination").append(o);
      });
    $("studio-section-move-delete").disabled =
      projectState.sections.length <= 1;
    $("studio-section-trash").disabled = projectState.sections.length <= 1;
    $("studio-section-trash-list").replaceChildren();
    if (!projectState.sectionTrash.length)
      $("studio-section-trash-list").textContent = "No trashed sections.";
    for (const archived of projectState.sectionTrash) {
      const row = document.createElement("div");
      row.className = "fe-list-row";
      const label = document.createElement("span"),
        button = document.createElement("button");
      label.textContent =
        archived.section.name +
        " · " +
        archived.slides.length +
        " archived slides";
      button.textContent = "Restore section";
      button.onclick = () =>
        projectChange(() => studioRestoreSection(archived.section.id));
      row.append(label, button);
      $("studio-section-trash-list").append(row);
    }
  }
  function studioRestoreSection(id) {
    const archive = projectState.sectionTrash.find((a) => a.section.id === id);
    if (!archive) return;
    const restored = { ...projectCopy(archive.section), hidden: false };
    if (!projectState.sections.some((s) => s.id === id))
      projectState.sections.splice(
        Math.min(archive.index, projectState.sections.length),
        0,
        restored,
      );
    for (const model of archive.slides)
      if (!projectState.slides.some((s) => s.id === model.id)) {
        projectState.slides.push(projectCopy(model));
      }
    projectState.sectionTrash = projectState.sectionTrash.filter(
      (a) => a.section.id !== id,
    );
    studioSection = id;
  }
  function studioDeleteSection(trash) {
    projectFlush();
    const section = projectState.sections.find((s) => s.id === studioSection),
      destination = $("studio-section-destination").value;
    if (projectState.sections.length <= 1) {
      projectMessage("Keep at least one section in the project.");
      return;
    }
    const affected = projectState.slides.filter((s) => s.group === section.id);
    if (
      trash &&
      !projectState.slides.some(
        (s) => s.group !== section.id && studioEffectiveVisible(s),
      )
    ) {
      projectMessage(
        "Keep a visible slide in another section before trashing this section.",
      );
      return;
    }
    if (!trash && !destination) {
      projectMessage("Choose a destination section.");
      return;
    }
    if (
      !trash &&
      projectState.sections.find((s) => s.id === destination)?.hidden &&
      !projectState.slides.some(
        (s) => s.group !== section.id && studioEffectiveVisible(s),
      )
    ) {
      projectMessage(
        "Choose a visible destination section to keep a slide available.",
      );
      return;
    }
    projectConfirm(
      trash ? "Trash section and slides?" : "Move slides and delete section?",
      trash
        ? "Move “" +
            section.name +
            "” and its " +
            affected.length +
            " slides to Section Trash? Their media remains recoverable, and a recovery checkpoint is created first."
        : "Move all slides from “" +
            section.name +
            "” to the selected section, then delete the empty section? A recovery checkpoint is created first.",
      () => {
        projectSnapshot("Before deleting section: " + section.name);
        projectChange(() => {
          const index = projectState.sections.indexOf(section);
          if (trash) {
            projectState.slides = projectState.slides.filter(
              (s) => s.group !== section.id,
            );
            projectState.sectionTrash.push({
              section: projectCopy(section),
              index,
              slides: projectCopy(affected),
            });
          } else {
            for (const s of [...projectState.slides, ...projectState.trash])
              if (s.group === section.id) s.group = destination;
            projectState.sectionTrash.push({
              section: projectCopy(section),
              index,
              slides: [],
            });
          }
          projectState.sections.splice(index, 1);
          studioSection = destination || projectState.sections[0].id;
          if (!projectState.slides.some((s) => s.id === projectSelected))
            projectSelected = projectState.slides[0].id;
        });
        projectMessage(
          trash
            ? "Section and slides moved to Section Trash. Undo or Restore section can recover them."
            : "Slides moved and section removed. Undo or the recovery checkpoint can restore the previous organization.",
        );
      },
    );
  }
  const studioCoreRecovery = projectRecoveryList;
  projectRecoveryList = function () {
    studioCoreRecovery();
    if (!projectReady || !projectState.sections) return;
    const rows = [...$("fe-trash-list").querySelectorAll(".fe-list-row")];
    projectState.trash.forEach((model, i) => {
      const button = rows[i]?.querySelector("button");
      if (!button) return;
      const missing = !projectState.sections.some((s) => s.id === model.group);
      if (missing) button.textContent = "Restore section & slide";
      button.onclick = () =>
        projectChange(() => {
          if (missing) studioRestoreSection(model.group);
          projectState.trash = projectState.trash.filter(
            (s) => s.id !== model.id,
          );
          const copy = projectCopy(model);
          delete copy._trashIndex;
          projectState.slides.splice(
            Math.min(model._trashIndex || 0, projectState.slides.length),
            0,
            copy,
          );
          projectSelected = copy.id;
        });
    });
    const details = $("fe-reset-project").closest("details");
    details.querySelector("p").textContent =
      projectState.origin === "blank"
        ? "Reset to this blank project’s starting section and starter slide. A recovery checkpoint is created first."
        : "Restore this presentation’s starting template. A recovery checkpoint is created first.";
  };
  const studioCoreDelete = projectDeleteSlide;
  projectDeleteSlide = function () {
    if (
      studioEffectiveVisible(projectModel()) &&
      projectState.slides.filter(studioEffectiveVisible).length <= 1
    ) {
      projectMessage("Keep at least one visible slide in a visible section.");
      return;
    }
    studioCoreDelete();
  };
  projectSelectTab = function (tab) {
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
      "sections",
    ])
      $("fe-" + key + "-panel").hidden = key !== tab;
    if (tab === "recovery") projectRecoveryList();
    if (tab === "loops") projectLoopForm();
    if (tab === "table") projectTableForm();
    if (tab === "sections") studioSectionForm();
  };
  const studioCoreForm = projectForm;
  projectForm = function () {
    studioCoreForm();
    if (projectReady && projectState.sections) studioFormExtras();
  };
  function studioFormExtras() {
    if (!projectReady || !projectState.sections) return;
    const model = projectModel();
    if (model)
      $("fe-topic").disabled =
        projectState.sections.find((s) => s.id === model.group)?.kind !== "qa";
    $("studio-presentation-theme").value = projectState.brand.presentationTheme;
    $("studio-header-title").value = projectState.brand.headerTitle;
    $("studio-header-subtitle").value = projectState.brand.headerSubtitle;
    $("studio-edition").value = projectState.brand.edition;
    if (projectTab === "sections") studioSectionForm();
  }
  const studioCorePreview = projectPreview;
  projectPreview = function () {
    studioCorePreview();
    if (!projectPreviewNode || !$("full-editor").open) return;
    studioPaintHeader(
      projectPreviewNode.querySelector(".brand"),
      projectState.sections.find((s) => s.id === projectModel().group),
    );
    const edition = projectPreviewNode.querySelector(".edition");
    if (edition) {
      edition.textContent = projectState.brand.edition;
      edition.hidden = !projectState.brand.edition;
    }
  };
  const studioCoreMediaPreview = mediaPreview;
  mediaPreview = function () {
    studioCoreMediaPreview();
    if (!mediaPreviewNode || !$("media-editor").open || !projectReady) return;
    const entry = mediaGetEntry();
    studioPaintHeader(
      mediaPreviewNode.querySelector(".brand"),
      projectState.sections.find((s) => s.id === entry.group),
    );
    const edition = mediaPreviewNode.querySelector(".edition");
    if (edition) {
      edition.textContent = projectState.brand.edition;
      edition.hidden = !projectState.brand.edition;
    }
  };
  function studioBindEvents() {
    $("studio-new-open").onclick = () => {
      projectFlush();
      $("studio-new-name").value = "Untitled presentation";
      $("studio-new-project").showModal();
    };
    $("studio-new-close").onclick = () => $("studio-new-project").close();
    $("studio-new-create").onclick = studioCreateProject;
    $("studio-gallery-open").onclick = () =>
      studioOpenGallery("add", $("fe-new-template").value);
    $("studio-gallery-close").onclick = () => {
      $("studio-gallery").close();
      $("fe-slide-template").value = projectModel().template;
    };
    $("studio-gallery-apply").onclick = studioApplyGallery;
    $("studio-gallery-section").onchange = studioGalleryRefresh;
    document
      .querySelectorAll('input[name="studio-layout-mode"]')
      .forEach((r) => (r.onchange = studioGalleryRefresh));
    $("fe-slide-template").onchange = (e) =>
      studioOpenGallery("change", e.target.value);
    $("studio-preview-theme").onclick = studioPreviewTheme;
    $("studio-presentation-theme").onchange = studioPreviewTheme;
    $("studio-theme-close").onclick = () => {
      $("studio-theme-dialog").close();
      $("studio-presentation-theme").value =
        projectState.brand.presentationTheme;
    };
    $("studio-theme-apply").onclick = studioApplyTheme;
    $("studio-editor-theme").onchange = (e) =>
      studioSetEditorAppearance(e.target.value);
    for (const [id, key] of [
      ["studio-header-title", "headerTitle"],
      ["studio-header-subtitle", "headerSubtitle"],
      ["studio-edition", "edition"],
    ])
      $(id).oninput = (e) =>
        projectEdit(() => (projectState.brand[key] = e.target.value));
    $("studio-section-add").onclick = () => {
      projectChange(() => {
        const section = {
          id: projectID("section"),
          name: "New section",
          kind: "slides",
          product: "generic",
          hidden: false,
          headerLabel: "",
        };
        projectState.sections.push(section);
        studioSection = section.id;
      });
      $("fe-group-filter").value = studioSection;
      projectList();
      studioSectionForm();
    };
    $("studio-section-name").oninput = (e) =>
      projectEdit(
        () =>
          (projectState.sections.find((s) => s.id === studioSection).name =
            e.target.value || "Untitled section"),
      );
    $("studio-section-kind").onchange = (e) =>
      projectChange(() => {
        projectState.sections.find((s) => s.id === studioSection).kind =
          e.target.value;
        if (e.target.value === "qa")
          for (const s of projectState.slides.filter(
            (s) => s.group === studioSection,
          ))
            if (!s.topic) s.topic = "General";
      });
    $("studio-section-header").oninput = (e) =>
      projectEdit(
        () =>
          (projectState.sections.find(
            (s) => s.id === studioSection,
          ).headerLabel = e.target.value),
      );
    $("studio-section-hidden").onchange = (e) => {
      const section = projectState.sections.find((s) => s.id === studioSection),
        hidden = e.target.checked;
      if (
        hidden &&
        !projectState.slides.some(
          (s) => s.group !== section.id && studioEffectiveVisible(s),
        )
      ) {
        e.target.checked = false;
        projectMessage("Keep a visible slide in another section.");
        return;
      }
      projectChange(() => (section.hidden = hidden));
    };
    for (const [id, delta] of [
      ["studio-section-up", -1],
      ["studio-section-down", 1],
    ])
      $(id).onclick = () =>
        projectChange(() => {
          const i = projectState.sections.findIndex(
              (s) => s.id === studioSection,
            ),
            j = i + delta;
          if (j >= 0 && j < projectState.sections.length)
            [projectState.sections[i], projectState.sections[j]] = [
              projectState.sections[j],
              projectState.sections[i],
            ];
        });
    $("studio-section-trash").onclick = () => studioDeleteSection(true);
    $("studio-section-move-delete").onclick = () => studioDeleteSection(false);
    $("question-product").onchange = (e) => {
      studioQuestionSection = e.target.value;
      $("question-search").value = "";
      renderQuestions();
    };
    $("qa").onclick = () => studioNavigateKind("qa");
    $("steps").onclick = () => studioNavigateKind("commands");
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
        if (projectState.loops[old])
          projectState.loops[old].slideIds = projectState.loops[
            old
          ].slideIds.filter((id) => id !== s.id);
        if (
          projectState.loops[group] &&
          !projectState.loops[group].slideIds.includes(s.id)
        )
          projectState.loops[group].slideIds.push(s.id);
        if (
          projectState.sections.find((g) => g.id === group)?.kind === "qa" &&
          !s.topic
        )
          s.topic = "General";
      });
    };
    $("fe-hidden").onchange = (e) => {
      const hidden = e.target.checked;
      if (
        hidden &&
        studioEffectiveVisible(projectModel()) &&
        projectState.slides.filter(studioEffectiveVisible).length <= 1
      ) {
        e.target.checked = false;
        projectMessage("Keep at least one visible slide in a visible section.");
        return;
      }
      projectChange(() => (projectModel().hidden = hidden));
    };
    $("fe-reset-project").onclick = () =>
      projectConfirm(
        "Reset entire presentation?",
        "Restore this project’s " +
          (projectState.origin === "blank"
            ? "blank starting template"
            : "starting presentation") +
          "? Custom slides, text, media assignments, sections, branding, loops, and Trash are replaced. A recovery checkpoint preserves the current project first.",
        () => {
          projectSnapshot("Before full presentation reset");
          projectChange(() => (projectState = projectCopy(projectBuiltIn)));
          projectMessage(
            "Starting template restored. Undo or the recovery checkpoint can recover your customization.",
          );
        },
      );
    for (const dialog of [
      $("studio-new-project"),
      $("studio-gallery"),
      $("studio-theme-dialog"),
    ])
      dialog.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          dialog.close();
          $("fe-slide-template").value = projectModel()?.template || "original";
          $("studio-presentation-theme").value =
            projectState.brand.presentationTheme;
        }
      });
    matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      () => {
        if (studioEditorAppearance === "system")
          studioSetEditorAppearance("system");
      },
    );
    try {
      studioSetEditorAppearance(
        localStorage.getItem("presentation-studio-editor-theme") || "system",
      );
    } catch (e) {
      studioSetEditorAppearance("system");
    }
    window.addEventListener("resize", studioResizeGalleries);
    new ResizeObserver(studioResizeGalleries).observe(
      $("studio-gallery-preview"),
    );
    new ResizeObserver(studioResizeGalleries).observe(
      $("studio-theme-preview"),
    );
  }
  const studioCoreInit = projectInit;
  projectInit = function () {
    studioCoreInit();
    studioDefaultTemplate = studioNormalize(projectBuiltIn);
    projectState = studioNormalize(projectState);
    projectBaseline = studioNormalize(projectBaseline);
    studioResetBase();
    studioSection = projectState.sections[0].id;
    studioBindEvents();
    projectSetTabEvents();
    projectRender(true);
  };
