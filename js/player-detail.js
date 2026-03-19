const qs = new URLSearchParams(location.search);

const playerName = decodeURIComponent(qs.get("name") || "選手情報");
const regno = String(qs.get("regno") || "").trim();
const grade = String(qs.get("grade") || "").trim().toUpperCase();
const branch = String(qs.get("branch") || "").trim();
const age = String(qs.get("age") || "").trim();
const venue = decodeURIComponent(qs.get("venue") || "—");
const race = String(qs.get("race") || "").trim();
const date = String(qs.get("date") || "").trim();
const waku = Number(qs.get("waku") || 1);

const PLAYER_COURSE_STATS_1Y_URL =
  "https://raceanalysislab.github.io/race-analysis/data/player_course_stats_1y.json";
const PLAYER_COURSE_STATS_3Y_URL =
  "https://raceanalysislab.github.io/race-analysis/data/player_course_stats_3y.json";
const PLAYER_OTHER_BOAT_TRENDS_1Y_URL =
  "https://raceanalysislab.github.io/race-analysis/data/player_other_boat_trends_1y.json";
const PLAYER_OTHER_BOAT_TRENDS_3Y_URL =
  "https://raceanalysislab.github.io/race-analysis/data/player_other_boat_trends_3y.json";

const $ = (id) => document.getElementById(id);

$("playerName").textContent = playerName;
$("playerMetaInline").textContent = [regno, grade, branch, age ? `${age}歳` : ""]
  .filter(Boolean)
  .join(" / ");
$("playerVenue").textContent = venue || "—";
$("playerRace").textContent = race ? `${race}R` : "—R";
$("playerDate").textContent = date || "—";

$("btnBack").addEventListener("click", () => history.back());

const COURSE_ORDER = [1, 2, 3, 4, 5, 6];

const RADAR_SIZE = 320;
const RADAR_CX = 160;
const RADAR_CY = 154;
const RADAR_GRID_MAX_R = 112;
const RADAR_VALUE_MAX_R = RADAR_GRID_MAX_R;
const RADAR_LABEL_R = 126;
const RADAR_SCORE_MAX = 10;
const RADAR_ANGLES = [-90, -30, 30, 90, 150, 210].map((deg) => deg * Math.PI / 180);

const EMPTY_KIMARITE = {
  "逃げ": 0,
  "差": 0,
  "まくり": 0,
  "まくり差し": 0,
  "抜き": 0,
  "恵まれ": 0
};

const EMPTY_COURSE_DATA = {
  1: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  2: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  3: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  4: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  5: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  6: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } }
};

const EMPTY_TABLE_DATA = {
  starts: ["—", "—", "—", "—", "—", "—"],
  first: ["—", "—", "—", "—", "—", "—"],
  second: ["—", "—", "—", "—", "—", "—"],
  third: ["—", "—", "—", "—", "—", "—"],
  winRate: ["—", "—", "—", "—", "—", "—"],
  ren2Rate: ["—", "—", "—", "—", "—", "—"],
  ren3Rate: ["—", "—", "—", "—", "—", "—"],
  avgSt: ["—", "—", "—", "—", "—", "—"],
  nige: ["—", "—", "—", "—", "—", "—"],
  sashi: ["—", "—", "—", "—", "—", "—"],
  makuri: ["—", "—", "—", "—", "—", "—"],
  makurisashi: ["—", "—", "—", "—", "—", "—"],
  nuki: ["—", "—", "—", "—", "—", "—"],
  megumare: ["—", "—", "—", "—", "—", "—"]
};

const EMPTY_OTHER_BASE_RAW = {
  1: { starts: null, others: {} },
  2: { starts: null, others: {} },
  3: { starts: null, others: {} },
  4: { starts: null, others: {} },
  5: { starts: null, others: {} },
  6: { starts: null, others: {} }
};

const DATASETS = {
  "1y": {
    type: "player",
    courseData: structuredClone(EMPTY_COURSE_DATA)
  },
  "3y": {
    type: "player",
    courseData: structuredClone(EMPTY_COURSE_DATA)
  },
  "other1y": {
    type: "other",
    raw: structuredClone(EMPTY_OTHER_BASE_RAW)
  },
  "other3y": {
    type: "other",
    raw: structuredClone(EMPTY_OTHER_BASE_RAW)
  }
};

