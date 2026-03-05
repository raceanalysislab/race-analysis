// ここだけ触ればOK（noteやbot URLの差し替え用）

// 会場一覧（開催場）
export const BOT_VENUES_URL =
  "https://raw.githubusercontent.com/raceanalysislab/race-data-bot/main/data/venues_today.json";

// 厳選レース
export const BOT_PICKS_URL =
  "https://raw.githubusercontent.com/raceanalysislab/race-data-bot/main/data/picks_today.json";

// レース詳細JSON（びわこ_1R.json など）
export const BOT_RACES_BASE_URL =
  "https://raw.githubusercontent.com/raceanalysislab/race-data-bot/main/data/site/races/";

// note導線（毎日更新するならここだけ編集）
export const NOTE_URLS = {
  YOSO_ONLY: "https://note.com/wsnndboat7/n/n1fdca8b0a7e3",
  PRO_ONLY:  "https://note.com/wsnndboat7/n/n8d805a4f27bf",
  SET:       "https://note.com/wsnndboat7/n/n6fcdb2a9db4f",
};