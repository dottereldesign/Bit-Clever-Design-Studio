# My Business storage

My Business is a device-level workspace for the owner's business, separate from app branding and client organisations. Switching libraries does not switch this workspace.

- Desktop records are in `my-business.sqlite` in the normal application data folder (`%LOCALAPPDATA%\local.design.viewer` on Windows). Writes use SQLite transactions and revision checks. A stale editor cannot overwrite newer data.
- Browser records are in the current browser origin's `private-business-workspace-v1` local storage. They do not automatically sync with desktop. Clearing site data removes browser records.
- Neither store is included in appearance backups, portable library exports or metadata exports. Business command payloads bypass diagnostic logging; diagnostics record only operation timing, success/failure and record counts. These are local records, not encrypted storage or a credential vault.
- For a desktop backup, close the app and copy `my-business.sqlite` to a private backup location, or use a full device backup. Keep this file out of shared repositories.
- An optional `my-business-seed.json` in the application data folder initializes an empty desktop workspace once. It must contain the `BusinessData` schema; it never replaces existing records. It is ignored by Git. No personal seed values belong in source, screenshots or fixtures.

Budget totals use the selected business currency without conversion. Annual costs are divided by twelve for the monthly equivalent. Planned recurring costs, active commitments and planned one-off purchases are separate. Domains, hosting and subscriptions share the budget's records and are not duplicated. Unknown costs remain blank rather than being treated as confirmed free services.

Tax and setup references link to official New Zealand sources; the jurisdiction is editable. No registrations, purchases, tax calculations or filings are performed by this workspace. Dates and prices are entered by the owner.
