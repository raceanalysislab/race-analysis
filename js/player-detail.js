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
const PLAYER_OTHER_TRENDS_1Y_URL =
  "https://raceanalysislab.github.io/race-analysis/data/player_other_boat_trends_1y.json";
const PLAYER_OTHER_TRENDS_3Y_URL =
  "https://raceanalysislab.github.io/race-analysis/data/player_other_boat_trends_3y.json";

const $ = (id) => document.getElementById(id);

$("playerName").textContent = playerName;
$("playerMetaInline").textContent = [regno, grade, branch, age ? `${age}歳` : ""].filter(Boolean).join(" / ");
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
  1: { starts: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  2: { starts: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  3: { starts: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  4: { starts: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  5: { starts: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} },
  6: { starts: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: {} }
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

const DATASETS = {
  "1y": {
    courseData: structuredClone(EMPTY_COURSE_DATA),
    table: structuredClone(EMPTY_TABLE_DATA)
  },
  "3y": {
    courseData: structuredClone(EMPTY_COURSE_DATA),
    table: structuredClone(EMPTY_TABLE_DATA)
  }
};

const OTHER_TRENDS = {
  "1y": null,
  "3y": null
};

let selectedCourse = Math.min(6, Math.max(1, Number.isFinite(waku) ? waku : 1));
let selectedMainTab = "1y";
let selectedOtherRange = "1y";
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

function getHeroDatasetKey() {
  return selectedMainTab === "other" ? selectedOtherRange : selectedMainTab;
}

function getCurrentDataset() {
  return DATASETS[getHeroDatasetKey()] || DATASETS["1y"];
}

function getCurrentOtherTrendPlayer() {
  return OTHER_TRENDS[selectedOtherRange] || null;
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

function getMainTabLabel(key) {
  if (key === "1y") return "直近1年データ";
  if (key === "3y") return "直近3年データ";
  return "他艇傾向";
}

function getOtherRangeLabel(key) {
  return key === "3y" ? "直近3年" : "直近1年";
}

function makeDataTabs() {
  const root = $("playerDataTabs");
  if (!root) return;

  root.innerHTML = [
    { key: "1y", label: "直近1年データ" },
    { key: "3y", label: "直近3年データ" },
    { key: "other", label: "他艇傾向" }
  ].map((item) => `
    <button
      type="button"
      class="playerDataTab${item.key === selectedMainTab ? " is-active" : ""}"
      data-main-tab="${item.key}"
    >${item.label}</button>
  `).join("");

  root.querySelectorAll(".playerDataTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = String(btn.dataset.mainTab || "1y");
      if (next === selectedMainTab) return;

      selectedMainTab = next;
      makeDataTabs();
      renderOtherSubTabs();
      renderTables();
      renderHeroText();
      animateRadar();
    });
  });
}

function ensureOtherSubTabsRoot() {
  const head = document.querySelector(".playerSectionHead");
  if (!head) return null;

  let sub = $("playerOtherSubTabs");
  if (!sub) {
    sub = document.createElement("div");
    sub.id = "playerOtherSubTabs";
    sub.className = "playerDataTabs";
    sub.style.marginTop = "10px";
    head.appendChild(sub);
  }
  return sub;
}

function renderOtherSubTabs() {
  const root = ensureOtherSubTabsRoot();
  if (!root) return;

  if (selectedMainTab !== "other") {
    root.innerHTML = "";
    root.style.display = "none";
    return;
  }

  root.style.display = "";
  root.innerHTML = [
    { key: "1y", label: "直近1年" },
    { key: "3y", label: "直近3年" }
  ].map((item) => `
    <button
      type="button"
      class="playerDataTab${item.key === selectedOtherRange ? " is-active" : ""}"
      data-other-range="${item.key}"
    >${item.label}</button>
  `).join("");

  root.querySelectorAll(".playerDataTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = String(btn.dataset.otherRange || "1y");
      if (next === selectedOtherRange) return;

      selectedOtherRange = next;
      renderOtherSubTabs();
      renderTables();
      renderHeroText();
      animateRadar();
    });
  });
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
  if (core) {
    core.remove();
  }

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
  const width = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
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

