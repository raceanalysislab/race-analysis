/* js/app.js（完全置き換え：開催一覧 / 中央完全固定版） */

const SITE_VENUES_URL =
  "https://raw.githubusercontent.com/raceanalysislab/race-data-bot/main/data/site/venues.json";

const VENUES = [
  { jcd: "01", name: "桐生" }, { jcd: "02", name: "戸田" }, { jcd: "03", name: "江戸川" }, { jcd: "04", name: "平和島" },
  { jcd: "05", name: "多摩川" }, { jcd: "06", name: "浜名湖" }, { jcd: "07", name: "蒲郡" }, { jcd: "08", name: "常滑" },
  { jcd: "09", name: "津" }, { jcd: "10", name: "三国" }, { jcd: "11", name: "びわこ" }, { jcd: "12", name: "住之江" },
  { jcd: "13", name: "尼崎" }, { jcd: "14", name: "鳴門" }, { jcd: "15", name: "丸亀" }, { jcd: "16", name: "児島" },
  { jcd: "17", name: "宮島" }, { jcd: "18", name: "徳山" }, { jcd: "19", name: "下関" }, { jcd: "20", name: "若松" },
  { jcd: "21", name: "芦屋" }, { jcd: "22", name: "福岡" }, { jcd: "23", name: "唐津" }, { jcd: "24", name: "大村" }
];

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");

const pad2 = (n) => String(n).padStart(2, "0");

function nowJST(){
  const d = new Date();
  return {hh:d.getHours(),mm:d.getMinutes()}
}

function escapeHTML(s){
  return String(s ?? "").replace(/[&<>"']/g,(c)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function toneIcon(tone){
  if(tone==="morning") return "☀️";
  if(tone==="night") return "🌙";
  return "";
}

function detectTone(time){
  const m=time.match(/(\d+):(\d+)/);
  if(!m) return "normal";

  const t=Number(m[1])*60+Number(m[2]);

  if(t>=510 && t<=540) return "morning";
  if(t>=900 && t<=940) return "night";

  return "normal";
}

async function fetchJSON(url){
  const r=await fetch(url+"?t="+Date.now(),{cache:"no-store"});
  if(!r.ok) throw new Error(r.status);
  return r.json();
}

function venueHref(v){
  return `./race.html?jcd=${encodeURIComponent(v.jcd)}&name=${encodeURIComponent(v.name)}`;
}

function normalizeList(raw){

  const src = Array.isArray(raw)?raw:(raw?.venues||[]);
  const map = new Map();

  src.forEach(v=>{
    const jcd=String(v.jcd).padStart(2,"0");

    if(!VENUES.find(x=>x.jcd===jcd)) return;

    map.set(jcd,{
      jcd,
      next_display:v.next_display || "-- --",
      grade_label:(v.grade_label||"一般").replace("戦",""),
      day_label:v.day_label || ""
    });
  });

  return map;
}

function render(map){

  $grid.innerHTML = VENUES.map(base=>{

    const v = map.get(base.jcd);

    if(!v){
      return `
<div class="card card--off">

  <div class="card__nameRow">
    <span class="card__nameIcon"></span>
    <div class="card__name">${base.name}</div>
    <span class="card__nameIcon"></span>
  </div>

  <div class="card__meta">
    <span>--</span>
    <span>--</span>
  </div>

  <div class="card__line card__line--btm">--</div>

</div>`;
    }

    const tone = detectTone(v.next_display);

    return `
<a class="card card--on card--tone-${tone}" href="${venueHref(base)}">

  <div class="card__nameRow">

    <span class="card__nameIcon">
      ${toneIcon(tone)}
    </span>

    <div class="card__name">
      ${escapeHTML(base.name)}
    </div>

    <span class="card__nameIcon"></span>

  </div>

  <div class="card__meta">
    <span>${escapeHTML(v.grade_label)}</span>
    <span>${escapeHTML(v.day_label)}</span>
  </div>

  <div class="card__line card__line--btm">
    ${escapeHTML(v.next_display)}
  </div>

</a>
`;

  }).join("");

  const n=nowJST();
  $updatedAt.textContent=`${pad2(n.hh)}:${pad2(n.mm)}`;
}

async function load(){

  const json = await fetchJSON(SITE_VENUES_URL);

  const map = normalizeList(json);

  render(map);

}

load();
setInterval(load,300000);