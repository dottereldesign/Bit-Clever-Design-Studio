# Diagnostics coverage audit — 13 November 2026

## Findings and changes

The previous system recorded outcomes and aggregate durations well, but often discarded the evidence needed to explain them. A long task had no code attribution; an uncaught error retained only `javascript`; native work could appear as one opaque command; interruption markers did not identify the previous session.

The shared frontend recorder now includes a frontend session, interaction context, active/recent operation IDs and visibility. Native command errors include a bounded app-code call stack, error class, category and fingerprint. Global JavaScript errors, promise rejections, failed resources, local workflow failures and React render failures use the same recorder. A render boundary offers recovery instead of leaving a blank view.

Slow input events (queue delay, handler and rendering time), slow renders, event-loop delays, long tasks and Chromium long-animation-frame script/layout evidence are recorded. Browser capability events explicitly say whether frame attribution is available. Hot reloads are recorded so development activity can be separated from ordinary usage. Pending operations receive a warning after 30 seconds; that is not an automatic failure or cancellation.

Native operations share frontend command IDs where available. Library loading separates worker wait from database loading. Storage separates catalogue, app data, media and application files. Scanning separates lock wait, file scanning and organisation. Media separates queue wait and generation. Clipboard failures identify the read phase. Existing database mutation/lock/organisation timings remain. Native phase errors retain source location, category and fingerprint; panic markers include the build and Rust source location. Unclean restarts identify the preceding session.

## Coverage by area

| Area | Evidence available | Boundaries |
| --- | --- | --- |
| Marketing | Navigation, interactions, campaign/content/meeting edits, autosave/retry, native outcomes, local workflow failures, slow render/frame context | Calendar service internals are not visible; sync errors identify the app callsite and phase. |
| Leads | Lead/contact/activity changes, stage and handover commands, workflow errors, undo/redo, onboarding, render/frame context | Same-interaction context is not proof that a particular click caused every background event. |
| Projects | File/folder commands, overview/client saves, memberships, preview commands, local client-record failures, navigation and render context | External document applications and Explorer are outside this process. |
| General | Link/website/resource operations, capture progress phases, import queue, command errors and source callsites | Browser capture and downloader internals retain their existing progress signals; no continuous external-browser tracing. |
| Design Inspo / App Components | Filtering/index/layout timing, thumbnail visibility/cache signals, media queue/generation, imports, clipboard, memberships and organisation phases | GPU/driver-level stalls are outside JavaScript attribution. Resource load failures identify resource type, not its private URL. |
| Research | Record/attachment commands, source callsites, workflow failures, navigation, shared form history and frame context | Custom analysis content is not logged. |
| Home / Customise | Shared settings history, persistence outcomes, cover failures, interactions and render/frame context | Pointer moves are not individually logged; a drag is represented by its saved gesture/change. |
| Storage / backup | Command outcomes and IDs, export/import progress when supplied by the existing channel, storage phases, database/native errors | These logs do not independently certify an external-drive copy; backup verification remains required. |
| Diagnostics itself | Queue drops, transport retries, failed writes, unreadable files, capacity/retention, capability and lifecycle events | A hard process kill can lose buffered events. No logger in the killed process can report afterward. |

## Investigating an incident

In Settings → Diagnostics → Activity, expand an event and choose **Inspect incident**. The view/copy contains the selected event, the same operation, the same interaction context, and nearby events within five seconds (bounded to 120 events). **Show operation** isolates exact command-ID matches, including native phases. Native background jobs have their own IDs.

Use source locations and the build/session IDs to inspect code; use error fingerprints to group repeat failures without storing their messages. Frame script offsets are character offsets, not line numbers; `0:0` means the browser did not supply a line/column. Inspect the actual phase failure before drawing conclusions from adjacent events. The 30-second interaction window is contextual, not an async parent-child trace.

## Data and overhead

Everything stays in the existing local, seven-day / 100 MB diagnostics store. No paid service. No typed text, clipboard contents, client names, notes, private URLs, file paths, credentials or raw exception messages are intentionally captured. Code evidence retains only app source/asset basenames with numeric locations. The native writer independently validates these frames and operation-ID lists. Production minified assets remain minified; source maps are not generated or published by this change.

Hot-path calls still sample fast successes outside detailed mode; errors and slow calls retain evidence. Per-event history is bounded, frame observers are capability-gated, observer/timer listeners are removed on disposal, and expensive stack formatting is deferred for hot-path calls. React Profiler timings are available in development; an ordinary production React build may omit profiling callbacks. Bounded event history and timestamps cannot guarantee an exact root cause for every failure.

## Remaining explicit limits

- No OS dump collection, GPU profiling, external process tracing or complete native stack unwinding.
- React timing identifies expensive commits, while Chromium may identify scripts; neither is a full sampling CPU profile.
- File pickers, save dialogs and Explorer reveal requests now have traced outcomes, including cancellation. Their selected paths are excluded. OS behaviour after a successful launch remains outside the app.
- Invalid preferences encountered by the backup collector now generate a bounded warning per key. Other legacy local parsing fallbacks are not all individual events and can need targeted investigation.
- Buffered logs can be lost on power failure or forced termination. Interruption records are evidence of an unclean exit, not proof of a crash.
- Context improves future incidents; it cannot reconstruct evidence discarded by older versions.

Run `npm run audit:diagnostics` to catch direct core-command bypasses. Tests cover redaction, code locations, timeline bounds, native phase/error sanitisation, large histories, observer disposal and incident inspection. This is an instrumentation audit, not a claim that every feature has been manually exercised against the private production library.

## Clients

Client workspace navigation uses the shared route context; client/client_entry IDs are opaque in diagnostics. Saves and imports go through the shared traced command and import queue. Client feed reads, meeting pack exports, avatar failures and local action errors are traced. The lasting relationship feed is separate from diagnostics and is backed up with the library.
