"use strict";

// Refresh current first-team and academy squad names from FootballSquads.
// The generated snapshot is checked in so the game never depends on a live request at runtime.
// Positions, ages and shirt numbers are sourced; overall/potential remain game-balance estimates.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "https://footballsquads.co.uk";
const SOURCE_LABEL = "FootballSquads.co.uk current squad pages";
const SEASON = "2026/27";
const REFRESH_REVISION = 2;
const LEAGUES = [
  { id: "england", country: "إنجلترا", division: 1, url: "/eng/2026-2027/engprem/", expectedTeams: 20 },
  { id: "england", country: "إنجلترا", division: 2, url: "/eng/2026-2027/flcham/", expectedTeams: 24 },
  { id: "spain", country: "إسبانيا", division: 1, url: "/spain/2026-2027/spalali.htm", teamDirectory: "/spain/2026-2027/laliga/", expectedTeams: 20 },
  { id: "spain", country: "إسبانيا", division: 2, url: "/spain/2026-2027/spalali2.htm", teamDirectory: "/spain/2026-2027/laliga2/", expectedTeams: 22 },
  { id: "germany", country: "ألمانيا", division: 1, url: "/ger/2026-2027/gerbun.htm", teamDirectory: "/ger/2026-2027/bundes/", expectedTeams: 18 },
  { id: "germany", country: "ألمانيا", division: 2, url: "/ger/2026-2027/gerbun2.htm", teamDirectory: "/ger/2026-2027/bundes2/", expectedTeams: 18 },
  { id: "italy", country: "إيطاليا", division: 1, url: "/italy/2026-2027/seriea.htm", teamDirectory: "/italy/2026-2027/seriea/", expectedTeams: 20 },
  { id: "italy", country: "إيطاليا", division: 2, url: "/italy/2026-2027/serieb.htm", teamDirectory: "/italy/2026-2027/serieb/", expectedTeams: 20 },
  { id: "france", country: "فرنسا", division: 1, url: "/france/2026-2027/fralig1.htm", teamDirectory: "/france/2026-2027/ligue1/", expectedTeams: 18 },
  { id: "france", country: "فرنسا", division: 2, url: "/france/2026-2027/fralig2.htm", teamDirectory: "/france/2026-2027/ligue2/", expectedTeams: 18 },
  { id: "portugal", country: "البرتغال", division: 1, url: "/portugal/2026-2027/porprim.htm", teamDirectory: "/portugal/2026-2027/primeira/", expectedTeams: 18 },
  { id: "turkey", country: "تركيا", division: 1, url: "/turkey/2026-2027/superl/", teamDirectory: "/turkey/2026-2027/superl/", expectedTeams: 18 },
  { id: "brazil", country: "البرازيل", division: 1, url: "/brazil/2026/bracamp.htm", teamDirectory: "/brazil/2026/seriea/", expectedTeams: 20 },
  // Argentina uses the calendar-year Apertura, so identify that source season explicitly.
  { id: "argentina", country: "الأرجنتين", division: 1, url: "/arg/2026/argaper.htm", teamDirectory: "/arg/2026/apertura/", expectedTeams: 30, sourceSeason: "2026 Apertura" }
];

