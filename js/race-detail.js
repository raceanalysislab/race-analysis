const qs = new URLSearchParams(location.search);

const venueName = decodeURIComponent(qs.get("name") || "会場");
const jcd = String(qs.get("jcd") || "").padStart(2, "0");
const dateParam = String(qs.get("date") || "").trim();

const $ = (id) => document.getElementById(id);

const $tabs = $("tabs");
const $raceNoLabel = $("raceNoLabel");
const $timeLabel = $("timeLabel");
const $dayLabel = $("dayLabel");
const $gradeLabel = $("gradeLabel");
const $eventTitle = $("eventTitle");
const $raceTop = $("raceTop");
const $viewTrack = $("viewTrack");
const $entryTable = $("entryTable");
const $viewTabs = $("viewTabs");
const $entryInnerTabs = $("entryInnerTabs");
const $entrySwipe = $("entrySwipe");
const $entrySwipeTrack = $("entrySwipeTrack");
const $motorInfoTable = $("motorInfoTable");

const RACES_BASE_URL = "/data/site/races/";
const PLAYER_MASTER_URL = "/data/master/players_master.json";
const PLAYER_COURSE_STATS_URL = "/data/player_course_stats_1y.json";
const RACER_GENDER_URL = "/data/master/racer_gender.json";
const MEET_PERF_BASE_URL = "/data/meet_perf/";
const MEET_AVG_ST_BASE_URL = "/data/meet_avg_st/";

const MOTOR_DAY_COL_W = 54;
const MOTOR_INFO_COL_W = 52;
const MOTOR_SUMMARY_COL_W = 58;
const MOTOR_GRID_TEMPLATE = `38px 96px ${MOTOR_INFO_COL_W}px repeat(7, ${MOTOR_DAY_COL_W}px) ${MOTOR_SUMMARY_COL_W}px ${MOTOR_SUMMARY_COL_W}px`;
const MOTOR_TABLE_MIN_W =
  38 + 96 + MOTOR_INFO_COL_W + (7 * MOTOR_DAY_COL_W) + (2 * MOTOR_SUMMARY_COL_W);

const SWIPE_THRESHOLD_X = 56;
const SWIPE_THRESHOLD_Y = 28;
const NEW_MOTOR_TEXT = "新モーター（使用実績なし）";

const layoutState = {
  contentMinH: 480,
  entryViewportH: 420,
  entryRowH: 64,
  motorDayCellH: 54
};

$("venueName").textContent = venueName;

let currentRace = 1;
let currentDate = dateParam || getLocalYMD();
let currentView = 0;
let currentEntryView = 0;

let dragStartX = 0;
let dragStartY = 0;
let dragCurrentX = 0;
let dragCurrentY = 0;
let dragging = false;

let playerMaster = {};
let playerCourseStats = {};
let racerGenderMap = {};
let courseStatsLoaded = false;
let courseStatsLoadingPromise = null;
let latestRenderedRaceJson = null;

