# FF14 Helper

FF14 Helper is a public, browser-first toolkit for Final Fantasy XIV players.

The site is built as a static app for GitHub Pages. As much as possible, user actions stay in the browser: backup ZIP generation, restore inspection, local sync preferences, Gold Saucer timing, Traditional Chinese server price comparison, and treasure-map helpers all run without a custom backend owned by this project.

## Status

This project is actively being developed.

- Core backup and restore helper flows are usable now.
- Gold Saucer, market, and treasure pages are available as the first utility wave.
- More helper pages can still be added over time.

## Current Feature Set

- Local FF14 settings backup from a selected folder
- ZIP generation in the browser
- Optional upload to OneDrive or Google Drive
- Restore inspector for existing backup ZIP files
- Local sync preferences and recent history
- Gold Saucer GATE schedule reference in Taiwan time
- Reference-only GATE activity prediction
- Traditional Chinese server comparison workbench for `陸行鳥` and `莫古力`
- Marketboard math helper
- Treasure finder style helper for Dawntrail treasure maps
- External tool directory with in-site reference links

## Data Policy

This project does not operate its own backend for storing user content.

- Backup ZIP contents are generated in the browser.
- Sync preferences and some helper-page defaults may be stored in browser `localStorage`.
- Market comparison values on the Traditional Chinese server page are entered by the user and kept in the browser.
- The site does not upload your personal configuration files, query history, or treasure selections to a server controlled by this project.

Cloud upload is only used when you explicitly choose OneDrive or Google Drive, and those uploads go to your own cloud account.

## Reference Sources

The project references community tools and public docs for feature direction and public data access. The site does not directly copy layouts, text, or assets from those sources. Features are reinterpreted and reimplemented with this repository's own UI, copy, and code structure.

### Feature Inspiration

- [FFXIV Market (beherw)](https://beherw.github.io/FFXIV_Market/)
- [xiv-tc-toolbox (cycleapple)](https://cycleapple.github.io/xiv-tc-toolbox/)
- [xiv-tc-treasure-finder (cycleapple)](https://cycleapple.github.io/xiv-tc-treasure-finder/)
- [FFXIV Teamcraft](https://ffxivteamcraft.com/)
- [Garland Tools](https://garlandtools.org/)

### Data Sources and Docs

- [Console Games Wiki: Gold Saucer Active Time Events](https://ffxiv.consolegameswiki.com/wiki/Gold_Saucer_Active_Time_Events)
- [cycleapple treasure data.js](https://cycleapple.github.io/xiv-tc-treasure-finder/js/data.js)
- [XIVAPI](https://xivapi.com/)
- [XIVAPI Docs](https://v2.xivapi.com/docs)
- [XIVAPI Search Guide](https://v2.xivapi.com/docs/guides/search/)
- [XIVAPI MapCoordinates.md](https://github.com/xivapi/ffxiv-datamining/blob/master/docs/MapCoordinates.md)
- [Universalis](https://universalis.app/)

## Project Goals

- Keep the site usable as a static GitHub Pages project
- Avoid storing user backup data on the site server
- Build practical FF14 utilities that are useful without requiring a separate app install
- Keep the repository readable for public contributors

## Tech Stack

- React
- TypeScript
- Vite
- React Router
- Vitest
- GitHub Pages

## Local Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm run test
npm run lint
```

## Runtime Configuration

Before deploying cloud upload features, update [public/runtime-config.json](/d:/FF14_helper/public/runtime-config.json):

- `oneDriveClientId`
- `googleClientId`
- optionally `oneDriveRedirectUri`
- optionally `googleRedirectUri`

If the client IDs are left empty, the site still works for local backup ZIP creation and non-cloud helper pages, but cloud upload actions remain unavailable.

## GitHub Pages Deployment

This repository is set up for GitHub Pages deployment using GitHub Actions.

Relevant workflow:

- [.github/workflows/deploy.yml](/d:/FF14_helper/.github/workflows/deploy.yml)

Notes:

- The Vite base path defaults to `./`, so the site works on project pages, user pages, or custom domains without hard-coding the repository name.
- The site is intended to be deployed from the `main` branch through the workflow.

## OAuth Redirect

The default OAuth callback file is:

- `/oauth/callback.html`

A typical GitHub Pages redirect URI looks like:

- `https://<user>.github.io/<repo>/oauth/callback.html`

Use the correct deployed URL when configuring Microsoft Entra and Google Cloud OAuth apps.

## Public Project Note

This repository is intended to be public and collaborative.

- Keep user-facing copy understandable to outside contributors.
- Keep sources attributed when a feature is inspired by another public tool.
- Prefer browser-side processing over adding a backend unless there is a strong need.
