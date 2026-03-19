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

const EMPTY_COURSE_DATA = {
  1: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  2: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  3: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  4: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  5: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  6: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} }
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

const EMPTY_OTHER_BOAT_TABLE_DATA = {
  starts: ["—", "—", "—", "—", "—", "—"],
  first: ["—", "—", "—", "—", "—", "—"],
  second: ["—", "—", "—", "—", "—", "—"],
  third: ["—", "—", "—", "—", "—", "—"],
  nige: ["—", "—", "—", "—", "—", "—"],
  sashi: ["—", "—", "—", "—", "—", "—"],
  makuri: ["—", "—", "—", "—", "—", "—"],
  makurisashi: ["—", "—", "—", "—", "—", "—"],
  nuki: ["—", "—", "—", "—", "—", "—"],
  megumare: ["—", "—", "—", "—", "—", "—"]
};

const DATASETS = {
  "1y": {
    type: "player",
    courseData: structuredClone(EMPTY_COURSE_DATA),
    table: structuredClone(EMPTY_TABLE_DATA)
  },
  "3y": {
    type: "player",
    courseData: structuredClone(EMPTY_COURSE_DATA),
    table: structuredClone(EMPTY_TABLE_DATA)
  },
  "other1y": {
    type: "other",
    courseData: structuredClone(EMPTY_COURSE_DATA),
    table: structuredClone(EMPTY_OTHER_BOAT_TABLE_DATA)
  },
  "other3y": {
    type: "other",
    courseData: structuredClone(EMPTY_COURSE_DATA),
    table: structuredClone(EMPTY_OTHER_BOAT_TABLE_DATA)
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

function getCurrentDataset() {
  return DATASETS[selectedRange] || DATASETS["1y"];
}

function isOtherMode() {
  return getCurrentDataset().type === "other";
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
    `<div class="radarLabel radarLabel--${course}" data-course="${course}" aria-hidden="true">${course}コース</div>`
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
    return COURSE_ORDER.map((courseNo) => {
      const c = dataset.courseData[courseNo];
      const starts = Number(c?.starts);
      const first = Number(c?.first);
      if (!Number.isFinite(starts) || starts <= 0 || !Number.isFinite(first)) return 0;
      return toRate10((first / starts) * 100, 70);
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
  const data = dataset.courseData[selectedCourse] || {};
  const typePill = $("courseTypePill");
  const selectedCourseTitle = $("selectedCourseTitle");
  const selectedCourseType = $("selectedCourseType");
  const kimariteMain = $("kimariteMain");
  const kimariteSub = $("kimariteSub");

  if (dataset.type === "other") {
    const starts = Number(data.starts);
    const first = Number(data.first);
    const second = Number(data.second);
    const third = Number(data.third);

    const winRate = Number.isFinite(starts) && starts > 0 && Number.isFinite(first)
      ? (first / starts) * 100
      : null;
    const ren2Rate = Number.isFinite(starts) && starts > 0 && Number.isFinite(first) && Number.isFinite(second)
      ? ((first + second) / starts) * 100
      : null;
    const ren3Rate = Number.isFinite(starts) && starts > 0 && Number.isFinite(first) && Number.isFinite(second) && Number.isFinite(third)
      ? ((first + second + third) / starts) * 100
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

    const top = pickTopKimarite(data.kimarite || {});
    if (kimariteMain) kimariteMain.textContent = top.main;
    if (kimariteSub) kimariteSub.textContent = top.sub;

    return;
  }

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

function renderTables() {
  const t = getCurrentDataset().table;

  if (isOtherMode()) {
    $("playerCourseStats").innerHTML = [
      makeCourseHeader(),
      valueRow("出走数", t.starts),
      valueRow("他艇1着", t.first),
      valueRow("他艇2着", t.second),
      valueRow("他艇3着", t.third),
      valueRow("逃げ", t.nige),
      valueRow("差し", t.sashi),
      valueRow("まくり", t.makuri),
      valueRow("まくり差し", t.makurisashi),
      valueRow("抜き", t.nuki),
      valueRow("恵まれ", t.megumare)
    ].join("");
    return;
  }

  $("playerCourseStats").innerHTML = [
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

function resetDatasets() {
  DATASETS["1y"].courseData = structuredClone(EMPTY_COURSE_DATA);
  DATASETS["1y"].table = structuredClone(EMPTY_TABLE_DATA);

  DATASETS["3y"].courseData = structuredClone(EMPTY_COURSE_DATA);
  DATASETS["3y"].table = structuredClone(EMPTY_TABLE_DATA);

  DATASETS["other1y"].courseData = structuredClone(EMPTY_COURSE_DATA);
  DATASETS["other1y"].table = structuredClone(EMPTY_OTHER_BOAT_TABLE_DATA);

  DATASETS["other3y"].courseData = structuredClone(EMPTY_COURSE_DATA);
  DATASETS["other3y"].table = structuredClone(EMPTY_OTHER_BOAT_TABLE_DATA);
}

function applyPlayerStatsToDataset(datasetKey, player) {
  const dataset = DATASETS[datasetKey];
  dataset.courseData = structuredClone(EMPTY_COURSE_DATA);
  dataset.table = structuredClone(EMPTY_TABLE_DATA);

  if (!player || !player.courses) return;

  COURSE_ORDER.forEach((courseNo) => {
    const c = player.courses?.[String(courseNo)] || null;

    dataset.courseData[courseNo] = {
      starts: Number.isFinite(Number(c?.starts)) ? Number(c.starts) : null,
      first: Number.isFinite(Number(c?.first)) ? Number(c.first) : null,
      second: Number.isFinite(Number(c?.second)) ? Number(c.second) : null,
      third: Number.isFinite(Number(c?.third)) ? Number(c.third) : null,
      win: Number.isFinite(Number(c?.win_rate)) ? Number(c.win_rate) : null,
      ren2: Number.isFinite(Number(c?.ren2_rate)) ? Number(c.ren2_rate) : null,
      ren3: Number.isFinite(Number(c?.ren3_rate)) ? Number(c.ren3_rate) : null,
      avgSt: Number.isFinite(Number(c?.avg_st)) ? Number(c.avg_st) : null,
      kimarite: {
        "逃げ": Number.isFinite(Number(c?.kimarite?.["逃げ"])) ? Number(c.kimarite["逃げ"]) : 0,
        "差": Number.isFinite(Number(c?.kimarite?.["差"])) ? Number(c.kimarite["差"]) : 0,
        "まくり": Number.isFinite(Number(c?.kimarite?.["まくり"])) ? Number(c.kimarite["まくり"]) : 0,
        "まくり差し": Number.isFinite(Number(c?.kimarite?.["まくり差し"])) ? Number(c.kimarite["まくり差し"]) : 0,
        "抜き": Number.isFinite(Number(c?.kimarite?.["抜き"])) ? Number(c.kimarite["抜き"]) : 0,
        "恵まれ": Number.isFinite(Number(c?.kimarite?.["恵まれ"])) ? Number(c.kimarite["恵まれ"]) : 0
      }
    };

    dataset.table.starts[courseNo - 1] = formatCount(c?.starts);
    dataset.table.first[courseNo - 1] = formatCount(c?.first);
    dataset.table.second[courseNo - 1] = formatCount(c?.second);
    dataset.table.third[courseNo - 1] = formatCount(c?.third);
    dataset.table.winRate[courseNo - 1] = formatRate(c?.win_rate);
    dataset.table.ren2Rate[courseNo - 1] = formatRate(c?.ren2_rate);
    dataset.table.ren3Rate[courseNo - 1] = formatRate(c?.ren3_rate);
    dataset.table.avgSt[courseNo - 1] = formatST(c?.avg_st);
    dataset.table.nige[courseNo - 1] = formatNumber(c?.kimarite?.["逃げ"]);
    dataset.table.sashi[courseNo - 1] = formatNumber(c?.kimarite?.["差"]);
    dataset.table.makuri[courseNo - 1] = formatNumber(c?.kimarite?.["まくり"]);
    dataset.table.makurisashi[courseNo - 1] = formatNumber(c?.kimarite?.["まくり差し"]);
    dataset.table.nuki[courseNo - 1] = formatNumber(c?.kimarite?.["抜き"]);
    dataset.table.megumare[courseNo - 1] = formatNumber(c?.kimarite?.["恵まれ"]);
  });
}

function applyOtherBoatStatsToDataset(datasetKey, player) {
  const dataset = DATASETS[datasetKey];
  dataset.courseData = structuredClone(EMPTY_COURSE_DATA);
  dataset.table = structuredClone(EMPTY_OTHER_BOAT_TABLE_DATA);

  if (!player || !player.courses) return;

  COURSE_ORDER.forEach((courseNo) => {
    const c = player.courses?.[String(courseNo)] || null;
    const wk = c?.win_kimarite || {};

    dataset.courseData[courseNo] = {
      starts: Number.isFinite(Number(c?.starts)) ? Number(c.starts) : null,
      first: Number.isFinite(Number(c?.first)) ? Number(c.first) : null,
      second: Number.isFinite(Number(c?.second)) ? Number(c.second) : null,
      third: Number.isFinite(Number(c?.third)) ? Number(c.third) : null,
      win: null,
      ren2: null,
      ren3: null,
      avgSt: null,
      kimarite: {
        "逃げ": Number.isFinite(Number(wk?.["逃げ"])) ? Number(wk["逃げ"]) : 0,
        "差": Number.isFinite(Number(wk?.["差"])) ? Number(wk["差"]) : 0,
        "まくり": Number.isFinite(Number(wk?.["まくり"])) ? Number(wk["まくり"]) : 0,
        "まくり差し": Number.isFinite(Number(wk?.["まくり差し"])) ? Number(wk["まくり差し"]) : 0,
        "抜き": Number.isFinite(Number(wk?.["抜き"])) ? Number(wk["抜き"]) : 0,
        "恵まれ": Number.isFinite(Number(wk?.["恵まれ"])) ? Number(wk["恵まれ"]) : 0
      }
    };

    dataset.table.starts[courseNo - 1] = formatCount(c?.starts);
    dataset.table.first[courseNo - 1] = formatCount(c?.first);
    dataset.table.second[courseNo - 1] = formatCount(c?.second);
    dataset.table.third[courseNo - 1] = formatCount(c?.third);
    dataset.table.nige[courseNo - 1] = formatNumber(wk?.["逃げ"]);
    dataset.table.sashi[courseNo - 1] = formatNumber(wk?.["差"]);
    dataset.table.makuri[courseNo - 1] = formatNumber(wk?.["まくり"]);
    dataset.table.makurisashi[courseNo - 1] = formatNumber(wk?.["まくり差し"]);
    dataset.table.nuki[courseNo - 1] = formatNumber(wk?.["抜き"]);
    dataset.table.megumare[courseNo - 1] = formatNumber(wk?.["恵まれ"]);
  });
}

async function fetchStatsSafe(url) {
  try {
    const res = await fetch(`${url}?t=${Math.floor(Date.now() / 300000)}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      console.error("fetch failed:", url, res.status);
      return null;
    }
    const json = await res.json();
    return json?.players?.[regno] || json?.[regno] || null;
  } catch (err) {
    console.error("fetch error:", url, err);
    return null;
  }
}

async function loadPlayerStats() {
  resetDatasets();

  if (!regno) return;

  const [player1y, player3y, other1y, other3y] = await Promise.all([
    fetchStatsSafe(PLAYER_COURSE_STATS_1Y_URL),
    fetchStatsSafe(PLAYER_COURSE_STATS_3Y_URL),
    fetchStatsSafe(PLAYER_OTHER_BOAT_TRENDS_1Y_URL),
    fetchStatsSafe(PLAYER_OTHER_BOAT_TRENDS_3Y_URL)
  ]);

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