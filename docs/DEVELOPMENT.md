# Bit Clever Design Studio development notes

A local Windows inspiration library. Tauri 2, React, TypeScript, Rust and SQLite. No account or hosted services.

## Run

Open `app/Design.exe` for the standalone app. The `Open Design` shortcut in this folder launches it directly.

For daily development, open **Design Dev** from the Windows desktop and leave its terminal and app open. CSS and frontend edits hot reload in that window. The ordinary **Design** shortcut continues to open the last standalone build.

On a fresh checkout, install dependencies once and start development from a normal Windows terminal:

```powershell
npm ci
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1
```

The launcher uses the existing `npm run desktop` workflow and prepares missing media tools automatically. Its `-Check` option validates prerequisites without starting the app. First startup can compile Rust for several minutes; later frontend edits do not require a native rebuild. Closing the development terminal ends live development.

Launch from your normal Windows session and confirm the expected projects and library on first use. Codex's redirected app-data environment can show a different library; the launcher rejects that known environment and test-data overrides. The app automatically finds this checkout's `Design` folder when no library root has been configured. Choose a different folder in Settings. After the first scan, startup uses the saved SQLite index and rescans in the background. New and changed files are detected automatically.

Refresh the standalone app only at an explicit checkpoint:

```powershell
npm run package -- --no-bundle
```

Packaging writes a standalone copy to `app/Design.exe`; reopen it from the ordinary shortcut. Use `npm run package` without `--no-bundle` only when an installer is explicitly needed. The build directory is recorded in `.tools/build-path.json`; it contains the portable Microsoft compiler, Windows SDK and native build cache. This also handles Codex's Windows package path redirection. The launch script sets the compiler environment for the build process only, and build artifacts stay outside OneDrive. An installed Visual Studio C++ toolchain is also supported. FFmpeg is downloaded by the free `ffmpeg-static` package and copied into the app bundle by `prepare:media`. React, Tauri, SQLite, Rust image processing, TanStack Virtual and FFmpeg are open-source dependencies; FFmpeg's bundled distribution includes GPL components. Keep its upstream license notices if redistributing the app.

## Browse and preview references

The app reopens your last page, filters, sort order and scroll position, including an open image viewer. Home is the first-launch default and remains a sidebar destination. Position restoration yields to user input and stops waiting after three seconds if a thumbnail is unavailable.

Hold **Ctrl** and scroll up over a thumbnail to progressively enlarge the whole image against a softly blurred background. Scroll down to return it to the grid; **Escape**, **Space** or clicking outside also closes it. Releasing Ctrl keeps it open; scrolling without Ctrl closes the enlargement and continues scrolling the page. **+ / −** and **↑ / ↓** resize an open enlargement. Video thumbnails enlarge their poster without starting playback. App and system reduced-motion preferences are respected.

The main sidebar starts with Links. Media can be browsed through Categories and Projects; All categories provides the combined category view.

- Hover a video or animation for a muted, looping preview. Click for the viewer; use arrow keys and Escape.
- At window widths of 1,600 CSS pixels or more, clicking media opens a right-hand preview. The grid, sidebar and filters stay interactive; click another thumbnail to switch, and the current reference has a green outline. Resizing automatically switches between this layout and the overlay while retaining the open item. Closing a side preview keeps your browsing position. Filtering out the current item closes its preview.
- In the image viewer, scroll to zoom into the point under your cursor. Drag to pan, and double-click or click the percentage to reset. Zoom resets when you switch images.
- Close the overlay viewer with Escape, X or its backdrop to return to the last-viewed image in the grid. Its row scrolls into view, its thumbnail highlights briefly, and keyboard focus returns to its Open button so Enter reopens it. Search, filters, sort order and selection stay unchanged.
- Copy an image using its thumbnail's clipboard button, the viewer's clipboard button, right-click → Copy image, or Ctrl+C in the viewer. This writes full-resolution image pixels to the system clipboard for pasting into other apps, including transparency. Image orientation is applied; animated images copy their first frame. Videos do not offer image copy.