const NAME_MAP = new Map([
  ["bournemouth", ["Bournemouth", "AFC Bournemouth"]],
  ["brightonandhovealbion", ["Brighton & Hove Albion", "Brighton and Hove Albion"]],
  ["manchestercity", ["Manchester City", "Manchester City FC"]],
  ["manchesterunited", ["Manchester United", "Manchester United FC"]],
  ["newcastleunited", ["Newcastle United", "Newcastle United FC"]],
  ["tottenhamhotspur", ["Tottenham Hotspur", "Tottenham Hotspur FC"]],
  ["nottinghamforest", ["Nottingham Forest", "Nottingham Forest FC"]],
  ["realoviedo", ["Real Oviedo", "Oviedo"]],
  ["athleticbilbao", ["Athletic Club", "Athletic Bilbao"]],
  ["atleticomadrid", ["Atlético Madrid", "Atletico Madrid"]],
  ["celtafortuna", ["Celta Fortuna", "Celta Vigo B"]],
  ["almeriacity", ["Almería", "Almeria"]],
  ["bayernmunchen", ["Bayern München", "Bayern Munich"]],
  ["koln", ["1. FC Köln", "FC Köln", "Cologne"]],
  ["borussiamonchengladbach", ["Borussia Mönchengladbach", "Monchengladbach"]],
  ["parissaintgermain", ["Paris Saint-Germain", "PSG"]],
  ["olympiquedemarseille", ["Marseille", "Olympique de Marseille"]],
  ["olympiquelyonnais", ["Lyon", "Olympique Lyonnais"]],
  ["sportingcp", ["Sporting CP", "Sporting Lisbon"]],
  ["fcmidtjylland", ["FC Midtjylland"]],
  ["athleticoparanaense", ["Athletico Paranaense", "Athletico-PR"]],
  ["atleticomineiro", ["Atlético Mineiro", "Atletico Mineiro"]],
  ["redbullbragantino", ["Red Bull Bragantino", "RB Bragantino"]],
  ["gremio", ["Grêmio", "Gremio"]],
  // Argentine club page headings include location suffixes not always used in the game catalogue.
  ["atleticotucuman", ["Atlético Tucumán", "Atletico Tucuman"]],
  ["centralcordobasantiagodelestero", ["Central Córdoba", "Central Cordoba", "Central Córdoba (Santiago del Estero)"]],
  ["estudianteslaplata", ["Estudiantes de La Plata", "Estudiantes (La Plata)"]],
  ["estudiantesriocuarto", ["Estudiantes de Río Cuarto", "Estudiantes (Río Cuarto)"]],
  ["gimnasialaplata", ["Gimnasia La Plata", "Gimnasia y Esgrima La Plata", "Gimnasia (La Plata)"]],
  ["gimnasiademendoza", ["Gimnasia de Mendoza", "Gimnasia y Esgrima de Mendoza", "Gimnasia (Mendoza)"]],
  ["gimnasiayesgrimademendoza", ["Gimnasia de Mendoza", "Gimnasia y Esgrima de Mendoza", "Gimnasia (Mendoza)"]],
  ["institutocordoba", ["Instituto", "Instituto (Córdoba)", "Instituto Atlético Central Córdoba"]],
  ["unionsantafe", ["Unión", "Union", "Unión (Santa Fe)"]],
  ["tallerescordoba", ["Talleres", "Talleres (Córdoba)", "Talleres de Córdoba"]],
  ["aldosivimardelplata", ["Aldosivi", "Aldosivi (Mar del Plata)"]],
  ["belgranocordoba", ["Belgrano", "Belgrano (Córdoba)", "Belgrano (Cordoba)"]],
  ["gimnasiayesgrimalaplata", ["Gimnasia La Plata", "Gimnasia y Esgrima La Plata", "Gimnasia y Esgrima (La Plata)", "Gimnasia (La Plata)"]],
  ["gimnasiayesgrimamendoza", ["Gimnasia de Mendoza", "Gimnasia y Esgrima de Mendoza", "Gimnasia y Esgrima (Mendoza)", "Gimnasia (Mendoza)"]],
  ["independienterivadaviamendoza", ["Independiente Rivadavia", "Independiente Rivadavia (Mendoza)"]],
  ["sarmientojunin", ["Sarmiento", "Sarmiento (Junín)", "Sarmiento Junín"]]
]);

function decodeEntities(text) {
  const named = {
    amp: "&", quot: '"', apos: "'", "#39": "'", "#039": "'", nbsp: " ",
    lt: "<", gt: ">", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
    rdquo: "”", ldquo: "“", aacute: "á", eacute: "é", iacute: "í",
    oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", auml: "ä",
    ouml: "ö", uuml: "ü", ccedil: "ç", atilde: "ã", otilde: "õ"
  };
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return named[entity] || named[entity.toLowerCase()] || whole;
  });
}

