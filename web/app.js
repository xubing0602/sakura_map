const DATA_URL = "data/spots.json";
const ICON_PATH = "status_icon/";
const DEFAULT_CENTER = { lat: 36.5, lng: 138.0 };

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

const state = {
  data: [],
  map: null,
  infoWindow: null,
  markers: [],
  filters: {
    areas: new Set(),
    prefectures: new Set(),
    statuses: new Set(),
    tags: new Set(),
    rankingMax: 20,
    search: "",
  },
};

function normalizeStatus(status) {
  return (status || "情報なし").trim().normalize("NFKC");
}

function buildIconUrl(status) {
  const key = normalizeStatus(status);
  const file = STATUS_ICON_MAP[key] || STATUS_ICON_MAP["情報なし"];
  return `${ICON_PATH}${file}`;
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
  wrapper.append(input, icon, text);
  container.appendChild(wrapper);
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

  const areas = uniqueSorted(data.map((d) => d.area));
  const prefectures = uniqueSorted(data.map((d) => d.prefecture));
  const statuses = uniqueSorted(data.map((d) => d.status || "情報なし"));
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
    createCheckbox(tagFilters, tag, tag, (input) => {
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

  const statusValue = item.status || "情報なし";
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
}

function buildInfoContent(item) {
  const escape = (text) =>
    (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const line = (label, value) => {
    if (!value) return "";
    return `<div class="info-section"><strong>${label}</strong><div>${escape(value).replace(/\n/g, "<br>")}</div></div>`;
  };

  return `
    <div class="info-card">
      ${item.img ? `<img src="${item.img}" alt="${escape(item.place)}" />` : ""}
      <div class="info-title">${escape(item.place || "")}</div>
      <div class="info-meta">${escape(item.status || "情報なし")} ｜ 最終取材日 ${escape(item.status_date || "-")}</div>
      ${line("開花予想日", item["開花予想日"])}
      ${line("五分咲き", item["五分咲き"])}
      ${line("満開", item["満開"])}
      ${line("桜吹雪", item["桜吹雪"])}
      ${line("例年の見頃", item["例年の見頃"])}
      ${line("WN県内ランキング", item["prefecture_ranking"])}
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
  const res = await fetch(DATA_URL);
  const data = await res.json();
  state.data = data.filter((item) => {
    const lat = toNumber(item.lat);
    const lng = toNumber(item.long);
    return lat !== null && lng !== null;
  });
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
        url: buildIconUrl(item.status),
        scaledSize: new google.maps.Size(34, 34),
      },
      title: item.place || "",
    });

    marker.addListener("click", () => {
      state.infoWindow.setContent(buildInfoContent(item));
      state.infoWindow.open({ map: state.map, anchor: marker });
    });

    return { marker, item };
  });

  applyFilters();
}

function setupUI() {
  const rankingRange = document.getElementById("rankingRange");
  const rankingValue = document.getElementById("rankingValue");
  const searchBox = document.getElementById("searchBox");
  const toggleSidebar = document.getElementById("toggleSidebar");
  const sidebar = document.getElementById("sidebar");

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

  toggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
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
