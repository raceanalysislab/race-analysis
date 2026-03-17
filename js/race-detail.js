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

const RACES_BASE_URL =
  "https://raceanalysislab.github.io/race-analysis/data/site/races/";
const PLAYER_MASTER_URL =
  "https://raceanalysislab.github.io/race-analysis/data/master/players_master.json";
const PLAYER_COURSE_STATS_URL =
  "https://raceanalysislab.github.io/race-analysis/data/player_course_stats.json";
const RACER_GENDER_URL =
  "https://raceanalysislab.github.io/race-analysis/data/master/racer_gender.json";

/* 公開されているメイン側 */
const MEET_AVG_ST_BASE_URL =
  "https://raceanalysislab.github.io/race-analysis/data/meet_avg_st/";

$("venueName").textContent = venueName;

let currentRace = 1;
let currentDate = dateParam || getLocalYMD();
let currentView = 0;

let dragStartX = 0;
let dragStartY = 0;
let dragCurrentX = 0;
let dragCurrentY = 0;
let dragging = false;

let playerMaster = {};
let playerCourseStats = null;
let racerGenderMap = {};
const meetAvgStCache = {};

const SWIPE_THRESHOLD_X = 56;
const SWIPE_THRESHOLD_Y = 28;

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

const formatST = (v) => {
  if (v === undefined || v === null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `.${n.toFixed(2).split(".")[1]}`;
};

const normalizeName = (name) =>
  String(name ?? "")
    .replace(/[\s\u3000]+/g, "")
    .trim();

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

const pickNat3 = (p) => pickValue(p, ["nat_3", "nat3", "nat_three"]);
const pickLoc3 = (p) => pickValue(p, ["loc_3", "loc3", "loc_three"]);
const pickMotor3 = (p) => pickValue(p, ["motor_3", "motor3", "motor_three"]);

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

const buildEntryMeta = (p) => {
  const regno = safeInt(p?.regno);
  const grade = String(p?.grade ?? "").trim() || "—";
  const branch = String(p?.branch ?? "").trim() || "—";

  let age = "—";
  if (p?.age !== undefined && p?.age !== null && p?.age !== "") {
    const n = Number(p.age);
    age = Number.isFinite(n) ? `${Math.trunc(n)}歳` : `${String(p.age).trim()}歳`;
  }

  return `${regno} / ${grade} / ${branch} / ${age}`;
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
  "琵琶湖": "びわこ"
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

function setTopHeight() {
  const raceTopH = Math.ceil($raceTop?.getBoundingClientRect().height || 96);
  const viewTabsH = Math.ceil($viewTabs?.getBoundingClientRect().height || 42);

  document.documentElement.style.setProperty("--raceTopH", `${raceTopH}px`);
  document.documentElement.style.setProperty("--viewTabsH", `${viewTabsH}px`);
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
    const json = await fetchJSON(PLAYER_COURSE_STATS_URL);
    playerCourseStats = json?.players || {};
  } catch (e) {
    playerCourseStats = {};
  }
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

function buildMeetAvgStUrl(venue, date) {
  const venuePart = safeFilenamePart(normalizeVenueForMeetFile(venue));
  const baseDate = String(date || "").trim();
  const targetDate = addDaysYMD(baseDate, -1);
  return `${MEET_AVG_ST_BASE_URL}${venuePart}_${targetDate}.json`;
}

async function loadMeetAvgStForRace(json) {
  const venue = String(json?.venue || venueName || "").trim();
  const date = String(json?.date || currentDate || "").trim();

  if (!venue || !date) return { players: {} };

  const targetDate = addDaysYMD(date, -1);
  const cacheKey = `${venue}|${targetDate}`;

  if (meetAvgStCache[cacheKey]) {
    return meetAvgStCache[cacheKey];
  }

  try {
    const url = buildMeetAvgStUrl(venue, date);
    const payload = await fetchJSON(url);
    meetAvgStCache[cacheKey] = payload || { players: {} };
    return meetAvgStCache[cacheKey];
  } catch (e) {
    meetAvgStCache[cacheKey] = { players: {} };
    return meetAvgStCache[cacheKey];
  }
}

function buildUrls(r, dateStr) {
  const fileName = `${jcd}_${r}R.json`;
  const candidates = [
    `${RACES_BASE_URL}${dateStr}/${fileName}`,
    `${RACES_BASE_URL}${addDaysYMD(dateStr, 1)}/${fileName}`,
    `${RACES_BASE_URL}${addDaysYMD(dateStr, -1)}/${fileName}`
  ];
  return candidates;
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
    course_sashi: kimarite["差"],
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

  const boatsWithCourse = boats.map(enrichBoatWithCourseStats);
  const boatsWithMeet = boatsWithCourse.map((boat) =>
    enrichBoatWithMeetAvgSt(boat, meetPlayers)
  );

  return {
    ...rawJson,
    race: {
      ...race,
      boats: boatsWithMeet
    }
  };
}

function renderEntryTable(boats) {
  $entryTable.innerHTML = boats.map((p) => {
    const fCount = pickF(p);
    const lCount = pickL(p);
    const isFemale = isFemaleRacer(p);
    const displayNameRaw = getPlayerDisplayName(p);
    const metaText = buildEntryMeta(p);

    return `
      <div class="entryRow">
        <div class="entryWaku w${esc(p.waku)}">${esc(p.waku)}</div>

        <div class="entryNameCell${isFemale ? " female" : ""}">
          <div class="entryMeta">${esc(metaText)}</div>
          <div class="entryNameWrap">
            ${isFemale ? '<span class="entryFemaleMark" aria-label="女子レーサー">♡</span>' : ""}
            <div class="entryName">${esc(displayNameRaw)}</div>
          </div>
        </div>

        <div class="entryVal">${formatST(pickAvgST(p))}</div>

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
            <div class="entryStatSub">${safeNum(pickNat3(p))}</div>
          </div>
        </div>

        <div class="entryVal entryVal--stack">
          <div class="entryStatBlock">
            <div class="entryStatMain">${safeNum(p.loc_win)}</div>
            <div class="entryStatSub">${safeNum(p.loc_2)}</div>
            <div class="entryStatSub">${safeNum(pickLoc3(p))}</div>
          </div>
        </div>

        <div class="entryVal entryVal--stack">
          <div class="entryMotorBlock">
            <div class="entryMotorNo">${safeInt(p.motor_no)}</div>
            <div class="entryMotorRate">${safeNum(p.motor_2)}</div>
            <div class="entryMotorRate">${safeNum(pickMotor3(p))}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function renderRaceJSON(r, rawJson) {
  const json = await enrichRaceJSON(rawJson);
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

  const boats = Array.isArray(raceObj.boats) ? raceObj.boats : [];
  renderEntryTable(boats);

  if (window.BOAT_CORE_COURSE?.render) {
    window.BOAT_CORE_COURSE.render(json);
  }

  renderRaceTabs();
  updateUrlRace(r);
  requestAnimationFrame(setTopHeight);
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

  if (window.BOAT_CORE_COURSE?.renderError) {
    window.BOAT_CORE_COURSE.renderError();
  }

  renderRaceTabs();
  updateUrlRace(r);
  requestAnimationFrame(setTopHeight);
}

async function setRace(r) {
  r = clamp(Number(r) || 1, 1, 12);
  currentRace = r;

  renderRaceTabs();
  $entryTable.innerHTML = `<div class="err">読み込み中…</div>`;

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

  requestAnimationFrame(setTopHeight);
}

function bindViewTabs() {
  if (!$viewTabs) return;

  $viewTabs.querySelectorAll(".viewTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewIndex = Number(btn.dataset.view || 0);
      setView(viewIndex);
    });
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
    target.closest(".courseInnerTabs") ||
    target.closest(".courseInnerTab")
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

async function boot() {
  const initialRace = clamp(Number(qs.get("race") || 1), 1, 12);

  renderRaceTabs();
  bindRaceSwipe();
  bindViewTabs();
  setView(0);

  if (window.BOAT_CORE_COURSE?.boot) {
    window.BOAT_CORE_COURSE.boot();
  }

  await Promise.all([
    loadPlayerMaster(),
    loadPlayerCourseStats(),
    loadRacerGender()
  ]);

  await setRace(initialRace);
  requestAnimationFrame(setTopHeight);
}

addEventListener("resize", () => {
  requestAnimationFrame(setTopHeight);
}, { passive: true });

addEventListener("orientationchange", () => {
  requestAnimationFrame(setTopHeight);
}, { passive: true });

$("btnBack").addEventListener("click", () => history.back());

boot();