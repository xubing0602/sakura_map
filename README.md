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

