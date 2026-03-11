const PLAYER_INDEX_URL = "./data/player_index_today.json";

function buildPlayerIndexUrl() {
  const sep = PLAYER_INDEX_URL.includes("?") ? "&" : "?";
  const cacheBust = Math.floor(Date.now() / 60000);
  return `${PLAYER_INDEX_URL}${sep}t=${cacheBust}`;
}

fetch(buildPlayerIndexUrl(), { cache: "no-store" })
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

    const cleanVenueText = (v) =>
      String(v || "")
        .replace(/[0-9０-９]+R?$/i, "")
        .replace(/[0-9０-９]+$/, "")
        .trim();

    const resolveVenueLabel = (p) => {
      const rawJcd = String(p.jcd || "").padStart(2, "0");
      if (JCD_TO_VENUE[rawJcd]) return JCD_TO_VENUE[rawJcd];

      const rawVenue = cleanVenueText(p.venue);
      const matched = VENUE_NAMES.find((name) => rawVenue.includes(name));
      if (matched) return matched;

      return "";
    };

    const resolveJcd = (p, venueLabel) => {
      const rawJcd = String(p.jcd || "").padStart(2, "0");
      if (JCD_TO_VENUE[rawJcd]) return rawJcd;
      if (venueLabel && VENUE_TO_JCD[venueLabel]) return VENUE_TO_JCD[venueLabel];
      return "";
    };

    const clearSearch = () => {
      input.value = "";
      result.innerHTML = "";
      result.style.display = "none";
    };

    players.forEach((p) => {
      const venueLabel = resolveVenueLabel(p);
      const resolvedJcd = resolveJcd(p, venueLabel);

      p._resolvedVenueLabel = venueLabel;
      p._resolvedJcd = resolvedJcd;
      p._isUsable = Boolean(venueLabel && resolvedJcd);

      const regNo = normalize(p.reg_no);
      const name = normalize(p.name);
      const race = normalize(`${p.race || ""}r`);
      const venue = normalize(venueLabel);

      p._search = `${regNo}${name}${venue}${race}`;
    });

    input.addEventListener("input", () => {
      const q = normalize(input.value);

      if (!q) {
        clearSearch();
        return;
      }

      const found = players
        .filter((p) => p._search.includes(q))
        .filter((p) => p._isUsable);

      result.innerHTML = "";

      if (found.length === 0) {
        result.style.display = "block";
        result.innerHTML = `<div class="playerSearchItem">該当なし</div>`;
        return;
      }

      found.slice(0, 10).forEach((p) => {
        const div = document.createElement("div");
        div.className = "playerSearchItem";
        div.textContent = `${p.reg_no} ${p.name} ${p._resolvedVenueLabel} ${p.race}R`;

        div.addEventListener("click", () => {
          window.location.href =
            "./race.html?name=" +
            encodeURIComponent(p._resolvedVenueLabel) +
            "&race=" +
            encodeURIComponent(p.race || 1) +
            "&jcd=" +
            encodeURIComponent(p._resolvedJcd);
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