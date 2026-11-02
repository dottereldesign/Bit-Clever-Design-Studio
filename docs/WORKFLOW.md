# Solo workflow

Default: edit -> live update in Design Dev -> focused check -> tell the user it is visible -> commit and push a feature branch.

Local use and GitHub backup are the priority. A pushed branch backs up the work; CI and PR integration must not delay delivery of a working local change. Open a PR when useful, and merge only after required checks pass. Main remains protected. Do not bypass checks or force-push main.

Small cosmetic changes need a focused visual check, not a production build or the whole native and browser test suite. Run type checks and relevant tests for behavior changes, and broader checks for native or database changes. Do not bump versions, build installers or publish releases for routine tweaks. Publish only when the user explicitly requests it; batch accumulated changes into that release.

## See local changes

- Open **Design Dev** from the Windows desktop and leave its terminal and app open. It runs `npm run desktop` with the checkout as its working directory. From a normal PowerShell window you can also run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1` in the repository.
- The first development startup can take minutes to compile Rust. Once open, CSS and frontend changes arrive through Vite hot reload; there is no native build or app restart for a colour or font tweak. Native code changes can rebuild and restart the development app.
- On first launch, confirm the expected projects and library are present. Do not launch it through Codex's redirected app-data context or copy the user's database. The launcher rejects the known redirected environment and test-data overrides.
- If no development session is running, tell the user to open **Design Dev**. Do not substitute a standalone build without an explicit request.
- Report verified local feedback before backup work. Commit and push each completed task, or a batch of rapid tweaks at an agreed checkpoint. Always identify any pending backup.
- Documentation-only changes do not require an app build. Launcher prerequisites can be checked with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Check`.

## Refresh the standalone app on request

The ordinary **Design** shortcut opens the last packaged build; it does not hot reload. When the user asks to refresh it, run `npm run package -- --no-bundle` once. This updates `app/Design.exe` and `app/build.json` without an installer and can take several minutes.

Verify the build metadata's commit and executable checksum, then close and reopen through the normal **Design** shortcut. Local builds can share the current version; their commits distinguish them.

## When a release is requested

Integrate intended changes through passing PRs, bump matching package/Rust/Tauri versions once, run version and secret checks, and release from clean main with `npm run release:tag`. Wait for publication and verify the installer manifest and SHA-256. Use `npm run package` only when a full local installer is needed.

## Keep personal data out

Media, library databases, backups, credentials, installers and local tools stay out of Git. Run `npm run scan:secrets` after staging. Export personal libraries outside the repository. Use existing GitHub authentication; never commit tokens.
