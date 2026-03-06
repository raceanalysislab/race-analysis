/* js/app.js（完全置き換え：開催一覧のみ表示 / day_label・終了対応版） */

/* ===== 直読みURL ===== */
const SITE_VENUES_URL =
  "https://cdn.jsdelivr.net/gh/raceanalysislab/race-data-bot@main/data/site/venues.json";

const NOTE_URLS = {
  YOSO_ONLY: "https://note.com/wsnndboat7/n/n1fdca8b0a7e3",
  PRO_ONLY:  "https://note.com/wsnndboat7/n/n8d805a4f27bf",
  SET:       "https://note.com/wsnndboat7/n/n6fcdb2a9db4f",
};

/* ===== 会場順（固定） ===== */
const VENUES = [
  { jcd: "01", name: "桐生" }, { jcd: "02", name: "戸田" }, { jcd: "03", name: "江戸川" }, { jcd: "04", name: "平和島" },
  { jcd: "05", name: "多摩川" }, { jcd: "06", name: "浜名湖" }, { jcd: "07", name: "蒲郡" }, { jcd: "08", name: "常滑" },
  { jcd: "09", name: "津" }, { jcd: "10", name: "三国" }, { jcd: "11", name: "びわこ" }, { jcd: "12", name: "住之江" },
  { jcd: "13", name: "尼崎" }, { jcd: "14", name: "鳴門" }, { jcd: "15", name: "丸亀" }, { jcd: "16", name: "児島" },
  { jcd: "17", name: "宮島" }, { jcd: "18", name: "徳山" }, { jcd: "19", name: "下関" }, { jcd: "20", name: "若松" },
  { jcd: "21", name: "芦屋" }, { jcd: "22", name: "福岡" }, { jcd: "23", name: "唐津" }, { jcd: "24", name: "大村" }
];

/* ===== DOM ===== */
const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");
const $picks = document.getElementById("picks");
const $picksUpdatedAt = document.getElementById("picksUpdatedAt");
const $picksCta = document.getElementById("picksCta");

const pad2 = (n) => String(n).padStart(2, "0");
let isLoading = false;

/* ===== JST ===== */
function nowJST() {
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

/* ===== fetch ===== */
async function fetchJSON(url) {
  const finalUrl = `${url}?t=${Date.now()}`;
  const res = await fetch(finalUrl, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`fetch fail: ${res.status}`);
  }

  return await res.json();
}

/* ===== 会場リンク ===== */
function venueHref(v) {
  return `./race.html?jcd=${encodeURIComponent(v.jcd)}&name=${encodeURIComponent(v.name)}`;
}

/* ===== 会場照合 ===== */
function findVenueBase(v) {
  const jcd = String(v?.jcd || "").padStart(2, "0");
  if (jcd) {
    const byJcd = VENUES.find((x) => x.jcd === jcd);
    if (byJcd) return byJcd;
  }

  const name = normalizeVenueName(v?.name || v?.venue || "");
  return VENUES.find((x) => normalizeVenueName(x.name) === name) || null;
}

/* ===== site/venues.json → venues ===== */
function buildHeldVenuesFromSite(raw) {
  const arr =
    Array.isArray(raw) ? raw :
    Array.isArray(raw?.venues) ? raw.venues :
    [];

  const venues = [];

  for (const v of arr) {
    const base = findVenueBase(v);
    if (!base) continue;

    venues.push({
      jcd: base.jcd,
      name: base.name,
      exists: true,
      next_display: String(v?.next_display || "-- --"),
      day: v?.day ?? null,
      total_days: v?.total_days ?? null,
      day_label: String(v?.day_label || "").trim()
    });
  }

  const uniq = [];
  const seen = new Set();

  for (const v of venues) {
    if (seen.has(v.jcd)) continue;
    seen.add(v.jcd);
    uniq.push(v);
  }

  return { venues: uniq };
}

/* ===== render ===== */
function render(raw) {
  const arr = Array.isArray(raw?.venues) ? raw.venues : [];
  const map = new Map();

  for (const v of arr) {
    const jcd = String(v?.jcd || "");
    if (!jcd) continue;
    map.set(jcd, v);
  }

  const merged = VENUES.map((base) => {
    const v = map.get(base.jcd);
    const exists = !!v;

    return {
      jcd: base.jcd,
      name: base.name,
      exists,
      next_display: exists ? String(v?.next_display || "-- --") : "-- --",
      day_label: exists ? String(v?.day_label || "") : ""
    };
  });

  $grid.innerHTML = merged.map((v) => {
    const subLine = v.day_label || "-- --";
    const bottomLine = v.next_display || "-- --";

    if (!v.exists) {
      return `
        <div class="card card--off" aria-disabled="true">
          <div class="card__name">${v.name}</div>
          <div class="card__line card__line--sub">${subLine}</div>
          <div class="card__line card__line--btm">${bottomLine}</div>
        </div>
      `;
    }

    return `
      <a class="card card--on card--tone-normal" href="${venueHref(v)}">
        <div class="card__name">${v.name}</div>
        <div class="card__line card__line--sub">${subLine}</div>
        <div class="card__line card__line--btm">${bottomLine}</div>
      </a>
    `;
  }).join("");

  const now = nowJST();
  $updatedAt.textContent = `${pad2(now.hh)}:${pad2(now.mm)}`;
}

/* ===== picks ===== */
function renderPicksEmpty() {
  if ($picks) $picks.innerHTML = "";
  const now = nowJST();
  if ($picksUpdatedAt) $picksUpdatedAt.textContent = `${pad2(now.hh)}:${pad2(now.mm)}`;
}

/* ===== CTA ===== */
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

/* ===== load ===== */
async function loadAll() {
  if (isLoading) return;
  isLoading = true;

  try {
    const siteVenues = await fetchJSON(SITE_VENUES_URL);
    const raw = buildHeldVenuesFromSite(siteVenues);

    render(raw);
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

/* ===== refresh ===== */
if ($btn) {
  $btn.addEventListener("click", () => loadAll());
}

/* ===== auto refresh ===== */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") loadAll();
});

setInterval(() => {
  if (document.visibilityState === "visible") loadAll();
}, 5 * 60 * 1000);

/* ===== boot ===== */
renderPicksCta();
renderPicksEmpty();
loadAll();