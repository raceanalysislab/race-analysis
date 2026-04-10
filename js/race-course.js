(() => {
  const ORDER = [1, 2, 3, 4, 5, 6];
  const RACER_GENDER_URL = "https://boatcore.jp/data/master/racer_gender.json";

  const state = {
    raceJson: null,
    genderMap: {},
    trendOrder: [...ORDER],
    drag: {
      timer: null,
      longPressMs: 260,
      moveCancelPx: 18,
      activeWaku: null,
      hoverCourse: null,
      startX: 0,
      startY: 0,
      pointerX: 0,
      pointerY: 0,
      started: false,
      ghostEl: null
    }
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

  const formatDash = (v) => (v === undefined || v === null || v === "" ? "—" : String(v));

  const formatST = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  };

  const formatRate = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
  };

  const formatKimarite = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? String(Math.round(n)) : "—";
  };

  const formatStarts = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? String(Math.trunc(n)) : "—";
  };

  const normalizeName = (name) => String(name ?? "").replace(/\s+/g, "").trim();

  const isKetsujoLike = (v) => {
    const s = String(v ?? "").trim().toUpperCase();
    return s === "欠" || s === "K" || /^K\d*$/.test(s);
  };

  const isLateLike = (v) => {
    const s = String(v ?? "").trim().toUpperCase();
    return s === "L" || /^L\d*$/.test(s);
  };

  const isShikkakuLike = (v) => {
    const s = String(v ?? "").trim().toUpperCase();
    return s === "失" || s === "失格" || /^S\d*$/.test(s);
  };

  const isFlyingLike = (v) => {
    const s = String(v ?? "").trim().toUpperCase();
    return s === "F";
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
      if (waku >= 1 && waku <= 6) byWaku.set(waku, boat);
    });

    return ORDER.map((waku) => byWaku.get(waku) || { waku, name: "—", grade: "—" });
  };

  const getBoatByWaku = (waku) =>
    getBoatsOrdered().find((b) => Number(b?.waku) === Number(waku)) || null;

  const getTrendBoats = () => {
    const byWaku = new Map(getBoatsOrdered().map((b) => [Number(b?.waku), b]));
    return state.trendOrder.map((waku, idx) => ({
      ...(byWaku.get(Number(waku)) || { waku, name: "—", grade: "—" }),
      displayCourse: idx + 1
    }));
  };

  const moveTrendBoat = (fromWaku, toCourse) => {
    const from = Number(fromWaku);
    const to = Number(toCourse);
    if (!(from >= 1 && from <= 6) || !(to >= 1 && to <= 6)) return false;

    const list = state.trendOrder.slice();
    const fromIdx = list.indexOf(from);
    const toIdx = to - 1;
    if (fromIdx < 0 || fromIdx === toIdx) return false;

    list.splice(fromIdx, 1);
    list.splice(toIdx, 0, from);
    state.trendOrder = list;
    return true;
  };

  const getAvgStValue = (boat) =>
    formatST(pickNumber(boat, ["avg_st", "st_avg", "ave_st", "average_st", "start_average"]));

  const getMeetAvgStValue = (boat) =>
    formatST(pickNumber(boat, [
      "meet_avg_st",
      "this_meet_avg_st",
      "this_series_avg_st",
      "series_avg_st",
      "season_avg_st",
      "recent_meet_st"
    ]));

  const getCourseStartsText = (boat) =>
    formatStarts(pickValue(boat, [
      "course_starts_1y",
      "course_start_count_1y",
      "course_count_1y",
      "starts_1y",
      "course_starts",
      "course_start_count",
      "course_count",
      "starts"
    ]));

  const getGradeClass = (boat) => {
    const g = String(boat?.grade ?? "").trim().toUpperCase();
    return ["A1", "A2", "B1", "B2"].includes(g) ? `grade-${g}` : "";
  };

  const getWakuClass = (boat) => {
    const w = Number(boat?.waku);
    return w >= 1 && w <= 6 ? `w${w}` : "";
  };

  const getFText = (boat) => formatDash(pickValue(boat, ["f_count", "f", "F", "f_num"]) || "—");
  const getLText = (boat) => formatDash(pickValue(boat, ["l_count", "l", "L", "l_num"]) || "—");

  const getCourseWinText = (boat) =>
    formatRate(pickValue(boat, [
      "course_win_1y",
      "course_win_rate_1y",
      "course_1着率_1y",
      "course_win",
      "course_win_rate",
      "course_1着率",
      "course_win_3y"
    ]));

  const getCourseKimariteParts = (boat) => ({
    sashi: formatKimarite(pickValue(boat, [
      "course_sashi_1y", "course_kimarite_sashi_1y", "kimarite_sashi_1y",
      "sashi_rate_1y", "course_sashi", "course_kimarite_sashi",
      "kimarite_sashi", "sashi_rate"
    ])),
    makuri: formatKimarite(pickValue(boat, [
      "course_makuri_1y", "course_kimarite_makuri_1y", "kimarite_makuri_1y",
      "makuri_rate_1y", "course_makuri", "course_kimarite_makuri",
      "kimarite_makuri", "makuri_rate"
    ])),
    makurisashi: formatKimarite(pickValue(boat, [
      "course_makurisashi_1y", "course_kimarite_makurisashi_1y", "kimarite_makurisashi_1y",
      "makurisashi_rate_1y", "course_makurisashi", "course_kimarite_makurisashi",
      "kimarite_makurisashi", "makurisashi_rate"
    ]))
  });

  const getCourseAvgStText = (boat) => {
    const v = pickValue(boat, [
      "course_avg_st_1y", "course_st_1y", "course_avg_st", "course_st", "course_avg_st_3y"
    ]);
    if (typeof v === "object" || v === "" || v === null || v === undefined) return "—";
    const n = Number(v);
    return Number.isFinite(n) ? formatST(n) : formatDash(v);
  };

  const getCourse2renText = (boat) =>
    formatRate(pickValue(boat, ["course_2ren_1y", "course_2_1y", "course_2ren", "course_2", "course_2ren_3y"]));

  const getCourse3renText = (boat) =>
    formatRate(pickValue(boat, ["course_3ren_1y", "course_3_1y", "course_3ren", "course_3", "course_3ren_3y"]));

  const renderHeadRow = (boats) => `
    <div class="courseGridRow courseGridRow--head">
      <div class="courseGridLabel">枠</div>
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--head ${esc(getWakuClass(boat))}">
          ${esc(boat.waku)}
        </div>
      `).join("")}
    </div>
  `;

  const renderNameRow = (boats) => `
    <div class="courseGridRow courseGridRow--name">
      <div class="courseGridLabel">選手名</div>
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
    </div>
  `;

  const renderGradeRow = (boats) => `
    <div class="courseGridRow courseGridRow--grade">
      <div class="courseGridLabel">級</div>
      ${boats.map((boat) => `
        <div class="courseGridCell courseGridCell--grade ${esc(getWakuClass(boat))} ${esc(getGradeClass(boat))}">
          <div class="courseGrade ${esc(getGradeClass(boat))}">${esc(formatDash(boat?.grade || "—"))}</div>
        </div>
      `).join("")}
    </div>
  `;

  const renderSimpleRow = (boats, label, valueFn, rowClass = "") => `
    <div class="courseGridRow ${rowClass}">
      <div class="courseGridLabel">${esc(label)}</div>
      ${boats.map((boat) => `
        <div class="courseGridCell">
          <div class="courseGridMetric">${esc(valueFn(boat))}</div>
        </div>
      `).join("")}
    </div>
  `;

  const renderFLRow = (boats) => `
    <div class="courseGridRow courseGridRow--fl">
      <div class="courseGridLabel">F/L</div>
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
    </div>
  `;

  const renderCourseWinRow = (boats) => `
    <div class="courseGridRow courseGridRow--course">
      <div class="courseGridLabel">コース別勝率</div>
      ${boats.map((boat) => `
        <div class="courseGridCell"><div class="courseGridMetric">${esc(getCourseWinText(boat))}</div></div>
      `).join("")}
    </div>
  `;

  const renderKimariteRow = (boats) => `
    <div class="courseGridRow courseGridRow--kimarite">
      <div class="courseGridLabel">コース別決まり手</div>
      ${boats.map((boat) => {
        const parts = getCourseKimariteParts(boat);
        return `
          <div class="courseGridCell courseGridCell--kimarite">
            <div class="courseKimariteBox">
              <div class="courseKimariteCol"><div class="courseKimariteHead">差</div><div class="courseKimariteVal">${esc(parts.sashi)}</div></div>
              <div class="courseKimariteCol"><div class="courseKimariteHead">捲</div><div class="courseKimariteVal">${esc(parts.makuri)}</div></div>
              <div class="courseKimariteCol"><div class="courseKimariteHead">捲差</div><div class="courseKimariteVal">${esc(parts.makurisashi)}</div></div>
            </div>
          </div>
        `;
      }).join("")}
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
        ${renderSimpleRow(boats, "コース別出走数", getCourseStartsText, "courseGridRow--starts")}
        ${renderCourseWinRow(boats)}
        ${renderKimariteRow(boats)}
        ${renderSimpleRow(boats, "コース別平均ST", getCourseAvgStText, "courseGridRow--course")}
        ${renderSimpleRow(boats, "コース別2連対", getCourse2renText, "courseGridRow--course")}
        ${renderSimpleRow(boats, "コース別3連対", getCourse3renText, "courseGridRow--course")}
      </div>
    `;
  };

  const getRecentRawResult = (rec) => {
    const result = String(rec?.result ?? "").trim().toUpperCase();
    if (result) return result;

    const rank = String(rec?.rank ?? rec?.finish ?? "").trim().toUpperCase();
    if (rank) return rank;

    const finishRaw = String(rec?.finish_raw ?? "").trim().toUpperCase();
    return finishRaw || "";
  };

  const formatRecentRank = (rec) => {
    const s = getRecentRawResult(rec);
    if (!s) return "—";
    if (isFlyingLike(s)) return "F";
    if (isLateLike(s)) return "L";
    if (isShikkakuLike(s)) return "失";
    if (isKetsujoLike(s)) return "欠";
    if (/^\d+$/.test(s)) return String(Number(s));
    return s;
  };

  const formatRecentSt = (rec) => {
    const rawResult = getRecentRawResult(rec);

    if (
      !rawResult ||
      isLateLike(rawResult) ||
      isShikkakuLike(rawResult) ||
      isKetsujoLike(rawResult)
    ) {
      return "—";
    }

    const rawSt = rec?.st_raw ?? rec?.st ?? "";
    if (rawSt === undefined || rawSt === null || rawSt === "") return "—";

    const s = String(rawSt).trim().toUpperCase();
    if (!s) return "—";

    const cleaned = s.replace(/^F/, "");

    if (cleaned.startsWith(".")) return cleaned;

    const n = Number(cleaned);
    if (Number.isFinite(n)) return `.${n.toFixed(2).split(".")[1]}`;

    if (isFlyingLike(rawResult) && /^F\d+\.\d{2}$/.test(s)) {
      return s.replace(/^F/, "");
    }

    return "—";
  };

  const parseTrendRank = (rec) => {
    const s = getRecentRawResult(rec);
    if (!s) return null;
    if (isFlyingLike(s) || isLateLike(s) || isKetsujoLike(s) || isShikkakuLike(s)) return null;

    const n = Number(s);
    if (Number.isFinite(n) && n >= 1 && n <= 6) return n;

    return null;
  };

  const getTrendBundle = (boat, mode = "all") => {
    const selectedCourse = String(Number(boat?.displayCourse || boat?.waku || 1));

    if (mode === "local") {
      const byCourse = boat?.waku_recent_local_by_course;
      const avgByCourse = boat?.waku_recent_local_avg_st_by_course;
      if (byCourse && typeof byCourse === "object") {
        return {
          rows: Array.isArray(byCourse[selectedCourse]) ? byCourse[selectedCourse] : [],
          avgSt: avgByCourse?.[selectedCourse]
        };
      }
      return {
        rows: Array.isArray(boat?.waku_recent_local) ? boat.waku_recent_local : [],
        avgSt: boat?.waku_recent_local_avg_st
      };
    }

    const byCourse = boat?.waku_recent_by_course;
    const avgByCourse = boat?.waku_recent_avg_st_by_course;
    if (byCourse && typeof byCourse === "object") {
      return {
        rows: Array.isArray(byCourse[selectedCourse]) ? byCourse[selectedCourse] : [],
        avgSt: avgByCourse?.[selectedCourse]
      };
    }

    return {
      rows: Array.isArray(boat?.waku_recent) ? boat.waku_recent : [],
      avgSt: boat?.waku_recent_avg_st
    };
  };

  const getWakuRecentAvgStText = (boat, mode = "all") => {
    const n = Number(getTrendBundle(boat, mode)?.avgSt);
    return Number.isFinite(n) ? n.toFixed(2) : "—";
  };

  const getWakuScoreText = (boat, mode = "all") => {
    const rows = getTrendBundle(boat, mode)?.rows || [];
    const scoreMap = { 1: 10, 2: 8, 3: 6, 4: 4, 5: 2, 6: 0 };

    let sum = 0;
    let count = 0;

    for (const r of rows) {
      const rank = parseTrendRank(r);
      if (rank && scoreMap[rank] !== undefined) {
        sum += scoreMap[rank];
        count++;
      }
    }

    return count ? (sum / count).toFixed(2) : "—";
  };

  const getWakuRecentRecords = (boat, mode = "all") =>
    (getTrendBundle(boat, mode)?.rows || []).slice(0, 10);

  const getRecentWakuBadgeStyle = (waku) => {
    const c = Number(waku);
    if (c === 1) return "background:#ffffff;color:#111827;border:1px solid #d7dde5;";
    if (c === 2) return "background:#444b55;color:#ffffff;";
    if (c === 3) return "background:#ea5a50;color:#ffffff;";
    if (c === 4) return "background:#4d82d8;color:#ffffff;";
    if (c === 5) return "background:#e6d74a;color:#1e2430;";
    if (c === 6) return "background:#39b36b;color:#ffffff;";
    return "background:#f8fafc;color:#64748b;border:1px solid #d7dde5;";
  };

  const getWakuChipStyle = (waku) => {
    const c = Number(waku);
    if (c === 1) return "background:#ffffff;color:#111827;border-right:1px solid #d7dde5;";
    if (c === 2) return "background:#444b55;color:#ffffff;";
    if (c === 3) return "background:#ea5a50;color:#ffffff;";
    if (c === 4) return "background:#4d82d8;color:#ffffff;";
    if (c === 5) return "background:#e6d74a;color:#1e2430;";
    if (c === 6) return "background:#39b36b;color:#ffffff;";
    return "background:#f8fafc;color:#64748b;";
  };

  const renderDragHint = () => `
    <div style="padding:5px 8px;border-bottom:1px solid #d7dde5;background:#f8fafc;color:#64748b;font-size:10px;font-weight:700;line-height:1.3;">
      選手長押し→他コースへ移動可
    </div>
  `;

  const renderWakuTrendRows = (boats, mode = "all") => boats.map((boat) => {
    const records = getWakuRecentRecords(boat, mode);
    const isFemale = isFemaleRacer(boat);
    const originWaku = Number(boat?.waku) || "—";
    const displayCourse = Number(boat?.displayCourse) || originWaku;
    const isDragging = Number(state.drag.activeWaku) === Number(originWaku);

    const recentCells = Array.from({ length: 10 }, (_, idx) => {
      const rec = records[idx] || {};
      const badgeWaku = rec?.waku ?? rec?.boat ?? displayCourse;
      const course = rec?.course ?? rec?.boat ?? "—";
      const st = formatRecentSt(rec);
      const rank = formatRecentRank(rec);
      const rawResult = getRecentRawResult(rec);
      const isF = isFlyingLike(rawResult);

      return `
        <div style="flex:0 0 34px;min-width:34px;height:100%;display:flex;flex-direction:column;border-right:1px solid #d7dde5;background:#fff;margin-bottom:-1px;">
          <div style="height:14px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #e8edf3;font-size:9px;font-weight:800;color:#64748b;background:#f8fafc;">${idx + 1}</div>
          <div style="height:16px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #e8edf3;">
            <div style="width:20px;height:14px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;${getRecentWakuBadgeStyle(badgeWaku)}">${esc(course)}</div>
          </div>
          <div style="height:16px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#334155;border-bottom:1px solid #e8edf3;">${esc(st)}</div>
          <div style="height:14px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;line-height:1;color:${isF ? "#d83939" : "#0f172a"};padding-top:0;border-bottom:0;">${esc(rank)}</div>
        </div>
      `;
    }).join("");

    return `
      <div
        data-trend-row="1"
        data-display-course="${esc(displayCourse)}"
        style="
          display:grid;
          grid-template-columns:40px 108px minmax(0,1fr) 68px;
          border-bottom:1px solid #d7dde5;
          background:${isDragging ? "#eef4ff" : "#fff"};
          min-height:74px;
          opacity:${isDragging && state.drag.started ? "0.20" : "1"};
          transition:background .12s ease, opacity .12s ease;
        "
      >
        <div style="display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;line-height:1;border-right:1px solid #d7dde5;${getWakuChipStyle(displayCourse)}">
          ${esc(displayCourse)}
        </div>

        <div
          data-drag-handle="1"
          data-origin-waku="${esc(originWaku)}"
          style="
            padding:5px 5px;
            border-right:1px solid #d7dde5;
            display:flex;
            flex-direction:column;
            justify-content:center;
            align-items:center;
            text-align:center;
            min-width:0;
            position:relative;
            user-select:none;
            -webkit-user-select:none;
            -webkit-touch-callout:none;
            touch-action:none;
            ${isFemale ? "background:#ffe4ec;" : ""}
          "
        >
          <div style="position:absolute;top:4px;right:4px;font-size:9px;line-height:1;color:#94a3b8;font-weight:800;">⇅</div>
          <div style="font-size:9px;line-height:1.05;color:#6b7280;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">
            ${esc(formatDash(boat?.regno))} / ${esc(formatDash(boat?.branch))} / ${esc(formatDash(boat?.age))}歳
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:2px;width:100%;min-width:0;margin-top:2px;">
            ${isFemale ? '<span style="font-size:11px;line-height:1;color:#e2558f;font-weight:700;">♡</span>' : ""}
            <div style="font-size:13px;line-height:1.05;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">
              ${esc(normalizeName(boat?.name || "—"))}
            </div>
          </div>
          <div style="margin-top:3px;font-size:9px;font-weight:700;color:#64748b;line-height:1;">
            ${esc(originWaku)}号艇 → ${esc(displayCourse)}コース
          </div>
        </div>

        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border-right:0;">
          <div style="display:flex;align-items:stretch;min-width:max-content;height:100%;margin-right:-1px;">
            ${recentCells}
          </div>
        </div>

        <div style="display:grid;grid-template-rows:13px 20px 13px 20px;background:#fff;">
          <div style="display:flex;align-items:center;justify-content:center;border-bottom:1px solid #e8edf3;font-size:9px;font-weight:700;color:#64748b;line-height:1;background:#f8fafc;">平均ST</div>
          <div style="display:flex;align-items:center;justify-content:center;border-bottom:1px solid #d7dde5;font-size:13px;font-weight:800;color:#1d4ed8;line-height:1;">${esc(getWakuRecentAvgStText(boat, mode))}</div>
          <div style="display:flex;align-items:center;justify-content:center;border-bottom:1px solid #e8edf3;font-size:9px;font-weight:700;color:#64748b;line-height:1;background:#f8fafc;">勝率</div>
          <div style="display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#475569;line-height:1;">${esc(getWakuScoreText(boat, mode))}</div>
        </div>
      </div>
    `;
  }).join("");

  const renderWakuTrendGrid = (mode = "all") => `
    <div data-trend-root="${esc(mode)}" style="height:100%;display:flex;flex-direction:column;background:#fff;border-top:1px solid #d7dde5;border-bottom:1px solid #d7dde5;">
      ${renderDragHint()}
      <div style="flex:1 1 auto;min-height:0;overflow:auto hidden;-webkit-overflow-scrolling:touch;">
        ${renderWakuTrendRows(getTrendBoats(), mode)}
      </div>
    </div>
  `;

  const bindNameLinks = (root) => {
    root.querySelectorAll('[data-player-link="1"]').forEach((link) => {
      link.addEventListener("click", () => {});
    });
  };

  const removeGhost = () => {
    if (state.drag.ghostEl?.parentNode) {
      state.drag.ghostEl.parentNode.removeChild(state.drag.ghostEl);
    }
    state.drag.ghostEl = null;
  };

  const updateGhostPosition = (clientX, clientY) => {
    const ghost = state.drag.ghostEl;
    if (!ghost) return;
    const x = Math.max(8, Number(clientX || 0) - 100);
    const y = Math.max(8, Number(clientY || 0) - 36);
    ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const createGhost = (waku) => {
    removeGhost();
    const boat = getBoatByWaku(waku);
    if (!boat) return;

    const ghost = document.createElement("div");
    ghost.id = "boatcoreTrendGhost";
    ghost.style.position = "fixed";
    ghost.style.left = "12px";
    ghost.style.top = "0";
    ghost.style.width = "200px";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.background = isFemaleRacer(boat) ? "#ffe4ec" : "#eef4ff";
    ghost.style.border = "1px solid #93c5fd";
    ghost.style.borderRadius = "12px";
    ghost.style.boxShadow = "0 10px 28px rgba(15,23,42,.22)";
    ghost.style.padding = "10px 12px";
    ghost.style.transform = "translate3d(0,0,0)";
    ghost.style.opacity = "0.96";
    ghost.innerHTML = `
      <div style="font-size:10px;color:#64748b;font-weight:700;line-height:1.2;">
        ${esc(formatDash(boat?.regno))} / ${esc(formatDash(boat?.branch))} / ${esc(formatDash(boat?.age))}歳
      </div>
      <div style="margin-top:6px;font-size:16px;color:#0f172a;font-weight:800;line-height:1.2;">
        ${esc(normalizeName(boat?.name || "—"))}
      </div>
      <div style="margin-top:6px;font-size:11px;color:#475569;font-weight:700;">
        ${esc(boat?.waku)}号艇を移動中
      </div>
    `;
    document.body.appendChild(ghost);
    state.drag.ghostEl = ghost;
    updateGhostPosition(state.drag.pointerX || state.drag.startX, state.drag.pointerY || state.drag.startY);
  };

  const clearLongPressTimer = () => {
    if (state.drag.timer) {
      clearTimeout(state.drag.timer);
      state.drag.timer = null;
    }
  };

  const resetDragState = () => {
    clearLongPressTimer();
    removeGhost();
    state.drag.activeWaku = null;
    state.drag.hoverCourse = null;
    state.drag.startX = 0;
    state.drag.startY = 0;
    state.drag.pointerX = 0;
    state.drag.pointerY = 0;
    state.drag.started = false;
  };

  const getDisplayCourseFromPoint = (clientY) => {
    const rows = Array.from(document.querySelectorAll("[data-trend-row='1']")).filter((r) => {
      const rect = r.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (!rows.length) return null;

    for (const r of rows) {
      const rect = r.getBoundingClientRect();
      if (clientY < rect.top) {
        return Number(r.dataset.displayCourse || r.dataset["display-course"] || 0) || null;
      }
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return Number(r.dataset.displayCourse || r.dataset["display-course"] || 0) || null;
      }
    }

    const last = rows[rows.length - 1];
    return Number(last.dataset.displayCourse || last.dataset["display-course"] || rows.length) || rows.length;
  };

  const startLongPress = (waku, clientX, clientY) => {
    resetDragState();
    state.drag.activeWaku = Number(waku);
    state.drag.startX = Number(clientX || 0);
    state.drag.startY = Number(clientY || 0);
    state.drag.pointerX = Number(clientX || 0);
    state.drag.pointerY = Number(clientY || 0);

    state.drag.timer = setTimeout(() => {
      state.drag.started = true;
      state.drag.hoverCourse = state.trendOrder.indexOf(Number(waku)) + 1;
      document.body.style.overflow = "hidden";
      createGhost(waku);
    }, state.drag.longPressMs);
  };

  const handlePointerMove = (clientX, clientY) => {
    if (!state.drag.activeWaku) return;

    state.drag.pointerX = Number(clientX || 0);
    state.drag.pointerY = Number(clientY || 0);

    const dx = state.drag.pointerX - state.drag.startX;
    const dy = state.drag.pointerY - state.drag.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!state.drag.started) {
      if (absX > state.drag.moveCancelPx || absY > state.drag.moveCancelPx) {
        clearLongPressTimer();
      }
      return;
    }

    updateGhostPosition(clientX, clientY);

    const course = getDisplayCourseFromPoint(clientY);
    if (!(course >= 1 && course <= 6)) return;

    state.drag.hoverCourse = course;
  };

  const finishPointer = () => {
    const wasDragging = state.drag.started;
    const activeWaku = Number(state.drag.activeWaku);
    const hoverCourse = Number(state.drag.hoverCourse);

    if (wasDragging && activeWaku >= 1 && activeWaku <= 6 && hoverCourse >= 1 && hoverCourse <= 6) {
      moveTrendBoat(activeWaku, hoverCourse);
    }

    resetDragState();
    document.body.style.overflow = "";
    if (wasDragging) renderTrendRoots();
  };

  const bindTrendDrag = () => {
    document.querySelectorAll("[data-drag-handle='1']").forEach((el) => {
      el.addEventListener("touchstart", (e) => {
        const t = e.touches?.[0];
        if (!t) return;
        startLongPress(el.dataset.originWaku, t.clientX, t.clientY);
      }, { passive: true });

      el.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startLongPress(el.dataset.originWaku, e.clientX, e.clientY);
      });
    });
  };

  const renderTrendRoots = () => {
    const wakuRoot = $("wakuTrendRoot");
    const wakuLocalRoot = $("wakuTrendLocalRoot");

    if (wakuRoot) wakuRoot.innerHTML = renderWakuTrendGrid("all");
    if (wakuLocalRoot) wakuLocalRoot.innerHTML = renderWakuTrendGrid("local");

    bindTrendDrag();
  };

  const renderRoot = async () => {
    const courseRoot = $("courseDataRoot");
    if (courseRoot) {
      courseRoot.innerHTML = `
        <div class="coursePanel">
          <div class="coursePanelMain">
            <div class="coursePanelBody">
              ${renderMainGrid()}
            </div>
          </div>
        </div>
      `;
      bindNameLinks(courseRoot);
    }
    renderTrendRoots();
  };

  const renderLoading = () => {
    const courseRoot = $("courseDataRoot");
    const wakuRoot = $("wakuTrendRoot");
    const wakuLocalRoot = $("wakuTrendLocalRoot");
    if (courseRoot) courseRoot.innerHTML = `<div class="err">読み込み中…</div>`;
    if (wakuRoot) wakuRoot.innerHTML = `<div class="err">読み込み中…</div>`;
    if (wakuLocalRoot) wakuLocalRoot.innerHTML = `<div class="err">読み込み中…</div>`;
  };

  const renderError = () => {
    const courseRoot = $("courseDataRoot");
    const wakuRoot = $("wakuTrendRoot");
    const wakuLocalRoot = $("wakuTrendLocalRoot");
    if (courseRoot) courseRoot.innerHTML = `<div class="err">コースデータ取得失敗</div>`;
    if (wakuRoot) wakuRoot.innerHTML = `<div class="err">枠傾向データ取得失敗</div>`;
    if (wakuLocalRoot) wakuLocalRoot.innerHTML = `<div class="err">当地枠傾向データ取得失敗</div>`;
  };

  const fetchGenderMap = async () => {
    try {
      const res = await fetch(`${RACER_GENDER_URL}?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("gender fetch failed");
      state.genderMap = (await res.json()) || {};
    } catch {
      state.genderMap = {};
    }
  };

  const render = async (json) => {
    state.raceJson = json || null;
    state.trendOrder = [...ORDER];
    resetDragState();
    await fetchGenderMap();
    await renderRoot();
  };

  const boot = async () => {
    await renderRoot();
  };

  document.addEventListener("touchmove", (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    if (state.drag.started) e.preventDefault();
    handlePointerMove(t.clientX, t.clientY);
  }, { passive: false });

  document.addEventListener("mousemove", (e) => {
    handlePointerMove(e.clientX, e.clientY);
  });

  document.addEventListener("touchend", (e) => {
    if (state.drag.started) e.preventDefault();
    finishPointer();
  }, { passive: false });

  document.addEventListener("mouseup", finishPointer);
  document.addEventListener("touchcancel", finishPointer, { passive: false });
  document.addEventListener("mouseleave", finishPointer);

  document.addEventListener("click", (e) => {
    const tab = e.target.closest(".entryInnerTab[data-waku]");
    if (!tab) return;

    const idx = tab.dataset.waku;
    document.querySelectorAll('#wakuTabs .entryInnerTab').forEach((t) => t.classList.remove("is-active"));
    document.querySelectorAll('[data-waku-page]').forEach((p) => {
      p.style.display = p.dataset.wakuPage === idx ? "block" : "none";
    });
    tab.classList.add("is-active");
  });

  window.BOAT_CORE_COURSE = {
    boot,
    render,
    renderLoading,
    renderError
  };
})();
