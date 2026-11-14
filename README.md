<p align="center">
  <img src="docs/images/readme-logo.svg" width="104" alt="Bit Clever Studio mascot logo">
</p>

<h1 align="center">Bit Clever Studio</h1>
<p align="center">A customisable local workspace for leads, clients, projects and the business behind them.</p>
<p align="center">
  <a href="https://github.com/dottereldesign/Bit-Clever-Studio/releases/latest">Download for Windows</a> ·
  <a href="#your-library--backups">Storage & backups</a> ·
  <a href="#development">Development</a>
</p>

![Design library with a masonry gallery and separate Design Inspo and App Components folders](docs/images/library.jpg)

## From first enquiry to finished work

Bit Clever Studio brings your sales pipeline, client relationships, project delivery and creative library into one Windows workspace. Track the next follow-up, turn a won opportunity into a project, prepare meetings and review what is bringing in work. **My Business** keeps your own setup tasks, subscriptions and planned costs separate from client records.

Start with the sidebar: each section opens the tools for that part of your work. Home brings upcoming events, active projects, won value and the reports you choose into a personal dashboard. Customise controls the whole app’s appearance, from branding and typography to buttons, tabs and navigation.

## Your sidebar is the workspace

**Version 0.4.0 (development).** The sidebar is the app's main navigation. Open a section for its tools, drag sections into your preferred order, or drag supported destinations and Analytics reports onto Home. The app starts on Home with sidebar sections collapsed.

| Section | What it helps you solve |
| --- | --- |
| **Home** | See upcoming meetings, active projects and won business value together; keep shortcuts and live reports close at hand. |
| **Marketing** | Keep campaign plans, content, ideas and manually recorded results together instead of scattered notes. |
| **Leads** | See your open pipeline, keep contacts and follow-ups organised, and close opportunities through a short Won/Lost flow. A win can confirm contact details, link an organisation and create a project with its first meeting and deadline. |
| **Organisations** | Keep the relationship after a sale: meeting preparation, tasks, contacts, files, pricing and an activity history in one profile. |
| **My Business** | Plan your own business setup, domains, tax reminders, hosting, subscriptions and purchases. Separate planned costs from active commitments and see upcoming renewals. Private device records stay separate from client libraries and GitHub. |
| **Projects** | Turn agreed work into a brief, deadlines, next actions, organised files, client records and moodboards. |
| **General** | Find reusable links, resources, fonts and brand guidelines without searching old browser tabs. |
| **Design Inspo** | Collect and organise visual references in shared folders without duplicating originals. |
| **App Components** | Build a reusable reference library of interfaces, components and page patterns. |
| **Code** | A reserved workspace for future development tools. Clearly marked Coming soon. |
| **Analytics** | Review won value, open pipeline, lead sources, project workload, organisations, campaign contribution and items needing attention. Reports use your recorded data; won value is not cash received, and campaign contribution is not ROI. |
| **Research** | Keep competitor research, pricing, sources, findings and learning materials connected to your work. |

The small toolbar below the logo keeps common actions within reach: **Collapse all** tidies navigation, **Search** finds work across sections, **Quick add** creates a Lead, Contact, Organisation or Project, and **Recent** returns to recently opened records.

**Customise** controls how the workspace looks. **Settings** handles the library, backups, connections, help and diagnostics. These remain in the sidebar, rather than repeated in page headers. New features are available in Design Dev; published installers may lag behind this source version.

## Client relationships

Open **Organisations → Dashboard** for upcoming meetings, due tasks, waiting items and the combined activity feed. Each profile has Feed, Meetings, Tasks, Files and Pricing tabs, a cropped display picture and links to existing projects. Lead contacts link to these same organisations. Add an organisation from the sidebar or the contact form. Shared project tasks and contacts stay in their original records.

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

Drag sidebar destinations onto **Home** to create shortcuts. Resize and rearrange tiles, drop in cover images and adjust labels, overlays and spacing. Clicking the logo returns Home; reopening the app starts on Home with all sidebar sections collapsed.

![Customisation panel with sidebar appearance choices](docs/images/customise.jpg)

Open **Customise → Branding** for app-wide colour themes and typography. There are 29 Codex-inspired theme families with 44 light/dark variants, including Dracula, Ayu, Catppuccin, Raycast and VS Code Plus. Your existing look stays the **Studio default**, and a local snapshot lets you restore it. Choose one font throughout or separate heading and body fonts; installed-font fallbacks work offline.

Theme colours cover app surfaces, controls, dialogs and navigation. Explicit colours in Buttons, Tabs, Sidebar, Home and Analytics take priority; each has **Use app theme default**. Themes do not recolour your images, logos or saved artwork. Text and accent colours are adjusted for contrast.

- **Buttons** — 100 CTA styles, two colours, tint intensity down to zero and hover motion. Add actions share the same styling.
- **Tabs** — 20 styles, colour choices including monochrome, accessible selection cues and optional animation.
- **Layouts, Sidebar and Icons** — compact named layouts, 30 shared section styles, colours, width and custom icons across all 11 sections, including My Business, Analytics and Code. Working accordions share opening/closing transitions and hover treatments; Code keeps the chosen treatment with a muted Coming soon badge. Motion settings support reduced animation.
- **Home and Analytics** — choose summaries, chart styles, reporting periods, visible charts, tile labels, spacing and overlays.
- **Library, General, Websites and Motion** — selection treatments, shortcuts, website preview behaviour and reduced motion.

Customise tabs can be reordered by dragging or with Alt+Left/Right. Appearance changes support session Undo/Redo and travel with appearance backups. Branding changes the displayed app name, slogan, logo and size (54px on reset), with an optional branded Windows shortcut. Executable and installer names stay unchanged.

Settings uses a searchable directory with top tabs or a side menu. **Connections** identifies Google Calendar with its logo and supports read-only sync of selected meetings. **Diagnostics** records local feature usage, timing and failures across the new workspaces without form contents, private calendar addresses or automatic uploads. [Theme behaviour and maintenance](docs/APP-THEMES.md).

*Screenshots show the app with the owner’s design library. Reference artwork belongs to its respective creators and is not bundled with the app.*

## Get started

**Windows 10/11 · 64-bit.** The installer includes media tools and installs WebView2 if needed.

1. Download **Design-Setup.exe** from the [latest release](https://github.com/dottereldesign/Bit-Clever-Studio/releases/latest) and install it.
2. Launch Bit Clever Studio. Open **Settings → Library** to create or open a self-contained library.
3. Start where your work is: add a lead, create a project, plan your own business setup, or collect references in Design Inspo and App Components. Use Customise to make the workspace yours.

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

**My Business is separate:** its desktop database and browser storage are not included in library or appearance exports. Keep a private device backup; see [My Business storage](docs/MY-BUSINESS.md).

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

See Settings → Help for the full shortcut list. Single-key shortcuts apply outside text fields.

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
