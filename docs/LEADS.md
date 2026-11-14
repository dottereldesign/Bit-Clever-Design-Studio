# Leads

Create an opportunity in **Leads → Pipeline**. Record its first-contact date,
brief, service, source and contacts. Use Activity for dated conversations and
source-email links, Files for supporting material, and next actions for follow-ups.

Choosing **Won** creates a project and hands over the brief, contacts, files and
unfinished actions in one transaction. Completed actions and activity history stay
with the lead. Choosing **Lost** does not create a project.

Handover uses an explicitly selected project first, otherwise the lead's single
linked project, otherwise a unique project with the same name (ignoring case and
outer whitespace). It creates a project only when no match exists. Multiple
possible destinations require an explicit choice. A repeated handover cannot
create another project. Reopening a handed-over lead retains its project.

Undo and Redo include both the Won status and project handover. Existing project
details are preserved; incoming brief text is appended when different.

The first Leads visit shows a seven-step walkthrough. It navigates between views
but never creates or changes records. **Settings → Guided walkthroughs** contains
the enable switch and **Replay Leads walkthrough**. These preferences are included
in library preference backups. Reduced motion disables typing and mascot motion.
The mascot and arrows follow the Leads parent colour. Tour diagnostics contain
only the section, step and completion/skip state, not lead names or email content.

Validation: `npm test`, `npm run test:native`, `npx tsc --noEmit`,
`node scripts/check-grid-return.mjs studio`, and
`node scripts/check-grid-return.mjs leads-tour`.
