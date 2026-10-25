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

async function main() {
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