let selectedCourse = Math.min(6, Math.max(1, Number.isFinite(waku) ? waku : 1));
let selectedRange = "1y";
let radarAnimationFrame = null;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cloneEmptyKimarite() {
  return {
    "逃げ": 0,
    "差": 0,
    "まくり": 0,
    "まくり差し": 0,
    "抜き": 0,
    "恵まれ": 0
  };
}

function getCurrentDataset() {
  return DATASETS[selectedRange] || DATASETS["1y"];
}

function isOtherMode() {
  return getCurrentDataset().type === "other";
}

function getCurrentOtherBase() {
  const dataset = getCurrentDataset();
  if (dataset.type !== "other") return null;
  return dataset.raw?.[selectedCourse] || null;
}

function getOtherBucket(base, otherCourse) {
  if (!base) return null;
  const raw = base.others?.[String(otherCourse)] || base.others?.[otherCourse] || null;
  if (!raw) return null;

  const kim = raw.kimarite || raw.win_kimarite || raw.winning_kimarite || {};
  return {
    starts: num(raw.starts) ?? 0,
    first: num(raw.first) ?? 0,
    second: num(raw.second) ?? 0,
    third: num(raw.third) ?? 0,
    firstRate: num(raw.first_rate),
    ren2Rate: num(raw.ren2_rate),
    ren3Rate: num(raw.ren3_rate),
    kimarite: {
      "逃げ": num(kim["逃げ"]) ?? 0,
      "差": num(kim["差"]) ?? 0,
      "まくり": num(kim["まくり"]) ?? 0,
      "まくり差し": num(kim["まくり差し"]) ?? 0,
      "抜き": num(kim["抜き"]) ?? 0,
      "恵まれ": num(kim["恵まれ"]) ?? 0
    }
  };
}

function sumOtherKimarite(base) {
  const out = cloneEmptyKimarite();
  if (!base) return out;

  COURSE_ORDER.forEach((otherCourse) => {
    const b = getOtherBucket(base, otherCourse);
    if (!b) return;

    out["逃げ"] += b.kimarite["逃げ"];
    out["差"] += b.kimarite["差"];
    out["まくり"] += b.kimarite["まくり"];
    out["まくり差し"] += b.kimarite["まくり差し"];
    out["抜き"] += b.kimarite["抜き"];
    out["恵まれ"] += b.kimarite["恵まれ"];
  });

  return out;
}

function aggregateOtherBase(base) {
  if (!base) {
    return {
      starts: null,
      first: 0,
      second: 0,
      third: 0,
      kimarite: cloneEmptyKimarite()
    };
  }

  let first = 0;
  let second = 0;
  let third = 0;

  COURSE_ORDER.forEach((otherCourse) => {
    const b = getOtherBucket(base, otherCourse);
    if (!b) return;
    first += b.first;
    second += b.second;
    third += b.third;
  });

  return {
    starts: num(base.starts),
    first,
    second,
    third,
    kimarite: sumOtherKimarite(base)
  };
}

function applyHeroGradeTheme() {
  document.body.classList.remove(
    "hero-grade-a1",
    "hero-grade-a2",
    "hero-grade-b1",
    "hero-grade-b2"
  );

  if (grade === "A1") {
    document.body.classList.add("hero-grade-a1");
    return;
  }
  if (grade === "A2") {
    document.body.classList.add("hero-grade-a2");
    return;
  }
  if (grade === "B2") {
    document.body.classList.add("hero-grade-b2");
    return;
  }

  document.body.classList.add("hero-grade-b1");
}

function upgradeDataTabs() {
  const root = $("playerDataTabs");
  if (!root) return;

  root.innerHTML = `
    <button type="button" class="playerDataTab is-active" data-range="1y">直近1年データ</button>
    <button type="button" class="playerDataTab" data-range="3y">直近3年データ</button>
    <button type="button" class="playerDataTab" data-range="other1y">他艇傾向1年</button>
    <button type="button" class="playerDataTab" data-range="other3y">他艇傾向3年</button>
  `;
}

function makeCourseTabs() {
  const root = $("courseHeroTabs");
  if (!root) return;

  root.innerHTML = COURSE_ORDER.map((n) => `
    <button
      type="button"
      class="courseHeroTab${n === selectedCourse ? " is-active" : ""}"
      data-course="${n}"
      aria-pressed="${n === selectedCourse ? "true" : "false"}"
    >${n}</button>
  `).join("");

  root.querySelectorAll(".courseHeroTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextCourse = Number(btn.dataset.course || 1);
      if (nextCourse === selectedCourse) return;

      selectedCourse = nextCourse;
      makeCourseTabs();
      renderTables();
      renderHeroText();
      layoutRadarLabels();
      animateRadar();
    });
  });
}

