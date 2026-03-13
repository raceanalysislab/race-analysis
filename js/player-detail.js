const qs = new URLSearchParams(location.search);

const playerName = decodeURIComponent(qs.get("name") || "選手情報");
const regno = String(qs.get("regno") || "").trim();
const grade = String(qs.get("grade") || "").trim();
const branch = String(qs.get("branch") || "").trim();
const age = String(qs.get("age") || "").trim();
const venue = decodeURIComponent(qs.get("venue") || "—");
const race = String(qs.get("race") || "").trim();
const date = String(qs.get("date") || "").trim();

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

function makeCourseHeader(){
  const courses = [1,2,3,4,5,6];
  return `
    <div class="playerTableHead">
      <div class="playerTableHeadCell playerTableHeadCell--stub">
        <span>進入</span>
        <span>選択→</span>
      </div>
      ${courses.map((course, idx) => `
        <div class="playerTableHeadCell">
          <div class="playerCourseMark">${idx === 0 ? "▲" : "△"}</div>
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