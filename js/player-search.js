fetch("./data/player_index_today.json")
  .then(res => res.json())
  .then(players => {
    const input = document.getElementById("playerSearchInput");
    const result = document.getElementById("playerSearchResult");

    if (!input || !result) return;

    input.addEventListener("input", () => {
      const q = input.value.trim();

      if (q.length < 1) {
        result.style.display = "none";
        result.innerHTML = "";
        return;
      }

      const found = players.filter(p =>
        String(p.reg_no || "").includes(q) ||
        String(p.name || "").includes(q)
      );

      result.innerHTML = "";

      found.slice(0, 10).forEach(p => {
        const div = document.createElement("div");
        div.className = "playerSearchItem";

        div.textContent = `${p.reg_no} ${p.name} ${p.venue}${p.race}R`;

        div.onclick = () => {
          window.location.href = `./race-detail.html?venue=${encodeURIComponent(p.venue)}&race=${encodeURIComponent(p.race)}`;
        };

        result.appendChild(div);
      });

      result.style.display = found.length ? "block" : "none";
    });
  })
  .catch(err => {
    console.error("player search load error:", err);
  });