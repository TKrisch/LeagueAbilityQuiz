const fs = require("fs");

const OUTPUT_FILE = "pro-meta.json";

const DAYS_BACK = 30;
const TOP_AMOUNT = 50;

const API_URL = "https://lol.fandom.com/api.php";

const TOURNAMENT_KEYWORDS = [
  "LCK",
  "LPL",
  "LEC",
  "LCS",
  "MSI",
  "World"
];

async function main() {
  console.log("Lade Pro-Play-Championdaten von Leaguepedia Cargo...");

  const sinceDate = getDateDaysAgo(DAYS_BACK);
  console.log(`Zeitraum: letzte ${DAYS_BACK} Tage, seit ${sinceDate}`);

  let champions = await fetchChampionStats(sinceDate, true);

  if (champions.length === 0) {
    console.log("Keine Champions mit Major-Filter gefunden. Versuche ohne Liga-Filter...");
    champions = await fetchChampionStats(sinceDate, false);
  }

  if (champions.length === 0) {
    throw new Error(
      "Es wurden 0 Champions gefunden. pro-meta.json wird nicht überschrieben."
    );
  }

  const output = {
    updatedAt: new Date().toISOString(),
    source: "Leaguepedia Cargo",
    daysBack: DAYS_BACK,
    topAmount: TOP_AMOUNT,
    tournamentFilter: TOURNAMENT_KEYWORDS,
    champions
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log(`Fertig. ${champions.length} Champions gespeichert in ${OUTPUT_FILE}`);
  console.table(champions.slice(0, 15));
}

async function fetchChampionStats(sinceDate, useTournamentFilter) {
  let where = `
    DateTime_UTC >= '${sinceDate}'
    AND Champion IS NOT NULL
    AND Champion != ''
  `.replace(/\s+/g, " ").trim();

  if (useTournamentFilter) {
    const tournamentWhere = TOURNAMENT_KEYWORDS
      .map(keyword => `OverviewPage LIKE '%${keyword}%'`)
      .join(" OR ");

    where += ` AND (${tournamentWhere})`;
  }

  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    tables: "ScoreboardPlayers",
    fields: "Champion,COUNT(*)=Picks",
    where,
    group_by: "Champion",
    order_by: "Picks DESC",
    limit: String(TOP_AMOUNT)
  });

  const url = `${API_URL}?${params.toString()}`;

  console.log("Cargo-URL:");
  console.log(url);

  const data = await fetchWithRetry(url, 3);

  if (data.error) {
    throw new Error(`Leaguepedia Cargo Fehler: ${JSON.stringify(data.error)}`);
  }

  const rows = data.cargoquery?.map(entry => entry.title) || [];

  console.log(`Gefundene Cargo-Zeilen: ${rows.length}`);

  return rows
    .map(row => ({
      champion: cleanValue(row.Champion),
      picks: Number(row.Picks || 0)
    }))
    .filter(entry => entry.champion)
    .sort((a, b) => b.picks - a.picks)
    .slice(0, TOP_AMOUNT);
}

async function fetchWithRetry(url, retries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`Cargo-Abfrage Versuch ${attempt}/${retries}...`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "LeagueAbilityQuiz/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Leaguepedia API Fehler: ${response.status}`);
    }

    const data = await response.json();

    if (data.error?.code === "ratelimited") {
      if (attempt === retries) {
        throw new Error(`Leaguepedia Rate Limit: ${data.error.info}`);
      }

      const waitTime = attempt * 120000;
      console.log(`Rate Limit erreicht. Warte ${waitTime / 1000} Sekunden...`);
      await sleep(waitTime);
      continue;
    }

    return data;
  }

  throw new Error("Unbekannter Fehler bei Leaguepedia-Abfrage.");
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function cleanValue(value) {
  if (!value) return "";
  return String(value).trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
  console.error(error);

  if (fs.existsSync(OUTPUT_FILE)) {
    console.warn(`${OUTPUT_FILE} bleibt unverändert, weil bereits eine alte Version existiert.`);
    process.exit(0);
  }

  process.exit(1);
});