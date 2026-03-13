(() => {
  const ORDER = [6, 5, 4, 3, 2, 1];

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
    if (!Number.isFinite(n)) return "—";
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
      course1y: [
        "course_stats_1y",
        "course_1y",
        "course_recent_1y",
        "course_recent",
        "course_stats_recent"
      ],
      avgSt: [
        "course_avg_st",
        "course_st",
        "course_st_1y",
        "course_avg_st_1y",
        "course_stats_1y",
        "course1y",
        "course_stats_3y",
        "course3y"
      ],
      course2ren: [
        "course_2ren",
        "course_2ren_1y",
        "course_2",
        "course_stats_1y",
        "course1y",
        "course_stats_3y",
        "course3y"
      ],
      course3ren: [
        "course_3ren",
        "course_3ren_1y",
        "course_3",
        "course_stats_1y",
        "course1y",
        "course_stats_3y",
        "course3y"
      ],
      kimarite: [
        "kimarite",
        "course_kimarite",
        "kimarite_1y",
        "course_stats_1y",
        "course1y",
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
        if (kind === "course1y") {
          const v = pickNumber(courseObj, [
            "starts", "count", "race_count", "shusso", "出走数"
          ]);
          return formatCount(v);
        }

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
    }

    if (kind === "course1y") {
      const v = pickNumber(boat, [
        `course${courseNo}_starts`,
        `course_${courseNo}_starts`,
        `course${courseNo}_count`,
        `course_${courseNo}_count`
      ]);
      return formatCount(v);
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

  const getGradeText = (boat) => formatDash(boat?.grade || "—");
  const getFText = (boat) => formatDash(pickValue(boat, ["f_count", "f", "F", "f_num"]) || "—");
  const getLText = (boat) => formatDash(pickValue(boat, ["l_count", "l", "L", "l_num"]) || "—");

  const renderTopRow = (boats, key, label, valueFn, extraClass = "") => `
    <div class="courseGridRow ${extraClass}" data-row-key="${esc(key)}">
      ${boats.map((boat) => `
        <div class="courseGridCell">
          <div class="courseGridMetric">${esc(valueFn(boat))}</div>
        </div>
      `).join("")}
      <button type="button" class="courseGridCell courseGridLabel${state.activeGroup === key ? " is-active" : ""}" data-group-key="${esc(key)}">${esc(label)}</button>
    </div>
  `;

  const renderTopNameRow = (boats) => `
    <div class="courseGridRow courseGridRow--name" data-row-key="name">
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--name">
          <div class="courseGridNameVertical">${esc(formatDash(boat?.name || "—"))}</div>
        </div>
      `).join("")}
      <button type="button" class="courseGridCell courseGridLabel${state.activeGroup === "name" ? " is-active" : ""}" data-group-key="name">選手名</button>
    </div>
  `;

  const renderTopGradeRow = (boats) => `
    <div class="courseGridRow courseGridRow--grade" data-row-key="grade">
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--grade">
          <div class="courseGridGradeBlock">
            <div class="courseGridGradeMain">${esc(getGradeText(boat))}</div>
          </div>
        </div>
      `).join("")}
      <button type="button" class="courseGridCell courseGridLabel${state.activeGroup === "grade" ? " is-active" : ""}" data-group-key="grade">級</button>
    </div>
  `;

  const renderHeadRow = (boats) => `
    <div class="courseGridRow courseGridRow--head courseGridRow--top" data-row-key="waku">
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--head w${esc(boat.waku)}">${esc(boat.waku)}</div>
      `).join("")}
      <button type="button" class="courseGridCell courseGridLabel${state.activeGroup === "waku" ? " is-active" : ""}" data-group-key="waku">枠</button>
    </div>
  `;

  const renderCourseSectionTitle = (label, groupKey) => `
    <div class="courseGridRow courseGridRow--section" data-row-key="${esc(groupKey)}">
      <div class="courseGridSectionTitle" style="grid-column:1 / 7;">${esc(label)}</div>
      <button type="button" class="courseGridCell courseGridLabel courseGridLabel--section${state.activeGroup === groupKey ? " is-active" : ""}" data-group-key="${esc(groupKey)}">${esc(label)}</button>
    </div>
  `;

  const renderCourseRows = (boats, groupKey, valueType, titleLabel) => `
    ${renderCourseSectionTitle(titleLabel, groupKey)}
    ${[1, 2, 3, 4, 5, 6].map((courseNo, idx) => `
      <div class="courseGridRow courseGridRow--course" data-row-key="${esc(idx === 0 ? groupKey + '-1' : groupKey + '-' + courseNo)}">
        ${boats.map((boat) => `
          <div class="courseGridCell">
            <div class="courseGridMetric courseGridMetric--small">${esc(getCourseCell(boat, courseNo, valueType))}</div>
          </div>
        `).join("")}
        <div class="courseGridCell courseGridSubLabel">${courseNo}コース</div>
      </div>
    `).join("")}
  `;

  const renderKimariteRows = (boats) => `
    ${renderCourseSectionTitle("コース別決まり手", "kimarite")}
    ${[
      { label: "差し", key: "sashi" },
      { label: "まくり", key: "makuri" },
      { label: "まく差", key: "makurizashi" }
    ].map((row, idx) => `
      <div class="courseGridRow courseGridRow--kimarite" data-row-key="${esc(idx === 0 ? 'kimarite-1' : 'kimarite-' + row.key)}">
        ${boats.map((boat) => `
          <div class="courseGridCell">
            <div class="courseGridMetric courseGridMetric--small">${esc(getKimariteCell(boat, row.key))}</div>
          </div>
        `).join("")}
        <div class="courseGridCell courseGridSubLabel">${esc(row.label)}</div>
      </div>
    `).join("")}
  `;

  const renderMainGrid = () => {
    const boats = getBoatsOrdered();

    return `
      <div class="courseGrid">
        <div class="courseGridTopBlock">
          ${renderHeadRow(boats)}
          ${renderTopNameRow(boats)}
          ${renderTopGradeRow(boats)}
          ${renderTopRow(boats, "f", "F", getFText, "courseGridRow--top courseGridRow--f")}
          ${renderTopRow(boats, "l", "L", getLText, "courseGridRow--top courseGridRow--l")}
          ${renderTopRow(boats, "avgSt", "平均ST", getAvgStValue, "courseGridRow--top courseGridRow--avgst")}
          ${renderTopRow(boats, "meetAvgSt", "今節平均ST", getMeetAvgStValue, "courseGridRow--top courseGridRow--meetavgst")}
        </div>

        ${renderCourseRows(boats, "course1y", "course1y", "直近1年コースデータ")}
        ${renderKimariteRows(boats)}
        ${renderCourseRows(boats, "courseAvgSt", "avgSt", "コース別平均ST")}
        ${renderCourseRows(boats, "course2ren", "course2ren", "コース別2連対")}
        ${renderCourseRows(boats, "course3ren", "course3ren", "コース別3連対")}
      </div>
    `;
  };

  const scrollToGroup = (root, groupKey) => {
    const panelBody = root.querySelector("#coursePanelBody");
    if (!panelBody) return;

    let selector = `[data-row-key="${groupKey}"]`;
    if (groupKey === "course1y") selector = `[data-row-key="course1y"]`;
    if (groupKey === "kimarite") selector = `[data-row-key="kimarite"]`;
    if (groupKey === "courseAvgSt") selector = `[data-row-key="courseAvgSt"]`;
    if (groupKey === "course2ren") selector = `[data-row-key="course2ren"]`;
    if (groupKey === "course3ren") selector = `[data-row-key="course3ren"]`;

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