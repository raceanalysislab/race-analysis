const qs = new URLSearchParams(location.search);

const venueName = decodeURIComponent(qs.get("name") || "会場");
const jcd = String(qs.get("jcd") || "").padStart(2, "0");
const dateParam = String(qs.get("date") || "").trim();

const $ = (id) => document.getElementById(id);

const $tabs = $("tabs");
const $raceNoLabel = $("raceNoLabel");
const $timeLabel = $("timeLabel");
const $dayLabel = $("dayLabel");
const $gradeLabel = $("gradeLabel");
const $eventTitle = $("eventTitle");
const $raceTop = $("raceTop");
const $viewTrack = $("viewTrack");
const $entryTable = $("entryTable");
const $viewTabs = $("viewTabs");

const RACES_BASE_URL =
  "https://raceanalysislab.github.io/race-analysis/data/site/races/";

$("venueName").textContent = venueName;

let currentRace = 1;
let currentDate = dateParam || getLocalYMD();
let currentView = 0;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function getLocalYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYMD(ymd, days) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");

  return `${yy}-${mm}-${dd}`;
}

function toHM(x) {
  const m = String(x || "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "--:--";
}

async function fetchJSON(url) {
  const joiner = url.includes("?") ? "&" : "?";
  const cacheBust = Math.floor(Date.now() / 60000);

  const res = await fetch(`${url}${joiner}t=${cacheBust}`, {
    cache: "no-store"
  });

  if (!res.ok) throw new Error(url);

  return res.json();
}

function buildUrls(r, dateStr) {

  const fileName = `${jcd}_${r}R.json`;

  return [
    `${RACES_BASE_URL}${dateStr}/${fileName}`,
    `${RACES_BASE_URL}${addDaysYMD(dateStr, 1)}/${fileName}`,
    `${RACES_BASE_URL}${addDaysYMD(dateStr, -1)}/${fileName}`
  ];
}

async function fetchRaceJSON(r) {

  let lastErr = null;

  for (const url of buildUrls(r, currentDate)) {

    try {

      const json = await fetchJSON(url);

      if (json?.date) {
        currentDate = String(json.date).trim();
      }

      return json;

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

    const active = race === currentRace ? " is-active" : "";

    return `<button class="raceTab${active}" data-race="${race}">${race}R</button>`;

  }).join("");

  $tabs.querySelectorAll(".raceTab").forEach(btn => {

    btn.onclick = () => {

      const r = Number(btn.dataset.race);

      setRace(r);

    };

  });

}

function updateUrlRace(r) {

  const next = new URL(location.href);

  next.searchParams.set("race", String(r));

  history.replaceState(null, "", next.toString());

}

function renderEntryTable(boats) {

  $entryTable.innerHTML = boats.map(p => `

<div class="entryRow">

<div class="entryWaku w${p.waku}">${p.waku}</div>

<div class="entryNameCell">

<div class="entryMeta">

${p.regno} / ${p.grade} / ${p.branch} / ${p.age}歳

</div>

<div class="entryName">${p.name}</div>

</div>

<div class="entryVal">${p.avg_st ?? "—"}</div>

<div class="entryVal">${p.nat_win ?? "—"}</div>

<div class="entryVal">${p.loc_win ?? "—"}</div>

<div class="entryVal">${p.motor_2 ?? "—"}</div>

</div>

`).join("");

}

function renderRaceJSON(r, json) {

  const raceObj = json?.race || {};

  $raceNoLabel.textContent = `${r}R`;

  $timeLabel.textContent = `締切: ${toHM(raceObj.cutoff)}`;

  $dayLabel.textContent = json?.day_label || "—";

  if ($gradeLabel) {
    $gradeLabel.textContent = json?.grade_label || "一般";
  }

  if ($eventTitle) {
    $eventTitle.textContent = json?.event_title || "—";
  }

  const boats = raceObj?.boats || [];

  renderEntryTable(boats);

  if (window.BOAT_CORE_COURSE?.render) {
    window.BOAT_CORE_COURSE.render(json);
  }

  renderRaceTabs();

  updateUrlRace(r);

}

function renderRaceError(r) {

  $raceNoLabel.textContent = `${r}R`;

  $timeLabel.textContent = "締切: --:--";

  $entryTable.innerHTML = `<div class="err">JSON取得失敗</div>`;

}

async function setRace(r) {

  r = clamp(Number(r), 1, 12);

  currentRace = r;

  renderRaceTabs();

  $entryTable.innerHTML = `<div class="err">読み込み中…</div>`;

  try {

    const json = await fetchRaceJSON(r);

    renderRaceJSON(r, json);

  } catch (e) {

    renderRaceError(r);

  }

}

function bindViewTabs() {

  if (!$viewTabs) return;

  $viewTabs.querySelectorAll(".viewTab").forEach(btn => {

    btn.onclick = () => {

      currentView = Number(btn.dataset.view);

      const x = currentView * -100;

      $viewTrack.style.transform = `translate3d(${x}%,0,0)`;

    };

  });

}

async function boot() {

  const initialRace = clamp(Number(qs.get("race") || 1), 1, 12);

  bindViewTabs();

  renderRaceTabs();

  await setRace(initialRace);

}

boot();