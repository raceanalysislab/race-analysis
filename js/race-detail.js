const qs = new URLSearchParams(location.search)

const venueName = decodeURIComponent(qs.get("name") || "会場")
const jcd = qs.get("jcd") || ""

const $ = (id)=>document.getElementById(id)

const $table = $("table")

$("venueName").textContent = venueName

const BOT_URL =
"https://cdn.jsdelivr.net/gh/raceanalysislab/race-data-bot@main/data/site/races/"


function rowHTML(p){

return `
<div class="row">

<div class="waku w${p.waku}">
${p.waku}
</div>

<div>

<div class="name">
${p.name || "—"}
</div>

<div>
${p.regno || ""}
</div>

</div>

</div>
`
}


function renderRace(json){

const boats = json.race.boats || []

$table.innerHTML =
boats.map(rowHTML).join("")
}


async function loadRace(r){

const url =
BOT_URL + `${venueName}_${r}R.json`

const res = await fetch(url)

const json = await res.json()

renderRace(json)

}


function makeTabs(){

const tabs = $("tabs")

tabs.innerHTML = ""

for(let i=1;i<=12;i++){

const btn = document.createElement("button")

btn.className = "tab"

btn.textContent = i + "R"

btn.onclick=()=>loadRace(i)

tabs.appendChild(btn)

}

}


function boot(){

makeTabs()

loadRace(1)

}


boot()