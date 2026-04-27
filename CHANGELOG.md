# Changelog

All notable changes to this project are documented in this file.

## 2026-04-27 (continued)

### Added
- **Responsive design** (`web/styles.css`, `web/app.js`, `web/index.html`): full mobile/tablet support. On screens ≤ 960 px the sidebar becomes a fixed overlay that slides in from the left; on ≤ 600 px it expands to full viewport width. A semi-transparent backdrop (`#sidebarBackdrop`) dims the map when the sidebar is open and closes it on tap. The sidebar starts collapsed on mobile so the map is visible immediately. `100dvh` replaces `100vh` to handle mobile browser address-bar shrinkage. Touch targets enlarged and paddings tightened at the 600 px breakpoint.
- **Off-season historical data cap** (`web/app.js`): `getHistoricalCutoffDate()` now returns `DEMO_DATE` (04/02) during off-season instead of today, preventing 404 fetches for snapshot files that don't exist past the demo date.

### Fixed
- **Backdrop blocking all interactions** (`web/styles.css`): added `pointer-events: none` to `.sidebar-backdrop` so the invisible overlay does not swallow map taps and button clicks when the sidebar is closed.
- **☰ button overlapping viz-header title** (`web/styles.css`): `#app.sidebar-hidden .viz-header` gets `padding-left: 56px` whenever the show-sidebar button is visible, preventing the title from being hidden behind the button on both mobile and desktop.
- **`isOffSeason()` month indexing bug** (`web/app.js`): restored `date.getMonth() + 1` so the 1-indexed `OFF_SEASON_AFTER.month` constant is compared correctly (plain `getMonth()` returns 0-indexed April = 3, which never matched `month: 4`).

## 2026-04-27

### Added
- **Daily scraping job** (`~/Library/LaunchAgents/com.bingxu.sakura-scrape.plist`): launchd plist that runs `scrape_all_spots.py` at midnight every day using the `py_common` Python environment. Output goes to `wn_scraping/output/wn_prefecture_spots.csv`; logs to `scrape.log` / `scrape.err`.
- **`.gitignore`**: excludes dated snapshot files (`web/data/spots_*.json`, `wn_scraping/output/wn_prefecture_spots_*`) and standard Python/macOS artifacts.
- **Off-season mode — web** (`web/app.js`, `web/index.html`, `web/styles.css`): after `OFF_SEASON_AFTER` (May 6), the app pins the 桜レーダー slider default and the 予想分布 "今日" line to `DEMO_DATE` (April 2) instead of the current date. A styled amber pill notice — *"Sakura season has ended — showing 04/02 data for demo."* — is shown below the site title.
- **Off-season mode — scraper** (`wn_scraping/scrape_all_spots.py`): on or after `SEASON_END` (May 6), the scraper skips overwriting `web/data/spots.json` and `web/data/previous.json` to preserve the demo snapshot.
- **`wn_scraping/config.py`**: centralised config file for `BASE_URL`, `USER_AGENT`, `REGIONS`, and `SEASON_END`. Both `sakura_scraper.py` and `scrape_all_spots.py` now import from here instead of defining constants inline.
