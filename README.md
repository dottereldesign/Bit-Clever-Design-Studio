<p align="center">
  <img src="src/assets/app-logo.png" width="72" alt="Bit Clever logo">
</p>

<h1 align="center">Bit Clever Studio</h1>
<p align="center">A local workspace for creative projects, moodboards and design inspiration.</p>
<p align="center">
  <a href="https://github.com/dottereldesign/Bit-Clever-Studio/releases/latest">Download for Windows</a> ·
  <a href="#your-library--backups">Storage & backups</a> ·
  <a href="#development">Development</a>
</p>

![Design library with a masonry gallery and separate Design Inspo and App Components folders](docs/images/library.jpg)

## Six areas, one studio

| Area | Purpose | Availability |
| --- | --- | --- |
| **Marketing** | Plan campaigns, organise creative assets and schedule content. | Planned |
| **Leads** | Track opportunities, contacts and follow-ups through to a project. | Planned |
| **General** | Save websites, links, resources, fonts and brand guidelines. | Available |
| **Projects** | Manage files, briefs, deadlines, next actions, client records and moodboards. | Available |
| **Design Inspo** | Collect visual references in flexible, shared folders. | Available |
| **App Components** | Organise interface references, components and page templates. | Available |

Marketing and Leads are the next planned additions; they are not implemented yet. Installed releases can lag behind the development workspace. Check release notes before downloading.

## Work with your library

- **Design Inspo & App Components** — organise references into multiple folders, including across both sections. Add tags and collect references into projects without duplicating originals.
- **Project files** — open a project as a folder workspace with Details, Tiles or Columns layouts. Keep any file type alongside links and references; browse nested folders and Unfiled, preview supported formats, or open files in their default app. Project-first imports stay out of Design Inspo. [Workspace details](docs/PROJECT-WORKSPACE.md).
- **Project overview** — keep a brief, status, deadline and next actions in a dedicated project section. Edits save in place and are included in backups.
- **Client records** — keep contacts, meeting notes, feedback and decisions alongside each project. Link files and follow-ups, with saved records included in backups.
- **Moodboards** — arrange project references, notes and colours on a freeform canvas, with resize, zoom, Undo and backup support.
- **Link ratings** — rate links out of five stars in Links or projects. Ratings stay consistent across views, with filters, sorting and bulk updates.
- **Fast imports** — paste images, drop files or drag images from webpages. File them directly into the selected folder; edit details later.
- **Websites** — save a URL with a full-page screenshot captured through Chrome or Edge, or supply your own image. Scroll inside the thumbnail, open the full preview or visit the website.
- **Media previews** — browse images, GIFs and videos in a responsive gallery. Use quick preview, zoom and pan, or Ctrl + wheel to enlarge a thumbnail.
- **Links & resources** — keep useful links, fonts, CodePen references and brand guidelines alongside your visual library.
- **Colour picker** — sample colours, copy hex values and assign saved colours to projects.

## Make the workspace yours

![Home dashboard with resizable image tiles linking to collections and projects](docs/images/home.jpg)

Drag sidebar destinations onto **Home** to create shortcuts. Resize and rearrange tiles, drop in cover images and adjust labels, overlays and spacing. Clicking the logo returns Home; reopening the app restores your last workspace.

![Customisation panel with sidebar appearance choices](docs/images/customise.jpg)

Customise sidebar layouts, section styles, icons and Home tiles. Collapse sections, reorder folders and add your own General shortcuts. Appearance changes and organisation actions support Undo/Redo; settings undo lasts for the current session.

*Screenshots show the app with the owner’s design library. Reference artwork belongs to its respective creators and is not bundled with the app.*

## Get started

**Windows 10/11 · 64-bit.** The installer includes media tools and installs WebView2 if needed.

1. Download **Design-Setup.exe** from the [latest release](https://github.com/dottereldesign/Bit-Clever-Studio/releases/latest) and install it.
2. Launch Bit Clever Studio. Click **Storage** in the header to create or open a self-contained library.
3. Choose a Design Inspo or App Components folder, then paste or drop your first references. Use **Websites** for saved sites and screenshots.

Check **Settings → Get latest update** for new releases. Close the app before installing an update.

## Your library & backups

Your originals and organisation belong together in a portable library:

```text
Bit Clever Library/
├── Design Inspo/
├── App Components/
├── General/
├── Appearance/
├── Library Data/
└── Browse Library.html
```

Files are stored once; the database preserves every folder membership, project hierarchy, link rating and tag. Home covers, custom icons, saved colours, links and website screenshots are included in full backups.

- **Back up while using the app:** Storage → **Back Up Now**, then **Verify Backup** on the destination.
- **Copy to an external drive:** close Bit Clever Studio first, then copy the entire library folder.
- **Open a saved copy:** put it in its permanent location, then Storage → **Open Existing Library**.

Portable backups exclude removed items, undo history and temporary caches. Metadata-only exports are not full backups. **Merge Backup** imports into an existing library and can replace matching records’ organisation; opening a separate copy keeps the libraries separate.

Do not manually rename files inside a managed library. This repository contains the application source, not your personal library.

[Storage details](docs/LIBRARY-STORAGE.md) · [Website capture](docs/WEBSITE-CAPTURE.md)

## Keyboard essentials

| Action | Shortcut |
| --- | --- |
| Search the current view | `/` or `Ctrl + K` |
| Quick preview | `Space` |
| Previous / next preview | `←` / `→` |
| Enlarge a hovered thumbnail | `Ctrl + mouse wheel` |
| Organise selected media | `C` |
| Undo / redo | `Ctrl + Z` / `Ctrl + Shift + Z` |
| Settings | `Ctrl + ,` |

See Settings for the full shortcut list. Single-key shortcuts apply outside text fields.

## Development

Built with **React, TypeScript, Tauri, Rust and SQLite**. Requires Node.js 20+, Rust, Microsoft C++ Build Tools and a Windows SDK.

```powershell
npm ci
npm run desktop
```

Keep the development session open for frontend hot reload. The **Design Dev** shortcut runs `scripts/start-dev.ps1`; the ordinary installed app does not receive development changes.

```powershell
npm test                 # Frontend unit tests
npm run test:native      # Native and storage tests
npm run test:boards      # Browser interaction checks (requires Chrome)
```

Standalone builds and installers are separate from development. See the [workflow](docs/WORKFLOW.md) for packaging and releases.

[Development notes](docs/DEVELOPMENT.md) · [Performance](docs/PERFORMANCE.md) · [MIT licence](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
