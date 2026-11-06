# Contributing

Use a feature branch and pull request. Describe the user-visible problem, changed behavior, and validation. Keep customer-specific projects, credentials, proprietary source code, and recordings outside the repository.

## Local checks

```sh
npm ci
npx playwright install chromium
npm run check
npm run package
```

Edit source files rather than `dist/`. The runtime files share a single ordered scope; validate the assembled build after edits. Use the browser tests to cover a changed user workflow rather than duplicating implementation details.

## Layout changes

Add or update a layout in `projectCreateTemplate` in `src/runtime/editor.js`, its gallery entry in `src/runtime/studio.js`, allowed import validation, and relevant styles. Ensure text remains editable, defaults fit 16:9, and existing content survives the retain-content option. Add the layout to the sampler and test it.

## Template changes

Use original, neutral sample content in `templates/studio/` and `examples/`. Do not contribute vendor logos, copied documentation, proprietary presentations, or customer material. Examples must be self-contained and validated project packs. Commands are display/copy material; never add execution behavior. See `docs/content-and-branding.md`. Contributions are provided under the MIT license.

## Review checklist

- Check desktop and laptop layouts, theme contrast, keyboard access, and focus.
- Test editable ZIP export/import and playback reopening after persistence changes.
- Preserve slide and section IDs unless deliberately creating new content.
- Update relevant docs and the changelog.
- Keep third-party notices when changing vendored code.

By submitting original contributions, you agree to provide them under the project’s MIT license. Third-party material must retain its own applicable license and attribution.
