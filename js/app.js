/* js/app.js（完全置き換え：24場固定 / 開催のみ色付き / 非開催グレー） */

const DATA_URL = "./data/site/venues.json";

const NOTE_URLS = {
  YOSO_ONLY: "https://note.com/wsnndboat7/n/n1fdca8b0a7e3",
  PRO_ONLY: "https://note.com/wsnndboat7/n/n8d805a4f27bf",
  SET: "https://note.com/wsnndboat7/n/n6fcdb2a9db4f",
};

const VENUES = [
  { jcd: "01", name: "桐生" },
  { jcd: "02", name: "戸田" },
  { jcd: "03", name: "江戸川" },
  { jcd: "04", name: "平和島" },
  { jcd: "05", name: "多摩川" },
  { jcd: "06", name: "浜名湖" },
  { jcd: "07", name: "蒲郡" },
  { jcd: "08", name: "常滑" },
  { jcd: "09", name: "津" },
  { jcd: "10", name: "三国" },
  { jcd: "11", name: "びわこ" },
  { jcd: "12", name: "住之江" },
  { jcd: "13", name: "尼崎" },
  { jcd: "14", name: "鳴門" },
  { jcd: "15", name: "丸亀" },
  { jcd: "16", name: "児島" },
  { jcd: "17", name: "宮島" },
  { jcd: "18", name: "徳山" },
  { jcd: "19", name: "下関" },
  { jcd: "20", name: "若松" },
  { jcd: "21", name: "芦屋" },
  { jcd: "22", name: "福岡" },
  { jcd: "23", name: "唐津" },
  { jcd: "24", name: "大村" }
];

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");
const $picks = document.getElementById("picks");
const $picksUpdatedAt = document.getElementById("picksUpdatedAt");
const $picksCta = document.getElementById("picksCta");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function normalizeGradeLabel(v) {
  const s = String(v || "").trim();
  if (!s) return "-- --";
  if (s === "一般戦") return "一般";
  return s;
}

function normalizeBand(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "morning") return "morning";
  if (s === "day") return "day";
  if (s === "evening") return "evening";
  if (s === "night") return "night";
  return "normal";
}

function buildVenueMap(list) {
  const map = new Map();

  for (const item of Array.isArray(list) ? list : []) {
    const jcd = String(item?.jcd || "").padStart(2, "0");
    if (!jcd) continue;
    map.set(jcd, item);
  }

  return map;
}

function renderOffCard(base) {
  return `
    <div class="card card--off" aria-disabled="true">
      <div class="card__nameRow">
        <span class="card__nameIcon card__nameIcon--empty"></span>
        <div class="card__name">${esc(base.name)}</div>
        <span class="card__nameIcon card__nameIcon--empty"></span>
      </div>

      <div class="card__meta">
        <span class="gradeText">-- --</span>
        <span class="day">-- --</span>
      </div>

      <div class="card__line card__line--btm">-- --</div>
    </div>
  `;
}

function renderOnCard(base, v) {
  return `
    <a class="card card--on card--tone-${esc(normalizeBand(v.card_band))}"
       href="./race.html?jcd=${encodeURIComponent(base.jcd)}&name=${encodeURIComponent(base.name)}">
      <div class="card__nameRow">
        <span class="card__nameIcon card__nameIcon--empty"></span>
        <div class="card__name">${esc(base.name)}</div>
        <span class="card__nameIcon card__nameIcon--empty"></span>
      </div>

      <div class="card__meta">
        <span class="gradeText">${esc(normalizeGradeLabel(v.grade_label))}</span>
        <span class="day">${esc(v.day_label || "-- --")}</span>
      </div>

      <div class="card__line card__line--btm">
        ${esc(v.next_display || "-- --")}
      </div>
    </a>
  `;
}

function renderGrid(list) {
  const map = buildVenueMap(list);

  $grid.innerHTML = VENUES.map((base) => {
    const item = map.get(base.jcd);
    return item ? renderOnCard(base, item) : renderOffCard(base);
  }).join("");
}

function renderPicksCta() {
  if (!$picksCta) return;

  $picksCta.innerHTML = `
    <a class="picksBtn" href="${NOTE_URLS.YOSO_ONLY}" target="_blank" rel="noopener noreferrer">
      <div>
        <div class="picksBtnMain">予想だけ購入（500円）</div>
        <div class="picksBtnSub">noteで確認</div>
      </div>
      <div class="picksBtnArrow">→</div>
    </a>

    <a class="picksBtn" href="${NOTE_URLS.PRO_ONLY}" target="_blank" rel="noopener noreferrer">
      <div>
        <div class="picksBtnMain">PROだけ購入（500円）</div>
        <div class="picksBtnSub">キー配布方式（購読者＝PRO扱い）</div>
      </div>
      <div class="picksBtnArrow">→</div>
    </a>

    <a class="picksBtn picksBtn--set" href="${NOTE_URLS.SET}" target="_blank" rel="noopener noreferrer">
      <div>
        <div class="picksBtnMain">セット購入（800円）</div>
        <div class="picksBtnSub">予想 + PRO（お得）</div>
      </div>
      <div class="picksBtnArrow">→</div>
    </a>
  `;
}

function renderPicksEmpty() {
  if ($picks) $picks.innerHTML = "";
  if ($picksUpdatedAt) $picksUpdatedAt.textContent = nowHM();
}

async function load() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!Array.isArray(json)) throw new Error("venues.json is not array");

    renderGrid(json);
    if ($updatedAt) $updatedAt.textContent = nowHM();
  } catch (e) {
    console.error(e);
    renderGrid([]);
    if ($updatedAt) $updatedAt.textContent = "ERR";
  }
}

if ($btn) {
  $btn.addEventListener("click", load);
}

renderPicksCta();
renderPicksEmpty();
load();