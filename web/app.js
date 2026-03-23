const DATA_URL = "data/spots.json";
const PREVIOUS_DATA_URL = "data/previous.json";
const ICON_PATH = "status_icon/";
const DEFAULT_CENTER = { lat: 36.5, lng: 138.0 };
const FORECAST_START = { month: 3, day: 17 };
const FORECAST_END = { month: 5, day: 24 };
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_ICON_MAP = {
  "つぼみ": "含苞.svg",
  "ピンクのつぼみ": "粉色花苞.svg",
  "開花(5,6輪)": "开花_五六轮.svg",
  "ちらほら咲いた(1分咲き)": "初开_一分.svg",
  "結構咲いた(3分咲き)": "开花_三分.svg",
  "満開間近(5分咲き)": "近满开_五分.svg",
  "満開(8分咲き)": "满开_八分.svg",
  "散り始め": "凋落初期.svg",
  "葉桜": "叶樱.svg",
  "情報なし": "信息缺失.svg",
};

const STATUS_LABELS = {
  "つぼみ": "含苞",
  "ピンクのつぼみ": "粉色花苞",
  "開花(5,6輪)": "开花（5-6朵）",
  "ちらほら咲いた(1分咲き)": "初开（约1成）",
  "結構咲いた(3分咲き)": "开花（约3成）",
  "満開間近(5分咲き)": "近满开（约5成）",
  "満開(8分咲き)": "满开（约8成）",
  "散り始め": "开始凋落",
  "葉桜": "叶樱",
  "情報なし": "信息缺失",
};

const FORECAST_STATUS_LIST = [
  "つぼみ",
  "開花(5,6輪)",
  "満開間近(5分咲き)",
  "満開(8分咲き)",
  "散り始め",
  "葉桜",
  "情報なし",
];

const state = {
  data: [],
  map: null,
  infoWindow: null,
  infoItem: null,
  markers: [],
  mode: "current",
  forecast: {
    year: new Date().getFullYear(),
    dates: [],
    index: 0,
    startDate: null,
    endDate: null,
  },
  filters: {
    areas: new Set(),
    prefectures: new Set(),
    statuses: new Set(),
    tags: new Set(),
    rankingMax: 20,
    search: "",
  },
  previousData: null,
};

const filterCountEls = {
  statuses: new Map(),
  tags: new Map(),
};

function normalizeStatus(status) {
  return (status || "情報なし").trim().normalize("NFKC");
}

