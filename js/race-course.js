(() => {
  const ORDER = [6, 5, 4, 3, 2, 1];
  const RACER_GENDER_URL =
    "https://raceanalysislab.github.io/race-analysis/data/master/racer_gender.json";

  const state = {
    raceJson: null,
    genderMap: {}
  };

  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  const pickValue = (obj, keys) => {
    for (const key of keys) {
      const v = obj?.[key];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  };

  const pickNumber = (obj, keys) => {
    const v = pickValue(obj, keys);
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const formatDash = (v) => {
    if (v === undefined || v === null || v === "") return "—";
    return String(v);
  };

  const formatST = (v) => {
    if (v === undefined || v === null || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `.${n.toFixed(2).split(".")[1]}`;
  };

  const formatRate = (v) => {
    if (v === undefined || v === null || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(1)}%`;
  };

  const formatKimarite = (v) => {
    if (v === undefined || v === null || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return String(Math.round(n));
  };

  const formatStarts = (v) => {
    if (v === undefined || v === null || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return String(Math.trunc(n));
  };

  const normalizeName = (name) =>
    String(name ?? "").replace(/\s+/g, "").trim();

  const getSearchParams = () => {
    const qs = new URLSearchParams(location.search);
    return {
      venueName: qs.get("name") || "",
      jcd: qs.get("jcd") || "",
      date: qs.get("date") || "",
      race: qs.get("race") || ""
    };
  };

  const buildPlayerHref = (boat) => {
    const { venueName, jcd, date, race } = getSearchParams();
    const next = new URL("./player.html", location.href);

    next.searchParams.set("regno", String(boat?.regno || ""));
    next.searchParams.set("name", normalizeName(boat?.name || ""));
    next.searchParams.set("jcd", String(jcd || ""));
    next.searchParams.set("date", String(date || ""));
    next.searchParams.set("race", String(race || ""));
    next.searchParams.set("venue", String(venueName || ""));
    next.searchParams.set("waku", String(boat?.waku || ""));
    next.searchParams.set("grade", String(boat?.grade || ""));
    next.searchParams.set("branch", String(boat?.branch || ""));
    next.searchParams.set("age", String(boat?.age || ""));

    return next.toString();
  };

  const isFemaleRacer = (boat) => {
    const reg = String(boat?.regno ?? boat?.reg ?? "").trim();
    return Number(state.genderMap?.[reg]) === 1;
  };

  const getBoatsOrdered = () => {
    const boats = Array.isArray(state.raceJson?.race?.boats) ? state.raceJson.race.boats : [];
    const byWaku = new Map();

    boats.forEach((boat) => {
      const waku = Number(boat?.waku);
      if (waku >= 1 && waku <= 6) {
        byWaku.set(waku, boat);
      }
    });

    return ORDER.map((waku) => byWaku.get(waku) || { waku, name: "—", grade: "—" });
  };

  const getAvgStValue = (boat) => {
    const v = pickNumber(boat, [
      "avg_st",
      "st_avg",
      "ave_st",
      "average_st",
      "start_average"
    ]);
    return formatST(v);
  };

  const getMeetAvgStValue = (boat) => {
    const v = pickNumber(boat, [
      "meet_avg_st",
      "this_meet_avg_st",
      "this_series_avg_st",
      "series_avg_st",
      "season_avg_st",
      "recent_meet_st"
    ]);
    return formatST(v);
  };

  const getCourseStartsText = (boat) => {
    const v = pickValue(boat, [
      "course_starts",
      "course_start_count",
      "course_count",
      "starts"
    ]);
    return formatStarts(v);
  };

  const normalizeGrade = (grade) => {
    const g = String(grade ?? "").trim().toUpperCase();
    if (g === "A1" || g === "A2" || g === "B1" || g === "B2") return g;
    return "";
  };

  const getGradeClass = (boat) => {
    const g = normalizeGrade(boat?.grade);
    return g ? `grade-${g}` : "";
  };

  const getWakuClass = (boat) => {
    const w = Number(boat?.waku);
    return w >= 1 && w <= 6 ? `w${w}` : "";
  };

  const getGradeText = (boat) => formatDash(boat?.grade || "—");

  const getFText = (boat) => {
    return formatDash(
      pickValue(boat, ["f_count", "f", "F", "f_num"]) || "—"
    );
  };

  const getLText = (boat) => {
    return formatDash(
      pickValue(boat, ["l_count", "l", "L", "l_num"]) || "—"
    );
  };

  const getCourseWinText = (boat) => {
    const v = pickValue(boat, [
      "course_win",
      "course_win_rate",
      "course_1着率",
      "course_win_1y",
      "course_win_3y"
    ]);
    return formatRate(v);
  };

  const getCourseWinClass = (boat) => {
    const v = Number(pickValue(boat, [
      "course_win",
      "course_win_rate",
      "course_1着率",
      "course_win_1y",
      "course_win_3y"
    ]));
    const waku = Number(boat?.waku);

    if (!Number.isFinite(v)) return "";
    if (waku === 1 && v >= 80) return "courseWinGold";
    return "courseWinBlue";
  };

  const getCourseKimariteParts = (boat) => {
    const sashi = pickValue(boat, [
      "course_sashi",
      "course_kimarite_sashi",
      "kimarite_sashi",
      "sashi_rate"
    ]);

    const makuri = pickValue(boat, [
      "course_makuri",
      "course_kimarite_makuri",
      "kimarite_makuri",
      "makuri_rate"
    ]);

    const makurisashi = pickValue(boat, [
      "course_makurisashi",
      "course_kimarite_makurisashi",
      "kimarite_makurisashi",
      "makurisashi_rate"
    ]);

    return {
      sashi: formatKimarite(sashi),
      makuri: formatKimarite(makuri),
      makurisashi: formatKimarite(makurisashi)
    };
  };

  const getCourseAvgStText = (boat) => {
    const v = pickValue(boat, [
      "course_avg_st",
      "course_st",
      "course_avg_st_1y",
      "course_avg_st_3y"
    ]);

    if (typeof v === "object") return "—";
    if (v === "" || v === null || v === undefined) return "—";

    const n = Number(v);
    if (Number.isFinite(n)) return formatST(n);

    return formatDash(v);
  };

  const getCourse2renText = (boat) => {
    const v = pickValue(boat, [
      "course_2ren",
      "course_2",
      "course_2ren_1y",
      "course_2ren_3y"
    ]);
    return formatRate(v);
  };

  const getCourse3renText = (boat) => {
    const v = pickValue(boat, [
      "course_3ren",
      "course_3",
      "course_3ren_1y",
      "course_3ren_3y"
    ]);
    return formatRate(v);
  };

  const renderHeadRow = (boats) => `
    <div class="courseGridRow courseGridRow--head">
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--head ${esc(getWakuClass(boat))}">
          ${esc(boat.waku)}
        </div>
      `).join("")}
      <div class="courseGridLabel">枠</div>
    </div>
  `;

  const renderNameRow = (boats) => `
    <div class="courseGridRow courseGridRow--name">
      ${boats.map((boat) => `
        <a
          class="courseGridCell courseGridCell--name courseGridCell--nameLink ${esc(getWakuClass(boat))}${isFemaleRacer(boat) ? " female" : ""}"
          href="${esc(buildPlayerHref(boat))}"
          data-player-link="1"
        >
          <div class="courseGridNameVerticalWrap">
            ${isFemaleRacer(boat) ? '<div class="courseGridFemaleMark">♡</div>' : ""}
            <div class="courseGridNameVertical">${esc(formatDash(normalizeName(boat?.name || "—")))}</div>
          </div>
        </a>
      `).join("")}
      <div class="courseGridLabel">選手名</div>
    </div>
  `;

  const renderGradeRow = (boats) => `
    <div class="courseGridRow courseGridRow--grade">
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--grade ${esc(getWakuClass(boat))} ${esc(getGradeClass(boat))}">
          <div class="courseGrade ${esc(getGradeClass(boat))}">${esc(getGradeText(boat))}</div>
        </div>
      `).join("")}
      <div class="courseGridLabel">級</div>
    </div>
  `;

  const renderSimpleRow = (boats, label, valueFn, rowClass = "") => `
    <div class="courseGridRow ${rowClass}">
      ${boats.map((boat) => `
        <div class="courseGridCell">
          <div class="courseGridMetric">${esc(valueFn(boat))}</div>
        </div>
      `).join("")}
      <div class="courseGridLabel">${esc(label)}</div>
    </div>
  `;

  const renderFLRow = (boats) => `
    <div class="courseGridRow courseGridRow--fl">
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--fl">
          <div class="courseFLBox">
            <div class="courseFLCol">
              <div class="courseFLHead">F</div>
              <div class="courseFLVal courseFLVal--f">${esc(getFText(boat))}</div>
            </div>
            <div class="courseFLCol">
              <div class="courseFLHead">L</div>
              <div class="courseFLVal courseFLVal--l">${esc(getLText(boat))}</div>
            </div>
          </div>
        </div>
      `).join("")}
      <div class="courseGridLabel">F/L</div>
    </div>
  `;

  const renderCourseWinRow = (boats) => `
    <div class="courseGridRow courseGridRow--course">
      ${boats.map((boat) => `
        <div class="courseGridCell ${esc(getCourseWinClass(boat))}">
          <div class="courseGridMetric">${esc(getCourseWinText(boat))}</div>
        </div>
      `).join("")}
      <div class="courseGridLabel">コース勝率</div>
    </div>
  `;

  const renderKimariteRow = (boats) => `
    <div class="courseGridRow courseGridRow--kimarite">
      ${boats.map((boat) => {
        const parts = getCourseKimariteParts(boat);
        return `
          <div class="courseGridCell courseGridCell--kimarite">
            <div class="courseKimariteBox">
              <div class="courseKimariteCol">
                <div class="courseKimariteHead">差</div>
                <div class="courseKimariteVal">${esc(parts.sashi)}</div>
              </div>
              <div class="courseKimariteCol">
                <div class="courseKimariteHead">捲</div>
                <div class="courseKimariteVal">${esc(parts.makuri)}</div>
              </div>
              <div class="courseKimariteCol">
                <div class="courseKimariteHead">捲差</div>
                <div class="courseKimariteVal">${esc(parts.makurisashi)}</div>
              </div>
            </div>
          </div>
        `;
      }).join("")}
      <div class="courseGridLabel">コース別決まり手</div>
    </div>
  `;

  const renderMainGrid = () => {
    const boats = getBoatsOrdered();

    return `
      <div class="courseGrid">
        ${renderHeadRow(boats)}
        ${renderNameRow(boats)}
        ${renderGradeRow(boats)}
        ${renderFLRow(boats)}
        ${renderSimpleRow(boats, "平均ST", getAvgStValue, "courseGridRow--avgst")}
        ${renderSimpleRow(boats, "今節平均ST", getMeetAvgStValue, "courseGridRow--meetavgst")}
        ${renderSimpleRow(boats, "コース出走数", getCourseStartsText, "courseGridRow--starts")}
        ${renderCourseWinRow(boats)}
        ${renderKimariteRow(boats)}
        ${renderSimpleRow(boats, "コース別平均ST", getCourseAvgStText, "courseGridRow--course")}
        ${renderSimpleRow(boats, "コース別2連対", getCourse2renText, "courseGridRow--course")}
        ${renderSimpleRow(boats, "コース別3連対", getCourse3renText, "courseGridRow--course")}
      </div>
    `;
  };

  const bindNameLinks = (root) => {
    root.querySelectorAll('[data-player-link="1"]').forEach((link) => {
      link.addEventListener("click", () => {
        /* 通常遷移 */
      });
    });
  };

  const renderRoot = () => {
    const root = $("courseDataRoot");
    if (!root) return;

    root.innerHTML = `
      <div class="coursePanel">
        <div class="coursePanelMain">
          <div class="coursePanelBody">
            ${renderMainGrid()}
          </div>
        </div>
      </div>
    `;

    bindNameLinks(root);
  };

  const renderLoading = () => {
    const root = $("courseDataRoot");
    if (!root) return;
    root.innerHTML = `<div class="err">読み込み中…</div>`;
  };

  const renderError = () => {
    const root = $("courseDataRoot");
    if (!root) return;
    root.innerHTML = `<div class="err">コースデータ取得失敗</div>`;
  };

  const fetchGenderMap = async () => {
    try {
      const res = await fetch(`${RACER_GENDER_URL}?t=${Math.floor(Date.now() / 60000)}`, {
        cache: "no-store"
      });
      if (!res.ok) throw new Error("gender fetch failed");
      const json = await res.json();
      state.genderMap = json || {};
    } catch (e) {
      state.genderMap = {};
    }
  };

  const render = async (json) => {
    state.raceJson = json || null;
    await fetchGenderMap();
    renderRoot();
  };

  const boot = () => {
    renderRoot();
  };

  window.BOAT_CORE_COURSE = {
    boot,
    render,
    renderLoading,
    renderError
  };
})();