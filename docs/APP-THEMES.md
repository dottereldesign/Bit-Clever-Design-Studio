# Themes, fonts and customisation

Version 0.4.0 adds whole-app themes in Customise → Branding. Studio default makes no colour or font changes. The first run captures the existing appearance locally, so “Restore my Studio default” can return to that setup with Undo available. Theme changes never replace business information, media, logos, layouts or button-style selections.

There are 29 theme families and 44 variants. Family names, available modes and base colour triples were checked against the installed Codex 26.1106.6628.0 theme catalogue. These are adaptations for this app, not a claim of affiliation or pixel-identical editor themes. [OpenAI's appearance documentation](https://learn.chatgpt.com/docs/reference/settings#appearance) describes base themes, colours and fonts, including Codex, Catppuccin and Dracula examples. Newer Codex versions may add themes.

## Colour priority

1. Existing Studio appearance remains unchanged until a theme is selected.
2. A theme supplies backgrounds, panels, fields, tables, dialogs, navigation, focus cues and readable text colours.
3. Explicit Buttons, Tabs, Sidebar, Home, Analytics and Library selection colours take priority. Their “Use app theme default” option restores inheritance. Editing a colour switches that group back to custom; selecting a different layout or animation does not.
4. “Use theme colours for all controls” enables inheritance for all groups without deleting their saved custom choices. Custom chart hues gain readable dark variants.

Typography offers the original styles, one app font, or separate heading and body fonts. Fonts are local stacks with fallbacks; no external font requests are made. Images and media are never tinted or filtered to implement a theme.

`app-theme`, `app-colour-sources` and `personal-studio-default` are appearance preferences included in appearance backups. The saved personal default remains local user data, not the repository's generic `defaultAppearance.json`.

## Maintenance

`appThemeData.ts` builds semantic colours from the base palette and adjusts text/accents to at least 4.5:1 against main surfaces. Unit tests check every variant. `appTheme.css` defines typography and explicit override precedence.

Legacy CSS is adapted by `scripts/generate-theme-surfaces.mjs`, which generates `themeSurfaces.css`. Run it after adding or changing UI CSS. It namespaces paint overrides to non-Studio themes and excludes tab treatments and media-viewer colours that have their own appearance controls. CTA paint overrides are generated only for the theme-default colour mode; custom button colours remain untouched. Layout, geometry, interactions and saved custom inline styles are not rewritten. Inspect a dark and a light theme after changes, including forms, dialogs and disabled/hover states.

Checks: `npx tsx --test src/appThemeData.test.ts`, `node scripts/check-grid-return.mjs app-themes`, `node scripts/check-grid-return.mjs settings-page`, and `npm run audit:diagnostics`.

## Connection logo

The Google Calendar connection uses Google's product icon from [Google's static asset service](https://ssl.gstatic.com/images/branding/productlogos/calendar_2026/v2/ico/calendar_2026_256dp.ico). It identifies the connected product, retains its original colours, and is not covered by the application's MIT artwork licence. Google Calendar and its logo belong to Google. [Google brand resources](https://about.google/brand-resource-center/products-and-services/).

## Diagnostics coverage

Workspace navigation, Home summary rendering, Analytics reports, My Business load/save operations, Customise and Settings pages, sidebar tools, appearance changes, calendar sync and existing library/project/lead commands produce local timing and outcome metadata. Section filters include all of these areas. The command wrapper never serialises input payloads; My Business logs counts, not business names, amounts, tax notes, domains or contact details. Interaction events identify the surface and control type, not typed text or dropdown values. Diagnostic exports remain explicit user actions.
