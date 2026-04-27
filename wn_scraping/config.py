BASE_URL = "https://weathernews.jp"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)

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

# On or after this (month, day) the scraper skips updating spots.json / previous.json,
# since the sakura season is over and we don't want to overwrite the demo snapshot.
SEASON_END = (5, 6)  # May 6
