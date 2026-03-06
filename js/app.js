/* js/app.js（完全置き換え：mbrace主導 + CDN + 並列fetch + キャッシュ完全回避 + 既存PRO/ゴースト対策維持） */
import { BOT_VENUES_URL, BOT_PICKS_URL, NOTE_URLS } from "./config.js";

/* ===== mbrace JSON（CDN） ===== */
const MBRACE_RACES_URL =
  "https://cdn.jsdelivr.net/gh/raceanalysislab/race-data-bot@main/data/mbrace_races_today.json";

/* ===== 会場順（公式アプリ順） ===== */
const VENUES = [
  { jcd: "01", name: "桐生" }, { jcd: "02", name: "戸田" }, { jcd: "03", name: "江戸川" }, { jcd: "04", name: "平和島" },
  { jcd: "05", name: "多摩川" }, { jcd: "06", name: "浜名湖" }, { jcd: "07", name: "蒲郡" }, { jcd: "08", name: "常滑" },
  { jcd: "09", name: "津" }, { jcd: "10", name: "三国" }, { jcd: "11", name: "びわこ" }, { jcd: "12", name: "住之江" },
  { jcd: "13", name: "尼崎" }, { jcd: "14", name: "鳴門" }, { jcd: "15", name: "丸亀" }, { jcd: "16", name: "児島" },
  { jcd: "17", name: "宮島" }, { jcd: "18", name: "徳山" }, { jcd: "19", name: "下関" }, { jcd: "20", name: "若松" },
  { jcd: "21", name: "芦屋" }, { jcd: "22", name: "福岡" }, { jcd: "23", name: "唐津" }, { jcd: "24", name: "大村" },
];

/* ===== DOM ===== */
const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");

const $picks = document.getElementById("picks");
const $picksUpdatedAt = document.getElementById("picksUpdatedAt");
const $picksCta = document.getElementById("picksCta");

const $btnPro = document.getElementById("btnPro");

const pad2 = (n) => String(n).padStart(2, "0");
const toHM = (s) => (typeof s === "string" && String(s).length >= 4) ? String(s).slice(0, 5) : "--:--";
const normalizeJP = (s) => String(s || "").replace(/\s+/g, "");

/* ===== 内部状態 ===== */
let LAST_VENUES_RAW = null;
let LAST_MERGED = null;
let NEXT_FETCH_TIMER = null;
let isLoading = false;

/* ===== JST now ===== */
function nowJST() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const get = (type) => parts.find(p => p.type === type)?.value;
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const hh = Number(get("hour"));
  const mm = Number(get("minute"));
  const ss = Number(get("second"));
  return { y, m, d, hh, mm, ss };
}

function todayJSTStr() {
  const n = nowJST();
  return `${n.y}-${pad2(n.m)}-${pad2(n.d)}`;
}

function minutesFromHHMM(hhmm) {
  const s = String(hhmm || "");
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function hmFromISO(iso) {
  const s = String(iso || "");
  const m = s.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

/* ===== fetch（キャッシュ完全回避） ===== */
async function fetchJSON(urlOrPath, force = true) {
  const bust = (force !== false);
  const url = bust
    ? `${urlOrPath}${urlOrPath.includes("?") ? "&" : "?"}t=${Date.now()}`
    : urlOrPath;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "pragma": "no-cache",
      "cache-control": "no-cache",
    },
  });
  if (!res.ok) throw new Error(`failed to fetch: ${urlOrPath}`);
  return await res.json();
}

/* ===== venue meta（bot）吸収 ===== */
function normalizeGrade(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  s = s.toUpperCase().replace(/\s+/g, "");
  s = s.replace("GⅠ", "G1").replace("GI", "G1");
  s = s.replace("GⅡ", "G2").replace("GII", "G2");
  s = s.replace("GⅢ", "G3").replace("GIII", "G3");
  s = s.replace(/[^A-Z0-9]/g, "");
  if (s === "SG" || s === "G1" || s === "G2" || s === "G3") return s;
  return "";
}
function gradeLabel(v) {
  if (!v.held) return "";
  const g = normalizeGrade(v.grade);
  return g ? g : "一般";
}
function dayLabel(v) {
  if (!v.held) return "";
  if (typeof v.day === "number") return `${v.day}日目`;
  if (typeof v.day === "string" && v.day.trim()) return normalizeJP(v.day.trim());
  return "—";
}

