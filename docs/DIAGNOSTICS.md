# Local diagnostics

Settings → Diagnostics shows activity, problems, performance and usage for the last seven days. Everything runs locally with existing open-source dependencies. There is no account, subscription, analytics endpoint or automatic upload.

Use **Mark a problem** immediately after an issue. **Export diagnostics** produces a JSON support file; **Open logs folder** reveals the local Diagnostics directory. Detailed recording includes normally suppressed fast thumbnail/chunk/storage calls for 15 minutes, and ends on restart.

## Storage and safety

Daily SQLite event files live in the application's local data directory, separate from the managed library and its backups. The numeric filename is the UTC day since the Unix epoch; event timestamps are UTC milliseconds and the UI displays local times. Files rotate automatically. The target retention is seven days with a 100 MB total cap; heavy activity may shorten it. The current daily file stops accepting events at the cap. Batches can overshoot the cap slightly. Write failures and dropped events are surfaced. A crash marker contains timing and a session identifier, not crash memory or exception contents.

The writer uses a bounded background queue. UI events are batched; a forced termination can lose the last buffered events. An unfinished session means unexpected termination, not proof of a crash. Diagnostic records are not a transaction journal or a replacement for backups.

The native writer accepts an allowlist of metadata. No media, clipboard contents, credentials, raw URLs, arbitrary exception text, absolute source paths or command argument dumps are recorded. Error classifications are deliberately coarse; an unknown error may require reproducing it. Project/folder/item IDs permit local correlation without exporting personal names. Problem bookmarks do not capture screen contents.

## Coverage

The shared invoke wrapper records native command start/outcome/duration and operation IDs. Progress channels record phase transitions (including capture attention/cookie pauses), not every progress tick. Database updates expose lock wait, database change and managed-file organisation under the same operation ID. Other commands currently measure their overall native round trip. Queued imports record waiting and overall workflow time; commands within that workflow have their own operation IDs. Sidebar navigation timing starts in click capture, before React renders, and ends after two animation frames; other state-driven navigation starts when its effect runs. Neither proves that all images loaded. Hot reload disposes the previous error and performance observers. Cache counts are aggregated every ten seconds. Settings saves, JavaScript errors/rejections, slow tasks, native panic markers and interrupted sessions are included. Purely visual gestures without a persisted change are not individually recorded.

## Reading and interpreting

The UI analyses the newest 20,000 retained events and explicitly reports truncation. Export includes up to one million events (the storage size cap normally binds first), with `total` for comparison. Group counts are operation counts, not unique human actions; phase durations are elapsed time since operation start. Usage is evidence to discuss, not an automatic feature recommendation. Filtering an operation ID links its frontend and native records. `started` without a terminal outcome can mean interruption, recent buffered writes or dropped diagnostics.

No telemetry is uploaded. Keep exports private. Logs may still reveal the timing and structure of work even without names. Runtime failed-write counters reset on app restart. Older app builds do not produce these records, and the standalone installer must be updated separately from Design Dev.
