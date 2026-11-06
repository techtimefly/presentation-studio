# Presentation Studio

![Presentation Studio icon](assets/logo_light.png)

A portable HTML presentation player and editor. Start with a short, generic demo or a blank presentation, then add your own content, branding, questions, and media. No application server or database is required.

## Start here

Download and unzip a release or a successful **Validate and build** Actions artifact.

| File | Starting experience |
| --- | --- |
| `presentation-studio.html` | **From idea to presentation** — an eight-slide, editable Studio demo |
| `presentation-studio-blank.html` | One neutral starter slide and section |
| `studio-demo-editable.zip` | Portable Studio demo project, including its sample image |

Click **Edit** or press **J**. Use **Project → New presentation** for **Blank**, **Studio demo**, or **Import**. **Presentations** (or **P**) opens recent browser drafts and project ZIP/JSON files. Export an editable ZIP to save a complete portable copy; playback ZIPs are for delivery.

![Generic Studio demo](docs/images/studio-demo.png)

## What's in the demo?

Eight slides demonstrate Hero, Comparison, Workflow, Table, Media, Commands, Q&A, and Closing layouts. Sections are **Overview**, **Demonstration**, and **Questions**. The main seven-slide loop leaves the question for live discussion. Presenter notes suggest a short demonstration for each slide. The bundled SVG works offline; displayed commands only print a greeting and are never executed by the studio.

## Capabilities

- Compact playback controls and editor Project/Export menus.
- Recent browser projects with previews, search, backup, duplication, and removal.
- Structured text, tables, questions, commands, notes, and image/video placement.
- Media Focus: animated expansion/return, image zoom/pan, video continuity, and paused slide advancement.
- Six paired light/dark color schemes with live previews, custom tokens, and portable theme presets.
- Direct block editing for text, cards, lists, table cells, and media selection, alongside existing panels.
- Independent editor appearance, logos, and portable brand presets.
- Slide transitions, section-boundary options, reduced motion, and instant question jumps.
- Stable slide/section identities, custom loops, undo/redo, checkpoints, and Trash.
- Save-before-switch protection and complete editable/playback exports.

Browser drafts are local recovery copies, not shared backups. Keep an editable ZIP after important changes.

![Theme gallery](docs/images/theme-gallery.png)

![Direct block editing](docs/images/block-editing.png)

## Existing presentations

Open an existing editable ZIP through **Presentations → Open ZIP / JSON**. Older projects retain their slides, sections, questions, notes, media, and reset baseline. An import-only adapter accepts previous format identifiers; new exports use `presentation-studio-project`. No vendor templates or content are included.

## Develop

Requires Node.js 22 or later. Build and package scripts use Node built-ins and the vendored ZIP runtime; browser tests use Playwright.

```sh
npm ci
npx playwright install chromium
npm run check
npm run package
```

For a localhost preview, run `npm run serve`, then open `http://127.0.0.1:4173`. File opening also works. Set `CHROMIUM_EXECUTABLE_PATH` to reuse an installed Chromium binary.

| Path | Purpose |
| --- | --- |
| `src/shell.html`, `src/styles/`, `src/runtime/` | Shared player, editor, project picker, and UI |
| `templates/studio/` | Generic demo, bootstrap, and offline template support |
| `templates/blank/` | Neutral blank starter |
| `examples/` | Layout sampler and sample media |
| `scripts/`, `tests/` | Deterministic builds, packaging, and browser checks |

[Quick start](docs/quick-start.md) · [Architecture](docs/architecture.md) · [Contributing](CONTRIBUTING.md) · [Content and branding](docs/content-and-branding.md) · [Open-source release](docs/open-source-release.md) · [Roadmap](docs/roadmap.md) · [Troubleshooting](docs/troubleshooting.md)

Version 0.7.0. Released under the [MIT license](LICENSE). Third-party notices remain applicable. Chromium workflows are tested; OBS and other browsers require manual validation.

Presentation Studio is an independent community project maintained under **se-appsec-sandbox**, with no implied vendor affiliation or endorsement. Users supply and are responsible for their own presentation content and branding.

## Media Focus

Click an image/video or its **Expand** button while presenting. **Return to slide** or **Escape** animates it back. Images support the zoom buttons, mouse wheel, double-click, drag to pan, and **Fit**. Video controls remain available. Presentation advancement pauses while focused and restores its previous state afterward.

Configure enablement, animation, captions, and image zoom under **Editor → Presentation settings → Media Focus**. Focus also works in interactive **Preview**; **Edit blocks** continues selecting media for editing. Focus settings travel with editable and playback exports.

Focus fills the presentation canvas. An OBS camera source stays separate; use **Browser Source → Interact** to click the presentation. Camera capture and widgets are not included in this release.

## Direct media editing and conference booths

Drag images/videos onto the slide preview in **Edit blocks**, choose a placement zone, then use floating frames, resize handles, crop, snapping, keyboard nudges, and the media inspector. Add multiple media objects, adjust layers, and lock objects, slides or the presentation against accidental changes.

For unattended use, open **Presentation settings → Booth mode / export**. Choose audience interactions, a return loop, an idle timeout and a presenter passphrase. Booth locks persist across refresh in the same browser. A dedicated Booth ZIP omits the editor, private notes, recovery data and unselected slides. Use a restricted OS/browser kiosk for computer-level protection.

[Full editing and booth guide](docs/direct-editing-and-booth.md). Keep editable ZIP backups; older projects remain importable.
