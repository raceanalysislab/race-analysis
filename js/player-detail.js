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

const SVG_NS = "http://www.w3.org/2000/svg";
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

const RADAR_W = 320;
const RADAR_H = 320;
const RADAR_CX = 160;
const RADAR_CY = 160;
const RADAR_GRID_MAX_R = 104;
const RADAR_VALUE_MAX_R = RADAR_GRID_MAX_R;
const RADAR_LABEL_R = 128;
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

const makeEmptyCourseData = () => ({
  1: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  2: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  3: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  4: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  5: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } },
  6: { starts: null, first: null, second: null, third: null, win: null, ren2: null, ren3: null, avgSt: null, kimarite: { ...EMPTY_KIMARITE } }
});

const makeEmptyOtherRaw = () => ({
  1: { starts: null, others: {} },
  2: { starts: null, others: {} },
  3: { starts: null, others: {} },
  4: { starts: null, others: {} },
  5: { starts: null, others: {} },
  6: { starts: null, others: {} }
});

const DATASETS = {
  "1y": { type: "player", courseData: makeEmptyCourseData() },
  "3y": { type: "player", courseData: makeEmptyCourseData() },
  "other1y": { type: "other", raw: makeEmptyOtherRaw() },
  "other3y": { type: "other", raw: makeEmptyOtherRaw() }
};

let selectedCourse = Math.min(6, Math.max(1, Number.isFinite(waku) ? waku : 1));
let selectedRange = "1y";
let radarAnimationFrame = null;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));

const labelHtml = (s) => esc(String(s ?? "")).replace(/\n/g, "<br>");

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatRate = (v) => Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)}%` : "—";
const formatCount = (v) => Number.isFinite(Number(v)) ? String(Math.round(Number(v))) : "—";
const formatST = (v) => Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "—";

const getCurrentDataset = () => DATASETS[selectedRange] || DATASETS["1y"];
const isOtherMode = () => getCurrentDataset().type === "other";

function getPlayerDatasetForCurrentOtherMode() {
  return selectedRange === "other3y" ? DATASETS["3y"] : DATASETS["1y"];
}

function getSelfCourseDataForCurrentOtherMode() {
  return getPlayerDatasetForCurrentOtherMode()?.courseData?.[selectedCourse] || null;
}

function getCurrentOtherBase() {
  const dataset = getCurrentDataset();
  return dataset.type === "other" ? dataset.raw?.[selectedCourse] || null : null;
}

function getReferenceStartsForOtherMode() {
  return num(getSelfCourseDataForCurrentOtherMode()?.starts);
}

function getOtherBucket(base, otherCourse) {
  const raw = base?.others?.[String(otherCourse)] || base?.others?.[otherCourse] || null;
  if (!raw) return null;

  const kim = raw.kimarite || raw.win_kimarite || raw.winning_kimarite || {};
  return {
    first: num(raw.first) ?? 0,
    second: num(raw.second) ?? 0,
    third: num(raw.third) ?? 0,
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

function getOtherModeDisplayRow(course) {
  const selfData = getSelfCourseDataForCurrentOtherMode();

  if (course === selectedCourse) {
    return {
      starts: num(selfData?.starts),
      first: num(selfData?.first) ?? 0,
      second: num(selfData?.second) ?? 0,
      third: num(selfData?.third) ?? 0,
      kimarite: {
        "逃げ": num(selfData?.kimarite?.["逃げ"]) ?? 0,
        "差": num(selfData?.kimarite?.["差"]) ?? 0,
        "まくり": num(selfData?.kimarite?.["まくり"]) ?? 0,
        "まくり差し": num(selfData?.kimarite?.["まくり差し"]) ?? 0,
        "抜き": num(selfData?.kimarite?.["抜き"]) ?? 0,
        "恵まれ": num(selfData?.kimarite?.["恵まれ"]) ?? 0
      }
    };
  }

  const base = getCurrentOtherBase();
  const bucket = getOtherBucket(base, course);

  return {
    starts: getReferenceStartsForOtherMode(),
    first: num(bucket?.first) ?? 0,
    second: num(bucket?.second) ?? 0,
    third: num(bucket?.third) ?? 0,
    kimarite: {
      "逃げ": num(bucket?.kimarite?.["逃げ"]) ?? 0,
      "差": num(bucket?.kimarite?.["差"]) ?? 0,
      "まくり": num(bucket?.kimarite?.["まくり"]) ?? 0,
      "まくり差し": num(bucket?.kimarite?.["まくり差し"]) ?? 0,
      "抜き": num(bucket?.kimarite?.["抜き"]) ?? 0,
      "恵まれ": num(bucket?.kimarite?.["恵まれ"]) ?? 0
    }
  };
}

function applyHeroGradeTheme() {
  document.body.classList.remove("hero-grade-a1", "hero-grade-a2", "hero-grade-b1", "hero-grade-b2");
  if (grade === "A1") return document.body.classList.add("hero-grade-a1");
  if (grade === "A2") return document.body.classList.add("hero-grade-a2");
  if (grade === "B2") return document.body.classList.add("hero-grade-b2");
  document.body.classList.add("hero-grade-b1");
}

function upgradeDataTabs() {
  const root = $("playerDataTabs");
  if (!root) return;
  root.innerHTML = `
    <button type="button" class="playerDataTab is-active" data-range="1y">直近1年データ</button>
    <button type="button" class="playerDataTab" data-range="3y">直近3年データ</button>
    <button type="button" class="playerDataTab" data-range="other1y">コース別着順分布1年</button>
    <button type="button" class="playerDataTab" data-range="other3y">コース別着順分布3年</button>
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
      const next = Number(btn.dataset.course || 1);
      if (next === selectedCourse) return;
      selectedCourse = next;
      makeCourseTabs();
      renderTables();
      renderHeroText();
      drawStaticRadarLabels();
      animateRadar();
    });
  });
}

