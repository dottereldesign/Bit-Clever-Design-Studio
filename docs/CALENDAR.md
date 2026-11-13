# Selected project meetings

Studio can display selected Google Calendar meetings in Marketing → Calendar, alongside campaign dates. Meetings open a read-only detail page with their time, location, source-calendar link, meeting link and project shortcut. Dates are displayed in New Zealand time.

## Connection

Open Settings → Google Calendar, or Calendar → Calendar connection. In Google Calendar settings, select the source calendar, then Integrate calendar → Secret address in iCal format. Paste the address directly into Studio and connect. Do not put this credential in a chat, repository or shared document. Google's [calendar sync instructions](https://support.google.com/calendar/answer/37648) explain where to find it.

The connection is read-only and free. It checks on app startup, every 15 minutes while Studio is open, after returning online, and when Sync now is clicked. Google feed publication can lag behind edits. Studio does not send mail, modify invitations or write events back to Google. There is no background service when the app is closed.

## Scope and storage

Only the explicitly selected meeting identities are stored. Other feed events are parsed in memory and discarded. New events with similar subjects or attendees are not automatically added. The current selection is prepared in the user's private app-data `calendar-settings.json`, bound to a library. Meeting records are kept in that library's database and included in its existing backups; project IDs are remapped on restore.

The private feed address is encrypted using Windows DPAPI for the current Windows user and stored separately as `calendar-feed.protected`. It is excluded from library backups and diagnostic payloads. Restored libraries retain meeting details but need their calendar connection re-established. Disconnect stops syncing and removes the credential while retaining saved meetings.

Stable source identities prevent duplicate imports when a date changes. After the first successful match, the source UID is retained. Cancelled or removed selected events are hidden from the calendar. If the entire selected set disappears, Studio reports a source-calendar mismatch and keeps its last snapshot for review. An unrecognised initial meeting, missing timezone definition, ambiguous match, recurrence, invalid feed or network failure produces a visible error and leaves the prior snapshot intact. This version supports individual dated meetings, not recurring series.

## Verification

`npm test` covers selection, UTC/NZ conversion including seasonal offsets, cancellation, rescheduling and rejected ambiguity/recurrence. Native tests cover credential protection, URL restrictions, idempotent initial import, transaction validation, stale-connection rejection and backup ID remapping. `node scripts/check-grid-return.mjs calendar-sync` checks connection, retry, disconnect and read-only meeting UI using synthetic data. Tests do not fetch a real private feed.