Hover or focus a reference and press Space to peek. Space/Escape closes the preview; arrow keys browse the current filtered view without opening websites. Videos use muted previews. Search fields retain their normal typing shortcuts.

- The sidebar can be resized. Thumbnail size and sidebar width are remembered.

**Recently added** groups references from every collection by their local date of entry into the library. **Recently viewed** remembers the last 60 distinct references you opened or previewed on this device. Use **Customise shortcuts** in the sidebar footer to pin, reorder or hide collections and favourite websites, or add a website.

## Organise a project

Design, Photography and Videos are watched storage folders. Photography and Videos sit beside the chosen Design folder. Categories organise media in the library. Projects group references across folders and collections.

- Create a project with the sidebar +. Hover a card to select it or add it to a project. Drag selected references onto a project. Ctrl-click toggles selection; Shift-click selects a range; Ctrl+A selects the filtered view.
- Existing first-level Design folders provide the initial categories. Select media with the thumbnail checkboxes, Ctrl-click or Shift-click, then drag any selected thumbnail onto a sidebar category to move the whole selection. Drop targets highlight and show a move cursor. Use **Change category** in the selection bar, the right-click menu, or press **C** with media selected. The searchable picker moves immediately; typing a new category offers **Create & move**. The sidebar + creates an empty category. **Uncategorised** clears an assignment, and the Undo toast restores each previous category. Files, projects, tags and pins stay in place; assignments are saved in SQLite, included in metadata backups and preserved by rescans. New files captured while browsing a category are assigned to that category automatically.

Photography imports default to the Photography category. Later category assignments survive rescans.

- Tags apply across projects and file types. Choose **Any tag** to match at least one selected tag, or **All tags** to require every selected tag. Search `/` matches filenames, names and URLs.

- In a project, use the pin on a card, the viewer's Pin button, or a link's menu. Pins belong to that project and stay ahead of the selected sort order.

- Right-click a thumbnail, link row or open image for direct Add to project actions, with recently used projects first. It applies to the whole selection if the clicked item is selected. Existing memberships show a check. Recent project use is saved locally.
- Remove from library is available in the right-click menu, viewer, selection bar and Delete key. Originals stay on disk; removed entries stay hidden during rescans. Use the Undo toast or Settings → Removed items to restore them, including their projects, tags and pins. Duplicate recovery remains separate because it also moves files.

Thumbnail moves use direct pointer dragging inside the app, independent of browser drag permissions. A six-pixel movement starts dragging; plain thumbnail clicks in Design Inspo, App Components and projects select the item without opening it; Space opens the quick preview. Customise → Library offers 50 selection indicators (ten frame treatments in five colours), with live previews, Undo/Redo and portable backup support. Selection IDs remain valid if scrolling removes the source thumbnail from the virtual grid. Categories move references; projects add assignments. The compact badge stays outside the sidebar, hovering near the category list edges scrolls it, and Escape cancels.

Ctrl+Z or the header Undo button reverses the latest organisation change. Ctrl+Shift+Z, Ctrl+Y or the adjacent Redo button reapplies it. Both stacks survive restarts; a new organisation change clears Redo. Text fields keep their native editing shortcuts. The last 100 changes are stored locally across restarts, independently of notification expiry. Bulk category/project/tag changes, pins, removals, link edits and project/tag management are supported. Imports clear both history stacks because imported metadata may replace identities. Undo does not delete captured files.

In a project, open **Contact sheet**. Selected project references are preselected up to the 24-reference limit. Choose references, drag them into order or use the arrows, then switch names and source URLs on or off. **Export PNG** saves the preview as one image. Link cards without an image show their domain.

## Capture files and links

- Add → Files imports images and videos. Add → Paste or Ctrl+V accepts files copied from Explorer, clipboard images, local file paths and website URLs; files can also be dropped onto the app. Explorer imports preserve filenames and formats. The capture dialog defaults to the selected source and lets you change the destination, projects, tags and source website. New media is copied into the chosen source's `Captures` folder. After a successful save, that copy is independent of Downloads. Dropped files stream to staging in 2 MiB chunks rather than loading whole videos into memory.