function bindRangeTabs() {
  const root = $("playerDataTabs");
  if (!root) return;

  root.querySelectorAll(".playerDataTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = String(btn.dataset.range || "1y");
      if (next === selectedRange) return;
      selectedRange = next;

      root.querySelectorAll(".playerDataTab").forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.range === selectedRange);
      });

      renderTables();
      renderHeroText();
      animateRadar();
    });
  });
}

function pointFromAngleRadius(angle, r) {
  return {
    x: RADAR_CX + Math.cos(angle) * r,
    y: RADAR_CY + Math.sin(angle) * r
  };
}

function polygonPointsFromRadius(r) {
  return RADAR_ANGLES.map((a) => {
    const p = pointFromAngleRadius(a, r);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function ensureRadarSvgFrame() {
  const svg = document.querySelector(".courseRadarSvg");
  if (!svg) return;
  svg.setAttribute("viewBox", `0 0 ${RADAR_W} ${RADAR_H}`);
  svg.setAttribute("preserveAspectRatio", "none");
}

function buildRadarGrid() {
  ensureRadarSvgFrame();

  const g = $("courseRadarGrid");
  if (!g) return;

  g.innerHTML = "";
  [0.2, 0.4, 0.6, 0.8, 1].forEach((rate) => {
    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", polygonPointsFromRadius(RADAR_GRID_MAX_R * rate));
    g.appendChild(poly);
  });

  RADAR_ANGLES.forEach((a) => {
    const p = pointFromAngleRadius(a, RADAR_GRID_MAX_R);
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", RADAR_CX);
    line.setAttribute("y1", RADAR_CY);
    line.setAttribute("x2", p.x);
    line.setAttribute("y2", p.y);
    g.appendChild(line);
  });
}

function ensureRadarExtraLayers() {
  ensureRadarSvgFrame();

  const svg = document.querySelector(".courseRadarSvg");
  const stage = document.querySelector(".courseRadarStage");
  if (!svg || !stage) return;

  $("courseRadarPolygonCore")?.remove();

  if (!stage.querySelector(".courseRadarGlow")) {
    const glow = document.createElement("div");
    glow.className = "courseRadarGlow";
    stage.insertBefore(glow, svg);
  }

  let labels = $("courseRadarLabelsSvg");
  if (!labels) {
    labels = document.createElementNS(SVG_NS, "g");
    labels.setAttribute("id", "courseRadarLabelsSvg");
    svg.appendChild(labels);
  }

  let nodes = $("courseRadarNodesSvg");
  if (!nodes) {
    nodes = document.createElementNS(SVG_NS, "g");
    nodes.setAttribute("id", "courseRadarNodesSvg");
    svg.appendChild(nodes);
  }
}

function courseStyle(course) {
  if (course === 1) return { fill: "#ffffff", stroke: "#d8dde8", text: "#111827" };
  if (course === 2) return { fill: "#2d3138", stroke: "transparent", text: "#ffffff" };
  if (course === 3) return { fill: "#e84f4f", stroke: "transparent", text: "#ffffff" };
  if (course === 4) return { fill: "#3d78d8", stroke: "transparent", text: "#ffffff" };
  if (course === 5) return { fill: "#e4d447", stroke: "transparent", text: "#162033" };
  return { fill: "#37b56a", stroke: "transparent", text: "#ffffff" };
}

function labelOffsets() {
  return {
    1: { dx: 0, dy: -2 },
    2: { dx: 8, dy: -1 },
    3: { dx: 8, dy: 2 },
    4: { dx: 0, dy: 1 },
    5: { dx: -8, dy: 2 },
    6: { dx: -8, dy: -1 }
  };
}

function drawStaticRadarLabels() {
  const g = $("courseRadarLabelsSvg");
  if (!g) return;
  g.innerHTML = "";

  const offsets = labelOffsets();

  COURSE_ORDER.forEach((course, idx) => {
    const base = pointFromAngleRadius(RADAR_ANGLES[idx], RADAR_LABEL_R);
    const off = offsets[course] || { dx: 0, dy: 0 };
    const x = base.x + off.dx;
    const y = base.y + off.dy;
    const style = courseStyle(course);

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 11);
    circle.setAttribute("fill", style.fill);
    circle.setAttribute("stroke", style.stroke);
    circle.setAttribute("stroke-width", style.stroke === "transparent" ? 0 : 1.4);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y + 0.5);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "11");
    text.setAttribute("font-weight", "800");
    text.setAttribute("fill", style.text);
    text.textContent = String(course);

    g.appendChild(circle);
    g.appendChild(text);
  });
}

