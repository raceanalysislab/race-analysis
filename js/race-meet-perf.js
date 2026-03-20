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

  function renderHead(currentDayNo, totalDays) {
    if (!$meetPerfDays) return;

    const safeCurrentDay = Number.isFinite(Number(currentDayNo)) ? Number(currentDayNo) : 0;
    const safeTotalDays = Number.isFinite(Number(totalDays)) ? Number(totalDays) : DAY_COUNT;

    $meetPerfDays.innerHTML = `
      <div class="meetPerfDaysRow">
        ${Array.from({ length: DAY_COUNT }, (_, i) => {
          const dayNo = i + 1;
          const classes = [
            "meetPerfDayHead",
            dayNo === safeCurrentDay ? "is-today" : "",
            dayNo > safeTotalDays ? "is-inactive" : ""
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

  function buildEmptyDays() {
    return Array.from({ length: DAY_COUNT }, () =>
      Array.from({ length: SLOTS_PER_DAY }, () => null)
    );
  }

  function normalizeDays(days) {
    const out = buildEmptyDays();

    if (!Array.isArray(days)) return out;

    for (let dayIdx = 0; dayIdx < DAY_COUNT; dayIdx += 1) {
      const day = Array.isArray(days[dayIdx]) ? days[dayIdx] : [];

      for (let slotIdx = 0; slotIdx < SLOTS_PER_DAY; slotIdx += 1) {
        const item = day[slotIdx];
        if (!item || typeof item !== "object") {
          out[dayIdx][slotIdx] = null;
          continue;
        }

        out[dayIdx][slotIdx] = {
          course:
            item.course !== undefined && item.course !== null && item.course !== ""
              ? String(item.course)
              : "",
          st: item.st ? String(item.st) : "",
          rank:
            item.rank !== undefined && item.rank !== null && item.rank !== ""
              ? String(item.rank)
              : ""
        };
      }
    }

    return out;
  }

  function renderRaceSlot(item) {
    if (!item) {
      return `
        <div class="meetPerfRaceSlot is-empty">
          <div class="meetPerfCellTop"></div>
          <div class="meetPerfCellMid"></div>
          <div class="meetPerfCellBot"></div>
        </div>
      `;
    }

    const course = item.course || "";
    const st = item.st || "";
    const rank = item.rank || "";

    return `
      <div class="meetPerfRaceSlot">
        <div class="meetPerfCellTop${course ? ` w${esc(course)}` : ""}">${esc(course)}</div>
        <div class="meetPerfCellMid">${esc(st)}</div>
        <div class="meetPerfCellBot">${esc(rank)}</div>
      </div>
    `;
  }

  function renderRow(boat, days, totalDays) {
    return `
      <div class="meetPerfRow">
        <div class="meetPerfRow__waku w${esc(boat.waku)}">${esc(boat.waku)}</div>
        <div class="meetPerfRow__days">
          <div class="meetPerfDayCells">
            ${days.map((pair, index) => {
              const dayNo = index + 1;
              const inactive = dayNo > totalDays;

              return `
                <div class="meetPerfDay${inactive ? " is-inactive" : ""}">
                  ${renderRaceSlot(pair[0])}
                  ${renderRaceSlot(pair[1])}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function renderTable(boats, meetPerfJson) {
    if (!$meetPerfTable) return;

    const racers = meetPerfJson?.racers || {};
    const rawDayNo = Number(meetPerfJson?.day_no || 0);
    const rawTotalDays = Number(meetPerfJson?.total_days || 0);

    const currentDayNo =
      Number.isFinite(rawDayNo) && rawDayNo > 0
        ? clamp(rawDayNo, 1, DAY_COUNT)
        : 0;

    const totalDays =
      Number.isFinite(rawTotalDays) && rawTotalDays > 0
        ? clamp(rawTotalDays, 1, DAY_COUNT)
        : DAY_COUNT;

    renderHead(currentDayNo, totalDays);

    $meetPerfTable.innerHTML = `
      <div class="meetPerfRows">
        ${boats.map((boat) => {
          const perfObj = findPerfObject(boat, racers);
          const days = normalizeDays(perfObj?.days);
          return renderRow(boat, days, totalDays);
        }).join("")}
      </div>
    `;
  }

  function renderLoading() {
    renderHead(0, DAY_COUNT);

    if (!$meetPerfTable) return;

    const placeholderBoats = [1, 2, 3, 4, 5, 6].map((waku) => ({ waku }));
    const emptyDays = buildEmptyDays();

    $meetPerfTable.innerHTML = `
      <div class="meetPerfRows">
        ${placeholderBoats.map((boat) => renderRow(boat, emptyDays, DAY_COUNT)).join("")}
      </div>
    `;
  }

  function renderError(boats = null) {
    renderHead(0, DAY_COUNT);

    if (!$meetPerfTable) return;

    const baseBoats = Array.isArray(boats) && boats.length
      ? boats
      : [1, 2, 3, 4, 5, 6].map((waku) => ({ waku }));

    const emptyDays = buildEmptyDays();

    $meetPerfTable.innerHTML = `
      <div class="meetPerfRows">
        ${baseBoats.map((boat) => renderRow(boat, emptyDays, DAY_COUNT)).join("")}
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