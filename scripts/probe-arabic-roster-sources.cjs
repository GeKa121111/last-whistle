"use strict";

const BASE = "https://intikalat.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml"
};
const LEAGUES = [
  { key: "tunisia", url: "https://intikalat.com/league-tun-ligueprofessionnelle-1.html" }
];

function plainText(value) {
  return String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}

function anchors(html, baseUrl) {
  const out = [];
  const re = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    let url;
    try { url = new URL(match[3].replace(/&amp;/g, "&"), baseUrl).href; } catch { continue; }
    out.push({ url, text: plainText(match[5]), raw: match[5].slice(0, 180) });
  }
  return out;
}

async function fetchPage(url) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  return { url, status: response.status, html };
}

function summarizeLeague(page) {
  const as = anchors(page.html, page.url);
  const title = plainText((page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [,""])[1]);
  const teamLinks = as.filter(link =>
    /^\d+\s+.+?\s+\d+\s*لاعب(?:\s|$)/u.test(link.text) ||
    /^\d+\s+.+?\s+\d+\s+(?:players|joueurs)(?:\s|$)/i.test(link.text));
  const playerTab = as.find(link => /^(اللاعبون|اللاعبين|players|joueurs)$/iu.test(link.text));
  const egyptLink = as.find(link => /الدوري المصري الممتاز/.test(link.text));
  const moroccoLink = as.find(link => /الدوري المغربي للمحترفين/.test(link.text));
  return {
    url: page.url, status: page.status, bytes: page.html.length, title,
    totalAnchors: as.length,
    teamLinkCount: teamLinks.length,
    teams: teamLinks.slice(0, 20).map(link => ({ name: link.text, url: link.url })),
    playerTab: playerTab ? { text: playerTab.text, url: playerTab.url } : null,
    egyptLeagueLink: egyptLink ? { text: egyptLink.text, url: egyptLink.url } : null,
    moroccoLeagueLink: moroccoLink ? { text: moroccoLink.text, url: moroccoLink.url } : null
  };
}

function sampleSquadPage(page) {
  const as = anchors(page.html, page.url);
  const rows = [...page.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .slice(0, 20).map(match => plainText(match[1])).filter(Boolean);
  const playerishAnchors = as.filter(link =>
    link.text.length >= 3 && link.text.length <= 80 &&
    /player|joueur|futbolista|jugador|\/p\/|\/player|\/joueur|\/jugador/i.test(link.url))
    .slice(0, 30).map(link => ({ name: link.text, url: link.url }));
  const heading = plainText((page.html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [,""])[1]);
  return { url: page.url, status: page.status, bytes: page.html.length, title: heading,
    tableRowCount: (page.html.match(/<tr\b/gi) || []).length, sampleRows: rows, playerishAnchors };
}


async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "LastWhistleRosterSourceProbe/1.0", "Accept": "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  const raw = await response.text();
  let json;
  try { json = JSON.parse(raw); } catch { json = null; }
  return { url, status: response.status, json, bytes: raw.length, contentType: response.headers.get("content-type") || "" };
}

function compactTeam(team) {
  return {
    name: team.strTeam || team.name || "",
    id: team.idTeam || team.id || "",
    league: team.strLeague || team.league || "",
    country: team.strCountry || team.country || "",
    formed: team.intFormedYear || "",
    website: team.strWebsite || "",
    badge: !!(team.strBadge || team.badge),
    lastUpdated: team.dateUpdated || team.strUpdated || ""
  };
}
function compactPlayer(player) {
  return {
    name: player.strPlayer || player.name || "",
    id: player.idPlayer || player.id || "",
    position: player.strPosition || player.position || "",
    dateBorn: player.dateBorn || player.born || "",
    nationality: player.strNationality || player.nationality || "",
    team: player.strTeam || player.team || "",
    teamId: player.idTeam || "",
    updated: player.dateUpdated || "",
    description: !!(player.strDescriptionEN || player.description)
  };
}

