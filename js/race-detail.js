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
let courseStatsIndex = {};

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
  history.replaceState(null, "", next.toString());
}

function renderRaceJSON(r, json) {
  const raceObj = json?.race || {};

  $raceNoLabel.textContent = `${r}R`;
  $timeLabel.textContent = `締切: ${toHM(raceObj.cutoff)}`;
  $dayLabel.textContent = json?.day_label || raceObj?.day_label || "—";

  const boats = Array.isArray(raceObj.boats) ? raceObj.boats : [];

  $entryTable.innerHTML = boats.map((p) => `
    <div class="entryRow">
      <div class="entryWaku w${p.waku}">${p.waku}</div>
      <div class="entryNameCell">
        <div class="entryMeta">${esc(p.regno)} / ${esc(p.grade)} / ${esc(p.branch)} / ${esc(p.age)}歳</div>
        <div class="entryName">${esc(p.name)}</div>
      </div>
      <div class="entryVal">${safeNum(p.avg_st)}</div>
      <div class="entryVal">${safeNum(p.nat_win)}</div>
      <div class="entryVal">
        <div class="entryMotor">
          <div class="entryMotorNo">${safeInt(p.motor_no)}</div>
          <div class="entryMotorRate">${safeNum(p.motor_2)}</div>
        </div>
      </div>
    </div>
  `).join("");

  renderRaceTabs();
  updateUrlRace(r);
  setTopHeight();
}

async function setRace(r) {
  r = clamp(Number(r) || 1, 1, 12);
  currentRace = r;

  renderRaceTabs();
  $entryTable.innerHTML = `<div class="err">読み込み中…</div>`;

  try {
    const json = await fetchRaceJSON(r);
    renderRaceJSON(r, json);
  } catch (e) {
    $raceNoLabel.textContent = `${r}R`;
    $timeLabel.textContent = `締切: --:--`;
    $dayLabel.textContent = "—";
    $entryTable.innerHTML = `<div class="err">JSON取得失敗</div>`;
    renderRaceTabs();
    updateUrlRace(r);
    setTopHeight();
  }
}

function handleSwipeStart(clientX) {
  dragStartX = clientX;
  dragCurrentX = clientX;
  dragging = true;
}

function handleSwipeMove(clientX) {
  if (!dragging) return;
  dragCurrentX = clientX;
}

function handleSwipeEnd() {
  if (!dragging) return;

  const diff = dragCurrentX - dragStartX;
  dragging = false;

  if (Math.abs(diff) < 50) return;

  if (diff < 0) {
    setRace(currentRace + 1);
  } else {
    setRace(currentRace - 1);
  }
}

function bindSwipe() {
  const target = $viewTrack || document;

  target.addEventListener("touchstart", (e) => {
    if (!e.touches || !e.touches.length) return;
    handleSwipeStart(e.touches[0].clientX);
  }, { passive: true });

  target.addEventListener("touchmove", (e) => {
    if (!e.touches || !e.touches.length) return;
    handleSwipeMove(e.touches[0].clientX);
  }, { passive: true });

  target.addEventListener("touchend", () => {
    handleSwipeEnd();
  }, { passive: true });

  target.addEventListener("mousedown", (e) => {
    handleSwipeStart(e.clientX);
  });

  window.addEventListener("mousemove", (e) => {
    handleSwipeMove(e.clientX);
  });

  window.addEventListener("mouseup", () => {
    handleSwipeEnd();
  });
}

async function boot() {
  const initialRace = clamp(Number(qs.get("race") || 1), 1, 12);
  renderRaceTabs();
  bindSwipe();
  await setRace(initialRace);
  requestAnimationFrame(setTopHeight);
}

addEventListener("resize", setTopHeight, { passive: true });
$("btnBack").addEventListener("click", () => history.back());

boot();