function getTopKimariteInfo(kimarite) {
  const items = [
    ["逃げ", Number(kimarite?.["逃げ"]) || 0],
    ["差し", Number(kimarite?.["差"]) || 0],
    ["まくり", Number(kimarite?.["まくり"]) || 0],
    ["まくり差し", Number(kimarite?.["まくり差し"]) || 0],
    ["抜き", Number(kimarite?.["抜き"]) || 0],
    ["恵まれ", Number(kimarite?.["恵まれ"]) || 0]
  ].sort((a, b) => b[1] - a[1]);

  if (!items[0] || items[0][1] <= 0) {
    return { main: "—", sub: "—" };
  }

  return {
    main: items[0][0],
    sub: `最多 ${items[0][1]}回`
  };
}

function renderHeroText() {
  const dataset = getCurrentDataset();
  const data = dataset.courseData[selectedCourse] || {};
  const heroKey = getHeroDatasetKey();
  const topKimarite = getTopKimariteInfo(data.kimarite);

  $("winRateText").textContent = formatRate(data.win);
  $("ren2RateText").textContent = formatRate(data.ren2);
  $("ren3RateText").textContent = formatRate(data.ren3);

  setMeter("winRateFill", data.win);
  setMeter("ren2RateFill", data.ren2);
  setMeter("ren3RateFill", data.ren3);

  $("selectedCourseTitle").textContent = `${selectedCourse}コース`;
  $("selectedCourseType").textContent = selectedMainTab === "other"
    ? `他艇傾向 / ${getOtherRangeLabel(selectedOtherRange)}基準`
    : getMainTabLabel(selectedMainTab);

  $("courseTypePill").textContent = heroKey === "3y" ? "直近3年" : "直近1年";
  $("kimariteMain").textContent = topKimarite.main;
  $("kimariteSub").textContent = topKimarite.sub;
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

function valueRow(label, values, highlightSelected = true) {
  return `
    <div class="playerTableRow">
      <div class="playerTableCell playerTableCell--label">${esc(label)}</div>
      ${values.map((v, i) => `
        <div class="playerTableCell playerTableCell--value${highlightSelected && i === selectedCourse - 1 ? " is-highlight" : ""}">
          ${esc(v)}
        </div>
      `).join("")}
    </div>
  `;
}

function rateRow(label, values, highlightSelected = true) {
  return `
    <div class="playerTableRow">
      <div class="playerTableCell playerTableCell--label">${esc(label)}</div>
      ${values.map((v, i) => {
        const n = Number(String(v).replace("%", "").replace(/\s/g, "").trim());
        const width = Number.isFinite(n) ? Math.max(0, Math.min(n, 100)) : 0;
        return `
          <div class="playerTableCell playerTableCell--value${highlightSelected && i === selectedCourse - 1 ? " is-highlight" : ""}">
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

function buildOtherTrendRowValues(key) {
  const player = getCurrentOtherTrendPlayer();
  const base = player?.base_courses?.[String(selectedCourse)]?.others || {};

  return COURSE_ORDER.map((courseNo) => {
    if (courseNo === selectedCourse) return "—";

    const src = base[String(courseNo)] || null;
    if (!src) return "—";

    if (key === "first") return formatCount(src.first);
    if (key === "second") return formatCount(src.second);
    if (key === "third") return formatCount(src.third);
    if (key === "firstRate") return formatRate(src.first_rate);
    if (key === "ren2Rate") return formatRate(src.ren2_rate);
    if (key === "ren3Rate") return formatRate(src.ren3_rate);
    if (key === "nige") return formatNumber(src.kimarite?.["逃げ"]);
    if (key === "sashi") return formatNumber(src.kimarite?.["差"]);
    if (key === "makuri") return formatNumber(src.kimarite?.["まくり"]);
    if (key === "makurisashi") return formatNumber(src.kimarite?.["まくり差し"]);
    if (key === "nuki") return formatNumber(src.kimarite?.["抜き"]);
    if (key === "megumare") return formatNumber(src.kimarite?.["恵まれ"]);

    return "—";
  });
}

function renderSelfTables() {
  const t = getCurrentDataset().table;

  $("playerCourseStats").innerHTML = [
    makeCourseHeader(),
    valueRow("出走数", t.starts, true),
    valueRow("1着", t.first, true),
    valueRow("2着", t.second, true),
    valueRow("3着", t.third, true),
    rateRow("1着率", t.winRate, true),
    rateRow("2連対率", t.ren2Rate, true),
    rateRow("3連対率", t.ren3Rate, true),
    valueRow("平均ST", t.avgSt, true),
    valueRow("逃げ", t.nige, true),
    valueRow("差し", t.sashi, true),
    valueRow("まくり", t.makuri, true),
    valueRow("まくり差し", t.makurisashi, true),
    valueRow("抜き", t.nuki, true),
    valueRow("恵まれ", t.megumare, true)
  ].join("");
}

function renderOtherTables() {
  $("playerCourseStats").innerHTML = [
    makeCourseHeader(),
    valueRow("1着", buildOtherTrendRowValues("first"), false),
    valueRow("2着", buildOtherTrendRowValues("second"), false),
    valueRow("3着", buildOtherTrendRowValues("third"), false),
    rateRow("1着率", buildOtherTrendRowValues("firstRate"), false),
    rateRow("2連対率", buildOtherTrendRowValues("ren2Rate"), false),
    rateRow("3連対率", buildOtherTrendRowValues("ren3Rate"), false),
    valueRow("逃げ", buildOtherTrendRowValues("nige"), false),
    valueRow("差し", buildOtherTrendRowValues("sashi"), false),
    valueRow("まくり", buildOtherTrendRowValues("makuri"), false),
    valueRow("まくり差し", buildOtherTrendRowValues("makurisashi"), false),
    valueRow("抜き", buildOtherTrendRowValues("nuki"), false),
    valueRow("恵まれ", buildOtherTrendRowValues("megumare"), false)
  ].join("");
}

function renderTables() {
  if (selectedMainTab === "other") {
    renderOtherTables();
    return;
  }
  renderSelfTables();
}

function resetDatasets() {
  DATASETS["1y"].courseData = structuredClone(EMPTY_COURSE_DATA);
  DATASETS["1y"].table = structuredClone(EMPTY_TABLE_DATA);
  DATASETS["3y"].courseData = structuredClone(EMPTY_COURSE_DATA);
  DATASETS["3y"].table = structuredClone(EMPTY_TABLE_DATA);
  OTHER_TRENDS["1y"] = null;
  OTHER_TRENDS["3y"] = null;
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

async function fetchPlayerStats(url) {
  const res = await fetch(`${url}?t=${Math.floor(Date.now() / 300000)}`, {
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json?.players?.[regno] || null;
}

async function loadPlayerStats() {
  resetDatasets();

  if (!regno) return;

  try {
    const [player1y, player3y, other1y, other3y] = await Promise.all([
      fetchPlayerStats(PLAYER_COURSE_STATS_1Y_URL),
      fetchPlayerStats(PLAYER_COURSE_STATS_3Y_URL),
      fetchPlayerStats(PLAYER_OTHER_TRENDS_1Y_URL),
      fetchPlayerStats(PLAYER_OTHER_TRENDS_3Y_URL)
    ]);

    applyPlayerStatsToDataset("1y", player1y);
    applyPlayerStatsToDataset("3y", player3y);
    OTHER_TRENDS["1y"] = other1y;
    OTHER_TRENDS["3y"] = other3y;
  } catch (err) {
    console.error("player stats load failed:", err);
    resetDatasets();
  }
}

async function boot() {
  applyHeroGradeTheme();
  buildRadarGrid();
  ensureRadarExtraLayers();
  ensureRadarLabels();
  makeCourseTabs();
  makeDataTabs();
  renderOtherSubTabs();

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