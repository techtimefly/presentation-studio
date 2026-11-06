# Quick start

## Create and edit

1. Open `presentation-studio.html` for the generic Studio demo, or `presentation-studio-blank.html` for an empty starter.
2. Select **Edit** or press **J**. **Project → New presentation** opens the setup wizard: choose Blank, Studio demo, or Import; name and brand it; choose a starter layout; then select theme and transitions. **Skip setup / use defaults** creates the selected starting template immediately. New projects receive independent IDs and browser drafts.
3. Choose **Add slide** to preview Hero, Comparison, Workflow, Table, Q&A, Commands, or Media.
4. Edit content in the corresponding panel. When changing an existing layout, retain content or replace it with template defaults. Review the preview for overflow.
5. Use **Sections** to organize slides. Questions sections provide searchable presenter navigation. A section is an organizational group; a kiosk loop is a curated playback sequence and may cross sections.
6. In **Branding**, set header labels, colors, typeface, and logo. Editor appearance is a browser preference. Presentation theme is saved with the project; preview it before applying.

## Save and share

| Option | Includes | Use |
| --- | --- | --- |
| Editable ZIP | Project, media, notes, undo history, checkpoints, and Trash | Durable editable copy and handoff |
| Playback ZIP | Visible presentation and needed media; excludes recovery data and custom presenter notes | Delivery and kiosk playback |
| Project JSON | Structured project data, without media bytes | Text review or media-free examples |
| Browser draft | Local project recovery and local media | Recover on the same browser and computer |

Keep an editable ZIP before distributing a playback export. Import an editable ZIP before re-exporting its project so all media assets, including recovery assets, are loaded. Unzip the complete package before opening `index.html`; keep its assets directory beside it. Playback exports are inspectable files, not access control.

## Present

| Key | Action |
| --- | --- |
| Space | Play/pause |
| Left / Right | Previous/next slide |
| Home / End | First/last slide |
| F | Fullscreen |
| K | Kiosk controls |
| M | Sections and loops |
| Q | Contextual questions section / return |
| B | Browse questions |
| S | Contextual commands section / return |
| N | Presenter notes |
| J / E | Studio editor / Media Manager |
| P | Presentations picker |

For OBS Browser Source, choose the exported local `index.html`, set 1920 × 1080, and use the `?obs=1` URL option when using a hosted/local HTTP source. Validate sizing and playback in your OBS installation. OBS mode hides controls and editor access; the files remain inspectable.

## Recover

Use Undo/Redo for recent changes. Create a named checkpoint before major edits. Deleted slides appear in **Recovery & reset**; deleted sections appear in **Sections → Section Trash**. Section deletion creates a checkpoint. Reset restores the current project's starting template, with a recovery checkpoint first. Browser recovery applies only on the same browser profile and file origin.

## Branding and transitions

In **Branding**, upload a default logo or separate logos for light and dark presentations. PNG, JPEG, WebP, and self-contained SVG are supported, up to 1 MB per logo. Adjust header logo height (20–64 pixels), placement (left/right/hidden), and optional title-slide logo. The two background swatches show theme-specific logo choices.

Brand presets are saved in this browser, up to 20 entries. Expand **Brand presets** and use **Export preset JSON** and **Import preset JSON** to transfer a preset, including its logo bytes, to another browser or computer. Applying a preset changes branding; Undo restores the prior brand. Project ZIPs include applied branding, not your browser's entire preset library.

Switching presentation theme remembers each theme's colors and retains custom colors. **Apply theme default colors** explicitly resets the selected theme's colors. Editor appearance remains an independent browser preference.

In **Presentation settings**, choose None, Fade, Slide, or Subtle zoom, and Quick (200 ms), Normal (400 ms), or Slow (700 ms). Set an optional section-boundary transition and selected-slide override. The slide override takes priority, followed by section-boundary and project settings. Question navigation is always instant. New wizard projects default to Fade; older projects retain instant navigation until you select a transition.

Transitions finish before the slide timer starts. Outgoing videos pause immediately, incoming video playback waits until the transition completes, and decorative slide animations pause during the transition. Rapid navigation cancels the prior transition. Browser reduced-motion preferences and **Disable presentation motion** suppress both transitions and decorative animations. Theme and transition settings travel with editable and playback exports. Actual OBS playback still needs a manual check.

## Open and switch presentations

Use **Presentations** on the playback toolbar, **P**, or **Project → Recent presentations** in the editor. Cards show a first-slide preview, project name, last saved time, and slide count, with a clear **Browser draft** label. Search filters the cards by name.

- **Open ZIP / JSON** loads a file; the drop area accepts the same formats. Editable ZIP is preferred because it includes media. JSON with media references needs the corresponding saved local assets or its full ZIP.
- **New presentation** opens the existing wizard with Blank, Studio demo, or Import choices.
- **Open** restores a browser draft and its media. **Export backup** downloads an editable ZIP without changing the active project.
- **Duplicate** writes a separate project ID and media namespace. **Remove local copy** deletes only that browser copy after confirmation, including its media. The currently open project cannot be removed. Exported ZIPs are unaffected.

