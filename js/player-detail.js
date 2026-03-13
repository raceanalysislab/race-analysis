const qs = new URLSearchParams(location.search);

const playerName = decodeURIComponent(qs.get("name") || "選手情報");
const regno = String(qs.get("regno") || "").trim();
const grade = String(qs.get("grade") || "").trim();
const branch = String(qs.get("branch") || "").trim();
const age = String(qs.get("age") || "").trim();
const venue = decodeURIComponent(qs.get("venue") || "—");
const race = String(qs.get("race") || "").trim();
const date = String(qs.get("date") || "").trim();
const waku = Number(qs.get("waku") || 1);

const $ = (id) => document.getElementById(id);

$("playerName").textContent = playerName;
$("playerMetaInline").textContent = [regno, grade, branch, age ? `${age}歳` : ""].filter(Boolean).join(" / ");
$("playerVenue").textContent = venue || "—";
$("playerRace").textContent = race ? `${race}R` : "—R";
$("playerDate").textContent = date || "—";

$("btnBack").addEventListener("click", () => history.back());

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

const courseData = {
  1: { win: 77.7, ren2: 84.4, ren3: 88.8, type: "イン型", kimariteMain: "逃げ 94%", kimariteSub: "差し 2.7% / まくり 1.1%" },
  2: { win: 4.4,  ren2: 33.3, ren3: 55.5, type: "差し型", kimariteMain: "差し 58%", kimariteSub: "まくり 18% / 抜き 9%" },
  3: { win: 8.8,  ren2: 35.5, ren3: 57.7, type: "センター型", kimariteMain: "まくり 41%", kimariteSub: "まくり差し 21% / 差し 10%" },
  4: { win: 4.4,  ren2: 17.7, ren3: 31.1, type: "カド型", kimariteMain: "まくり 29%", kimariteSub: "差し 13% / まくり差し 8%" },
  5: { win: 2.2,  ren2: 22.2, ren3: 48.8, type: "アウト型", kimariteMain: "差し 16%", kimariteSub: "まくり差し 7% / 抜き 5%" },
  6: { win: 2.2,  ren2: 6.8,  ren3: 18.1, type: "大外型", kimariteMain: "差し 7%", kimariteSub: "まくり差し 3% / 抜き 1%" }
};

let selectedCourse = Math.min(6, Math.max(1, Number.isFinite(waku) ? waku : 1));

function makeCourseTabs(){
  const root = $("courseHeroTabs");
  if (!root) return;

  root.innerHTML = [1,2,3,4,5,6].map((n) => `
    <button
      type="button"
      class="courseHeroTab${n === selectedCourse ? " is-active" : ""}"
      data-course="${n}"
    >
      ${n}
    </button>
  `).join("");

  root.querySelectorAll(".courseHeroTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCourse = Number(btn.dataset.course || 1);
      makeCourseTabs();
      renderHeroCard();
    });
  });
}

function buildRadarGrid(){
  const g = $("courseRadarGrid");
  if (!g) return;

  const cx = 160;
  const cy = 150;
  const levels = [38, 66, 94, 122];
  const angles = [-90, -30, 30, 90, 150, 210].map((deg) => deg * Math.PI / 180);

  const ring = (r) => {
    return angles.map((a) => {
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      return `${x},${y}`;
    }).join(" ");
  };

  g.innerHTML = levels.map((r) => `<polygon points="${ring(r)}"></polygon>`).join("");

  angles.forEach((a) => {
    const x = cx + Math.cos(a) * 122;
    const y = cy + Math.sin(a) * 122;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", cx);
    line.setAttribute("y1", cy);
    line.setAttribute("x2", x);
    line.setAttribute("y2", y);
    g.appendChild(line);
  });
}

function buildRadarPolygon(){
  const polygon = $("courseRadarPolygon");
  if (!polygon) return;

  const values = [
    courseData[1].win,
    courseData[2].win,
    courseData[3].win,
    courseData[4].win,
    courseData[5].win,
    courseData[6].win
  ];

  const cx = 160;
  const cy = 150;
  const maxR = 110;
  const angles = [-90, -30, 30, 90, 150, 210].map((deg) => deg * Math.PI / 180);

  const points = values.map((v, i) => {
    const r = maxR * (Math.max(0, Math.min(100, v)) / 100);
    const x = cx + Math.cos(angles[i]) * r;
    const y = cy + Math.sin(angles[i]) * r;
    return `${x},${y}`;
  }).join(" ");

  polygon.setAttribute("points", points);
}

