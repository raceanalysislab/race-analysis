(() => {
  const ORDER = [6, 5, 4, 3, 2, 1];

  const state = {
    raceJson: null
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
    next.searchParams.set("name", String(boat?.name || ""));
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

  const getBoatsOrdered = () => {
    const boats = Array.isArray(state.raceJson?.race?.boats) ? state.raceJson.race.boats : [];
    const byWaku = new Map();

    boats.forEach((boat) => {
      const waku = Number(boat?.waku);
      if (waku >= 1 && waku <= 6) {
        byWaku.set(waku, boat);
      }
    });

    return ORDER.map((waku) => byWaku.get(waku) || { waku, name: "—" });
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

  const getGradeText = (boat) => {
    return formatDash(boat?.grade || "—");
  };

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

  const getCourseKimariteText = (boat) => {
    return formatDash(
      pickValue(boat, [
        "course_kimarite",
        "kimarite",
        "kimarite_1y",
        "kimarite_3y"
      ]) || "—"
    );
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

    if (typeof v === "object") return "—";
    if (v === "" || v === null || v === undefined) return "—";

    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : formatDash(v);
  };

  const getCourse3renText = (boat) => {
    const v = pickValue(boat, [
      "course_3ren",
      "course_3",
      "course_3ren_1y",
      "course_3ren_3y"
    ]);

    if (typeof v === "object") return "—";
    if (v === "" || v === null || v === undefined) return "—";

    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : formatDash(v);
  };

  const renderHeadRow = (boats) => `
    <div class="courseGridRow courseGridRow--head">
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--head w${esc(boat.waku)}">
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
          class="courseGridCell courseGridCell--name courseGridCell--nameLink"
          href="${esc(buildPlayerHref(boat))}"
          data-player-link="1"
        >
          <div class="courseGridNameVertical">${esc(formatDash(boat?.name || "—"))}</div>
        </a>
      `).join("")}
      <div class="courseGridLabel">選手名</div>
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

  const renderMainGrid = () => {
    const boats = getBoatsOrdered();

    return `
      <div class="courseGrid">
        ${renderHeadRow(boats)}
        ${renderNameRow(boats)}
        ${renderSimpleRow(boats, "級", getGradeText, "courseGridRow--grade")}
        ${renderSimpleRow(boats, "F", getFText, "courseGridRow--f")}
        ${renderSimpleRow(boats, "L", getLText, "courseGridRow--l")}
        ${renderSimpleRow(boats, "平均ST", getAvgStValue, "courseGridRow--avgst")}
        ${renderSimpleRow(boats, "今節平均ST", getMeetAvgStValue, "courseGridRow--meetavgst")}
        ${renderSimpleRow(boats, "コース別決まり手", getCourseKimariteText, "courseGridRow--course")}
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

  const render = (json) => {
    state.raceJson = json || null;
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