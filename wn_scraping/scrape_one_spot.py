import argparse
import re
from pathlib import Path

import requests

from sakura_scraper import fetch_html, parse_ranking_page, parse_spot, write_csv


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape one sakura spot page into CSV."
    )
    parser.add_argument("--url", required=True, help="Spot URL, e.g. https://weathernews.jp/sakura/spot/106/")
    parser.add_argument(
        "--ranking-url",
        help="Optional ranking URL to derive prefecture_ranking, e.g. https://weathernews.jp/sakura/area/tokyo/ranking.html",
    )
    parser.add_argument(
        "--out",
        default="spot.csv",
        help="CSV output path (default: spot.csv)",
    )
    parser.add_argument(
        "--include-source-url",
        action="store_true",
        help="Include source_url column for traceability",
    )
    parser.add_argument(
        "--debug-html",
        help="Optional path to save the raw HTML for inspection",
    )

    args = parser.parse_args()

    session = requests.Session()
    html = fetch_html(args.url, session)

    if args.debug_html:
        Path(args.debug_html).write_text(html, encoding="utf-8")

    ranking = None
    if args.ranking_url:
        ranking_html = fetch_html(args.ranking_url, session)
        ranking_urls = parse_ranking_page(ranking_html)
        try:
            ranking = ranking_urls.index(args.url) + 1
        except ValueError:
            match = re.search(r"/sakura/spot/(\\d+)/", args.url)
            if match:
                spot_id = match.group(1)
                for idx, spot_url in enumerate(ranking_urls, start=1):
                    if f"/sakura/spot/{spot_id}/" in spot_url:
                        ranking = idx
                        break

    data = parse_spot(html, args.url, ranking=ranking)
    if args.include_source_url:
        data["source_url"] = args.url

    write_csv(args.out, [data], include_source_url=args.include_source_url)
    print(f"Wrote 1 row to {args.out}")


if __name__ == "__main__":
    main()
