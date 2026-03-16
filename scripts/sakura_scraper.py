import csv
import re
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)
BASE_URL = "https://weathernews.jp"

REGIONS = [
    "hokkaido",
    "tohoku",
    "kanto",
    "chubu",
    "kinki",
    "chugoku",
    "shikoku",
    "kyushu",
]


@dataclass
class AreaConfig:
    slug: str
    ranking_url: str


def fetch_html(url: str, session: requests.Session, timeout: int = 20) -> str:
    resp = session.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout)
    resp.raise_for_status()
    # Weathernews pages are usually UTF-8; apparent_encoding helps if headers are missing.
    if resp.encoding:
        resp.encoding = resp.apparent_encoding or resp.encoding
    return resp.text


def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def _text(el) -> str:
    if not el:
        return ""
    return el.get_text("\n", strip=True)


def _normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_breadcrumb(soup: BeautifulSoup) -> Tuple[str, str, str]:
    crumb = soup.find(class_=re.compile(r"panKuzuList"))
    if not crumb:
        crumb = soup.find("nav", attrs={"aria-label": re.compile(r"breadcrumb", re.I)})

    items: List[str] = []
    if crumb:
        for item in crumb.find_all(class_=re.compile(r"panKuzuList__item")):
            t = _text(item)
            if t:
                items.append(t)
        if not items:
            for li in crumb.find_all("li"):
                t = _text(li)
                if t:
                    items.append(t)

    items = [_normalize_space(t) for t in items if t.strip()]
    area = pref = place = ""
    if len(items) >= 3:
        area, pref, place = items[-3], items[-2], items[-1]
    return area, pref, place


def parse_image(soup: BeautifulSoup) -> str:
    container = soup.find(class_=re.compile(r"spotTop__image"))
    if container and container.name == "img":
        return container.get("src") or container.get("data-src") or ""
    if container:
        img = container.find("img")
        if img:
            return img.get("src") or img.get("data-src") or ""
    img = soup.find("img", class_=re.compile(r"spotTop__image"))
    if img:
        return img.get("src") or img.get("data-src") or ""
    return ""


def parse_tags(soup: BeautifulSoup) -> str:
    tags = []
    for item in soup.find_all(class_=re.compile(r"tagList__item")):
        t = _text(item)
        if t:
            tags.append(t)
    return ", ".join(tags)




def parse_status(soup) -> Tuple[str, str]:
    date_el = soup.select_one(".kaikaStatus__date")
    title_el = soup.select_one(".kaikaStatus__title")
    
    date_text = date_el.get_text(strip=True) if date_el else ""
    title_text = title_el.get_text(strip=True) if title_el else ""
    
    clean_date = date_text.replace("最終取材日：", "")
    clean_title = title_text
    
    return clean_date, clean_title


def parse_kaika_list(soup: BeautifulSoup) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for item in soup.find_all(class_=re.compile(r"kaikaList__item")):
        lines = [line for line in _text(item).split("\n") if line]
        if len(lines) >= 2:
            label = lines[0]
            date = lines[1]
            result[label] = date
    return result


def parse_photo_text(soup: BeautifulSoup) -> str:
    return _text(soup.find(class_=re.compile(r"photoText")))


def parse_spot_info(soup: BeautifulSoup) -> Dict[str, str]:
    info: Dict[str, str] = {}
    container = soup.find(class_=re.compile(r"spotInfoList"))

    def add_pair(key_el, val_el):
        key = _text(key_el)
        val = _text(val_el)
        if val_el:
            for btn in val_el.find_all(class_="button"):
                    btn.decompose() # 彻底从 soup 树中移除该元素
        key = _text(key_el)
        val = _text(val_el)
        if key:
                info[key] = val

    if container:
        items = container.find_all(class_=re.compile(r"spotInfoList__item"))
        if items:
            for item in items:
                key_el = item.find(
                    class_=re.compile(
                        r"spotInfoList__title|spotInfoList__term|spotInfoList__label"
                    )
                )
                val_el = item.find(
                    class_=re.compile(
                        r"spotInfoList__text|spotInfoList__description|spotInfoList__data"
                    )
                )
                if key_el and val_el:
                    add_pair(key_el, val_el)
                else:
                    dts = item.find_all("dt")
                    dds = item.find_all("dd")
                    for dt, dd in zip(dts, dds):
                        add_pair(dt, dd)
        else:
            for dt in container.find_all("dt"):
                dd = dt.find_next_sibling("dd")
                if dd:
                    add_pair(dt, dd)

    return info


