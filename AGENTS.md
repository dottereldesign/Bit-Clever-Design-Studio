# Development workflow

Prioritize immediate visual feedback in a persistent development session, then GitHub backups. A normal task is complete when the requested change works locally and its source is committed and pushed. Updating the standalone executable and publishing an installer are separate checkpoints, only when the user explicitly requests them.

## Default: local change and GitHub backup

1. Inspect the working tree and preserve unrelated user changes. Use a short-lived `feat/<topic>`, `fix/<topic>` or `docs/<topic>` branch from current main when starting new work; continue an existing unfinished branch when appropriate. Never discard work or block a small edit on unrelated branch housekeeping.
2. Use the persistent **Design Dev** desktop session (`npm run desktop`) for local iteration. CSS, text, spacing, image and React edits should reach that window through Vite hot reload. Do not run `npm run build` or `npm run package` for routine cosmetic changes. Use a focused visual check; run type checks and relevant tests for behavior changes, and broader checks for database or native changes.
3. Make the change visible before GitHub backup work and report that milestone promptly, based on what was actually verified. If there is no development session, tell the user to open **Design Dev** from Windows; do not silently substitute a standalone build. The first development startup can compile Rust, but frontend edits in a running session do not need a native rebuild. Native edits can rebuild and restart the development app.
4. After local feedback, commit only the requested changes and push using existing GitHub authentication. Run `npm run scan:secrets` after staging. A completed task normally gets a backup; when the user is actively iterating through several small tweaks, group them at an agreed checkpoint or the end of the batch. State clearly if a backup is still pending. Keep media, library data, credentials, installers, caches and local tools out of Git. Never print secrets. No additional permission is needed for routine commits and pushes.
5. Open a concise PR when useful to integrate the branch. GitHub checks may run asynchronously: do not make the user wait for CI, a merge, or a release before reporting a verified local update and successful push. A pushed branch is a valid backup. Report any pending integration honestly. Merge only after required checks pass; never bypass branch protections or require the sole owner to approve their own work. Do not force-push main.
6. Do not bump versions, create release tags, publish GitHub releases, or build installers for routine local changes. Multiple local changes can share the current version. Use the Git commit and build metadata to identify local builds.

## Standalone builds and explicit releases

When the user asks to refresh the standalone app, run `npm run package -- --no-bundle` once to update `app/Design.exe` and `app/build.json`. Verify the recorded commit and executable hash, then tell the user to reopen from the normal **Design** shortcut. This optimized build can take minutes; it is not part of routine UI iteration. Do not bump the version for a local standalone refresh.

When the user asks to publish a release, collect the intended changes, merge passing PRs, update clean local main, bump all versions once with `npm run version:bump -- patch` (or minor for a substantial release), and commit/push through the normal PR checks. Run `npm run check:version` and `npm run scan:secrets`. From clean, synchronized main, run `npm run release:tag`. Wait for the Windows release workflow, then verify its version, commit and SHA-256 manifest before claiming publication. Run `npm run package` if a matching local installer is needed. Never rewrite published tags.

## Local app and data

The **Design Dev** shortcut runs `scripts/start-dev.ps1` from the user's normal Windows session. Leave its terminal and app open while iterating. The ordinary **Design** shortcut opens the last standalone build and does not receive hot reload. Do not claim that standalone build was updated when only source changed.

Do not silently launch either app under Codex's redirected app-data context or automate the user's desktop. On first development startup, have the user confirm that their expected projects and library are present; do not infer the correct library from a path alone. Do not copy or modify the user's database to set up development. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Check` validates launcher prerequisites without opening the app.

The repository is public and MIT-licensed; personal media and library data remain private. Never commit tokens or add a personal access token to workflows; releases use the short-lived `GITHUB_TOKEN`. Pin third-party Actions to commit SHAs. Do not use `pull_request_target` to execute untrusted PR code. See [the solo workflow](docs/WORKFLOW.md).
