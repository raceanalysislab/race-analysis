function renderWakuTrend(boats) {
  const root = document.getElementById("wakuTrendRoot");
  const localRoot = document.getElementById("wakuTrendLocalRoot");

  if (!root || !localRoot) return;

  root.innerHTML = "";
  localRoot.innerHTML = "";

  boats.forEach((b) => {
    const avg = b.waku_recent_avg_st ?? "--";
    const records = b.waku_recent || [];

    const html = `
      <div class="wakuTrend">
        <div class="wakuTrend__avg">平均ST: ${avg}</div>
        <div class="wakuTrend__list">
          ${records.map(r => `
            <div class="wakuItem">
              <div>${r.course}</div>
              <div>${r.st}</div>
              <div>${r.rank}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    root.innerHTML += html;
    localRoot.innerHTML += html;
  });
}


function initWakuTabs() {
  const tabs = document.querySelectorAll(".wakuTrendInnerTab");
  const track = document.getElementById("wakuTrendSwipeTrack");

  if (!tabs.length || !track) return;

  tabs.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("is-active"));
      btn.classList.add("is-active");
      track.style.transform = `translateX(-${i * 100}%)`;
    });
  });
}

initWakuTabs();
