/* js/app.js（完全置き換え：24場固定 / リアルタイム切替 / PRO切替強化版 / 日付跨ぎ自動切替対応 / raw.githubusercontent.com版） */

const DATA_URL = "https://raw.githubusercontent.com/raceanalysislab/race-data-bot/main/data/site/venues.json";

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

const NEXT_RACE_DELAY_MS = 3000;
const DANGER_MS = 5 * 60 * 1000;
const RERENDER_INTERVAL_MS = 1000;
const REFRESH_INTERVAL_MS = 30 * 1000;
const DATE_CHECK_INTERVAL_MS = 15 * 1000;

/* PROキー */
const PRO_KEY = "123456";
const PRO_STORAGE_KEY = "boatcore_pro_unlocked";

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");
const $picks = document.getElementById("picks");
const $picksUpdatedAt = document.getElementById("picksUpdatedAt");
const $picksCta = document.getElementById("picksCta");

/* PRO UI */
const $btnPro = document.getElementById("btnPro");
const $proModal = document.getElementById("proModal");
const $proInputsWrap = document.getElementById("proInputs");
const $proUnlock = document.getElementById("proUnlock");
const $proCancel = document.getElementById("proCancel");
const $proClear = document.getElementById("proClear");
const proInputs = $proInputsWrap ? Array.from($proInputsWrap.querySelectorAll("input")) : [];

let venueList = [];
let isLoading = false;
let lastLoadedDataDate = "";
let lastSeenLocalDate = getLocalYMD();

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

function getLocalYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function parseHHMM(s) {
  const m = String(s ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  return { hh, mm };
}

function getCutoffTime(hhmm) {
  const t = parseHHMM(hhmm);
  if (!t) return null;

  const d = new Date();
  d.setHours(t.hh, t.mm, 0, 0);
  return d.getTime();
}

function computeNextDisplay(v) {
  const raceTimes = Array.isArray(v?.race_times) ? v.race_times : [];
  const now = Date.now();

  if (raceTimes.length > 0) {
    for (const r of raceTimes) {
      const cutoffAt = getCutoffTime(r?.cutoff);
      if (cutoffAt == null) continue;

      const switchAt = cutoffAt + NEXT_RACE_DELAY_MS;
      const remainMs = cutoffAt - now;

      if (now < switchAt) {
        return {
          text: `${r.rno}R ${r.cutoff}`,
          danger: remainMs <= DANGER_MS && remainMs >= 0,
          soldout: false
        };
      }
    }

    return {
      text: "発売終了",
      danger: false,
      soldout: true
    };
  }

  const nextDisplay = String(v?.next_display || "").trim();
  if (nextDisplay) {
    return {
      text: nextDisplay,
      danger: false,
      soldout: nextDisplay === "発売終了"
    };
  }

  return {
    text: "発売終了",
    danger: false,
    soldout: true
  };
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

function getJsonDataDate(json) {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    if (typeof json.date === "string" && json.date.trim()) return json.date.trim();
    if (Array.isArray(json.venues) && json.venues[0]?.date) return String(json.venues[0].date).trim();
  }

  if (Array.isArray(json) && json[0]?.date) {
    return String(json[0].date).trim();
  }

  return "";
}

function getVenueArray(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.venues)) return json.venues;
  return [];
}

function buildDataUrl() {
  const sep = DATA_URL.includes("?") ? "&" : "?";
  return `${DATA_URL}${sep}t=${Date.now()}`;
}

/* ===== PRO functions ===== */

function isProUnlocked() {
  return localStorage.getItem(PRO_STORAGE_KEY) === "1";
}

function setModalVisible(visible) {
  if (!$proModal) return;
  $proModal.setAttribute("aria-hidden", visible ? "false" : "true");
  $proModal.style.display = visible ? "flex" : "none";
  $proModal.style.pointerEvents = visible ? "auto" : "none";
}

function applyProTheme() {
  const unlocked = isProUnlocked();

  if (unlocked) {
    document.documentElement.setAttribute("data-theme", "pro");
    if ($btnPro) {
      $btnPro.setAttribute("aria-pressed", "true");
      $btnPro.classList.add("is-active");
    }
  } else {
    document.documentElement.removeAttribute("data-theme");
    if ($btnPro) {
      $btnPro.setAttribute("aria-pressed", "false");
      $btnPro.classList.remove("is-active");
    }
  }
}

function openProModal() {
  if (!$proModal) return;
  setModalVisible(true);
  requestAnimationFrame(() => {
    if (proInputs[0]) proInputs[0].focus();
  });
}

function closeProModal() {
  if (!$proModal) return;
  setModalVisible(false);
}

function clearProInputs() {
  proInputs.forEach((input) => {
    input.value = "";
  });
  if (proInputs[0]) proInputs[0].focus();
}

