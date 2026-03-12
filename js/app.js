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

function buildVenuesUrl(dateStr) {
  return `https://raceanalysislab.github.io/race-analysis/data/site/venues/${dateStr}.json`;
}

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

const PRO_KEY = "123456";
const PRO_STORAGE_KEY = "boatcore_pro_unlocked";

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");
const $picks = document.getElementById("picks");
const $picksUpdatedAt = document.getElementById("picksUpdatedAt");
const $picksCta = document.getElementById("picksCta");
const $nextRaceBox = document.getElementById("nextRaceBox");
const $nextRaceText = document.getElementById("nextRaceText");

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
let currentDataUrl = buildVenuesUrl(lastSeenLocalDate);

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
  const raw = String(v ?? "").trim();
  if (!raw) return "一般";

  const upper = raw.toUpperCase();
  const compact = upper.replace(/\s+/g, "");

  if (compact === "SG") return "SG";
  if (compact === "G1" || compact === "GI") return "G1";
  if (compact === "G2" || compact === "GII") return "G2";
  if (compact === "G3" || compact === "GIII") return "G3";
  if (raw === "一般") return "一般";

  return "一般";
}

function getGradeClass(v) {
  const label = normalizeGradeLabel(v);

  if (label === "SG") return "gradeText--sg";
  if (label === "G1") return "gradeText--g1";
  if (label === "G2") return "gradeText--g2";
  if (label === "G3") return "gradeText--g3";
  return "gradeText--general";
}

function normalizeBand(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "morning") return "morning";
  if (s === "early") return "early";
  if (s === "day") return "day";
  if (s === "evening") return "evening";
  if (s === "night") return "night";
  return "normal";
}

function normalizeTone(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "morning") return "morning";
  if (s === "early") return "early";
  if (s === "day") return "day";
  if (s === "evening") return "evening";
  if (s === "night") return "night";
  return "";
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

function getFirstRaceCutoff(v) {
  const raceTimes = Array.isArray(v?.race_times) ? v.race_times : [];
  if (!raceTimes.length) return "";

  const sorted = raceTimes
    .map((r) => ({
      rno: Number(r?.rno),
      cutoff: String(r?.cutoff || "").trim()
    }))
    .filter((r) => Number.isFinite(r.rno) && r.cutoff);

  if (!sorted.length) return "";

  sorted.sort((a, b) => a.rno - b.rno);
  return sorted[0].cutoff || "";
}

function deriveBandFromFirstRace(v) {
  const firstCutoff = getFirstRaceCutoff(v);
  const t = parseHHMM(firstCutoff);

  if (!t) return "normal";

  const minutes = t.hh * 60 + t.mm;

  if (minutes >= 8 * 60 && minutes < 10 * 60) return "morning";
  if (minutes >= 10 * 60 && minutes < 12 * 60) return "early";
  if (minutes >= 12 * 60 && minutes < 15 * 60) return "day";
  if (minutes >= 15 * 60 && minutes < 17 * 60) return "evening";
  return "night";
}

function resolveCardBand(v) {
  const explicitBand = normalizeBand(v?.card_band);
  if (explicitBand !== "normal") return explicitBand;

  const explicitTone = normalizeTone(v?.card_tone);
  if (explicitTone) return explicitTone;

  return deriveBandFromFirstRace(v);
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

    return { text: "発売終了", danger: false, soldout: true };
  }

  const nextDisplay = String(v?.next_display || "").trim();
  if (nextDisplay) {
    return {
      text: nextDisplay,
      danger: false,
      soldout: nextDisplay === "発売終了"
    };
  }

  return { text: "発売終了", danger: false, soldout: true };
}

function getSoonestRace(list) {
  const now = Date.now();
  let best = null;

  for (const venue of Array.isArray(list) ? list : []) {
    const raceTimes = Array.isArray(venue?.race_times) ? venue.race_times : [];
    const venueName = String(venue?.name || venue?.venue_name || "").trim();
    const jcd = String(venue?.jcd || "").padStart(2, "0");
    const date = String(venue?.date || lastSeenLocalDate).trim();

    for (const r of raceTimes) {
      const cutoff = String(r?.cutoff || "").trim();
      const raceNo = Number(r?.rno);
      const cutoffAt = getCutoffTime(cutoff);

      if (!cutoff || !Number.isFinite(raceNo) || cutoffAt == null) continue;
      if (now >= cutoffAt + NEXT_RACE_DELAY_MS) continue;

      if (!best || cutoffAt < best.cutoffAt) {
        best = { jcd, venueName, raceNo, cutoff, cutoffAt, date };
      }
    }
  }

  return best;
}

function updateNextRaceBox(list) {
  if (!$nextRaceBox || !$nextRaceText) return;

  const nextRace = getSoonestRace(list);

  if (!nextRace) {
    $nextRaceText.textContent = "発売終了";
    $nextRaceBox.setAttribute("href", "javascript:void(0)");
    $nextRaceBox.setAttribute("aria-disabled", "true");
    return;
  }

  $nextRaceText.textContent = `${nextRace.venueName} ${nextRace.raceNo}R ${nextRace.cutoff}`;
  $nextRaceBox.setAttribute(
    "href",
    `./race.html?date=${encodeURIComponent(nextRace.date)}&name=${encodeURIComponent(nextRace.venueName)}&race=${encodeURIComponent(nextRace.raceNo)}&jcd=${encodeURIComponent(nextRace.jcd)}`
  );
  $nextRaceBox.removeAttribute("aria-disabled");
}