Captured media defaults to Uncategorised. Captures remains a storage folder and is excluded from the category list. Pasting into a selected category still assigns that category, and existing category assignments are preserved.

Pasting image or file references into a selected category (including Uncategorised) saves immediately without the capture dialog, assigns that category and reuses existing matches. Photography uses its Photography storage source; other categories use Design. Separate paste commands join a FIFO queue shared with direct image drops. Each paste starts its clipboard read immediately and retains the folder selected at paste time, even if the user navigates elsewhere. The progress area shows how many imports are waiting; one failed read or save does not stop later jobs. Holding Ctrl+V does not enqueue keyboard auto-repeat events. Keep the app open until the queue finishes; pending jobs are not persisted across restarts. App clipboard reads and writes are serialized: an immediate paste waits for an in-progress thumbnail copy, and a failed copy cancels that waiting paste instead of importing old clipboard contents. URLs, collection views and the All categories overview retain their existing capture forms. Save errors appear in the normal error banner.

- Duplicate captures reuse an existing reference within the selected source and merge project/tag memberships. The same image can be saved separately under Photography and Design. File bytes are compared with SHA-256, and still images also compare exact decoded pixels across supported formats. Renamed files are recognised. Resized, edited or differently compressed images and re-encoded videos are not treated as exact duplicates; animations are compared as whole files, never just their first frame.
- Settings → Find duplicates scans the existing library. Choose the retained copy in each group. Removed duplicates move into local app data's `removed-duplicates` folder, with their projects, tags and pins merged into the retained item. Restore them from the same screen's Recovery list. Nothing is permanently deleted by this feature. Recovery files are outside OneDrive and are not included in metadata exports.

A capture receipt shows where a save went. Use **View** or **View existing** to preview the saved references, using the arrow keys for a batch. Moving an existing URL to another collection shows both locations and offers **Undo move**.

## Browse websites and download videos

Resources lists saved sites by category, including Photography. Pinterest, Dribbble and Awwwards are shortcuts above the filter. Saved links, source websites and the update page open in the Windows default browser.

- Resources are stored in SQLite alongside other links, with a separate destination. Paste or Add → Link while viewing Resources defaults to Resources; the capture form lets you choose Links or Resources explicitly. Search/category filters clear after saving so the new resource is visible. Resources support projects, tags, edit, removal and metadata backup; they stay out of the ordinary Links view unless assigned to the current project. Right-click a link to move it between Links and Resources, preserving its projects and tags. Pasting an existing URL into a different destination moves the existing item rather than duplicating it. The original gallery catalog is seeded once and removed entries are not recreated on restart.

- Fonts, CodePen and Brand Guidelines sit below Resources in that order. CodePen uses thumbnail cards: paste a URL, paste a thumbnail, then press Enter (or Save). You can also start with Add link. Assign projects and tags in the same form, or later from the card menu. Each card opens its URL in the default browser; its thumbnail also appears in assigned projects. Search, tags and sorting apply to the collection. If Enter follows paste immediately, saving waits for clipboard reading to finish.
- Brand Guidelines uses the same Name/Link table as Links, including selection, projects/tags, editing and Remove from library with Undo. It also appears as table rows inside assigned projects. New guideline links need only a URL; thumbnails are optional. The user's 200-reference workbook was imported into their normally launched app through Settings → Import metadata after exporting a backup. The catalog is not seeded on startup, so removing an entry keeps it removed.

- Fonts uses a simple Name/Link table like Brand Guidelines, including search, sorting, selection, project/tag assignment, editing, removal and Undo. Paste a URL and press Enter (or Save); no thumbnail is required and no thumbnail controls are shown. Fonts also appear as link rows in projects. Existing saved thumbnail files are retained but are not displayed in the Fonts list.

