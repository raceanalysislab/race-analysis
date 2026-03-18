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
const RADAR_CY = 160;
const RADAR_GRID_MAX_R = 118;
const RADAR_VALUE_MAX_R = 98;
const RADAR_INNER_SCALE = 0.84;
const RADAR_LABEL_R = 136;
const RADAR_ANGLES = [-90, -30, 30, 90, 150, 210].map((deg) => deg * Math.PI / 180);

const courseData1Y = {
  1: { starts: "45", winCount: "35", second: "3", third: "2", win: 77.7, ren2: 84.4, ren3: 88.8, nige: "34", sashi: "0", makuri: "0", makurisashi: "0", nuki: "1", megumare: "0", st: "0.13", f: "0", l: "0" },
  2: { starts: "45", winCount: "2",  second: "13", third: "10", win: 4.4,  ren2: 33.3, ren3: 55.5, nige: "0",  sashi: "1", makuri: "1", makurisashi: "0", nuki: "0", megumare: "0", st: "0.14", f: "0", l: "0" },
  3: { starts: "45", winCount: "4",  second: "12", third: "10", win: 8.8,  ren2: 35.5, ren3: 57.7, nige: "0",  sashi: "0", makuri: "2", makurisashi: "1", nuki: "1", megumare: "0", st: "0.13", f: "0", l: "0" },
  4: { starts: "45", winCount: "2",  second: "6",  third: "6",  win: 4.4,  ren2: 17.7, ren3: 31.1, nige: "0",  sashi: "0", makuri: "2", makurisashi: "0", nuki: "0", megumare: "0", st: "0.15", f: "0", l: "0" },
  5: { starts: "45", winCount: "1",  second: "9",  third: "12", win: 2.2,  ren2: 22.2, ren3: 48.8, nige: "0",  sashi: "1", makuri: "0", makurisashi: "0", nuki: "0", megumare: "0", st: "0.16", f: "0", l: "0" },
  6: { starts: "44", winCount: "1",  second: "2",  third: "5",  win: 2.2,  ren2: 6.8,  ren3: 18.1, nige: "0",  sashi: "0", makuri: "0", makurisashi: "1", nuki: "0", megumare: "0", st: "0.14", f: "0", l: "0" }
};

const courseData3Y = JSON.parse(JSON.stringify(courseData1Y));

let selectedCourse = Math.min(6, Math.max(1, Number.isFinite(waku) ? waku : 1));
let selectedRange = "1y";
let radarAnimationFrame = null;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function normalizeGradeClass(g) {
  const x = String(g || "").trim().toUpperCase();
  if (x === "A1") return "a1";
  if (x === "A2") return "a2";
  if (x === "B1") return "b1";
  if (x === "B2") return "b2";
  return "b1";
}

function applyGradeTheme() {
  document.body.setAttribute("data-player-grade", normalizeGradeClass(grade));
}

function getActiveCourseMap() {
  return selectedRange === "3y" ? courseData3Y : courseData1Y;
}

