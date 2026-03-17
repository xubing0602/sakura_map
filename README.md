# sakura_map

Scripts for scraping sakura spot data from weathernews.jp.

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
  --out ./scraping/output/wn_prefecture_spots.csv \
  --resume \
  --no-proxy \
  --include-source-url
```

Only specific small areas:

```bash
python3 ./wn_scraping/scrape_all_spots.py \
  --areas tokyo \
  --top 20 \
  --workers 6 \
  --out ./scraping/output/wn_tokyo_spots.csv \
  --resume \
  --no-proxy \
  --include-source-url
```

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
