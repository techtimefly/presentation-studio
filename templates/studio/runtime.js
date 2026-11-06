// The generic build carries a neutral template and its own offline assets.
if (studioBuild === "generic") {
  const demo = JSON.parse($("studio-template-config").textContent);
  const resources = JSON.parse($("studio-template-assets").textContent);
  for (const [path, asset] of Object.entries(resources)) {
    if (
      !mediaSafePath(path) ||
      !["image/svg+xml", "image/png"].includes(asset.type)
    )
      continue;
    mediaRemember(
      path,
      new Blob([Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0))], {
        type: asset.type,
      }),
    );
  }
  projectCaptureBuiltIn = function () {
    return projectCopy(demo.state);
  };
  const validate = projectValidateState;
  projectValidateState = function (raw, nested = false) {
    const state = validate(raw, nested);
    // Legacy product ZIPs keep their content and reset baseline, without needing
    // their product template embedded in the generic studio.
    if (state.origin === "imported") {
      state.origin = "imported";
      if (!state.startingState && !nested)
        state.startingState = projectCopy(state);
    }
    return state;
  };
}