function getSelectedData() {
  const map = getActiveCourseMap();
  return map[selectedCourse] || map[1];
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
    >
      ${n}
    </button>
  `).join("");

  root.querySelectorAll(".courseHeroTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextCourse = Number(btn.dataset.course || 1);
      if (nextCourse === selectedCourse) return;

      selectedCourse = nextCourse;
      makeCourseTabs();
      renderHeroCompact();
      layoutRadarLabels();
      animateRadar();
    });
  });
}

function makeRangeTabs() {
  const root = $("playerRangeTabs");
  if (!root) return;

  root.innerHTML = `
    <button type="button" class="playerRangeTab${selectedRange === "1y" ? " is-active" : ""}" data-range="1y">直近1年データ</button>
    <button type="button" class="playerRangeTab${selectedRange === "3y" ? " is-active" : ""}" data-range="3y">直近3年データ</button>
  `;

  root.querySelectorAll(".playerRangeTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextRange = String(btn.dataset.range || "1y");
      if (nextRange === selectedRange) return;
      selectedRange = nextRange;
      makeRangeTabs();
      renderTables();
      renderHeroCompact();
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

  const levels = [24, 46, 68, 90, RADAR_GRID_MAX_R];
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

  if (!$("courseRadarPolygonCore")) {
    const core = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    core.setAttribute("id", "courseRadarPolygonCore");
    svg.appendChild(core);
  }

  const stage = document.querySelector(".courseRadarStage");
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

  labels.innerHTML = COURSE_ORDER.map((course) => (
    `<div class="radarLabel radarLabel--${course}" data-course="${course}" aria-hidden="true"></div>`
  )).join("");
}

function getRadarValues() {
  const map = getActiveCourseMap();
  return COURSE_ORDER.map((course) => {
    const data = map[course] || { win: 0 };
    return Number(data.win) || 0;
  });
}

function getRadarPointObjects(values, progress = 1, scale = 1) {
  const maxValue = Math.max(...values, 1);

  return values.map((v, i) => {
    const rate = (v / maxValue) * progress;
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
    1: { dx: 0,  dy: -3 },
    2: { dx: 6,  dy: -2 },
    3: { dx: 6,  dy: 2 },
    4: { dx: 0,  dy: 5 },
    5: { dx: -6, dy: 2 },
    6: { dx: -6, dy: -2 }
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
  const core = $("courseRadarPolygonCore");
  if (!polygon || !core) return;

  const values = getRadarValues();
  const outerPoints = getRadarPointObjects(values, progress, 1);
  const innerPoints = getRadarPointObjects(values, progress, RADAR_INNER_SCALE);

  polygon.setAttribute("points", pointObjectsToString(outerPoints));
  core.setAttribute("points", pointObjectsToString(innerPoints));
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

function setGauge(idFill, value) {
  const el = $(idFill);
  if (!el) return;
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  el.style.width = `${width}%`;
}

function renderHeroCompact() {
  const data = getSelectedData();

  if ($("selectedCourseTitle")) $("selectedCourseTitle").textContent = "";
  if ($("selectedCourseType")) $("selectedCourseType").textContent = "";
  if ($("courseTypePill")) $("courseTypePill").textContent = "";

  $("winRateText").textContent = `${data.win.toFixed(1)}%`;
  $("ren2RateText").textContent = `${data.ren2.toFixed(1)}%`;
  $("ren3RateText").textContent = `${data.ren3.toFixed(1)}%`;

  setGauge("winRateFill", data.win);
  setGauge("ren2RateFill", data.ren2);
  setGauge("ren3RateFill", data.ren3);

  const kimariteMain = $("kimariteMain");
  const kimariteSub = $("kimariteSub");
  if (kimariteMain) kimariteMain.textContent = "";
  if (kimariteSub) kimariteSub.textContent = "";
}

function makeCourseHeader() {
  return `
    <div class="playerTableHead">
      <div class="playerTableHeadCell playerTableHeadCell--stub">
        <span>枠</span>
      </div>
      ${COURSE_ORDER.map((course) => `
        <div class="playerTableHeadCell playerTableHeadCell--waku playerTableHeadCell--waku${course}">
          <div class="playerCourseName">${course}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function valueRow(label, values, highlightFirst = false) {
  return `
    <div class="playerTableRow">
      <div class="playerTableCell playerTableCell--label">${esc(label)}</div>
      ${values.map((v, i) => `
        <div class="playerTableCell playerTableCell--value${highlightFirst && i === 0 ? " is-highlight" : ""}">
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
        const n = Number(String(v).replace("%", "").trim());
        const width = Number.isFinite(n) ? Math.max(0, Math.min(n, 100)) : 0;
        return `
          <div class="playerTableCell playerTableCell--value${i === 0 ? " is-highlight" : ""}">
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
  const map = getActiveCourseMap();

  const starts = COURSE_ORDER.map((c) => map[c].starts);
  const winCount = COURSE_ORDER.map((c) => map[c].winCount);
  const second = COURSE_ORDER.map((c) => map[c].second);
  const third = COURSE_ORDER.map((c) => map[c].third);
  const winRate = COURSE_ORDER.map((c) => `${map[c].win.toFixed(1)} %`);
  const ren2Rate = COURSE_ORDER.map((c) => `${map[c].ren2.toFixed(1)} %`);
  const ren3Rate = COURSE_ORDER.map((c) => `${map[c].ren3.toFixed(1)} %`);
  const avgSt = COURSE_ORDER.map((c) => map[c].st);
  const nige = COURSE_ORDER.map((c) => map[c].nige);
  const sashi = COURSE_ORDER.map((c) => map[c].sashi);
  const makuri = COURSE_ORDER.map((c) => map[c].makuri);
  const makurisashi = COURSE_ORDER.map((c) => map[c].makurisashi);
  const nuki = COURSE_ORDER.map((c) => map[c].nuki);
  const megumare = COURSE_ORDER.map((c) => map[c].megumare);

  $("playerCourseStats").innerHTML = [
    makeCourseHeader(),
    valueRow("出走数", starts, true),
    valueRow("1着", winCount, true),
    valueRow("2着", second, true),
    valueRow("3着", third, true),
    rateRow("1着率", winRate),
    rateRow("2連対率", ren2Rate),
    rateRow("3連対率", ren3Rate),
    valueRow("平均ST", avgSt, true),
    valueRow("逃げ", nige, true),
    valueRow("差し", sashi, true),
    valueRow("まくり", makuri, true),
    valueRow("まくり差し", makurisashi, true),
    valueRow("抜き", nuki, true),
    valueRow("恵まれ", megumare, true)
  ].join("");

  const timingWrap = $("playerTimingTable");
  if (timingWrap) timingWrap.innerHTML = "";
}

function boot() {
  applyGradeTheme();
  buildRadarGrid();
  ensureRadarExtraLayers();
  ensureRadarLabels();
  makeCourseTabs();
  makeRangeTabs();
  renderTables();
  renderHeroCompact();
  layoutRadarLabels();
  drawRadar(0);

  requestAnimationFrame(() => {
    layoutRadarLabels();
    animateRadar();
  });

  window.addEventListener("resize", layoutRadarLabels, { passive: true });
}

boot();