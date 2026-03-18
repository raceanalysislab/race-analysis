const qs = new URLSearchParams(location.search);

const playerName = decodeURIComponent(qs.get("name") || "選手情報");
const regno = String(qs.get("regno") || "").trim();
const grade = String(qs.get("grade") || "").trim();
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
const RADAR_CY = 162;
const RADAR_GRID_MAX_R = 122;
const RADAR_VALUE_MAX_R = 96;
const RADAR_INNER_SCALE = 0.82;
const RADAR_LABEL_R = 140;
const RADAR_ANGLES = [-90, -30, 30, 90, 150, 210].map((deg) => deg * Math.PI / 180);

const courseData = {
  1: { win: 77.7, ren2: 84.4, ren3: 88.8, type: "イン型",     kimariteMain: "逃げ 94%",     kimariteSub: "差し 2.7% / まくり 1.1%" },
  2: { win: 4.4,  ren2: 33.3, ren3: 55.5, type: "差し型",     kimariteMain: "差し 58%",     kimariteSub: "まくり 18% / 抜き 9%" },
  3: { win: 8.8,  ren2: 35.5, ren3: 57.7, type: "センター型", kimariteMain: "まくり 41%",   kimariteSub: "まくり差し 21% / 差し 10%" },
  4: { win: 4.4,  ren2: 17.7, ren3: 31.1, type: "カド型",     kimariteMain: "まくり 29%",   kimariteSub: "差し 13% / まくり差し 8%" },
  5: { win: 2.2,  ren2: 22.2, ren3: 48.8, type: "アウト型",   kimariteMain: "差し 16%",     kimariteSub: "まくり差し 7% / 抜き 5%" },
  6: { win: 2.2,  ren2: 6.8,  ren3: 18.1, type: "大外型",     kimariteMain: "差し 7%",      kimariteSub: "まくり差し 3% / 抜き 1%" }
};

let selectedCourse = Math.min(6, Math.max(1, Number.isFinite(waku) ? waku : 1));
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

  const levels = [28, 50, 72, 94, RADAR_GRID_MAX_R];
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
  return COURSE_ORDER.map((course) => {
    const data = courseData[course] || { win: 0 };
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
    1: { dx: 0,  dy: -4 },
    2: { dx: 7,  dy: -2 },
    3: { dx: 7,  dy: 2 },
    4: { dx: 0,  dy: 6 },
    5: { dx: -7, dy: 2 },
    6: { dx: -7, dy: -2 }
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
  const data = courseData[selectedCourse] || courseData[1];

  $("selectedCourseTitle").textContent = `${selectedCourse}コース進入時`;
  $("selectedCourseType").textContent = data.type;

  const courseTypePill = $("courseTypePill");
  if (courseTypePill) courseTypePill.textContent = data.type;

  $("winRateText").textContent = `${data.win.toFixed(1)}%`;
  $("ren2RateText").textContent = `${data.ren2.toFixed(1)}%`;
  $("ren3RateText").textContent = `${data.ren3.toFixed(1)}%`;

  setMeter("winRateFill", data.win);
  setMeter("ren2RateFill", data.ren2);
  setMeter("ren3RateFill", data.ren3);

  const kimariteMain = $("kimariteMain");
  const kimariteSub = $("kimariteSub");
  if (kimariteMain) kimariteMain.textContent = data.kimariteMain;
  if (kimariteSub) kimariteSub.textContent = data.kimariteSub;
}

function makeCourseHeader(){
  return `
    <div class="playerTableHead">
      <div class="playerTableHeadCell playerTableHeadCell--stub">
        <span>枠</span>
      </div>
      ${COURSE_ORDER.map((course) => `
        <div class="playerTableHeadCell playerTableHeadCell--c${course}">
          <div class="playerCourseName">${course}コース</div>
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
        const n = Number(String(v).replace("%","").replace(/\s/g, "").trim());
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
  $("playerCourseStats").innerHTML = [
    makeCourseHeader(),
    valueRow("出走数", ["45","45","45","45","45","44"], true),
    valueRow("1着", ["35","2","4","2","1","1"], true),
    valueRow("2着", ["3","13","12","6","9","2"], true),
    valueRow("3着", ["2","10","10","6","12","5"], true),
    rateRow("1着率", ["77.7 %","4.4 %","8.8 %","4.4 %","2.2 %","2.2 %"]),
    rateRow("2連対率", ["84.4 %","33.3 %","35.5 %","17.7 %","22.2 %","6.8 %"]),
    rateRow("3連対率", ["88.8 %","55.5 %","57.7 %","31.1 %","48.8 %","18.1 %"]),
    valueRow("平均ST", ["0.13","0.14","0.13","0.15","0.16","0.14"], false),
    valueRow("逃げ", ["34","0","0","0","0","0"], true),
    valueRow("差し", ["0","1","0","0","1","0"], true),
    valueRow("まくり", ["0","1","2","2","0","0"], true),
    valueRow("まくり差し", ["0","0","1","0","0","1"], true),
    valueRow("抜き", ["1","0","1","0","0","0"], true),
    valueRow("恵まれ", ["0","0","0","0","0","0"], true)
  ].join("");
}

function boot(){
  buildRadarGrid();
  ensureRadarExtraLayers();
  ensureRadarLabels();
  renderTables();
  makeCourseTabs();
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