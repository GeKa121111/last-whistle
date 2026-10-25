"use strict";

// Supplements FootballSquads data with available official 2026/27 Egyptian Pro League squad pages.
// Some clubs do not publish a usable squad page, so the script records the pages that were actually sourced
// and never fabricates a real-player roster for a missing page.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const HOST = "https://www.egyptianproleague.com";
const SOURCE = "Egyptian Professional Clubs Association official squad pages (2026/27)";
const MIN_PLAYERS = 16;
const MIN_SOURCED_CLUBS = 17;
const TEAMS = [
  { name: "الاتحاد السكندري", aliases: ["Al Ittihad Alexandria", "Al Ittihad Alexandria Club"], path: "/team/18/detials/13/squad" },
  { name: "الأهلي", aliases: ["Al Ahly", "Al Ahly SC", "Al Ahly FC"], path: "/team/20/detials/1/squad" },
  { name: "البنك الأهلي", aliases: ["National Bank of Egypt", "Bank El Ahly", "National Bank"], path: "/team/21/detials/2188/squad" },
  { name: "الجونة", aliases: ["El Gouna", "El Gouna FC"], path: "/team/22/detials/617/squad" },
  { name: "الزمالك", aliases: ["Zamalek", "Zamalek SC"], path: "/team/23/detials/2/squad" },
  { name: "المصري", aliases: ["Al Masry", "Al Masry SC"], path: "/team/24/detials/8/squad" },
  { name: "إنبي", aliases: ["الشرقية إنبي", "ENPPI", "ENPPI Club", "Enppi"], path: "/team/26/detials/150/squad" },
  { name: "سموحة", aliases: ["Smouha SC", "Smouha"], path: "/team/30/detials/860/squad" },
  { name: "بيراميدز", aliases: ["Pyramids FC", "Pyramids"], path: "/team/28/detials/1451/squad" },
  { name: "زد", aliases: ["ZED FC", "ZED"], path: "/team/29/detials/1683/squad" },
  { name: "سيراميكا كليوباترا", aliases: ["Ceramica Cleopatra", "Cleopatra FC"], path: "/team/31/detials/12723/squad" },
  { name: "طلائع الجيش", aliases: ["Tala'ea El Geish", "Talaea El Gaish", "Tala'ea El Gaish"], path: "/team/32/detials/304/squad" },
  { name: "مودرن سبورت", aliases: ["Modern Sport", "Modern Sport FC", "Future FC"], path: "/team/34/detials/12724/squad" },
  { name: "بتروجيت", aliases: ["Petrojet", "Petrojet FC"], path: "/team/36/detials/14455/squad" },
  { name: "غزل المحلة", aliases: ["Ghazl El Mahalla", "Ghazl El-Mahalla"], path: "/team/38/detials/7/squad" },
  { name: "وادي دجلة", aliases: ["Wadi Degla", "Wadi Degla FC"], path: "/team/42/detials/1016/squad" },
  { name: "المقاولون العرب", aliases: ["Al Mokawloon", "El Mokawloon SC", "Arab Contractors"], path: "/team/43/detials/11/squad" },
  { name: "القناة", aliases: ["Canal SC", "Canal Sporting Club"], path: "/team/47/detials/12/squad" }
];

function decodeEntities(value) {
  const named = { amp: "&", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#039": "'" };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (whole, entity) {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : whole;
    }
    return named[entity] || named[entity.toLowerCase()] || whole;
  });
}

function normalize(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0600-\u06FF]/g, "");
}

