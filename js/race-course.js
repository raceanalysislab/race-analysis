(() => {
  const ORDER = [6, 5, 4, 3, 2, 1];

  const ROW_DEFS = [
    { key: "waku", label: "枠", className: "courseGridRow--head" },
    { key: "name", label: "選手名", className: "courseGridRow--name" },
    { key: "grade", label: "級", className: "courseGridRow--grade" },
    { key: "f", label: "F", className: "courseGridRow--f" },
    { key: "l", label: "L", className: "courseGridRow--l" },
    { key: "avgSt", label: "平均ST", className: "courseGridRow--avgst" },
    { key: "meetAvgSt", label: "今節平均ST", className: "courseGridRow--meetavgst" },
    { key: "recent", label: "近況データ", className: "courseGridRow--recent" },
    { key: "courseAvgSt-1", label: "コース別平均ST", className: "courseGridRow--course", groupKey: "courseAvgSt", courseNo: 1 },
    { key: "courseAvgSt-2", label: "コース別平均ST", className: "courseGridRow--course", groupKey: "courseAvgSt", courseNo: 2 },
    { key: "courseAvgSt-3", label: "コース別平均ST", className: "courseGridRow--course", groupKey: "courseAvgSt", courseNo: 3 },
    { key: "courseAvgSt-4", label: "コース別平均ST", className: "courseGridRow--course", groupKey: "courseAvgSt", courseNo: 4 },
    { key: "courseAvgSt-5", label: "コース別平均ST", className: "courseGridRow--course", groupKey: "courseAvgSt", courseNo: 5 },
    { key: "courseAvgSt-6", label: "コース別平均ST", className: "courseGridRow--course", groupKey: "courseAvgSt", courseNo: 6 },
    { key: "kimarite-sashi", label: "決まり手", className: "courseGridRow--kimarite", groupKey: "kimarite", kimariteKey: "sashi" },
    { key: "kimarite-makuri", label: "決まり手", className: "courseGridRow--kimarite", groupKey: "kimarite", kimariteKey: "makuri" },
    { key: "kimarite-makurizashi", label: "決まり手", className: "courseGridRow--kimarite", groupKey: "kimarite", kimariteKey: "makurizashi" },
    { key: "course2ren-1", label: "コース別2連対率", className: "courseGridRow--course", groupKey: "course2ren", courseNo: 1 },
    { key: "course2ren-2", label: "コース別2連対率", className: "courseGridRow--course", groupKey: "course2ren", courseNo: 2 },
    { key: "course2ren-3", label: "コース別2連対率", className: "courseGridRow--course", groupKey: "course2ren", courseNo: 3 },
    { key: "course2ren-4", label: "コース別2連対率", className: "courseGridRow--course", groupKey: "course2ren", courseNo: 4 },
    { key: "course2ren-5", label: "コース別2連対率", className: "courseGridRow--course", groupKey: "course2ren", courseNo: 5 },
    { key: "course2ren-6", label: "コース別2連対率", className: "courseGridRow--course", groupKey: "course2ren", courseNo: 6 },
    { key: "course3ren-1", label: "コース別3連対率", className: "courseGridRow--course", groupKey: "course3ren", courseNo: 1 },
    { key: "course3ren-2", label: "コース別3連対率", className: "courseGridRow--course", groupKey: "course3ren", courseNo: 2 },
    { key: "course3ren-3", label: "コース別3連対率", className: "courseGridRow--course", groupKey: "course3ren", courseNo: 3 },
    { key: "course3ren-4", label: "コース別3連対率", className: "courseGridRow--course", groupKey: "course3ren", courseNo: 4 },
    { key: "course3ren-5", label: "コース別3連対率", className: "courseGridRow--course", groupKey: "course3ren", courseNo: 5 },
    { key: "course3ren-6", label: "コース別3連対率", className: "courseGridRow--course", groupKey: "course3ren", courseNo: 6 }
  ];

  const state = {
    raceJson: null,
    activeGroup: "avgSt"
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
    return `${n.toFixed(1)}`;
  };

  const formatCount = (v) => {
    if (v === undefined || v === null || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return String(Math.trunc(n));
    return String(Math.trunc(n));
  };

  const getBoatsOrdered = () => {
    const boats = Array.isArray(state.raceJson?.race?.boats) ? state.raceJson.race.boats : [];
    const byWaku = new Map();

    boats.forEach((boat) => {
      const waku = Number(boat?.waku);
      if (waku >= 1 && waku <= 6) byWaku.set(waku, boat);
    });

    return ORDER.map((waku) => byWaku.get(waku) || { waku, name: "—" });
  };

  const getCourseBucket = (boat, kind) => {
    const directMap = {
      avgSt: ["course_avg_st", "course_st", "course_st_3y", "course_avg_st_3y", "course_stats_3y", "course3y"],
      course2ren: ["course_2ren", "course_2ren_3y", "course_2", "course_stats_3y", "course3y"],
      course3ren: ["course_3ren", "course_3ren_3y", "course_3", "course_stats_3y", "course3y"],
      kimarite: ["kimarite", "course_kimarite", "kimarite_3y", "course_stats_3y", "course3y"]
    };

    const keys = directMap[kind] || [];
    for (const key of keys) {
      const value = boat?.[key];
      if (value && typeof value === "object") return value;
    }
    return null;
  };

  const getCourseCell = (boat, courseNo, kind) => {
    const bucket = getCourseBucket(boat, kind);

    if (bucket) {
      const courseObj =
        bucket?.[courseNo] ||
        bucket?.[String(courseNo)] ||
        bucket?.[`c${courseNo}`] ||
        bucket?.[`course${courseNo}`] ||
        null;

      if (courseObj && typeof courseObj === "object") {
        if (kind === "avgSt") {
          const v = pickNumber(courseObj, ["avg_st", "st", "st_avg", "average_st", "start_average"]);
          return formatST(v);
        }

        if (kind === "course2ren") {
          const v = pickNumber(courseObj, ["rate2", "ren2", "two", "two_rate", "niren", "niren_rate", "percent_2"]);
          return formatRate(v);
        }

        if (kind === "course3ren") {
          const v = pickNumber(courseObj, ["rate3", "ren3", "three", "three_rate", "sanren", "sanren_rate", "percent_3"]);
          return formatRate(v);
        }
      }

      if (kind === "kimarite") return courseObj || bucket;
    }

    if (kind === "avgSt") {
      const v = pickNumber(boat, [
        `course${courseNo}_avg_st`,
        `course_${courseNo}_avg_st`,
        `c${courseNo}_avg_st`,
        `course${courseNo}_st`,
        `course_${courseNo}_st`
      ]);
      return formatST(v);
    }

    if (kind === "course2ren") {
      const v = pickNumber(boat, [
        `course${courseNo}_2ren`,
        `course_${courseNo}_2ren`,
        `course${courseNo}_2`,
        `course_${courseNo}_2`
      ]);
      return formatRate(v);
    }

    if (kind === "course3ren") {
      const v = pickNumber(boat, [
        `course${courseNo}_3ren`,
        `course_${courseNo}_3ren`,
        `course${courseNo}_3`,
        `course_${courseNo}_3`
      ]);
      return formatRate(v);
    }

    return "—";
  };

  const getKimariteCell = (boat, typeKey) => {
    const bucket = getCourseBucket(boat, "kimarite");

    if (bucket) {
      const direct = pickNumber(bucket, [
        typeKey,
        typeKey === "sashi" ? "差し" : "",
        typeKey === "makuri" ? "まくり" : "",
        typeKey === "makurizashi" ? "まくり差し" : "",
        typeKey === "makurizashi" ? "捲り差し" : ""
      ].filter(Boolean));

      if (direct !== null) return formatCount(direct);

      const nested = bucket?.total || bucket?.sum || bucket?.all;
      if (nested && typeof nested === "object") {
        const v = pickNumber(nested, [
          typeKey,
          typeKey === "sashi" ? "差し" : "",
          typeKey === "makuri" ? "まくり" : "",
          typeKey === "makurizashi" ? "まくり差し" : "",
          typeKey === "makurizashi" ? "捲り差し" : ""
        ].filter(Boolean));
        if (v !== null) return formatCount(v);
      }
    }

    const v = pickNumber(boat, [
      typeKey,
      `kimarite_${typeKey}`,
      `course_${typeKey}`,
      typeKey === "sashi" ? "sashi_count" : "",
      typeKey === "makuri" ? "makuri_count" : "",
      typeKey === "makurizashi" ? "makurizashi_count" : ""
    ].filter(Boolean));

    return formatCount(v);
  };

  const getAvgStValue = (boat) => {
    const v = pickNumber(boat, ["avg_st", "st_avg", "ave_st", "average_st", "start_average"]);
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

  const getRecentValue = (boat) => {
    const v = pickValue(boat, [
      "recent_index",
      "recent_score",
      "recent_rate",
      "last12m_rate",
      "last24m_rate",
      "recent_data"
    ]);
    return v !== "" ? formatDash(v) : "—";
  };

  const getGradeText = (boat) => formatDash(boat?.grade || "—");
  const getFText = (boat) => formatDash(pickValue(boat, ["f_count", "f", "F", "f_num"]) || "—");
  const getLText = (boat) => formatDash(pickValue(boat, ["l_count", "l", "L", "l_num"]) || "—");

  const getRowValue = (rowDef, boat) => {
    switch (rowDef.key) {
      case "avgSt":
        return getAvgStValue(boat);
      case "meetAvgSt":
        return getMeetAvgStValue(boat);
      case "recent":
        return getRecentValue(boat);
      case "grade":
        return getGradeText(boat);
      case "f":
        return getFText(boat);
      case "l":
        return getLText(boat);
      default:
        if (rowDef.groupKey === "courseAvgSt") {
          return getCourseCell(boat, rowDef.courseNo, "avgSt");
        }
        if (rowDef.groupKey === "course2ren") {
          return getCourseCell(boat, rowDef.courseNo, "course2ren");
        }
        if (rowDef.groupKey === "course3ren") {
          return getCourseCell(boat, rowDef.courseNo, "course3ren");
        }
        if (rowDef.groupKey === "kimarite") {
          return getKimariteCell(boat, rowDef.kimariteKey);
        }
        return "—";
    }
  };

  const renderHeadRow = (boats) => `
    <div class="courseGridRow courseGridRow--head" data-row-key="waku">
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--head w${esc(boat.waku)}">${esc(boat.waku)}</div>
      `).join("")}
      <button type="button" class="courseGridCell courseGridLabel${state.activeGroup === "waku" ? " is-active" : ""}" data-group-key="waku">枠</button>
    </div>
  `;

  const renderNameRow = (boats) => `
    <div class="courseGridRow courseGridRow--name" data-row-key="name">
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--name">
          <div class="courseGridNameVertical">${esc(formatDash(boat?.name || "—"))}</div>
        </div>
      `).join("")}
      <button type="button" class="courseGridCell courseGridLabel${state.activeGroup === "name" ? " is-active" : ""}" data-group-key="name">選手名</button>
    </div>
  `;

  const renderSimpleRow = (rowDef, boats) => `
    <div class="courseGridRow ${rowDef.className}" data-row-key="${esc(rowDef.key)}">
      ${boats.map((boat) => `
        <div class="courseGridCell${rowDef.key === "grade" ? " courseGridCell--grade" : ""}">
          ${
            rowDef.key === "grade"
              ? `<div class="courseGridGradeBlock"><div class="courseGridGradeMain">${esc(getRowValue(rowDef, boat))}</div></div>`
              : `<div class="courseGridMetric${rowDef.key === "f" || rowDef.key === "l" || rowDef.key === "recent" ? " courseGridMetric--small" : ""}">${esc(getRowValue(rowDef, boat))}</div>`
          }
        </div>
      `).join("")}
      <button type="button" class="courseGridCell courseGridLabel${state.activeGroup === rowDef.key ? " is-active" : ""}" data-group-key="${esc(rowDef.key)}">${esc(rowDef.label)}</button>
    </div>
  `;

  const renderGroupedRow = (rowDef, boats) => `
    <div class="courseGridRow ${rowDef.className}" data-row-key="${esc(rowDef.key)}">
      ${boats.map((boat) => `
        <div class="courseGridCell">
          <div class="courseGridMetric courseGridMetric--small">${esc(getRowValue(rowDef, boat))}</div>
        </div>
      `).join("")}
      <button
        type="button"
        class="courseGridCell courseGridLabel${state.activeGroup === rowDef.groupKey ? " is-active" : ""}"
        data-group-key="${esc(rowDef.groupKey)}"
      >
        ${esc(rowDef.label)}
      </button>
    </div>
  `;

  const renderMainGrid = () => {
    const boats = getBoatsOrdered();

    return `
      <div class="courseGrid">
        ${renderHeadRow(boats)}
        ${renderNameRow(boats)}
        ${renderSimpleRow(ROW_DEFS.find(v => v.key === "grade"), boats)}
        ${renderSimpleRow(ROW_DEFS.find(v => v.key === "f"), boats)}
        ${renderSimpleRow(ROW_DEFS.find(v => v.key === "l"), boats)}
        ${renderSimpleRow(ROW_DEFS.find(v => v.key === "avgSt"), boats)}
        ${renderSimpleRow(ROW_DEFS.find(v => v.key === "meetAvgSt"), boats)}
        ${renderSimpleRow(ROW_DEFS.find(v => v.key === "recent"), boats)}
        ${ROW_DEFS.filter(v => v.groupKey === "courseAvgSt").map((rowDef) => renderGroupedRow(rowDef, boats)).join("")}
        ${ROW_DEFS.filter(v => v.groupKey === "kimarite").map((rowDef) => renderGroupedRow(rowDef, boats)).join("")}
        ${ROW_DEFS.filter(v => v.groupKey === "course2ren").map((rowDef) => renderGroupedRow(rowDef, boats)).join("")}
        ${ROW_DEFS.filter(v => v.groupKey === "course3ren").map((rowDef) => renderGroupedRow(rowDef, boats)).join("")}
      </div>
    `;
  };

  const scrollToGroup = (root, groupKey) => {
    const panelBody = root.querySelector("#coursePanelBody");
    if (!panelBody) return;

    let selector = `[data-row-key="${groupKey}"]`;

    if (groupKey === "courseAvgSt") selector = `[data-row-key="courseAvgSt-1"]`;
    if (groupKey === "kimarite") selector = `[data-row-key="kimarite-sashi"]`;
    if (groupKey === "course2ren") selector = `[data-row-key="course2ren-1"]`;
    if (groupKey === "course3ren") selector = `[data-row-key="course3ren-1"]`;

    const target = root.querySelector(selector);
    if (!target) return;

    panelBody.scrollTo({
      top: target.offsetTop,
      behavior: "smooth"
    });
  };

  const bindLabelEvents = (root) => {
    root.querySelectorAll("[data-group-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const groupKey = btn.dataset.groupKey || "avgSt";
        state.activeGroup = groupKey;
        renderRoot();
        requestAnimationFrame(() => {
          const reroot = $("courseDataRoot");
          if (reroot) scrollToGroup(reroot, groupKey);
        });
      });
    });
  };

  const renderRoot = () => {
    const root = $("courseDataRoot");
    if (!root) return;

    root.innerHTML = `
      <div class="coursePanel">
        <div class="coursePanelMain">
          <div class="coursePanelBody" id="coursePanelBody">
            ${renderMainGrid()}
          </div>
        </div>
      </div>
    `;

    bindLabelEvents(root);
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