# Leads, Marketing and diagnostics audit

Reviewed against the approved six-section plan on 13 November 2026. This is a source and synthetic-test audit, not an analysis of the user's private records or a claim that every interaction has been exercised.

## Follow-up implementation

The priority fixes below are now implemented:

- Explicit handover to a new or existing project, preserving existing project details. Unfinished actions move to the project; completed actions remain on the lead. A separate Link only control does not transfer work. One Undo reverses the handover.
- Edits carry their original field values. The backend merges independent set and item changes against the latest record, including actions, attachments and moodboard nodes. Conflicting edits to the same field or an edited item being removed fail visibly instead of overwriting newer work.
- Studio, client-record and overview edits skip managed-file organisation. Changes affecting collection memberships and handovers keep the existing organisation path. Diagnostics records the skipped phase.
- Related-record navigation remembers the originating route/tab; list and content scroll positions are retained for the browser session. Contacts can be created and assigned inline.
- Follow-ups groups Overdue, Today, Upcoming, No date and Closed leads. Handed-over actions no longer appear as lead follow-ups. Archived campaigns and their content are hidden from calendars until restored; the children's individual archive flags remain unchanged.
- Campaign milestones, start/end dates and content share the calendar. Dragging changes their actual stored date. Completed milestones leave the calendar but remain in Schedule.
- Creative variants can share a named group within campaign Content. Results supports optional named manual metrics alongside notes. Lead lists show the last recorded activity date, and bulk actions include stage changes and adding tags.

Handover rules apply to new handovers; historical copies are not silently reconciled. A lead may still have later sales follow-ups added deliberately. Source actions and project actions are not continuously synchronised. Full studio metadata snapshots remain unchanged; lazy loading is a future optimisation requiring measurement, not a correctness gap. Bulk edits are individual undoable records, not one combined transaction.

Validation includes native concurrent-edit, conflict, handover/Undo and backup-remapping tests, plus synthetic browser checks for inline contacts, return navigation, scroll restoration, milestone dragging, variant groups and manual metrics. These tests do not modify the live library.

## Original audit findings (before the follow-up)

## Plan comparison

| Area | Implemented | Remaining |
| --- | --- | --- |
| Navigation | Six parents, shared appearance, full pages, remembered routes and layouts | Returning from a contact or related record can lose the original list context; list scroll is not restored |
| Leads | Editable pipeline, table/board, contacts, organisations, value, source, actions, activity and attachments | Follow-ups needs explicit overdue/today/upcoming groups; completed opportunities can still appear with unfinished actions |
| Handover | Won is explicit; creating a project atomically carries brief, contacts, actions and references | Linking an existing project only associates it; it does not perform the same handover |
| Marketing | Campaign plan, content, moodboard, schedule, manual results; independent ideas inbox | Dedicated campaign milestones are missing; creative variants are separate content records without grouping |
| Calendar | Content dates are shared with Schedule; dragging updates the same record | Campaign end dates and milestones need clearer representation |
| Shared records | Stable contacts, project-specific roles, linked campaigns/leads/projects, reused media | Adding a contact from a lead requires leaving that lead and returning |
| Editing | Search, tags, sorting, autosave with retry, archive/restore, Undo/Redo | Bulk actions currently cover archive/restore, not stage or tag changes |
| Storage | Local SQLite, migration snapshot, portable records/relationships, restored ID mapping | Unsaved drafts are local recovery data, not portable backup content |
| Performance | Virtualised rows/boards, indexed record kind | The library snapshot still loads all studio metadata; these are not lazy indexed page queries |

Results notes satisfy the plan's optional manual results scope. Structured metrics, a last-interaction summary and a value column in the lead list would be useful improvements, not missing commitments. Mail, ad publishing, automated analytics, cloud collaboration and reminders while closed remain intentionally outside this version.

## Recommended flow fixes, in order

1. **Make handover unambiguous.** Distinguish linking from transferring context to an existing project. Creating a project copies next actions; the lead retains independent copies, so completing one does not complete the other. Define ownership at handover before adding more automation.
2. **Protect rapid edits.** Several controls submit complete action, file or association arrays. Queuing commands does not itself prevent two edits built from an old snapshot from replacing each other. Add item-level operations and concurrent-edit regression tests.
3. **Avoid unrelated file work.** Every generic database update currently runs managed-file organisation, including CRM text edits. Use the new action-specific timings to measure this, then restrict organisation to changes that can affect paths or memberships.
4. **Preserve navigation context.** Return from related contacts/activities to the originating record, tab, filters and scroll position. Offer inline contact creation.
5. **Clarify follow-ups and archiving.** Group dates, distinguish closed leads with outstanding actions, and define whether content of an archived campaign remains in the calendar. Today children are independent records; archiving a campaign does not archive its content.
6. **Complete planning polish.** Add campaign milestones, then optional structured results, last interaction and broader bulk editing.

The initial diagnostics audit did not implement these product changes. The follow-up status above records what has now been delivered.

## Diagnostics changes delivered

| Section | Evidence now available |
| --- | --- |
| Marketing | Page/tab, hashed record ID, campaign/content type, changed field names, command outcome and duration; list mode/count/filter presence; save and retry outcomes |
| Leads | Same detail for opportunities, contacts, organisations and activity; handover is identified separately |
| Projects | Section/tab navigation, overview field names, client record type and hashed ID, client record navigation; existing import/file/moodboard commands |
| General | Section context with existing page/navigation, link/resource/website capture commands and progress phases |
| Design Inspo | Section context, existing memberships/imports, folder filtering/layout and visible-thumbnail readiness timings |
| App Components | Same collection coverage as Design Inspo, distinguished by section |
| Home and customisation | Persisted preference change counts, completed gestures and explicit Undo/Redo outcomes |
| Background work | Schema initialisation, library scan and fingerprint indexing outcomes/durations; database phases retain the change action |

Diagnostics can filter by section. Performance and usage distinguish update action, record type and changed fields rather than combining every edit as `update`. Failed frontend log batches retry up to three times, transport failures are visible, and buffered metadata is copied so a later result cannot change an earlier start event.

## Limits and interpretation

- This is useful workflow logging, not a recording of every mouse movement, keystroke or private document. Record names, email addresses, notes, search terms, clipboard contents and files are excluded. Field *names* such as `email` are safe metadata; their values are not logged.
- Fast thumbnail/chunk/storage operations remain sampled unless detailed recording is enabled. Purely visual gestures, cached preview interactions and every individual local-state transition are not exhaustively logged.
- Background native events need not belong to the visible section. Clear the section filter when investigating scans or startup. Command operation IDs join frontend edits to native database phases; import queue events still use separate operation IDs.
- Seven-day retention is bounded by 100 MB. The viewer analyses the newest 20,000 events. Forced shutdown, queue limits and permanent write failures can lose logs; diagnostics is not an audit-grade transaction journal.
- A normal command outcome proves that command returned, not that a backup can be restored on every machine or that the user saw every thumbnail. Existing synthetic restore tests exercise linked records and remapped IDs without modifying the live library.

See [Diagnostics](DIAGNOSTICS.md) for support/export instructions and [Leads and Marketing](STUDIO-WORKSPACES.md) for current behaviour.
