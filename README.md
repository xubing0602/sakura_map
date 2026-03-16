# sakura_map

Scripts for scraping sakura spot data from weathernews.jp.

## Setup

```bash
pip install -r requirements.txt
```

## Scrape One Spot

```bash
python scripts/scrape_one_spot.py \
  --url https://weathernews.jp/sakura/spot/106/ \
  --ranking-url https://weathernews.jp/sakura/area/tokyo/ranking.html \
  --out spot.csv \
  --include-source-url
```

## Scrape All Spots

All regions (default):

```bash
python scripts/scrape_all_spots.py --out spots.csv
```

Only specific small areas:

```bash
python scripts/scrape_all_spots.py --areas tokyo,shiga --top 20 --out spots.csv
```

Only specific big regions:

```bash
python scripts/scrape_all_spots.py --regions kanto,kinki --top 20 --out spots.csv
```
