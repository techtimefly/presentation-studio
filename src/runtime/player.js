const showcase = [...document.querySelectorAll("#stage > .slide")],
    qaSlides = [...document.querySelectorAll("#qa-slides > .qa-slide")],
    stepSlides = [...document.querySelectorAll("#steps-slides > .steps-slide")],
    detectionSlides = [...document.querySelectorAll(".detection-table-slide")];
  const remSlides = [...document.querySelectorAll("#rem-showcase > .slide")],
    remQASlides = [...document.querySelectorAll("#rem-qa > .slide")],
    remStepSlides = [...document.querySelectorAll("#rem-steps > .slide")],
    overviewSlides = [
      ...document.querySelectorAll("#overview-slides > .slide"),
    ];
  const decks = {
      showcase,
      qa: qaSlides,
      steps: stepSlides,
      detection: detectionSlides,
      remshowcase: remSlides,
      remqa: remQASlides,
      remsteps: remStepSlides,
      overview: overviewSlides,
      combined: [...overviewSlides, ...showcase, ...remSlides],
    },
    allSlides = [...new Set(Object.values(decks).flat())];
  let slides = showcase,
    deck = "showcase",
    dots = [],
    index = 0,
    elapsed = 0,
    playing = true,
    last = performance.now(),
    kiosk = params.has("kiosk"),
    idleTimer,
    lastLoop = "showcase",
    browserProduct = "faa",
    environment = params.get("shell") === "bash" ? "bash" : "powershell";
  const memory = {
    showcase: { index: 0, playing: true },
    qa: { index: 0, playing: false },
    steps: { index: 0, playing: false },
    detection: { index: 0, playing: false },
  };
  for (const id of Object.keys(decks))
    if (!memory[id])
      memory[id] = {
        index: 0,
        playing: ["remshowcase", "combined", "overview"].includes(id),
      };
  document.body.classList.toggle("obs", params.has("obs"));
  function questionBank() {
    return browserProduct === "rem"
      ? { items: remQuestions, groups: remGroups, deck: "remqa" }
      : { items: questions, groups: questionGroups, deck: "qa" };
  }
  function remContext() {
    return slides[index]?.dataset.product === "rem" || deck.startsWith("rem");
  }
  function renderQuestions() {
    const bank = questionBank(),
      questions = bank.items,
      questionGroups = bank.groups;
    const query = $("question-search").value.trim().toLowerCase(),
      terms = query.split(/\s+/).filter(Boolean);
    $("question-list").replaceChildren();
    let count = 0;
    questionGroups.forEach(([name, indices]) => {
      const matches = indices.filter((i) =>
        terms.every((term) =>
          (name + " " + questions[i][0] + " " + questions[i][1])
            .toLowerCase()
            .includes(term),
        ),
      );
      if (!matches.length) return;
      const group = document.createElement("section");
      group.className = "question-group";
      const heading = document.createElement("h3");
      heading.textContent = name;
      group.append(heading);
      const items = document.createElement("div");
      items.className = "question-group-items";
      matches.forEach((i) => {
        count++;
        const button = document.createElement("button");
        button.className = "question-option";
        const current = deck === bank.deck && index === i;
        button.classList.toggle("current", current);
        button.setAttribute("aria-current", current ? "true" : "false");
        button.dataset.question = i;
        const number = document.createElement("span");
        number.className = "question-number";
        number.textContent = String(i + 1).padStart(2, "0");
        const text = document.createElement("span");
        text.className = "question-text";
        text.textContent = questions[i][1];
        if (current) {
          const label = document.createElement("small");
          label.textContent = "Currently presenting";
          text.append(label);
        }
        button.append(number, text);
        button.onclick = () => {
          if (deck !== bank.deck) switchDeck(bank.deck, false);
          show(i);
          setPlaying(false);
          $("question-browser").close();
          activity();
        };
        items.append(button);
      });
      group.append(items);
      $("question-list").append(group);
    });
    $("question-count").textContent =
      count + " of " + questions.length + " questions";
    if (!count) {
      const empty = document.createElement("p");
      empty.className = "question-empty";
      empty.textContent =
        "No matching questions. Try another keyword or clear the search.";
      $("question-list").append(empty);
    }
  }
  function openQuestions(product) {
    browserProduct =
      typeof product === "string" ? product : remContext() ? "rem" : "faa";
    $("question-product").value = browserProduct;
    setPlaying(false);
    $("question-search").value = "";
    renderQuestions();
    $("question-browser").showModal();
    $("question-search").focus();
    const current = $("question-list").querySelector(".current");
    if (current) current.scrollIntoView({ block: "nearest" });
  }
  $("question-browser").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      $("question-browser").close();
      setPlaying(false);
      activity();
    }
  });
  $("browse-questions").onclick = openQuestions;
  $("question-search").oninput = renderQuestions;
  $("question-product").onchange = (e) => {
    browserProduct = e.target.value;
    $("question-search").value = "";
    renderQuestions();
  };
  $("questions-close").onclick = () => {
    $("question-browser").close();
    activity();
  };
  $("question-browser").addEventListener("cancel", () => {
    setPlaying(false);
    activity();
  });
  function updateNotes() {
    const current = slides[index];
    $("notes-title").textContent = current.dataset.title;
    let note = projectReady
      ? projectModel(current.dataset.mediaId)?.notes ||
        "No presenter notes for this slide."
      : current.dataset.notes ||
        (deck === "showcase" || deck === "combined"
          ? showcaseNotes[showcase.indexOf(current)]
          : deck === "qa"
            ? questions[index][3]
            : deck === "steps"
              ? walkthrough[index][4] +
                " " +
                (index === 0
                  ? "Replace the example checkout path with the actual path before copying."
                  : index === 4
                    ? "Choose the basic scan or its complementary alternative; do not run both by habit."
                    : "")
              : "Use the table to discuss comparable flaws in the customer’s application. These are vendor-reported detections, not a general accuracy claim. Keep the study footnote visible.");
    $("notes-body").textContent = note;
  }
  function updateEnvironment() {
    [...stepSlides, ...remStepSlides].forEach((section) => {
      let command = section._command;
      if (section._step === 0)
        command =
          (environment === "powershell"
            ? "Set-Location 'C:\\src\\customer-app'"
            : "cd '/srv/customer-app'") +
          "\n" +
          command;
      section.querySelector("pre").textContent = command;
      section.querySelector("select").value = environment;
      section.querySelector(".copy-status").textContent = "";
      section.querySelector("select").onchange = (e) => {
        environment = e.target.value;
        updateEnvironment();
      };
    });
  }
  function buildDots() {
    $("dots").replaceChildren();
    dots = slides.map((s, i) => {
      let b = document.createElement("button");
      b.className = "dot";
      b.setAttribute("aria-label", "Slide " + (i + 1) + ": " + s.dataset.title);
      b.onclick = () => show(i);
      $("dots").append(b);
      return b;
    });
  }
  function setPlaying(value) {
    playing = value;
    $("play").textContent = playing ? "Pause" : "Play";
    document.body.classList.toggle("paused", !playing);
    mediaPlayCurrent();
  }
  function switchDeck(target = "qa", toggle = true) {
    if (!decks[target]?.length) return;
    if (toggle && target === deck) target = lastLoop;
    memory[deck] = { index, playing };
    const previous = deck;
    deck = target;
    if (projectIsLoop(deck)) lastLoop = deck;
    slides = decks[deck];
    index = memory[deck].index;
    setPlaying(projectIsLoop(deck) ? memory[deck].playing : false);
    elapsed = 0;
    for (const [id, label] of [
      ["qa", "Customer Q&A"],
      ["steps", "Steps & Commands"],
      ["detection", "Detection Results"],
    ]) {
      $(id).textContent =
        deck === id || deck === "rem" + id ? "Return to showcase" : label;
      $(id).setAttribute("aria-pressed", deck === id);
    }
    buildDots();
    render();
    progress();
    activity();
  }
  function resize() {
    $("stage").style.transform =
      "translate(-50%,-50%) scale(" +
      Math.min(innerWidth / 1920, innerHeight / 1080) +
      ")";
  }
  function render() {
    $("qa").setAttribute("aria-pressed", ["qa", "remqa"].includes(deck));
    $("steps").setAttribute(
      "aria-pressed",
      ["steps", "remsteps"].includes(deck),
    );
    const product = remContext()
      ? "rem"
      : slides[index]?.dataset.product === "overview"
        ? "overview"
        : "faa";
    document.querySelector(".brand").innerHTML =
      '<b>◈</b> PRESENTATION <span style="font-weight:400;color:#596575">/ ' +
      (product === "rem"
        ? "WORKSHOP"
        : product === "overview"
          ? "OVERVIEW"
          : "PRESENTATION") +
      "</span>";
    $("qa").textContent = ["qa", "remqa"].includes(deck)
      ? "Return to showcase"
      : product === "rem"
        ? "Remediation Q&A"
        : "Customer Q&A";
    $("steps").textContent = ["steps", "remsteps"].includes(deck)
      ? "Return to showcase"
      : product === "rem"
        ? "Remediation Steps"
        : "Steps & Commands";
    $("detection").hidden = product === "rem";
    $("browse-questions").hidden = !["qa", "remqa"].includes(deck);
    allSlides.forEach((s) => {
      s.classList.remove("active");
      s.setAttribute("aria-hidden", "true");
      s.inert = true;
    });
    slides.forEach((s, i) => {
      s.classList.toggle("active", i === index);
      s.setAttribute("aria-hidden", i !== index);
      s.inert = i !== index;
      dots[i].classList.toggle("selected", i === index);
      dots[i].setAttribute("aria-current", i === index ? "step" : "false");
    });
    $("title").textContent = slides[index].dataset.title;
    $("counter").textContent =
      String(index + 1).padStart(2, "0") +
      " / " +
      String(slides.length).padStart(2, "0");
    updateNotes();
    mediaOnRender();
    if (projectReady) projectDecorateBrand();
  }
  function show(i) {
    index = (i + slides.length) % slides.length;
    elapsed = 0;
    render();
    progress();
  }
  function progress() {
    let p = Math.min(
      100,
      (elapsed / (Number(slides[index].dataset.time) * 1000)) * 100,
    );
    const cfg = mediaGetAssignment(slides[index]?.dataset.mediaId),
      v = slides[index]?.querySelector("video.media-asset");
    if (
      cfg?.advance === "ended" &&
      v &&
      Number.isFinite(v.duration) &&
      v.duration > 0
    )
      p = (v.currentTime / v.duration) * 100;
    $("fill").style.width = p + "%";
    document
      .querySelector(".track")
      .setAttribute("aria-valuenow", Math.round(p));
  }
  function tick(now) {
    const delta = now - last;
    last = now;
    if (playing) {
      if (!mediaHoldSlide()) {
        elapsed += delta;
        if (elapsed >= Number(slides[index].dataset.time) * 1000)
          show(index + 1);
      }
      progress();
    }
    requestAnimationFrame(tick);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (e) {
      $("status").textContent =
        "Fullscreen is unavailable in this viewer. Open the file in a browser and press F.";
      $("help").classList.add("open");
    }
  }
  function activity() {
    document.body.classList.remove("idle");
    clearTimeout(idleTimer);
    if (kiosk)
      idleTimer = setTimeout(() => document.body.classList.add("idle"), 3000);
  }
  function toggleNotes() {
    const opened = $("presenter-notes").hidden;
    $("presenter-notes").hidden = !opened;
    $("notes").setAttribute("aria-expanded", opened);
    if (opened) {
      setPlaying(false);
      updateNotes();
    }
  }
  let beforeMenu = false;
  function openMenu() {
    beforeMenu = playing;
    setPlaying(false);
    $("section-menu").showModal();
  }
  function closeMenu(resume = true) {
    $("section-menu").close();
    if (resume) setPlaying(beforeMenu);
  }
  $("menu").onclick = openMenu;
  $("menu-close").onclick = () => closeMenu();
  $("section-menu").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeMenu();
  });
  document.querySelectorAll("[data-deck]").forEach(
    (button) =>
      (button.onclick = () => {
        const target = button.dataset.deck;
        closeMenu(false);
        if (target === "pilot") {
          switchDeck("showcase", false);
          show(showcase.findIndex((s) => s.classList.contains("pilot-slide")));
          setPlaying(false);
        } else {
          switchDeck(target, false);
          setPlaying(false);
        }
      }),
  );
  $("notes").onclick = toggleNotes;
  $("notes-close").onclick = toggleNotes;
  $("prev").onclick = () => show(index - 1);
  $("next").onclick = () => show(index + 1);
  $("play").onclick = () => setPlaying(!playing);
  $("full").onclick = fullscreen;
  $("kiosk").onclick = () => {
    kiosk = !kiosk;
    $("kiosk").textContent = kiosk ? "Exit kiosk" : "Kiosk";
    activity();
    if (kiosk && !document.fullscreenElement) fullscreen();
  };
  $("detection").onclick = () => switchDeck("detection");
  document.querySelectorAll(".open-detection").forEach(button => { button.onclick = () => switchDeck("detection"); });
  $("qa").onclick = () => switchDeck(remContext() ? "remqa" : "qa");
  $("steps").onclick = () => switchDeck(remContext() ? "remsteps" : "steps");
  $("info").onclick = () => {
    $("help").classList.toggle("open");
    if ($("help").classList.contains("open")) setPlaying(false);
  };
  $("close").onclick = () => $("help").classList.remove("open");
  document.addEventListener("keydown", (e) => {
    if (
      ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) ||
      e.target.isContentEditable
    )
      return;
    if (
      document.body.classList.contains("mf-active") ||
      document.querySelector("#hub-picker[open],#hub-switch[open],#te-gallery[open],.hub-menu[open]") ||
      $("nx-wizard").open ||
      $("studio-gallery").open ||
      $("studio-new-project").open ||
      $("studio-theme-dialog").open ||
      $("section-menu").open ||
      $("question-browser").open ||
      $("media-editor").open ||
      $("full-editor").open ||
      $("fe-confirm").open
    )
      return;
    if (e.target.tagName === "BUTTON" && (e.key === " " || e.key === "Enter"))
      return;
    let key = e.key.toLowerCase();
    if ([" ", "arrowright", "arrowleft", "home", "end"].includes(key))
      e.preventDefault();
    if (key === " ") setPlaying(!playing);
    else if (key === "arrowright") show(index + 1);
    else if (key === "arrowleft") show(index - 1);
    else if (key === "home") show(0);
    else if (key === "end") show(slides.length - 1);
    else if (key === "f") fullscreen();
    else if (key === "k") $("kiosk").click();
    else if (key === "d") switchDeck("detection");
    else if (key === "q") studioNavigateKind("qa");
    else if (key === "s") studioNavigateKind("commands");
    else if (key === "j") {
      e.preventDefault();
      projectOpen();
    } else if (key === "e") {
      e.preventDefault();
      mediaOpen();
    } else if (key === "b") {
      e.preventDefault();
      openQuestions();
    } else if (key === "m") openMenu();
    else if (key === "n") toggleNotes();
    else if (key === "?") $("info").click();
    else if (key === "escape") {
      if (!$("presenter-notes").hidden) toggleNotes();
      else if ($("help").classList.contains("open"))
        $("help").classList.remove("open");
      else if (deck !== lastLoop) switchDeck(lastLoop, false);
      kiosk = false;
      $("kiosk").textContent = "Kiosk";
    }
    activity();
  });
  document.addEventListener("mousemove", activity);
  document.addEventListener("touchstart", activity, { passive: true });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    last = performance.now();
  });
