  mediaApplyAll();
  mediaState();

  updateEnvironment();
  buildDots();
  render();
  resize();
  activity();
  if (params.has("remqa")) switchDeck("remqa", false);
  else if (params.has("remsteps")) switchDeck("remsteps", false);
  else if (params.get("product") === "remediation")
    switchDeck("remshowcase", false);
  else if (params.get("product") === "combined") switchDeck("combined", false);
  else if (params.get("product") === "overview") switchDeck("overview", false);
  else if (params.has("pilot")) {
    switchDeck("showcase", false);
    show(showcase.findIndex((s) => s.classList.contains("pilot-slide")));
    setPlaying(false);
  } else if (params.has("detection")) switchDeck("detection");
  else if (params.has("steps")) switchDeck("steps");
  else if (params.has("qa")) switchDeck("qa");
  projectInit();
  if (params.get("loop") && decks[params.get("loop")]?.length) {
    switchDeck(params.get("loop"), false);
    show(0);
    setPlaying(true);
  }
  requestAnimationFrame(tick);
})();