const clampScore = (v) => Math.max(0, Math.min(RADAR_SCORE_MAX, Number.isFinite(Number(v)) ? Number(v) : 0));

const toRate10 = (rate, maxRate) => {
  const n = Number(rate);
  const max = Number(maxRate);
  if (!Number.isFinite(n) || !Number.isFinite(max) || max <= 0) return 0;
  return clampScore(n >= max ? 10 : Math.floor((Math.max(0, Math.min(n, max)) / max) * 10));
};

function buildRadarScores() {
  const dataset = getCurrentDataset();

  if (dataset.type === "other") {
    const refStarts = getReferenceStartsForOtherMode();

    return COURSE_ORDER.map((course) => {
      const row = getOtherModeDisplayRow(course);
      const first = num(row.first);
      if (!Number.isFinite(refStarts) || refStarts <= 0 || !Number.isFinite(first)) return 0;
      return toRate10((first / refStarts) * 100, 70);
    });
  }

  const c = dataset.courseData;

  const scoreNige1 = (() => {
    const starts = num(c[1]?.starts);
    const nige = num(c[1]?.kimarite?.["逃げ"]) ?? 0;
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
  })();

  const score4 = (() => {
    const ren3 = num(c[4]?.ren3);
    const avgSt = num(c[4]?.avgSt);
    const starts = num(c[4]?.starts);
    const ren3Score = toRate10(ren3, 70);

    let stScore = 0;
    if (Number.isFinite(avgSt)) {
      if (avgSt <= 0.10) stScore = 10;
      else if (avgSt <= 0.11) stScore = 9;
      else if (avgSt <= 0.12) stScore = 8;
      else if (avgSt <= 0.13) stScore = 7;
      else if (avgSt <= 0.14) stScore = 6;
      else if (avgSt <= 0.15) stScore = 5;
      else if (avgSt <= 0.16) stScore = 4;
      else if (avgSt <= 0.17) stScore = 3;
      else if (avgSt <= 0.18) stScore = 2;
      else if (avgSt <= 0.19) stScore = 1;
    }

    const sampleFactor = Number.isFinite(starts) && starts > 0 ? Math.min(starts / 20, 1) : 0;
    return clampScore(Math.round(((ren3Score * 0.9) + (stScore * 0.1)) * sampleFactor));
  })();

  return [
    scoreNige1,
    toRate10(c[2]?.ren2, 70),
    toRate10(c[3]?.ren2, 70),
    score4,
    toRate10(c[5]?.ren3, 70),
    toRate10(c[6]?.ren3, 60)
  ];
}

function getRadarPointObjects(values, progress = 1) {
  return values.map((v, i) => {
    const r = RADAR_VALUE_MAX_R * (clampScore(v) / RADAR_SCORE_MAX) * progress;
    return pointFromAngleRadius(RADAR_ANGLES[i], r);
  });
}

const pointObjectsToString = (points) => points.map((p) => `${p.x},${p.y}`).join(" ");

