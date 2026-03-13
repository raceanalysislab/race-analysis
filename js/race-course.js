(() => {
  const TAB_DEFS = [
    { key: "avgSt", label: "平均ST" },
    { key: "meetAvgSt", label: "今節平均ST" },
    { key: "recent", label: "近況データ" },
    { key: "courseAvgSt", label: "コース別平均ST" },
    { key: "kimarite", label: "決まり手" },
    { key: "course2ren", label: "コース別2連対率" },
    { key: "course3ren", label: "コース別3連対率" }
  ];

  const ORDER = [6, 5, 4, 3, 2, 1];

  const state = {
    activeTab: "avgSt",
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

  const formatRate = (v) => {
    if (v === undefined || v === null || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(1)}`;
  };

  const formatCount = (v) => {
    if (v === undefined || v === null || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return String(Math.trunc(n));
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

  const getBoatName = (boat) => {
    return formatDash(boat?.name || "—");
  };

  const getCourseBucket = (boat, kind) => {
    const directMap = {
      avgSt: [
        "course_avg_st",
        "course_st",
        "course_st_3y",
        "course_avg_st_3y",
        "course_stats_3y",
        "course3y"
      ],
      course2ren: [
        "course_2ren",
        "course_2ren_3y",
        "course_2",
        "course_stats_3y",
        "course3y"
      ],
      course3ren: [
        "course_3ren",
        "course_3ren_3y",
        "course_3",
        "course_stats_3y",
        "course3y"
      ],
      kimarite: [
        "kimarite",
        "course_kimarite",
        "kimarite_3y",
        "course_stats_3y",
        "course3y"
      ]
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
          const v = pickNumber(courseObj, [
            "avg_st", "st", "st_avg", "average_st", "start_average"
          ]);
          return formatST(v);
        }

        if (kind === "course2ren") {
          const v = pickNumber(courseObj, [
            "rate2", "ren2", "two", "two_rate", "niren", "niren_rate", "percent_2"
          ]);
          return formatRate(v);
        }

        if (kind === "course3ren") {
          const v = pickNumber(courseObj, [
            "rate3", "ren3", "three", "three_rate", "sanren", "sanren_rate", "percent_3"
          ]);
          return formatRate(v);
        }
      }

      if (kind === "kimarite") {
        return courseObj || bucket;
      }
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
    const v = pickNumber(boat, [
      "avg_st", "st_avg", "ave_st", "average_st", "start_average"
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

  const getRecentValue = (boat) => {
    const v = pickValue(boat, [
      "recent_index",
      "recent_score",
      "recent_rate",
      "last12m_rate",
      "last24m_rate",
      "recent_data"
    ]);

    if (v !== "") return formatDash(v);

    return "—";
  };

  const renderHeader = () => {
    const boats = getBoatsOrdered();

    return `
      <div class="courseDataGridHead">
        ${boats.map((boat) => `
          <div class="courseDataGridHead__waku w${esc(boat.waku)}">${esc(boat.waku)}</div>
        `).join("")}
      </div>
      <div class="courseDataGridNames">
        ${boats.map((boat) => `
          <div class="courseDataGridName">${esc(getBoatName(boat))}</div>
        `).join("")}
      </div>
    `;
  };

  const renderSingleRow = (valueGetter, isSmall = false) => {
    const boats = getBoatsOrdered();

    return `
      <div class="courseDataGridRow">
        ${boats.map((boat) => `
          <div class="courseDataGridCell${isSmall ? " courseDataGridCell--small" : ""}">
            ${esc(valueGetter(boat))}
          </div>
        `).join("")}
      </div>
    `;
  };

  const renderCourseRows = (valueGetter, isSmall = false) => {
    const boats = getBoatsOrdered();

    return [1, 2, 3, 4, 5, 6].map((courseNo) => `
      <div class="courseDataGridRow is-course">
        <div class="courseDataGridCourseLabel">${courseNo}コース</div>
        ${boats.map((boat) => `
          <div class="courseDataGridCell${isSmall ? " courseDataGridCell--small" : ""}">
            ${esc(valueGetter(boat, courseNo))}
          </div>
        `).join("")}
      </div>
    `).join("");
  };

  const renderAvgSt = () => {
    return `
      <div class="courseDataGridWrap">
        ${renderHeader()}
        ${renderSingleRow((boat) => getAvgStValue(boat))}
      </div>
    `;
  };

  const renderMeetAvgSt = () => {
    return `
      <div class="courseDataGridWrap">
        ${renderHeader()}
        ${renderSingleRow((boat) => getMeetAvgStValue(boat))}
      </div>
    `;
  };

  const renderRecent = () => {
    return `
      <div class="courseDataGridWrap">
        ${renderHeader()}
        ${renderSingleRow((boat) => getRecentValue(boat), true)}
      </div>
    `;
  };

  const renderCourseAvgSt = () => {
    return `
      <div class="courseDataGridWrap">
        ${renderHeader()}
        ${renderCourseRows((boat, courseNo) => getCourseCell(boat, courseNo, "avgSt"), true)}
      </div>
    `;
  };

  const renderCourse2ren = () => {
    return `
      <div class="courseDataGridWrap">
        ${renderHeader()}
        ${renderCourseRows((boat, courseNo) => getCourseCell(boat, courseNo, "course2ren"), true)}
      </div>
    `;
  };

  const renderCourse3ren = () => {
    return `
      <div class="courseDataGridWrap">
        ${renderHeader()}
        ${renderCourseRows((boat, courseNo) => getCourseCell(boat, courseNo, "course3ren"), true)}
      </div>
    `;
  };

  const renderKimarite = () => {
    const rows = [
      { label: "差し", key: "sashi" },
      { label: "まくり", key: "makuri" },
      { label: "まく差", key: "makurizashi" }
    ];

    const boats = getBoatsOrdered();

    return `
      <div class="courseDataGridWrap">
        ${renderHeader()}
        ${rows.map((row) => `
          <div class="courseDataGridRow is-course">
            <div class="courseDataGridCourseLabel">${esc(row.label)}</div>
            ${boats.map((boat) => `
              <div class="courseDataGridCell courseDataGridCell--small">
                ${esc(getKimariteCell(boat, row.key))}
              </div>
            `).join("")}
          </div>
        `).join("")}
      </div>
    `;
  };

  const renderBodyByTab = () => {
    switch (state.activeTab) {
      case "avgSt":
        return renderAvgSt();
      case "meetAvgSt":
        return renderMeetAvgSt();
      case "recent":
        return renderRecent();
      case "courseAvgSt":
        return renderCourseAvgSt();
      case "kimarite":
        return renderKimarite();
      case "course2ren":
        return renderCourse2ren();
      case "course3ren":
        return renderCourse3ren();
      default:
        return renderAvgSt();
    }
  };

  const bindTabEvents = (root) => {
    root.querySelectorAll(".courseSideTab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextKey = btn.dataset.courseKey || "avgSt";
        state.activeTab = nextKey;
        renderRoot();
      });
    });
  };

  const renderRoot = () => {
    const root = $("courseDataRoot");
    if (!root) return;

    root.innerHTML = `
      <div class="coursePanel">
        <div class="coursePanelMain">
          <div class="coursePanelTitle">コースデータ</div>
          <div class="coursePanelBody">
            ${renderBodyByTab()}
          </div>
        </div>

        <div class="coursePanelSide" aria-label="コースデータ項目">
          ${TAB_DEFS.map((tab) => `
            <button
              type="button"
              class="courseSideTab${tab.key === state.activeTab ? " is-active" : ""}"
              data-course-key="${esc(tab.key)}"
            >
              ${esc(tab.label)}
            </button>
          `).join("")}
        </div>
      </div>
    `;

    bindTabEvents(root);
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