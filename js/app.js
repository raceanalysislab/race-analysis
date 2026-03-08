/* js/app.js（完全置き換え：軽量安定版 / ローカルJSON優先 / data/site/venues.jsonは読まない / JST日付切替対応 / 3秒後切替 / 締切5分前は時間だけ赤表示 / PRO対応） */

const SITE_VENUES_URLS = [
  "./data/today.json",
  "./data/venues_today.json"
];

const NOTE_URLS = {
  YOSO_ONLY: "https://note.com/wsnndboat7/n/n1fdca8b0a7e3",
  PRO_ONLY: "https://note.com/wsnndboat7/n/n8d805a4f27bf",
  SET: "https://note.com/wsnndboat7/n/n6fcdb2a9db4f",
};

const VENUES = [
  { jcd: "01", name: "桐生" }, { jcd: "02", name: "戸田" }, { jcd: "03", name: "江戸川" }, { jcd: "04", name: "平和島" },
  { jcd: "05", name: "多摩川" }, { jcd: "06", name: "浜名湖" }, { jcd: "07", name: "蒲郡" }, { jcd: "08", name: "常滑" },
  { jcd: "09", name: "津" }, { jcd: "10", name: "三国" }, { jcd: "11", name: "びわこ" }, { jcd: "12", name: "住之江" },
  { jcd: "13", name: "尼崎" }, { jcd: "14", name: "鳴門" }, { jcd: "15", name: "丸亀" }, { jcd: "16", name: "児島" },
  { jcd: "17", name: "宮島" }, { jcd: "18", name: "徳山" }, { jcd: "19", name: "下関" }, { jcd: "20", name: "若松" },
  { jcd: "21", name: "芦屋" }, { jcd: "22", name: "福岡" }, { jcd: "23", name: "唐津" }, { jcd: "24", name: "大村" }
];

/* ===== PRO設定 ===== */
const PRO_PASSWORD = "pro123";
const PRO_STORAGE_KEY = "boatlab_pro_mode";

/* 締切超過後に次レースへ切り替える秒数 */
const NEXT_RACE_DELAY_MS = 3000;
/* 締切5分前 */
const DANGER_MS = 5 * 60 * 1000;
/* 通信タイムアウト */
const FETCH_TIMEOUT_MS = 8000;
/* JSON再取得間隔 */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/* 表示再計算間隔 */
const RERENDER_INTERVAL_MS = 5000;

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");
const $picks = document.getElementById("picks");
const $picksUpdatedAt = document.getElementById("picksUpdatedAt");
const $picksCta = document.getElementById("picksCta");

const $btnPro =
  document.getElementById("btnPro") ||
  document.getElementById("proBtn") ||
  document.querySelector("[data-role='pro-toggle']") ||
  document.querySelector(".top__pro") ||
  document.querySelector(".btnPro");

const pad2 = (n) => String(n).padStart(2, "0");

let isLoading = false;
let latestVenueList = [];
let latestSourceDate = "";
let currentJstDate = "";
let lastLoadedAt = 0;

/* ===================== 時刻系 ===================== */

function nowJSTParts() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const get = (t) => parts.find((p) => p.type === t)?.value;

  return {
    yyyy: Number(get("year")),
    mo: Number(get("month")),
    dd: Number(get("day")),
    hh: Number(get("hour")),
    mm: Number(get("minute")),
    ss: Number(get("second"))
  };
}

function nowJST() {
  const { hh, mm } = nowJSTParts();
  return { hh, mm };
}

function todayJSTString() {
  const { yyyy, mo, dd } = nowJSTParts();
  return `${yyyy}-${pad2(mo)}-${pad2(dd)}`;
}

/* ===================== 共通 ===================== */

