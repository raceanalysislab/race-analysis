fetch("./data/player_index_today.json")
  .then(res => res.json())
  .then(players => {

    const input = document.getElementById("playerSearchInput");
    const result = document.getElementById("playerSearchResult");

    if (!input || !result) return;

    players.forEach(p => {
      const regNo = String(p.reg_no || "");
      const name = String(p.name || "");
      p._search = (regNo + name).toLowerCase();
    });

    input.addEventListener("input", () => {

      const q = input.value.trim().toLowerCase();

      if (!q){
        result.style.display = "none";
        result.innerHTML = "";
        return;
      }

      const found = players.filter(p => p._search.includes(q));

      result.innerHTML = "";

      if (found.length === 0){
        result.style.display = "block";
        result.innerHTML = `<div class="playerSearchItem">該当なし</div>`;
        return;
      }

      found.slice(0, 10).forEach(p => {

        const div = document.createElement("div");
        div.className = "playerSearchItem";
        div.textContent = `${p.reg_no} ${p.name} ${p.venue} ${p.race}R`;

        div.addEventListener("click", () => {
          window.location.href =
            "./race-detail.html?name=" +
            encodeURIComponent(p.venue || "") +
            "&race=" +
            encodeURIComponent(p.race || 1) +
            "&jcd=" +
            encodeURIComponent(p.jcd || "");
        });

        result.appendChild(div);
      });

      result.style.display = "block";

    });

  })
  .catch(err => console.error("player search error:", err));