(() => {
  const TAB_DEFS = [
    { key: "waku", label: "枠", rowClass: "courseGridRow--waku" },
    { key: "name", label: "選手名", rowClass: "courseGridRow--name" },
    { key: "grade", label: "級", rowClass: "courseGridRow--grade" },
    { key: "f", label: "F", rowClass: "courseGridRow--f" },
    { key: "l", label: "L", rowClass: "courseGridRow--l" },
    { key: "avgSt", label: "平均ST", rowClass: "courseGridRow--avgst" },
    { key: "meetAvgSt", label: "今節平均ST", rowClass: "courseGridRow--meetavgst" },
    { key: "recent", label: "近況データ", rowClass: "courseGridRow--recent" },
    { key: "courseAvgSt", label: "コース別平均ST", rowClass: "courseGridRow--course" },
    { key: "kimarite", label: "決まり手", rowClass: "courseGridRow--kimarite" },
    { key: "course2ren", label: "コース別2連対率", rowClass: "courseGridRow--course" },
    { key: "course3ren", label: "コース別3連対率", rowClass: "courseGridRow--course" }
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
    return v !== "" ? formatDash(v) : "—";
  };

  const getGradeText = (boat) => {
    return formatDash(boat?.grade || "—");
  };

  const getFText = (boat) => {
    return formatDash(pickValue(boat, ["f_count", "f", "F", "f_num"]) || "—");
  };

  const getLText = (boat) => {
    return formatDash(pickValue(boat, ["l_count", "l", "L", "l_num"]) || "—");
  };

  const renderHeader = (boats) => {
    return `
      <div class="courseGridHeader">
        ${boats.map((boat) => `
          <div class="courseGridHeaderCell w${esc(boat.waku)}">${esc(boat.waku)}</div>
        `).join("")}
      </div>
    `;
  };

  const renderRow = (rowHtml, rowClass, tabLabel) => {
    return `
      <div class="courseGridRow ${rowClass}" data-row-key="${esc(tabLabel)}">
        ${rowHtml}
      </div>
    `;
  };

  const renderMainGrid = () => {
    const boats = getBoatsOrdered();

    return `
      <div class="courseGrid">
        ${renderHeader(boats)}

        ${renderRow(
          boats.map((boat) => `
            <div class="courseGridCell courseGridCell--waku">
              <div class="courseGridWakuInner w${esc(boat.waku)}">${esc(boat.waku)}</div>
            </div>
          `).join(""),
          "courseGridRow--waku",
          "waku"
        )}

        ${renderRow(
          boats.map((boat) => `
            <div class="courseGridCell courseGridCell--name">
              <div class="courseGridNameVertical">${esc(formatDash(boat?.name || "—"))}</div>
            </div>
          `).join(""),
          "courseGridRow--name",
          "name"
        )}

        ${renderRow(
          boats.map((boat) => `
            <div class="courseGridCell courseGridCell--grade">
              <div class="courseGridGradeBlock">
                <div class="courseGridGradeMain">${esc(getGradeText(boat))}</div>
              </div>
            </div>
          `).join(""),
          "courseGridRow--grade",
          "grade"
        )}

        ${renderRow(
          boats.map((boat) => `
            <div class="courseGridCell">
              <div class="courseGridMetric courseGridMetric--small">${esc(getFText(boat))}</div>
            </div>
          `).join(""),
          "courseGridRow--f",
          "f"
        )}

        ${renderRow(
          boats.map((boat) => `
            <div class="courseGridCell">
              <div class="courseGridMetric courseGridMetric--small">${esc(getLText(boat))}</div>
            </div>
          `).join(""),
          "courseGridRow--l",
          "l"
        )}

        ${renderRow(
          boats.map((boat) => `
            <div class="courseGridCell">
              <div class="courseGridMetric">${esc(getAvgStValue(boat))}</div>
            </div>
          `).join(""),
          "courseGridRow--avgst",
          "avgSt"
        )}

        ${renderRow(
          boats.map((boat) => `
            <div class="courseGridCell">
              <div class="courseGridMetric">${esc(getMeetAvgStValue(boat))}</div>
            </div>
          `).join(""),
          "courseGridRow--meetavgst",
          "meetAvgSt"
        )}

        ${renderRow(
          boats.map((boat) => `
            <div class="courseGridCell">
              <div class="courseGridMetric courseGridMetric--small">${esc(getRecentValue(boat))}</div>
            </div>
          `).join(""),
          "courseGridRow--recent",
          "recent"
        )}

        ${[1,2,3,4,5,6].map((courseNo) => renderRow(
          boats.map((boat, idx) => {
            if (idx === 0) {
              return `
                <div class="courseGridCell">
                  <div class="courseGridCourseLabel">${courseNo}コース</div>
                </div>
              `;
            }
            return `
              <div class="courseGridCell">
                <div class="courseGridMetric courseGridMetric--small">${esc(getCourseCell(boat, courseNo, "avgSt"))}</div>
              </div>
            `;
          }).join(""),
          "courseGridRow--course",
          "courseAvgSt"
        )).join("")}

        ${[
          { label: "差し", key: "sashi" },
          { label: "まくり", key: "makuri" },
          { label: "まく差", key: "makurizashi" }
        ].map((row) => renderRow(
          boats.map((boat, idx) => {
            if (idx === 0) {
              return `
                <div class="courseGridCell">
                  <div class="courseGridCourseLabel">${esc(row.label)}</div>
                </div>
              `;
            }
            return `
              <div class="courseGridCell">
                <div class="courseGridMetric courseGridMetric--small">${esc(getKimariteCell(boat, row.key))}</div>
              </div>
            `;
          }).join(""),
          "courseGridRow--kimarite",
          "kimarite"
        )).join("")}

        ${[1,2,3,4,5,6].map((courseNo) => renderRow(
          boats.map((boat, idx) => {
            if (idx === 0) {
              return `
                <div class="courseGridCell">
                  <div class="courseGridCourseLabel">${courseNo}コース</div>
                </div>
              `;
            }
            return `
              <div class="courseGridCell">
                <div class="courseGridMetric courseGridMetric--small">${esc(getCourseCell(boat, courseNo, "course2ren"))}</div>
              </div>
            `;
          }).join(""),
          "courseGridRow--course",
          "course2ren"
        )).join("")}

        ${[1,2,3,4,5,6].map((courseNo) => renderRow(
          boats.map((boat, idx) => {
            if (idx === 0) {
              return `
                <div class="courseGridCell">
                  <div class="courseGridCourseLabel">${courseNo}コース</div>
                </div>
              `;
            }
            return `
              <div class="courseGridCell">
                <div class="courseGridMetric courseGridMetric--small">${esc(getCourseCell(boat, courseNo, "course3ren"))}</div>
              </div>
            `;
          }).join(""),
          "courseGridRow--course",
          "course3ren"
        )).join("")}
      </div>
    `;
  };

  const bindTabEvents = (root) => {
    const allRows = root.querySelectorAll(".courseGridRow");

    root.querySelectorAll(".courseSideTab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextKey = btn.dataset.courseKey || "avgSt";
        state.activeTab = nextKey;

        root.querySelectorAll(".courseSideTab").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.courseKey === nextKey);
        });

        const target = Array.from(allRows).find((row) => row.dataset.rowKey === nextKey);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
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
          <div class="coursePanelBody" id="coursePanelBody">
            ${renderMainGrid()}
          </div>
        </div>

        <div class="coursePanelSide" aria-label="コースデータ項目">
          ${TAB_DEFS.map((tab) => `
            <button
              type="button"
              class="courseSideTab${tab.key === state.activeTab ? " is-active" : ""}"
              data-course-key="${esc(tab.key)}"
              style="height:${getRowHeight(tab.rowClass)}px"
            >
              ${esc(tab.label)}
            </button>
          `).join("")}
        </div>
      </div>
    `;

    bindTabEvents(root);
  };

  const getRowHeight = (rowClass) => {
    switch (rowClass) {
      case "courseGridRow--waku": return 54;
      case "courseGridRow--name": return 146;
      case "courseGridRow--grade": return 70;
      case "courseGridRow--f":
      case "courseGridRow--l":
      case "courseGridRow--avgst":
      case "courseGridRow--meetavgst":
      case "courseGridRow--recent":
      case "courseGridRow--course":
      case "courseGridRow--kimarite":
        return 52;
      default:
        return 52;
    }
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