- Link capture includes **Capture & save**. Paste a URL, optionally change the default 4:3 ratio (square, 16:9, portrait or freeform), then click Capture & save and drag to size the selection. Release, then drag inside the box to position it without changing its size. Press Enter or double-click inside to save the link and thumbnail, including any selected projects/tags. Drawing outside the box starts a new selection. Escape or right-click cancels and returns to the unsaved form. The app hides itself during capture. Windows capture uses a local Windows PowerShell/Windows Forms helper; nothing is uploaded, and the clipboard is left alone.
- Capture has faint horizontal/vertical centre guides and a small centre crosshair inside the selection for framing content. Moving near the current monitor's centre gently snaps on each axis independently; hold Alt to move freely. Monitor alignment lines appear only while moving at the centre. The instruction strip stays at the screen edge and hides during dragging. None of these overlays appear in saved thumbnails.
- Right-click a link card → **Edit thumbnail** to drag/zoom its crop, select another ratio, keep the whole image, paste a replacement or capture a replacement. Replacement screen captures use the same position-and-save flow. Cropping uses Save thumbnail (or Enter); links and memberships are preserved. Pasted thumbnails can also be adjusted before saving a new link. Cards fit the entire thumbnail inside their 4:3 display area, so alternate ratios are not silently cropped. Saved thumbnails are limited to 1600 pixels on each side without enlarging small images.

- Facebook Videos below Brand Guidelines opens the existing Videos source as a video grid. Ctrl+V, then Enter adds a link to the background download queue. Projects/tags are optional in the add form. The compact Downloads panel lets you keep pasting links and pressing Enter, or paste multiple URLs (one per line); Shift+Enter adds a line. Downloads run one at a time in insertion order, with percentage, bytes, speed, ETA and processing status. Browse normally or hide the panel while it works; completion refreshes the library without changing your view. Cancel the active job, remove a waiting one, retry a failure, or clear finished history. Failures/cancellations advance to the next job automatically. Pending jobs and assignments persist in local WebView storage and resume on reopening; failed jobs wait for Retry. Duplicate active/waiting URLs are skipped, with extra assignments merged into waiting work or applied through a follow-up reuse after the active download. Public Facebook links work without browser access; restricted links show an error. Browser cookies are never read automatically.
- Downloaded videos live in `Videos/Downloads` beside your Design folder. Their source URLs, titles, projects and tags are stored in SQLite. Pasting an existing video URL reuses it; Facebook watch-link tracking parameters are ignored. Saved videos use the same thumbnails, hover previews, viewer, right-click actions and removal/undo as local files.
- yt-dlp 2026.10.26 is bundled from the official GitHub release with its third-party licenses. `npm run prepare:downloader` fetches that pinned release and verifies its published SHA-256 checksum. No subscription, account or Python installation is needed. Updating yt-dlp later requires changing the pinned version and rebuilding (or replacing the bundled binary with an official release).

## Back up and restore

For a portable copy, use **Settings → Export full library**. Check the export summary for unavailable files. To restore, place the entire backup folder in its permanent location and select its `library.json` under **Settings → Import metadata**. Restored references use the media in that folder.

Settings → Export metadata saves projects, tags, links and file references as JSON. Import merges by file path and label name, preserving existing metadata and avoiding duplicate memberships. Original media and thumbnail image files are not included in the metadata backup; back up the source folders and `link-thumbnails` folder to preserve those files. Missing originals remain listed so their collections and tags are retained. Metadata-only exports use absolute paths; moving files outside the app currently requires relinking through a backup edit or returning them to their original paths.

## Local development data