function drawRadarNodes(points) {
  const g = $("courseRadarNodesSvg");
  if (!g) return;
  g.innerHTML = "";

  points.forEach((p) => {
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", p.x);
    ring.setAttribute("cy", p.y);
    ring.setAttribute("r", 7.6);
    ring.setAttribute("fill", "rgba(174,237,255,.24)");

    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", p.x);
    dot.setAttribute("cy", p.y);
    dot.setAttribute("r", 4.4);
    dot.setAttribute("fill", "#f9feff");

    g.appendChild(ring);
    g.appendChild(dot);
  });
}

function drawRadar(progress = 1) {
  const polygon = $("courseRadarPolygon");
  if (!polygon) return;

  const points = getRadarPointObjects(buildRadarScores(), progress);
  polygon.setAttribute("points", pointObjectsToString(points));
  drawRadarNodes(points);
}

function animateRadar() {
  const duration = 520;
  const start = performance.now();

  if (radarAnimationFrame) cancelAnimationFrame(radarAnimationFrame);

  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    drawRadar(1 - Math.pow(1 - t, 3));
    if (t < 1) radarAnimationFrame = requestAnimationFrame(tick);
    else radarAnimationFrame = null;
  };

  radarAnimationFrame = requestAnimationFrame(tick);
}

function setMeter(idFill, value) {
  const el = $(idFill);
  if (!el) return;
  const n = Number(value);
  el.style.width = `${Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0}%`;
}