function buildIconUrl(status) {
  const key = normalizeStatus(status);
  const file = STATUS_ICON_MAP[key] || STATUS_ICON_MAP["情報なし"];
  return `${ICON_PATH}${file}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function createDate(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0);
}

function parseJpMonthDay(value, year) {
  if (!value) return null;
  const match = String(value).match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return createDate(year, month, day);
}

function buildForecastDates(year) {
  const startDate = createDate(year, FORECAST_START.month, FORECAST_START.day);
  const endDate = createDate(year, FORECAST_END.month, FORECAST_END.day);
  const dates = [];
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += DAY_MS) {
    dates.push(new Date(t));
  }
  return { dates, startDate, endDate };
}

function formatMonthDay(date) {
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function isBefore(a, b) {
  return a.getTime() < b.getTime();
}

function isAfter(a, b) {
  return a.getTime() > b.getTime();
}

function createCheckbox(container, label, value, onChange, checked = false) {
  const wrapper = document.createElement("label");
  wrapper.className = "filter-item";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = value;
  input.checked = checked;
  input.addEventListener("change", () => onChange(input));
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(input, text);
  container.appendChild(wrapper);
}

function createStatusCheckbox(container, status, onChange) {
  const wrapper = document.createElement("label");
  wrapper.className = "filter-item";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = status;
  input.addEventListener("change", () => onChange(input));
  const icon = document.createElement("img");
  icon.src = buildIconUrl(status);
  icon.alt = status;
  icon.width = 22;
  icon.height = 22;
  icon.loading = "lazy";
  icon.style.borderRadius = "6px";
  const text = document.createElement("span");
  const zh = STATUS_LABELS[status] ? ` - ${STATUS_LABELS[status]}` : "";
  text.textContent = `${status}${zh}`;
  const count = document.createElement("span");
  count.className = "filter-count";
  count.textContent = "(0)";
  filterCountEls.statuses.set(status, count);
  wrapper.append(input, icon, text, count);
  container.appendChild(wrapper);
}

function createTagCheckbox(container, tag, onChange) {
  const wrapper = document.createElement("label");
  wrapper.className = "filter-item";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = tag;
  input.addEventListener("change", () => onChange(input));
  const text = document.createElement("span");
  text.textContent = tag;
  const count = document.createElement("span");
  count.className = "filter-count";
  count.textContent = "(0)";
  filterCountEls.tags.set(tag, count);
  wrapper.append(input, text, count);
  container.appendChild(wrapper);
}

function getDateDiff(current, previous, year) {
  if (!current || !previous) return null;
  const currDate = parseJpMonthDay(current, year);
  const prevDate = parseJpMonthDay(previous, year);
  if (!currDate || !prevDate) return null;
  const diffMs = currDate.getTime() - prevDate.getTime();
  const diffDays = Math.round(diffMs / DAY_MS);
  if (diffDays === 0) return 0;
  return diffDays;
}

function findPrevItem(currentItem) {
  if (!state.previousData) return null;
  return state.previousData.find((p) => p.place === currentItem.place) || null;
}

const AREA_ORDER = [
  "北海道",
  "東北",
  "関東",
  "中部",
  "近畿",
  "中国",
  "四国",
  "九州",
];

const PREFECTURE_ORDER = [
  "道央",
  "道南",
  "道北",
  "道東",
  "北海道",
  "青森",
  "岩手",
  "宮城",
  "秋田",
  "山形",
  "福島",
  "茨城",
  "栃木",
  "群馬",
  "埼玉",
  "千葉",
  "東京",
  "神奈川",
  "新潟",
  "富山",
  "石川",
  "福井",
  "山梨",
  "長野",
  "岐阜",
  "静岡",
  "愛知",
  "三重",
  "滋賀",
  "京都",
  "大阪",
  "兵庫",
  "奈良",
  "和歌山",
  "鳥取",
  "島根",
  "岡山",
  "広島",
  "山口",
  "徳島",
  "香川",
  "愛媛",
  "高知",
  "福岡",
  "佐賀",
  "長崎",
  "熊本",
  "大分",
  "宮崎",
  "鹿児島",
  "沖縄",
];

const STATUS_ORDER = [
  "つぼみ",
  "ピンクのつぼみ",
  "開花(5,6輪)",
  "ちらほら咲いた(1分咲き)",
  "結構咲いた(3分咲き)",
  "満開間近(5分咲き)",
  "満開(8分咲き)",
  "散り始め",
  "葉桜",
  "情報なし",
];

function sortByOrder(values, order) {
  const index = new Map(order.map((v, i) => [v, i]));
  return values.slice().sort((a, b) => {
    const ai = index.has(a) ? index.get(a) : 999;
    const bi = index.has(b) ? index.get(b) : 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b, "ja");
  });
}

function initForecast() {
  const { dates, startDate, endDate } = buildForecastDates(state.forecast.year);
  state.forecast.dates = dates;
  state.forecast.startDate = startDate;
  state.forecast.endDate = endDate;

  const now = new Date();
  const today = createDate(state.forecast.year, now.getMonth() + 1, now.getDate());

  if (today <= startDate) {
    state.forecast.index = 0;
  } else if (today >= endDate) {
    state.forecast.index = dates.length - 1;
  } else {
    // Find the closest date index to today
    let bestIndex = 0;
    let bestDiff = Infinity;
    dates.forEach((date, i) => {
      const diff = Math.abs(date.getTime() - today.getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = i;
      }
    });
    state.forecast.index = bestIndex;
  }
}

function getForecastStatus(item, date) {
  const year = state.forecast.year;
  const open = parseJpMonthDay(item["開花予想日"], year);
  const half = parseJpMonthDay(item["五分咲き"], year);
  const full = parseJpMonthDay(item["満開"], year);
  const shower = parseJpMonthDay(item["桜吹雪"], year);

  if (!open && !half && !full && !shower) return "情報なし";

  const start = state.forecast.startDate;
  const openStart = open || (half || full || shower ? start : null);
  const halfStart = half || (full || shower ? (openStart || start) : null);
  const fullStart = full || (shower ? (halfStart || openStart || start) : null);

  if (openStart && isBefore(date, openStart)) return "つぼみ";
  if (halfStart && isBefore(date, halfStart)) return "開花(5,6輪)";
  if (fullStart && isBefore(date, fullStart)) return "満開間近(5分咲き)";

  if (shower) {
    if (isBefore(date, shower)) return "満開(8分咲き)";
    const showerEnd = addDays(shower, 6);
    if (!isAfter(date, showerEnd)) return "散り始め";
    return "葉桜";
  }

  if (fullStart) return "満開(8分咲き)";
  if (halfStart) return "満開間近(5分咲き)";
  return "開花(5,6輪)";
}

function getDisplayStatus(item) {
  if (state.mode === "forecast") {
    const date = state.forecast.dates[state.forecast.index];
    if (date) return getForecastStatus(item, date);
  }
  return item.status || "情報なし";
}

function uniqueSorted(values) {
  const set = new Set(values.filter((v) => v));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
}

function buildFilters(data) {
  const areaFilters = document.getElementById("areaFilters");
  const prefectureFilters = document.getElementById("prefectureFilters");
  const statusFilters = document.getElementById("statusFilters");
  const tagFilters = document.getElementById("tagFilters");

  const areas = sortByOrder(uniqueSorted(data.map((d) => d.area)), AREA_ORDER);
  const prefectures = sortByOrder(
    uniqueSorted(data.map((d) => d.prefecture)),
    PREFECTURE_ORDER
  );
  const statuses = sortByOrder(
    uniqueSorted(
      data
        .map((d) => d.status || "情報なし")
        .concat(FORECAST_STATUS_LIST)
    ),
    STATUS_ORDER
  );
  const tags = uniqueSorted(
    data.flatMap((d) => (d.tag_list && d.tag_list.length ? d.tag_list : []))
  );

  areas.forEach((area) =>
    createCheckbox(areaFilters, area, area, (input) => {
      toggleFilterSet(state.filters.areas, input);
    })
  );

  prefectures.forEach((pref) =>
    createCheckbox(prefectureFilters, pref, pref, (input) => {
      toggleFilterSet(state.filters.prefectures, input);
    })
  );

  statuses.forEach((status) =>
    createStatusCheckbox(statusFilters, status, (input) => {
      toggleFilterSet(state.filters.statuses, input);
    })
  );

  tags.forEach((tag) =>
    createTagCheckbox(tagFilters, tag, (input) => {
      toggleFilterSet(state.filters.tags, input);
    })
  );
}

function toggleFilterSet(set, input) {
  if (input.checked) {
    set.add(input.value);
  } else {
    set.delete(input.value);
  }
  applyFilters();
}

function toNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function matchesFilters(item) {
  const { areas, prefectures, statuses, tags, rankingMax, search } = state.filters;

  if (areas.size && !areas.has(item.area)) return false;
  if (prefectures.size && !prefectures.has(item.prefecture)) return false;

  const statusValue = getDisplayStatus(item);
  if (statuses.size && !statuses.has(statusValue)) return false;

  if (tags.size) {
    const tagSet = new Set(item.tag_list || []);
    const hasAny = Array.from(tags).some((tag) => tagSet.has(tag));
    if (!hasAny) return false;
  }

  const rank = parseInt(item.prefecture_ranking || "", 10);
  const rankOk = Number.isFinite(rank) ? rank <= rankingMax : rankingMax === 20;
  if (!rankOk) return false;

  if (search) {
    const term = search.toLowerCase();
    const hay = `${item.place || ""}${item.prefecture || ""}${item.area || ""}`.toLowerCase();
    if (!hay.includes(term)) return false;
  }

  return true;
}

function matchesFiltersExcept(item, exclude) {
  const { areas, prefectures, statuses, tags, rankingMax, search } = state.filters;

  if (areas.size && !areas.has(item.area)) return false;
  if (prefectures.size && !prefectures.has(item.prefecture)) return false;

  if (exclude !== "status") {
    const statusValue = getDisplayStatus(item);
    if (statuses.size && !statuses.has(statusValue)) return false;
  }

  if (exclude !== "tag") {
    if (tags.size) {
      const tagSet = new Set(item.tag_list || []);
      const hasAny = Array.from(tags).some((tag) => tagSet.has(tag));
      if (!hasAny) return false;
    }
  }

  const rank = parseInt(item.prefecture_ranking || "", 10);
  const rankOk = Number.isFinite(rank) ? rank <= rankingMax : rankingMax === 20;
  if (!rankOk) return false;

  if (search) {
    const term = search.toLowerCase();
    const hay = `${item.place || ""}${item.prefecture || ""}${item.area || ""}`.toLowerCase();
    if (!hay.includes(term)) return false;
  }

  return true;
}

function applyFilters() {
  const filtered = state.data.filter(matchesFilters);

  let visibleCount = 0;
  state.markers.forEach(({ marker, item }) => {
    const show = filtered.includes(item);
    marker.setMap(show ? state.map : null);
    if (show) visibleCount += 1;
  });

  const countEl = document.getElementById("resultCount");
  countEl.textContent = visibleCount;

  updateFilterCounts();
}

function updateFilterCounts() {
  if (!state.data.length) return;

  const statusCounts = new Map();
  const tagCounts = new Map();

  state.data.forEach((item) => {
    if (matchesFiltersExcept(item, "status")) {
      const statusValue = getDisplayStatus(item);
      statusCounts.set(statusValue, (statusCounts.get(statusValue) || 0) + 1);
    }

    if (matchesFiltersExcept(item, "tag")) {
      (item.tag_list || []).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    }
  });

  filterCountEls.statuses.forEach((el, status) => {
    el.textContent = `(${statusCounts.get(status) || 0})`;
  });

  filterCountEls.tags.forEach((el, tag) => {
    el.textContent = `(${tagCounts.get(tag) || 0})`;
  });
}

function updateMarkerIcons() {
  state.markers.forEach(({ marker, item }) => {
    const status = getDisplayStatus(item);
    marker.setIcon({
      url: buildIconUrl(status),
      scaledSize: new google.maps.Size(34, 34),
    });
  });
}

function updateLegend() {
  const label = document.getElementById("legendLabel");
  if (!label) return;
  if (state.mode === "forecast") {
    const date = state.forecast.dates[state.forecast.index];
    label.textContent = date
      ? `予想日 ${formatMonthDay(date)} の状況`
      : "予想アイコン表示";
  } else {
    label.textContent = "ステータス別アイコン表示";
  }
}

function updateInfoWindow() {
  if (!state.infoWindow || !state.infoItem) return;
  if (!state.infoWindow.getMap()) return;
  state.infoWindow.setContent(buildInfoContent(state.infoItem));
}

function updateTabButtons() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function updateForecastUI() {
  const controls = document.getElementById("forecastControls");
  const range = document.getElementById("forecastRange");
  const dateLabel = document.getElementById("forecastDateLabel");
  const startLabel = document.getElementById("forecastStartLabel");
  const endLabel = document.getElementById("forecastEndLabel");
  if (!controls || !range || !dateLabel || !startLabel || !endLabel) return;

  const isForecast = state.mode === "forecast";
  controls.classList.toggle("is-hidden", !isForecast);
  controls.setAttribute("aria-hidden", String(!isForecast));

  const date = state.forecast.dates[state.forecast.index];
  if (date) {
    dateLabel.textContent = formatMonthDay(date);
  }
  range.value = String(state.forecast.index);
  startLabel.textContent = formatMonthDay(state.forecast.startDate);
  endLabel.textContent = formatMonthDay(state.forecast.endDate);
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  updateTabButtons();
  updateForecastUI();
  updateMarkerIcons();
  applyFilters();
  updateLegend();
  updateInfoWindow();
}

function buildInfoContent(item) {
  const escape = (text) =>
    (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const line = (label, value) => {
    if (!value) return "";
    return `<div class="info-section"><strong>${label}</strong><div>${escape(value).replace(/\n/g, "<br>")}</div></div>`;
  };
  const dateLine = (label, value, prevValue) => {
    if (!value) return "";
    const diff = prevValue ? getDateDiff(value, prevValue, state.forecast.year) : null;
    const diffStr = diff !== null ? ` (${diff > 0 ? '+' : ''}${diff} 日)` : '';
    return `<div class="info-section"><strong>${label}</strong><div>${escape(value)}${diffStr}</div></div>`;
  };
  const displayStatus = getDisplayStatus(item);
  const forecastDate =
    state.mode === "forecast" ? state.forecast.dates[state.forecast.index] : null;
  const meta =
    state.mode === "forecast"
      ? `予想ステータス ${escape(displayStatus)} ｜ ${
          forecastDate ? formatMonthDay(forecastDate) : "-"
        }`
      : `${escape(item.status || "情報なし")} ｜ 最終取材日 ${escape(item.status_date || "-")}`;

  const prevItem = findPrevItem(item);

  return `
    <div class="info-card">
      ${item.img ? `<img src="${item.img}" alt="${escape(item.place)}" />` : ""}
      <div class="info-title">${escape(item.place || "")}</div>
      <div class="info-meta">${meta}</div>
      ${dateLine("開花予想日", item["開花予想日"], prevItem ? prevItem["開花予想日"] : null)}
      ${dateLine("五分咲き", item["五分咲き"], prevItem ? prevItem["五分咲き"] : null)}
      ${dateLine("満開", item["満開"], prevItem ? prevItem["満開"] : null)}
      ${dateLine("桜吹雪", item["桜吹雪"], prevItem ? prevItem["桜吹雪"] : null)}
      ${line("例年の見頃", item["例年の見頃"])}
      ${line("県内ランキング", item["prefecture_ranking"])}
      ${line("桜の種類", item["桜の種類"])}
      ${line("桜の本数", item["桜の本数"])}
      ${line("見どころ紹介", item["見どころ紹介"])}
      ${line("桜まつり詳細", item["桜まつり詳細"])}
      ${line("ライトアップ", item["ライトアップ"])}
      ${line("お花見期間中の混雑度", item["お花見期間中の混雑度"])}
      ${line("おすすめ写真スポット", item["おすすめ写真スポット"])}
      ${line("所在地", item["所在地"])}
      ${line("入場時間", item["入場時間"])}
      ${line("入場料", item["入場料"])}
      ${line("お問い合わせ", item["お問い合わせ"])}
      ${item.homepage ? `<div class="info-section"><strong>ホームページ</strong><div><a href="${item.homepage}" target="_blank" rel="noopener">${item.homepage}</a></div></div>` : ""}
      ${line("交通案内", item["交通案内"])}
      ${line("周辺の観光施設", item["周辺の観光施設"])}
    </div>
  `;
}

async function loadData() {
  const currentRes = await fetch(DATA_URL);
  const currentData = await currentRes.json();
  state.data = currentData.filter((item) => {
    const lat = toNumber(item.lat);
    const lng = toNumber(item.long);
    return lat !== null && lng !== null;
  });

  // Try to load previous data
  try {
    const previousRes = await fetch(PREVIOUS_DATA_URL);
    const previousData = await previousRes.json();
    state.previousData = previousData;
  } catch {
    state.previousData = null;
  }

  buildFilters(state.data);
  return state.data;
}

function initMap() {
  state.map = new google.maps.Map(document.getElementById("map"), {
    center: DEFAULT_CENTER,
    zoom: 5,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#20243a" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#0b0d15" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#9fa8c3" }] },
      // { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#394061" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#151823" }] },
    ],
  });

  state.infoWindow = new google.maps.InfoWindow();

  state.markers = state.data.map((item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.long);
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: state.map,
      icon: {
        url: buildIconUrl(getDisplayStatus(item)),
        scaledSize: new google.maps.Size(34, 34),
      },
      title: item.place || "",
    });

    marker.addListener("click", () => {
      state.infoItem = item;
      state.infoWindow.setContent(buildInfoContent(item));
      state.infoWindow.open({ map: state.map, anchor: marker });
    });

    return { marker, item };
  });

  applyFilters();
}

function setupUI() {
  initForecast();

  const rankingRange = document.getElementById("rankingRange");
  const rankingValue = document.getElementById("rankingValue");
  const searchBox = document.getElementById("searchBox");
  const toggleSidebar = document.getElementById("toggleSidebar");
  const sidebar = document.getElementById("sidebar");
  const forecastRange = document.getElementById("forecastRange");
  const resetFilters = document.getElementById("resetFilters");

  rankingRange.addEventListener("input", () => {
    const value = parseInt(rankingRange.value, 10);
    state.filters.rankingMax = value;
    rankingValue.textContent = `≤ ${value}`;
    applyFilters();
  });

  searchBox.addEventListener("input", () => {
    state.filters.search = searchBox.value.trim();
    applyFilters();
  });

  const showSidebar = document.getElementById("showSidebar");
  const app = document.getElementById("app");

  toggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    app.classList.toggle("sidebar-hidden", !sidebar.classList.contains("open"));
  });

  showSidebar.addEventListener("click", () => {
    sidebar.classList.add("open");
    app.classList.remove("sidebar-hidden");
  });

  if (resetFilters) {
    resetFilters.addEventListener("click", () => {
      state.filters.areas.clear();
      state.filters.prefectures.clear();
      state.filters.statuses.clear();
      state.filters.tags.clear();
      state.filters.rankingMax = 20;
      state.filters.search = "";

      document
        .querySelectorAll(
          "#areaFilters input[type='checkbox'], #prefectureFilters input[type='checkbox'], #statusFilters input[type='checkbox'], #tagFilters input[type='checkbox']"
        )
        .forEach((input) => {
          input.checked = false;
        });

      if (searchBox) searchBox.value = "";
      if (rankingRange) rankingRange.value = "20";
      if (rankingValue) rankingValue.textContent = "≤ 20";

      applyFilters();
    });
  }

  if (forecastRange) {
    forecastRange.max = String(Math.max(state.forecast.dates.length - 1, 0));
    forecastRange.value = "0";
    forecastRange.addEventListener("input", () => {
      const value = parseInt(forecastRange.value, 10);
      state.forecast.index = Number.isFinite(value) ? value : 0;
      updateForecastUI();
      updateMarkerIcons();
      applyFilters();
      updateLegend();
      updateInfoWindow();
    });
  }

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      setMode(button.dataset.mode || "current");
    });
  });

  updateTabButtons();
  updateForecastUI();
  updateLegend();
}

function loadGoogleMaps() {
  const apiKey = window.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY") {
    alert("Google Maps API key is missing. Please set it in web/config.js");
    return;
  }
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=onGoogleMapsLoaded`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

window.onGoogleMapsLoaded = () => {
  initMap();
};

(async function boot() {
  setupUI();
  await loadData();
  loadGoogleMaps();
})();
