import argparse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Set, Tuple

import requests

from sakura_scraper import (
    REGIONS,
    build_area_list,
    extract_spot_urls,
    fetch_html,
    parse_ranking_page,
    parse_spot,
    write_csv,
)


def parse_list_arg(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def load_checkpoint(path: Path) -> Tuple[Set[str], List[Dict[str, str]]]:
    if not path.exists():
        return set(), []
    processed: Set[str] = set()
    rows: List[Dict[str, str]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            url = entry.get("source_url")
            if url:
                processed.add(url)
            row = entry.get("row")
            if isinstance(row, dict):
                rows.append(row)
    return processed, rows


def append_checkpoint(path: Path, source_url: str, row: Dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        payload = {"source_url": source_url, "row": row}
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


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
    parser.add_argument(
        "--checkpoint",
        default="",
        help="Path to JSONL checkpoint file (default: <out>.jsonl)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from checkpoint and skip already scraped spots",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Number of concurrent workers (default: 4)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=20,
        help="HTTP timeout seconds per request (default: 20)",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=3,
        help="Max retries per request (default: 3)",
    )
    parser.add_argument(
        "--backoff",
        type=float,
        default=1.5,
        help="Backoff seconds multiplier between retries (default: 1.5)",
    )
    parser.add_argument(
        "--no-proxy",
        action="store_true",
        help="Ignore proxy env vars (useful if proxy is flaky)",
    )

    args = parser.parse_args()

    session = requests.Session()
    if args.no_proxy:
        session.trust_env = False

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

    rows: List[Dict[str, str]] = []
    checkpoint_path = Path(args.checkpoint) if args.checkpoint else Path(args.out + ".jsonl")
    processed_urls: Set[str] = set()
    if args.resume:
        processed_urls, rows = load_checkpoint(checkpoint_path)

    def fetch_and_parse(spot_url: str, ranking: int) -> Tuple[str, Dict[str, str]]:
        worker_session = requests.Session()
        if args.no_proxy:
            worker_session.trust_env = False
        if args.sleep > 0:
            # Simple pacing per worker.
            import time

            time.sleep(args.sleep)
        html = fetch_html(
            spot_url,
            worker_session,
            timeout=args.timeout,
            max_retries=args.retries,
            backoff=args.backoff,
        )
        data = parse_spot(html, spot_url, ranking=ranking)
        if args.include_source_url:
            data["source_url"] = spot_url
        return spot_url, data

    for area in area_list:
        ranking_html = fetch_html(
            area["ranking_url"],
            session,
            timeout=args.timeout,
            max_retries=args.retries,
            backoff=args.backoff,
        )
        ranking_urls = parse_ranking_page(ranking_html)
        if not ranking_urls:
            ranking_urls = extract_spot_urls(ranking_html)
        if args.top > 0:
            ranking_urls = ranking_urls[: args.top]

        tasks: List[Tuple[int, str]] = []
        for idx, spot_url in enumerate(ranking_urls, start=1):
            if spot_url in processed_urls:
                continue
            tasks.append((idx, spot_url))

        if not tasks:
            continue

        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            future_to_meta = {
                executor.submit(fetch_and_parse, spot_url, idx): (idx, spot_url)
                for idx, spot_url in tasks
            }
            for future in as_completed(future_to_meta):
                idx, spot_url = future_to_meta[future]
                try:
                    url, data = future.result()
                except Exception as exc:
                    print(f"Failed to fetch {spot_url}: {exc}")
                    continue
                rows.append(data)
                processed_urls.add(url)
                append_checkpoint(checkpoint_path, url, data)

    if not args.include_source_url:
        for row in rows:
            row.pop("source_url", None)
    write_csv(args.out, rows, include_source_url=args.include_source_url)
    print(f"Wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
