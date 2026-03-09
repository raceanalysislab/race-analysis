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

const $compactTable = $("compactTable");
const $compareTable = $("compareTable");
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

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#39;"
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

const toHM = (x) => {
  const m = String(x || "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "--:--";
};

function setTopHeight() {
  const h = $raceTop.getBoundingClientRect().height || 112;
  document.documentElement.style.setProperty("--raceTopH", `${Math.ceil(h)}px`);
}

async function fetchJSON(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(url);
  return res.json();
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

function compactRowHTML(p) {
  const regno = p.regno || "—";
  const grade = p.grade || "—";
  const branch = p.branch || "—";

  return `
    <div class="compactRow">
      <div class="compactWaku w${Number(p.waku) || 0}">${Number(p.waku) || ""}</div>
      <div class="compactReg">${esc(regno)}</div>
      <div class="compactNameBox">
        <div class="compactMeta">${esc(grade)} / ${esc(branch)}</div>
        <div class="compactName">${esc(p.name || "—")}</div>
      </div>
      <div class="compactGrade">${esc(grade)}</div>
    </div>
  `;
}

function compareRowHTML(p) {
  const regno = p.regno || "—";
  const grade = p.grade || "—";
  const branch = p.branch || "—";

  return `
    <div class="compareRow">
      <div class="compareWaku w${Number(p.waku) || 0}">${Number(p.waku) || ""}</div>
      <div class="compareNameBox">
        <div class="compareSub">${esc(regno)} / ${esc(grade)} / ${esc(branch)}</div>
        <div class="compareName">${esc(p.name || "—")}</div>
      </div>
      <div class="compareVal">${esc(safeNum(p.nat_win))}</div>
      <div class="compareVal">${esc(safeInt(p.motor_no))}<br>${esc(safeNum(p.motor_2))}</div>
      <div class="compareVal">${esc(extractAverageSt(p.note))}</div>
    </div>
  `;
}

function extractAverageSt(note) {
  const text = String(note || "").trim();
  if (!text) return "—";
  const m = text.match(/(?:^|\s)(0\.\d{2})(?:\s|$)/);
  return m ? m[1] : "—";
}

function courseRowHTML(waku) {
  return `
    <div class="courseRow">
      <div class="courseWakuCell w${waku}">${waku}</div>
      <div class="courseDataCell">—</div>
      <div class="courseDataCell">—</div>
      <div class="courseDataCell">—</div>
      <div class="courseDataCell">—/—/—</div>
      <div class="courseDataCell">—</div>
      <div class="courseDataCell">—</div>
    </div>
  `;
}

function renderCoursePlaceholders() {
  $courseYearBody.innerHTML = Array.from({ length: 6 }, (_, i) => courseRowHTML(i + 1)).join("");
  $courseLocalBody.innerHTML = Array.from({ length: 6 }, (_, i) => courseRowHTML(i + 1)).join("");
}

function setView(index) {
  currentView = clamp(index, 0, 3);

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
        yearView.style.display = "";
        localView.style.display = "none";
      } else {
        yearView.style.display = "none";
        localView.style.display = "";
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

    if (delta < -width * 0.18 && currentView < 3) {
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

  $compactTable.innerHTML = boats.map(compactRowHTML).join("");
  $compareTable.innerHTML = boats.map(compareRowHTML).join("");
  renderCoursePlaceholders();

  setTopHeight();
}

async function setRace(r) {
  r = clamp(Number(r) || 1, 1, 12);
  currentRace = r;

  makeTabs(r);
  $compactTable.innerHTML = `<div class="err">読み込み中…</div>`;
  $compareTable.innerHTML = `<div class="err">読み込み中…</div>`;

  try {
    const json = await fetchRaceJSON(r);
    renderRaceJSON(r, json);
  } catch (e) {
    $compactTable.innerHTML = `<div class="err">JSON取得失敗</div>`;
    $compareTable.innerHTML = `<div class="err">JSON取得失敗</div>`;
  }
}

async function boot() {
  const initialRace = clamp(Number(qs.get("race") || 1), 1, 12);

  makeTabs(initialRace);
  setupViewTabs();
  setupCourseTabs();
  setupSwipe();
  setView(0);
  await setRace(initialRace);
  requestAnimationFrame(setTopHeight);
}

addEventListener("resize", setTopHeight, { passive: true });
$("btnBack").addEventListener("click", () => history.back());

boot();