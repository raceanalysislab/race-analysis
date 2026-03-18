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
const RADAR_CY = 154;
const RADAR_GRID_MAX_R = 112;
const RADAR_VALUE_MAX_R = 90;
const RADAR_INNER_SCALE = 0.82;
const RADAR_LABEL_R = 126;

const RADAR_ANGLES = [-90, -30, 30, 90, 150, 210].map((deg) => deg * Math.PI / 180);

const BASE_COURSE_DATA = {
  1: { win: 77.7, ren2: 84.4, ren3: 88.8 },
  2: { win: 4.4,  ren2: 33.3, ren3: 55.5 },
  3: { win: 8.8,  ren2: 35.5, ren3: 57.7 },
  4: { win: 4.4,  ren2: 17.7, ren3: 31.1 },
  5: { win: 2.2,  ren2: 22.2, ren3: 48.8 },
  6: { win: 2.2,  ren2: 6.8,  ren3: 18.1 }
};

const BASE_TABLE_DATA = {
  starts: ["45","45","45","45","45","44"],
  first: ["35","2","4","2","1","1"],
  second: ["3","13","12","6","9","2"],
  third: ["2","10","10","6","12","5"],
  winRate: ["77.7 %","4.4 %","8.8 %","4.4 %","2.2 %","2.2 %"],
  ren2Rate: ["84.4 %","33.3 %","35.5 %","17.7 %","22.2 %","6.8 %"],
  ren3Rate: ["88.8 %","55.5 %","57.7 %","31.1 %","48.8 %","18.1 %"],
  avgSt: ["0.13","0.14","0.13","0.15","0.16","0.14"],
  nige: ["34","0","0","0","0","0"],
  sashi: ["0","1","0","0","1","0"],
  makuri: ["0","1","2","2","0","0"],
  makurisashi: ["0","0","1","0","0","1"],
  nuki: ["1","0","1","0","0","0"],
  megumare: ["0","0","0","0","0","0"]
};

const DATASETS = {
  "1y": {
    title: "直近1年コースデータ",
    courseData: BASE_COURSE_DATA,
    table: BASE_TABLE_DATA
  },
  "3y": {
    title: "直近3年コースデータ",
    courseData: BASE_COURSE_DATA,
    table: BASE_TABLE_DATA
  }
};

let selectedCourse = Math.min(6, Math.max(1, Number.isFinite(waku) ? waku : 1));
let selectedRange = "1y";
let radarAnimationFrame = null;

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function getCurrentDataset(){
  return DATASETS[selectedRange] || DATASETS["1y"];
}

function applyHeroGradeTheme(){
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

function makeCourseTabs(){
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
      renderHeroText();
      layoutRadarLabels();
      animateRadar();
    });
  });
}

function bindRangeTabs(){
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

      const title = $("playerDataTitle");
      if (title) title.textContent = getCurrentDataset().title;

      renderTables();
      renderHeroText();
      animateRadar();
    });
  });
}

function polygonPointsFromRadius(r){
  return RADAR_ANGLES.map((a) => {
    const x = RADAR_CX + Math.cos(a) * r;
    const y = RADAR_CY + Math.sin(a) * r;
    return `${x},${y}`;
  }).join(" ");
}

function buildRadarGrid(){
  const g = $("courseRadarGrid");
  if (!g) return;

  const levels = [28, 50, 72, 92, RADAR_GRID_MAX_R];
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

function ensureRadarExtraLayers(){
  const svg = document.querySelector(".courseRadarSvg");
  if (!svg) return;

  if (!$("courseRadarPolygonCore")) {
    const core = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    core.setAttribute("id", "courseRadarPolygonCore");
    svg.appendChild(core);
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

function ensureRadarLabels(){
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

function getRadarValues(){
  const dataset = getCurrentDataset();
  return COURSE_ORDER.map((course) => {
    const data = dataset.courseData[course] || { win: 0 };
    return Number(data.win) || 0;
  });
}

function getRadarPointObjects(values, progress = 1, scale = 1){
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

function pointObjectsToString(points){
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function layoutRadarNodes(points){
  points.forEach((p, i) => {
    const node = $(`courseRadarNode${i + 1}`);
    if (!node) return;
    node.style.left = `${(p.x / RADAR_SIZE) * 100}%`;
    node.style.top = `${(p.y / RADAR_SIZE) * 100}%`;
  });
}

function getLabelOffsets(){
  return {
    1: { dx: 0,  dy: -2 },
    2: { dx: 8,  dy: -1 },
    3: { dx: 8,  dy: 2 },
    4: { dx: 0,  dy: 1 },
    5: { dx: -8, dy: 2 },
    6: { dx: -8, dy: -1 }
  };
}

function layoutRadarLabels(){
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

function drawRadar(progress = 1){
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

function animateRadar(){
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

function setMeter(idFill, value){
  const el = $(idFill);
  if (!el) return;
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  el.style.width = `${width}%`;
}

function renderHeroText(){
  const dataset = getCurrentDataset();
  const data = dataset.courseData[selectedCourse] || dataset.courseData[1];

  $("winRateText").textContent = `${data.win.toFixed(1)}%`;
  $("ren2RateText").textContent = `${data.ren2.toFixed(1)}%`;
  $("ren3RateText").textContent = `${data.ren3.toFixed(1)}%`;

  setMeter("winRateFill", data.win);
  setMeter("ren2RateFill", data.ren2);
  setMeter("ren3RateFill", data.ren3);
}

function makeCourseHeader(){
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

function valueRow(label, values, highlightFirst = false){
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

function rateRow(label, values){
  return `
    <div class="playerTableRow">
      <div class="playerTableCell playerTableCell--label">${esc(label)}</div>
      ${values.map((v, i) => {
        const n = Number(String(v).replace("%", "").replace(/\s/g, "").trim());
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

function renderTables(){
  const t = getCurrentDataset().table;

  $("playerCourseStats").innerHTML = [
    makeCourseHeader(),
    valueRow("出走数", t.starts, true),
    valueRow("1着", t.first, true),
    valueRow("2着", t.second, true),
    valueRow("3着", t.third, true),
    rateRow("1着率", t.winRate),
    rateRow("2連対率", t.ren2Rate),
    rateRow("3連対率", t.ren3Rate),
    valueRow("平均ST", t.avgSt),
    valueRow("逃げ", t.nige, true),
    valueRow("差し", t.sashi, true),
    valueRow("まくり", t.makuri, true),
    valueRow("まくり差し", t.makurisashi, true),
    valueRow("抜き", t.nuki, true),
    valueRow("恵まれ", t.megumare, true)
  ].join("");
}

function boot(){
  applyHeroGradeTheme();

  const title = $("playerDataTitle");
  if (title) title.textContent = getCurrentDataset().title;

  buildRadarGrid();
  ensureRadarExtraLayers();
  ensureRadarLabels();
  renderTables();
  makeCourseTabs();
  bindRangeTabs();
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