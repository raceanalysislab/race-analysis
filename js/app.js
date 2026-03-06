alert("APP-DEBUG-OK");
/* js/app.js（デバッグ版：開催一覧 / bot repo の venues.json を直接確認） */

import { BOT_VENUES_URL, BOT_PICKS_URL, NOTE_URLS } from "./config.js";
alert("DEBUG APP JS 999");
const SITE_VENUES_URL = BOT_VENUES_URL;
const PICKS_URL = BOT_PICKS_URL;

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

async function fetchJSON(url) {
  const bust = url.includes("?") ? "&" : "?";
  const finalUrl = url + bust + "t=" + Date.now();

  const res = await fetch(finalUrl, {
    cache: "no-store",
    headers: {
      pragma: "no-cache",
      "cache-control": "no-cache"
    }
  });

  if (!res.ok) {
    throw new Error(`fetch fail: ${res.status} ${finalUrl}`);
  }

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
      held: true,
      next_display: String(v?.next_display || "-- --")
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
    const held = v?.held === true;

    return {
      jcd: base.jcd,
      name: base.name,
      held,
      next_display: held ? String(v?.next_display || "-- --") : "-- --"
    };
  });

  $grid.innerHTML = merged.map((v) => {
    if (!v.held) {
      return `
        <div class="card card--off" aria-disabled="true">
          <div class="card__name">${v.name}</div>
          <div class="card__line">-- --</div>
          <div class="card__line">-- --</div>
        </div>
      `;
    }

    return `
      <a class="card card--on" href="${venueHref(v)}">
        <div class="card__name">${v.name}</div>
        <div class="card__line">開催中</div>
        <div class="card__line">${v.next_display}</div>
      </a>
    `;
  }).join("");

  const now = nowJST();
  $updatedAt.textContent = `${pad2(now.hh)}:${pad2(now.mm)}`;
}

function renderPicks(data) {
  const picks = Array.isArray(data?.picks) ? data.picks : [];

  $picks.innerHTML = picks.map((p) => `
    <a class="pickCard" href="${p.url || "#"}" ${p.url ? "" : 'aria-disabled="true" onclick="return false;"'}>
      <div>${p.venue || ""} ${p.race || ""}</div>
    </a>
  `).join("");

  const now = nowJST();
  $picksUpdatedAt.textContent = `${pad2(now.hh)}:${pad2(now.mm)}`;
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
    let siteVenues = null;
    let picks = null;
    let fetchErr = "";

    try {
      siteVenues = await fetchJSON(SITE_VENUES_URL);
    } catch (e) {
      fetchErr = String(e?.message || e);
    }

    try {
      picks = await fetchJSON(PICKS_URL);
    } catch (_) {}

    const raw = siteVenues ? buildHeldVenuesFromSite(siteVenues) : { venues: [] };

    const srcArr =
      Array.isArray(siteVenues) ? siteVenues :
      Array.isArray(siteVenues?.venues) ? siteVenues.venues :
      [];

    const preview = srcArr.slice(0, 5).map(v => `${v?.jcd || "??"}:${v?.name || "??"}`).join(", ");

    alert(
      `fetch=${siteVenues ? "ok" : "ng"}\n` +
      `err=${fetchErr || "-"}\n` +
      `srcCount=${srcArr.length}\n` +
      `builtCount=${raw.venues.length}\n` +
      `preview=${preview || "-"}\n` +
      `url=${SITE_VENUES_URL}`
    );

    render(raw);
    renderPicks(picks || { picks: [] });
    renderPicksCta();
  } finally {
    isLoading = false;
  }
}

if ($btn) {
  $btn.addEventListener("click", () => loadAll());
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") loadAll();
});

setInterval(() => {
  if (document.visibilityState === "visible") loadAll();
}, 5 * 60 * 1000);

renderPicksCta();
loadAll();