function bindRangeTabs() {
  const root = $("playerDataTabs");
  if (!root) return;

  root.querySelectorAll(".playerDataTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextRange = String(btn.dataset.range || "1y");
      if (nextRange === selectedRange) return;

      selectedRange = nextRange;

      root.querySelectorAll(".playerDataTab").forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.range === selectedRange);
      });

      renderTables();
      renderHeroText();
      animateRadar();
    });
  });
}

function polygonPointsFromRadius(r) {
  return RADAR_ANGLES.map((a) => {
    const x = RADAR_CX + Math.cos(a) * r;
    const y = RADAR_CY + Math.sin(a) * r;
    return `${x},${y}`;
  }).join(" ");
}

function buildRadarGrid() {
  const g = $("courseRadarGrid");
  if (!g) return;

  const levels = [
    RADAR_GRID_MAX_R * 0.2,
    RADAR_GRID_MAX_R * 0.4,
    RADAR_GRID_MAX_R * 0.6,
    RADAR_GRID_MAX_R * 0.8,
    RADAR_GRID_MAX_R
  ];

  g.innerHTML = "";

  levels.forEach((r) => {
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", polygonPointsFromRadius(r));
    g.appendChild(poly);
  });

  RADAR_ANGLES.forEach((a) => {
    const x = RADAR_CX + Math.cos(a) * RADAR_GRID_MAX_R;
    const y = RADAR_CY + Math.sin(a) * RADAR_GRID_MAX_R;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", RADAR_CX);
    line.setAttribute("y1", RADAR_CY);
    line.setAttribute("x2", x);
    line.setAttribute("y2", y);
    g.appendChild(line);
  });
}

function ensureRadarExtraLayers() {
  const svg = document.querySelector(".courseRadarSvg");
  if (!svg) return;

  const core = $("courseRadarPolygonCore");
  if (core) core.remove();

  const stage = document.querySelector(".courseRadarStage");
  if (stage && !stage.querySelector(".courseRadarGlow")) {
    const glow = document.createElement("div");
    glow.className = "courseRadarGlow";
    stage.insertBefore(glow, svg);
  }

  if (stage && !stage.querySelector(".courseRadarNodes")) {
    const nodes = document.createElement("div");
    nodes.className = "courseRadarNodes";
    nodes.innerHTML = `
      <div class="courseRadarNode" id="courseRadarNode1"></div>
      <div class="courseRadarNode" id="courseRadarNode2"></div>
      <div class="courseRadarNode" id="courseRadarNode3"></div>
      <div class="courseRadarNode" id="courseRadarNode4"></div>
      <div class="courseRadarNode" id="courseRadarNode5"></div>
      <div class="courseRadarNode" id="courseRadarNode6"></div>
    `;
    stage.appendChild(nodes);
  }
}

function ensureRadarLabels() {
  const stage = document.querySelector(".courseRadarStage");
  if (!stage) return;

  let labels = stage.querySelector(".courseRadarLabels");
  if (!labels) {
    labels = document.createElement("div");
    labels.className = "courseRadarLabels";
    stage.appendChild(labels);
  }

  labels.innerHTML = COURSE_ORDER.map((course) =>
    `<div class="radarLabel radarLabel--${course}" data-course="${course}" aria-hidden="true">${course}</div>`
  ).join("");
}

function clampScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(RADAR_SCORE_MAX, n));
}

function getKimariteCount(kimarite, key) {
  const n = Number(kimarite?.[key]);
  return Number.isFinite(n) ? n : 0;
}

function toRate10(rate, maxRate) {
  const n = Number(rate);
  const max = Number(maxRate);
  if (!Number.isFinite(n) || !Number.isFinite(max) || max <= 0) return 0;

  const clamped = Math.max(0, Math.min(n, max));
  if (clamped >= max) return 10;
  return clampScore(Math.floor((clamped / max) * 10));
}

