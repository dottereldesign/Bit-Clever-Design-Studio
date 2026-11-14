# Project workspace

The project parent opens Overview. A persistent navigation row switches between Overview, Files, Moodboard and Client records. Sidebar subfolders open Files directly. Files remembers the last folder, layout and scroll position; Back/Forward (also Alt+Left/Right) traverse project sections and folders. Reopening the app restores the saved section. File controls appear only in Files.

Files contains folders and Unfiled rather than an aggregate gallery. Search or filters at its root search the project; inside a folder they apply to that folder.

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

## Project overview

The project parent shows Overview as its own section. It includes a brief, status (Planned, In progress, Waiting on client, On hold or Complete), project deadline, and next actions with optional individual due dates. Completed actions can be shown or hidden. Past due dates are marked Overdue; a completed project is not marked overdue.

Text and dates save when focus leaves the field; status and action completion save immediately. Failed text saves retain the draft and offer Retry. Organisation Undo/Redo includes these edits. Overview data belongs to the project in SQLite and travels with both portable and metadata backups. Restoring a backup maps it to the correct project; older backups without overview data leave existing overviews intact.

## Client records

Client records provides project-specific contacts and a searchable list/details editor for meetings, feedback and decisions. Narrow layouts show the editor with a Back to records action. The selected record and filters are remembered per project; long lists render only visible rows.

- Contacts: name, role, company, email, phone, notes and one primary contact.
- Meetings: title, date, attendees and notes.
- Feedback: source contacts, details and Open/Resolved status.
- Decisions: reasoning, people involved and Proposed/Agreed/Superseded status. Agreed is a manually recorded decision, not a formal client approval.
- Records can reference existing project files and other records without copying media.
- Create next action links one Overview action to its source record. Repeating it does not duplicate the action; completion is shared through the existing overview.

Fields save on blur or Enter; save failures retain the draft and offer Retry. Unfinished client fields also persist locally across record/project switches and app restarts. They show Unsaved until successfully committed; **only saved records belong to portable backups**. Archiving hides records/contacts from normal lists but preserves their historical context in SQLite and backups; Undo restores them; the Archived filter and archived contacts list also provide Restore.

Contacts, records and source-action links are covered by project organisation Undo/Redo, project deletion recovery, metadata export and portable backup. Restore remaps project/file IDs; contact/record IDs remain stable within a project. Older backups without client records do not clear existing records. Diagnostics retain operation names/timings/errors, not note bodies or contact details.

## Moodboard

The project Moodboard is a freeform 2000 × 1400 canvas for project references, notes and colour swatches. Add reference searches existing project files and links; references reuse the original media. Drag elements to arrange them, resize from the corner, or use arrow keys (Shift for larger steps). Zoom enlarges the workspace; Fit board returns to its full-width view. Double-click references to preview them.

Edits save to the project database; notes save when focus leaves the field. Failed saves stay visible with Retry. Removing an element only removes it from the board. Organisation Undo/Redo restores board edits and removals. Portable and metadata backups include the layout, notes and colours, and restore remaps referenced file IDs. Each board supports up to 300 elements. This is a single board per project, without collaborative editing or version snapshots.

## Later phases from the plan

- Versions and approvals: immutable revisions, comments and approval tied to a specific revision.
- Optional client sharing: separate export/sharing workflow; no cloud service is required by this local workspace.

These are not represented as working features in the current workspace.

## Verification

- `npx tsc --noEmit` and `npm test`.
- `npm run test:native`: attachment bytes, deduplication, project-only imports, bounded text preview, full backup/restore and existing library integrity tests.
- `node scripts/check-grid-return.mjs project-workspace`: isolated 500-file fixture at 1440px and 960px; navigation, virtualisation, layouts, previews, import/paste, ratings and filing Undo.
- `node scripts/check-grid-return.mjs moodboard`: pointer move/resize, notes, source-safe removal, Undo and reopen.
- `npm run test:export`: storage and portable-backup UI regression checks.

Tests use temporary libraries and synthetic files. Personal library data is not modified. The standalone installer is a separate release checkpoint.
