# Direct media editing and booth operation

## Edit, Preview, Present, Booth

Open **Edit → Edit blocks** for on-slide manipulation. Click text to edit it as before. The media inspector sits beside the preview and has its own scroll area. **Preview** tests audience interactions and Media Focus; dragging files does not edit the preview in that mode. **Present** closes authoring. File drops outside editing are intercepted to prevent browser navigation or accidental replacement.

## Media

Drop one image or video onto the slide preview. Hover over **Replace selected**, **Left**, **Right**, **Background**, or **Floating**, then release. The inspector's upload button offers the same placements without dragging. The current limit is 250 MB per file and 30 additional media objects per slide; codec support depends on the browser.

Existing media also has a **Change placement** handle when selected in Edit blocks. Drag that handle into **Left**, **Right**, **Background**, or **Floating**; the placement grid reappears without choosing a new file. Clicking the handle (or pressing Enter/Space on it) opens the same choices for keyboard use. The inspector also has **Change placement…** for objects that are behind other content. Escape, Cancel, or releasing outside the grid leaves the slide unchanged. The change is one undo step, and ordinary frame dragging remains free movement without the grid.

A structured placement uses the primary media slot. If you reposition an additional object into a structured zone, the old primary is preserved as a floating object; a locked primary must be unlocked first. Background media stays behind slide content. Asset bytes, captions, fit and other settings are preserved.

Replacing media preserves its frame, placement, captions and other settings. Selecting **Add dropped media as another floating object** creates a separate object; existing presentations keep their original primary media layout. Select overlapping or hidden media in the object list.

**Free placement** converts the selected frame to relative slide coordinates. Drag to move, or use corner handles to resize proportionally. Hold **Shift** for free proportions, or **Alt** while moving to bypass snapping. Guides mark the canvas center, and movement snaps to the center, edges and margins. Position/size percentage fields provide a keyboard alternative. Focus a frame and press arrow keys to nudge; Shift moves ten times farther. Escape or a cancelled pointer gesture restores its previous placement. Each completed gesture is a single undo operation, followed by the existing autosave.

Choose **Fill / crop** and enable **Drag image to crop** to adjust the image inside its frame. Fit, captions, alternative text, hide, delete, bring forward and send backward are in the inspector. Additional videos use fixed slide timing; the original primary video retains its manual/end-of-video timing options. Media Focus works for primary and additional objects in Preview and presentation.

## Design locks

- **Lock object** protects moving, resizing, replacing, changing and deleting that media object.
- **Lock slide** protects slide content, placement, media and its section from indirect changes, including section deletion.
- **Make presentation read-only** protects the project state until explicitly unlocked.

These are editing safeguards, not passwords. Unlock through the inspector's object list or lock buttons. Undo/redo cannot change currently protected content. Edit fields restore their prior value if a protected change is attempted. Use an editable ZIP as your master copy.

## Booth mode

Open **Presentation settings → Booth mode / export**. Choose a nonempty return loop and enable audience navigation/pause, question browsing, Media Focus, video controls, and external links separately. External links default to disabled. Idle return defaults to 120 seconds; 0 disables it. It pauses the idle countdown while a video is playing, closes audience panels, and resumes the configured loop after inactivity.

Enter and confirm a presenter passphrase of at least eight characters. No default or universal unlock code exists. Starting booth mode first saves the complete project and referenced media in IndexedDB, then stores a salted PBKDF2-SHA256 verifier locally. The plaintext passphrase is not saved. If local persistence fails, activation is refused. The browser must support Web Crypto (a secure context such as HTTPS or localhost; Chromium also supports local files).

Booth mode hides authoring and notes, intercepts editing shortcuts/file inputs/drops, and guards authoring action entry points. Its own **Browse questions**, **Return to loop**, lock indicator and **Presenter unlock** remain available. Refresh restores the lock and the browser draft for that project on the same origin/path. Correctly unlocking stops the loop and restores presenter controls. If you forget the passphrase, open your separately saved editable ZIP in a fresh browser profile or path; there is no in-app passphrase reset.

This is a deterrent to casual in-app tampering. Someone controlling the browser or computer can inspect and modify local code/storage. Use a restricted OS account and a managed kiosk browser for unattended conference hardware. The app does not lock the operating system or prevent browser shortcuts.

## Booth ZIP

**Export booth ZIP** creates a separate standalone playback page with its own small runtime. It includes only the selected visible loop and optional question sections, their visible media, and branding. Authoring UI/code, project switching, presenter notes, starting templates, discarded/hidden slides, undo/redo, checkpoints and section Trash are omitted. A project JSON master copy is not included.

Unzip the full package, then open index.html. It works without network access, supports navigation, searchable questions, video, image focus/zoom/pan and reduced motion. Presenter unlock exposes playback controls only; it never recreates an editor. Refresh relocks this export. Its passphrase verifier is inspectable, so it is not encryption or copy protection.

## Compatibility

New optional fields are `state.editLocked`, `slide.editLocked`, `media.canvas`, `state.mediaObjects`, and `presentation.booth`. Old schema-v2 files default to unlocked structured layouts. Legacy schema identifiers remain importable. Assets in original slides, extra objects, checkpoints, Trash and undo history remain in editable exports; playback/booth packages omit recovery-only content. Older app releases may not retain these new fields when re-exporting, so continue editing new features with a current release.