function scoreNigeRate1Course(course) {
  const starts = Number(course?.starts);
  const nige = getKimariteCount(course?.kimarite, "逃げ");
  if (!Number.isFinite(starts) || starts <= 0) return 0;

  const rate = (nige / starts) * 100;
  if (rate >= 85) return 10;
  if (rate >= 80) return 9;
  if (rate >= 75) return 8;
  if (rate >= 70) return 7;
  if (rate >= 65) return 6;
  if (rate >= 60) return 5;
  if (rate >= 50) return 4;
  if (rate >= 45) return 3;
  if (rate >= 40) return 2;
  if (rate >= 30) return 1;
  return 0;
}

function scoreRen2Rate2Course(course) {
  return toRate10(course?.ren2, 70);
}

function scoreRen2Rate3Course(course) {
  return toRate10(course?.ren2, 70);
}

function scoreAvgSt4Course(avgSt) {
  const st = Number(avgSt);
  if (!Number.isFinite(st)) return 0;
  if (st <= 0.10) return 10;
  if (st <= 0.11) return 9;
  if (st <= 0.12) return 8;
  if (st <= 0.13) return 7;
  if (st <= 0.14) return 6;
  if (st <= 0.15) return 5;
  if (st <= 0.16) return 4;
  if (st <= 0.17) return 3;
  if (st <= 0.18) return 2;
  if (st <= 0.19) return 1;
  return 0;
}

function sampleFactor4Course(starts) {
  const n = Number(starts);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n / 20, 1);
}

function score4Course(course) {
  const ren3Score = toRate10(course?.ren3, 70);
  const stScore = scoreAvgSt4Course(course?.avgSt);
  const base = (ren3Score * 0.9) + (stScore * 0.1);
  const adjusted = base * sampleFactor4Course(course?.starts);
  return clampScore(Math.round(adjusted));
}

function scoreRen3Rate5Course(course) {
  return toRate10(course?.ren3, 70);
}

function scoreRen3Rate6Course(course) {
  return toRate10(course?.ren3, 60);
}

function buildRadarScores() {
  const dataset = getCurrentDataset();

  if (dataset.type === "other") {
    const base = getCurrentOtherBase();
    const baseStarts = num(base?.starts);

    return COURSE_ORDER.map((otherCourse) => {
      const b = getOtherBucket(base, otherCourse);
      const first = num(b?.first);
      if (!Number.isFinite(baseStarts) || baseStarts <= 0 || !Number.isFinite(first)) return 0;
      return toRate10((first / baseStarts) * 100, 70);
    });
  }

  return [
    scoreNigeRate1Course(dataset.courseData[1]),
    scoreRen2Rate2Course(dataset.courseData[2]),
    scoreRen2Rate3Course(dataset.courseData[3]),
    score4Course(dataset.courseData[4]),
    scoreRen3Rate5Course(dataset.courseData[5]),
    scoreRen3Rate6Course(dataset.courseData[6])
  ];
}

function getRadarValues() {
  return buildRadarScores();
}

function getRadarPointObjects(values, progress = 1, scale = 1) {
  return values.map((v, i) => {
    const score = clampScore(v);
    const rate = (score / RADAR_SCORE_MAX) * progress;
    const r = RADAR_VALUE_MAX_R * scale * rate;
    return {
      x: RADAR_CX + Math.cos(RADAR_ANGLES[i]) * r,
      y: RADAR_CY + Math.sin(RADAR_ANGLES[i]) * r
    };
  });
}

function pointObjectsToString(points) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function layoutRadarNodes(points) {
  points.forEach((p, i) => {
    const node = $(`courseRadarNode${i + 1}`);
    if (!node) return;
    node.style.left = `${(p.x / RADAR_SIZE) * 100}%`;
    node.style.top = `${(p.y / RADAR_SIZE) * 100}%`;
  });
}

function getLabelOffsets() {
  return {
    1: { dx: 0, dy: -2 },
    2: { dx: 8, dy: -1 },
    3: { dx: 8, dy: 2 },
    4: { dx: 0, dy: 1 },
    5: { dx: -8, dy: 2 },
    6: { dx: -8, dy: -1 }
  };
}