function plainText(html) {
  return decodeEntities(String(html).replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

function normalized(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en").replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

function roleFor(position) {
  const value = String(position || "").trim().toUpperCase();
  if (["G", "GK"].includes(value)) return "حارس مرمى";
  if (["D", "DF", "CB", "LB", "RB", "LWB", "RWB"].includes(value)) return "قلب دفاع";
  if (["F", "FW", "ST", "CF", "LW", "RW"].includes(value)) return "مهاجم";
  if (["M", "MF", "DM", "CM", "AM"].includes(value)) return "وسط مهاجم";
  return "";
}

function parseAge(dob) {
  const m = String(dob || "").match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += year >= 40 ? 1900 : 2000;
  const month = Number(m[2]), day = Number(m[1]);
  const seasonDate = new Date();
  let age = seasonDate.getUTCFullYear() - year;
  if (seasonDate.getUTCMonth() + 1 < month ||
      (seasonDate.getUTCMonth() + 1 === month && seasonDate.getUTCDate() < day)) age--;
  return age >= 15 && age <= 48 ? age : null;
}

async function fetchHtml(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "LastWhistleRosterRefresh/1.0 (game database refresh)",
          "Accept": "text/html,application/xhtml+xml"
        },
        signal: AbortSignal.timeout(25000)
      });
      if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
      const html = await response.text();
      if (html.length < 1500) throw new Error("Unexpectedly short HTML (" + html.length + " bytes) from " + url);
      if (/403 forbidden|access denied|cloudflare ray id/i.test(html.slice(0, 2000))) {
        throw new Error("Access denied while fetching " + url);
      }
      return html;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1200));
    }
  }
  throw lastError || new Error("Failed to fetch " + url);
}

function parseTeamLinks(indexHtml, indexUrl, teamDirectory) {
  const page = new URL(indexUrl);
  // FootballSquads has both directory-style indexes (England) and .htm indexes
  // whose squad pages live in league-specific subfolders (Spain, Germany, etc.).
  const basePrefix = teamDirectory
    ? new URL(teamDirectory, indexUrl).pathname
    : (page.pathname.toLowerCase().endsWith(".htm") || page.pathname.toLowerCase().endsWith(".html")
      ? page.pathname.slice(0, page.pathname.lastIndexOf("/") + 1)
      : (page.pathname.endsWith("/") ? page.pathname : page.pathname + "/"));
  const seen = new Set();
  const teams = [];
  const re = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of indexHtml.matchAll(re)) {
    let url;
    try { url = new URL(decodeEntities(match[2]), indexUrl); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || !url.pathname.toLowerCase().endsWith(".htm")) continue;
    if (!url.pathname.startsWith(basePrefix) || url.pathname === basePrefix) continue;
    if (seen.has(url.href)) continue;
    const linkText = plainText(match[3]);
    if (!linkText || /squad|home|current season|archive|national competitions/i.test(linkText)) continue;
    seen.add(url.href);
    const name = linkText.replace(/\.html?$/i, "").replace(/[_-]+/g, " ").trim();
    teams.push({ name, url: url.href });
  }
  return teams;
}
function parsePlayers(teamHtml) {
  const cutoff = teamHtml.search(/Players\s+no\s+longer\s+at\s+this\s+club/i);
  const activeHtml = cutoff >= 0 ? teamHtml.slice(0, cutoff) : teamHtml;
  const players = [];
  const seen = new Set();
  for (const rowMatch of activeHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
      cells.push(plainText(cellMatch[1]));
    }
    if (cells.length < 7) continue;
    const name = cells[1];
    const position = roleFor(cells[3]);
    if (!name || !position || /^(name|player|number)$/i.test(name)) continue;
    if (/players no longer|previous club|official name|formed:/i.test(name)) continue;
    const key = normalized(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const shirt = Number.parseInt(cells[0], 10);
    const age = parseAge(cells[6]);
    players.push({
      name,
      number: Number.isFinite(shirt) && shirt > 0 ? shirt : null,
      position,
      age: age || undefined,
      nationality: cells[2] || "",
      dob: cells[6] || "",
      source: SOURCE_LABEL,
      isRealPlayer: true
    });
  }
  return players;
}

function htmlForTeamName(name) {
  const key = normalized(name);
  const stripped = key.replace(/^(afc|fc|cf|sc)/, "").replace(/(footballclub|athleticclub|club|fc|afc|cf|sc|ac)$/, "");
  const aliases = NAME_MAP.get(key) || NAME_MAP.get(stripped) || [];
  return { sourceName: name, aliases };
}

