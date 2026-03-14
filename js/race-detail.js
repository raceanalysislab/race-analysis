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

const PLAYER_NAME_MASTER_URL =
  "https://raceanalysislab.github.io/race-analysis/data/master/players_name_master.json";

$("venueName").textContent = venueName;

let currentRace = 1;
let currentDate = dateParam || getLocalYMD();
let currentView = 0;

let dragStartX = 0;
let dragCurrentX = 0;
let dragging = false;

let playerNameMaster = {};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
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

const formatST = (v) => {
  if (v === undefined || v === null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `.${n.toFixed(2).split(".")[1]}`;
};

const pickAvgST = (p) => {
  const candidates = [
    p?.avg_st,
    p?.st_avg,
    p?.ave_st,
    p?.average_st,
    p?.start_average
  ];

  for (const v of candidates) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};

const pickValue = (obj, keys) => {
  for (const key of keys) {
    const v = obj?.[key];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};

const pickNat3 = (p) => pickValue(p, ["nat_3", "nat3", "nat_three"]);
const pickLoc3 = (p) => pickValue(p, ["loc_3", "loc3", "loc_three"]);
const pickMotor3 = (p) => pickValue(p, ["motor_3", "motor3", "motor_three"]);

const pickF = (p) => {
  const v = pickValue(p, ["f", "F", "f_count", "fCount", "f_num", "fNum"]);
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};

const pickL = (p) => {
  const v = pickValue(p, ["l", "L", "l_count", "lCount", "l_num", "lNum"]);
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};

const renderFLValue = (label, count) => {
  if (!count) return "";
  return `${label}${count}`;
};

const buildEntryMeta = (p) => {
  const regno = safeInt(p?.regno);
  const grade = String(p?.grade ?? "").trim() || "—";
  const branch = String(p?.branch ?? "").trim() || "—";

  let age = "—";
  if (p?.age !== undefined && p?.age !== null && p?.age !== "") {
    const n = Number(p.age);
    age = Number.isFinite(n) ? `${Math.trunc(n)}歳` : `${String(p.age).trim()}歳`;
  }

  return `${regno} / ${grade} / ${branch} / ${age}`;
};

const getPlayerDisplayName = (p) => {
  const reg = String(p?.regno ?? p?.reg ?? "").trim();
  const master = playerNameMaster?.[reg];

  if (master) {
    const sei = String(master?.sei ?? "").trim();
    const mei = String(master?.mei ?? "").trim();
    const masterName = String(master?.name ?? "").trim();

    if (sei && mei) return `${sei} ${mei}`;
    if (masterName) return masterName;
  }

  return String(p?.name ?? "").trim();
};

const toHM = (x) => {
  const m = String(x || "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "--:--";
};

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

function normalizeGradeLabel(v) {
  const raw = String(v ?? "").trim();
  const s = raw.toUpperCase();

  if (s.includes("SG")) return "SG";
  if (s.includes("G1") || s.includes("GI")) return "G1";
  if (s.includes("G2") || s.includes("GII")) return "G2";
  if (s.includes("G3") || s.includes("GIII")) return "G3";
  if (raw.includes("一般")) return "一般";

  return raw || "一般";
}

function setTopHeight() {
  const h = $raceTop?.getBoundingClientRect().height || 96;
  document.documentElement.style.setProperty("--raceTopH", `${Math.ceil(h)}px`);
}

async function fetchJSON(url) {
  const joiner = url.includes("?") ? "&" : "?";
  const cacheBust = Math.floor(Date.now() / 60000);
  const res = await fetch(`${url}${joiner}t=${cacheBust}`, { cache: "no-store" });
  if (!res.ok) throw new Error(url);
  return res.json();
}

async function loadPlayerNameMaster() {
  try {
    playerNameMaster = await fetchJSON(PLAYER_NAME_MASTER_URL);
  } catch (e) {
    playerNameMaster = {};
  }
}

function buildUrls(r, dateStr) {
  const fileName = `${jcd}_${r}R.json`;
  const candidates = [
    `${RACES_BASE_URL}${dateStr}/${fileName}`,
    `${RACES_BASE_URL}${addDaysYMD(dateStr, 1)}/${fileName}`,
    `${RACES_BASE_URL}${addDaysYMD(dateStr, -1)}/${fileName}`
  ];
  return candidates;
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
  if (currentDate) next.searchParams.set("date", currentDate);
  history.replaceState(null, "", next.toString());
}

function renderEntryTable(boats) {
  $entryTable.innerHTML = boats.map((p) => {
    const fCount = pickF(p);
    const lCount = pickL(p);
    const displayName = getPlayerDisplayName(p);
    const metaText = buildEntryMeta(p);

    return `
      <div class="entryRow">
        <div class="entryWaku w${esc(p.waku)}">${esc(p.waku)}</div>

        <div class="entryNameCell">
          <div class="entryMeta">${esc(metaText)}</div>
          <div class="entryName">${esc(displayName)}</div>
        </div>

        <div class="entryVal">${formatST(pickAvgST(p))}</div>

        <div class="entryVal entryVal--stack entryVal--fl">
          <div class="entryStatBlock entryStatBlock--fl">
            <div class="entryStatMain entryStatMain--f">${esc(renderFLValue("F", fCount))}</div>
            <div class="entryStatSub entryStatSub--l">${esc(renderFLValue("L", lCount))}</div>
          </div>
        </div>

        <div class="entryVal entryVal--stack">
          <div class="entryStatBlock">
            <div class="entryStatMain">${safeNum(p.nat_win)}</div>
            <div class="entryStatSub">${safeNum(p.nat_2)}</div>
            <div class="entryStatSub">${safeNum(pickNat3(p))}</div>
          </div>
        </div>

        <div class="entryVal entryVal--stack">
          <div class="entryStatBlock">
            <div class="entryStatMain">${safeNum(p.loc_win)}</div>
            <div class="entryStatSub">${safeNum(p.loc_2)}</div>
            <div class="entryStatSub">${safeNum(pickLoc3(p))}</div>
          </div>
        </div>

        <div class="entryVal entryVal--stack">
          <div class="entryMotorBlock">
            <div class="entryMotorNo">${safeInt(p.motor_no)}</div>
            <div class="entryMotorRate">${safeNum(p.motor_2)}</div>
            <div class="entryMotorRate">${safeNum(pickMotor3(p))}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function boot() {
  const initialRace = clamp(Number(qs.get("race") || 1), 1, 12);

  renderRaceTabs();
  bindRaceSwipe();
  bindViewTabs();
  setView(0);

  if (window.BOAT_CORE_COURSE?.boot) {
    window.BOAT_CORE_COURSE.boot();
  }

  await loadPlayerNameMaster();
  await setRace(initialRace);
  requestAnimationFrame(setTopHeight);
}

addEventListener("resize", setTopHeight, { passive: true });
$("btnBack").addEventListener("click", () => history.back());

boot();