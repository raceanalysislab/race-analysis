/* js/app.js（完全置き換え：開催一覧安定版 / mbrace主導 + bot保険 + キャッシュ回避） */

import { BOT_VENUES_URL, BOT_PICKS_URL, NOTE_URLS } from "./config.js";

/* ===== mbrace JSON（CDN） ===== */
const MBRACE_RACES_URL =
  "https://cdn.jsdelivr.net/gh/raceanalysislab/race-data-bot@main/data/mbrace_races_today.json";

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
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: Number(get("hour")),
    mm: Number(get("minute")),
    ss: Number(get("second"))
  };
}

function todayJSTStr() {
  const n = nowJST();
  return `${n.y}-${pad2(n.m)}-${pad2(n.d)}`;
}

function minutesFromHHMM(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

/* ===== 文字正規化 ===== */
function normalizeVenueName(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

/* ===== fetch ===== */
async function fetchJSON(url) {
  const bust = url.includes("?") ? "&" : "?";
  const res = await fetch(url + bust + "t=" + Date.now(), {
    cache: "no-store",
    headers: {
      pragma: "no-cache",
      "cache-control": "no-cache"
    }
  });
  if (!res.ok) throw new Error(`fetch fail: ${url}`);
  return await res.json();
}

/* ===== 会場リンク ===== */
function venueHref(v) {
  return `./race.html?jcd=${encodeURIComponent(v.jcd)}&name=${encodeURIComponent(v.name)}`;
}

/* ===== next表示 ===== */
function computeNextDisplayFromCutoffs(cutoffs) {
  if (!Array.isArray(cutoffs) || !cutoffs.length) return "-- --";

  const now = nowJST();
  const nowMin = now.hh * 60 + now.mm;

  const sorted = [...cutoffs]
    .filter((c) => Number.isFinite(Number(c?.rno)) && minutesFromHHMM(c?.time) !== null)
    .sort((a, b) => (minutesFromHHMM(a.time) ?? 0) - (minutesFromHHMM(b.time) ?? 0));

  for (const c of sorted) {
    const tMin = minutesFromHHMM(c.time);
    if (tMin === null) continue;
    if (tMin > nowMin) {
      return `${Number(c.rno)}R ${c.time}`;
    }
  }

  return "終了";
}

/* ===== 会場名 → ベース会場 ===== */
function findVenueBaseByName(name) {
  const raw = String(name || "").trim();
  const norm = normalizeVenueName(raw);

  return (
    VENUES.find((v) => v.name === raw) ||
    VENUES.find((v) => normalizeVenueName(v.name) === norm) ||
    null
  );
}

/* ===== mbrace → venues ===== */
function buildHeldVenuesFromMbrace(mbrace) {
  const all = Array.isArray(mbrace?.venues) ? mbrace.venues : [];
  const venues = [];

  for (const v of all) {
    const base = findVenueBaseByName(v?.venue || "");
    if (!base) continue;

    const races = Array.isArray(v?.races) ? v.races : [];
    const cutoffs = [];

    for (const r of races) {
      const rno = Number(r?.rno);
      const cutoff = String(r?.cutoff || "").trim();
      const mm = cutoff.match(/^(\d{1,2}):(\d{2})$/);

      if (!Number.isFinite(rno) || rno < 1 || rno > 12) continue;
      if (!mm) continue;

      cutoffs.push({
        rno,
        time: `${pad2(Number(mm[1]))}:${pad2(Number(mm[2]))}`
      });
    }

    venues.push({
      jcd: base.jcd,
      name: base.name,
      held: true,
      cutoffs,
      next_display: computeNextDisplayFromCutoffs(cutoffs)
    });
  }

  const uniq = [];
  const seen = new Set();

  for (const v of venues) {
    if (seen.has(v.jcd)) continue;
    seen.add(v.jcd);
    uniq.push(v);
  }

  return {
    date: todayJSTStr(),
    checked_at: new Date().toISOString(),
    venues: uniq
  };
}

/* ===== bot venues → venues ===== */
function buildHeldVenuesFromBot(raw) {
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.venues) ? raw.venues : []);
  const venues = [];

  for (const v of arr) {
    const jcd = String(v?.jcd || "");
    const base = VENUES.find((x) => x.jcd === jcd);
    if (!base) continue;

    venues.push({
      jcd,
      name: base.name,
      held: true,
      next_display: String(v?.next_display || "-- --")
    });
  }

  return {
    date: todayJSTStr(),
    checked_at: new Date().toISOString(),
    venues
  };
}

/* ===== mbrace と bot をマージ ===== */
function mergeVenueSources(mbraceRaw, botRaw) {
  const map = new Map();

  const botArr = Array.isArray(botRaw?.venues) ? botRaw.venues : [];
  for (const v of botArr) {
    const jcd = String(v?.jcd || "");
    if (!jcd) continue;
    map.set(jcd, {
      jcd,
      name: v.name,
      held: true,
      next_display: String(v?.next_display || "-- --")
    });
  }

  const mbraceArr = Array.isArray(mbraceRaw?.venues) ? mbraceRaw.venues : [];
  for (const v of mbraceArr) {
    const jcd = String(v?.jcd || "");
    if (!jcd) continue;
    map.set(jcd, {
      jcd,
      name: v.name,
      held: true,
      next_display: String(v?.next_display || "-- --")
    });
  }

  return {
    date: todayJSTStr(),
    checked_at: new Date().toISOString(),
    venues: Array.from(map.values())
  };
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

/* ===== picks ===== */
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
    const [mbrace, botVenues, picks] = await Promise.all([
      fetchJSON(MBRACE_RACES_URL).catch(() => null),
      fetchJSON(BOT_VENUES_URL).catch(() => null),
      fetchJSON(BOT_PICKS_URL).catch(() => null)
    ]);

    const mbraceRaw = mbrace ? buildHeldVenuesFromMbrace(mbrace) : { venues: [] };
    const botRaw = botVenues ? buildHeldVenuesFromBot(botVenues) : { venues: [] };

    let raw = null;

    if (mbraceRaw.venues.length && botRaw.venues.length) {
      raw = mergeVenueSources(mbraceRaw, botRaw);
    } else if (mbraceRaw.venues.length) {
      raw = mbraceRaw;
    } else if (botRaw.venues.length) {
      raw = botRaw;
    } else {
      raw = { venues: [] };
    }

    render(raw);
    renderPicks(picks || { picks: [] });
    renderPicksCta();
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
loadAll();