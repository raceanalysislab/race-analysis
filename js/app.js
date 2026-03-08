/* js/app.js（完全置き換え：site venues.json専用 / 一覧安定版） */

const SITE_VENUES_URL = "./data/site/venues.json";

const NOTE_URLS = {
  YOSO_ONLY: "https://note.com/wsnndboat7/n/n1fdca8b0a7e3",
  PRO_ONLY: "https://note.com/wsnndboat7/n/n8d805a4f27bf",
  SET: "https://note.com/wsnndboat7/n/n6fcdb2a9db4f",
};

const VENUES = [
  { jcd: "01", name: "桐生" }, { jcd: "02", name: "戸田" }, { jcd: "03", name: "江戸川" }, { jcd: "04", name: "平和島" },
  { jcd: "05", name: "多摩川" }, { jcd: "06", name: "浜名湖" }, { jcd: "07", name: "蒲郡" }, { jcd: "08", name: "常滑" },
  { jcd: "09", name: "津" }, { jcd: "10", name: "三国" }, { jcd: "11", name: "びわこ" }, { jcd: "12", name: "住之江" },
  { jcd: "13", name: "尼崎" }, { jcd: "14", name: "鳴門" }, { jcd: "15", name: "丸亀" }, { jcd: "16", name: "児島" },
  { jcd: "17", name: "宮島" }, { jcd: "18", name: "徳山" }, { jcd: "19", name: "下関" }, { jcd: "20", name: "若松" },
  { jcd: "21", name: "芦屋" }, { jcd: "22", name: "福岡" }, { jcd: "23", name: "唐津" }, { jcd: "24", name: "大村" }
];

const NEXT_RACE_DELAY_MS = 3000;
const DANGER_MS = 5 * 60 * 1000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const RERENDER_INTERVAL_MS = 1000;

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");
const $picks = document.getElementById("picks");
const $picksUpdatedAt = document.getElementById("picksUpdatedAt");
const $picksCta = document.getElementById("picksCta");

let venueList = [];
let isLoading = false;

const pad2 = (n) => String(n).padStart(2, "0");

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function nowHM() {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function parseHHMM(s) {
  const m = String(s ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;

  return { h, m: mm };
}

function getCutoffTime(hhmm) {
  const t = parseHHMM(hhmm);
  if (!t) return null;

  const d = new Date();
  d.setHours(t.h, t.m, 0, 0);
  return d.getTime();
}

function normalizeVenueName(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeGradeLabel(label) {
  const s = String(label || "").trim();
  if (!s) return "一般";
  if (s === "一般戦") return "一般";
  return s;
}

function normalizeBand(item) {
  const s = String(item?.card_band || "").trim().toLowerCase();
  if (s === "morning") return "morning";
  if (s === "day") return "day";
  if (s === "evening") return "evening";
  if (s === "night") return "night";
  return "normal";
}

function buildNoCacheUrl(url) {
  return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

function venueHref(v) {
  return `./race.html?jcd=${encodeURIComponent(v.jcd)}&name=${encodeURIComponent(v.name)}`;
}

function computeNext(raceTimes) {
  const now = Date.now();

  for (const r of Array.isArray(raceTimes) ? raceTimes : []) {
    const cutoff = getCutoffTime(r?.cutoff);
    if (!cutoff) continue;

    const switchAt = cutoff + NEXT_RACE_DELAY_MS;
    const remain = cutoff - now;

    if (now < switchAt) {
      return {
        text: `${r.rno}R ${r.cutoff}`,
        danger: remain <= DANGER_MS && remain >= 0
      };
    }
  }

  return {
    text: "発売終了",
    danger: false
  };
}

async function fetchVenues() {
  const res = await fetch(buildNoCacheUrl(SITE_VENUES_URL), {
    cache: "no-store"
  });

  if (!res.ok) throw new Error(`fetch error: ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("venues.json is not array");

  return json;
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

function render() {
  if ($updatedAt) $updatedAt.textContent = nowHM();

  const liveMap = new Map();
  for (const item of venueList) {
    const jcd = String(item?.jcd || "").padStart(2, "0");
    const name = String(item?.name || "").trim();

    let key = "";
    if (jcd) {
      key = jcd;
    } else if (name) {
      const found = VENUES.find((v) => normalizeVenueName(v.name) === normalizeVenueName(name));
      if (found) key = found.jcd;
    }

    if (!key) continue;
    liveMap.set(key, item);
  }

  $grid.innerHTML = VENUES.map((base) => {
    const v = liveMap.get(base.jcd);

    if (!v) {
      return `
        <div class="card card--off" aria-disabled="true">
          <div class="card__nameRow">
            <span class="card__nameIcon card__nameIcon--empty"></span>
            <div class="card__name">${escapeHTML(base.name)}</div>
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

    const next = computeNext(v.race_times || []);
    const m = next.text.match(/^(\d+R)\s(\d\d:\d\d)$/);

    let race = "";
    let time = "";

    if (m) {
      race = m[1];
      time = m[2];
    } else {
      race = next.text;
    }

    const dangerClass = next.danger ? " raceTime--danger" : "";

    return `
      <a class="card card--on card--tone-${escapeHTML(normalizeBand(v))}"
         href="${venueHref({ jcd: base.jcd, name: base.name })}">
        <div class="card__nameRow">
          <span class="card__nameIcon card__nameIcon--empty"></span>
          <div class="card__name">${escapeHTML(base.name)}</div>
          <span class="card__nameIcon card__nameIcon--empty"></span>
        </div>

        <div class="card__meta">
          <span class="gradeText">${escapeHTML(normalizeGradeLabel(v.grade_label))}</span>
          <span class="day">${escapeHTML(v.day_label || "")}</span>
        </div>

        <div class="card__line card__line--btm">
          <span class="raceNo">${escapeHTML(race)}</span>
          ${time ? `<span class="raceTime${dangerClass}">${escapeHTML(time)}</span>` : ""}
        </div>
      </a>
    `;
  }).join("");
}

async function load() {
  if (isLoading) return;
  isLoading = true;

  try {
    venueList = await fetchVenues();
    render();
    renderPicksEmpty();
    renderPicksCta();
  } catch (e) {
    console.error(e);
    if ($updatedAt) $updatedAt.textContent = "ERR";
  } finally {
    isLoading = false;
  }
}

if ($btn) {
  $btn.addEventListener("click", load);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    render();
    load();
  }
});

setInterval(() => {
  if (document.visibilityState === "visible") {
    render();
  }
}, RERENDER_INTERVAL_MS);

setInterval(() => {
  if (document.visibilityState === "visible") {
    load();
  }
}, REFRESH_INTERVAL_MS);

renderPicksCta();
renderPicksEmpty();
load();