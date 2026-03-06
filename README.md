# FF14 Helper

FF14 Helper is a public GitHub Pages project focused on practical Final Fantasy XIV helper tools.

This project is intentionally front-end first:
- Personal setting backups are created in the browser.
- Treasure map planning and most workspace data stay in local storage unless the user explicitly enables short-lived realtime rooms.
- Cloud uploads go directly to OneDrive or Google Drive.
- No FF14 Helper application server is used for normal file handling.

## Work In Progress

This repository is still under active development.
Core pages are already usable, but copy, workflow details, solver quality, and UI polish will continue to evolve.

## Current Feature Set

### Backup Assistant

- Select the FF14 settings folder from Windows.
- Scan only known configuration files and character folders.
- Build a ZIP archive in the browser.
- Download locally or upload to OneDrive / Google Drive.

### Restore Inspector

- Open an existing backup ZIP.
- Validate `backup-manifest.json`.
- Review archive entries before manual restoration.

### Traditional Chinese Market Workbench

- Focused on `陸行鳥` and `莫古力`.
- OCR import from screenshots with editable preview before commit.
- Bulk text import and manual row entry.
- Workbook summary and marketboard calculator.

### Gold Saucer GATE Reference

- Fixed `Asia/Taipei` time display.
- Countdown for the current or next GATE window.
- Non-official candidate prediction for reference only.

### Craft Workbench

- In-site crafting workbench inspired by the BestCraft project.
- Crafter attributes, recipe search/autofill, and editable skill sequence.
- Progress / quality / durability / CP simulation in the browser.
- Built-in solver with configurable objective and condition assumptions.
- Macro text import and macro draft export.
- Quick task filters for Custom Deliveries and Allied Societies.

### Collection Tracker

- In-site collection workflow inspired by `ffxiv-collection-tc`.
- Focused first on Custom Deliveries and Allied Societies.
- Search, patch filter, role filter, status tracking, and wishlist.
- Backup code export / import stored only in the browser.

### Treasure Map Helper

- Separate solo and 8-player treasure flows.
- Local snapshot data instead of runtime parsing of third-party scripts.
- Map point browsing, coordinate copy, and route planning.
- Optional realtime room sync through Firebase with TTL-based temporary storage.

## Data Policy

- This site does not store your FF14 configuration files on any FF14 Helper server.
- Backup ZIP files are generated locally in your browser.
- Cloud backup uploads go directly to OneDrive or Google Drive after you authorize those services.
- Market workbench data is stored only in your browser `localStorage`.
- Realtime treasure rooms, when enabled, store only room code, room name, member nicknames, route data, and timestamps in Firebase for a limited time.
- The project does not create permanent user accounts.

## Reference Sources

These sites and documents are used as reference for workflow design, public data rules, or implementation research.
FF14 Helper is a reimplementation, not a copy of any referenced site.

### Feature Inspiration

- [FFXIV Best Craft](https://github.com/Tnze/ffxiv-best-craft)
- [ffxiv-collection-tc](https://cycleapple.github.io/ffxiv-collection-tc/)
- [FFXIV Market](https://beherw.github.io/FFXIV_Market/)
- [xiv-tc-treasure-finder](https://cycleapple.github.io/xiv-tc-treasure-finder/)
- [xiv-tc-toolbox](https://cycleapple.github.io/xiv-tc-toolbox/)

### Data and Technical Sources

- [Console Games Wiki: Gold Saucer Active Time Events](https://ffxiv.consolegameswiki.com/wiki/Gold_Saucer_Active_Time_Events)
- [Custom Deliveries - Console Games Wiki](https://ffxiv.consolegameswiki.com/wiki/Custom_Deliveries)
- [Allied Society Quests - Console Games Wiki](https://ffxiv.consolegameswiki.com/wiki/Allied_Society_Quests)
- [Soktai FFXIV Tools - Allied Society Quests](https://soktai.ca/ffxiv/allied-society-quests)
- [cycleapple treasure data.js](https://cycleapple.github.io/xiv-tc-treasure-finder/js/data.js)
- [cycleapple firebase-config.js](https://cycleapple.github.io/xiv-tc-treasure-finder/js/party/firebase-config.js)
- [XIVAPI](https://xivapi.com/)
- [XIVAPI Docs](https://v2.xivapi.com/docs)
- [XIVAPI MapCoordinates.md](https://github.com/xivapi/ffxiv-datamining/blob/master/docs/MapCoordinates.md)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [BestCraft License (AGPL-3.0)](https://github.com/Tnze/ffxiv-best-craft/blob/master/LICENSE)

## Reference vs Reimplementation

Referenced sites are used for:
- feature direction
- workflow study
- public data interpretation

This project does not directly copy:
- UI layouts
- site copy
- proprietary assets

## Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run build
npm run test
npm run lint
```

## Runtime Config

Set public runtime values in `public/runtime-config.json`.

- `oneDriveClientId`
- `googleClientId`
- `oneDriveRedirectUri`
- `googleRedirectUri`
- `firebaseApiKey`
- `firebaseAuthDomain`
- `firebaseDatabaseUrl`
- `firebaseProjectId`
- `firebaseStorageBucket`
- `firebaseMessagingSenderId`
- `firebaseAppId`

These are public client-side configuration values, not server secrets.

## Deployment

The site is deployed through GitHub Actions to GitHub Pages.

- Workflow file: `.github/workflows/deploy.yml`
- Vite `base` is set to `./` so the build works for repo pages, user pages, and custom domains.
