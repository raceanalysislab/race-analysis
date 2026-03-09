:root{
--safe-top:env(safe-area-inset-top,0px);
--safe-bottom:env(safe-area-inset-bottom,0px);
--raceTopH:112px;

--bg:#f3f5f9;
--panel:#ffffff;
--panel-soft:#f8fafc;
--line:#e2e8f0;
--line-soft:#eef2f7;

--text:#0f172a;
--muted:#64748b;
--muted-2:#94a3b8;
--accent:#2563eb;

--shadow:0 2px 8px rgba(15,23,42,.06);
}

*{
box-sizing:border-box;
}

html,body{
margin:0;
min-height:100%;
background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);
color:var(--text);
font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP","Segoe UI",sans-serif;
overscroll-behavior-y:none;
}

body{
padding-top:var(--safe-top);
}

/* 上部 */

.raceTop{
position:sticky;
top:0;
z-index:50;
padding:8px 10px 6px;
background:rgba(246,247,251,.98);
border-bottom:1px solid rgba(226,232,240,.92);
}

.raceHead{
display:flex;
align-items:flex-start;
justify-content:space-between;
gap:10px;
background:var(--panel);
border:1px solid var(--line);
border-radius:16px;
padding:10px;
box-shadow:var(--shadow);
}

.raceHead__left{
display:flex;
flex-direction:column;
gap:6px;
min-width:0;
}

.raceVenue{
font-size:22px;
font-weight:1000;
line-height:1;
white-space:nowrap;
overflow:hidden;
text-overflow:ellipsis;
}

.raceMeta{
display:flex;
gap:6px;
flex-wrap:wrap;
align-items:center;
font-size:11px;
color:var(--muted);
}

.metaChip{
display:inline-flex;
align-items:center;
min-height:24px;
padding:0 9px;
border-radius:999px;
border:1px solid var(--line);
background:var(--panel-soft);
font-weight:700;
}

.raceBtn{
border:1px solid var(--line);
background:var(--panel-soft);
min-width:64px;
height:38px;
border-radius:11px;
font-size:13px;
font-weight:900;
}

/* レース番号 */

.raceTabs{
margin-top:8px;
display:flex;
gap:6px;
overflow-x:auto;
-webkit-overflow-scrolling:touch;
}

.tab{
flex:0 0 auto;
min-width:52px;
height:34px;
border-radius:999px;
border:1px solid var(--line);
background:#fff;
font-size:12px;
font-weight:900;
}

.tab.is-active{
background:linear-gradient(180deg,#2f7cff 0%,#2563eb 100%);
color:#fff;
border-color:transparent;
}

/* 本体 */

.raceBody{
height:calc(100dvh - var(--raceTopH));
padding:6px 10px calc(8px + var(--safe-bottom));
}

.section{
height:100%;
display:flex;
flex-direction:column;
background:var(--panel);
border:1px solid var(--line);
border-radius:18px;
padding:8px;
box-shadow:var(--shadow);
overflow:hidden;
}

.sectionHead{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:6px;
padding-bottom:6px;
border-bottom:1px solid var(--line-soft);
}

.sectionTitle{
font-size:13px;
font-weight:1000;
}

.sectionMeta{
font-size:10px;
color:var(--muted-2);
text-align:right;
}

/* 上部タブ */

.viewTabs{
display:flex;
gap:8px;
margin-bottom:8px;
overflow-x:auto;
}

.viewTab{
border:1px solid var(--line);
background:#fff;
height:36px;
padding:0 14px;
border-radius:999px;
font-size:12px;
font-weight:900;
}

.viewTab.is-active{
background:linear-gradient(180deg,#2f7cff 0%,#2563eb 100%);
color:#fff;
border-color:transparent;
}

/* スワイプ */

.viewPager{
flex:1;
overflow:hidden;
}

.viewTrack{
height:100%;
display:flex;
transition:transform .22s ease;
}

.viewPage{
width:100%;
min-width:100%;
height:100%;
display:flex;
flex-direction:column;
}

/* 出走表 */

.table{
flex:1;
display:flex;
flex-direction:column;
gap:10px;
overflow:auto;
padding-right:2px;
}

.row{
display:flex;
align-items:center;
gap:14px;
border-radius:18px;
background:#fff;
border:1px solid #e5eaf2;
padding:14px;
box-shadow:0 1px 2px rgba(0,0,0,.04);
}

.waku{
width:48px;
height:48px;
border-radius:16px;
display:flex;
align-items:center;
justify-content:center;
font-size:28px;
font-weight:1000;
}

.w1{background:#fff;border:2px solid #ddd;color:#111}
.w2{background:#111;color:#fff}
.w3{background:#f06f63;color:#fff}
.w4{background:#568cff;color:#fff}
.w5{background:#f7dd58;color:#111}
.w6{background:#6fd275;color:#111}

.info{
flex:1;
display:flex;
flex-direction:column;
gap:6px;
}

.sub{
font-size:12px;
color:#64748b;
font-weight:700;
}

.name{
font-size:24px;
font-weight:900;
}

.metric{
display:flex;
flex-direction:column;
align-items:flex-end;
font-size:14px;
gap:4px;
}

.metric div{
text-align:right;
}

.note{
margin-top:6px;
font-size:10px;
color:var(--muted);
}