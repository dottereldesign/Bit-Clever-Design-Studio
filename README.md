<p align="center">
  <img src="src/assets/app-logo.svg" width="72" alt="Bit Clever Studio mascot logo">
</p>

<h1 align="center">Bit Clever Studio</h1>
<p align="center">A local studio for research, inspiration, leads and creative projects.</p>
<p align="center">
  <a href="https://github.com/dottereldesign/Bit-Clever-Studio/releases/latest">Download for Windows</a> ·
  <a href="#your-library--backups">Storage & backups</a> ·
  <a href="#development">Development</a>
</p>

![Design library with a masonry gallery and separate Design Inspo and App Components folders](docs/images/library.jpg)

## Eight areas, one studio

| Area | Purpose | Availability |
| --- | --- | --- |
| **Marketing** | Plan campaigns, organise creative assets and schedule content. | Development |
| **Leads** | Track opportunities, contacts and follow-ups through to a project. | Development |
| **Clients** | Prepare meetings, track tasks and pricing, keep documents and a lasting relationship history. | Development |
| **Projects** | Manage files, briefs, deadlines, next actions, client records and moodboards. | Available |
| **General** | Save websites, links, resources, fonts and brand guidelines. | Available |
| **Design Inspo** | Collect visual references in flexible, shared folders. | Available |
| **App Components** | Organise interface references, components and page templates. | Available |
| **Research** | Analyse markets, competitors and pricing; keep plans, books, podcasts, courses and findings. | Development |

Clients, Marketing, Leads and Research are available in the development workspace. Installed releases can lag behind source changes; check release notes before downloading. [Leads and Marketing details](docs/STUDIO-WORKSPACES.md).

## Client relationships

Open **Clients → Today** for upcoming meetings, due tasks, waiting items and the combined activity feed. Each profile has Feed, Meetings, Tasks, Files and Pricing tabs, a cropped display picture and links to existing projects. Shared project tasks and contacts stay in their original records.

Saved relationship changes, including undo/redo, have a durable local history included in metadata and portable backups. Client imports stay out of the Design Inspo inbox. Meeting packs contain a printable HTML document and the selected original attachments; use your browser’s Print → Save as PDF when needed. Email exchanges and payments are tracked manually. [Implementation and coverage](docs/CLIENTS.md).

## Research to delivery

- **Research** — keep notes, source links, tags, status and review dates. Link research to projects, attach files or existing references, and capture findings separately from working notes. Books, podcasts, courses and articles share a reading/listening list. Research records and attachments are included in library backups.

- **Leads** — track opportunities in a table or draggable pipeline, record interactions and schedule next actions. Share contacts across projects without merging people by name.
- **Project handover** — turn a won lead into a project, carrying its brief, contacts, actions and file references. Keep a link back to the opportunity and its source campaign.
- **Marketing** — plan campaigns, collect ideas, write content, arrange moodboards and schedule content on a calendar. Record results manually; no advertising account or subscription is required.
- **Local records** — saved campaign and lead records travel with library backups. Imports stay in their workspace; existing references can be shared without copying originals.

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

Customise sidebar layouts, section styles, icons and Home tiles. Branding controls change the app name, logo and logo size, with an optional branded Windows desktop shortcut. Branding is included in backups and supports Undo/Redo. Windows may require re-pinning a shortcut to refresh a cached taskbar icon; installer and executable metadata remain unchanged. Collapse sections, reorder folders and add your own General shortcuts. Appearance changes, including per-section colours from Customise or right-click, and organisation actions support Undo/Redo; settings undo lasts for the current session.

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

[Development notes](docs/DEVELOPMENT.md) · [Performance](docs/PERFORMANCE.md) · [Diagnostics coverage](docs/DIAGNOSTICS-AUDIT.md) · [MIT licence](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