async function probeSportsDb() {
  const api = "https://www.thesportsdb.com/api/v1/json/123";
  const countryQueries = [
    { country: "Egypt", url: api + "/search_all_teams.php?s=Soccer&c=Egypt" },
    { country: "Morocco", url: api + "/search_all_teams.php?s=Soccer&c=Morocco" },
    { country: "Tunisia", url: api + "/search_all_teams.php?s=Soccer&c=Tunisia" }
  ];
  for (const query of countryQueries) {
    try {
      const result = await fetchJson(query.url);
      const teams = Array.isArray(result.json && result.json.teams) ? result.json.teams : [];
      const relevant = teams.filter(team => /egypt|tunisia|morocco|premier|ligue|botola|pro league/i.test(
        [team.strCountry, team.strLeague, team.strTeam].join(" ")));
      console.log("SPORTSDB_COUNTRY_PROBE " + JSON.stringify({
        country: query.country, url: result.url, status: result.status, bytes: result.bytes,
        keys: result.json && Object.keys(result.json), teamCount: teams.length,
        leagueNames: [...new Set(teams.map(team => team.strLeague).filter(Boolean))].slice(0, 25),
        sampleTeams: (relevant.length ? relevant : teams).slice(0, 14).map(compactTeam)
      }));
    } catch (error) {
      console.log("SPORTSDB_COUNTRY_ERROR " + JSON.stringify({ country: query.country, error: String(error) }));
    }
  }

  const teamQueries = [
    { name: "Al Ahly", url: api + "/searchteams.php?t=Al%20Ahly" },
    { name: "Zamalek", url: api + "/searchteams.php?t=Zamalek" },
    { name: "Raja Casablanca", url: api + "/searchteams.php?t=Raja%20Casablanca" },
    { name: "Wydad Casablanca", url: api + "/searchteams.php?t=Wydad%20Casablanca" },
    { name: "Espérance de Tunis", url: api + "/searchteams.php?t=Esperance%20de%20Tunis" },
    { name: "Club Africain", url: api + "/searchteams.php?t=Club%20Africain" }
  ];
  for (const query of teamQueries) {
    try {
      const result = await fetchJson(query.url);
      const teams = Array.isArray(result.json && result.json.teams) ? result.json.teams : [];
      const team = teams[0];
      let roster = null;
      if (team && team.idTeam) {
        try {
          const squad = await fetchJson(api + "/lookup_all_players.php?id=" + encodeURIComponent(team.idTeam));
          const players = Array.isArray(squad.json && squad.json.player) ? squad.json.player
            : Array.isArray(squad.json && squad.json.players) ? squad.json.players : [];
          roster = {
            status: squad.status, bytes: squad.bytes, playerCount: players.length,
            players: players.slice(0, 25).map(compactPlayer)
          };
        } catch (error) {
          roster = { error: String(error) };
        }
      }
      console.log("SPORTSDB_TEAM_PROBE " + JSON.stringify({
        query: query.name, status: result.status, bytes: result.bytes,
        matches: teams.slice(0, 3).map(compactTeam), roster
      }));
    } catch (error) {
      console.log("SPORTSDB_TEAM_ERROR " + JSON.stringify({ query: query.name, error: String(error) }));
    }
  }
}

async function main() {
  await probeSportsDb();
  for (const league of LEAGUES) {
    try {
      const page = await fetchPage(league.url);
      const summary = summarizeLeague(page);
      console.log("INTIKALAT_LEAGUE_PROBE " + JSON.stringify({ key: league.key, ...summary }));
      const firstTeam = summary.teams[0];
      if (firstTeam) {
        try {
          const squadPage = await fetchPage(firstTeam.url);
          console.log("INTIKALAT_TEAM_PROBE " + JSON.stringify(sampleSquadPage(squadPage)));
        } catch (error) {
          console.log("INTIKALAT_TEAM_ERROR " + JSON.stringify({ url: firstTeam.url, error: String(error) }));
        }
      }
      for (const other of [summary.egyptLeagueLink, summary.moroccoLeagueLink, summary.playerTab]) {
        if (!other || other.url === league.url) continue;
        try {
          const linkedPage = await fetchPage(other.url);
          const linkedSummary = summarizeLeague(linkedPage);
          console.log("INTIKALAT_LINKED_PAGE_PROBE " + JSON.stringify({ linkText: other.text, ...linkedSummary }));
        } catch (error) {
          console.log("INTIKALAT_LINKED_PAGE_ERROR " + JSON.stringify({ linkText: other.text, url: other.url, error: String(error) }));
        }
      }
    } catch (error) {
      console.log("INTIKALAT_SOURCE_ERROR " + JSON.stringify({ key: league.key, url: league.url, error: String(error) }));
    }
  }
}

main().catch(error => {
  console.log("INTIKALAT_PROBE_FATAL " + String(error));
  process.exitCode = 0;
});
