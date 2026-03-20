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
    playerNameResolver =
      typeof config.getPlayerDisplayName === "function"
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
      btn.classList.toggle(
        "is-active",
        Number(btn.dataset.entryView) === currentEntryView
      );
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

  function renderHead(activeDayNo) {
    if (!$meetPerfDays) return;

    $meetPerfDays.innerHTML = `
      <div class="meetPerfDaysRow">
        ${Array.from({ length: DAY_COUNT }, (_, i) => {
          const dayNo = i + 1;
          const classes = [
            "meetPerfDayHead",
            dayNo === activeDayNo ? "is-today" : ""
          ].filter(Boolean).join(" ");

          return `<div class="${classes}">${dayNo}日目</div>`;
        }).join("")}
      </div>
    `;
  }

  function findPerfObject(boat, racers) {
    const reg = String(boat?.regno ?? boat?.reg ?? "").trim();
    if (reg && racers?.[reg]) return racers[reg];

    const targetName = normalizeName(
      playerNameResolver ? playerNameResolver(boat) : boat?.name
    );
    if (!targetName) return null;

    for (const value of Object.values(racers || {})) {
      if (normalizeName(value?.name || "") === targetName) {
        return value;
      }
    }

    return null;
  }

  function normalizeFinishText(v) {
    if (v === undefined || v === null || v === "") return "";
    return String(v).trim();
  }

  function normalizeStText(v) {
    if (v === undefined || v === null || v === "") return "";
    const s = String(v).trim();
    if (!s) return "";
    if (s.startsWith(".")) return s;
    const n = Number(s);
    if (Number.isFinite(n)) {
      return `.${n.toFixed(2).split(".")[1]}`;
    }
    return s;
  }

  function renderSlot(slot) {
    const course = safeCourse(slot?.course);
    const st = normalizeStText(slot?.st);
    const rank = normalizeFinishText(slot?.rank);

    const empty = !course && !st && !rank;
    if (empty) {
      return `
        <div class="meetPerfSlot is-empty">
          <div class="meetPerfSlotTop"></div>
          <div class="meetPerfSlotMid"></div>
          <div class="meetPerfSlotBot"></div>
        </div>
      `;
    }

    return `
      <div class="meetPerfSlot">
        <div class="meetPerfSlotTop w${esc(course || "")}">${esc(course || "")}</div>
        <div class="meetPerfSlotMid">${esc(st)}</div>
        <div class="meetPerfSlotBot">${esc(rank)}</div>
      </div>
    `;
  }

  function safeCourse(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1 || n > 6) return "";
    return String(Math.trunc(n));
  }

  function renderDay(daySlots) {
    const left = Array.isArray(daySlots) ? daySlots[0] : null;
    const right = Array.isArray(daySlots) ? daySlots[1] : null;

    return `
      <div class="meetPerfDay">
        ${renderSlot(left)}
        ${renderSlot(right)}
      </div>
    `;
  }

  function renderRow(boat, days) {
    return `
      <div class="meetPerfRow">
        <div class="meetPerfRow__waku w${esc(boat.waku)}">${esc(boat.waku)}</div>
        <div class="meetPerfRow__days">
          <div class="meetPerfDayCells">
            ${days.map((daySlots) => renderDay(daySlots)).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function buildEmptyDays() {
    return Array.from({ length: DAY_COUNT }, () => [null, null]);
  }

  function normalizeDays(rawDays) {
    const days = buildEmptyDays();

    if (!Array.isArray(rawDays)) return days;

    for (let dayIndex = 0; dayIndex < DAY_COUNT; dayIndex += 1) {
      const srcDay = rawDays[dayIndex];
      if (!Array.isArray(srcDay)) continue;

      for (let slotIndex = 0; slotIndex < SLOTS_PER_DAY; slotIndex += 1) {
        const srcSlot = srcDay[slotIndex];
        days[dayIndex][slotIndex] = srcSlot && typeof srcSlot === "object"
          ? {
              course: srcSlot.course ?? "",
              st: srcSlot.st ?? "",
              rank: srcSlot.rank ?? ""
            }
          : null;
      }
    }

    return days;
  }

  function renderTable(boats, meetPerfJson) {
    if (!$meetPerfTable) return;

    const racers = meetPerfJson?.racers || {};
    const rawDayNo = Number(meetPerfJson?.day_no || 0);
    const activeDayNo =
      Number.isFinite(rawDayNo) && rawDayNo > 0
        ? clamp(rawDayNo, 1, DAY_COUNT)
        : 0;

    renderHead(activeDayNo);

    $meetPerfTable.innerHTML = `
      <div class="meetPerfRows">
        ${boats.map((boat) => {
          const perfObj = findPerfObject(boat, racers);
          const days = normalizeDays(perfObj?.days);
          return renderRow(boat, days);
        }).join("")}
      </div>
    `;
  }

  function renderLoading() {
    renderHead(0);

    if (!$meetPerfTable) return;

    const placeholderBoats = [1, 2, 3, 4, 5, 6].map((waku) => ({ waku }));
    const emptyDays = buildEmptyDays();

    $meetPerfTable.innerHTML = `
      <div class="meetPerfRows">
        ${placeholderBoats.map((boat) => renderRow(boat, emptyDays)).join("")}
      </div>
    `;
  }

  function renderError(boats = null) {
    renderHead(0);

    if (!$meetPerfTable) return;

    const baseBoats = Array.isArray(boats) && boats.length
      ? boats
      : [1, 2, 3, 4, 5, 6].map((waku) => ({ waku }));

    const emptyDays = buildEmptyDays();

    $meetPerfTable.innerHTML = `
      <div class="meetPerfRows">
        ${baseBoats.map((boat) => renderRow(boat, emptyDays)).join("")}
      </div>
      <div class="meetPerfEmpty">今節成績データなし</div>
    `;
  }

  async function render(boats, raceJson) {
    renderLoading();

    try {
      const dateStr = String(raceJson?.date || currentDate || "").trim();
      const meetPerfJson = await loadMeetPerfForDate(dateStr);
      renderTable(boats, meetPerfJson);
    } catch (e) {
      renderError(boats);
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