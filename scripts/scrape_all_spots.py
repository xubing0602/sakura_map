import argparse
from typing import List

import requests

from sakura_scraper import (
    REGIONS,
    build_area_list,
    extract_spot_urls,
    fetch_html,
    parse_ranking_page,
    parse_spot,
    polite_sleep,
    write_csv,
)


def parse_list_arg(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape all sakura spots into CSV.")
    parser.add_argument(
        "--regions",
        default="",
        help=(
            "Comma-separated big regions (hokkaido,tohoku,kanto,chubu,kinki,chugoku,shikoku,kyushu). "
            "If omitted, all regions are used."
        ),
    )
    parser.add_argument(
        "--areas",
        default="",
        help=(
            "Comma-separated small area slugs (e.g. tokyo,shiga). "
            "If provided, discovery from regions is skipped. "
            "Use 'hokkaido' here for the special Hokkaido ranking page."
        ),
    )
    parser.add_argument(
        "--top",
        type=int,
        default=20,
        help="Max spots per ranking page (default: 20)",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=1.0,
        help="Seconds to sleep between requests (default: 1.0)",
    )
    parser.add_argument(
        "--out",
        default="spots.csv",
        help="CSV output path (default: spots.csv)",
    )
    parser.add_argument(
        "--include-source-url",
        action="store_true",
        help="Include source_url column for traceability",
    )

    args = parser.parse_args()

    session = requests.Session()

    areas = parse_list_arg(args.areas) if args.areas else []
    if areas:
        area_list = []
        for slug in areas:
            if slug == "hokkaido":
                area_list.append(
                    {
                        "slug": "hokkaido",
                        "ranking_url": "https://weathernews.jp/sakura/area/hokkaido/ranking.html",
                    }
                )
            else:
                area_list.append(
                    {
                        "slug": slug,
                        "ranking_url": f"https://weathernews.jp/sakura/area/{slug}/ranking.html",
                    }
                )
    else:
        regions = parse_list_arg(args.regions) if args.regions else REGIONS
        if not regions:
            regions = REGIONS
        area_list = [area.__dict__ for area in build_area_list(session, regions)]

    rows = []
    for area in area_list:
        ranking_html = fetch_html(area["ranking_url"], session)
        ranking_urls = parse_ranking_page(ranking_html)
        if not ranking_urls:
            ranking_urls = extract_spot_urls(ranking_html)
        if args.top > 0:
            ranking_urls = ranking_urls[: args.top]

        for idx, spot_url in enumerate(ranking_urls, start=1):
            html = fetch_html(spot_url, session)
            data = parse_spot(html, spot_url, ranking=idx)
            if args.include_source_url:
                data["source_url"] = spot_url
            rows.append(data)
            polite_sleep(args.sleep)

    write_csv(args.out, rows, include_source_url=args.include_source_url)
    print(f"Wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
