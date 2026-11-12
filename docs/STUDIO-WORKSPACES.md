# Leads and Marketing

Both workspaces are local to the current library. They use the app's SQLite database, import queue, Undo/Redo, project preview and moodboard components. No account, subscription, telemetry upload, email sending or ad publishing is required.

## Navigation

Marketing and Leads appear above General. Their parent buttons open the workspace; the adjacent chevron collapses or expands its shortcuts. New sections start collapsed. All six parents share the selected appearance style and support custom icons.

Leads includes Pipeline, Follow-ups and Contacts. Marketing includes Campaigns, Ideas and Calendar. Record details use full-page tabs. The last workspace and record reopen with the app. Table/board choices are saved appearance preferences; search, tags, sorting and archived filters are remembered per library and list.

## Leads

An opportunity has a name, stage, contacts, organisation, service, source, optional value/currency, brief, tags, next actions and attached references. Create it with a name, then edit in place. The pipeline has New, Contacted, Discussing, Proposal sent, Won and Lost stages. Stage names and ordering are editable; drag a card or use its table selector to change stage.

Activity records contain a date, type (note, call, meeting or email), notes and attachments. These are manually recorded interactions, not synchronised mail. Follow-ups lists opportunities with incomplete actions, ordered by their next due date; overdue actions are marked.

Marking Won does not create anything automatically. **Create project** performs one database transaction: create the project, copy the brief and next actions, associate the existing files, link shared contacts, and record the source lead. A same-name project is not silently overwritten: link the existing project or rename the lead. The project Overview links back to associated leads and campaigns. Lost and archived records retain their history.

## Marketing

Campaigns use Idea, Planning, Ready, Active, Complete and Paused statuses, with table and board views. Plan stores the objective, audience, message, offer, channels, dates and optional budget/currency. Campaigns can link to a client organisation and projects.

Content entries hold copy, channel, status, a planned date and file references. Ideas are content entries without a campaign; paste or drop into Ideas, then assign a campaign later. Calendar and campaign Schedule read the same content dates, so dragging to another day updates the content record itself. Campaign start dates also appear in the main calendar.

Campaign moodboards reuse the existing canvas with references, notes and colour swatches. Add files to the campaign before placing their references on its board. Results is a manual notes field plus a list of associated leads; there is no automated analytics, financial attribution or return-on-investment calculation.

## Contacts and existing projects

Contacts and organisations have stable string IDs. A contact can be associated with several opportunities and projects. Name, email, phone and organisation are shared; existing project roles, primary-contact flags, project notes and activity history retain their project context. Contacts with identical names are not automatically merged.

The first migration assigns shared IDs to existing project contacts in a transaction. Before changing existing contact records, it saves a database snapshot at `backups/before-studio-contacts.sqlite` beside the library database. This migration snapshot contains metadata, not a full media backup. The migration is idempotent, and new project contacts join the shared contact directory automatically.

## Files, saves and recovery

- New files and links imported into a lead or campaign remain outside Design Inspo's inbox. Reusing an existing reference preserves its original collection and memberships.
- Paste and drop use the existing queued import path, with progress and captured destinations. Navigating away does not redirect an in-flight import.
- Files use the same preview and external-open restrictions as project files. Detaching a reference does not delete the original.
- Text saves on blur or Enter. Failed text saves retain a local draft and offer Retry. Unsaved drafts are not included in portable backups.
- Record edits, archives, filing and project handover use durable transaction-backed Undo/Redo. Layout preferences use the existing appearance history.
- Full and metadata backups include studio records and relationships. Restore remaps numeric project/file IDs while retaining stable studio/contact IDs. Older backups without studio records leave the current studio records intact.
- Duplicate consolidation repoints studio file and moodboard references to the retained item. Deleting a project detaches its studio associations; Undo restores them.

## Implementation and checks

`src-tauri/src/studio.rs` owns record validation, migrations, contact synchronisation, project handover and history snapshots. `StudioWorkspace.tsx` provides the pages, with virtualised table rows and board columns. `studio_records` indexes record kind; the library snapshot loads its lightweight metadata, while file content remains on disk.

Native tests cover contact migration, same-name separation, shared edits, undo/redo, project handover and deletion, private imports, link reuse, portable backups, metadata merges and remapped IDs. `node scripts/check-grid-return.mjs studio` checks navigation, editing, follow-ups, imports, campaign content/calendar/moodboard, failed-save retry, responsive layouts and session restore against synthetic data. No test requires the user's library.

Future integrations—publishing, mail synchronisation, reminders while the app is closed, shared client portals and automated reporting—are separate work. This version is a single-user planning and record-keeping workspace.