const meetAvgStCache = {};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const safeNum = (v, digits = 2) => {
  if (v === undefined || v === null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
};

const safeInt = (v) => {
  if (v === undefined || v === null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.trunc(n)) : "—";
};

const normalizeName = (name) =>
  String(name ?? "")
    .replace(/[\s\u3000]+/g, "")
    .trim();

function isKetsujoLike(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "欠" || /^K\d*$/.test(s);
}

function isLateLike(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "L" || /^L\d*$/.test(s);
}

function isShikkakuLike(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "失" || s === "失格" || /^S\d*$/.test(s);
}

function isMotorKetsujo(row) {
  if (!row || typeof row !== "object") return false;

  return (
    row?.is_ketsujo === true ||
    String(row?.status ?? "").trim() === "欠" ||
    isKetsujoLike(row?.finish) ||
    isKetsujoLike(row?.rank) ||
    isKetsujoLike(row?.finish_raw)
  );
}

const getRecentScoreFromRank = (rankLike) => {
  const s = String(rankLike ?? "").trim().toUpperCase();
  if (!s) return null;
  if (isKetsujoLike(s)) return null;
  if (s === "1") return 10;
  if (s === "2") return 8;
  if (s === "3") return 6;
  if (s === "4") return 4;
  if (s === "5") return 2;
  if (s === "6") return 0;
  return null;
};

const pickAvgST = (p) => {
  const candidates = [
    p?.avg_st,
    p?.st_avg,
    p?.ave_st,
    p?.average_st,
    p?.start_average
  ];

  for (const v of candidates) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};

const pickValue = (obj, keys) => {
  for (const key of keys) {
    const v = obj?.[key];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};

const pickF = (p) => {
  const v = pickValue(p, ["f", "F", "f_count", "fCount", "f_num", "fNum"]);
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};

const pickL = (p) => {
  const v = pickValue(p, ["l", "L", "l_count", "lCount", "l_num", "lNum"]);
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};

const renderFLValue = (label, count) => {
  if (!count) return "";
  return `${label}${count}`;
};

function hasDisplayValue(v) {
  return !(v === undefined || v === null || v === "");
}

function pickFirstDefined(...values) {
  for (const v of values) {
    if (hasDisplayValue(v)) return v;
  }
  return "";
}

function isNewMotorBoat(p) {
  return Boolean(p?.is_new_motor || p?.motor_prev?.is_new_motor);
}

const buildEntryMeta = (p) => {
  const regno = safeInt(p?.regno);
  const branch = String(p?.branch ?? "").trim() || "—";

  let age = "—";
  const rawAge = p?.age;
  if (rawAge !== undefined && rawAge !== null && rawAge !== "") {
    const n = Number(rawAge);
    age = Number.isFinite(n) ? `${Math.trunc(n)}歳` : `${String(rawAge).trim()}歳`;
  }

  return `${regno} / ${branch} / ${age}`;
};

const getGradeClassName = (grade) => {
  const g = String(grade ?? "").trim().toLowerCase();
  if (g === "a1") return "a1";
  if (g === "a2") return "a2";
  if (g === "b1") return "b1";
  if (g === "b2") return "b2";
  return "";
};

const getGradeText = (grade) => {
  const g = String(grade ?? "").trim().toUpperCase();
  return g || "—";
};

const getPlayerDisplayName = (p) => {
  const reg = String(p?.regno ?? p?.reg ?? "").trim();
  const master = playerMaster?.[reg];

  if (master) {
    const sei = String(master?.sei ?? "").trim();
    const mei = String(master?.mei ?? "").trim();
    const masterName = String(master?.name ?? "").replace(/\s+/g, "").trim();

    if (sei && mei) return `${sei}${mei}`;
    if (masterName) return masterName;
  }

  return normalizeName(p?.name ?? "");
};

const toHM = (x) => {
  const m = String(x || "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "--:--";
};

const VENUE_FILE_ALIAS = {
  "琵琶湖": "びわこ",
  "びわこ": "びわこ"
};

const safeFilenamePart = (s) =>
  String(s ?? "")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "_");

function normalizeVenueForMeetFile(v) {
  const raw = String(v ?? "").trim();
  return VENUE_FILE_ALIAS[raw] || raw;
}

function getLocalYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYMD(ymd, days) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function normalizeGradeLabel(v) {
  const raw = String(v ?? "").trim();
  const s = raw.toUpperCase();

  if (s.includes("SG")) return "SG";
  if (s.includes("G1") || s.includes("GI")) return "G1";
  if (s.includes("G2") || s.includes("GII")) return "G2";
  if (s.includes("G3") || s.includes("GIII")) return "G3";
  if (raw.includes("一般")) return "一般";

  return raw || "一般";
}

function getViewportHeight() {
  return Math.floor(
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight ||
    0
  );
}

function setTopHeight() {
  const raceTopH = Math.ceil($raceTop?.getBoundingClientRect().height || 96);
  const viewTabsH = Math.ceil($viewTabs?.getBoundingClientRect().height || 42);

  document.documentElement.style.setProperty("--raceTopH", `${raceTopH}px`);
  document.documentElement.style.setProperty("--viewTabsH", `${viewTabsH}px`);
}

function calcEntryRowHeight() {
  const viewportH = getViewportHeight();
  const raceTopH = Math.ceil($raceTop?.getBoundingClientRect().height || 96);
  const viewTabsH = Math.ceil($viewTabs?.getBoundingClientRect().height || 42);
  const entryTabsH = Math.ceil($entryInnerTabs?.getBoundingClientRect().height || 48);

  const safeBottomRaw = getComputedStyle(document.documentElement)
    .getPropertyValue("--safe-bottom")
    .replace("px", "")
    .trim();
  const safeBottom = Number(safeBottomRaw) || 0;

  const tableHeadH = 62;
  const reserve = 6;
  const usableH = viewportH - raceTopH - viewTabsH - entryTabsH - safeBottom - tableHeadH - reserve;

  return clamp(Math.floor(usableH / 6), 49, 66);
}

function syncViewportLayout() {
  setTopHeight();

  const viewportH = getViewportHeight();
  const raceTopH = Math.ceil($raceTop?.getBoundingClientRect().height || 96);
  const viewTabsH = Math.ceil($viewTabs?.getBoundingClientRect().height || 42);
  const entryTabsH = Math.ceil($entryInnerTabs?.getBoundingClientRect().height || 48);

  const safeBottomRaw = getComputedStyle(document.documentElement)
    .getPropertyValue("--safe-bottom")
    .replace("px", "")
    .trim();
  const safeBottom = Number(safeBottomRaw) || 0;

  const contentMinH = clamp(
    Math.floor(viewportH - raceTopH - viewTabsH - safeBottom - 12),
    388,
    980
  );

  const entryViewportH = clamp(
    Math.floor(contentMinH - entryTabsH),
    286,
    920
  );

  const entryRowH = calcEntryRowHeight();

  const motorDayCellH = clamp(
    Math.floor((entryViewportH - 40) / 6),
    49,
    71
  );

  layoutState.contentMinH = contentMinH;
  layoutState.entryViewportH = entryViewportH;
  layoutState.entryRowH = entryRowH;
  layoutState.motorDayCellH = motorDayCellH;

  document.documentElement.style.setProperty("--contentMinH", `${contentMinH}px`);
  document.documentElement.style.setProperty("--entryViewportH", `${entryViewportH}px`);
  document.documentElement.style.setProperty("--entryRowH", `${entryRowH}px`);
  document.documentElement.style.setProperty("--motorDayCellH", `${motorDayCellH}px`);

  document.querySelectorAll(".viewPage").forEach((el) => {
    el.style.minHeight = `${contentMinH}px`;
  });

  if ($entrySwipe) {
    $entrySwipe.style.minHeight = "";
    $entrySwipe.style.height = "auto";
  }

  if ($entrySwipeTrack) {
    $entrySwipeTrack.style.minHeight = "";
    $entrySwipeTrack.style.height = "auto";
  }

  document.querySelectorAll(".entrySwipePage").forEach((el, idx) => {
    if (idx === 0 || idx === 2) {
      el.style.minHeight = `${entryViewportH}px`;
      el.style.height = "auto";
    } else {
      el.style.minHeight = "";
      el.style.height = "auto";
    }
  });

  document.querySelectorAll(".coursePanel, .coursePanelMain, .wakuTrendPanel").forEach((el) => {
    el.style.minHeight = `${entryViewportH}px`;
  });

  document.querySelectorAll(".coursePanelBody, .wakuTrendPanelBody").forEach((el) => {
    el.style.minHeight = `${Math.max(entryViewportH - 2, 0)}px`;
  });

  if ($motorInfoTable) {
    $motorInfoTable.style.minHeight = `${40 + (motorDayCellH * 6)}px`;
  }
}

function getWakuStyles(waku) {
  const n = Number(waku);
  if (n === 1) return { bg: "#ffffff", fg: "#111827", border: "#cfd6e2" };
  if (n === 2) return { bg: "#3d4652", fg: "#ffffff", border: "#3d4652" };
  if (n === 3) return { bg: "#d9685a", fg: "#ffffff", border: "#d9685a" };
  if (n === 4) return { bg: "#5d84d6", fg: "#ffffff", border: "#5d84d6" };
  if (n === 5) return { bg: "#d9ce63", fg: "#111827", border: "#d9ce63" };
  if (n === 6) return { bg: "#63b56f", fg: "#ffffff", border: "#63b56f" };
  return { bg: "#eef2f6", fg: "#6b7280", border: "#d7dde5" };
}

function formatMotorFinish(v, row = null) {
  const raw = String(v ?? "").trim().toUpperCase();
  const finishRaw = String(row?.finish_raw ?? "").trim().toUpperCase();
  const status = String(row?.status ?? "").trim().toUpperCase();

  if (
    row?.is_ketsujo === true ||
    status === "欠" ||
    isKetsujoLike(raw) ||
    isKetsujoLike(finishRaw)
  ) {
    return "欠";
  }

  if (isLateLike(raw) || isLateLike(finishRaw) || status === "L") {
    return "L";
  }

  if (
    isShikkakuLike(raw) ||
    isShikkakuLike(finishRaw) ||
    status === "失" ||
    status === "失格"
  ) {
    return "失";
  }

  if (!raw) return "";
  if (raw === "F" || finishRaw === "F" || status === "F") return "F";

  return raw;
}

function formatMotorST(v, row = null) {
  const raw = String(v ?? "").trim().toUpperCase();
  const finishRaw = String(row?.finish_raw ?? "").trim().toUpperCase();
  const status = String(row?.status ?? "").trim().toUpperCase();

  if (
    row?.is_ketsujo === true ||
    status === "欠" ||
    isKetsujoLike(finishRaw) ||
    isKetsujoLike(raw)
  ) {
    return "";
  }

  if (!raw) return "";
  if (isLateLike(raw) || isLateLike(finishRaw) || status === "L") return "";
  if (isShikkakuLike(raw) || isShikkakuLike(finishRaw) || status === "失" || status === "失格") return "";
  if (raw === "F" || finishRaw === "F" || status === "F") {
    return raw.replace(/^F/, "").replace(/^0(?=\.\d+)/, "");
  }

  return raw.replace(/^F/, "").replace(/^0(?=\.\d+)/, "");
}

function calcMotorScore(days) {
  const flat = Array.isArray(days) ? days.flat() : [];
  const scores = flat
    .filter((row) => row && typeof row === "object" && !isMotorKetsujo(row))
    .map((row) => getRecentScoreFromRank(row?.finish ?? row?.rank))
    .filter((v) => v !== null);

  if (!scores.length) return "";
  return (scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(2);
}

async function fetchJSON(url) {
  const joiner = url.includes("?") ? "&" : "?";
  const cacheBust = Math.floor(Date.now() / 60000);
  const res = await fetch(`${url}${joiner}t=${cacheBust}`, { cache: "no-store" });
  if (!res.ok) throw new Error(url);
  return res.json();
}

async function loadPlayerMaster() {
  try {
    playerMaster = await fetchJSON(PLAYER_MASTER_URL);
  } catch (e) {
    playerMaster = {};
  }
}

async function loadPlayerCourseStats() {
  try {
    const payload = await fetchJSON(PLAYER_COURSE_STATS_URL);
    playerCourseStats = payload?.players || payload || {};
    courseStatsLoaded = true;
  } catch (e) {
    playerCourseStats = {};
    courseStatsLoaded = false;
    throw e;
  }
}

function ensurePlayerCourseStatsLoaded() {
  if (courseStatsLoaded) {
    return Promise.resolve(playerCourseStats);
  }

  if (courseStatsLoadingPromise) {
    return courseStatsLoadingPromise;
  }

  courseStatsLoadingPromise = loadPlayerCourseStats()
    .catch(() => {
      playerCourseStats = {};
      return playerCourseStats;
    })
    .finally(() => {
      courseStatsLoadingPromise = null;
    });

  return courseStatsLoadingPromise;
}

async function loadRacerGender() {
  try {
    racerGenderMap = await fetchJSON(RACER_GENDER_URL);
  } catch (e) {
    racerGenderMap = {};
  }
}

function isFemaleRacer(p) {
  const reg = String(p?.regno ?? p?.reg ?? "").trim();
  return Number(racerGenderMap?.[reg]) === 1;
}

function isFemaleRegno(regno) {
  const reg = String(regno ?? "").trim();
  return Number(racerGenderMap?.[reg]) === 1;
}

function buildMeetAvgStUrl(venue, date) {
  const venuePart = safeFilenamePart(normalizeVenueForMeetFile(venue));
  const targetDate = String(date || "").trim();
  return `${MEET_AVG_ST_BASE_URL}${venuePart}_${targetDate}.json`;
}

async function loadMeetAvgStForRace(json) {
  const venue = String(json?.venue || venueName || "").trim();
  const date = String(json?.date || currentDate || "").trim();

  if (!venue || !date) return { players: {} };

  const cacheKey = `${venue}|${date}`;
  if (meetAvgStCache[cacheKey]) {
    return meetAvgStCache[cacheKey];
  }

  const candidateVenues = Array.from(new Set([
    venue,
    normalizeVenueForMeetFile(venue),
    venueName,
    normalizeVenueForMeetFile(venueName)
  ].filter(Boolean)));

  for (const candidateVenue of candidateVenues) {
    try {
      const payload = await fetchJSON(buildMeetAvgStUrl(candidateVenue, date));
      meetAvgStCache[cacheKey] = payload || { players: {} };
      return meetAvgStCache[cacheKey];
    } catch (e) {
      // try next
    }
  }

  meetAvgStCache[cacheKey] = { players: {} };
  return meetAvgStCache[cacheKey];
}

function buildUrls(r, dateStr) {
  const fileName = `${jcd}_${r}R.json`;
  return [
    `${RACES_BASE_URL}${dateStr}/${fileName}`,
    `${RACES_BASE_URL}${addDaysYMD(dateStr, 1)}/${fileName}`,
    `${RACES_BASE_URL}${addDaysYMD(dateStr, -1)}/${fileName}`
  ];
}

async function fetchRaceJSON(r) {
  let lastErr = null;

  for (const url of buildUrls(r, currentDate)) {
    try {
      const json = await fetchJSON(url);
      if (json?.date) {
        currentDate = String(json.date).trim();
      }
      return json;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr;
}

function renderRaceTabs() {
  if (!$tabs) return;

  $tabs.innerHTML = Array.from({ length: 12 }, (_, i) => {
    const race = i + 1;
    const activeClass = race === currentRace ? " is-active" : "";
    return `<button type="button" class="raceTab${activeClass}" data-race="${race}">${race}R</button>`;
  }).join("");

  $tabs.querySelectorAll(".raceTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const race = Number(btn.dataset.race || 1);
      setRace(race);
    });
  });

  const activeBtn = $tabs.querySelector(`.raceTab[data-race="${currentRace}"]`);
  if (activeBtn && typeof activeBtn.scrollIntoView === "function") {
    activeBtn.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });
  }
}

