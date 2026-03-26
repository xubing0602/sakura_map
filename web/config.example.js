window.GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";

window.HISTORICAL_DATA_CONFIG = {
  enabled: true,
  prefer: "auto", // auto | json | csv | none
  jsonPath: "data/spots_{date}.json",
  csvPath: "../wn_scraping/output/wn_prefecture_spots_{date}.csv",
  cutoff: "today", // or "YYYY-MM-DD"
  fallbackToForecast: true,
};
