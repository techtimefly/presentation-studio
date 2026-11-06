# Publishing the neutral release

Version 0.7.0 is the neutral open-source baseline. Original studio code and original sample assets use the MIT license; bundled dependencies keep their own notices.

## Clean history

Use the prepared clean source snapshot in a fresh repository. It contains one initial commit and no earlier product decks. Do not make the original development repository public: deleting files in the latest commit does not remove their earlier versions. Do not merge the old repository history into the clean public repository.

The source ZIP contains the current source tree without Git metadata. Extract it into a fresh directory, run `git init -b main`, stage the files, and create an initial commit. Build outputs in dist are ignored and can be regenerated. Configure the intended GitHub remote only after checking its destination. Existing public repositories with earlier content need a deliberate history-cleanup plan; copying these files over them is insufficient.

## Validate and publish

Run `npm ci`, `npx playwright install chromium`, `npm run check`, and `npm run package`. The build emits only the demo and blank HTML files. Automated checks reject vendor content outside two identifier-only compatibility aliases. Compatibility tests use synthetic workshop content.

Review the destination repository, description, visibility, README, LICENSE, and third-party notices before publishing. Release tags must match package.json. The included workflow prepares a draft release for review. No GitHub publication or repository visibility change is performed by the local preparation step.

## Existing private presentations

Keep earlier presentation exports private and separate. Users may explicitly import their own files, preserving their content and branding. Earlier browser recovery data is copied into neutral storage on supported browsers without deleting the original database. Use editable ZIP backups when moving to a new browser or origin.