function layoutRadarLabels() {
  const stage = document.querySelector(".courseRadarStage");
  if (!stage) return;

  const offsets = getLabelOffsets();

  COURSE_ORDER.forEach((course, idx) => {
    const el = stage.querySelector(`.radarLabel--${course}`);
    if (!el) return;

    const angle = RADAR_ANGLES[idx];
    const baseX = RADAR_CX + Math.cos(angle) * RADAR_LABEL_R;
    const baseY = RADAR_CY + Math.sin(angle) * RADAR_LABEL_R;
    const offset = offsets[course] || { dx: 0, dy: 0 };

    el.style.left = `${((baseX + offset.dx) / RADAR_SIZE) * 100}%`;
    el.style.top = `${((baseY + offset.dy) / RADAR_SIZE) * 100}%`;
  });
}

function drawRadar(progress = 1) {
  const polygon = $("courseRadarPolygon");
  if (!polygon) return;

  const values = getRadarValues();
  const outerPoints = getRadarPointObjects(values, progress, 1);

  polygon.setAttribute("points", pointObjectsToString(outerPoints));
  layoutRadarNodes(outerPoints);
}

function animateRadar() {
  const duration = 520;
  const start = performance.now();

  if (radarAnimationFrame) {
    cancelAnimationFrame(radarAnimationFrame);
    radarAnimationFrame = null;
  }

  const tick = (now) => {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 3);

    drawRadar(eased);

    if (t < 1) {
      radarAnimationFrame = requestAnimationFrame(tick);
    } else {
      radarAnimationFrame = null;
    }
  };

  radarAnimationFrame = requestAnimationFrame(tick);
}

function setMeter(idFill, value) {
  const el = $(idFill);
  if (!el) return;
  const width = Number.isFinite(Number(value))
    ? Math.max(0, Math.min(100, Number(value)))
    : 0;
  el.style.width = `${width}%`;
}

function formatRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return String(n);
}

