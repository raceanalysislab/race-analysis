/* js/app.js（完全置き換え：開催一覧 / 安定版） */

const SITE_VENUES_URL =
  "https://raw.githubusercontent.com/raceanalysislab/race-data-bot/main/data/site/venues.json";

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

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");
const $picks = document.getElementById("picks");
const $picksUpdatedAt = document.getElementById("picksUpdatedAt");
const $picksCta = document.getElementById("picksCta");

const pad2 = (n) => String(n).padStart(2, "0");
let isLoading = false;

function nowJST() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    hh: Number(get("hour")),
    mm: Number(get("minute"))
  };
}

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

async function fetchJSON(url) {
  const finalUrl = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const res = await fetch(finalUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch fail: ${res.status}`);
  return await res.json();
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

function detectCardToneByTime(nextDisplay) {
  const s = String(nextDisplay || "");
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return "normal";

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const tmin = hh * 60 + mm;

  if (tmin >= 8 * 60 + 30 && tmin <= 9 * 60) return "morning";
  if (tmin >= 15 * 60 && tmin <= 15 * 60 + 40) return "night";
  return "normal";
}

function normalizeToneClass(tone) {
  const s = String(tone || "").trim().toLowerCase();
  if (s === "morning") return "card--tone-morning";
  if (s === "night") return "card--tone-night";
  return "card--tone-normal";
}

function toneIcon(tone) {
  const s = String(tone || "").trim().toLowerCase();
  if (s === "morning") return "☀️";
  if (s === "night") return "🌙";
  return "";
}

function normalizeGradeLabel(label) {
  const s = String(label || "").trim();
  if (!s) return "一般";
  if (s === "一般戦") return "一般";
  return s;
}

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

    const nextDisplay = String(item?.next_display || "-- --").trim() || "-- --";
    const tone = detectCardToneByTime(nextDisplay);

    out.push({
      jcd: base.jcd,
      name: base.name,
      next_display: nextDisplay,
      day_label: String(item?.day_label || "").trim(),
      grade_label: normalizeGradeLabel(item?.grade_label),
      card_tone: tone
    });
  }

  return out;
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
      card_tone: v?.card_tone || "normal"
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

    return `
      <a class="card card--on ${normalizeToneClass(v.card_tone)}" href="${venueHref(v)}">
        <div class="card__nameRow">
          <span class="card__nameIcon">${toneIcon(v.card_tone)}</span>
          <div class="card__name">${escapeHTML(v.name)}</div>
          <span class="card__nameIcon card__nameIcon--empty"></span>
        </div>
        ${getVenueMetaLine(v)}
        <div class="card__line card__line--btm">${escapeHTML(v.next_display || "-- --")}</div>
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

async function loadAll() {
  if (isLoading) return;
  isLoading = true;

  try {
    const json = await fetchJSON(SITE_VENUES_URL);
    const venueList = normalizeVenueList(json);
    render(venueList);
    renderPicksEmpty();
    renderPicksCta();
  } catch (e) {
    console.error(e);
    if ($updatedAt) $updatedAt.textContent = "ERR";
    alert(`開催一覧取得エラー: ${e.message || e}`);
  } finally {
    isLoading = false;
  }
}

if ($btn) $btn.addEventListener("click", loadAll);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") loadAll();
});

setInterval(() => {
  if (document.visibilityState === "visible") loadAll();
}, 5 * 60 * 1000);

renderPicksCta();
renderPicksEmpty();
loadAll();