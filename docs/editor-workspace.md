# Editor workspace

The editor uses three areas: sectioned slide thumbnails on the left, the editing canvas in the center, and a contextual inspector on the right. These changes do not introduce a new presentation format.

## Select and edit

Click text to edit it directly, or select a media frame or table cell. The inspector follows the selection:

- **Slide:** section, layout, duration, transition, visibility and block editor. Click the empty canvas or the Slide tab to return here.
- **Text:** the existing formatting toolbar and block editor, plus block font size in pixels. Font size uses the existing safe style representation and is undoable.
- **Media:** replacement, placement grid, free positioning, crop, layers, caption, alternative text and visibility. The old Media Manager remains available for advanced primary-media settings.
- **Tables:** row/column and cell controls.
- **Commands:** displayed command variants; these are never executed.
- **Notes:** presenter notes.

The title and design lock buttons remain available above the contextual controls. The inspector scrolls independently of the canvas. Existing lock and recovery protections still apply.

## Project settings

**Project settings** in the editor header opens a separate dialog containing Branding, Presentation settings, Sections, Kiosk loops and Recovery & reset. It retains the existing theme gallery, presets, logos, transitions, booth controls and recovery actions. **Back to canvas** or Escape while inside that dialog closes it without closing the editor. The title bar and slide navigation remain available while settings are open.

## Thumbnails and ordering

Thumbnails use the current rendered slide and theme, including media placement. They are inert, load only as they approach the visible sidebar, contain no interactive controls and never play videos; videos use a poster or static Video placeholder. Slide titles remain searchable, and badges indicate individually hidden or locked slides.

Use section headings to collapse or expand groups. Search temporarily expands matching groups. Drag an unlocked thumbnail onto another thumbnail to reorder within the same section. Drop in the top half to insert before, or the bottom half to insert after. One reorder is one undo step. Clear text search before dragging so hidden neighbors do not make ordering ambiguous. Existing up/down buttons are the keyboard alternative. Move a slide to another section through its Section field; cross-section thumbnail drops are refused.

Custom kiosk loops keep their intentional order. As with the previous move buttons, a loop keyed to that section follows the section order. Presentation and slide locks prevent protected drag reordering.

## Zoom and pan

- **Fit** shows the complete slide in the available viewport; the readout shows the actual fit percentage.
- Choose **50–200%** or use plus/minus for closer editing.
- Focus the canvas, hold **Space**, and drag to pan. Middle-mouse dragging also pans.
- Ctrl/Cmd + mouse wheel zooms around the pointer. With the canvas focused, Ctrl/Cmd + plus/minus zooms and Ctrl/Cmd + 0 returns to Fit.
- Escape during a pan cancels that view movement. Releasing the pointer commits only the view position, not an undo entry.
- Typing spaces in editable text and form controls continues to work normally. Media Focus and video controls keep their keyboard behavior.
- Selecting a different slide resets the view to Fit. Entering interactive Preview also fits the whole slide so presentation controls remain reachable. Resizing the window recalculates Fit.

Zoom, pan, selection and section folding are transient editor view state. They are not stored in project JSON, undo history, playback packages or booth exports, and they never change the actual presentation stage. Media dragging and resizing continue to use normalized slide coordinates at any zoom level.

## Compatibility

Older editable ZIPs and JSON files open through the same validator, preserving content, themes, media, notes, locks and reset baselines. Exports keep their existing schema. There is no migration or automatic layout conversion for this workspace enhancement.
