window.GOOGLE_MAPS_API_KEY = "AIzaSyAaFVpZPOA89d58t7aKdjlaM6qTKHynx_c";

window.HISTORICAL_DATA_CONFIG = {
  enabled: true,
  prefer: "auto",
  jsonPath: "data/spots_{date}.json",
  csvPath: "../wn_scraping/output/wn_prefecture_spots_{date}.csv",
  cutoff: "today",
  fallbackToForecast: true,
};
