# Clients

Clients is a local relationship workspace between Leads and Projects. The section uses the same colour, icon, collapse and reorder controls as the other sections.

## Workflow

- Dashboard: client profiles, upcoming meetings, due/overdue tasks, waiting tasks/records, activity filters and an optional startup preference.
- Sidebar: drag client names to reorder them beneath the fixed Dashboard link. Escape cancels a drag; Alt + Up/Down reorders a focused client. Order is saved per library with undo/redo and appearance backups.
- Profiles: name, status, picture upload/paste/drop with crop controls, general contact details, pinned notes and project associations.
- Feed: saved notes, pasted email exchanges, decisions and durable automatic changes. Project records remain linked to their project editors.
- Meetings: local date/time, attendees, meeting link, location, agenda, ordered agenda items, preparation checklist, notes, attachments and a follow-up action. Synced calendar meetings are read-only. Local meetings do not send invitations.
- Tasks: client tasks alongside shared project tasks. Completion, priority and waiting status edit the same source record; client tasks also have editable dates.
- Files: a list of explicitly added client files and attachments on its active records. Linked project files are not automatically included; Link from library deliberately adds a chosen reference. Removing an attachment removes its reference, not the underlying file.
- Pricing: proposed/agreed/paid status, amount, currency, tax notes, deposit/payment schedule, payments received, scope and attached documents. This is manual tracking, not accounting or payment processing.

AANZPA and Hoea tō Waka are seeded once when Clients is first opened, with exact normalised matching project names. Unknown dates, amounts and email history are not invented. A won lead reuses a matching client or creates a profile and links its handover project in the same undoable transaction.

## Data and history

Profiles and client entries use stable IDs in `studio_records`. Project contacts, project notes, tasks and files are referenced rather than copied. Small cropped PNG profile pictures are stored inside the profile metadata, so backups cannot omit a separate picture file.

`client_events` is separate from seven-day diagnostics. SQL triggers record committed studio records, project overviews, project contacts/notes, project file memberships and library file rename/archive/missing changes for linked clients. Failed transactions roll back their events. Undo/redo produces a new history event. Existing historical records are displayed in place; the app does not fabricate a historical change log.

Feeds load 100 events at a time. Each event retains its client IDs, before/after values and record or project destination. Events are included in both metadata and portable backups; import deduplicates stable event keys and remaps project destinations. The portable export reads events from the same SQLite snapshot as the library. Restoring metadata does not generate duplicate edit events.

## Meeting packs

Export creates a new folder without overwriting another pack. It contains escaped, printable `Meeting.html` and copies of selected original attachments. Open the document in a browser and Print → Save as PDF. Links remain text and require internet access. An incomplete marker remains if an attachment cannot be copied.

## Boundaries

This is a private workspace, not a client portal. Gmail sync, sending emails/invitations, payment collection and accounting integrations are not included. Original sender/date/thread links can be entered for pasted email records; importing an `.eml` preserves the file without parsing all of its attachments automatically.

The feed records database changes, not every view or keystroke. Related changes from one library edit are grouped into an expandable batch. Meeting PDF generation uses the browser print step rather than a bundled PDF service.

## Navigation performance

Opening Clients checks setup once per loaded library. An existing setup does not mutate records, reorganise files or reload the library. Successful activity requests are cached against the current library snapshot; edits invalidate that snapshot, and Refresh explicitly bypasses the cache. Collapsed batches and change details render their contents only when expanded.

`node scripts/check-grid-return.mjs clients-performance` exercises eight visits with 4,000 synthetic references and 100 activity events, checks query counts, manual refresh and cancelled navigation measurements. A local 1440×940 comparison against commit `9f77c43` reduced library reads from 9 to 1 and feed reads from 16 to 1. Median click-to-two-frames time fell from 346 ms to 164 ms in that fixture. These are synthetic frontend measurements, not a guarantee for a live library or network drive.

Native scan regression coverage checks 1,200 files across three roots: unchanged items are not rewritten, and missing/restored files remain detected. Calendar startup takes the content lock and requests a library refresh only when it needs to initialise missing meeting records.
