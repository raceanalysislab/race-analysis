/* BOAT CORE 安定版 */

const DATA_URL = "./data/site/venues.json";

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g,(c)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function nowHM(){
  const d=new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function renderCard(v){

return `
<a class="card card--on card--tone-${esc(v.card_band || "normal")}"
href="./race.html?jcd=${v.jcd}&name=${encodeURIComponent(v.name)}">

<div class="card__nameRow">
<span class="card__nameIcon card__nameIcon--empty"></span>
<div class="card__name">${esc(v.name)}</div>
<span class="card__nameIcon card__nameIcon--empty"></span>
</div>

<div class="card__meta">
<span class="gradeText">${esc(v.grade_label || "")}</span>
<span class="day">${esc(v.day_label || "")}</span>
</div>

<div class="card__line card__line--btm">
${esc(v.next_display || "-- --")}
</div>

</a>
`;
}

async function load(){

try{

const res = await fetch(DATA_URL,{cache:"no-store"});
const json = await res.json();

$grid.innerHTML = json.map(renderCard).join("");

$updatedAt.textContent = nowHM();

}catch(e){

console.error(e);

$updatedAt.textContent="ERR";

$grid.innerHTML=`
<div style="grid-column:1/-1;padding:20px">
読み込み失敗
</div>
`;

}

}

if($btn){
$btn.addEventListener("click",load);
}

load();