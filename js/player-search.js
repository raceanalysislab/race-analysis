fetch("./data/player_index_today.json")
  .then(res => res.json())
  .then(players => {
    const input = document.getElementById("playerSearchInput");
    const result = document.getElementById("playerSearchResult");

    if (!input || !result) return;

    const JCD_TO_VENUE = {
      "01": "桐生",
      "02": "戸田",
      "03": "江戸川",
      "04": "平和島",
      "05": "多摩川",
      "06": "浜名湖",
      "07": "蒲郡",
      "08": "常滑",
      "09": "津",
      "10": "三国",
      "11": "びわこ",
      "12": "住之江",
      "13": "尼崎",
      "14": "鳴門",
      "15": "丸亀",
      "16": "児島",
      "17": "宮島",
      "18": "徳山",
      "19": "下関",
      "20": "若松",
      "21": "芦屋",
      "22": "福岡",
      "23": "唐津",
      "24": "大村"
    };

    const VENUE_TO_JCD = Object.fromEntries(
      Object.entries(JCD_TO_VENUE).map(([jcd, name]) => [name, jcd])
    );

    const VENUE_NAMES = Object.values(JCD_TO_VENUE);

    const normalize = (v) =>
      String(v || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/　+/g, "");

    const getVenueLabel = (p) => {
      const jcdLabel = JCD_TO_VENUE[String(p.jcd || "").padStart(2, "0")];
      if (jcdLabel) return jcdLabel;

      const rawVenue = String(p.venue || "");
      const matched = VENUE_NAMES.find((name) => rawVenue.includes(name));
      if (matched) return matched;

      return "";
    };

    const getResolvedJcd = (p) => {
      const rawJcd = String(p.jcd || "").padStart(2, "0");
      if (JCD_TO_VENUE[rawJcd]) return rawJcd;

      const venueLabel = getVenueLabel(p);
      if (venueLabel && VENUE_TO_JCD[venueLabel]) return VENUE_TO_JCD[venueLabel];

      return "";
    };

    const clearSearch = () => {
      input.value = "";
      result.innerHTML = "";
      result.style.display = "none";
    };

    players.forEach((p) => {
      const regNo = normalize(p.reg_no);
      const name = normalize(p.name);
      const venueLabel = normalize(getVenueLabel(p));
      const race = normalize(`${p.race || ""}r`);
      p._search = `${regNo}${name}${venueLabel}${race}`;
    });

    input.addEventListener("input", () => {
      const q = normalize(input.value);

      if (!q) {
        clearSearch();
        return;
      }

      const found = players.filter((p) => p._search.includes(q));

      result.innerHTML = "";

      if (found.length === 0) {
        result.style.display = "block";
        result.innerHTML = `<div class="playerSearchItem">該当なし</div>`;
        return;
      }

      found.slice(0, 10).forEach((p) => {
        const div = document.createElement("div");
        div.className = "playerSearchItem";

        const venueLabel = getVenueLabel(p) || "—";
        const resolvedJcd = getResolvedJcd(p);

        div.textContent = `${p.reg_no} ${p.name} ${venueLabel} ${p.race}R`;

        div.addEventListener("click", () => {
          if (!venueLabel || venueLabel === "—" || !resolvedJcd) return;

          window.location.href =
            "./race-detail.html?name=" +
            encodeURIComponent(venueLabel) +
            "&race=" +
            encodeURIComponent(p.race || 1) +
            "&jcd=" +
            encodeURIComponent(resolvedJcd);
        });

        result.appendChild(div);
      });

      result.style.display = "block";
    });

    window.addEventListener("pageshow", () => {
      clearSearch();
    });
  })
  .catch(err => console.error("player search error:", err));