function updateUrlRace(r) {
  const next = new URL(location.href);
  next.searchParams.set("race", String(r));
  if (currentDate) next.searchParams.set("date", currentDate);
  history.replaceState(null, "", next.toString());
}

function enrichBoatWithCourseStats(boat) {
  const reg = String(boat?.regno ?? boat?.reg ?? "").trim();
  const courseKey = String(boat?.waku ?? "");
  const player = playerCourseStats?.[reg];
  const course = player?.courses?.[courseKey];

  if (!course) return { ...boat };

  const kimarite = course.kimarite || {};

  return {
    ...boat,
    course_starts: course.starts,
    course_win: course.win_rate,
    course_2ren: course.ren2_rate,
    course_3ren: course.ren3_rate,
    course_avg_st: course.avg_st,
    course_sashi: kimarite["差し"],
    course_makuri: kimarite["まくり"],
    course_makurisashi: kimarite["まくり差し"]
  };
}

function findMeetStObject(boat, meetPlayers) {
  const reg = String(boat?.regno ?? boat?.reg ?? "").trim();

  if (reg && meetPlayers?.[reg]) {
    return meetPlayers[reg];
  }

  const targetName = normalizeName(boat?.name || "");
  if (!targetName) return null;

  for (const [key, value] of Object.entries(meetPlayers || {})) {
    if (reg && String(key).trim() === reg) {
      return value;
    }
    if (normalizeName(value?.name || "") === targetName) {
      return value;
    }
  }

  return null;
}

