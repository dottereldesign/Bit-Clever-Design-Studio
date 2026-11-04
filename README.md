# BitClever Design Studio

A personal Windows library for images, videos and inspiration links.

[Download Windows setup](https://github.com/dottereldesign/design-viewer/releases/latest/download/Design-Setup.exe)

1. Download **Design-Setup.exe** and run it.
2. Launch the installed app from the Start menu.
3. Go to **Settings → Change Design folder** and choose your media folder.

To collect your first reference, create a **Typography** category with the **+** beside Categories. Select it and paste an image. Later, open Typography, press **/** to search by filename, and press **Space** on the focused thumbnail to preview it. Saved websites open in your Windows default browser.

Windows 10/11, 64-bit. Setup includes the video tools and installs WebView2 if needed.

This repo backs up the app only. Your media, saved links, projects and tags are stored separately.

Back up everything: **Settings → Export full library**. Choose a folder on your PC or an external drive; progress and any missing files are shown.

To restore, copy the whole backup folder to its permanent location, then use **Settings → Import metadata** and choose its `library.json`.

Updates: check your version in **Settings**, then use **Get latest update**. Close Design before installing the new setup.

## Build from source

Requires Node.js 20+, Rust and the Microsoft C++ Build Tools with a Windows SDK.

```powershell
npm ci
npm run desktop
```

For local UI iteration, keep the development session open: frontend edits hot reload. On Windows, the **Design Dev** shortcut (or `scripts/start-dev.ps1`) starts this session. Its first startup may take time to compile Rust; ordinary CSS edits do not require rebuilding the desktop app.

Refresh the standalone executable at a checkpoint: `npm run package -- --no-bundle`. Create an installer only when needed: `npm run package`.

[Solo GitHub workflow](docs/WORKFLOW.md) · [Development notes](docs/DEVELOPMENT.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)