Windows MSIX warning for development/data maintenance: Codex-launched processes can see a redirected `%LOCALAPPDATA%` under `Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Local`. Even ordinary absolute paths and `\\?\` paths can resolve to that separate copy. A Design process launched by Codex can therefore show a different library from the user's Explorer-launched app. For actual user-data changes, use Export/Import metadata in the already running normal app, and verify its projects and collection counts. Do not infer the correct database from the apparent path alone, or relaunch the user's app from Codex to verify their data.

Metadata is stored in `%LOCALAPPDATA%/local.design.viewer/library.sqlite`; thumbnails and video conversions live in the sibling `cache` folder. Pasted link thumbnails are copied into `%LOCALAPPDATA%/local.design.viewer/link-thumbnails`; their original clipboard/source files are not needed after saving. The database and cache stay outside OneDrive. Originals remain in the selected source folder. OneDrive files must be available locally for decoding.

Video previews are generated on demand, limited to eight seconds, muted and cached. GIF and animated WebP hover previews play directly from their original files. The full viewer plays the original when compatible and generates a compatible copy for MOV or codec fallback. The first conversion can take a few seconds. Only the hovered card plays in the grid. Thumbnail generation is limited to three jobs at once. Unsupported or damaged files get a fallback tile without breaking the library.

## Checks

For temporary app/process monitoring and a repeatable synthetic browser workload, see [performance diagnostics](PERFORMANCE.md). Use `npm run diagnose:performance` or `npm run diagnose:processes`; both stop after their capture and keep local reports out of Git.

```powershell
npm test
npm run test:grid
npm run test:preview
npm run test:actions
npm run test:boards
npm run test:video
npm run test:workflow
npm run test:drag
npm run test:categories
npm run test:export
npm run build
npm run test:native
```

Tests cover combined filters, project-specific pin ordering, source descendants, stable shuffle, indexing without losing curation, thumbnail decoding, missing files, project deletion without deleting originals, URL validation, idempotent backup import including pins, duplicate capture across image formats, duplicate video bytes with renamed files, recovery and stale-match rejection, and chunked file staging.

`test:grid` launches its own headless Chrome process with a temporary profile and a mocked 420-image library. It checks returning after 200 arrow-key advances, Escape and X, actual Enter-key reopening, highlight expiry, retained filters/sorting, and wraparound at wide and narrow window sizes. It never attaches to or controls your open browser/app windows or reads the real library.

`test:clipboard-scroll` checks failed copy/paste recovery, ordinary scrolling out of an accidental Ctrl-wheel enlargement, and cancellation/timeout of a stalled position restore using an isolated mock library.

`test:actions` uses the same isolated browser harness to check image-copy entry points, Resources paste routing and metadata, and moving misplaced links. Clipboard commands are mocked in browser tests; native tests verify original-size RGBA pixels and Resources persistence without replacing your system clipboard or touching the real library.

`test:boards` checks empty collection navigation, URL/image/Enter capture (including Enter during clipboard reading), optional project/tag assignments, external links and project thumbnails at wide and narrow sizes, using mocked clipboard data. Native tests verify thumbnail resizing, transparency, durable copies, URL reuse and metadata backup.

`test:video` checks FIFO execution with a maximum of one active download, repeated/batch paste, optional metadata, live progress/ETA, removal of waiting items, active cancellation, automatic advancement after failures, retry order, persistence, duplicate suppression, invalid batches, background browsing without view changes, and hiding/clearing the queue without stopping active work, in isolated headless Chrome. Pure queue tests also verify interrupted-job restoration, cancellation intent, assignment merging and URL validation. Native tests cover progress parsing, URL normalization, durable imports, repeat-link reuse and process cancellation. The ignored `requested_video_download_smoke` test downloads only an explicitly supplied URL; it uses a temporary library unless `DESIGN_DOWNLOAD_SMOKE_DB` explicitly identifies the library to add to, and verifies both a decoded thumbnail and hover preview with FFmpeg.

`test:preview` checks the side preview at 3440, 1920, 1600 and 1599 pixels, including live resizing across the breakpoint, grid clicks and scrolling, current-thumbnail highlighting, arrow navigation, close behaviour and filtering. It uses an isolated mocked library.

The Links table includes a Category column, also shown for ordinary links within projects. Link categories use the existing `Links/<category>` source namespace and are preserved by metadata and portable backups. Uncategorized links display a dash. They do not create Design Inspo or App Components folders.