Before switching changed work, choose **Export and switch**, **Save locally and switch**, or **Cancel**. Export begins a browser download; saving locally keeps the current draft in the recent list. If saving or loading media fails, the current project stays open. Reopening a file with the same ID preserves a differing prior local version as a separate recent project.

The editor header distinguishes Saving, Saved locally, and Save failed. **Saved locally** is not a shared or portable backup. Browser storage remains tied to the same profile and origin; clearing site data or changing browsers can make drafts unavailable. Export an editable ZIP for durable sharing.

## Compact controls

The playback toolbar keeps Presentations, Previous, Play/Pause, Next, Sections, Fullscreen, and Edit visible. Browse Questions appears for a Q&A section. **More** contains kiosk mode, notes, help, and contextual detection examples. Sections provides access to questions and commands. Existing shortcuts remain available.

The editor header shows the project name and save state, Project, Undo, Redo, Present, and Close. **Project** contains New presentation, Open file, Recent presentations, Export, and Recovery & reset. **Add slide** opens the visual gallery; Media remains beside the selected-slide preview. Branding shows logo previews and Change logo, with expandable logo controls and brand presets.

## Studio demo

The default deck has eight editable slides: welcome, comparison, workflow, table, bundled media, harmless command example, searchable Q&A, and closing. Its sections are Overview, Demonstration, and Questions. Main demo loop plays seven slides and leaves Questions for live discussion. Every slide has presenter notes.

The included diagram is stored within the standalone HTML and included as an asset in ZIP exports. It needs no external image service. The generic wizard offers Blank, Studio demo, or Import. Reset restores the current starting presentation; imported legacy product projects retain their own starting content.

To use your previously exported project, choose Presentations → Open ZIP / JSON and select its editable ZIP. The product deck is separate content; it is not a built-in choice in the generic studio.

## Color schemes

Open **Branding → Theme gallery** to choose Studio Blue, Midnight, Indigo, Forest, Warm Neutral, or Monochrome. Each has coordinated light/dark variants and live thumbnails of the selected slide. Preview or Cancel changes nothing; **Apply colors only** updates accents, backgrounds, cards, text, tables, and borders while preserving logos, fonts, content, sections, and media. Undo restores the previous palette.

Presentation appearance is independent of editor appearance. Older projects retain their original colors until you explicitly apply a scheme. The gallery's Studio Blue preset uses a slightly darker blue for small-text contrast; opening an older presentation does not change its existing blue.

Expand **Customize colors** for individual tokens. Changing a token labels the scheme Custom and retains the other appearance variant. **Apply theme default colors** in the appearance preview restores defaults for the current scheme/appearance.

Use **Save current theme** in the gallery to save the project's current colors—not an unapplied gallery preview. Saved themes appear under **Brand presets**, prefixed Theme. Export/import preset JSON to share them. Theme presets apply colors and appearance only; full brand presets can also include fonts, headers, and logos. Project ZIPs retain applied scheme settings; they do not include the browser's entire preset library.

## Edit blocks directly

The editor preview has **Edit blocks** and **Preview** modes. Existing panels remain available in both.

| In Edit blocks | Behavior |
| --- | --- |
| Click a heading or paragraph | Type directly; the project model, slide title where relevant, and panel values update |
| Select text, then Bold/Italic | Format the selection; with no selection, format the whole text block |
| Align or Bullets | Align a supported text block, or convert paragraph lines to a bullet list |
| Click a card's padding | Select the card; edit its text or duplicate/delete the card |
| Click a table cell | Edit text or formatting directly; Tab/Shift+Tab moves between cells |
| Click an image/video | Select media and open Media settings; video does not play in editing mode |
| Click a logo | Select it and open Branding |
| Click commands | Open the Commands panel for structured editing; commands never execute |

Escape or Done finishes editing without closing the editor. Ctrl/Cmd+B and Ctrl/Cmd+I format text. Ctrl/Cmd+Z and redo use project history. Pasted and dropped text is treated as safe text; arbitrary clipboard HTML is not inserted. Use Media settings for image/video files.

The primary slide heading and table structure are protected from block deletion/duplication. Use Tables for rows/columns. Complex layouts retain their existing panel controls. Blocks stay in the template flow; free positioning and resizing are not part of this version. Duplicating blocks or adding long content may trigger the existing overflow warning.

In **Preview**, text is not editable. Question browsing, copy buttons, links, and muted video controls work. Switching to Edit blocks pauses preview video. These editing controls do not appear in presentation playback or exported content. Older projects, including legacy schema-v2 ZIPs, use the same structured content model and remain editable.

## Focus on media

Click media or **Expand** during playback or interactive Preview. Use the image zoom controls, wheel, double-click, drag, or **Fit**. **Escape** or **Return to slide** restores the slide and prior presentation play/pause state. Native video controls remain usable. Customize this under **Presentation settings → Media Focus**. Reduced motion disables focus animation. In OBS use Browser Source **Interact**; focus stays within that source canvas.
