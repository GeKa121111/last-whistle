/* Living football-world simulation for LAST WHISTLE.
 * Club recruitment, player progression, standings and statistics are deterministic and persisted in the career save.
 * All ratings and future statistics are simulation estimates, not official live football data.
 */
(function (global) {
  "use strict";
  const VERSION = 1;
  const TARGETS = Object.freeze({ goalkeeper: 2, defender: 5, midfielder: 5, attacker: 4 });
  const POSITIONS = Object.freeze({
    goalkeeper: ["حارس مرمى"],
    defender: ["قلب دفاع", "ظهير"],
    midfielder: ["وسط دفاعي", "وسط مهاجم"],
    attacker: ["جناح", "مهاجم"]
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
  function normalize(value) {
    return String(value == null ? "" : value).normalize("NFKC").toLocaleLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
      .replace(/[^a-z0-9\u0600-\u06FF]/g, "");
  }
  function hash(value) {
    let h = 2166136261;
    for (const char of String(value)) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  function random(seed) {
    let value = (Number(seed) >>> 0) || 0x9e3779b9;
    return () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickPosition(group, rng) {
    const choices = POSITIONS[group] || POSITIONS.midfielder;
    return choices[Math.floor(rng() * choices.length)];
  }
  function groupForPosition(position) {
    const p = normalize(position);
    if (p.includes("حارس")) return "goalkeeper";
    if (p.includes("دفاع") || p.includes("ظهير") || p.includes("مدافع")) return "defender";
    if (p.includes("مهاجم") || p.includes("جناح") || p.includes("رأسحربة") || p.includes("راسحربه")) return "attacker";
    return "midfielder";
  }
  function clubKey(name, country) {
    return normalize(country) + "|" + normalize(name);
  }
  function marketValue(player, seller) {
    const ovr = clamp(player.ovr, 35, 99);
    const potential = clamp(player.potential, ovr, 99);
    return Math.max(12, Math.round(Math.pow(Math.max(1, ovr - 35), 2) * 0.18
      + potential * 1.12 + Math.max(0, Number(seller && seller.prestige) || 50) * 0.28));
  }
  function emptyWorld() {
    return {
      schemaVersion: VERSION, dbVersion: 0, currentSeason: 1, lastCompletedSeason: 0,
      lastAdvancedTo: 0, clubs: {}, players: {}, playerHistory: {}, seasonStats: {},
      leagueTables: {}, completedSeasons: [], transfers: [], marketReports: [],
      nextGeneratedPlayer: 1, transferSequence: 0, notes: []
    };
  }
  function addClub(world, row, db) {
    const id = clubKey(row.name, row.country);
    if (world.clubs[id]) return world.clubs[id];
    const profile = db && typeof db.leagueById === "function" ? db.leagueById(row.leagueId) || {} : {};
    const power = clamp(row.ovr || row.power || 55, 35, 97);
    const club = {
      id, name: String(row.name || "نادي غير محدد"), country: String(row.country || ""),
      leagueId: String(row.leagueId || profile.id || ""), leagueName: String(row.leagueName || profile.league || ""),
      leagueEnglish: String(row.leagueEnglish || profile.english || ""), confederation: String(profile.confederation || ""),
      division: Math.max(1, int(row.division, 1)), currency: String(profile.currency || "€"),
      basePower: power, power, prestige: clamp(row.prestige || power, 25, 100),
      budget: Math.round(90 + power * 10 + (Number(row.prestige) || power) * 2.8),
      roster: [], matchesPerSeason: Math.max(20, int(profile.matches, 34)),
      updatedSeason: 1
    };
    world.clubs[id] = club;
    return club;
  }
  function makePlayer(world, row, club, index, generated, forcedGroup) {
    const rng = random(hash(club.id + "|" + (row && row.name || "academy") + "|" + index + "|" + VERSION));
    let position = String(row && row.position || "");
    if (!position || normalize(position).includes("غيرمحدد")) position = pickPosition(forcedGroup || "midfielder", rng);
    const group = groupForPosition(position);
    const ovr = clamp(row && (row.ovr || row.power) || club.power - 5 + Math.round(rng() * 9 - 5), 38, 96);
    const age = Math.max(16, Math.min(37, int(row && row.age, 18 + Math.floor(rng() * 15))));
    const id = generated
      ? "academy-" + hash(club.id + "|" + index + "|" + (row && row.name || "player")).toString(36)
      : "player-" + hash(normalize(row && row.name) || (club.id + "|" + index)).toString(36);
    if (world.players[id]) return world.players[id];
    const player = {
      id, name: String(row && row.name || (club.name + " • ناشئ " + String(index + 1).padStart(2, "0"))),
      clubId: club.id, country: club.country, leagueId: club.leagueId, division: club.division,
      position, group, ovr, potential: clamp(row && row.potential || ovr + 3 + Math.floor(rng() * 18), ovr, 97),
      age, prestige: club.prestige, contractSeasons: 1 + Math.floor(rng() * 5),
      isGenerated: !!generated, isRealPlayer: !generated && row && row.isRealPlayer !== false,
      lastRating: 0, transferListed: false
    };
    world.players[id] = player;
    club.roster.push(id);
    return player;
  }
  function fillRoster(world, club) {
    const minimum = 16;
    const counts = Object.fromEntries(Object.keys(TARGETS).map(key => [key, 0]));
    club.roster.forEach(id => {
      const player = world.players[id];
      if (player) counts[player.group] = (counts[player.group] || 0) + 1;
    });
    while (club.roster.length < minimum) {
      const group = Object.keys(TARGETS).sort((a, b) =>
        counts[a] / TARGETS[a] - counts[b] / TARGETS[b] || counts[a] - counts[b] || a.localeCompare(b))[0];
      const index = world.nextGeneratedPlayer++;
      const rng = random(hash(club.id + "|" + index + "|" + world.dbVersion));
      const ovr = clamp(club.basePower - 8 + Math.round(rng() * 12 - 5), 38, 88);
      const row = { name: club.name + " • ناشئ " + String(index).padStart(3, "0"), position: pickPosition(group, rng), ovr, potential: clamp(ovr + 5 + Math.floor(rng() * 15), ovr, 96), age: 17 + Math.floor(rng() * 7) };
      const player = makePlayer(world, row, club, index, true, group);
      counts[player.group] = (counts[player.group] || 0) + 1;
    }
  }
  function seedWorld(db) {
    const world = emptyWorld();
    world.dbVersion = int(db && db.version, 0);
    const clubs = db && typeof db.clubs === "function" ? db.clubs() : [];
    const seenRealNames = new Set();
    for (const raw of clubs) {
      if (!raw || !raw.name || !raw.country) continue;
      const club = addClub(world, raw, db);
      const rows = Array.isArray(raw.players) && raw.players.length ? raw.players
        : db && typeof db.playerRecordsForClub === "function" ? db.playerRecordsForClub(raw.name, raw.country) : [];
      let index = 0;
      for (const row of rows) {
        const nameKey = normalize(row && row.name);
        if (!nameKey || seenRealNames.has(nameKey)) continue;
        seenRealNames.add(nameKey);
        makePlayer(world, row, club, index++, false);
      }
      fillRoster(world, club);
    }
    world.currentSeason = 1;
    return world;
  }
  function reconcileDatabase(world, db) {
    if (!world || !world.clubs) return seedWorld(db);
    const rows = db && typeof db.clubs === "function" ? db.clubs() : [];
    for (const row of rows) {
      if (!row || !row.name || !row.country) continue;
      const id = clubKey(row.name, row.country);
      if (!world.clubs[id]) {
        const club = addClub(world, row, db);
        const records = Array.isArray(row.players) ? row.players : [];
        records.forEach((player, index) => makePlayer(world, player, club, index, false));
        fillRoster(world, club);
      } else {
        const club = world.clubs[id];
        const profile = db && typeof db.leagueById === "function" ? db.leagueById(row.leagueId) || {} : {};
        club.leagueName = String(profile.league || club.leagueName || "");
        club.leagueEnglish = String(profile.english || club.leagueEnglish || "");
        club.matchesPerSeason = Math.max(20, int(profile.matches, club.matchesPerSeason || 34));
      }
    }
    world.dbVersion = int(db && db.version, world.dbVersion || 0);
    Object.values(world.clubs).forEach(club => fillRoster(world, club));
    return world;
  }
  function ensureState(save, db) {
    if (!save || typeof save !== "object") return emptyWorld();
    let world = save.worldSimulation;
    if (!world || typeof world !== "object" || !world.clubs || !world.players || Number(world.schemaVersion) !== VERSION) {
      world = seedWorld(db);
      save.worldSimulation = world;
      return world;
    }
    world.currentSeason = Math.max(1, int(world.currentSeason, int(save.season, 1)));
    world.completedSeasons = Array.isArray(world.completedSeasons) ? world.completedSeasons : [];
    world.seasonStats = world.seasonStats && typeof world.seasonStats === "object" ? world.seasonStats : {};
    world.leagueTables = world.leagueTables && typeof world.leagueTables === "object" ? world.leagueTables : {};
    world.transfers = Array.isArray(world.transfers) ? world.transfers : [];
    world.marketReports = Array.isArray(world.marketReports) ? world.marketReports : [];
    world.playerHistory = world.playerHistory && typeof world.playerHistory === "object" ? world.playerHistory : {};
    world.notes = Array.isArray(world.notes) ? world.notes : [];
    world.nextGeneratedPlayer = Math.max(1, int(world.nextGeneratedPlayer, 1));
    world.transferSequence = Math.max(0, int(world.transferSequence, 0));
    reconcileDatabase(world, db);
    if (world.lastAdvancedTo >= Number(save.season || 1)) world.currentSeason = Number(save.season || 1);
    return world;
  }
  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 55;
  }
  function rosterPlayers(world, club) {
    return (club.roster || []).map(id => world.players[id]).filter(Boolean);
  }
  function roleStats(world, club) {
    const output = {};
    for (const group of Object.keys(TARGETS)) {
      const rows = rosterPlayers(world, club).filter(player => player.group === group);
      output[group] = { count: rows.length, average: average(rows.map(player => Number(player.ovr) || 50)),
        best: rows.length ? Math.max(...rows.map(player => Number(player.ovr) || 50)) : 0 };
    }
    return output;
  }
  function generatePlayerSeason(world, player, season, progress = 1) {
    const club = world.clubs[player.clubId];
    const rng = random(hash(player.id + "|" + season + "|season-stat-v" + VERSION));
    const power = club ? Number(club.power) || 55 : 55;
    const matches = club ? Math.max(20, int(club.matchesPerSeason, 34)) : 34;
    const ovr = clamp(player.ovr, 35, 99);
    const group = player.group || groupForPosition(player.position);
    const peers = club ? rosterPlayers(world, club).filter(row => row.group === group) : [player];
    const roleStrength = peers.length ? (peers.slice().sort((a, b) => b.ovr - a.ovr).findIndex(row => row.id === player.id)) : 0;
    const expectedApps = clamp(Math.round(matches * (0.63 + ovr * 0.0032 + rng() * 0.12 - roleStrength * 0.075)), 4, matches);
    const appearances = Math.round(expectedApps * clamp(progress, 0, 1));
    const rate = group === "attacker" ? 0.31 : group === "midfielder" ? 0.115 : group === "defender" ? 0.038 : 0.0015;
    const assistRate = group === "attacker" ? 0.18 : group === "midfielder" ? 0.215 : group === "defender" ? 0.055 : 0.002;
    const performanceMultiplier = clamp(0.72 + ovr / 100 * 0.38 + (power - 65) * 0.002, 0.72, 1.18);
    const fullGoals = Math.max(0, Math.round(expectedApps * rate * performanceMultiplier + rng() * (group === "attacker" ? 5.5 : 2.1) - 1));
    const fullAssists = Math.max(0, Math.round(expectedApps * assistRate * performanceMultiplier + rng() * 3.2 - 0.5));
    const fullRating = expectedApps > 0 ? clamp(6.15 + (ovr - 60) * 0.026 + (power - 65) * 0.004 + rng() * 0.65 - 0.30, 5.1, 8.95) : 0;
    const goals = Math.round(fullGoals * clamp(progress, 0, 1));
    const assists = Math.round(fullAssists * clamp(progress, 0, 1));
    const values = {
      id: player.id, season: Number(season), name: player.name, club: club ? club.name : "",
      clubName: club ? club.name : "", country: player.country, leagueId: player.leagueId,
      division: player.division || 1, position: player.position, group, age: player.age, ovr,
      potential: player.potential, appearances: expectedApps, goals: fullGoals, assists: fullAssists,
      averageRating: Number(fullRating.toFixed(2)), leagueStrength: leagueStrength(world, player.leagueId),
      prestige: club ? club.prestige : player.prestige, confederation: club ? club.confederation : "",
      originConfederation: club ? club.confederation : "", isGenerated: !!player.isGenerated,
      realPlayer: !player.isGenerated, score: Number((fullRating * 9 + fullGoals * 0.95 + fullAssists * 0.62 + ovr * 0.08).toFixed(3)),
      weightedGoals: Number((fullGoals * (0.82 + leagueStrength(world, player.leagueId) / 450)).toFixed(3))
    };
    values.displayStats = { appearances, goals, assists, averageRating: Number(fullRating.toFixed(2)) };
    values.seasonStats = { season: Number(season), appearances: expectedApps, goals: fullGoals, assists: fullAssists,
      averageRating: Number(fullRating.toFixed(2)), ovr, club: values.club, country: values.country };
    return values;
  }
  function leagueStrength(world, leagueId) {
    const clubs = Object.values(world.clubs).filter(club => club.leagueId === leagueId && club.division === 1);
    return Math.round(average(clubs.map(club => Number(club.power) || 55)));
  }
  function getSeasonLines(save, season, progress = 1, db) {
    const world = ensureState(save, db);
    const targetSeason = Math.max(1, int(season, int(save.season, 1)));
    const scale = clamp(progress, 0, 1);
    const completed = world.seasonStats[String(targetSeason)];
    const fullRows = Array.isArray(completed) ? completed : Object.values(world.players).map(player =>
      generatePlayerSeason(world, player, targetSeason, 1));
    return fullRows.map(row => {
      const apps = Math.round(Number(row.appearances || row.seasonStats && row.seasonStats.appearances || 0) * scale);
      const goals = Math.round(Number(row.goals || 0) * scale);
      const assists = Math.round(Number(row.assists || 0) * scale);
      const seasonStats = row.seasonStats || {
        season: targetSeason, appearances: Number(row.appearances) || 0, goals: Number(row.goals) || 0,
        assists: Number(row.assists) || 0, averageRating: Number(row.averageRating) || 0,
        ovr: Number(row.ovr) || 50, club: row.club || row.clubName || "", country: row.country || ""
      };
      return { ...row, id: row.id, appearances: apps, goals, assists,
        averageRating: apps > 0 ? Number(row.averageRating) || 0 : 0,
        seasonStats: { ...seasonStats }, displayStats: { appearances: apps, goals, assists, averageRating: apps > 0 ? Number(row.averageRating) || 0 : 0 } };
    });
  }
  function simulateLeagueTables(world, season, progress = 1) {
    const byLeague = new Map();
    for (const club of Object.values(world.clubs).filter(row => row.division === 1)) {
      if (!byLeague.has(club.leagueId)) byLeague.set(club.leagueId, []);
      byLeague.get(club.leagueId).push(club);
    }
    const tables = {};
    for (const [leagueId, clubs] of byLeague.entries()) {
      const mid = average(clubs.map(club => club.power));
      const rows = clubs.map(club => {
        const rng = random(hash(leagueId + "|" + club.id + "|" + season + "|table-v" + VERSION));
        const matches = club.matchesPerSeason || 34;
        const quality = Number(club.power || 55) - mid;
        const draws = Math.round(matches * clamp(0.23 + rng() * 0.05, 0.18, 0.30));
        const expectedWins = clamp(0.40 + quality * 0.017 + rng() * 0.12 - 0.06, 0.10, 0.76);
        const wins = clamp(Math.round(matches * expectedWins), 0, matches - draws);
        const losses = matches - wins - draws;
        const goalsFor = Math.max(0, Math.round(matches * clamp(1.18 + quality * 0.022 + rng() * 0.38, 0.55, 2.55)));
        const goalsAgainst = Math.max(0, Math.round(matches * clamp(1.24 - quality * 0.018 + rng() * 0.38, 0.50, 2.65)));
        return { season: Number(season), leagueId, country: club.country, clubId: club.id,
          club: club.name, power: Math.round(club.power), played: matches, w: wins, d: draws, l: losses,
          gf: goalsFor, ga: goalsAgainst, pts: wins * 3 + draws,
          form: Number((6.0 + quality * 0.025 + rng() * 0.6).toFixed(2)) };
      });
      const ranked = rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || b.power - a.power);
      tables[leagueId] = ranked.map((row, index) => ({ ...row, rank: index + 1,
        status: index === 0 ? "بطل المحاكاة" : index >= ranked.length - 2 ? "منطقة الهبوط — محاكاة" : "مركز الدوري" }));
    }
    return tables;
  }
  function completeSeason(save, season, db) {
    const world = ensureState(save, db);
    const year = Math.max(1, int(season, int(save.season, 1)));
    if (world.completedSeasons.includes(year)) return {
      season: year, rows: world.seasonStats[String(year)] || [], tables: world.leagueTables[String(year)] || {},
      alreadyCompleted: true, transfers: (world.marketReports.find(row => row.season === year) || {}).moves || 0
    };
    const rows = Object.values(world.players).map(player => generatePlayerSeason(world, player, year, 1));
    const tables = simulateLeagueTables(world, year, 1);
    world.seasonStats[String(year)] = rows.map(row => ({ ...row, displayStats: undefined }));
    world.leagueTables[String(year)] = tables;
    world.completedSeasons.push(year);
    world.completedSeasons = world.completedSeasons.sort((a, b) => a - b).slice(-20);
    world.lastCompletedSeason = Math.max(world.lastCompletedSeason || 0, year);
    world.currentSeason = year;
    return { season: year, rows, tables, alreadyCompleted: false, transfers: 0 };
  }
  function roleAverages(world, club) {
    const all = rosterPlayers(world, club);
    const stats = {};
    for (const group of Object.keys(TARGETS)) {
      const rows = all.filter(player => player.group === group);
      stats[group] = { count: rows.length, average: average(rows.map(player => player.ovr)),
        best: rows.length ? Math.max(...rows.map(player => player.ovr)) : 0 };
    }
    return stats;
  }
  function needScore(club, group, roleStats) {
    const row = roleStats[group];
    const deficit = Math.max(0, TARGETS[group] - row.count);
    const qualityGap = Math.max(0, club.power - row.average - 4);
    const topQualityGap = Math.max(0, club.power - row.best - 6);
    const weakUnitPenalty = row.average < club.power - 5 ? 5 : 0;
    return deficit * 11 + qualityGap * 1.25 + topQualityGap * 0.9
      + weakUnitPenalty + (row.count === 0 ? 18 : 0);
  }
  function sellingCandidate(world, seller, group, usedPlayers) {
    const rows = rosterPlayers(world, seller).filter(player => player.group === group && !usedPlayers.has(player.id));
    if (rows.length <= Math.max(1, Math.min(2, TARGETS[group] - 1))) return null;
    const quality = roleStats(world, seller)[group];
    const candidates = rows.filter(player => player.ovr < quality.best - 2 || player.age >= 29
      || player.contractSeasons <= 1 || player.ovr < seller.power - 12);
    candidates.sort((a, b) => {
      const aScore = (a.age >= 29 ? 8 : 0) + (a.contractSeasons <= 1 ? 5 : 0)
        + Math.max(0, seller.power - a.ovr) * 0.8 - a.potential * 0.13 + hash(a.id + "|" + seller.updatedSeason) % 17 / 10;
      const bScore = (b.age >= 29 ? 8 : 0) + (b.contractSeasons <= 1 ? 5 : 0)
        + Math.max(0, seller.power - b.ovr) * 0.8 - b.potential * 0.13 + hash(b.id + "|" + seller.updatedSeason) % 17 / 10;
      return bScore - aScore;
    });
    return candidates[0] || null;
  }
  function runTransferWindow(world, season) {
    const clubs = Object.values(world.clubs).filter(club => club.division === 1);
    const alreadyUsedClubs = new Set(), alreadyUsedPlayers = new Set(), moves = [];
    const maxMoves = Math.max(6, Math.min(22, Math.round(clubs.length * 0.25)));
    const buyers = clubs.slice().sort((a, b) => {
      const aStrength = a.power + a.prestige * 0.04 + hash(a.id + "|" + season + "|buyer") % 29 / 100;
      const bStrength = b.power + b.prestige * 0.04 + hash(b.id + "|" + season + "|buyer") % 29 / 100;
      return bStrength - aStrength;
    });
    for (const buyer of buyers) {
      if (moves.length >= maxMoves) break;
      if (alreadyUsedClubs.has(buyer.id)) continue;
      // Avoid squad hoarding: each AI club has a soft roster ceiling before buying.
      if (buyer.roster.length >= 18) continue;
      const roles = roleAverages(world, buyer);
      const needs = Object.keys(TARGETS).map(group => ({ group, score: needScore(buyer, group, roles) }))
        .sort((a, b) => b.score - a.score);
      const need = needs[0];
      if (!need || need.score < 4) continue;
      const candidates = [];
      for (const seller of clubs) {
        if (seller.id === buyer.id || alreadyUsedClubs.has(seller.id)) continue;
        const player = sellingCandidate(world, seller, need.group, alreadyUsedPlayers);
        if (!player) continue;
        const fee = marketValue(player, seller);
        if (fee > buyer.budget) continue;
        const powerGap = buyer.power - player.ovr;
        if (powerGap < -14 || powerGap > 18) continue;
        const ageFactor = player.age <= 23 ? 7 : player.age <= 27 ? 4 : player.age >= 31 ? -5 : 0;
        const potentialFactor = (player.potential - player.ovr) * 0.65;
        const needsFactor = need.score * 0.8;
        const prestigeFactor = (buyer.prestige - seller.prestige) * 0.04;
        const distancePenalty = buyer.leagueId === seller.leagueId ? 0 : 1.5;
        const tie = hash(player.id + "|" + buyer.id + "|" + season) % 41 / 100;
        const score = player.ovr * 0.58 + potentialFactor + ageFactor + needsFactor + prestigeFactor
          - distancePenalty - fee / Math.max(1, buyer.budget) * 5 + tie;
        candidates.push({ player, seller, fee, score, group: need.group });
      }
      candidates.sort((a, b) => b.score - a.score || b.player.ovr - a.player.ovr);
      const candidate = candidates[0];
      if (!candidate || candidate.score < 37) continue;
      const { player, seller, fee, group } = candidate;
      const origin = seller.name;
      seller.roster = seller.roster.filter(id => id !== player.id);
      buyer.roster.push(player.id);
      seller.budget = Math.min(seller.budget + fee, seller.budget + Math.round(seller.power * 8));
      buyer.budget = Math.max(0, buyer.budget - fee);
      player.clubId = buyer.id; player.country = buyer.country; player.leagueId = buyer.leagueId;
      player.division = buyer.division; player.contractSeasons = 2 + (hash(player.id + "|" + season + "|contract") % 4);
      player.transferListed = false;
      alreadyUsedClubs.add(seller.id); alreadyUsedClubs.add(buyer.id); alreadyUsedPlayers.add(player.id);
      const transfer = {
        id: "world-transfer-" + season + "-" + (++world.transferSequence),
        season: Number(season), day: 1, playerId: player.id, player: player.name, position: player.position,
        group, from: origin, fromCountry: seller.country, to: buyer.name, toCountry: buyer.country,
        fee, currency: buyer.currency, reason: roleNeedsLabel(group) + " • " + (player.age <= 23 ? "استثمار في المستقبل" : player.age >= 30 ? "خبرة جاهزة" : "تعزيز فوري"),
        playerOvr: player.ovr, kind: "انتقال — محاكاة"
      };
      moves.push(transfer);
      world.transfers.unshift(transfer);
      world.playerHistory[player.id] = Array.isArray(world.playerHistory[player.id]) ? world.playerHistory[player.id] : [];
      world.playerHistory[player.id].unshift({ season: Number(season), club: buyer.name, country: buyer.country, type: "transfer-in", from: origin });
      world.playerHistory[player.id] = world.playerHistory[player.id].slice(0, 12);
    }
    world.transfers = world.transfers.slice(0, 300);
    clubs.forEach(club => {
      fillRoster(world, club);
      const strength = rosterPlayers(world, club).slice().sort((a, b) => b.ovr - a.ovr).slice(0, 11);
      const squadAverage = average(strength.map(player => player.ovr));
      club.power = clamp(Math.round(club.basePower * 0.70 + squadAverage * 0.30), 35, 97);
      club.updatedSeason = Number(season);
      club.budget = Math.max(40, Math.round(70 + club.power * 9 + club.prestige * 2.2));
    });
    world.marketReports.unshift({
      season: Number(season), moves: moves.length,
      summary: moves.length ? "اتحرك سوق الانتقالات بناءً على نقص المراكز، القوة، السن، والإمكانات." : "مفيش انتقالات كبيرة مناسبة لاحتياجات الأندية في نافذة الموسم دي.",
      transferIds: moves.map(item => item.id)
    });
    world.marketReports = world.marketReports.slice(0, 12);
    return moves;
  }
  function roleNeedsLabel(group) {
    return ({ goalkeeper: "تدعيم حراسة المرمى", defender: "تدعيم الدفاع", midfielder: "تدعيم الوسط", attacker: "تدعيم الهجوم" })[group] || "تدعيم الفريق";
  }
  function developPlayers(world, season) {
    const stats = world.seasonStats[String(season)] || [];
    const byId = new Map(stats.map(row => [row.id, row]));
    Object.values(world.players).forEach(player => {
      const row = byId.get(player.id);
      player.age = Math.min(43, Math.max(16, Number(player.age) || 18) + 1);
      player.contractSeasons = Math.max(1, (Number(player.contractSeasons) || 1) - 1);
      if (row) {
        player.lastRating = Number(row.averageRating) || 0;
        let delta = 0;
        if (player.age <= 23 && row.appearances >= 10 && row.averageRating >= 6.45) delta = row.averageRating >= 7.25 ? 2 : 1;
        else if (player.age <= 28 && row.appearances >= 16 && row.averageRating >= 7.15) delta = 1;
        else if (player.age >= 31) delta = row.averageRating < 6.4 ? -2 : -1;
        else if (player.age >= 29 && row.averageRating < 6.0) delta = -1;
        player.ovr = clamp(Number(player.ovr) + delta, 35, 97);
        if (player.potential < player.ovr) player.potential = player.ovr;
      }
    });
  }
  function advanceToSeason(save, nextSeason, db) {
    const world = ensureState(save, db);
    const next = Math.max(1, int(nextSeason, int(save.season, 1)));
    if (world.lastAdvancedTo >= next) {
      world.currentSeason = next;
      return { season: next, moves: [], alreadyAdvanced: true };
    }
    const previous = Math.max(1, next - 1);
    completeSeason(save, previous, db);
    developPlayers(world, previous);
    const moves = runTransferWindow(world, next);
    world.currentSeason = next;
    world.lastAdvancedTo = next;
    world.notes.unshift({ season: next, type: "market", text: moves.length
      ? "أندية اللعبة نفذت " + moves.length + " انتقالًا بناءً على احتياجات التشكيل والإمكانات والميزانية."
      : "انتهت نافذة الانتقالات بمحاولات محدودة؛ الأندية انتظرت لاعبين يناسبوا احتياجاتها." });
    world.notes = world.notes.slice(0, 30);
    return { season: next, moves, alreadyAdvanced: false };
  }
  function getClubPower(save, name, country, db) {
    const world = ensureState(save, db);
    const club = world.clubs[clubKey(name, country)] || Object.values(world.clubs).find(item => normalize(item.name) === normalize(name));
    return club ? Number(club.power) || Number(club.basePower) || null : null;
  }
  function transferTargets(save, db) {
    const world = ensureState(save, db);
    return Object.values(world.clubs).map(club => {
      const players = rosterPlayers(world, club).map(player => ({
        id: player.id, name: player.name, position: player.position, ovr: player.ovr, potential: player.potential,
        age: player.age, contractSeasons: player.contractSeasons
      }));
      const stars = players.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 7).map(player => player.name);
      return {
        country: club.country, club: club.name, league: club.leagueName, leagueEnglish: club.leagueEnglish,
        season: "موسم " + world.currentSeason, source: "محاكاة عالم الكرة", division: club.division,
        power: club.power, prestige: club.prestige, confederation: club.confederation,
        currency: club.currency, stars, players, leagueId: club.leagueId, sourceUrl: ""
      };
    }).sort((a, b) => b.power - a.power || a.club.localeCompare(b.club, "ar"));
  }
  function getLeagueTable(save, leagueId, season, db) {
    const world = ensureState(save, db);
    const year = Math.max(1, int(season, int(save.season, 1)));
    const snapshot = world.leagueTables[String(year)] && world.leagueTables[String(year)][String(leagueId)];
    if (Array.isArray(snapshot)) return snapshot.slice();
    const table = simulateLeagueTables(world, year, 1)[String(leagueId)] || [];
    return table.slice();
  }
  function leaderboard(save, options = {}, db) {
    const world = ensureState(save, db);
    const season = Math.max(1, int(options.season, int(save.season, 1)));
    const progress = clamp(options.progress === undefined ? 1 : options.progress, 0, 1);
    const country = options.country ? normalize(options.country) : "";
    const leagueId = options.leagueId ? String(options.leagueId) : "";
    const lines = getSeasonLines(save, season, progress, db).filter(row =>
      (!country || normalize(row.country) === country)
      && (!leagueId || row.leagueId === leagueId)
      && (!options.division || Number(row.division) === Number(options.division)));
    return lines.map(row => {
      const appearances = Number(row.displayStats && row.displayStats.appearances) || Number(row.appearances) || 0;
      const goals = Number(row.displayStats && row.displayStats.goals) || 0;
      const assists = Number(row.displayStats && row.displayStats.assists) || 0;
      return { ...row, appearances, goals, assists, averageRating: appearances ? Number(row.averageRating) || 0 : 0,
        score: Number((Number(row.averageRating || 0) * 9 + goals * 0.95 + assists * 0.62 + Number(row.ovr || 0) * 0.08).toFixed(3)),
        weightedGoals: Number((goals * (0.82 + Number(row.leagueStrength || 60) / 450)).toFixed(3)) };
    });
  }
  function dashboard(save, db) {
    const world = ensureState(save, db);
    const progress = clamp(Number(save.seasonApps || 0) / Math.max(1, Number(save.seasonAppsTarget || 0)), 0, 1);
    const year = Math.max(1, int(save.season, 1));
    const rows = leaderboard(save, { season: year, progress }, db);
    const goals = rows.slice().sort((a, b) => b.goals - a.goals || b.averageRating - a.averageRating).slice(0, 5);
    const assists = rows.slice().sort((a, b) => b.assists - a.assists || b.averageRating - a.averageRating).slice(0, 5);
    const currentClub = Object.values(world.clubs).find(club =>
      club.leagueId && normalize(club.country) === normalize(save.leagueCountry || "مصر"));
    const table = currentClub ? getLeagueTable(save, currentClub.leagueId, year, db).slice(0, 5) : [];
    const lastMarket = world.marketReports[0] || { season: 0, moves: 0, summary: "تتغير حركة السوق مع تقدم المسيرة للموسم التالي.", transferIds: [] };
    return {
      season: year, clubCount: Object.keys(world.clubs).length, playerCount: Object.keys(world.players).length,
      totalTransfers: world.transfers.length, lastMarket, recentTransfers: world.transfers.slice(0, 6),
      goalsLeaders: goals, assistLeaders: assists, leagueTable: table,
      progress: Math.round(progress * 100), completedSeasons: world.completedSeasons.length,
      note: "الإحصائيات والقوة والانتقالات في هذا القسم محاكاة تتطور حسب الموسم، وليست بيانات رسمية حية."
    };
  }
  global.LWWorldAI = Object.freeze({
    version: VERSION, normalize, clubKey, groupForPosition, ensureState, completeSeason, advanceToSeason,
    getSeasonLines, getClubPower, transferTargets, getLeagueTable, leaderboard, dashboard
  });
})(window);