function buildVenueMap(list) {
  const map = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    const jcd = String(item?.jcd ?? "").padStart(2, "0");
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

function buildDataUrl(baseUrl) {
  const sep = baseUrl.includes("?") ? "&" : "?";
  const cacheBust = Math.floor(Date.now() / 60000);
  return `${baseUrl}${sep}t=${cacheBust}`;
}

async function fetchDateJson(dateStr) {
  const url = buildVenuesUrl(dateStr);
  const res = await fetch(buildDataUrl(url), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  const json = await res.json();
  const list = getVenueArray(json);
  if (!Array.isArray(list)) {
    throw new Error(`invalid venues json ${url}`);
  }
  return {
    url,
    json,
    list,
    dataDate: getJsonDataDate(json) || dateStr
  };
}

async function fetchBestVenueData() {
  const today = getLocalYMD();
  const candidates = [
    today,
    addDaysYMD(today, 1),
    addDaysYMD(today, -1)
  ];

  let lastErr = null;

  for (const dateStr of candidates) {
    try {
      return await fetchDateJson(dateStr);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("venues json not found");
}

function scheduleMidnightReload() {
  const now = new Date();
  const next = new Date(now);

  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 10, 0);

  const delay = Math.max(1000, next.getTime() - now.getTime());

  setTimeout(async () => {
    try {
      lastSeenLocalDate = getLocalYMD();
      currentDataUrl = buildVenuesUrl(lastSeenLocalDate);
      await load();
    } finally {
      scheduleMidnightReload();
    }
  }, delay);
}

function clearCardFocus() {
  const active = document.activeElement;

  if (active && active.id === "playerSearchInput") return;
  if (active && active.closest && active.closest("#proModal")) return;

  if (active && typeof active.blur === "function") {
    active.blur();
  }

  document.querySelectorAll(".card--on").forEach((el) => {
    if (typeof el.blur === "function") el.blur();
  });
}

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

  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
  });
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

function renderBottomHtml(next) {
  const m = String(next.text).match(/^(\d+R)\s+(\d{2}:\d{2})$/);

  if (!m) {
    if (next.soldout) {
      return {
        soldoutClass: " card__line--soldout",
        html: `<span class="status--soldout">発売終了</span>`
      };
    }
    return {
      soldoutClass: "",
      html: esc(next.text)
    };
  }

  const raceText = m[1];
  const timeText = m[2];
  const timeClass = next.danger ? " raceTime--danger" : "";

  return {
    soldoutClass: "",
    html: `<span class="raceNo">${esc(raceText)}</span><span class="raceTime${timeClass}">${esc(timeText)}</span>`
  };
}

function renderOnCard(base, v) {
  const next = computeNextDisplay(v);
  const gradeLabel = normalizeGradeLabel(v?.grade_label);
  const gradeClass = getGradeClass(v?.grade_label);
  const isGeneral = gradeLabel === "一般";
  const tone = resolveCardBand(v);
  const bottom = renderBottomHtml(next);
  const date = String(v?.date || lastLoadedDataDate || lastSeenLocalDate).trim();

  return `
    <a class="card card--on ${isGeneral ? "card--general" : ""} ${next.soldout ? "card--soldout" : ""} ${next.danger ? "card--danger" : ""} card--tone-${esc(tone)}"
       href="./race.html?date=${encodeURIComponent(date)}&jcd=${encodeURIComponent(base.jcd)}&name=${encodeURIComponent(base.name)}">
      <div class="card__nameRow">
        <span class="card__nameIcon card__nameIcon--empty"></span>
        <div class="card__name">${esc(base.name)}</div>
        <span class="card__nameIcon card__nameIcon--empty"></span>
      </div>
      <div class="card__meta">
        <span class="gradeText ${gradeClass}">${esc(gradeLabel)}</span>
        <span class="day">${esc(v?.day_label || "-- --")}</span>
      </div>
      <div class="card__line card__line--btm${bottom.soldoutClass}">
        ${bottom.html}
      </div>
    </a>
  `;
}

function renderGrid(list) {
  if (!$grid) return;

  const map = buildVenueMap(list);

  $grid.innerHTML = VENUES.map((base) => {
    const item = map.get(base.jcd);
    return item ? renderOnCard(base, item) : renderOffCard(base);
  }).join("");

  updateNextRaceBox(list);
  clearCardFocus();

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
    const result = await fetchBestVenueData();
    const json = result.json;
    const list = result.list;
    const dataDate = result.dataDate;
    const usedUrl = result.url;

    venueList = list;
    lastLoadedDataDate = dataDate || "";
    currentDataUrl = usedUrl;

    renderGrid(venueList);

  } catch (e) {
    console.error(e);

    if (venueList && venueList.length > 0) {
      renderGrid(venueList);
    }

    if ($updatedAt) {
      $updatedAt.textContent = nowHM();
    }
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
    currentDataUrl = buildVenuesUrl(currentLocalDate);
    await load();
  }
}

if ($btn) {
  $btn.addEventListener("click", load);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    clearCardFocus();
    load();
  }
});

window.addEventListener("pageshow", () => {
  clearCardFocus();
  setTimeout(clearCardFocus, 0);
  setTimeout(clearCardFocus, 120);
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
scheduleMidnightReload();