function extractTeamName(teamHtml, fallback) {
  const heading = teamHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
    || teamHtml.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
  if (heading) {
    const name = plainText(heading[1]);
    if (name && !/football squads|current squad|squad list/i.test(name)) return name;
  }
  const title = teamHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    const text = plainText(title[1]);
    const match = text.match(/FootballSquads\s*[-–]\s*(.*?)\s*[-–]\s*20\d{2}/i);
    if (match && match[1].trim()) return match[1].trim();
  }
  return String(fallback || "").replace(/\.html?$/i, "").replace(/[_-]+/g, " ").trim();
}

async function main() {
  const leagueOutputs = [];
  let totalTeams = 0, totalPlayers = 0;
  for (const league of LEAGUES) {
    const indexUrl = new URL(league.url, BASE_URL).href;
    const indexHtml = await fetchHtml(indexUrl);
    const teams = parseTeamLinks(indexHtml, indexUrl, league.teamDirectory);
    if (teams.length < league.expectedTeams - 2) {
      throw new Error("Expected about " + league.expectedTeams + " clubs for " + league.id +
        " division " + league.division + " but only found " + teams.length + " links at " + indexUrl);
    }
    const clubs = [];
    for (const team of teams) {
      const html = await fetchHtml(team.url);
      const teamName = extractTeamName(html, team.name);
      const players = parsePlayers(html);
      if (players.length < 12) {
        throw new Error("Only " + players.length + " current players parsed for " + teamName + " (" + team.url + ")");
      }
      clubs.push({
        name: teamName,
        aliases: htmlForTeamName(teamName).aliases,
        leagueId: league.id,
        country: league.country,
        division: league.division,
        sourceUrl: team.url,
        source: SOURCE_LABEL,
        players
      });
      totalTeams++;
      totalPlayers += players.length;
      process.stdout.write("Loaded " + team.name + ": " + players.length + " players\n");
    }
    leagueOutputs.push({
      leagueId: league.id, country: league.country, division: league.division,
      expectedTeams: league.expectedTeams, sourceUrl: indexUrl, clubs
    });
  }

  const payload = {
    schemaVersion: 1,
    refreshRevision: REFRESH_REVISION,
    season: SEASON,
    source: SOURCE_LABEL,
    generatedAt: new Date().toISOString(),
    note: "Roster names, positions, ages and shirt numbers are sourced. OVR/potential are game-balance estimates; this dataset is not a live in-game API.",
    leagues: leagueOutputs
  };
  const js = "/* Generated by scripts/refresh-world-squads.cjs. Do not edit by hand. */\n" +
    "window.LWFootballSquadData = " + JSON.stringify(payload) + ";\n";
  fs.writeFileSync(path.join(ROOT, "football-world-rosters.js"), js);
  fs.writeFileSync(path.join(ROOT, "public", "football-world-rosters.js"), js);
  const report = {
    refreshRevision: REFRESH_REVISION,
    season: SEASON, source: SOURCE_LABEL, status: "complete",
    expectedTeamsTotal: LEAGUES.reduce((sum, item) => sum + item.expectedTeams, 0),
    leagues: leagueOutputs.map(item => ({
      leagueId: item.leagueId, division: item.division, sourceSeason: item.sourceSeason,
      expectedTeams: LEAGUES.find(league => league.id === item.leagueId && league.division === item.division).expectedTeams,
      sourceUrl: item.sourceUrl,
      clubs: item.clubs.length,
      players: item.clubs.reduce((sum, club) => sum + club.players.length, 0),
      below18Players: item.clubs.filter(club => club.players.length < 18).map(club => club.name)
    })),
    totalTeams, totalPlayers, snapshotBytes: Buffer.byteLength(js),
    allLeagueMinimumsMet: leagueOutputs.every(item => item.clubs.length >= item.expectedTeams - 2)
  };
  fs.writeFileSync(path.join(ROOT, "world-roster-audit.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(ROOT, "public", "world-roster-audit.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("World roster refresh complete:\n" + JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error("World roster refresh FAILED:", error && error.stack || error);
  process.exitCode = 1;
});
