const qs = new URLSearchParams(location.search);

const venueName = decodeURIComponent(qs.get("name") || "会場");
const jcd = String(qs.get("jcd") || "").padStart(2,"0");

const $ = id => document.getElementById(id);

const $tabs = $("tabs");
const $table = $("table");
const $raceNoLabel = $("raceNoLabel");
const $timeLabel = $("timeLabel");
const $dayLabel = $("dayLabel");
const $viewTabs = $("viewTabs");
const $viewTrack = $("viewTrack");
const $viewPager = $("viewPager");

const BOT_RACES_BASE_URL =
"https://cdn.jsdelivr.net/gh/raceanalysislab/race-data-bot@main/data/site/races/";

let currentRace = 1;
let currentView = 0;

$("venueName").textContent = venueName;

/* ---------- util ---------- */

const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));

const esc = s =>
String(s ?? "").replace(/[&<>"']/g,c=>({
"&":"&amp;",
"<":"&lt;",
">":"&gt;",
'"':"&quot;",
"'":"&#39;"
}[c]));

const safeNum=v=>{
if(v===undefined||v===null||v==="")return "—";
const n=Number(v);
return Number.isFinite(n)?n.toFixed(2):"—";
};

const safeInt=v=>{
if(v===undefined||v===null||v==="")return "—";
const n=Number(v);
return Number.isFinite(n)?String(Math.trunc(n)):"—";
};

const toHM=x=>{
const m=String(x||"").match(/(\d{1,2}):(\d{2})/);
return m?`${m[1].padStart(2,"0")}:${m[2]}`:"--:--";
};

/* ---------- fetch ---------- */

const fetchJSON = async url=>{
const res = await fetch(url+"?t="+Date.now(),{cache:"no-store"});
if(!res.ok) throw new Error(url);
return res.json();
};

/* ---------- tabs ---------- */

function makeTabs(active){

$tabs.innerHTML = Array.from({length:12},(_,i)=>{

const r=i+1;

return `<button class="tab${r===active?" is-active":""}" data-race="${r}">
${r}R
</button>`;

}).join("");

$tabs.querySelectorAll(".tab").forEach(btn=>{

btn.addEventListener("click",()=>{

setRace(Number(btn.dataset.race));

});

});

}

/* ---------- boats normalize ---------- */

function normalizeBoatsTo6(boats){

const byWaku=new Map();
const rest=[];

boats.forEach(b=>{

const w=Number(b?.waku);

if(w>=1&&w<=6&&!byWaku.has(w)) byWaku.set(w,b);
else rest.push(b);

});

for(let w=1;w<=6;w++){

if(!byWaku.has(w)&&rest.length){

byWaku.set(w,{...rest.shift(),waku:w});

}

}

return Array.from({length:6},(_,i)=>{

const w=i+1;

return byWaku.get(w)||{
waku:w,
name:"—",
regno:"",
branch:"",
age:"",
grade:"",
nat_win:null,
motor_no:null,
motor_2:null
};

});

}

/* ---------- row html ---------- */

function metricHTML(p){

return `
<div class="metric">

<div>
<div>全国勝率</div>
<div>${esc(safeNum(p.nat_win))}</div>
</div>

<div>
<div>モーター</div>
<div>${esc(safeInt(p.motor_no))}</div>
<div>${esc(safeNum(p.motor_2))}</div>
</div>

</div>
`;

}

function rowHTML(p){

const regno = p.regno || p.id || "—";
const grade = p.grade || "—";
const branch = p.branch || "—";
const age = p.age ? `${p.age}歳`:"—";

return `
<div class="row">

<div class="waku w${p.waku}">
${p.waku}
</div>

<div class="info">

<div class="sub">
${esc(regno)} / ${esc(grade)} / ${esc(branch)} / ${esc(age)}
</div>

<div class="name">
${esc(p.name)}
</div>

</div>

${metricHTML(p)}

</div>
`;

}

/* ---------- view switch ---------- */

function setView(index){

currentView = clamp(index,0,2);

Array.from($viewTabs.querySelectorAll(".viewTab"))
.forEach((btn,i)=>{

btn.classList.toggle("is-active",i===currentView);

});

$viewTrack.style.transform =
`translate3d(${-100*currentView}%,0,0)`;

}

/* ---------- view tabs ---------- */

Array.from($viewTabs.querySelectorAll(".viewTab"))
.forEach(btn=>{

btn.addEventListener("click",()=>{

setView(Number(btn.dataset.view));

});

});

/* ---------- swipe ---------- */

let dragStart=0;
let dragX=0;
let dragging=false;

$viewPager.addEventListener("pointerdown",e=>{

dragging=true;
dragStart=e.clientX;
dragX=e.clientX;

});

$viewPager.addEventListener("pointermove",e=>{

if(!dragging) return;

dragX=e.clientX;

const width=$viewPager.clientWidth||1;
const delta=dragX-dragStart;

const pct=(delta/width)*100;

$viewTrack.style.transform=
`translate3d(${(-100*currentView)+pct}%,0,0)`;

});

$viewPager.addEventListener("pointerup",()=>{

if(!dragging) return;

dragging=false;

const width=$viewPager.clientWidth||1;
const delta=dragX-dragStart;

if(delta<-width*0.2&&currentView<2) setView(currentView+1);
else if(delta>width*0.2&&currentView>0) setView(currentView-1);
else setView(currentView);

});

/* ---------- race load ---------- */

function buildUrls(r){

return [

...(jcd&&jcd!=="00"
? [`${BOT_RACES_BASE_URL}${jcd}_${r}R.json`]
: []),

`${BOT_RACES_BASE_URL}${venueName}_${r}R.json`

];

}

async function fetchRaceJSON(r){

let err=null;

for(const url of buildUrls(r)){

try{

return await fetchJSON(url);

}catch(e){

err=e;

}

}

throw err;

}

function renderRaceJSON(r,json){

const raceObj=json?.race||{};

$raceNoLabel.textContent=`${r}R`;
$timeLabel.textContent=`締切: ${toHM(raceObj.cutoff)}`;
$dayLabel.textContent=json?.day_label||"—";

const boats=normalizeBoatsTo6(raceObj.boats||[]);

$table.innerHTML=boats.map(rowHTML).join("");

}

/* ---------- set race ---------- */

async function setRace(r){

r=clamp(r,1,12);

currentRace=r;

makeTabs(r);

$table.innerHTML="読み込み中...";

try{

const json=await fetchRaceJSON(r);

renderRaceJSON(r,json);

}catch{

$table.innerHTML="データ取得失敗";

}

}

/* ---------- boot ---------- */

async function boot(){

const initialRace=clamp(Number(qs.get("race")||1),1,12);

makeTabs(initialRace);

setView(0);

await setRace(initialRace);

}

$("btnBack").addEventListener("click",()=>history.back());

boot();