# def parse_lat_lon(soup: BeautifulSoup) -> Tuple[str, str]:
#     for a in soup.find_all("a", href=True):
#         href = a["href"]
#         print(f"Checking link for lat/lon: {href}")
#         if "maps.google" not in href:
#             continue
#         match = re.search(r"[?&]q=([0-9.\-]+),([0-9.\-]+)", href)
#         if match:
#             # The page uses lat,lon ordering. The user requested `long` for the first value.
#             return match.group(1), match.group(2)
#     return "", ""


def parse_lat_lon(soup: BeautifulSoup) -> Tuple[str, str]:
    gg_map_el = soup.find("a", id="gg_map", href=True)
    
    if gg_map_el:
        href = gg_map_el["href"] 
        match = re.search(r"[?&]q=([0-9.\-]+),([0-9.\-]+)", href)
        if match:
            # group(1) 是纬度 (Lat), group(2) 是经度 (Lon)
            return match.group(1), match.group(2)
            
    return "", ""

def parse_homepage(soup: BeautifulSoup) -> str:
    # 寻找 id 为 homepage 的链接
    a = soup.find("a", id="homepage", href=True)
    if a:
        return a["href"]

def parse_spot(html: str, url: str, ranking: Optional[int] = None) -> Dict[str, str]:
    soup = _soup(html)
    area, pref, place = parse_breadcrumb(soup)
    img = parse_image(soup)
    tags = parse_tags(soup)
    status_date, status = parse_status(soup)
    kaika = parse_kaika_list(soup)
    photo_text = parse_photo_text(soup)
    lat_val, long_val = parse_lat_lon(soup)
    homepage = parse_homepage(soup)
    info = parse_spot_info(soup)


    data: Dict[str, str] = {
        "area": area,
        "prefecture": pref,
        "place": place,
        "img": img,
        "tag": tags,
        "prefecture_ranking": str(ranking) if ranking is not None else "",
        "status_date": status_date,
        "status": status,
        "見どころ紹介": photo_text,
        "lat": lat_val,
        "long": long_val,
        "homepage": homepage,
    }
    data.update(kaika)
    data.update(info)
    return data


def extract_spot_urls(html: str) -> List[str]:
    # Keep appearance order in HTML.
    urls: List[str] = []
    seen = set()
    for match in re.finditer(r"/sakura/spot/\d+/", html):
        rel = match.group(0)
        abs_url = urljoin(BASE_URL, rel)
        if abs_url not in seen:
            seen.add(abs_url)
            urls.append(abs_url)
    return urls


def parse_ranking_page(html: str) -> List[str]:
    soup = _soup(html)
    urls: List[str] = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/sakura/spot/" not in href:
            continue
        abs_url = urljoin(BASE_URL, href)
        if abs_url not in seen:
            seen.add(abs_url)
            urls.append(abs_url)
    if urls:
        return urls
    # Fallback to regex in case HTML is script-generated.
    return extract_spot_urls(html)


def parse_area_slugs(html: str) -> List[str]:
    soup = _soup(html)
    slugs: List[str] = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        match = re.search(r"/sakura/area/([a-z0-9_-]+)(?:/|$)", href)
        if not match:
            continue
        slug = match.group(1)
        if slug in REGIONS:
            continue
        if href.endswith("/ranking.html") or href.endswith("ranking.html"):
            continue
        if slug not in seen:
            seen.add(slug)
            slugs.append(slug)
    return slugs


def build_area_list(session: requests.Session, regions: Iterable[str]) -> List[AreaConfig]:
    areas: List[AreaConfig] = []
    for region in regions:
        if region == "hokkaido":
            areas.append(
                AreaConfig(
                    slug="hokkaido",
                    ranking_url=f"{BASE_URL}/sakura/area/hokkaido/ranking.html",
                )
            )
            continue
        html = fetch_html(f"{BASE_URL}/sakura/area/{region}/", session)
        for slug in parse_area_slugs(html):
            areas.append(
                AreaConfig(
                    slug=slug,
                    ranking_url=f"{BASE_URL}/sakura/area/{slug}/ranking.html",
                )
            )
    return areas


def write_csv(path: str, rows: List[Dict[str, str]], include_source_url: bool = False) -> None:
    base_fields = [
        "area",
        "prefecture",
        "place",
        "img",
        "tag",
        "prefecture_ranking",
        "status_date",
        "status",
        "開花予想日",
        "五分咲き",
        "満開",
        "桜吹雪",
        "見どころ紹介",
        "lat",
        "long",
        "homepage"
    ]
    if include_source_url and "source_url" not in base_fields:
        base_fields.append("source_url")

    extra_fields: List[str] = []
    seen = set(base_fields)
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                extra_fields.append(key)

    fields = base_fields + extra_fields
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=fields, extrasaction="ignore", quoting=csv.QUOTE_ALL
        )
        writer.writeheader()
        for row in rows:
            out_row = {key: row.get(key, "") for key in fields}
            writer.writerow(out_row)


def polite_sleep(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)