function pickTopKimarite(kimarite = {}) {
  const items = Object.keys(EMPTY_KIMARITE)
    .map((k) => [k, Number(kimarite[k]) || 0])
    .sort((a, b) => b[1] - a[1]);

  return {
    main: items[0]?.[1] > 0 ? `${items[0][0]} ${items[0][1]}` : "—",
    sub: items.filter((x) => x[1] > 0).map((x) => `${x[0]} ${x[1]}`).join(" / ") || "—"
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
    const selfData = getSelfCourseDataForCurrentOtherMode();
    const selfStarts = num(selfData?.starts);
    const selfFirst = num(selfData?.first);
    const selfSecond = num(selfData?.second);
    const selfThird = num(selfData?.third);

    const winRate = Number.isFinite(selfStarts) && selfStarts > 0 && Number.isFinite(selfFirst)
      ? (selfFirst / selfStarts) * 100
      : null;
    const ren2Rate = Number.isFinite(selfStarts) && selfStarts > 0 && Number.isFinite(selfFirst) && Number.isFinite(selfSecond)
      ? ((selfFirst + selfSecond) / selfStarts) * 100
      : null;
    const ren3Rate = Number.isFinite(selfStarts) && selfStarts > 0 && Number.isFinite(selfFirst) && Number.isFinite(selfSecond) && Number.isFinite(selfThird)
      ? ((selfFirst + selfSecond + selfThird) / selfStarts) * 100
      : null;

    $("winRateText").textContent = formatRate(winRate);
    $("ren2RateText").textContent = formatRate(ren2Rate);
    $("ren3RateText").textContent = formatRate(ren3Rate);
    setMeter("winRateFill", winRate);
    setMeter("ren2RateFill", ren2Rate);
    setMeter("ren3RateFill", ren3Rate);

    if (selectedCourseTitle) selectedCourseTitle.textContent = `${selectedCourse}コース時の全体分布`;
    if (selectedCourseType) selectedCourseType.textContent = selectedRange === "other1y" ? "直近1年" : "直近3年";
    if (typePill) typePill.textContent = "本人＋他艇分布";

    const top = pickTopKimarite(selfData?.kimarite || {});
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
      <div class="playerTableHeadCell playerTableHeadCell--stub"><span>枠</span></div>
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
      <div class="playerTableCell playerTableCell--label">${labelHtml(label)}</div>
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
      <div class="playerTableCell playerTableCell--label">${labelHtml(label)}</div>
      ${values.map((v, i) => `
        <div class="playerTableCell playerTableCell--value${i === selectedCourse - 1 ? " is-highlight" : ""}">
          ${esc(v)}
        </div>
      `).join("")}
    </div>
  `;
}

function buildPlayerModeTable() {
  const dataset = getCurrentDataset();
  const rows = {
    starts: [], first: [], second: [], third: [],
    winRate: [], ren2Rate: [], ren3Rate: [], avgSt: [],
    nige: [], sashi: [], makuri: [], makurisashi: [], nuki: [], megumare: []
  };

  COURSE_ORDER.forEach((courseNo) => {
    const c = dataset.courseData[courseNo] || {};
    rows.starts.push(formatCount(c.starts));
    rows.first.push(formatCount(c.first));
    rows.second.push(formatCount(c.second));
    rows.third.push(formatCount(c.third));
    rows.winRate.push(formatRate(c.win));
    rows.ren2Rate.push(formatRate(c.ren2));
    rows.ren3Rate.push(formatRate(c.ren3));
    rows.avgSt.push(formatST(c.avgSt));
    rows.nige.push(formatCount(c.kimarite?.["逃げ"]));
    rows.sashi.push(formatCount(c.kimarite?.["差"]));
    rows.makuri.push(formatCount(c.kimarite?.["まくり"]));
    rows.makurisashi.push(formatCount(c.kimarite?.["まくり差し"]));
    rows.nuki.push(formatCount(c.kimarite?.["抜き"]));
    rows.megumare.push(formatCount(c.kimarite?.["恵まれ"]));
  });

  return [
    makeCourseHeader(),
    valueRow("コース別\n出走数", rows.starts),
    valueRow("1着", rows.first),
    valueRow("2着", rows.second),
    valueRow("3着", rows.third),
    rateRow("コース別\n1着率", rows.winRate),
    rateRow("コース別\n2連対率", rows.ren2Rate),
    rateRow("コース別\n3連対率", rows.ren3Rate),
    valueRow("コース別\n平均ST", rows.avgSt),
    valueRow("逃げ", rows.nige),
    valueRow("差し", rows.sashi),
    valueRow("まくり", rows.makuri),
    valueRow("まくり差し", rows.makurisashi),
    valueRow("抜き", rows.nuki),
    valueRow("恵まれ", rows.megumare)
  ].join("");
}

function buildOtherModeTable() {
  const refStarts = getReferenceStartsForOtherMode();
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

  COURSE_ORDER.forEach((course) => {
    const row = getOtherModeDisplayRow(course);
    const first = row.first;
    const second = row.second;
    const third = row.third;

    firstRow.push(formatCount(first));
    secondRow.push(formatCount(second));
    thirdRow.push(formatCount(third));

    if (Number.isFinite(refStarts) && refStarts > 0) {
      firstRateRow.push(formatRate((first / refStarts) * 100));
      ren2RateRow.push(formatRate(((first + second) / refStarts) * 100));
      ren3RateRow.push(formatRate(((first + second + third) / refStarts) * 100));
    } else {
      firstRateRow.push("—");
      ren2RateRow.push("—");
      ren3RateRow.push("—");
    }

    nigeRow.push(formatCount(row.kimarite?.["逃げ"]));
    sashiRow.push(formatCount(row.kimarite?.["差"]));
    makuriRow.push(formatCount(row.kimarite?.["まくり"]));
    makurisashiRow.push(formatCount(row.kimarite?.["まくり差し"]));
    nukiRow.push(formatCount(row.kimarite?.["抜き"]));
    megumareRow.push(formatCount(row.kimarite?.["恵まれ"]));
  });

  return [
    makeCourseHeader(),
    valueRow("コース別\n出走数", COURSE_ORDER.map(() => formatCount(refStarts))),
    valueRow("1着", firstRow),
    valueRow("2着", secondRow),
    valueRow("3着", thirdRow),
    rateRow("コース別\n1着率", firstRateRow),
    rateRow("コース別\n2連対率", ren2RateRow),
    rateRow("コース別\n3連対率", ren3RateRow),
    valueRow("逃げ", nigeRow),
    valueRow("差し", sashiRow),
    valueRow("まくり", makuriRow),
    valueRow("まくり差し", makurisashiRow),
    valueRow("抜き", nukiRow),
    valueRow("恵まれ", megumareRow)
  ].join("");
}

function renderTables() {
  $("playerCourseStats").innerHTML = isOtherMode() ? buildOtherModeTable() : buildPlayerModeTable();
}

function resetDatasets() {
  DATASETS["1y"].courseData = makeEmptyCourseData();
  DATASETS["3y"].courseData = makeEmptyCourseData();
  DATASETS["other1y"].raw = makeEmptyOtherRaw();
  DATASETS["other3y"].raw = makeEmptyOtherRaw();
}

function applyPlayerStatsToDataset(datasetKey, player) {
  const dataset = DATASETS[datasetKey];
  dataset.courseData = makeEmptyCourseData();
  if (!player?.courses) return;

  COURSE_ORDER.forEach((courseNo) => {
    const c = player.courses?.[String(courseNo)] || player.courses?.[courseNo] || {};
    dataset.courseData[courseNo] = {
      starts: num(c.starts),
      first: num(c.first),
      second: num(c.second),
      third: num(c.third),
      win: num(c.win_rate),
      ren2: num(c.ren2_rate),
      ren3: num(c.ren3_rate),
      avgSt: num(c.avg_st),
      kimarite: {
        "逃げ": num(c.kimarite?.["逃げ"]) ?? 0,
        "差": num(c.kimarite?.["差"]) ?? 0,
        "まくり": num(c.kimarite?.["まくり"]) ?? 0,
        "まくり差し": num(c.kimarite?.["まくり差し"]) ?? 0,
        "抜き": num(c.kimarite?.["抜き"]) ?? 0,
        "恵まれ": num(c.kimarite?.["恵まれ"]) ?? 0
      }
    };
  });
}

function pickOtherPlayerRoot(raw) {
  if (!raw) return null;
  return raw.base_courses ? raw : raw.data?.base_courses ? raw.data : raw.stats?.base_courses ? raw.stats : raw.trends?.base_courses ? raw.trends : raw;
}

function applyOtherBoatStatsToDataset(datasetKey, playerRaw) {
  const dataset = DATASETS[datasetKey];
  dataset.raw = makeEmptyOtherRaw();

  const player = pickOtherPlayerRoot(playerRaw);
  const baseCourses = player?.base_courses || player?.baseCourses;
  if (!baseCourses) return;

  COURSE_ORDER.forEach((baseCourse) => {
    const base = baseCourses[String(baseCourse)] || baseCourses[baseCourse];
    if (!base) return;

    const others = {};
    COURSE_ORDER.forEach((otherCourse) => {
      const o = base.others?.[String(otherCourse)] || base.others?.[otherCourse] || {};
      const kim = o.kimarite || o.win_kimarite || o.winning_kimarite || {};
      others[String(otherCourse)] = {
        first: num(o.first) ?? 0,
        second: num(o.second) ?? 0,
        third: num(o.third) ?? 0,
        kimarite: {
          "逃げ": num(kim["逃げ"]) ?? 0,
          "差": num(kim["差"]) ?? 0,
          "まくり": num(kim["まくり"]) ?? 0,
          "まくり差し": num(kim["まくり差し"]) ?? 0,
          "抜き": num(kim["抜き"]) ?? 0,
          "恵まれ": num(kim["恵まれ"]) ?? 0
        }
      };
    });

    dataset.raw[baseCourse] = {
      starts: num(base.starts),
      others
    };
  });
}

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(`${url}?t=${Math.floor(Date.now() / 300000)}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const pickStandardPlayer = (json, key) => json?.players?.[key] || json?.[key] || null;
const pickOtherPlayer = (json, key) =>
  json?.players?.[key] ||
  json?.data?.players?.[key] ||
  json?.stats?.players?.[key] ||
  json?.trends?.players?.[key] ||
  json?.[key] ||
  json?.data?.[key] ||
  json?.stats?.[key] ||
  json?.trends?.[key] ||
  null;

async function loadPlayerStats() {
  resetDatasets();
  if (!regno) return;

  const [p1, p3, o1, o3] = await Promise.all([
    fetchJsonSafe(PLAYER_COURSE_STATS_1Y_URL),
    fetchJsonSafe(PLAYER_COURSE_STATS_3Y_URL),
    fetchJsonSafe(PLAYER_OTHER_BOAT_TRENDS_1Y_URL),
    fetchJsonSafe(PLAYER_OTHER_BOAT_TRENDS_3Y_URL)
  ]);

  applyPlayerStatsToDataset("1y", pickStandardPlayer(p1, regno));
  applyPlayerStatsToDataset("3y", pickStandardPlayer(p3, regno));
  applyOtherBoatStatsToDataset("other1y", pickOtherPlayer(o1, regno));
  applyOtherBoatStatsToDataset("other3y", pickOtherPlayer(o3, regno));
}

async function boot() {
  applyHeroGradeTheme();
  upgradeDataTabs();
  buildRadarGrid();
  ensureRadarExtraLayers();
  drawStaticRadarLabels();
  makeCourseTabs();
  bindRangeTabs();

  await loadPlayerStats();

  renderTables();
  renderHeroText();
  drawRadar(0);

  requestAnimationFrame(() => {
    drawStaticRadarLabels();
    animateRadar();
  });

  window.addEventListener("resize", () => {
    drawStaticRadarLabels();
    drawRadar(1);
  }, { passive: true });
}

boot();