function linesFromHtml(html) {
  return decodeEntities(String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "\n")
    .replace(/<!--[\s\S]*?-->/g, "\n")
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<\/(?:h[1-6]|p|div|li|section|article|a|tr|td|th|span|button)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const POSITION_HEADINGS = [
  { pattern: /حراسة\s*المرمى|حراسة\s*المرمي|حراس?\s*المرمى|حارس\s*المرمى/i, position: "حارس مرمى" },
  { pattern: /خط\s*الدفاع|الدفاع|المدافعون/i, position: "قلب دفاع" },
  { pattern: /خط\s*الوسط|الوسط|لاعبي\s*الوسط/i, position: "وسط مهاجم" },
  { pattern: /خط\s*الهجوم|الهجوم|المهاجمون/i, position: "مهاجم" }
];
const STOP = new Set([
  "الرئيسية","بطولات","الأخبار","عن الرابطة","صور","فيديوهات","المركز الإعلامي","الفريق","نظرة عامة",
  "مباريات ونتائج","إحصائيات اللاعبين","إحصائيات الفرق","الانتقالات","الرعاة","روابط سريعة","عرض المزيد",
  "تاريخ التأسيس","المدينة","الألقاب","الترتيب العام","الترتيب","الفريق","لعب","فوز","هزيمة","تعادل","نقاط",
  "دوري","كأس مصر","الدوري المصري","Image","Images","الرعاية","الرابطة","الأندية","المصرية"
]);

function isPlayerName(line) {
  if (!line || line.length < 3 || line.length > 80) return false;
  if (/^\d{1,3}$/.test(line)) return false;
  if (STOP.has(line)) return false;
  if (/^(home|news|overview|matches|results|squad|players|statistics|transfers|sponsors)$/i.test(line)) return false;
  if (/الرابطة|الرعاة|روابط سريعة|تاريخ التأسيس|الترتيب العام|الألقاب|عدد مرات الفوز|جميع الحقوق|كأس عاصمة مصر/i.test(line)) return false;
  if (!/[a-z\u0600-\u06FF]/i.test(line)) return false;
  if (/^(GK|DF|MF|FW|Goalkeeper|Defender|Midfielder|Forward)$/i.test(line)) return false;
  return true;
}

function parsePlayers(html) {
  const lines = linesFromHtml(html);
  const startAt = lines.findIndex(line => /حراسة\s*المرمى|حراسة\s*المرمي|حراس?\s*المرمى/i.test(line));
  const endAt = lines.findIndex((line, index) => index > Math.max(-1, startAt) && /الرعاة|رابطة الأندية المحترفة المصرية/.test(line));
  const active = lines.slice(startAt >= 0 ? startAt : 0, endAt > startAt ? endAt : undefined);
  const players = [];
  const seen = new Set();
  let currentPosition = "وسط مهاجم";
  let pending = null;
  for (const rawLine of active) {
    const line = rawLine.replace(/^[•*\-·]+\s*/, "").trim();
    if (!line || /^Image(s)?$/i.test(line)) continue;
    const heading = POSITION_HEADINGS.find(item => item.pattern.test(line));
    if (heading) {
      currentPosition = heading.position;
      pending = null;
      continue;
    }
    if (/^(الرئيسية|بطولات|الأخبار|عن الرابطة|صور|فيديوهات|الفريق|نظرة عامة|مباريات ونتائج|إحصائيات اللاعبين|إحصائيات الفرق|الانتقالات|الرعاة|روابط سريعة)$/i.test(line)) continue;
    if (/^\d{1,2}$/.test(line)) {
      if (pending && !pending.number) pending.number = Number(line);
      pending = null;
      continue;
    }
    const inlineNumber = line.match(/^(.{3,75}?)\s+(\d{1,2})$/);
    const name = inlineNumber ? inlineNumber[1].trim() : line;
    if (!isPlayerName(name)) { pending = null; continue; }
    const key = normalize(name);
    if (!key || seen.has(key)) { pending = null; continue; }
    const player = {
      name,
      position: currentPosition,
      source: SOURCE,
      isRealPlayer: true
    };
    if (inlineNumber) player.number = Number(inlineNumber[2]);
    players.push(player);
    seen.add(key);
    pending = player;
  }
  return players;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "LastWhistleRosterRefresh/1.0 (game database refresh)", "Accept": "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
  const html = await response.text();
  if (html.length < 1000) throw new Error("Unexpectedly short HTML (" + html.length + " bytes) from " + url);
  if (/access denied|cloudflare ray id|403 forbidden/i.test(html.slice(0, 2000))) throw new Error("Access denied: " + url);
  return html;
}

function loadSnapshot(file) {
  const source = fs.readFileSync(file, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: path.basename(file), timeout: 15000 });
  const data = sandbox.window.LWFootballSquadData;
  if (!data || !Array.isArray(data.leagues)) throw new Error("Existing world roster snapshot could not be loaded: " + file);
  return data;
}