function renderHeroCard(){
  const data = courseData[selectedCourse] || courseData[1];

  $("selectedCourseTitle").textContent = `${selectedCourse}コース進入時`;
  $("selectedCourseType").textContent = data.type;
  $("courseTypePill").textContent = data.type;

  $("winRateText").textContent = `${data.win.toFixed(1)}%`;
  $("ren2RateText").textContent = `${data.ren2.toFixed(1)}%`;
  $("ren3RateText").textContent = `${data.ren3.toFixed(1)}%`;

  $("winRateFill").style.width = `${data.win}%`;
  $("ren2RateFill").style.width = `${data.ren2}%`;
  $("ren3RateFill").style.width = `${data.ren3}%`;

  $("kimariteMain").textContent = data.kimariteMain;
  $("kimariteSub").textContent = data.kimariteSub;
}

function makeCourseHeader(){
  const courses = [1,2,3,4,5,6];
  return `
    <div class="playerTableHead">
      <div class="playerTableHeadCell playerTableHeadCell--stub">
        <span>進入</span>
        <span>選択→</span>
      </div>
      ${courses.map((course) => `
        <div class="playerTableHeadCell">
          <div class="playerCourseName">${course}コース</div>
        </div>
      `).join("")}
    </div>
  `;
}

function valueRow(label, values, highlightFirst = false){
  return `
    <div class="playerTableRow">
      <div class="playerTableCell playerTableCell--label">${esc(label)}</div>
      ${values.map((v, i) => `
        <div class="playerTableCell playerTableCell--value${highlightFirst && i === 0 ? " is-highlight" : ""}">
          ${esc(v)}
        </div>
      `).join("")}
    </div>
  `;
}

function rateRow(label, values){
  return `
    <div class="playerTableRow">
      <div class="playerTableCell playerTableCell--label">${esc(label)}</div>
      ${values.map((v, i) => {
        const n = Number(String(v).replace("%","").trim());
        const width = Number.isFinite(n) ? Math.max(0, Math.min(n, 100)) : 0;
        return `
          <div class="playerTableCell playerTableCell--value${i === 0 ? " is-highlight" : ""}">
            <div class="playerRateStack">
              <div class="playerRateText">${esc(v)}</div>
              <div class="playerRateBar">
                <div class="playerRateBarFill" style="width:${width}%"></div>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

$("playerCourseStats").innerHTML = [
  makeCourseHeader(),
  valueRow("出走数", ["45","45","45","45","45","44"], true),
  valueRow("1着", ["35","2","4","2","1","1"], true),
  valueRow("2着", ["3","13","12","6","9","2"], true),
  valueRow("3着", ["2","10","10","6","12","5"], true),
  rateRow("1着率", ["77.7 %","4.4 %","8.8 %","4.4 %","2.2 %","2.2 %"]),
  rateRow("2連対率", ["84.4 %","33.3 %","35.5 %","17.7 %","22.2 %","6.8 %"]),
  rateRow("3連対率", ["88.8 %","55.5 %","57.7 %","31.1 %","48.8 %","18.1 %"]),
  valueRow("逃げ", ["34","0","0","0","0","0"], true),
  valueRow("差し", ["0","1","0","0","1","0"], true),
  valueRow("まくり", ["0","1","2","2","0","0"], true),
  valueRow("まくり差し", ["0","0","1","0","0","1"], true),
  valueRow("抜き", ["1","0","1","0","0","0"], true),
  valueRow("恵まれ", ["0","0","0","0","0","0"], true)
].join("");

$("playerTimingTable").innerHTML = [
  makeCourseHeader(),
  valueRow("平均ST", ["0.13","0.14","0.13","0.15","0.16","0.14"], false),
  valueRow("F", ["0","0","0","0","0","0"], false),
  valueRow("L", ["0","0","0","0","0","0"], false)
].join("");

buildRadarGrid();
buildRadarPolygon();
makeCourseTabs();
renderHeroCard();