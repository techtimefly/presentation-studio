# Troubleshooting

| Symptom | Action |
| --- | --- |
| Changes disappeared in another browser | Browser drafts are local. Export/import an editable ZIP for handoff. |
| Media missing after JSON import | JSON contains paths, not media bytes. Import the complete editable ZIP. |
| Re-export reports missing assets | Import the editable ZIP containing recovery and Trash assets before exporting again. |
| A slide is absent from playback | Check slide visibility, section visibility, and the selected kiosk loop. |
| Content reaches the footer | Shorten content, use another layout, or divide it across slides. The preview flags overflow. |
| A command does not execute | Commands are shown and copied only. Run reviewed commands in your own controlled environment. |
| Video autoplay fails | Prefer MP4/WebM and muted playback; confirm codec/browser support and test OBS locally. |
| Browser test cannot find Chromium | Run `npx playwright install chromium`, or set `CHROMIUM_EXECUTABLE_PATH`. |
| New project has vendor content | Open the neutral distribution or choose New project → Blank. Use Studio demo for the generic walkthrough; product presentations are opened through their exported ZIPs. |
| Browser recovery unavailable with file URLs | Export a ZIP and optionally use `npm run serve` for a stable localhost origin. |

Do not reset the browser profile to fix draft problems until you have exported the current editable project.
