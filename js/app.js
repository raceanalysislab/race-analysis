/* js/app.js（長期運用版 / site JSON専用 / 超軽量） */

const SITE_VENUES_URLS = [
  "./data/site/venues.json"
];

const NOTE_URLS = {
  YOSO_ONLY: "https://note.com/wsnndboat7/n/n1fdca8b0a7e3",
  PRO_ONLY: "https://note.com/wsnndboat7/n/n8d805a4f27bf",
  SET: "https://note.com/wsnndboat7/n/n6fcdb2a9db4f",
};

const NEXT_RACE_DELAY_MS = 3000;
const DANGER_MS = 5 * 60 * 1000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const $grid = document.getElementById("grid");
const $updatedAt = document.getElementById("updatedAt");
const $btn = document.getElementById("btnRefresh");

const pad2 = (n) => String(n).padStart(2, "0");

let venueList = [];

/* ======================= util ======================= */

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",
    '"':"&quot;","'":"&#39;"
  }[c]));
}

function parseHHMM(s) {
  const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return {h:Number(m[1]),m:Number(m[2])};
}

function getCutoffTime(hhmm){
  const t=parseHHMM(hhmm);
  if(!t)return null;
  const d=new Date();
  d.setHours(t.h,t.m,0,0);
  return d.getTime();
}

/* ======================= next race ======================= */

function computeNext(raceTimes){

  const now=Date.now();

  for(const r of raceTimes){

    const cutoff=getCutoffTime(r.cutoff);
    if(!cutoff)continue;

    const switchAt=cutoff+NEXT_RACE_DELAY_MS;
    const remain=cutoff-now;

    if(now<switchAt){

      return{
        text:`${r.rno}R ${r.cutoff}`,
        danger:remain<=DANGER_MS && remain>=0
      }

    }

  }

  return{
    text:"発売終了",
    danger:false
  }

}

/* ======================= fetch ======================= */

async function fetchVenues(){

  const res=await fetch(SITE_VENUES_URLS[0]+"?t="+Date.now(),{
    cache:"no-store"
  });

  if(!res.ok) throw new Error("fetch error");

  return await res.json();

}

/* ======================= render ======================= */

function render(){

  const now=new Date();
  $updatedAt.textContent=
    `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  $grid.innerHTML = venueList.map(v=>{

    const next=computeNext(v.race_times||[]);
    const m=next.text.match(/^(\d+R)\s(\d\d:\d\d)$/);

    let race="";
    let time="";

    if(m){
      race=m[1];
      time=m[2];
    }else{
      race=next.text;
    }

    const dangerClass = next.danger ? " raceTime--danger":"";

return `
<a class="card card--on card--tone-${escapeHTML(v.card_band||"normal")}"
href="./race.html?jcd=${v.jcd}&name=${encodeURIComponent(v.name)}">

<div class="card__nameRow">
<div class="card__name">${escapeHTML(v.name)}</div>
</div>

<div class="card__meta">
<span class="gradeText">${escapeHTML(v.grade_label)}</span>
<span class="day">${escapeHTML(v.day_label)}</span>
</div>

<div class="card__line card__line--btm">

<span class="raceNo">${escapeHTML(race)}</span>

${time?`<span class="raceTime${dangerClass}">${time}</span>`:""}

</div>

</a>
`

}).join("");

}

/* ======================= load ======================= */

async function load(){

  try{

    venueList=await fetchVenues();

    render();

  }catch(e){

    console.error(e);

    $updatedAt.textContent="ERR";

  }

}

/* ======================= events ======================= */

if($btn){

  $btn.addEventListener("click",load);

}

setInterval(render,1000);
setInterval(load,REFRESH_INTERVAL_MS);

/* start */

load();