async function main() {
  const rootFile = path.join(ROOT, "football-world-rosters.js");
  const publicFile = path.join(ROOT, "public", "football-world-rosters.js");
  const auditFile = path.join(ROOT, "world-roster-audit.json");
  const publicAuditFile = path.join(ROOT, "public", "world-roster-audit.json");
  const payload = loadSnapshot(rootFile);
  payload.leagues = (payload.leagues || []).filter(league => !(league.leagueId === "egypt" && Number(league.division) === 1));
  const imported = [], skipped = [];
  for (const team of TEAMS) {
    const url = new URL(team.path, HOST).href;
    try {
      const html = await fetchHtml(url);
      const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      const sourceTitle = heading ? linesFromHtml(heading[1]).join(" ").trim() : "";
      const players = parsePlayers(html);
      if (players.length < MIN_PLAYERS) {
        skipped.push({ name: team.name, url, reason: "Only " + players.length + " player records parsed; minimum is " + MIN_PLAYERS, pageTitle: sourceTitle });
        process.stdout.write("SKIP " + team.name + ": parsed " + players.length + " players; title=" + sourceTitle + "\n");
        continue;
      }
      imported.push({
        name: team.name,
        aliases: team.aliases,
        leagueId: "egypt",
        country: "مصر",
        division: 1,
        sourceUrl: url,
        source: SOURCE,
        players
      });
      process.stdout.write("Loaded Egyptian squad " + team.name + ": " + players.length + " players (" + url + ")\n");
    } catch (error) {
      skipped.push({ name: team.name, url, reason: String(error && error.message || error) });
      process.stdout.write("SKIP " + team.name + ": " + String(error && error.message || error) + "\n");
    }
  }
  if (imported.length < MIN_SOURCED_CLUBS) {
    throw new Error("Official Egyptian Pro League source returned only " + imported.length + " usable squads; need at least " + MIN_SOURCED_CLUBS + ". Skipped pages: " + JSON.stringify(skipped));
  }
  const oldLeague = payload.leagues.find(league => league.leagueId === "egypt" && Number(league.division) === 1);
  payload.leagues.push({
    leagueId: "egypt",
    country: "مصر",
    division: 1,
    source: SOURCE,
    sourceUrl: HOST + "/",
    sourceSeason: "2026/27",
    expectedTeams: imported.length,
    coverageType: "available-official-squad-pages",
    clubs: imported
  });
  payload.supplementalCoverage = payload.supplementalCoverage || {};
  payload.supplementalCoverage.egypt = {
    source: SOURCE,
    season: "2026/27",
    availablePagesConfigured: TEAMS.length,
    importedClubs: imported.length,
    importedPlayers: imported.reduce((sum, club) => sum + club.players.length, 0),
    skippedPages: skipped
  };
  const js = "/* Generated from FootballSquads and supplemental official club-squad sources. Do not edit by hand. */\n" +
    "window.LWFootballSquadData = " + JSON.stringify(payload) + ";\n";
  fs.writeFileSync(rootFile, js);
  fs.writeFileSync(publicFile, js);
  const audit = JSON.parse(fs.readFileSync(auditFile, "utf8"));
  const previousEgypt = audit.supplementalCoverage && audit.supplementalCoverage.egypt || {};
  const previousEgyptClubs = Math.max(0, Number(previousEgypt.importedClubs) || 0);
  const previousEgyptPlayers = Math.max(0, Number(previousEgypt.importedPlayers) || 0);
  const baseTotalTeams = Math.max(0, Number(audit.totalTeams) - previousEgyptClubs);
  const baseTotalPlayers = Math.max(0, Number(audit.totalPlayers) - previousEgyptPlayers);
  const baseExpectedTeams = Math.max(0, Number(audit.expectedTeamsTotal) - previousEgyptClubs);
  const egyptPlayers = imported.reduce((sum, club) => sum + club.players.length, 0);
  const egyptAuditRow = {
    leagueId: "egypt", division: 1, expectedTeams: imported.length,
    sourceUrl: HOST + "/", sourceSeason: "2026/27", coverageType: "available-official-squad-pages",
    clubs: imported.length, players: egyptPlayers,
    below18Players: imported.filter(club => club.players.length < 18).map(club => club.name)
  };
  audit.leagues = (audit.leagues || []).filter(league => !(league.leagueId === "egypt" && Number(league.division) === 1));
  audit.leagues.push(egyptAuditRow);
  audit.leagues.sort((a, b) => String(a.leagueId).localeCompare(String(b.leagueId)) || Number(a.division) - Number(b.division));
  audit.expectedTeamsTotal = baseExpectedTeams + imported.length;
  audit.totalTeams = baseTotalTeams + imported.length;
  audit.totalPlayers = baseTotalPlayers + egyptPlayers;
  audit.supplementalCoverage = payload.supplementalCoverage;
  audit.snapshotBytes = Buffer.byteLength(js);
  audit.status = "complete";
  audit.allLeagueMinimumsMet = (audit.allLeagueMinimumsMet !== false);
  fs.writeFileSync(auditFile, JSON.stringify(audit, null, 2) + "\n");
  fs.writeFileSync(publicAuditFile, JSON.stringify(audit, null, 2) + "\n");
  console.log("EGYPTIAN_ROSTER_AUDIT " + JSON.stringify({
    importedClubs: imported.length,
    importedPlayers: egyptPlayers,
    skipped,
    totalSourcedClubs: audit.totalTeams,
    totalSourcedPlayers: audit.totalPlayers
  }));
}

main().catch(error => {
  console.error("Egyptian official roster refresh FAILED:", error && error.stack || error);
  process.exitCode = 1;
});