function enrichBoatWithMeetAvgSt(boat, meetPlayers) {
  const stObj = findMeetStObject(boat, meetPlayers);

  if (!stObj) return { ...boat };

  return {
    ...boat,
    meet_avg_st: stObj.avg_st,
    meet_starts: stObj.count
  };
}

async function enrichRaceJSON(rawJson) {
  const race = rawJson?.race || {};
  const boats = Array.isArray(race.boats) ? race.boats : [];

  const meetPayload = await loadMeetAvgStForRace(rawJson);
  const meetPlayers = meetPayload?.players || {};

  const boatsEnriched = boats.map((boat) =>
    enrichBoatWithMeetAvgSt(boat, meetPlayers)
  );

  return {
    ...rawJson,
    race: {
      ...race,
      boats: boatsEnriched
    }
  };
}

function buildRaceJsonWithCourseStats(json) {
  if (!json?.race?.boats || !Array.isArray(json.race.boats)) return json;

  return {
    ...json,
    race: {
      ...json.race,
      boats: json.race.boats.map((boat) => enrichBoatWithCourseStats(boat))
    }
  };
}

function renderEntryTable(boats) {
  const rowH = layoutState.entryRowH;

  $entryTable.innerHTML = boats.map((p) => {
    const fCount = pickF(p);
    const lCount = pickL(p);
    const isFemale = isFemaleRacer(p);
    const displayNameRaw = getPlayerDisplayName(p);
    const metaText = buildEntryMeta(p);
    const gradeText = getGradeText(p?.grade);
    const gradeClass = getGradeClassName(p?.grade);

    return `
      <div class="entryRow" style="border-bottom:1px solid #d7dde5;height:${rowH}px;min-height:${rowH}px;max-height:${rowH}px;">
        <div class="entryWaku w${esc(p.waku)}">${esc(p.waku)}</div>

        <div class="entryNameCell${isFemale ? " female" : ""}">
          <div class="entryMeta">${esc(metaText)}</div>
          <div class="entryNameWrap">
            ${isFemale ? '<span class="entryFemaleMark">♡</span>' : ""}
            <div class="entryName"><span style="color:#111827;">${esc(displayNameRaw)}</span></div>
          </div>
        </div>

        <div class="entryGrade ${esc(gradeClass)}">${esc(gradeText)}</div>
        <div class="entryVal">${safeNum(pickAvgST(p))}</div>
        <div class="entryVal entryVal--stack entryVal--fl">
          <div class="entryStatBlock entryStatBlock--fl">
            <div class="entryStatMain entryStatMain--f">${esc(renderFLValue("F", fCount))}</div>
            <div class="entryStatSub entryStatSub--l">${esc(renderFLValue("L", lCount))}</div>
          </div>
        </div>

        <div class="entryVal entryVal--stack">
          <div class="entryStatBlock">
            <div class="entryStatMain">${safeNum(p.nat_win)}</div>
            <div class="entryStatSub">${safeNum(p.nat_2)}</div>
          </div>
        </div>

        <div class="entryVal entryVal--stack">
          <div class="entryStatBlock">
            <div class="entryStatMain">${safeNum(p.loc_win)}</div>
            <div class="entryStatSub">${safeNum(p.loc_2)}</div>
          </div>
        </div>

        <div class="entryVal entryVal--stack">
          <div class="entryMotorBlock">
            <div class="entryMotorNo">${safeInt(p.motor_no)}</div>
            <div class="entryMotorRate">${safeNum(p.motor_2)}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  $entryTable.style.height = `${rowH * 6}px`;
  $entryTable.style.minHeight = `${rowH * 6}px`;
  $entryTable.style.maxHeight = `${rowH * 6}px`;
  $entryTable.style.overflow = "hidden";
}

function normalizeMotorPrevDays(days) {
  if (!Array.isArray(days)) {
    return Array.from({ length: 7 }, () => [null, null]);
  }

  const out = [];

  for (let i = 0; i < 7; i++) {
    const day = Array.isArray(days[i]) ? days[i] : [];
    out.push([
      day[0] && typeof day[0] === "object" ? day[0] : null,
      day[1] && typeof day[1] === "object" ? day[1] : null
    ]);
  }

  return out;
}

function renderMotorOneRun(row) {
  const cellH = layoutState.motorDayCellH;
  const topH = Math.max(16, Math.floor(cellH / 3));
  const midH = Math.max(16, Math.floor(cellH / 3));
  const bottomH = Math.max(16, cellH - topH - midH);

  if (!row) {
    return `
      <div style="
        display:grid;
        grid-template-rows:${topH}px ${midH}px ${bottomH}px;
        min-height:${cellH}px;
        height:${cellH}px;
        background:#fff;
        width:100%;
      ">
        <div style="
          display:flex;
          align-items:center;
          justify-content:center;
          border-bottom:1px solid #d7dde5;
        ">
          <div style="width:18px;height:18px;"></div>
        </div>

        <div style="
          display:flex;
          align-items:center;
          justify-content:center;
          border-bottom:1px solid #d7dde5;
          font-size:10px;
          line-height:1;
          color:#1f2937;
          text-align:center;
          width:100%;
        ">&nbsp;</div>

        <div style="
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:11px;
          line-height:1;
          color:#2d5ec7;
          text-align:center;
          width:100%;
          font-weight:800;
          text-decoration:underline;
        ">&nbsp;</div>
      </div>
    `;
  }

  const isKetsujo = isMotorKetsujo(row);
  const displayCourse = isKetsujo ? "" : (row?.course ?? row?.waku ?? "");
  const colorWaku = isKetsujo ? "" : (row?.waku ?? row?.course ?? "");
  const st = formatMotorST(row?.st, row);
  const finish = formatMotorFinish(row?.finish ?? row?.rank, row);
  const isF = finish === "F";
  const colors = getWakuStyles(colorWaku);
  const bottomColor = isKetsujo ? "#2d5ec7" : (isF ? "#d83939" : "#2d5ec7");

  return `
    <div style="
      display:grid;
      grid-template-rows:${topH}px ${midH}px ${bottomH}px;
      min-height:${cellH}px;
      height:${cellH}px;
      background:#fff;
      width:100%;
    ">
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        border-bottom:1px solid #d7dde5;
      ">
        <div style="
          width:18px;
          height:18px;
          display:flex;
          align-items:center;
          justify-content:center;
          border:${displayCourse !== "" ? `1px solid ${colors.border}` : "1px solid transparent"};
          background:${displayCourse !== "" ? colors.bg : "transparent"};
          color:${displayCourse !== "" ? colors.fg : "transparent"};
          font-weight:800;
          font-size:13px;
          line-height:1;
        ">${displayCourse !== "" ? esc(displayCourse) : "&nbsp;"}</div>
      </div>

      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        border-bottom:1px solid #d7dde5;
        font-size:10px;
        line-height:1;
        color:#1f2937;
        text-align:center;
        width:100%;
      ">${st ? esc(st) : "&nbsp;"}</div>

      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:11px;
        line-height:1;
        color:${bottomColor};
        font-weight:800;
        text-align:center;
        width:100%;
        text-decoration:underline;
      ">${finish !== "" ? esc(finish) : "&nbsp;"}</div>
    </div>
  `;
}

function renderMotorDayItems(dayPair) {
  const pair = Array.isArray(dayPair) ? dayPair : [null, null];
  const leftRow = pair[0] || null;
  const rightRow = pair[1] || null;
  const cellH = layoutState.motorDayCellH;

  return `
    <div style="
      display:grid;
      grid-template-columns:1fr 1fr;
      min-height:${cellH}px;
      height:${cellH}px;
      width:${MOTOR_DAY_COL_W}px;
      min-width:${MOTOR_DAY_COL_W}px;
      max-width:${MOTOR_DAY_COL_W}px;
      align-items:stretch;
      justify-items:stretch;
      overflow:hidden;
    ">
      <div style="
        display:flex;
        align-items:stretch;
        justify-content:stretch;
        min-width:0;
        width:100%;
        overflow:hidden;
      ">
        ${renderMotorOneRun(leftRow)}
      </div>

      <div style="
        display:flex;
        align-items:stretch;
        justify-content:stretch;
        min-width:0;
        width:100%;
        overflow:hidden;
        border-left:1px solid #d7dde5;
      ">
        ${renderMotorOneRun(rightRow)}
      </div>
    </div>
  `;
}

function renderMotorInfoTable(boats) {
  if (!$motorInfoTable) return;

  const dayLabels = ["1日目", "2日目", "3日目", "4日目", "5日目", "6日目", "7日目"];
  const cellH = layoutState.motorDayCellH;

  $motorInfoTable.innerHTML = `
    <div style="background:#fff;">
      <div style="
        display:grid;
        grid-template-columns:${MOTOR_GRID_TEMPLATE};
        border-bottom:1px solid #d7dde5;
        background:#eef1f4;
        min-width:${MOTOR_TABLE_MIN_W}px;
      ">
        <div style="padding:6px 2px;border-right:1px solid #d7dde5;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#5f6978;">枠</div>
        <div style="padding:6px 3px;border-right:1px solid #d7dde5;display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:700;color:#5f6978;">前回使用者</div>
        <div style="padding:6px 2px;border-right:1px solid #d7dde5;display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:700;color:#5f6978;">モーター<br>No.</div>
        ${dayLabels.map((label) => `
          <div style="
            padding:6px 1px;
            border-right:1px solid #d7dde5;
            display:flex;
            align-items:center;
            justify-content:center;
            text-align:center;
            font-size:11px;
            font-weight:700;
            color:#5f6978;
            width:${MOTOR_DAY_COL_W}px;
            min-width:${MOTOR_DAY_COL_W}px;
            max-width:${MOTOR_DAY_COL_W}px;
          ">${label}</div>
        `).join("")}
        <div style="padding:6px 2px;border-right:1px solid #d7dde5;display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:700;color:#5f6978;">平均ST</div>
        <div style="padding:6px 2px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:700;color:#5f6978;">勝率</div>
      </div>

      ${boats.map((p) => {
        const prev = (p?.motor_prev && typeof p.motor_prev === "object") ? p.motor_prev : {};
        const isNewMotor = isNewMotorBoat(p);
        const prevRegno = isNewMotor ? "" : String(prev?.prev_rider_regno ?? "").trim();
        const prevIsFemale = !isNewMotor && isFemaleRegno(prevRegno);

        const prevNameBase = isNewMotor
          ? NEW_MOTOR_TEXT
          : (normalizeName(
              pickFirstDefined(
                prev?.prev_rider_name,
                prev?.prev_rider,
                ""
              )
            ) || "—");

        const prevMaster = !isNewMotor ? (playerMaster?.[prevRegno] || {}) : {};

        const prevBranch = isNewMotor
          ? ""
          : pickFirstDefined(
              prev?.prev_rider_branch,
              prevMaster?.branch,
              ""
            );

        const prevAge = isNewMotor
          ? ""
          : pickFirstDefined(
              prev?.prev_rider_age,
              prevMaster?.age,
              ""
            );

        const prevMeta = isNewMotor
          ? "— / — / —"
          : buildEntryMeta({
              regno: prev?.prev_rider_regno,
              branch: prevBranch,
              age: prevAge
            });

        const days = isNewMotor
          ? Array.from({ length: 7 }, () => [null, null])
          : normalizeMotorPrevDays(prev?.days);

        const avgSt = isNewMotor
          ? ""
          : pickFirstDefined(
              prev?.avg_st,
              prev?.average_st,
              prev?.mean_st,
              ""
            );

        const rateScore = isNewMotor ? "" : calcMotorScore(days);

        const motorNo =
          pickFirstDefined(
            prev?.motor_no,
            p?.motor_no,
            ""
          );

        const wakuStyles = getWakuStyles(p.waku);

        return `
          <div style="
            display:grid;
            grid-template-columns:${MOTOR_GRID_TEMPLATE};
            border-bottom:1px solid #d7dde5;
            min-width:${MOTOR_TABLE_MIN_W}px;
            background:#fff;
          ">
            <div style="
              display:flex;
              align-items:center;
              justify-content:center;
              border-right:1px solid #d7dde5;
              font-size:17px;
              font-weight:800;
              min-height:${cellH}px;
              background:${wakuStyles.bg};
              color:${wakuStyles.fg};
            ">${esc(p.waku)}</div>

            <div style="
              border-right:1px solid #d7dde5;
              padding:4px 5px;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:center;
              text-align:center;
              min-height:${cellH}px;
              background:${prevIsFemale ? "#fff2f7" : "#fff"};
            ">
              <div style="font-size:9px;line-height:1.1;color:#7a8597;font-weight:700;margin-bottom:3px;">${esc(prevMeta)}</div>
              <div style="font-size:${isNewMotor ? "11px" : "14px"};line-height:1.2;font-weight:800;color:${isNewMotor ? "#2d5ec7" : "#111827"};word-break:break-word;">
                ${prevIsFemale ? '<span style="color:#d85b96;font-weight:800;">♡</span> ' : ""}${esc(prevNameBase)}
              </div>
            </div>

            <div style="
              border-right:1px solid #d7dde5;
              padding:4px 2px;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:center;
              gap:2px;
              min-height:${cellH}px;
            ">
              <div style="font-size:9px;color:#7a8597;">モーター</div>
              <div style="font-size:14px;font-weight:800;color:#111827;">${safeInt(motorNo)}</div>
            </div>

            ${dayLabels.map((_, idx) => `
              <div style="
                border-right:1px solid #d7dde5;
                padding:0;
                display:flex;
                align-items:stretch;
                justify-content:stretch;
                background:#fff;
                min-height:${cellH}px;
                width:${MOTOR_DAY_COL_W}px;
                min-width:${MOTOR_DAY_COL_W}px;
                max-width:${MOTOR_DAY_COL_W}px;
                overflow:hidden;
              ">
                ${renderMotorDayItems(days[idx])}
              </div>
            `).join("")}

            <div style="
              border-right:1px solid #d7dde5;
              padding:4px 2px;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:center;
              gap:2px;
              min-height:${cellH}px;
            ">
              <div style="font-size:9px;color:#7a8597;">平均ST</div>
              <div style="font-size:12px;font-weight:800;color:#111827;text-align:center;">${safeNum(avgSt)}</div>
            </div>

            <div style="
              padding:4px 2px;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:center;
              gap:2px;
              min-height:${cellH}px;
            ">
              <div style="font-size:9px;color:#7a8597;">勝率</div>
              <div style="font-size:12px;font-weight:800;color:#111827;text-align:center;">${rateScore ? esc(rateScore) : "—"}</div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  $motorInfoTable.style.minHeight = `${40 + (cellH * 6)}px`;
}

async function renderRaceJSON(r, rawJson) {
  const json = await enrichRaceJSON(rawJson);
  latestRenderedRaceJson = json;

  const raceObj = json?.race || {};

  if (json?.date) {
    currentDate = String(json.date).trim();
  }

  $raceNoLabel.textContent = `${r}R`;
  $timeLabel.textContent = `締切: ${toHM(raceObj.cutoff)}`;
  $dayLabel.textContent = json?.day_label || raceObj?.day_label || "—";

  if ($gradeLabel) {
    $gradeLabel.textContent = normalizeGradeLabel(
      json?.grade_label || raceObj?.grade_label || "一般"
    );
  }

  if ($eventTitle) {
    const title = String(
      json?.event_title || json?.title || raceObj?.title || ""
    ).trim();
    $eventTitle.textContent = title || "—";
    $eventTitle.title = title || "";
  }

  const boats = Array.isArray(json?.race?.boats) ? json.race.boats : [];

  syncViewportLayout();
  renderEntryTable(boats);
  renderMotorInfoTable(boats);

  window.BOAT_CORE_MEET_PERF?.setRaceContext({
    date: String(json?.date || currentDate || "").trim()
  });
  await window.BOAT_CORE_MEET_PERF?.render(boats, json);

  if (window.BOAT_CORE_COURSE?.render) {
    window.BOAT_CORE_COURSE.render(json);
  }

  ensurePlayerCourseStatsLoaded().then(() => {
    if (!latestRenderedRaceJson) return;
    const courseJson = buildRaceJsonWithCourseStats(latestRenderedRaceJson);
    if (window.BOAT_CORE_COURSE?.render) {
      window.BOAT_CORE_COURSE.render(courseJson);
    }
    requestAnimationFrame(syncViewportLayout);
  });

  setEntryView(currentEntryView);
  renderRaceTabs();
  updateUrlRace(r);

  requestAnimationFrame(() => {
    syncViewportLayout();
    setEntryView(currentEntryView);
  });
}

function renderRaceError(r) {
  $raceNoLabel.textContent = `${r}R`;
  $timeLabel.textContent = "締切: --:--";
  $dayLabel.textContent = "—";

  if ($gradeLabel) $gradeLabel.textContent = "—";

  if ($eventTitle) {
    $eventTitle.textContent = "—";
    $eventTitle.title = "";
  }

  $entryTable.innerHTML = `<div class="err">JSON取得失敗</div>`;
  if ($motorInfoTable) {
    $motorInfoTable.innerHTML = `<div class="meetPerfEmpty">モーター情報を取得できませんでした</div>`;
  }

  window.BOAT_CORE_MEET_PERF?.renderError();

  if (window.BOAT_CORE_COURSE?.renderError) {
    window.BOAT_CORE_COURSE.renderError();
  }

  setEntryView(currentEntryView);
  renderRaceTabs();
  updateUrlRace(r);

  requestAnimationFrame(() => {
    syncViewportLayout();
    setEntryView(currentEntryView);
  });
}

async function setRace(r) {
  r = clamp(Number(r) || 1, 1, 12);
  currentRace = r;

  renderRaceTabs();
  $entryTable.innerHTML = `<div class="err">読み込み中…</div>`;
  if ($motorInfoTable) {
    $motorInfoTable.innerHTML = `<div class="meetPerfEmpty">モーター情報を読み込み中…</div>`;
  }

  window.BOAT_CORE_MEET_PERF?.renderLoading();

  if (window.BOAT_CORE_COURSE?.renderLoading) {
    window.BOAT_CORE_COURSE.renderLoading();
  }

  try {
    const json = await fetchRaceJSON(r);
    await renderRaceJSON(r, json);
  } catch (e) {
    renderRaceError(r);
  }
}

function setView(viewIndex) {
  currentView = clamp(Number(viewIndex) || 0, 0, 2);

  const x = currentView * -100;
  if ($viewTrack) {
    $viewTrack.style.transform = `translate3d(${x}%, 0, 0)`;
  }

  $viewTabs?.querySelectorAll(".viewTab").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.view) === currentView);
  });

  requestAnimationFrame(syncViewportLayout);
}

function setEntryView(viewIndex) {
  currentEntryView = clamp(Number(viewIndex) || 0, 0, 2);

  const x = currentEntryView * -100;
  if ($entrySwipeTrack) {
    $entrySwipeTrack.style.transform = `translate3d(${x}%, 0, 0)`;
  }

  $entryInnerTabs?.querySelectorAll(".entryInnerTab").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.entryView) === currentEntryView);
  });

  requestAnimationFrame(syncViewportLayout);
}

function bindViewTabs() {
  if (!$viewTabs) return;

  $viewTabs.querySelectorAll(".viewTab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const viewIndex = Number(btn.dataset.view || 0);
      setView(viewIndex);
    });
  });
}

function bindEntryInnerTabs() {
  if (!$entryInnerTabs) return;

  $entryInnerTabs.querySelectorAll(".entryInnerTab").forEach((btn) => {
    const apply = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const viewIndex = Number(btn.dataset.entryView || 0);
      setEntryView(viewIndex);
    };

    btn.addEventListener("click", apply);
    btn.addEventListener("touchend", apply, { passive: false });
  });
}

function isInteractiveTarget(target) {
  if (!target || !(target instanceof Element)) return false;

  return Boolean(
    target.closest("a") ||
    target.closest("button") ||
    target.closest("input") ||
    target.closest("textarea") ||
    target.closest("select") ||
    target.closest("[data-player-link]")
  );
}

function isSwipeIgnoreTarget(target) {
  if (!target || !(target instanceof Element)) return false;

  return Boolean(
    isInteractiveTarget(target) ||
    target.closest(".raceTabs") ||
    target.closest(".raceTab") ||
    target.closest(".viewTabs") ||
    target.closest(".viewTab") ||
    target.closest(".entryInnerTabs") ||
    target.closest(".entryInnerTab") ||
    target.closest("#entrySwipe") ||
    target.closest(".entrySwipe") ||
    target.closest(".entrySwipeTrack") ||
    target.closest(".entrySwipePage") ||
    target.closest(".meetPerfBoard") ||
    target.closest(".meetPerfTable") ||
    target.closest(".meetPerfHead") ||
    target.closest(".courseInnerTabs") ||
    target.closest(".courseInnerTab") ||
    target.closest(".coursePanelBody") ||
    target.closest(".courseSimpleTable") ||
    target.closest(".wakuTrendRoot") ||
    target.closest(".wakuTrendPanel") ||
    target.closest(".wakuTrendPanelBody") ||
    target.closest(".wakuTrendRecent") ||
    target.closest(".wakuTrendRecentCell") ||
    target.closest("#motorInfoTable")
  );
}

function handleSwipeStart(clientX, clientY) {
  dragStartX = clientX;
  dragStartY = clientY;
  dragCurrentX = clientX;
  dragCurrentY = clientY;
  dragging = true;
}

function handleSwipeMove(clientX, clientY) {
  if (!dragging) return;
  dragCurrentX = clientX;
  dragCurrentY = clientY;
}

function handleSwipeEnd() {
  if (!dragging) return;

  const diffX = dragCurrentX - dragStartX;
  const diffY = dragCurrentY - dragStartY;
  dragging = false;

  if (Math.abs(diffX) < SWIPE_THRESHOLD_X) return;
  if (Math.abs(diffY) > SWIPE_THRESHOLD_Y) return;
  if (Math.abs(diffY) > Math.abs(diffX) * 0.55) return;

  if (diffX < 0) {
    setRace(currentRace + 1);
  } else {
    setRace(currentRace - 1);
  }
}

function bindRaceSwipe() {
  const swipeArea = document;

  swipeArea.addEventListener("touchstart", (e) => {
    if (!e.touches?.length) return;
    if (isSwipeIgnoreTarget(e.target)) {
      dragging = false;
      return;
    }
    handleSwipeStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  swipeArea.addEventListener("touchmove", (e) => {
    if (!e.touches?.length) return;
    if (!dragging) return;
    handleSwipeMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  swipeArea.addEventListener("touchend", () => {
    if (!dragging) return;
    handleSwipeEnd();
  }, { passive: true });

  swipeArea.addEventListener("mousedown", (e) => {
    if (isSwipeIgnoreTarget(e.target)) {
      dragging = false;
      return;
    }
    handleSwipeStart(e.clientX, e.clientY);
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    handleSwipeMove(e.clientX, e.clientY);
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    handleSwipeEnd();
  });
}

function bindEntrySwipeBlocker() {
  if (!$entrySwipe) return;

  $entrySwipe.addEventListener("touchstart", (e) => {
    e.stopPropagation();
  }, { passive: true });

  $entrySwipe.addEventListener("touchmove", (e) => {
    e.stopPropagation();
  }, { passive: true });

  $entrySwipe.addEventListener("touchend", (e) => {
    e.stopPropagation();
  }, { passive: true });

  $entrySwipe.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  $entrySwipe.addEventListener("mousemove", (e) => {
    e.stopPropagation();
  });

  $entrySwipe.addEventListener("mouseup", (e) => {
    e.stopPropagation();
  });
}

async function boot() {
  const initialRace = clamp(Number(qs.get("race") || 1), 1, 12);

  renderRaceTabs();
  bindRaceSwipe();
  bindViewTabs();
  bindEntryInnerTabs();
  bindEntrySwipeBlocker();
  setView(0);
  setEntryView(0);

  window.BOAT_CORE_MEET_PERF?.setConfig({
    baseUrl: MEET_PERF_BASE_URL,
    jcd,
    getPlayerDisplayName
  });
  window.BOAT_CORE_MEET_PERF?.boot();

  if (window.BOAT_CORE_COURSE?.boot) {
    window.BOAT_CORE_COURSE.boot();
  }

  await Promise.all([
    loadPlayerMaster(),
    loadRacerGender()
  ]);

  syncViewportLayout();
  await setRace(initialRace);

  requestAnimationFrame(() => {
    syncViewportLayout();
    setEntryView(currentEntryView);
  });
}

addEventListener("resize", () => {
  requestAnimationFrame(() => {
    syncViewportLayout();
    setEntryView(currentEntryView);
  });
}, { passive: true });

addEventListener("orientationchange", () => {
  requestAnimationFrame(() => {
    syncViewportLayout();
    setEntryView(currentEntryView);
  });
}, { passive: true });

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    requestAnimationFrame(() => {
      syncViewportLayout();
      setEntryView(currentEntryView);
    });
  }, { passive: true });
}

$("btnBack").addEventListener("click", () => history.back());

boot();