/* ===== UI tone ===== */
function getHourFromTimeStr(t) {
  const s = String(t || "");
  const m = s.match(/(\d{2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  return Number.isFinite(hh) ? hh : null;
}
function sessionTone(v) {
  if (!v.held) return "";
  const src = v.close_at || "";
  const hh = getHourFromTimeStr(src);
  if (hh === null) return "normal";
  if (hh >= 8 && hh < 10) return "morning";
  if (hh >= 17) return "night";
  return "normal";
}
function sessionIconByTone(tone) {
  if (tone === "morning") return "☀️";
  if (tone === "night") return "🌙";
  return "";
}

function venueHref(v) {
  return `./race.html?jcd=${encodeURIComponent(v.jcd)}&name=${encodeURIComponent(v.name)}`;
}
function raceTimeLine(v) {
  if (!v.held) return "-- --";
  if (v.next_r && v.close_at) return `${String(v.next_r)}R ${toHM(String(v.close_at))}`;
  if (v.next_display) return String(v.next_display);
  return "-- --";
}

function cardHTML(v) {
  const held = !!v.held;
  const tone = held ? (v.tone || "normal") : "";
  const toneCls = held ? ` card--tone-${tone}` : "";
  const cls = held ? `card card--on${toneCls}` : `card card--off`;

  const icon = held ? sessionIconByTone(tone) : "";
  const baseMid = held ? `${gradeLabel(v)} ${dayLabel(v)}`.trim() : "";
  const mid = held ? `${icon ? (icon + " ") : ""}${baseMid}`.trim() : "";
  const btm = raceTimeLine(v);

  if (!held) {
    return `
      <div class="${cls}" aria-disabled="true">
        <div class="card__name">${v.name}</div>
        <div class="card__line card__line--mid">${mid || "-- --"}</div>
        <div class="card__line card__line--btm">${btm || "-- --"}</div>
      </div>
    `;
  }

  return `
    <a class="${cls}" href="${venueHref(v)}" data-tone="${tone}">
      <div class="card__name">${v.name}</div>
      <div class="card__line card__line--mid">${mid || "一般 —"}</div>
      <div class="card__line card__line--btm">${btm || "-- --"}</div>
    </a>
  `;
}

/* ===== mbrace → 開催一覧raw ===== */
function buildHeldVenuesFromMbrace(mbracePayload) {
  const out = { date: null, checked_at: null, venues: [] };
  if (!mbracePayload || !Array.isArray(mbracePayload.venues)) return out;

  const today = todayJSTStr();

  const nameToJcd = new Map();
  VENUES.forEach(v => nameToJcd.set(normalizeJP(v.name), v.jcd));

  const list = [];
  for (const v of mbracePayload.venues) {
    const ymd = String(v?.date || "");
    if (ymd && ymd !== today) continue;

    const venueName = normalizeJP(v?.venue || "");
    const jcd = nameToJcd.get(venueName) || "";

    const races = Array.isArray(v?.races) ? v.races : [];
    const cutoffs = [];

    for (const r of races) {
      const rno = Number(r?.rno);
      const t = String(r?.cutoff || "").trim();
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!Number.isFinite(rno) || rno < 1 || rno > 12) continue;
      if (!m) continue;
      const hh = pad2(Number(m[1]));
      const mm = pad2(Number(m[2]));
      cutoffs.push({ rno, time: `${hh}:${mm}` });
    }

    cutoffs.sort((a, b) => (minutesFromHHMM(a.time) ?? 0) - (minutesFromHHMM(b.time) ?? 0));

    list.push({
      jcd,
      name: venueName || (jcd ? (VENUES.find(x => x.jcd === jcd)?.name || "") : ""),
      held: true,
      grade: "",
      day: null,
      next_r: null,
      close_at: null,
      next_display: null,
      next_cutoff: null,
      cutoffs,
    });
  }

  out.date = today;
  out.checked_at = new Date().toISOString();
  out.venues = list;
  return out;
}

/* ===== bot venues → grade/day補完 ===== */
function mergeMetaFromBot(primaryRaw, botRaw) {
  if (!primaryRaw || !Array.isArray(primaryRaw.venues)) return primaryRaw;

  const botVenues = Array.isArray(botRaw) ? botRaw : (Array.isArray(botRaw?.venues) ? botRaw.venues : []);
  if (!botVenues.length) return primaryRaw;

  const botMap = new Map();
  botVenues.forEach(v => {
    const jcd = String(v?.jcd || "");
    if (!jcd) return;
    botMap.set(jcd, v);
  });

  const merged = primaryRaw.venues.map(v => {
    const b = botMap.get(String(v.jcd || "")) || null;
    if (!b) return v;
    return {
      ...v,
      grade: (v.grade || b.grade || ""),
      day: (v.day ?? b.day ?? null),
    };
  });

  return { ...primaryRaw, venues: merged };
}

/* ===== venues rawの形を吸収（保険） ===== */
function adaptVenuesData(raw) {
  const out = { venues: [], updated_at: null, checked_at: null, date: null, raw };

  // {date, checked_at, venues:[...]}（mbrace変換はこれ）
  if (raw && Array.isArray(raw.venues) && raw.checked_at) {
    out.date = raw.date || null;
    out.checked_at = raw.checked_at || null;
    out.updated_at = hmFromISO(raw.checked_at) || null;
    out.venues = raw.venues;
    return out;
  }

  // data/site/venues.json（配列）
  if (Array.isArray(raw)) {
    out.venues = raw.map(v => ({
      jcd: String(v.jcd || ""),
      name: String(v.name || ""),
      held: true,
      next_r: (typeof v.next_race === "number") ? v.next_race : null,
      close_at: null,
      next_display: v.next_display || null,
      cutoffs: v.cutoffs || null,
      grade: v.grade,
      day: v.day,
    }));
    return out;
  }

  // venues_today.json（旧boatrace）
  if (raw && Array.isArray(raw.venues)) {
    out.date = raw.date || null;
    out.checked_at = raw.checked_at || null;
    out.updated_at = hmFromISO(raw.checked_at) || raw.updated_at || null;
    out.venues = raw.venues.map(v => ({
      jcd: v.jcd,
      name: v.name,
      held: v.held === true,
      next_r: (typeof v.next_race === "number") ? v.next_race : null,
      close_at: v.next_cutoff ? (hmFromISO(v.next_cutoff) || null) : null,
      next_display: v.next_display || null,
      next_cutoff: v.next_cutoff || null,
      cutoffs: v.cutoffs || null,
      grade: v.grade,
      day: v.day,
    }));
    return out;
  }

  return out;
}

/* ===== リアルタイム次締切 ===== */
function computeLiveNextFromCutoffs(cutoffs) {
  if (!Array.isArray(cutoffs) || cutoffs.length === 0) {
    return { next_r: null, close_at: null, next_display: null };
  }

  const now = nowJST();
  const nowMin = now.hh * 60 + now.mm;

  for (const c of cutoffs) {
    const tMin = minutesFromHHMM(c?.time);
    if (tMin === null) continue;

    if (tMin > nowMin) {
      const rno = Number(c?.rno);
      const hh = Math.floor(tMin / 60);
      const mm = tMin % 60;
      const hm = `${pad2(hh)}:${pad2(mm)}`;
      return {
        next_r: Number.isFinite(rno) ? rno : null,
        close_at: hm,
        next_display: (Number.isFinite(rno) ? `${rno}R ${hm}` : `${hm}`)
      };
    }
  }

  return { next_r: null, close_at: null, next_display: "終了" };
}

/* ===== 次締切に合わせて自動再fetch ===== */
function scheduleFetchAfterNextCutoff() {
  if (NEXT_FETCH_TIMER) {
    clearTimeout(NEXT_FETCH_TIMER);
    NEXT_FETCH_TIMER = null;
  }
  if (!LAST_MERGED) return;

  const hasAnyCutoffs = LAST_MERGED.some(v => Array.isArray(v.cutoffs) && v.cutoffs.length);
  if (!hasAnyCutoffs) return;

  const now = nowJST();
  const nowMin = now.hh * 60 + now.mm;
  let bestMin = null;

  for (const v of LAST_MERGED) {
    if (!v?.held) continue;
    const cutoffs = v.cutoffs;
    if (!Array.isArray(cutoffs) || cutoffs.length === 0) continue;

    for (const c of cutoffs) {
      const tMin = minutesFromHHMM(c?.time);
      if (tMin === null) continue;
      if (tMin > nowMin) {
        if (bestMin === null || tMin < bestMin) bestMin = tMin;
        break;
      }
    }
  }

  if (bestMin === null) return;

  const diffMin = bestMin - nowMin;
  const diffMs = diffMin * 60 * 1000 - (now.ss * 1000);
  const wait = Math.max(3000, diffMs + 3000);

  NEXT_FETCH_TIMER = setTimeout(() => {
    if (document.visibilityState === "visible") loadAll(true).catch(() => {});
  }, wait);
}

/* ===== render ===== */
function render(rawData) {
  const data = adaptVenuesData(rawData);

  const map = new Map();
  (data.venues || []).forEach(v => map.set(String(v.jcd), v));

  const merged = VENUES.map((base) => {
    const v = map.get(base.jcd) || {};
    const held = (v.held === true);

    let live = { next_r: v.next_r, close_at: v.close_at, next_display: v.next_display };
    if (held && Array.isArray(v.cutoffs) && v.cutoffs.length) {
      live = computeLiveNextFromCutoffs(v.cutoffs);
    }

    const mergedV = {
      jcd: base.jcd,
      name: base.name,
      held,
      grade: v.grade,
      day: v.day,

      next_r: live.next_r,
      close_at: live.close_at,
      next_display: live.next_display,

      next_cutoff: v.next_cutoff,
      cutoffs: v.cutoffs,
    };

    mergedV.tone = held ? sessionTone(mergedV) : "";
    return mergedV;
  });

  LAST_MERGED = merged;
  $grid.innerHTML = merged.map(cardHTML).join("");

  if (data.checked_at) {
    const hm = hmFromISO(data.checked_at);
    $updatedAt.textContent = hm ? hm : "--:--";
  } else if (data.updated_at) {
    $updatedAt.textContent = toHM(String(data.updated_at));
  } else {
    const now = nowJST();
    $updatedAt.textContent = `${pad2(now.hh)}:${pad2(now.mm)}`;
  }

  scheduleFetchAfterNextCutoff();
}

/* ===== picks ===== */
function gradeBadgeClass(g) {
  const ng = normalizeGrade(g);
  if (ng === "SG") return "badge badge--sg";
  if (ng === "G1") return "badge badge--g1";
  if (ng === "G2") return "badge badge--g2";
  if (ng === "G3") return "badge badge--g3";
  return "badge badge--ippan";
}
function pickCardHTML(p) {
  const venue = p.venue || (p.jcd ? (VENUES.find(v => v.jcd === p.jcd)?.name || "") : "");
  const race = p.race ? String(p.race) : "";
  const tm = p.time ? toHM(String(p.time)) : "--:--";
  const title = p.title ? String(p.title) : "厳選";
  const g = p.grade ? String(p.grade) : "一般";
  const note = p.note ? String(p.note) : "";
  const href = p.url ? String(p.url) : "#";
  const clickable = !!p.url;

  return `
    <a class="pickCard" href="${href}" ${clickable ? "" : 'aria-disabled="true" onclick="return false;"'}>
      <div class="pickTop">
        <div class="pickName">${venue} ${race} <span style="opacity:.7;font-weight:700">／ ${title}</span></div>
        <div class="pickTime">${tm}</div>
      </div>
      <div class="pickSub">
        <span class="${gradeBadgeClass(g)}">${normalizeGrade(g) || "一般"}</span>
        ${p.tag ? `<span class="badge">${String(p.tag)}</span>` : ""}
      </div>
      ${note ? `<p class="pickNote">${note}</p>` : ``}
    </a>
  `;
}
function renderPicks(data, fallbackCheckedAtISO) {
  const picks = Array.isArray(data?.picks) ? data.picks : [];
  $picks.innerHTML = picks.length ? picks.map(pickCardHTML).join("") : "";

  const pickedISO = data?.checked_at || data?.updated_at || null;
  if (pickedISO) {
    const hm = hmFromISO(pickedISO);
    $picksUpdatedAt.textContent = hm ? hm : "--:--";
    return;
  }

  if (fallbackCheckedAtISO) {
    const hm = hmFromISO(fallbackCheckedAtISO);
    $picksUpdatedAt.textContent = hm ? hm : "--:--";
    return;
  }

  const now = nowJST();
  $picksUpdatedAt.textContent = `${pad2(now.hh)}:${pad2(now.mm)}`;
}

function renderPicksCta() {
  const isPro = document.documentElement.getAttribute("data-theme") === "pro";

  if (!isPro) {
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
    return;
  }

  $picksCta.innerHTML = `
    <a class="picksBtn" href="#" aria-disabled="true" onclick="return false;">
      <div>
        <div class="picksBtnMain">本日の注目選手（PRO）</div>
        <div class="picksBtnSub">ここは後で差し替え</div>
      </div>
      <div class="picksBtnArrow">—</div>
    </a>

    <a class="picksBtn" href="#" aria-disabled="true" onclick="return false;">
      <div>
        <div class="picksBtnMain">本日の注目機（PRO）</div>
        <div class="picksBtnSub">ここは後で差し替え</div>
      </div>
      <div class="picksBtnArrow">—</div>
    </a>
  `;
}

/* ===== グリッド高さ（既存維持） ===== */
let LOCKED_VH = window.innerHeight;
function setGridHeight(force = false) {
  const root = document.documentElement;
  if (force) LOCKED_VH = window.innerHeight;

  const header = document.querySelector(".top");
  const headerH = header ? header.getBoundingClientRect().height : 0;

  const margin = 18;
  const bottomReserve = 110;

  const gridH = Math.max(360, Math.floor(LOCKED_VH - headerH - margin - bottomReserve));
  root.style.setProperty("--gridH", `${gridH}px`);
}
function stabilizeLayout() {
  requestAnimationFrame(() => {
    setGridHeight(false);
    requestAnimationFrame(() => setGridHeight(false));
  });
}

/* ===== iOSゴースト対策 ===== */
function forceRepaintGrid() {
  if (!$grid) return;
  try { document.activeElement?.blur?.(); } catch (e) {}

  $grid.style.willChange = "transform, opacity";
  $grid.style.transform = "translateZ(0)";
  $grid.style.opacity = "0.9999";

  requestAnimationFrame(() => {
    $grid.style.opacity = "";
    $grid.style.transform = "";
    $grid.style.willChange = "";
  });
}

/* ===== main load（並列fetch） ===== */
async function loadAll(force) {
  if (isLoading) return;
  isLoading = true;

  try {
    const [mbrace, botVenuesRaw, picksData] = await Promise.all([
      fetchJSON(MBRACE_RACES_URL, true).catch(() => null),
      fetchJSON(BOT_VENUES_URL, false).catch(() => null), // メタ補完は遅れてOK
      fetchJSON(BOT_PICKS_URL, true).catch(() => null),
    ]);

    // 1) 開催一覧は mbrace 主導（取れなければ botVenuesRaw をそのまま使う）
    let primaryRaw = null;
    if (mbrace) {
      primaryRaw = buildHeldVenuesFromMbrace(mbrace);
      // 2) grade/day だけ bot から補完（失敗してもOK）
      if (botVenuesRaw) primaryRaw = mergeMetaFromBot(primaryRaw, botVenuesRaw);
    } else {
      // どうしても mbrace が落ちた時だけ保険
      primaryRaw = botVenuesRaw || { date: todayJSTStr(), checked_at: new Date().toISOString(), venues: [] };
    }

    LAST_VENUES_RAW = primaryRaw;
    render(primaryRaw);

    if (picksData) renderPicks(picksData, primaryRaw?.checked_at || null);
    else renderPicks({ picks: [] }, primaryRaw?.checked_at || null);

    renderPicksCta();
    stabilizeLayout();
    requestAnimationFrame(() => forceRepaintGrid());

  } finally {
    isLoading = false;
  }
}

/* ===== refresh ===== */
$btn.addEventListener("click", () => {
  $btn.classList.add("is-loading");
  loadAll(true).catch(() => {}).finally(() => $btn.classList.remove("is-loading"));
});

/* ===== 表示だけのリアルタイム更新（nextを追従） ===== */
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  if (!LAST_VENUES_RAW) return;
  render(LAST_VENUES_RAW);
}, 20 * 1000);