function getProInputValue() {
  return proInputs.map((input) => input.value.trim()).join("");
}

function unlockPro() {
  const code = getProInputValue();

  if (code !== PRO_KEY) {
    alert("PROキーが違います");
    clearProInputs();
    return;
  }

  localStorage.setItem(PRO_STORAGE_KEY, "1");
  applyProTheme();
  closeProModal();
}

function setupProInputs() {
  if (!proInputs.length) return;

  proInputs.forEach((input, idx) => {
    input.oninput = (e) => {
      const v = String(e.target.value || "").replace(/\D/g, "");
      e.target.value = v.slice(0, 1);

      if (e.target.value && idx < proInputs.length - 1) {
        proInputs[idx + 1].focus();
      }
    };

    input.onkeydown = (e) => {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        proInputs[idx - 1].focus();
      }

      if (e.key === "Enter") {
        unlockPro();
      }

      if (e.key === "Escape") {
        closeProModal();
      }
    };

    input.onpaste = (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);

      if (!pasted) return;

      proInputs.forEach((el, i) => {
        el.value = pasted[i] || "";
      });

      const lastFilled = Math.min(pasted.length, proInputs.length) - 1;
      if (lastFilled >= 0) {
        proInputs[lastFilled].focus();
      }
    };
  });
}

function setupProButton() {
  if ($btnPro) {
    $btnPro.onclick = () => {
      if (isProUnlocked()) {
        localStorage.removeItem(PRO_STORAGE_KEY);
        applyProTheme();
      } else {
        openProModal();
      }
    };
  }

  if ($proUnlock) $proUnlock.onclick = unlockPro;
  if ($proCancel) $proCancel.onclick = closeProModal;
  if ($proClear) $proClear.onclick = clearProInputs;

  if ($proModal) {
    $proModal.onclick = (e) => {
      if (e.target === $proModal) closeProModal();
    };
  }

  document.onkeydown = (e) => {
    if (e.key === "Escape" && $proModal && $proModal.getAttribute("aria-hidden") === "false") {
      closeProModal();
    }
  };
}

function initProModal() {
  setModalVisible(false);
}

/* ===== card render ===== */

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
  const next = computeNextDisplay(v);
  const m = String(next.text).match(/^(\d+R)\s+(\d{2}:\d{2})$/);

  let bottomHTML = "";
  let soldoutClass = "";

  if (m) {
    const raceText = m[1];
    const timeText = m[2];
    const timeClass = next.danger ? " raceTime--danger" : "";

    bottomHTML = `
      <span class="raceNo">${esc(raceText)}</span>
      <span class="raceTime${timeClass}">${esc(timeText)}</span>
    `;
  } else if (next.soldout) {
    soldoutClass = " card__line--soldout";
    bottomHTML = `<span class="status--soldout">発売終了</span>`;
  } else {
    bottomHTML = esc(next.text);
  }

  return `
    <a class="card card--on ${next.soldout ? "card--soldout" : ""} card--tone-${esc(normalizeBand(v.card_band))}"
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

      <div class="card__line card__line--btm${soldoutClass}">
        ${bottomHTML}
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

  if ($updatedAt) $updatedAt.textContent = nowHM();
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
  if (isLoading) return;
  isLoading = true;

  try {
    const res = await fetch(buildDataUrl(), {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const list = getVenueArray(json);
    const dataDate = getJsonDataDate(json);

    if (!Array.isArray(list)) throw new Error("venues.json format invalid");

    venueList = list;
    lastLoadedDataDate = dataDate || "";
    renderGrid(venueList);
  } catch (e) {
    console.error(e);
    renderGrid([]);
    if ($updatedAt) $updatedAt.textContent = "ERR";
  } finally {
    isLoading = false;
  }
}

async function reloadIfDateChanged() {
  const currentLocalDate = getLocalYMD();
  const localDateChanged = currentLocalDate !== lastSeenLocalDate;
  const dataDateMismatch = lastLoadedDataDate && lastLoadedDataDate !== currentLocalDate;

  if (localDateChanged || dataDateMismatch) {
    lastSeenLocalDate = currentLocalDate;
    await load();
  }
}

if ($btn) {
  $btn.addEventListener("click", load);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    renderGrid(venueList);
    load();
  }
});

setInterval(() => {
  if (document.visibilityState === "visible") {
    renderGrid(venueList);
  }
}, RERENDER_INTERVAL_MS);

setInterval(() => {
  if (document.visibilityState === "visible") {
    load();
  }
}, REFRESH_INTERVAL_MS);

setInterval(() => {
  if (document.visibilityState === "visible") {
    reloadIfDateChanged();
  }
}, DATE_CHECK_INTERVAL_MS);

initProModal();
setupProInputs();
setupProButton();
applyProTheme();
renderPicksCta();
renderPicksEmpty();
load();