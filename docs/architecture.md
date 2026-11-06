# Architecture

The repository is the source of truth for the studio engine and included examples. Each build inlines the source, styles, template bootstrap, and vendored JSZip into portable HTML. The application makes no required runtime CDN requests and has no server-side persistence.

`build.config.json` defines concatenation order. Runtime files share one IIFE scope: they are ordered source fragments, not independently importable ES modules. `projects.js` adds the project picker and compact menus after the existing controls are initialized. It serializes browser saves, verifies media completeness, reads recent records from IndexedDB, and protects same-ID file replacements with a separate previous-version copy. It mounts existing buttons into native details menus, preserving their handlers and shortcuts.

`experience.js` extends schema-v2 validation with branding and transition defaults while retaining older project imports. It also implements wizard UI, browser-local preset transfer, and a single cancellable transition owner. The build validates the assembled JavaScript before writing output. Keep the prelude first and boot last.

## Template boundary

The main distribution uses `templates/studio/presentation.json` as its eight-slide starting project and `templates/studio/bootstrap.js` as an empty compatibility bootstrap. `templates/studio/runtime.js` loads the bundled demo image and provides the generic reset template. `templates/blank/presentation.json` supplies the one-slide starter. The demo image is encoded inside the standalone HTML and also included in editable ZIPs.

Only neutral templates are included. Legacy section keys remain importable, with question banks rebuilt from user-provided project data.

The build emits generic demo and blank HTML files. Generic wizard choices are Blank, Studio demo, and Import. Imported legacy product content receives an opened-project reset baseline; resetting it does not substitute the Studio demo. Earlier schema and database identifiers are accepted only by the import/migration adapter; newly written projects use neutral identifiers.

## Themes and visual editing

`src/themes.json` defines six paired palettes. `themes.js` extends optional brand data with `themePalettes`, `colorScheme`, and `schemeBase`; existing brands without those fields retain their exact colors. Theme-only presets reuse the brand preset transport with `scope: theme`, and do not overwrite fonts or logo assignments. Named palettes are applied explicitly.

`blocks.js` maps existing AST node identities to transient DOM markers in the editor preview. Text input writes whitelisted inline nodes back into the current slide, using the existing debounced history and autosave pipeline. It preserves the focused editable DOM across background renders to retain the caret. Structural operations use normal project transactions. Table/side-panel values synchronize with direct edits.

Clipboard HTML is never inserted; pasted text becomes text nodes and line breaks. Formatting uses supported inline tags; text alignment is added to the existing safe-style validator. Preview markers, selections, contenteditable attributes, and toolbars are not serialized into slide trees. Interactive Preview mode rebinds existing controls and keeps videos muted.

## Project data

A project pack has `schemaVersion`, `kind`, `meta`, `playbackOnly`, `state`, `checkpoints`, and `history`. Schema version 2 uses `kind: presentation-studio-project`. The import-only adapter in `compat.js` accepts the earlier identifier and normalizes new exports. State contains slides, sections, section Trash, loops, branding, media assignments, and an optional blank-project starting baseline.

Slide trees are validated against allowed nodes and attributes; imported raw HTML and displayed commands are not executed. Sections and slides use stable IDs. Labels can change without breaking media references. Hidden sections and slides are filtered out of presentation and playback exports. At least one visible slide must remain in a visible section.

## Persistence

- In-memory state supports bounded undo/redo and checkpoints.
- IndexedDB stores browser recovery drafts and media blobs by project ID.
- Editable ZIP exports contain the durable structured state and referenced assets.
- Playback exports remove editor-facing recovery state and custom presenter notes.
- Git versions the engine, templates, and approved examples, not browser drafts.

The exporter captures the source document before runtime mutations. All runtime assets therefore need to be inline or explicitly packaged. Test export/reopen whenever changing shell markup or boot order.

## Build and release

`npm run build` creates the demo and blank HTML distributions. `npm run package` produces a ZIP with the demo and blank distributions, documentation, notices, and example files using fixed entry dates. Generated files are ignored by Git and published as Actions artifacts or release attachments.

The validation workflow runs structural and browser tests before uploading artifacts. The release workflow validates and packages a tag whose version matches `package.json`, then attaches the outputs to a draft GitHub release for review. No Pages deployment or database is configured.

## Media Focus

`focus.js` owns one transient focus state. It moves the existing media figure into a canvas-local dialog and returns it via a geometry placeholder. Atomic DOM moves are preferred; fallback moves preserve video time/play state. The overlay pauses slide advancement, restores playback state, traps focus, makes background controls inert, and cancels safely before navigation or rebuild. Image zoom/pan stays bounded. Optional `presentation.mediaFocus` settings (enabled, animation, captions, zoom) receive defaults through the existing settings validator; runtime geometry and overlay markup are never serialized. No camera/microphone permission is requested.

## Legacy imports and storage

`compat.js` contains two identifier-only aliases for earlier schema-v2 files and the earlier browser database. No product content is bundled. New files use `presentation-studio-project`; new recovery data uses `presentation-studio-editor-v1`. On browsers with IndexedDB enumeration, an empty new database receives an atomic copy of earlier projects and assets on first use. The earlier database is preserved. Browsers without enumeration can import an editable ZIP. Imports normalize the origin to imported and retain an independent reset baseline.
