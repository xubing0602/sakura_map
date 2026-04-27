# Changelog

All notable changes to this project are documented in this file.

## 2026-04-27

### Added
- **Daily scraping job** (`~/Library/LaunchAgents/com.bingxu.sakura-scrape.plist`): launchd plist that runs `scrape_all_spots.py` at midnight every day using the `py_common` Python environment. Output goes to `wn_scraping/output/wn_prefecture_spots.csv`; logs to `scrape.log` / `scrape.err`.
- **`.gitignore`**: excludes dated snapshot files (`web/data/spots_*.json`, `wn_scraping/output/wn_prefecture_spots_*`) and standard Python/macOS artifacts.
- **Off-season mode — web** (`web/app.js`, `web/index.html`, `web/styles.css`): after `OFF_SEASON_AFTER` (May 6), the app pins the 桜レーダー slider default and the 予想分布 "今日" line to `DEMO_DATE` (April 2) instead of the current date. A styled amber pill notice — *"Sakura season has ended — showing 04/02 data for demo."* — is shown below the site title.
- **Off-season mode — scraper** (`wn_scraping/scrape_all_spots.py`): on or after `SEASON_END` (May 6), the scraper skips overwriting `web/data/spots.json` and `web/data/previous.json` to preserve the demo snapshot.
- **`wn_scraping/config.py`**: centralised config file for `BASE_URL`, `USER_AGENT`, `REGIONS`, and `SEASON_END`. Both `sakura_scraper.py` and `scrape_all_spots.py` now import from here instead of defining constants inline.
