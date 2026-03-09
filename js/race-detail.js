const qs = new URLSearchParams(location.search);

const venueName = decodeURIComponent(qs.get("name") || "会場");
const jcd = String(qs.get("jcd") || "").padStart(2, "0");

const $ = (id) => document.getElementById(id);

const $tabs = $("tabs");
const $raceNoLabel = $("raceNoLabel");
const $timeLabel = $("timeLabel");
const $dayLabel = $("dayLabel");
const $raceTop = $("raceTop");
const $viewTabs = $("viewTabs");
const $viewTrack = $("viewTrack");
const $viewPager = $("viewPager");

const $entryTable = $("entryTable");
const $courseYearBody = $("courseYearBody");
const $courseLocalBody = $("courseLocalBody");

const BOT_RACES_BASE_URL =
  "https://cdn.jsdelivr.net/gh/raceanalysislab/race-data-bot@main/data/site/races/";

$("venueName").textContent = venueName;

let currentRace = 1;
let currentView = 0;
let dragStartX = 0;
let dragCurrentX = 0;
let dragging = false;

let courseStats = {};
let courseStatsLoaded = false;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
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

const safeRate = (num, den, digits = 1) => {
  const n = Number(num);
  const d = Number(den);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(digits)}%`;
};

const toHM = (x) => {
  const m = String(x || "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "--:--";
};

function setTopHeight() {
  const h = $raceTop.getBoundingClientRect().height || 112;
  document.documentElement.style.setProperty("--raceTopH", `${Math.ceil(h)}px`);
}

async function fetchJSON(url) {
  const joiner = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${joiner}t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(url);
  return res.json();
}

async function loadCourseStats() {
  try {
    courseStats = await fetchJSON("./data/site/course_stats_3y.json");
    courseStatsLoaded = true;
    console.log("courseStats loaded", Object.keys(courseStats).length);
  } catch (err) {
    courseStats = {};
    courseStatsLoaded = false;
    console.error("courseStats load error", err);
  }
}

function makeTabs(active) {
  $tabs.innerHTML = Array.from({ length: 12 }, (_, i) => {
    const r = i + 1;
    return `<button type="button" class="tab${r === active ? " is-active" : ""}" data-race="${r}">${r}R</button>`;
  }).join("");

  $tabs.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setRace(Number(btn.dataset.race));
    });
  });
}

function normalizeBoatsTo6(boats) {
  const byWaku = new Map();
  const rest = [];

  boats.forEach((b) => {
    const w = Number(b?.waku);
    if (w >= 1 && w <= 6 && !byWaku.has(w)) byWaku.set(w, b);
    else rest.push(b);
  });

  for (let w = 1; w <= 6; w++) {
    if (!byWaku.has(w) && rest.length) {
      byWaku.set(w, { ...rest.shift(), waku: w });
    }
  }

  return Array.from({ length: 6 }, (_, i) => {
    const w = i + 1;
    return byWaku.get(w) || {
      waku: w,
      name: "—",
      regno: "",
      branch: "",
      age: "",
      grade: "",
      nat_win: null,
      motor_no: null,
      motor_2: null,
      note: ""
    };
  });
}

function extractAverageSt(note) {
  const text = String(note || "").trim();
  if (!text) return "—";
  const m = text.match(/(?:^|\s)(0\.\d{2})(?:\s|$)/);
  return m ? m[1] : "—";
}

function getCourseStat(regno, course) {
  if (!courseStatsLoaded) return null;
  const player = courseStats[String(regno)];
  if (!player) return null;
  return player[String(course)] || null;
}

function kimariteText(kimarite) {
  if (!kimarite || typeof kimarite !== "object") return "—";
  const arr = Object.entries(kimarite)
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  if (!arr.length) return "—";

  const top = arr[0][0];
  return top;
}

function entryAvgSt(p) {
  const stat = getCourseStat(p.regno, p.waku);
  if (stat && stat.avg_st !== undefined && stat.avg_st !== null) {
    return safeNum(stat.avg_st, 2);
  }
  return extractAverageSt(p.note);
}

function entryRowHTML(p) {
  const regno = p.regno || "—";
  const grade = p.grade || "—";
  const branch = p.branch || "—";
  const age = (p.age !== undefined && p.age !== null && p.age !== "") ? `${p.age}歳` : "—";
  const avgSt = entryAvgSt(p);

  return `
    <div class="entryRow">
      <div class="entryWaku w${Number(p.waku) || 0}">${Number(p.waku) || ""}</div>

      <div class="entryNameCell">
        <div class="entryMeta">${esc(regno)} / ${esc(grade)} / ${esc(branch)} / ${esc(age)}</div>
        <div class="entryName">${esc(p.name || "—")}</div>
      </div>

      <div class="entryVal">${esc(avgSt)}</div>
      <div class="entryVal">${esc(safeNum(p.nat_win))}</div>

      <div class="entryVal">
        <div class="entryMotor">
          <div class="entryMotorNo">${esc(safeInt(p.motor_no))}</div>
          <div class="entryMotorRate">${esc(safeNum(p.motor_2))}</div>
        </div>
      </div>
    </div>
  `;
}

function courseGridHTML(boats) {
  const header = `
    <div class="entryRow entryRow--head">
      <div class="entryWaku entryWaku--head">枠</div>
      <div class="entryNameCell entryNameCell--head">選手名</div>
      <div class="entryVal entryVal--head">平均ST</div>
      <div class="entryVal entryVal--head">勝率</div>
      <div class="entryVal entryVal--head">2連率</div>
      <div class="entryVal entryVal--head">決まり手</div>
    </div>
  `;

  const rows = boats.map((p) => {
    const stat = getCourseStat(p.regno, p.waku);
    const regno = p.regno || "—";
    const grade = p.grade || "—";
    const branch = p.branch || "—";
    const age = (p.age !== undefined && p.age !== null && p.age !== "") ? `${p.age}歳` : "—";

    return `
      <div class="entryRow">
        <div class="entryWaku w${Number(p.waku) || 0}">${Number(p.waku) || ""}</div>

        <div class="entryNameCell">
          <div class="entryMeta">${esc(regno)} / ${esc(grade)} / ${esc(branch)} / ${esc(age)}</div>
          <div class="entryName">${esc(p.name || "—")}</div>
        </div>

        <div class="entryVal">${esc(stat ? safeNum(stat.avg_st, 2) : "—")}</div>
        <div class="entryVal">${esc(stat ? safeRate(stat.wins, stat.starts) : "—")}</div>
        <div class="entryVal">${esc(stat ? safeRate(stat.place2, stat.starts) : "—")}</div>
        <div class="entryVal">${esc(stat ? kimariteText(stat.kimarite) : "—")}</div>
      </div>
    `;
  }).join("");

  return header + rows;
}

function renderCourseRows(boats) {
  if ($courseYearBody) {
    $courseYearBody.innerHTML = courseGridHTML(boats);
  }

  if ($courseLocalBody) {
    $courseLocalBody.innerHTML = `
      <div class="entryRow entryRow--head">
        <div class="entryWaku entryWaku--head">枠</div>
        <div class="entryNameCell entryNameCell--head">選手名</div>
        <div class="entryVal entryVal--head">平均ST</div>
        <div class="entryVal entryVal--head">勝率</div>
        <div class="entryVal entryVal--head">2連率</div>
        <div class="entryVal entryVal--head">決まり手</div>
      </div>
      ${boats.map((p) => `
        <div class="entryRow">
          <div class="entryWaku w${Number(p.waku) || 0}">${Number(p.waku) || ""}</div>
          <div class="entryNameCell">
            <div class="entryMeta">${esc(p.regno || "—")} / ${esc(p.grade || "—")} / ${esc(p.branch || "—")} / ${esc((p.age !== undefined && p.age !== null && p.age !== "") ? `${p.age}歳` : "—")}</div>
            <div class="entryName">${esc(p.name || "—")}</div>
          </div>
          <div class="entryVal">—</div>
          <div class="entryVal">—</div>
          <div class="entryVal">—</div>
          <div class="entryVal">—</div>
        </div>
      `).join("")}
    `;
  }
}

function setView(index) {
  currentView = clamp(index, 0, 2);

  Array.from($viewTabs.querySelectorAll(".viewTab")).forEach((btn, i) => {
    btn.classList.toggle("is-active", i === currentView);
  });

  $viewTrack.style.transform = `translate3d(${-100 * currentView}%,0,0)`;
}

function setupViewTabs() {
  Array.from($viewTabs.querySelectorAll(".viewTab")).forEach((btn) => {
    btn.addEventListener("click", () => {
      setView(Number(btn.dataset.view));
    });
  });
}

function setupCourseTabs() {
  const tabs = Array.from(document.querySelectorAll(".courseInnerTab"));
  const yearView = $("courseYearView");
  const localView = $("courseLocalView");

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("is-active"));
      btn.classList.add("is-active");

      if (btn.dataset.courseTab === "year") {
        if (yearView) yearView.style.display = "";
        if (localView) localView.style.display = "none";
      } else {
        if (yearView) yearView.style.display = "none";
        if (localView) localView.style.display = "";
      }
    });
  });
}

function setupSwipe() {
  $viewPager.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragStartX = e.clientX;
    dragCurrentX = e.clientX;
    $viewTrack.classList.add("is-dragging");
  });

  $viewPager.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragCurrentX = e.clientX;

    const width = $viewPager.clientWidth || 1;
    const delta = dragCurrentX - dragStartX;
    const pct = (delta / width) * 100;

    $viewTrack.style.transform = `translate3d(${(-100 * currentView) + pct}%,0,0)`;
  });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    $viewTrack.classList.remove("is-dragging");

    const width = $viewPager.clientWidth || 1;
    const delta = dragCurrentX - dragStartX;

    if (delta < -width * 0.18 && currentView < 2) {
      setView(currentView + 1);
      return;
    }

    if (delta > width * 0.18 && currentView > 0) {
      setView(currentView - 1);
      return;
    }

    setView(currentView);
  };

  $viewPager.addEventListener("pointerup", finish);
  $viewPager.addEventListener("pointercancel", finish);
}

function buildUrls(r) {
  return [
    ...(jcd && jcd !== "00" ? [`${BOT_RACES_BASE_URL}${jcd}_${r}R.json`] : []),
    `${BOT_RACES_BASE_URL}${venueName}_${r}R.json`
  ];
}

async function fetchRaceJSON(r) {
  let lastErr = null;

  for (const url of buildUrls(r)) {
    try {
      return await fetchJSON(url);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr;
}

function renderRaceJSON(r, json) {
  const raceObj = json?.race || {};

  $raceNoLabel.textContent = `${r}R`;
  $timeLabel.textContent = `締切: ${toHM(raceObj.cutoff)}`;
  $dayLabel.textContent = json?.day_label || "—";

  const boats = normalizeBoatsTo6(Array.isArray(raceObj.boats) ? raceObj.boats : []);

  $entryTable.innerHTML = boats.map(entryRowHTML).join("");
  renderCourseRows(boats);

  setTopHeight();
}

async function setRace(r) {
  r = clamp(Number(r) || 1, 1, 12);
  currentRace = r;

  makeTabs(r);
  $entryTable.innerHTML = `<div class="err">読み込み中…</div>`;

  if ($courseYearBody) $courseYearBody.innerHTML = `<div class="err">読み込み中…</div>`;
  if ($courseLocalBody) $courseLocalBody.innerHTML = `<div class="err">読み込み中…</div>`;

  try {
    const json = await fetchRaceJSON(r);
    renderRaceJSON(r, json);
  } catch (e) {
    $entryTable.innerHTML = `<div class="err">JSON取得失敗</div>`;
    if ($courseYearBody) $courseYearBody.innerHTML = `<div class="err">JSON取得失敗</div>`;
    if ($courseLocalBody) $courseLocalBody.innerHTML = `<div class="err">JSON取得失敗</div>`;
  }
}

async function boot() {
  const initialRace = clamp(Number(qs.get("race") || 1), 1, 12);

  makeTabs(initialRace);
  setupViewTabs();
  setupCourseTabs();
  setupSwipe();
  setView(0);

  await loadCourseStats();
  await setRace(initialRace);

  requestAnimationFrame(setTopHeight);
}

addEventListener("resize", setTopHeight, { passive: true });
$("btnBack").addEventListener("click", () => history.back());

boot();