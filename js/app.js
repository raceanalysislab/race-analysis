/* js/app.js（完全置き換え：開催一覧 / day_label / 終了対応） */

/* ===== venues.json ===== */
const SITE_VENUES_URL =
"https://cdn.jsdelivr.net/gh/raceanalysislab/race-data-bot@main/data/site/venues.json";

/* ===== note ===== */
const NOTE_URLS = {
  YOSO_ONLY: "https://note.com/wsnndboat7/n/n1fdca8b0a7e3",
  PRO_ONLY: "https://note.com/wsnndboat7/n/n8d805a4f27bf",
  SET: "https://note.com/wsnndboat7/n/n6fcdb2a9db4f",
};

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
const pad2=n=>String(n).padStart(2,"0");

let isLoading=false;

/* ===== JST ===== */
function nowJST(){
 const d=new Date();
 return {hh:d.getHours(),mm:d.getMinutes()};
}

/* ===== fetch ===== */
async function fetchJSON(url){
 const res=await fetch(url+"?t="+Date.now(),{cache:"no-store"});
 if(!res.ok)throw new Error("fetch fail");
 return res.json();
}

/* ===== render ===== */
function render(list){

 const map=new Map();
 list.forEach(v=>map.set(v.jcd,v));

 const merged=VENUES.map(base=>{
   const v=map.get(base.jcd);
   return{
     name:base.name,
     jcd:base.jcd,
     next_display:v?.next_display||"-- --",
     day_label:v?.day_label||"-- --",
     exists:!!v
   };
 });

 $grid.innerHTML=merged.map(v=>{

   if(!v.exists){
     return`
     <div class="card card--off">
       <div class="card__name">${v.name}</div>
       <div class="card__line card__line--sub">-- --</div>
       <div class="card__line card__line--btm">-- --</div>
     </div>`;
   }

   return`
   <a class="card card--on" href="./race.html?jcd=${v.jcd}&name=${v.name}">
     <div class="card__name">${v.name}</div>
     <div class="card__line card__line--sub">${v.day_label}</div>
     <div class="card__line card__line--btm">${v.next_display}</div>
   </a>`;
 }).join("");

 const now=nowJST();
 $updatedAt.textContent=`${pad2(now.hh)}:${pad2(now.mm)}`;
}

/* ===== load ===== */
async function loadAll(){
 if(isLoading)return;
 isLoading=true;

 try{
   const data=await fetchJSON(SITE_VENUES_URL);
   render(data);
 }
 catch(e){
   alert("開催一覧取得エラー");
   console.error(e);
 }
 finally{
   isLoading=false;
 }
}

/* ===== refresh ===== */
if($btn)$btn.onclick=loadAll;

document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible")loadAll();
});

setInterval(()=>{
 if(document.visibilityState==="visible")loadAll();
},300000);

/* ===== start ===== */
loadAll();