# Changelog

## Unreleased — Direct media editing and booth mode

Added preview file-drop zones, a draggable/keyboard-accessible placement grid for existing media, replacement, free placement, proportional resize, snapping, crop, keyboard nudges, multiple media objects, layering, captions, alternative text, hide/delete, and single-operation undo. Added object/slide/presentation design locks and protection against indirect section edits.

Added configurable conference booth permissions, passphrase unlock, persistent browser lock/draft recovery, question access, idle return, and a separate offline booth playback export without authoring code, private notes or recovery content. Optional validated fields preserve older imports.

## 0.7.0 — Independent open-source release

Removed the archived vendor deck, product Q&A, commands, results, documentation links, and archive build. Added neutral export/schema/storage identifiers, import-only compatibility, a copy migration for browser recovery drafts, synthetic compatibility fixtures, an original icon, and the MIT license. Public source is prepared with a clean initial history.

## 0.6.0 — Media Focus

Added click-to-focus images and videos in the presentation and interactive editor Preview. Expand and return animations stay within the slide canvas, slide advancement pauses and resumes its prior state, and videos retain their element and playback position. Images support bounded zoom/pan and Fit. Return, Escape, focus trapping, reduced motion, caption controls, and project-level defaults are included. Existing projects remain compatible. Camera capture and widgets remain future work.

## 0.5.0 — Themes and visual block editing

Added a live theme gallery with six paired light/dark schemes, optional palette tokens, custom colors, and portable theme-only presets. Explicit scheme application preserves logos, fonts, and content. Older presentations retain their saved colors.

Added direct text, card/list, and table-cell editing in the slide preview, with formatting, alignment, duplication/deletion where supported, media/logo selection, and an interactive Preview mode. Safe text paste, project undo, side-panel synchronization, and preview video behavior are covered by regression tests. Legacy legacy ZIPs were verified through open, edit, theme change, export, and reopen.

## 0.4.0 — A generic starting experience

Made From idea to presentation the default eight-slide demo, with neutral branding, sample media, a harmless command, searchable Q&A, and presenter notes. Blank, Studio demo, and Import replace vendor-specific starting choices. The main loop excludes Questions for live discussion.

Removed stock vendor deck content and documentation links from generic HTML and release packages. Existing legacy schema-v2 ZIPs still import with their questions and their own reset baseline. Added an offline demo editable ZIP and layout/media compatibility checks.

## 0.3.0 — Compact controls and recent presentations

Consolidated playback actions into a smaller toolbar with More, and editor actions into Project and Export menus. Add slide now opens the visual gallery; logo controls and brand presets are expandable.

Added a shared Presentations picker with recent browser drafts, search, first-slide previews, file selection and drag-and-drop, editable backups, duplication, and confirmed local removal. Switching waits for a complete transactional local save and keeps the active project open on failure. Reopening a differing file with the same project ID preserves the previous local version separately. The editor header now shows project name and local-save state.

## 0.2.1 — Presentation theme fix

Fixed the actual presentation background retaining the original light palette after selecting dark mode. The stage-specific base style now yields to the project theme. Added regression coverage comparing the live canvas with the editor preview in light and dark modes, including closing the editor.

## 0.2.0 — Setup, branding, and transitions

Added a four-step project wizard, browser-local and portable brand presets, theme-specific logos with size and placement controls, and optional title-slide logos. Theme changes retain custom colors and provide an explicit reset to theme defaults.

Added project and slide transitions, section-boundary overrides, speeds, and previews. Navigation cancels pending animations, questions jump instantly, video playback and slide timers wait for transition completion, and reduced-motion settings disable movement. Older projects retain instant navigation. Settings and logos survive editable and playback exports.

## 0.1.0 — Repository foundation

Organized the existing Presentation Studio into maintainable source fragments and a deterministic standalone build. Added neutral and legacy starting distributions, a layout sampler, sample media, documentation, build/browser checks, and draft release packaging.

Existing features include project creation, independent dark themes, visual layouts, editable sections, question navigation, media placement, recovery, and portable editable/playback exports.