/* ===== 画面復帰で最新 ===== */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") loadAll(true).catch(() => {});
});

/* ===== 5分ごと保険 ===== */
setInterval(() => {
  if (document.visibilityState === "visible") loadAll(true).catch(() => {});
}, 5 * 60 * 1000);

/* =========================
   ✅ PRO：手入力（当日PRO→FREE禁止 / 日付変わったらFREE）
========================= */
const LS_THEME = "theme";
const LS_PRO_OK_DATE = "pro_ok_date";
const LS_PRO_KEY = "pro_key";

const $proModal = document.getElementById("proModal");
const $proInputsWrap = document.getElementById("proInputs");
const $proInputs = $proInputsWrap ? Array.from($proInputsWrap.querySelectorAll("input")) : [];
const $proUnlock = document.getElementById("proUnlock");
const $proCancel = document.getElementById("proCancel");
const $proClear = document.getElementById("proClear");

let MODAL_SCROLL_Y = 0;

function lockScroll() {
  MODAL_SCROLL_Y = window.scrollY || 0;

  document.documentElement.classList.add("is-modal-open");
  document.body.classList.add("is-modal-open");

  document.body.style.position = "fixed";
  document.body.style.top = `-${MODAL_SCROLL_Y}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}
function unlockScroll() {
  document.documentElement.classList.remove("is-modal-open");
  document.body.classList.remove("is-modal-open");

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";

  window.scrollTo(0, MODAL_SCROLL_Y);
}
function isProNow() {
  return document.documentElement.getAttribute("data-theme") === "pro";
}
function isLockedProToday() {
  const okDate = localStorage.getItem(LS_PRO_OK_DATE);
  const theme = localStorage.getItem(LS_THEME);
  return (theme === "pro" && okDate && String(okDate) === todayJSTStr());
}
function setTheme(isPro) {
  const html = document.documentElement;

  if (isPro) {
    html.setAttribute("data-theme", "pro");
    localStorage.setItem(LS_THEME, "pro");
    $btnPro.setAttribute("aria-pressed", "true");
  } else {
    if (isLockedProToday()) {
      html.setAttribute("data-theme", "pro");
      localStorage.setItem(LS_THEME, "pro");
      $btnPro.setAttribute("aria-pressed", "true");
      alert("コードでPRO解放した日はFREEに戻せません。日付が変わると自動でFREEに戻ります。");
      return;
    }
    html.removeAttribute("data-theme");
    localStorage.setItem(LS_THEME, "free");
    $btnPro.setAttribute("aria-pressed", "false");
  }

  renderPicksCta();
  setGridHeight(true);
  stabilizeLayout();
  requestAnimationFrame(() => forceRepaintGrid());
}
function openProModal() {
  if (!$proModal) return;

  lockScroll();
  $proModal.classList.add("show");
  $proModal.setAttribute("aria-hidden", "false");

  $proInputs.forEach(i => i.value = "");

  requestAnimationFrame(() => {
    if ($proInputs[0]) $proInputs[0].focus({ preventScroll: true });
  });
}
function closeProModal() {
  if (!$proModal) return;
  $proModal.classList.remove("show");
  $proModal.setAttribute("aria-hidden", "true");
  unlockScroll();
}
function downgradeToFreeHard() {
  localStorage.removeItem(LS_PRO_OK_DATE);
  localStorage.removeItem(LS_PRO_KEY);
  localStorage.setItem(LS_THEME, "free");
  const html = document.documentElement;
  html.removeAttribute("data-theme");
  $btnPro.setAttribute("aria-pressed", "false");
  renderPicksCta();
  setGridHeight(true);
  stabilizeLayout();
  requestAnimationFrame(() => forceRepaintGrid());
}
function bootProByStoredDate() {
  const savedTheme = localStorage.getItem(LS_THEME);
  const savedOkDate = localStorage.getItem(LS_PRO_OK_DATE);

  if (savedTheme !== "pro" || !savedOkDate) {
    setTheme(false);
    return;
  }

  if (String(savedOkDate) === todayJSTStr()) {
    setTheme(true);
  } else {
    downgradeToFreeHard();
  }
}
function unlockProFlow() {
  if (isProNow()) {
    if (isLockedProToday()) {
      alert("コードでPRO解放した日はFREEに戻せません。日付が変わると自動でFREEに戻ります。");
      return;
    }
    downgradeToFreeHard();
    return;
  }
  openProModal();
}

if ($proModal) {
  $proModal.addEventListener("click", (e) => {
    if (e.target === $proModal) closeProModal();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $proModal?.classList.contains("show")) closeProModal();
});
$proInputs.forEach((input, idx) => {
  input.addEventListener("input", () => {
    input.value = String(input.value || "").replace(/\D/g, "").slice(0, 1);
    if (input.value && $proInputs[idx + 1]) $proInputs[idx + 1].focus({ preventScroll: true });
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && $proInputs[idx - 1]) {
      $proInputs[idx - 1].focus({ preventScroll: true });
    }
  });
});
if ($proCancel) $proCancel.addEventListener("click", closeProModal);
if ($proClear) $proClear.addEventListener("click", () => {
  $proInputs.forEach(i => i.value = "");
  if ($proInputs[0]) $proInputs[0].focus({ preventScroll: true });
});
if ($proUnlock) $proUnlock.addEventListener("click", () => {
  const key = $proInputs.map(i => i.value).join("");
  if (!/^\d{6}$/.test(key)) {
    alert("6桁入力してください");
    return;
  }

  localStorage.setItem(LS_PRO_KEY, key);
  localStorage.setItem(LS_PRO_OK_DATE, todayJSTStr());
  localStorage.setItem(LS_THEME, "pro");

  closeProModal();
  setTheme(true);
  alert("PROを解放しました。今日はFREEに戻せません。");
});
$btnPro.addEventListener("click", () => {
  try { unlockProFlow(); } catch (e) {}
});

// 0時監視
let _lastDate = todayJSTStr();
setInterval(() => {
  const d = todayJSTStr();
  if (d !== _lastDate) {
    _lastDate = d;
    const okDate = localStorage.getItem(LS_PRO_OK_DATE);
    if (localStorage.getItem(LS_THEME) === "pro" && okDate && String(okDate) !== d) {
      downgradeToFreeHard();
    }
  }
}, 30 * 1000);

/* ===== boot ===== */
setGridHeight(true);
bootProByStoredDate();
renderPicksCta();
loadAll(true).catch(() => { stabilizeLayout(); });

setTimeout(() => {
  if (document.visibilityState === "visible") loadAll(true).catch(() => {});
}, 800);