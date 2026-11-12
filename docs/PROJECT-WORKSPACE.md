# Project workspace

The project parent opens a Files workspace containing its folders and Unfiled. It does not display every item from its descendants. Search or filters at the root search the project; inside a folder they apply to that folder.

## Delivered in the first phase

| Planned capability | Implementation |
| --- | --- |
| Explorer-style project page | Folder cards, nested folders, Unfiled, breadcrumbs, back/forward navigation |
| Adjustable layouts | Details, Tiles and a folder-column layout; optional metadata columns and adjustable name width; tile size uses the header slider |
| File management | Add files, queued paste/drop, drag files between folders, existing folder context menus, tags, link ratings and organisation Undo/Redo |
| Arbitrary attachments | Any extension, including extensionless files; imports copy original bytes into the library |
| Previews | Existing media preview, plain-text document preview capped at 1 MB, browser-supported PDF/audio preview and an explicit default-app action |
| Existing library integration | Shared project memberships remain references to one item; new project-first files stay out of Design Inspo |
| Portable backups | Attachment bytes, project/folder memberships and project view preferences use the existing full-backup system |
| Responsive large folders | Virtualised file rows; metadata loaded once per project/library snapshot rather than every folder click |

Click selects. Double-click or Preview opens a file preview; the external-open button opens its registered application. Links open in the browser. Office documents, design-source files and archives can be stored but require their own applications for viewing/editing. PDF rendering depends on the installed WebView; Open in default app is the fallback. Executables and shortcuts are stored but must be launched explicitly through Explorer.

Opening a file externally opens the library-owned copy. This phase does **not** provide file version history, editing locks or automatic conflict resolution. Keep verified backups before editing originals. Metadata refreshes when the library snapshot reloads; it is not a live external-file editor monitor.

## Later phases from the plan

- Overview: brief, scope, status, deadlines and next actions.
- Client records: contacts, meeting notes, feedback and decisions.
- Moodboards: arrange project references on a freeform canvas.
- Versions and approvals: immutable revisions, comments and approval tied to a specific revision.
- Optional client sharing: separate export/sharing workflow; no cloud service is required by this local workspace.

These are not represented as working features in the current workspace.

## Verification

- `npx tsc --noEmit` and `npm test`.
- `npm run test:native`: attachment bytes, deduplication, project-only imports, bounded text preview, full backup/restore and existing library integrity tests.
- `node scripts/check-grid-return.mjs project-workspace`: isolated 500-file fixture at 1440px and 960px; navigation, virtualisation, layouts, previews, import/paste, ratings and filing Undo.
- `npm run test:export`: storage and portable-backup UI regression checks.

Tests use temporary libraries and synthetic files. Personal library data is not modified. The standalone installer is a separate release checkpoint.
