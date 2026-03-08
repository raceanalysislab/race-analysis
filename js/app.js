/* js/app.js（診断版） */

const SITE_VENUES_URL = "./data/site/venues.json";

const VENUES = [
  { jcd: "01", name: "桐生" }, { jcd: "02", name: "戸田" }, { jcd: "03", name: "江戸川" }, { jcd: "04", name: "平和島" },
  { jcd: "05", name: "多摩川" }, { jcd: "06", name: "浜名湖" }, { jcd: "07", name: "蒲郡" }, { jcd: "08", name: "常滑" },
  { jcd: "09", name: "津" }, { jcd: "10", name: "三国" }, { jcd: "11", name: "びわこ" }, { jcd: "12", name: "住之江" },
  { jcd: "13", name: "尼崎" }, { jcd: "14", name: "鳴門" }, { jcd: "15", name: "丸亀" }, { jcd: "16", name: "児島" },
  { jcd: "17", name: "宮島" }, { jcd: "18", name: "徳山" }, { jcd: "19", name: "下関" }, { jcd: "20", name: "若松" },
  { jcd: "21", name: "芦屋" }, { jcd: "22", name: "福岡" }, { jcd: "23", name: "唐津" }, { jcd: "24", name: "大村" }
];

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function renderOff(base) {
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

function renderOn(v) {
  return `
    <a class="card card--on card--tone-${esc(v.card_band || "normal")}"
       href="./race.html?jcd=${encodeURIComponent(v.jcd)}&name=${encodeURIComponent(v.name)}">
      <div class="card__nameRow">
        <span class="card__nameIcon card__nameIcon--empty"></span>
        <div class="card__name">${esc(v.name)}</div>
        <span class="card__nameIcon card__nameIcon--empty"></span>
      </div>
      <div class="card__meta">
        <span class="gradeText">${esc(v.grade_label || "")}</span>
        <span class="day">${esc(v.day_label || "")}</span>
      </div>
      <div class="card__line card__line--btm">${esc(v.next_display || "-- --")}</div>
    </a>
  `;
}

async function load() {
  try {
    $updatedAt.textContent = "LOAD";

    const res = await fetch(`${SITE_VENUES_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!Array.isArray(json)) throw new Error("NOT_ARRAY");

    const map = new Map();
    for (const item of json) {
      const jcd = String(item?.jcd || "").padStart(2, "0");
      if (!jcd) continue;
      map.set(jcd, item);
    }

    $grid.innerHTML = VENUES.map((base) => {
      const v = map.get(base.jcd);
      return v ? renderOn(v) : renderOff(base);
    }).join("");

    $updatedAt.textContent = `${nowHM()} / ${json.length}件`;
  } catch (e) {
    $updatedAt.textContent = `ERR`;
    $grid.innerHTML = `
      <div style="grid-column:1/-1;padding:16px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;font-size:14px;line-height:1.6;">
        読み込み失敗<br>${esc(e.message || e)}
      </div>
    `;
  }
}

if ($btn) {
  $btn.addEventListener("click", load);
}

load();