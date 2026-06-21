const fs = require("fs");

const INPUT_FILE =
process.env.INPUT_FILE || "data/2026_LoL_esports_match_data_from_OraclesElixir.csv";

const OUTPUT_FILE = "pro-meta.json";

const ALLOWED_LEAGUES = [
  "LCK",
  "LPL",
  "LEC",
  "LCS",
  "MSI",
  "WCS"
];

const TOP_AMOUNT = 40;

function main() {
  console.log("Lese Oracle's-Elixir-CSV...");
  console.log(INPUT_FILE);

  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Datei nicht gefunden: ${INPUT_FILE}`);
  }

  const csvText = fs.readFileSync(INPUT_FILE, "utf8");
  const rows = parseCsv(csvText);

  const championStats = {};

  for (const row of rows) {
    const champion = row.champion;
    const league = row.league;

    if (!champion) continue;
    if (!ALLOWED_LEAGUES.includes(league)) continue;

    if (!championStats[champion]) {
      championStats[champion] = {
        champion,
        picks: 0
      };
    }

    championStats[champion].picks++;
  }

  const champions = Object.values(championStats)
    .sort((a, b) => b.picks - a.picks)
    .slice(0, TOP_AMOUNT);

  const output = {
    updatedAt: new Date().toISOString(),
    source: "Oracle's Elixir CSV",
    inputFile: INPUT_FILE,
    leagues: ALLOWED_LEAGUES,
    topAmount: TOP_AMOUNT,
    champions
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log(`Fertig. ${champions.length} Champions gespeichert in ${OUTPUT_FILE}`);
  console.table(champions.slice(0, 10));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}