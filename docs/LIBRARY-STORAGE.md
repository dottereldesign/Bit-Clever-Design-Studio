# Library storage and backups

Storage & Backup provides Create Library for the legacy scattered storage layout. Choose the parent location; the app creates `BitClever Library` there, or a numbered sibling if that name already exists. It copies files, verifies SHA-256 hashes, imports metadata into a fresh database, and checks database integrity and folder relationships. It never removes legacy originals. Use This Library activates the verified copy and restarts the app.

```
BitClever Library/
  Design Inspo/
  App Components/
  General/
  Appearance/
  Library Data/
  Browse Library.html
  Read Me.txt
```

Original media uses readable, collision-safe filenames. Files belong to one physical collection; design and component folder memberships remain in the database and appear in the offline browser. Assigning an image to multiple folders does not duplicate its original. Uncategorised contains items with no folder assignments; removing the final assignment returns the item there. An item can belong to both Design Inspo and App Components. Adding to either section preserves the other section’s assignments. Filing in a named folder clears Uncategorised membership in both sections while preserving all named folders. Moving between section inboxes also clears the former inbox; only named folders are shared across sections. Source URLs, tags, project pins, links, Home tiles, custom icons and appearance settings travel with the library.

## Copying and restoring

Close BitClever before copying the whole live library folder to another drive. While the app is running, use Back Up Now instead: it snapshots SQLite, including committed WAL data, and verifies copied files before marking the backup complete. Use Verify Backup on the destination copy. Keep an additional copy on a separate device or location.

Open Existing Library opens a complete backup or live library copy in its permanent location. Paths and appearance assets are rebased if the folder moved. If the selected library becomes unavailable at startup, the recovery screen lets you reconnect the drive or choose the library's new location; it does not silently start an empty library.

Merge Backup imports backup records into the current library. Managed libraries copy and verify incoming media before referencing it. Legacy libraries retain their existing import behavior. Older portable backups remain readable. Metadata-only legacy exports are not substitutes for full portable backups.

Portable backups exclude removed items, undo history, browser sessions and temporary caches. A whole closed-library copy can retain these incidental files; they are not required to restore active content. `INCOMPLETE.txt` marks an interrupted export. Missing-source reports must be resolved before migration can be activated.

## Implementation notes

`Library Data/Library.sqlite` is authoritative once a folder is opened as a managed library. The JSON metadata and manifest describe the initial portable snapshot, not subsequent live changes. Live verification uses database integrity, foreign keys, and stored media/appearance checksums. Portable snapshot verification uses its manifest. AppData stores only the selected-library pointer and runtime caches after migration; legacy files remain until the owner removes them separately.

Do not manually rename or rearrange managed media files. Use the app's folder controls. Verify detects missing or altered files; it does not repair corruption. The offline HTML browser is a convenience index and is not a replacement for Library Data.
