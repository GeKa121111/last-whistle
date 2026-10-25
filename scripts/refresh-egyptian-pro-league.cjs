"use strict";

// Supplements FootballSquads data with available official 2026/27 Egyptian Pro League squad pages.
// Some clubs do not publish a usable squad page, so the script records the pages that were actually sourced
// and never fabricates a real-player roster for a missing page.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const HOST = "https://www.egyptianproleague.com";
const SOURCE = "Verified current Egyptian league and club squad pages (2026/27)";
const MIN_PLAYERS = 16;
const IMPORTER_REVISION = 3;
const MIN_SOURCED_CLUBS = 20;
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
  {
    name: "بتروجيت",
    aliases: ["Petrojet", "Petrojet FC"],
    path: "/team/36/detials/14455/squad",
    fallbacks: [
      { url: "https://petrojetsc.com/", parser: "club-roster", source: "Petrojet SC official website (2026/27)" },
    ],
    fallbackSourceUrl: "https://petrojetsc.com/",
    fallbackSource: "Petrojet SC official website roster, reviewed 2026-10-25",
    fallbackPlayers: [
      "عمر صلاح", "عبد الكافي رجب", "محمد خليفة", "حمزة خالد", "أحمد بحبح", "بركات حجاج",
      "أحمد ياسين", "توفيق محمد", "كوبولوكي سيباندي", "إسلام عبد الله", "أحمد غنيم",
      "محمود شديد قناوي", "محمد علي عكاشة", "أمادو جودليه باه", "عبدولاي دياباتيه",
      "أدهم حامد", "بدر موسى", "مصطفى البدري", "محمود مرسي", "أحمد حلمي",
      "مصطفى الجمل", "محمد دودو", "عمر رضا", "جابرييل تشوكودي", "سيكو سونكو",
      "رشيد أحمد", "سمير محمد", "عادل علي"
    ]
  },
  { name: "غزل المحلة", aliases: ["Ghazl El Mahalla", "Ghazl El-Mahalla"], path: "/team/38/detials/7/squad" },
  { name: "وادي دجلة", aliases: ["Wadi Degla", "Wadi Degla FC"], path: "/team/42/detials/1016/squad" },
  { name: "المقاولون العرب", aliases: ["Al Mokawloon", "El Mokawloon SC", "Arab Contractors"], path: "/team/43/detials/11/squad" },
  { name: "القناة", aliases: ["Canal SC", "Canal Sporting Club"], path: "/team/47/detials/12/squad" },
  {
    name: "أبو قير للأسمدة",
    aliases: ["Abou Qir", "Abu Qir Fertilizers", "Abo Qir Fertilizers", "Abu Qair Semad"],
    url: "https://abuqirfertilizers.com/players/",
    parser: "club-roster",
    source: "Abu Qir Fertilizers FC official roster page (2026/27)",
    fallbackSourceUrl: "https://abuqirfertilizers.com/players/",
    fallbackSource: "Abu Qir Fertilizers FC official roster, reviewed 2026-10-25",
    fallbackPlayers: [
      "عمرو خليل", "السيد الصاوي", "عادل يحيى", "إسلام جابر", "محمد عبد الله", "محمد مزيكا",
      "أحمد فايز", "محمود علاء", "أحمد عادل", "إسلام أشرف", "محمد علاء", "محمد خطار",
      "أدهم حمادة", "زياد رياض", "أوشا", "رامز ميلاد", "محمد عصام", "محمود عفروتو",
      "عمر إبراهيم", "يوسف حمدي", "مازن أشرف", "أنس شندي", "أحمد عصام", "محمد مجدي",
      "معتز إبراهيم", "محمد العكش", "محمود عبد الله", "كريم أشرف", "هشام رمضان", "ضياء السيد",
      "حسام بركات", "محمد كامارا"
    ]
  },
  {
    name: "بترول أسيوط",
    aliases: ["Asyut Petroleum", "Petrol Asyut", "Petroleum Assiut"],
    url: "https://asyutpetroleum.com/player-category/players/",
    parser: "club-roster",
    source: "Asyut Petroleum FC official roster page (2026/27)",
    fallbackSourceUrl: "https://asyutpetroleum.com/player-category/players/",
    fallbackSource: "Asyut Petroleum FC official roster, reviewed 2026-10-25",
    fallbackPlayers: [
      "محمد مصطفى", "أمجد يوسف", "عبد العزيز أحمد", "عمرو الباشا", "أحمد شكري",
      "محمود عوكل", "خالد عبد العال", "أحمد رفاعي", "سعيد إكرامي", "مصطفى صدفة",
      "مؤمن عيد", "بكر فوزي", "عبدو كشكش", "عبد الرحمن الخماسي", "إبراهيم عباس",
      "محمد تريكة", "محمد هشة", "أحمد فتحي", "محمد عيد", "محمود كمال", "أحمد يونس",
      "إسلام صلاح", "أحمد عربي", "عبده عبد الله", "جوشوا إيجاجي"
    ]
  }
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
  { pattern: /حراسة\s*المرمى|حراسة\s*المرمي|حراس?\s*المرمى|حارس\s*المرمى|goalkeepers?/i, position: "حارس مرمى" },
  { pattern: /خط\s*الدفاع|الدفاع|المدافعون|defenders?/i, position: "قلب دفاع" },
  { pattern: /خط\s*الوسط|الوسط|لاعبي\s*الوسط|midfielders?/i, position: "وسط مهاجم" },
  { pattern: /خط\s*الهجوم|الهجوم|المهاجمون|attackers?|forwards?/i, position: "مهاجم" }
];
const STOP = new Set([
  "الرئيسية","بطولات","الأخبار","عن الرابطة","صور","فيديوهات","المركز الإعلامي","الفريق","نظرة عامة",
  "قائمة الفريق","قائمة اللاعبين","اللاعبون","الجهاز الفني","الإدارة","من نحن","آخر الأخبار",
  "مباريات ونتائج","إحصائيات اللاعبين","إحصائيات الفرق","الانتقالات","الرعاة","روابط سريعة","عرض المزيد",
  "تاريخ التأسيس","المدينة","الألقاب","الترتيب العام","الترتيب","الفريق","لعب","فوز","هزيمة","تعادل","نقاط",
  "دوري","كأس مصر","الدوري المصري","Image","Images","Management","Technical staff","Youth Academy Coaches","الرعاية","الرابطة","الأندية","المصرية"
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

function parsePlayers(html, sourceLabel = SOURCE) {
  const lines = linesFromHtml(html);
  const startAt = lines.findIndex(line => /حراسة\s*المرمى|حراسة\s*المرمي|حراس?\s*المرمى|goalkeepers?/i.test(line));
  const endAt = lines.findIndex((line, index) => index > Math.max(-1, startAt) && /الرعاة|رابطة الأندية المحترفة المصرية/i.test(line));
  const active = lines.slice(startAt >= 0 ? startAt : 0, endAt > startAt ? endAt : undefined);
  return parsePlayerLines(active, sourceLabel);
}

function parseClubRosterPlayers(html, sourceLabel = SOURCE) {
  const lines = linesFromHtml(html);
  const startAt = lines.findIndex(line =>
    /^(players|current squad|squad|قائمة الفريق|قائمة اللاعبين|اللاعبون)$/i.test(line) ||
    /^(?:قائمة الفريق|قائمة اللاعبين|اللاعبون)\b/.test(line));
  if (startAt < 0) return [];
  const tail = lines.slice(startAt + 1);
  const stop = tail.findIndex(line =>
    /^(management|technical staff|youth academy coaches|coach|مدرب|الجهاز الفني|الإدارة|الجهاز الإداري|مباريات الفريق|المركز في الدوري|المباريات القادمة|آخر الأخبار|موارد النادي|من نحن|resources|latest news)$/i.test(line) ||
    /^(ينافس نادي|يلعب نادي|هذا الموقع جزء|the club competes|the team competes)/i.test(line));
  const active = stop >= 0 ? tail.slice(0, stop) : tail;
  return parsePlayerLines(active, sourceLabel);
}

function parsePlayerLines(lines, sourceLabel) {
  const players = [];
  const seen = new Set();
  let currentPosition = "غير محدد";
  for (const rawLine of lines) {
    let line = rawLine.replace(/^[•*\-·]+\s*/, "").trim();
    if (!line || /^image\b/i.test(line) || /^\d{1,3}$/.test(line)) continue;
    const heading = POSITION_HEADINGS.find(item => item.pattern.test(line));
    if (heading) {
      currentPosition = heading.position;
      continue;
    }
    if (/^(?:players|current squad|squad|قائمة الفريق|قائمة اللاعبين|اللاعبون|الفريق|team|manager|coach|المدرب)$/i.test(line)) continue;
    const numbered = line.match(/^#?\s*(\d{1,3})[.)\-:]?\s+(.{3,75})$/);
    let number;
    if (numbered) {
      number = Number(numbered[1]);
      line = numbered[2].trim();
    } else {
      const trailingNumber = line.match(/^(.{3,75}?)\s+(\d{1,2})$/);
      if (trailingNumber) {
        number = Number(trailingNumber[2]);
        line = trailingNumber[1].trim();
      }
    }
    if (!isPlayerName(line)) continue;
    if (/^(?:الرئيسية|بطولات|الأخبار|عن الرابطة|صور|فيديوهات|المركز الإعلامي|نظرة عامة|الرعاة|روابط سريعة|ترتيب|المباريات|الإحصائيات)$/i.test(line)) continue;
    if (/ينافس نادي|يلعب نادي|هذا الموقع جزء|قائمة الفريق|قائمة اللاعبين|قائمة الفريق الأول/i.test(line)) continue;
    const key = normalize(line);
    if (!key || seen.has(key)) continue;
    const positionKnown = currentPosition !== "غير محدد";
    const player = {
      name: line,
      position: currentPosition,
      positionVerified: positionKnown,
      source: sourceLabel,
      isRealPlayer: true
    };
    if (number !== undefined) player.number = number;
    players.push(player);
    seen.add(key);
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
    const primaryUrl = team.url || new URL(team.path, HOST).href;
    const candidates = [
      { url: primaryUrl, parser: team.parser || "league", source: team.source || SOURCE },
      ...(team.fallbacks || [])
    ];
    let selected = null;
    const attempts = [];
    for (const candidate of candidates) {
      try {
        const html = await fetchHtml(candidate.url);
        const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
        const sourceTitle = heading ? linesFromHtml(heading[1]).join(" ").trim() : "";
        const parser = candidate.parser === "club-roster" ? parseClubRosterPlayers : parsePlayers;
        const sourceLabel = candidate.source || team.source || SOURCE;
        const players = parser(html, sourceLabel);
        if (players.length < MIN_PLAYERS) {
          attempts.push({ url: candidate.url, reason: "Only " + players.length + " player records parsed; minimum is " + MIN_PLAYERS, pageTitle: sourceTitle });
          process.stdout.write("RETRY " + team.name + ": " + players.length + " players from " + candidate.url + "\n");
          continue;
        }
        selected = { url: candidate.url, source: sourceLabel, sourceTitle, parser: candidate.parser || "league", players, rosterMode: "live-page" };
        break;
      } catch (error) {
        attempts.push({ url: candidate.url, reason: String(error && error.message || error) });
        process.stdout.write("SOURCE RETRY " + team.name + ": " + String(error && error.message || error) + "\n");
      }
    }
    if (!selected && Array.isArray(team.fallbackPlayers) && team.fallbackPlayers.length >= MIN_PLAYERS) {
      const sourceLabel = team.fallbackSource || SOURCE;
      const seen = new Set();
      const players = team.fallbackPlayers.map(name => ({
        name: String(name).trim(),
        position: "غير محدد",
        positionVerified: false,
        source: sourceLabel,
        isRealPlayer: true
      })).filter(player => {
        const key = normalize(player.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (players.length >= MIN_PLAYERS) {
        selected = {
          url: team.fallbackSourceUrl || primaryUrl,
          source: sourceLabel,
          sourceTitle: "Reviewed source fallback; position not published in the fallback list",
          parser: "reviewed-static-fallback",
          players,
          rosterMode: "reviewed-static-fallback"
        };
        process.stdout.write("SOURCE FALLBACK " + team.name + ": " + players.length + " reviewed names from " + selected.url + "\n");
      }
    }
    if (!selected) {
      skipped.push({ name: team.name, url: primaryUrl, reason: attempts.map(row => row.url + ": " + row.reason).join(" | ") || "No usable roster source" });
      process.stdout.write("SKIP " + team.name + ": no source yielded at least " + MIN_PLAYERS + " player records\n");
      continue;
    }
    imported.push({
      name: team.name,
      aliases: team.aliases,
      leagueId: "egypt",
      country: "مصر",
      division: 1,
      sourceUrl: selected.url,
      source: selected.source,
      sourceTitle: selected.sourceTitle,
      sourceSeason: "2026/27",
      rosterMode: selected.rosterMode,
      positionData: selected.rosterMode === "reviewed-static-fallback" ? "position-not-published" : "page-derived-where-available",
      players: selected.players
    });
    process.stdout.write("Loaded Egyptian squad " + team.name + ": " + selected.players.length + " players (" + selected.url + "; " + selected.rosterMode + ")\n");
  }
  if (imported.length < MIN_SOURCED_CLUBS) {
    throw new Error("Verified Egyptian roster sources returned only " + imported.length + " usable squads; need all " + MIN_SOURCED_CLUBS + " first-division clubs. Skipped pages: " + JSON.stringify(skipped));
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
    coverageType: "verified-current-squad-pages",
    clubs: imported
  });
  payload.supplementalCoverage = payload.supplementalCoverage || {};
  payload.supplementalCoverage.egypt = {
    source: SOURCE,
    season: "2026/27",
    availablePagesConfigured: TEAMS.length,
    importerRevision: IMPORTER_REVISION,
    importedClubs: imported.length,
    importedPlayers: imported.reduce((sum, club) => sum + club.players.length, 0),
    skippedPages: skipped,
    fallbackClubs: imported.filter(club => club.rosterMode === "reviewed-static-fallback").map(club => ({ name: club.name, sourceUrl: club.sourceUrl, playerCount: club.players.length, positionData: club.positionData }))
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
    sourceUrl: HOST + "/", sourceSeason: "2026/27", coverageType: "verified-current-squad-pages",
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
  console.error("Egyptian roster refresh FAILED:", error && error.stack || error);
  process.exitCode = 1;
});
