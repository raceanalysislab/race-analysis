/* js/app.js（完全置き換え：mbrace主導 + CDN + 並列fetch + キャッシュ完全回避） */

import { BOT_VENUES_URL, BOT_PICKS_URL, NOTE_URLS } from "./config.js";

/* ===== mbrace JSON ===== */
const MBRACE_RACES_URL =
  "https://cdn.jsdelivr.net/gh/raceanalysislab/race-data-bot@main/data/mbrace_races_today.json";

/* ===== 会場順 ===== */
const VENUES = [
  { jcd:"01",name:"桐生"},{jcd:"02",name:"戸田"},{jcd:"03",name:"江戸川"},{jcd:"04",name:"平和島"},
  { jcd:"05",name:"多摩川"},{jcd:"06",name:"浜名湖"},{jcd:"07",name:"蒲郡"},{jcd:"08",name:"常滑"},
  { jcd:"09",name:"津"},{jcd:"10",name:"三国"},{jcd:"11",name:"びわこ"},{jcd:"12",name:"住之江"},
  { jcd:"13",name:"尼崎"},{jcd:"14",name:"鳴門"},{jcd:"15",name:"丸亀"},{jcd:"16",name:"児島"},
  { jcd:"17",name:"宮島"},{jcd:"18",name:"徳山"},{jcd:"19",name:"下関"},{jcd:"20",name:"若松"},
  { jcd:"21",name:"芦屋"},{jcd:"22",name:"福岡"},{jcd:"23",name:"唐津"},{jcd:"24",name:"大村"}
];

/* ===== DOM ===== */
const $grid=document.getElementById("grid");
const $updatedAt=document.getElementById("updatedAt");
const $btn=document.getElementById("btnRefresh");
const $picks=document.getElementById("picks");
const $picksUpdatedAt=document.getElementById("picksUpdatedAt");
const $picksCta=document.getElementById("picksCta");
const $btnPro=document.getElementById("btnPro");

const pad2=n=>String(n).padStart(2,"0");

/* ===== JST ===== */
function nowJST(){
  const d=new Date();
  const j=new Date(d.toLocaleString("en-US",{timeZone:"Asia/Tokyo"}));
  return{
    y:j.getFullYear(),
    m:j.getMonth()+1,
    d:j.getDate(),
    hh:j.getHours(),
    mm:j.getMinutes(),
    ss:j.getSeconds()
  };
}

function todayJSTStr(){
  const n=nowJST();
  return`${n.y}-${pad2(n.m)}-${pad2(n.d)}`;
}

/* ===== fetch ===== */
async function fetchJSON(url){
  const bust=url.includes("?")?"&":"?";
  const res=await fetch(url+bust+"t="+Date.now(),{
    cache:"no-store",
    headers:{
      "pragma":"no-cache",
      "cache-control":"no-cache"
    }
  });
  if(!res.ok)throw new Error("fetch fail");
  return await res.json();
}

/* ===== mbrace → venues ===== */
function buildHeldVenuesFromMbrace(data){

  const today=todayJSTStr();

  const nameToJcd=new Map();
  VENUES.forEach(v=>nameToJcd.set(v.name,v.jcd));

  const venues=[];

  for(const v of data.venues||[]){

    if(v.date!==today)continue;

    const name=v.venue;
    const jcd=nameToJcd.get(name)||"";

    const cutoffs=[];

    for(const r of v.races||[]){
      if(!r.cutoff)continue;
      cutoffs.push({
        rno:r.rno,
        time:r.cutoff
      });
    }

    venues.push({
      jcd,
      name,
      held:true,
      grade:"",
      day:null,
      cutoffs
    });
  }

  return{
    date:today,
    checked_at:new Date().toISOString(),
    venues
  };
}

/* ===== render ===== */

function render(data){

  const map=new Map();
  (data.venues||[]).forEach(v=>map.set(v.jcd,v));

  const merged=VENUES.map(base=>{
    const v=map.get(base.jcd)||{};
    const held=v.held===true;

    return{
      jcd:base.jcd,
      name:base.name,
      held,
      next_display:v.next_display||"-- --"
    };
  });

  $grid.innerHTML=merged.map(v=>`
  <div class="card ${v.held?'card--on':'card--off'}">
  <div class="card__name">${v.name}</div>
  <div class="card__line">${v.next_display||"-- --"}</div>
  </div>
  `).join("");

  const now=nowJST();
  $updatedAt.textContent=`${pad2(now.hh)}:${pad2(now.mm)}`;
}

/* ===== picks ===== */

function renderPicks(data){
  const picks=data?.picks||[];

  $picks.innerHTML=picks.map(p=>`
  <div class="pickCard">
  <div>${p.venue||""} ${p.race||""}</div>
  </div>
  `).join("");

  const now=nowJST();
  $picksUpdatedAt.textContent=`${pad2(now.hh)}:${pad2(now.mm)}`;
}

/* ===== main load ===== */

let isLoading=false;

async function loadAll(){

  if(isLoading)return;
  isLoading=true;

  try{

    const [
      mbrace,
      botVenues,
      picks
    ]=await Promise.all([
      fetchJSON(MBRACE_RACES_URL).catch(()=>null),
      fetchJSON(BOT_VENUES_URL).catch(()=>null),
      fetchJSON(BOT_PICKS_URL).catch(()=>null)
    ]);

    let raw=null;

    if(mbrace){
      raw=buildHeldVenuesFromMbrace(mbrace);
    }else{
      raw=botVenues;
    }

    render(raw);

    if(picks)renderPicks(picks);

  }finally{
    isLoading=false;
  }
}

/* ===== refresh ===== */

$btn.addEventListener("click",()=>loadAll());

/* ===== auto refresh ===== */

setInterval(()=>{
  if(document.visibilityState==="visible"){
    loadAll();
  }
},300000);

/* ===== boot ===== */

loadAll();