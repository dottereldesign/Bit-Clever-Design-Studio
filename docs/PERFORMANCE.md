# Repeatable performance diagnostics

Diagnostics are opt-in and stop when the command finishes. They do not install a background service, copy the library, or attach to the user's browser. Reports stay under ignored `.tools/performance/` and must not be committed.

## Browser workload

Run `npm run diagnose:performance`. It starts an isolated headless Chrome and temporary Vite server, uses 1,200 synthetic thumbnails with varied proportions, scrolls, and repeatedly opens/closes the side preview. It checks for overlapping cards and records React commits/render time, ResizeObserver creation/callbacks, layout reads, thumbnail requests, peak mounted cards and browser long tasks. The server and temporary browser profile are cleaned up afterward. Avoid running other browser tests on port 1422 at the same time.

To keep named comparisons in PowerShell:

```powershell
$env:DESIGN_PERF_LABEL = 'before'
npm run diagnose:performance
$env:DESIGN_PERF_LABEL = 'after'
npm run diagnose:performance
Remove-Item Env:DESIGN_PERF_LABEL
```

Use the same machine, viewport, dataset, development mode and workload for comparison. Render and long-task timings vary with machine load. Native disk IO, real image decoding, network downloads and the user's library are not represented by this synthetic workload.

## Running desktop app

While using Design Dev, run `npm run diagnose:processes`. It samples the desktop app and its WebView descendants for 30 seconds. For a longer capture: `npm run diagnose:processes -- -Seconds 120` (maximum 300). Try the slow interaction during the capture. Reports include CPU percentage normalized across all logical processors and per-process working-set memory. They contain no filenames from the library, window titles, command lines or image data.

An idle sample cannot rule out delays during interaction. The debug build can also differ from an optimized standalone build. Capture the same interaction before and after a change; do not rebuild the standalone app solely to investigate a cosmetic tweak.

## November 2026 investigation

The original masonry virtualizer multiplied overscan by the number of lanes after our code had already scaled it by columns. It also recreated observers and repeatedly read the bounds of all mounted tiles. Static image hover updated app-wide state unnecessarily.

The media grid now calculates non-overlapping positions from cached image proportions, batches image-size updates once per animation frame, and mounts only thumbnails near the visible viewport. Resizing recalculates positions without remounting the grid. Still-image hover uses CSS; motion previews retain hover state. Image dimensions are cached in memory with a bounded entry count, without storing user paths or image bytes. All media categories and project galleries use this layout; thumbnail link boards use responsive CSS columns.

Observed synthetic workload results (not a universal speed guarantee):

| Measurement | Before | After |
| --- | ---: | ---: |
| Peak mounted cards | 228 | 56 |
| Bounding-rectangle reads | 13,777 | 225 |
| ResizeObservers created | 109 | 4 |
| React render time | 7,067 ms | 1,890 ms |
| Thumbnail requests | 228 | 117 |
| Long-task time | 11,304 ms | 1,656 ms |

Overlap checks, viewer return/focus, side-preview breakpoints, link-board interactions and drag operations should accompany future gallery changes. `npm run test:grid`, `npm run test:preview`, `npm run test:boards` and `npm run test:drag` cover those workflows. Run checks using port 1421 sequentially; the side-preview check uses port 1422.
