# sakura_map

Scripts for scraping sakura spot data from weathernews.jp, plus a map viewer web app.

## Setup

```bash
pip install -r requirements.txt
```

## Scrape One Spot

```bash
python ./wn_scraping/scrape_one_spot.py \
  --url https://weathernews.jp/sakura/spot/106/ \
  --ranking-url https://weathernews.jp/sakura/area/tokyo/ranking.html \
  --out ./scraping/output/spot.csv \
  --include-source-url
```

## Scrape All Spots

All regions (default):

```bash
python3 ./wn_scraping/scrape_all_spots.py \
  --workers 6 \
  --out ./wn_scraping/output/wn_prefecture_spots.csv \
  --resume \
  --no-proxy \
  --include-source-url
```

Only specific areas:

```bash
python3 ./wn_scraping/scrape_all_spots.py \
  --areas tokyo \
  --top 20 \
  --workers 6 \
  --out ./wn_scraping/output/wn_tokyo_spots.csv \
  --resume \
  --no-proxy \
  --include-source-url
```

## Daily Scraping Job (macOS)

A launchd plist at `~/Library/LaunchAgents/com.bingxu.sakura-scrape.plist` runs the scraper at midnight every day using the `py_common` Python environment.

**Load / enable the job:**

```bash
launchctl load ~/Library/LaunchAgents/com.bingxu.sakura-scrape.plist
```

**Verify it is registered:**

```bash
launchctl list | grep sakura
```

**Run immediately (without waiting for midnight):**

```bash
launchctl start com.bingxu.sakura-scrape
```

**Disable / remove the job:**

```bash
launchctl unload ~/Library/LaunchAgents/com.bingxu.sakura-scrape.plist
```

Logs are written to `wn_scraping/output/scrape.log` and `wn_scraping/output/scrape.err`.

## Map Viewer

Generate JSON for the map UI:

```bash
python3 - <<'PY'
import csv, json
csv_path='wn_scraping/output/wn_prefecture_spots.csv'
json_path='web/data/spots.json'
rows=[]
with open(csv_path,encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        tag = row.get('tag','') or ''
        row['tag_list']=[t.strip() for t in tag.split(',') if t.strip()]
        rows.append(row)
with open(json_path,'w',encoding='utf-8') as f:
    json.dump(rows,f,ensure_ascii=False)
print('wrote',len(rows))
PY
```

Set your Google Maps API key in `web/config.js`, then run a local server:

```bash
cd web
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Off-Season Behavior

After **May 6** each year the site and scraper both enter off-season mode.

**Web app** (`web/app.js`):
- The **桜レーダー** (Sakura Radar) slider defaults to **04/02** instead of today.
- The **今日** marker in the **予想分布** (Forecast Distribution) charts is pinned to **04/02**.
- A notice banner appears below the site title: *"Sakura season has ended — showing 04/02 data for demo."*

The cutoff date (`OFF_SEASON_AFTER`) and demo date (`DEMO_DATE`) are constants at the top of `web/app.js` and can be adjusted each year.

**Scraper** (`wn_scraping/scrape_all_spots.py`):
- On or after **May 6**, the scraper still runs and writes the dated CSV/JSON snapshot, but skips overwriting `web/data/spots.json` and `web/data/previous.json` to preserve the demo snapshot.

The scraper cutoff is `SEASON_END = (5, 6)` in `wn_scraping/config.py`.

## Scraper Configuration

Shared constants live in `wn_scraping/config.py`:

| Constant | Default | Description |
|---|---|---|
| `BASE_URL` | `https://weathernews.jp` | Root URL for all scraping |
| `USER_AGENT` | Chrome/123 macOS | HTTP User-Agent header |
| `REGIONS` | all 8 regions | Regions to scrape when no `--areas` flag is given |
| `SEASON_END` | `(5, 6)` | Month/day on or after which `spots.json` is not overwritten |