function formatST(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function pickTopKimarite(kimarite = {}) {
  const items = [
    ["逃げ", Number(kimarite["逃げ"]) || 0],
    ["差し", Number(kimarite["差"]) || 0],
    ["まくり", Number(kimarite["まくり"]) || 0],
    ["まくり差し", Number(kimarite["まくり差し"]) || 0],
    ["抜き", Number(kimarite["抜き"]) || 0],
    ["恵まれ", Number(kimarite["恵まれ"]) || 0]
  ].sort((a, b) => b[1] - a[1]);

  const top = items[0];
  const sub = items.filter((x) => x[1] > 0).map((x) => `${x[0]} ${x[1]}`).join(" / ");

  return {
    main: top && top[1] > 0 ? `${top[0]} ${top[1]}` : "—",
    sub: sub || "—"
  };
}

function renderHeroText() {
  const dataset = getCurrentDataset();
  const typePill = $("courseTypePill");
  const selectedCourseTitle = $("selectedCourseTitle");
  const selectedCourseType = $("selectedCourseType");
  const kimariteMain = $("kimariteMain");
  const kimariteSub = $("kimariteSub");

  if (dataset.type === "other") {
    const base = getCurrentOtherBase();
    const agg = aggregateOtherBase(base);
    const starts = num(agg.starts);

    const winRate = Number.isFinite(starts) && starts > 0
      ? (agg.first / starts) * 100
      : null;
    const ren2Rate = Number.isFinite(starts) && starts > 0
      ? ((agg.first + agg.second) / starts) * 100
      : null;
    const ren3Rate = Number.isFinite(starts) && starts > 0
      ? ((agg.first + agg.second + agg.third) / starts) * 100
      : null;

    $("winRateText").textContent = formatRate(winRate);
    $("ren2RateText").textContent = formatRate(ren2Rate);
    $("ren3RateText").textContent = formatRate(ren3Rate);

    setMeter("winRateFill", winRate);
    setMeter("ren2RateFill", ren2Rate);
    setMeter("ren3RateFill", ren3Rate);

    if (selectedCourseTitle) selectedCourseTitle.textContent = `${selectedCourse}コース時の他艇傾向`;
    if (selectedCourseType) selectedCourseType.textContent = selectedRange === "other1y" ? "直近1年" : "直近3年";
    if (typePill) typePill.textContent = "他艇傾向";

    const top = pickTopKimarite(agg.kimarite);
    if (kimariteMain) kimariteMain.textContent = top.main;
    if (kimariteSub) kimariteSub.textContent = top.sub;
    return;
  }

  const data = dataset.courseData[selectedCourse] || {};

  $("winRateText").textContent = formatRate(data.win);
  $("ren2RateText").textContent = formatRate(data.ren2);
  $("ren3RateText").textContent = formatRate(data.ren3);

  setMeter("winRateFill", data.win);
  setMeter("ren2RateFill", data.ren2);
  setMeter("ren3RateFill", data.ren3);

  if (selectedCourseTitle) selectedCourseTitle.textContent = `${selectedCourse}コース成績`;
  if (selectedCourseType) selectedCourseType.textContent = selectedRange === "1y" ? "直近1年" : "直近3年";
  if (typePill) typePill.textContent = "選手コース成績";

  const top = pickTopKimarite(data.kimarite || {});
  if (kimariteMain) kimariteMain.textContent = top.main;
  if (kimariteSub) kimariteSub.textContent = top.sub;
}

function makeCourseHeader() {
  return `
    <div class="playerTableHead">
      <div class="playerTableHeadCell playerTableHeadCell--stub">
        <span>枠</span>
      </div>
      ${COURSE_ORDER.map((course) => `
        <div class="playerTableHeadCell playerTableHeadCell--c${course}">
          <div class="playerCourseName">${course}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function valueRow(label, values) {
  return `
    <div class="playerTableRow">
      <div class="playerTableCell playerTableCell--label">${esc(label)}</div>
      ${values.map((v, i) => `
        <div class="playerTableCell playerTableCell--value${i === selectedCourse - 1 ? " is-highlight" : ""}">
          ${esc(v)}
        </div>
      `).join("")}
    </div>
  `;
}

function rateRow(label, values) {
  return `
    <div class="playerTableRow">
      <div class="playerTableCell playerTableCell--label">${esc(label)}</div>
      ${values.map((v, i) => {
        const n = Number(String(v).replace("%", "").replace(/\s/g, "").trim());
        const width = Number.isFinite(n) ? Math.max(0, Math.min(n, 100)) : 0;
        return `
          <div class="playerTableCell playerTableCell--value${i === selectedCourse - 1 ? " is-highlight" : ""}">
            <div class="playerRateStack">
              <div class="playerRateText">${esc(v)}</div>
              <div class="playerRateBar">
                <div class="playerRateBarFill" style="width:${width}%"></div>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function buildOtherModeTable() {
  const base = getCurrentOtherBase();
  const baseStarts = num(base?.starts);

  const startsRow = COURSE_ORDER.map(() => formatCount(baseStarts));

  const firstRow = [];
  const secondRow = [];
  const thirdRow = [];
  const firstRateRow = [];
  const ren2RateRow = [];
  const ren3RateRow = [];
  const nigeRow = [];
  const sashiRow = [];
  const makuriRow = [];
  const makurisashiRow = [];
  const nukiRow = [];
  const megumareRow = [];

  COURSE_ORDER.forEach((otherCourse) => {
    const b = getOtherBucket(base, otherCourse);

    const first = num(b?.first) ?? 0;
    const second = num(b?.second) ?? 0;
    const third = num(b?.third) ?? 0;

    firstRow.push(formatCount(first));
    secondRow.push(formatCount(second));
    thirdRow.push(formatCount(third));

    if (Number.isFinite(baseStarts) && baseStarts > 0) {
      firstRateRow.push(formatRate((first / baseStarts) * 100));
      ren2RateRow.push(formatRate(((first + second) / baseStarts) * 100));
      ren3RateRow.push(formatRate(((first + second + third) / baseStarts) * 100));
    } else {
      firstRateRow.push("—");
      ren2RateRow.push("—");
      ren3RateRow.push("—");
    }

    nigeRow.push(formatNumber(b?.kimarite?.["逃げ"] ?? 0));
    sashiRow.push(formatNumber(b?.kimarite?.["差"] ?? 0));
    makuriRow.push(formatNumber(b?.kimarite?.["まくり"] ?? 0));
    makurisashiRow.push(formatNumber(b?.kimarite?.["まくり差し"] ?? 0));
    nukiRow.push(formatNumber(b?.kimarite?.["抜き"] ?? 0));
    megumareRow.push(formatNumber(b?.kimarite?.["恵まれ"] ?? 0));
  });

  return [
    makeCourseHeader(),
    valueRow("母集団", startsRow),
    valueRow("他艇1着", firstRow),
    valueRow("他艇2着", secondRow),
    valueRow("他艇3着", thirdRow),
    rateRow("他艇1着率", firstRateRow),
    rateRow("他艇2連対率", ren2RateRow),
    rateRow("他艇3連対率", ren3RateRow),
    valueRow("逃げ", nigeRow),
    valueRow("差し", sashiRow),
    valueRow("まくり", makuriRow),
    valueRow("まくり差し", makurisashiRow),
    valueRow("抜き", nukiRow),
    valueRow("恵まれ", megumareRow)
  ].join("");
}

function buildPlayerModeTable() {
  const t = structuredClone(EMPTY_TABLE_DATA);
  const dataset = getCurrentDataset();

  COURSE_ORDER.forEach((courseNo) => {
    const c = dataset.courseData[courseNo] || null;

    t.starts[courseNo - 1] = formatCount(c?.starts);
    t.first[courseNo - 1] = formatCount(c?.first);
    t.second[courseNo - 1] = formatCount(c?.second);
    t.third[courseNo - 1] = formatCount(c?.third);
    t.winRate[courseNo - 1] = formatRate(c?.win);
    t.ren2Rate[courseNo - 1] = formatRate(c?.ren2);
    t.ren3Rate[courseNo - 1] = formatRate(c?.ren3);
    t.avgSt[courseNo - 1] = formatST(c?.avgSt);
    t.nige[courseNo - 1] = formatNumber(c?.kimarite?.["逃げ"]);
    t.sashi[courseNo - 1] = formatNumber(c?.kimarite?.["差"]);
    t.makuri[courseNo - 1] = formatNumber(c?.kimarite?.["まくり"]);
    t.makurisashi[courseNo - 1] = formatNumber(c?.kimarite?.["まくり差し"]);
    t.nuki[courseNo - 1] = formatNumber(c?.kimarite?.["抜き"]);
    t.megumare[courseNo - 1] = formatNumber(c?.kimarite?.["恵まれ"]);
  });

  return [
    makeCourseHeader(),
    valueRow("出走数", t.starts),
    valueRow("1着", t.first),
    valueRow("2着", t.second),
    valueRow("3着", t.third),
    rateRow("1着率", t.winRate),
    rateRow("2連対率", t.ren2Rate),
    rateRow("3連対率", t.ren3Rate),
    valueRow("平均ST", t.avgSt),
    valueRow("逃げ", t.nige),
    valueRow("差し", t.sashi),
    valueRow("まくり", t.makuri),
    valueRow("まくり差し", t.makurisashi),
    valueRow("抜き", t.nuki),
    valueRow("恵まれ", t.megumare)
  ].join("");
}

function renderTables() {
  $("playerCourseStats").innerHTML = isOtherMode()
    ? buildOtherModeTable()
    : buildPlayerModeTable();
}

function resetDatasets() {
  DATASETS["1y"].courseData = structuredClone(EMPTY_COURSE_DATA);
  DATASETS["3y"].courseData = structuredClone(EMPTY_COURSE_DATA);
  DATASETS["other1y"].raw = structuredClone(EMPTY_OTHER_BASE_RAW);
  DATASETS["other3y"].raw = structuredClone(EMPTY_OTHER_BASE_RAW);
}

function applyPlayerStatsToDataset(datasetKey, player) {
  const dataset = DATASETS[datasetKey];
  dataset.courseData = structuredClone(EMPTY_COURSE_DATA);

  if (!player || !player.courses) return;

  COURSE_ORDER.forEach((courseNo) => {
    const c = player.courses?.[String(courseNo)] || player.courses?.[courseNo] || null;

    dataset.courseData[courseNo] = {
      starts: num(c?.starts),
      first: num(c?.first),
      second: num(c?.second),
      third: num(c?.third),
      win: num(c?.win_rate),
      ren2: num(c?.ren2_rate),
      ren3: num(c?.ren3_rate),
      avgSt: num(c?.avg_st),
      kimarite: {
        "逃げ": num(c?.kimarite?.["逃げ"]) ?? 0,
        "差": num(c?.kimarite?.["差"]) ?? 0,
        "まくり": num(c?.kimarite?.["まくり"]) ?? 0,
        "まくり差し": num(c?.kimarite?.["まくり差し"]) ?? 0,
        "抜き": num(c?.kimarite?.["抜き"]) ?? 0,
        "恵まれ": num(c?.kimarite?.["恵まれ"]) ?? 0
      }
    };
  });
}

function pickOtherPlayerRoot(raw) {
  if (!raw) return null;
  if (raw.base_courses) return raw;
  if (raw.data?.base_courses) return raw.data;
  if (raw.stats?.base_courses) return raw.stats;
  if (raw.trends?.base_courses) return raw.trends;
  return raw;
}

function applyOtherBoatStatsToDataset(datasetKey, playerRaw) {
  const dataset = DATASETS[datasetKey];
  dataset.raw = structuredClone(EMPTY_OTHER_BASE_RAW);

  const player = pickOtherPlayerRoot(playerRaw);
  const baseCourses = player?.base_courses || player?.baseCourses || null;
  if (!baseCourses) return;

  COURSE_ORDER.forEach((baseCourse) => {
    const base = baseCourses[String(baseCourse)] || baseCourses[baseCourse] || null;
    if (!base) return;

    const normalizedOthers = {};

    COURSE_ORDER.forEach((otherCourse) => {
      const o = base.others?.[String(otherCourse)] || base.others?.[otherCourse] || null;
      const kim = o?.kimarite || o?.win_kimarite || o?.winning_kimarite || {};

      normalizedOthers[String(otherCourse)] = {
        starts: num(o?.starts) ?? 0,
        first: num(o?.first) ?? 0,
        second: num(o?.second) ?? 0,
        third: num(o?.third) ?? 0,
        first_rate: num(o?.first_rate),
        ren2_rate: num(o?.ren2_rate),
        ren3_rate: num(o?.ren3_rate),
        kimarite: {
          "逃げ": num(kim?.["逃げ"]) ?? 0,
          "差": num(kim?.["差"]) ?? 0,
          "まくり": num(kim?.["まくり"]) ?? 0,
          "まくり差し": num(kim?.["まくり差し"]) ?? 0,
          "抜き": num(kim?.["抜き"]) ?? 0,
          "恵まれ": num(kim?.["恵まれ"]) ?? 0
        }
      };
    });

    dataset.raw[baseCourse] = {
      starts: num(base?.starts),
      others: normalizedOthers
    };
  });
}

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(`${url}?t=${Math.floor(Date.now() / 300000)}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      console.error("fetch failed:", url, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("fetch error:", url, err);
    return null;
  }
}

function pickPlayerFromStandardJson(json, targetRegno) {
  if (!json) return null;
  return json?.players?.[targetRegno] || json?.[targetRegno] || null;
}

function pickPlayerFromOtherBoatJson(json, targetRegno) {
  if (!json) return null;

  return (
    json?.players?.[targetRegno] ||
    json?.data?.players?.[targetRegno] ||
    json?.stats?.players?.[targetRegno] ||
    json?.trends?.players?.[targetRegno] ||
    json?.[targetRegno] ||
    json?.data?.[targetRegno] ||
    json?.stats?.[targetRegno] ||
    json?.trends?.[targetRegno] ||
    null
  );
}

async function loadPlayerStats() {
  resetDatasets();
  if (!regno) return;

  const [player1yJson, player3yJson, other1yJson, other3yJson] = await Promise.all([
    fetchJsonSafe(PLAYER_COURSE_STATS_1Y_URL),
    fetchJsonSafe(PLAYER_COURSE_STATS_3Y_URL),
    fetchJsonSafe(PLAYER_OTHER_BOAT_TRENDS_1Y_URL),
    fetchJsonSafe(PLAYER_OTHER_BOAT_TRENDS_3Y_URL)
  ]);

  const player1y = pickPlayerFromStandardJson(player1yJson, regno);
  const player3y = pickPlayerFromStandardJson(player3yJson, regno);
  const other1y = pickPlayerFromOtherBoatJson(other1yJson, regno);
  const other3y = pickPlayerFromOtherBoatJson(other3yJson, regno);

  applyPlayerStatsToDataset("1y", player1y);
  applyPlayerStatsToDataset("3y", player3y);
  applyOtherBoatStatsToDataset("other1y", other1y);
  applyOtherBoatStatsToDataset("other3y", other3y);
}

async function boot() {
  applyHeroGradeTheme();
  upgradeDataTabs();
  buildRadarGrid();
  ensureRadarExtraLayers();
  ensureRadarLabels();
  makeCourseTabs();
  bindRangeTabs();

  await loadPlayerStats();

  renderTables();
  renderHeroText();
  layoutRadarLabels();
  drawRadar(0);

  requestAnimationFrame(() => {
    layoutRadarLabels();
    animateRadar();
  });

  window.addEventListener("resize", layoutRadarLabels, { passive: true });
}

boot();