function normalizeVenueName(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function buildNoCacheUrl(url) {
  return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(buildNoCacheUrl(url), {
      cache: "no-store",
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`fetch fail: ${res.status}`);
    }

    return await res.json();
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(`fetch timeout: ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJSONWithFallback(urls) {
  let lastError = null;

  for (const url of urls) {
    try {
      return await fetchJSON(url);
    } catch (e) {
      console.warn("fetch failed:", url, e);
      lastError = e;
    }
  }

  throw lastError || new Error("venue data fetch failed");
}

function venueHref(v) {
  return `./race.html?jcd=${encodeURIComponent(v.jcd)}&name=${encodeURIComponent(v.name)}`;
}

function findVenueBase(v) {
  const jcd = String(v?.jcd || "").padStart(2, "0");
  if (jcd) {
    const byJcd = VENUES.find((x) => x.jcd === jcd);
    if (byJcd) return byJcd;
  }

  const name = normalizeVenueName(v?.name || v?.venue || "");
  return VENUES.find((x) => normalizeVenueName(x.name) === name) || null;
}

function getVenueArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.venues)) return raw.venues;
  return [];
}

function normalizeGradeLabel(label) {
  const s = String(label || "").trim();
  if (!s) return "一般";
  if (s === "一般戦") return "一般";
  return s;
}

function normalizeBand(item) {
  const s = String(item?.card_band || "").trim().toLowerCase();
  if (s === "morning") return "morning";
  if (s === "day") return "day";
  if (s === "evening") return "evening";
  if (s === "night") return "night";
  return "normal";
}

function normalizeToneClass(band) {
  if (band === "morning") return "card--tone-morning";
  if (band === "day") return "card--tone-day";
  if (band === "evening") return "card--tone-evening";
  if (band === "night") return "card--tone-night";
  return "card--tone-normal";
}

function toneIcon() {
  return "";
}

/* ===================== 時刻解析 ===================== */

function parseHHMM(hhmm) {
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  return { hh, mm };
}

function normalizeRaceTimes(raceTimes) {
  if (!Array.isArray(raceTimes)) return [];

  const out = [];
  for (const item of raceTimes) {
    const rno = Number(item?.rno);
    const cutoff = String(item?.cutoff || "").trim();
    const hm = parseHHMM(cutoff);
    if (!Number.isInteger(rno) || rno <= 0 || !hm) continue;

    out.push({
      rno,
      cutoff: `${pad2(hm.hh)}:${pad2(hm.mm)}`
    });
  }

  out.sort((a, b) => a.rno - b.rno);
  return out;
}

function getRaceCutoffTimestamp(hhmm) {
  const hm = parseHHMM(hhmm);
  if (!hm) return null;

  const d = new Date();
  d.setHours(hm.hh, hm.mm, 0, 0);
  return d.getTime();
}

function computeNextDisplayFromRaceTimes(raceTimes) {
  const nowMs = Date.now();

  for (const race of raceTimes) {
    const cutoffAt = getRaceCutoffTimestamp(race.cutoff);
    if (cutoffAt == null) continue;

    const switchAt = cutoffAt + NEXT_RACE_DELAY_MS;
    const remainMs = cutoffAt - nowMs;

    if (nowMs < switchAt) {
      return {
        next_race: race.rno,
        next_display: `${race.rno}R ${race.cutoff}`,
        cutoff_at: cutoffAt,
        is_danger: remainMs <= DANGER_MS && remainMs >= 0
      };
    }
  }

  return {
    next_race: null,
    next_display: "発売終了",
    cutoff_at: null,
    is_danger: false
  };
}

function splitNextDisplay(nextDisplay) {
  const s = String(nextDisplay || "-- --").trim();

  if (s === "発売終了") {
    return {
      left: "発売終了",
      time: "",
      isSoldout: true
    };
  }

  const m = s.match(/^(\d+R)\s+(\d{2}:\d{2})$/);
  if (m) {
    return {
      left: m[1],
      time: m[2],
      isSoldout: false
    };
  }

  return {
    left: s,
    time: "",
    isSoldout: false
  };
}

/* ===================== 表示系 ===================== */

function getVenueMetaLine(v) {
  const grade = normalizeGradeLabel(v?.grade_label);
  const day = String(v?.day_label || "").trim();

  return `
    <div class="card__meta">
      <span class="metaLeft">
        <span class="gradeText">${escapeHTML(grade)}</span>
      </span>
      <span class="day">${day ? `${escapeHTML(day)} ` : "-- -- "}</span>
    </div>
  `;
}

function normalizeVenueList(raw) {
  const src = getVenueArray(raw);
  const out = [];
  const seen = new Set();

  for (const item of src) {
    const base = findVenueBase(item);
    if (!base) continue;
    if (seen.has(base.jcd)) continue;
    seen.add(base.jcd);

    const raceTimes = normalizeRaceTimes(item?.race_times);
    const computed = raceTimes.length
      ? computeNextDisplayFromRaceTimes(raceTimes)
      : {
          next_race: Number(item?.next_race) || null,
          next_display: String(item?.next_display || "-- --").trim() || "-- --",
          cutoff_at: null,
          is_danger: false
        };

    out.push({
      jcd: base.jcd,
      name: base.name,
      next_race: computed.next_race,
      next_display: computed.next_display,
      day_label: String(item?.day_label || "").trim(),
      grade_label: normalizeGradeLabel(item?.grade_label),
      first_race_time: String(item?.first_race_time || "").trim(),
      card_band: normalizeBand(item),
      race_times: raceTimes,
      cutoff_at: computed.cutoff_at,
      is_danger: computed.is_danger
    });
  }

  return out;
}

function recalcVenueList(venueList) {
  return (venueList || []).map((v) => {
    const raceTimes = normalizeRaceTimes(v?.race_times);
    if (!raceTimes.length) return v;

    const computed = computeNextDisplayFromRaceTimes(raceTimes);

    return {
      ...v,
      race_times: raceTimes,
      next_race: computed.next_race,
      next_display: computed.next_display,
      cutoff_at: computed.cutoff_at,
      is_danger: computed.is_danger
    };
  });
}

function render(venueList) {
  const map = new Map();
  for (const v of venueList) {
    map.set(String(v.jcd), v);
  }

  const merged = VENUES.map((base) => {
    const v = map.get(base.jcd);
    return {
      jcd: base.jcd,
      name: base.name,
      exists: !!v,
      next_display: v?.next_display || "-- --",
      day_label: v?.day_label || "",
      grade_label: v?.grade_label || "一般",
      first_race_time: v?.first_race_time || "",
      card_band: v?.card_band || "normal",
      race_times: v?.race_times || [],
      is_danger: !!v?.is_danger
    };
  });

  $grid.innerHTML = merged.map((v) => {
    if (!v.exists) {
      return `
        <div class="card card--off" aria-disabled="true">
          <div class="card__nameRow">
            <span class="card__nameIcon card__nameIcon--empty"></span>
            <div class="card__name">${escapeHTML(v.name)}</div>
            <span class="card__nameIcon card__nameIcon--empty"></span>
          </div>
          <div class="card__meta">
            <span class="metaLeft"><span class="gradeText">-- --</span></span>
            <span class="day">-- -- </span>
          </div>
          <div class="card__line card__line--btm">-- --</div>
        </div>
      `;
    }

    const split = splitNextDisplay(v.next_display);
    const timeDangerClass = v.is_danger && split.time ? " raceTime--danger" : "";

    if (split.isSoldout) {
      return `
        <a class="card card--on ${normalizeToneClass(v.card_band)}" href="${venueHref(v)}">
          <div class="card__nameRow">
            <span class="card__nameIcon">${toneIcon(v.card_band)}</span>
            <div class="card__name">${escapeHTML(v.name)}</div>
            <span class="card__nameIcon card__nameIcon--empty"></span>
          </div>
          ${getVenueMetaLine(v)}
          <div class="card__line card__line--btm">${escapeHTML(split.left)}</div>
        </a>
      `;
    }

    return `
      <a class="card card--on ${normalizeToneClass(v.card_band)}" href="${venueHref(v)}">
        <div class="card__nameRow">
          <span class="card__nameIcon">${toneIcon(v.card_band)}</span>
          <div class="card__name">${escapeHTML(v.name)}</div>
          <span class="card__nameIcon card__nameIcon--empty"></span>
        </div>
        ${getVenueMetaLine(v)}
        <div class="card__line card__line--btm">
          <span class="raceNo">${escapeHTML(split.left)}</span>
          ${split.time ? `<span class="raceTime${timeDangerClass}">${escapeHTML(split.time)}</span>` : ""}
        </div>
      </a>
    `;
  }).join("");

  const now = nowJST();
  $updatedAt.textContent = `${pad2(now.hh)}:${pad2(now.mm)}`;
}

function renderPicksEmpty() {
  if ($picks) $picks.innerHTML = "";
  const now = nowJST();
  if ($picksUpdatedAt) $picksUpdatedAt.textContent = `${pad2(now.hh)}:${pad2(now.mm)}`;
}

function renderPicksCta() {
  if (!$picksCta) return;

  $picksCta.innerHTML = `
    <a class="picksBtn" href="${NOTE_URLS.YOSO_ONLY}" target="_blank" rel="noopener noreferrer">
      <div>
        <div class="picksBtnMain">予想だけ購入（500円）</div>
        <div class="picksBtnSub">noteで確認</div>
      </div>
      <div class="picksBtnArrow">→</div>
    </a>

    <a class="picksBtn" href="${NOTE_URLS.PRO_ONLY}" target="_blank" rel="noopener noreferrer">
      <div>
        <div class="picksBtnMain">PROだけ購入（500円）</div>
        <div class="picksBtnSub">キー配布方式（購読者＝PRO扱い）</div>
      </div>
      <div class="picksBtnArrow">→</div>
    </a>

    <a class="picksBtn picksBtn--set" href="${NOTE_URLS.SET}" target="_blank" rel="noopener noreferrer">
      <div>
        <div class="picksBtnMain">セット購入（800円）</div>
        <div class="picksBtnSub">予想 + PRO（お得）</div>
      </div>
      <div class="picksBtnArrow">→</div>
    </a>
  `;
}

/* ===================== PRO ===================== */

function isProMode() {
  return localStorage.getItem(PRO_STORAGE_KEY) === "1";
}

function applyThemeFromStorage() {
  if (isProMode()) {
    document.documentElement.setAttribute("data-theme", "pro");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  syncProButtonState();
}

function syncProButtonState() {
  if (!$btnPro) return;
  const on = isProMode();
  $btnPro.setAttribute("aria-pressed", on ? "true" : "false");
  $btnPro.classList.toggle("is-active", on);
}

function enableProMode() {
  localStorage.setItem(PRO_STORAGE_KEY, "1");
  applyThemeFromStorage();
}

function disableProMode() {
  localStorage.removeItem(PRO_STORAGE_KEY);
  applyThemeFromStorage();
}

function toggleProMode() {
  if (isProMode()) {
    disableProMode();
    return;
  }

  const pass = window.prompt("PROパスワード");
  if (pass === null) return;

  if (pass === PRO_PASSWORD) {
    enableProMode();
  } else {
    window.alert("パスワードが違います");
  }
}

/* ===================== 読み込み ===================== */

function rerenderFromCurrentTime() {
  if (!latestVenueList.length) return;
  latestVenueList = recalcVenueList(latestVenueList);
  render(latestVenueList);
  applyThemeFromStorage();
}

function jstDateChanged() {
  const today = todayJSTString();
  if (!currentJstDate) {
    currentJstDate = today;
    return false;
  }
  if (currentJstDate !== today) {
    currentJstDate = today;
    return true;
  }
  return false;
}

function sourceIsToday() {
  return !latestSourceDate || latestSourceDate === todayJSTString();
}

async function loadAll(force = false) {
  if (isLoading) return;

  const now = Date.now();
  const tooSoon = now - lastLoadedAt < 15000;

  if (!force && tooSoon && latestVenueList.length) {
    rerenderFromCurrentTime();
    return;
  }

  isLoading = true;

  try {
    const json = await fetchJSONWithFallback(SITE_VENUES_URLS);

    latestSourceDate =
      String(json?.date || json?.time || "").trim().slice(0, 10);

    latestVenueList = normalizeVenueList(json);
    lastLoadedAt = Date.now();

    if (!latestVenueList.length) {
      throw new Error("venue data empty");
    }

    render(latestVenueList);
    renderPicksEmpty();
    renderPicksCta();
    applyThemeFromStorage();
  } catch (e) {
    console.error(e);

    if (latestVenueList.length) {
      rerenderFromCurrentTime();
      const nowJ = nowJST();
      if ($updatedAt) $updatedAt.textContent = `${pad2(nowJ.hh)}:${pad2(nowJ.mm)}`;
    } else {
      if ($updatedAt) $updatedAt.textContent = "ERR";
      alert(`開催一覧取得エラー: ${e.message || e}`);
    }
  } finally {
    isLoading = false;
  }
}

/* ===================== イベント ===================== */

if ($btn) {
  $btn.addEventListener("click", () => loadAll(true));
}

if ($btnPro) {
  $btnPro.addEventListener("click", toggleProMode);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const force = jstDateChanged();
    rerenderFromCurrentTime();
    loadAll(force);
  }
});

setInterval(() => {
  if (document.visibilityState === "visible") {
    const force = jstDateChanged() || !sourceIsToday();
    loadAll(force);
  }
}, REFRESH_INTERVAL_MS);

setInterval(() => {
  if (document.visibilityState === "visible") {
    rerenderFromCurrentTime();
  }
}, RERENDER_INTERVAL_MS);

/* 初回 */
currentJstDate = todayJSTString();
applyThemeFromStorage();
renderPicksCta();
renderPicksEmpty();
loadAll(true);