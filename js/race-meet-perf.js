window.BOAT_CORE_MEET_PERF = (() => {
  const DAY_COUNT = 7;
  const SLOTS_PER_DAY = 2;

  const $ = (id) => document.getElementById(id);

  const $entryInnerTabs = $("entryInnerTabs");
  const $entrySwipeTrack = $("entrySwipeTrack");
  const $meetPerfDays = $("meetPerfDays");
  const $meetPerfTable = $("meetPerfTable");

  let currentEntryView = 0;
  let meetPerfBaseUrl = "";
  let currentJcd = "";
  let currentDate = "";
  let playerNameResolver = null;
  const cache = {};

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  const normalizeName = (name) =>
    String(name ?? "").replace(/[\s\u3000]+/g, "").trim();

  function setConfig(config = {}) {
    meetPerfBaseUrl = String(config.baseUrl || "");
    currentJcd = String(config.jcd || "").padStart(2, "0");
    playerNameResolver = typeof config.getPlayerDisplayName === "function"
      ? config.getPlayerDisplayName
      : null;
  }

  function setRaceContext({ date }) {
    currentDate = String(date || "").trim();
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

  async function fetchJSON(url) {
    const joiner = url.includes("?") ? "&" : "?";
    const cacheBust = Math.floor(Date.now() / 60000);
    const res = await fetch(`${url}${joiner}t=${cacheBust}`, { cache: "no-store" });
    if (!res.ok) throw new Error(url);
    return res.json();
  }

  function buildMeetPerfUrls(dateStr) {
    return [
      `${meetPerfBaseUrl}${dateStr}_${currentJcd}.json`,
      `${meetPerfBaseUrl}${addDaysYMD(dateStr, 1)}_${currentJcd}.json`,
      `${meetPerfBaseUrl}${addDaysYMD(dateStr, -1)}_${currentJcd}.json`
    ];
  }

  async function loadMeetPerfForDate(dateStr) {
    const key = `${dateStr}|${currentJcd}`;
    if (cache[key]) return cache[key];

    let lastErr = null;

    for (const url of buildMeetPerfUrls(dateStr)) {
      try {
        const json = await fetchJSON(url);
        const actualDate = String(json?.date || dateStr).trim();
        cache[key] = json;
        cache[`${actualDate}|${currentJcd}`] = json;
        return json;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("meet perf not found");
  }

  function setEntryView(viewIndex) {
    currentEntryView = clamp(Number(viewIndex) || 0, 0, 1);

    const x = currentEntryView * -100;
    if ($entrySwipeTrack) {
      $entrySwipeTrack.style.transform = `translate3d(${x}%, 0, 0)`;
    }

    $entryInnerTabs?.querySelectorAll(".entryInnerTab").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.entryView) === currentEntryView);
    });
  }

  function bindTabs() {
    if (!$entryInnerTabs) return;

    $entryInnerTabs.querySelectorAll(".entryInnerTab").forEach((btn) => {
      btn.addEventListener("click", () => {
        setEntryView(Number(btn.dataset.entryView || 0));
      });
    });
  }

  function buildSlotChars(raw) {
    const capacity = DAY_COUNT * SLOTS_PER_DAY;
    const chars = Array.from(String(raw ?? "").replace(/\u3000/g, " "));
    const slots = Array.from({ length: capacity }, () => "");

    for (let i = 0; i < capacity && i < chars.length; i += 1) {
      const ch = chars[i];
      slots[i] = ch === " " ? "" : ch;
    }
    return slots;
  }

  function buildDays(raw) {
    const slots = buildSlotChars(raw);
    const days = [];

    for (let day = 0; day < DAY_COUNT; day += 1) {
      const start = day * SLOTS_PER_DAY;
      days.push([slots[start] || "", slots[start + 1] || ""]);
    }

    return days;
  }

  function renderHead(totalDays, activeDayNo) {
    if (!$meetPerfDays) return;

    $meetPerfDays.innerHTML = `
      <div class="meetPerfDaysRow">
        ${Array.from({ length: totalDays }, (_, i) => {
          const dayNo = i + 1;
          const classes = [
            "meetPerfDayHead",
            dayNo === activeDayNo ? "is-today" : "",
            dayNo > activeDayNo ? "is-inactive" : ""
          ].filter(Boolean).join(" ");

          return `<div class="${classes}">${dayNo}日目</div>`;
        }).join("")}
      </div>
    `;
  }

  function findPerfObject(boat, racers) {
    const reg = String(boat?.regno ?? boat?.reg ?? "").trim();
    if (reg && racers?.[reg]) return racers[reg];

    const targetName = normalizeName(playerNameResolver ? playerNameResolver(boat) : boat?.name);
    if (!targetName) return null;

    for (const value of Object.values(racers || {})) {
      if (normalizeName(value?.name || "") === targetName) {
        return value;
      }
    }
    return null;
  }

  function renderCell(content, inactive) {
    if (!content) {
      return `
        <div class="meetPerfCell is-empty">
          <div class="meetPerfCellTop"></div>
          <div class="meetPerfCellMid"></div>
          <div class="meetPerfCellBot"></div>
        </div>
      `;
    }

    return `
      <div class="meetPerfCell">
        <div class="meetPerfCellTop"></div>
        <div class="meetPerfCellMid"></div>
        <div class="meetPerfCellBot">${esc(content)}</div>
      </div>
    `;
  }

  function renderTable(boats, meetPerfJson) {
    if (!$meetPerfTable) return;

    const racers = meetPerfJson?.racers || {};
    const activeDayNo = clamp(Number(meetPerfJson?.day_no || 0) || 0, 1, DAY_COUNT);

    renderHead(DAY_COUNT, activeDayNo);

    $meetPerfTable.innerHTML = `
      <div class="meetPerfRows">
        ${boats.map((boat) => {
          const perfObj = findPerfObject(boat, racers);
          const raw = String(perfObj?.meet_perf_raw || "");
          const days = buildDays(raw);

          return `
            <div class="meetPerfRow">
              <div class="meetPerfRow__waku w${esc(boat.waku)}">${esc(boat.waku)}</div>
              <div class="meetPerfRow__days">
                <div class="meetPerfDayCells">
                  ${days.map((pair, index) => {
                    const inactive = index + 1 > activeDayNo;
                    return `
                      <div class="meetPerfDay${inactive ? " is-inactive" : ""}">
                        ${renderCell(pair[0], inactive)}
                        ${renderCell(pair[1], inactive)}
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderLoading() {
    renderHead(DAY_COUNT, 0);
    if ($meetPerfTable) {
      $meetPerfTable.innerHTML = `<div class="meetPerfEmpty">今節成績を読み込み中…</div>`;
    }
  }

  function renderError() {
    renderHead(DAY_COUNT, 0);
    if ($meetPerfTable) {
      $meetPerfTable.innerHTML = `<div class="meetPerfEmpty">今節成績データなし</div>`;
    }
  }

  async function render(boats, raceJson) {
    renderLoading();

    try {
      const dateStr = String(raceJson?.date || currentDate || "").trim();
      const meetPerfJson = await loadMeetPerfForDate(dateStr);
      renderTable(boats, meetPerfJson);
    } catch (e) {
      renderError();
    }
  }

  function boot() {
    bindTabs();
    setEntryView(0);
  }

  return {
    boot,
    setConfig,
    setRaceContext,
    render,
    renderLoading,
    renderError,
    setEntryView
  };
})();