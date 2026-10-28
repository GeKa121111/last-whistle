/* Living football-world simulation for LAST WHISTLE.
 * Club recruitment, player progression, standings and statistics are deterministic and persisted in the career save.
 * All ratings and future statistics are simulation estimates, not official live football data.
 */
(function (global) {
  "use strict";
  const VERSION = 1;
  const TARGETS = Object.freeze({ goalkeeper: 2, defender: 5, midfielder: 5, attacker: 4 });
  // The full roster catalogue is available in the database/UI. The career save simulates a
  // compact 16-player matchday pool per club so long saves remain within browser storage limits.
  const SIMULATED_SQUAD_LIMIT = 16;
  const POSITIONS = Object.freeze({
    goalkeeper: ["حارس مرمى"],
    defender: ["قلب دفاع", "ظهير"],
    midfielder: ["وسط دفاعي", "وسط مهاجم"],
    attacker: ["جناح", "مهاجم", "رأس حربة"]
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
    // "وسط مهاجم" and "وسط دفاعي" are midfielders; classify the line before the role wording.
    if (p.includes("وسط") || p.includes("ارتكاز") || p.includes("صانع")) return "midfielder";
    if (p.includes("دفاع") || p.includes("ظهير") || p.includes("مدافع")) return "defender";
    if (p.includes("مهاجم") || p.includes("جناح") || p.includes("رأسحربة") || p.includes("راسحربة") || p.includes("راسحربه")) return "attacker";
    return "midfielder";
  }
  function positionProductionProfile(position) {
    const p = normalize(position);
    // Centre strikers should finish moves more often; mobile forwards and wingers
    // should contribute more assists rather than sharing one generic attacker rate.
    if (p === "st" || p === "cf" || p === "f" || p === "striker"
      || p.includes("راسحربة") || p.includes("راسحربه")
      || p.includes("centreforward") || p.includes("centerforward")) {
      return { role: "centre-striker", goalWeight: 3.25, assistWeight: 0.72, attackRate: 0.44, assistRate: 0.14 };
    }
    if (p.includes("جناح") || ["lw", "rw", "lwf", "rwf", "wf"].includes(p)
      || p.includes("winger") || p.includes("wing")) {
      return { role: "winger", goalWeight: 2.05, assistWeight: 1.8, attackRate: 0.27, assistRate: 0.31 };
    }
    if (p.includes("مهاجم") || p === "ss" || p === "fw"
      || p.includes("secondstriker") || p.includes("forward") || p.includes("striker")) {
      return { role: "mobile-forward", goalWeight: 2.35, assistWeight: 1.55, attackRate: 0.31, assistRate: 0.28 };
    }
    const group = groupForPosition(position);
    if (group === "goalkeeper") return { role: group, goalWeight: 0.03, assistWeight: 0.04, attackRate: 0.0015, assistRate: 0.002 };
    if (group === "defender") return { role: group, goalWeight: 0.42, assistWeight: 0.7, attackRate: 0.038, assistRate: 0.055 };
    if (group === "midfielder") return { role: group, goalWeight: 1.2, assistWeight: 1.8, attackRate: 0.115, assistRate: 0.215 };
    return { role: "mobile-forward", goalWeight: 2.35, assistWeight: 1.55, attackRate: 0.31, assistRate: 0.28 };
  }
  function playerRoleWeight(player, purpose) {
    const profile = positionProductionProfile(player && player.position);
    return purpose === "goal" ? profile.goalWeight : profile.assistWeight;
  }
  function clubKey(name, country) {
    return normalize(country) + "|" + normalize(name);
  }
  function sourcePlayerIdentityKey(player) {
    const name = normalize(player && player.name);
    if (!name) return "";
    return [name, normalize(player && player.position), int(player && player.age, 0)].join("|");
  }
  function rosterIdentityKey(player) {
    const name = normalize(player && player.name);
    return name ? name + "|" + normalize(player && player.position) : "";
  }
  function marketValue(player, seller) {
    const ovr = clamp(player.ovr, 35, 99);
    const potential = clamp(player.potential, ovr, 99);
    const rawValue = Math.pow(Math.max(1, ovr - 35), 2) * 0.18
      + potential * 1.12 + Math.max(0, Number(seller && seller.prestige) || 50) * 0.28;
    const term = Math.max(0, int(player && player.contractSeasons, 0));
    const contractFactor = term <= 1 ? 0.72 : term >= 4 ? 1.16 : term === 3 ? 1.08 : 1;
    return Math.max(12, Math.round(rawValue * contractFactor));
  }
  function emptyArchive() {
    return {
      clubs: {}, players: {}, playerHistory: {}, seasonStats: {}, leagueTables: {},
      leagueTableRows: {}, matchesBySeason: {}, competitionsBySeason: {}
    };
  }
  function ensureArchive(world) {
    if (!world.archive || typeof world.archive !== "object" || Array.isArray(world.archive)) world.archive = {};
    for (const key of ["clubs", "players", "playerHistory", "seasonStats", "leagueTables", "leagueTableRows", "matchesBySeason", "competitionsBySeason"]) {
      if (!world.archive[key] || typeof world.archive[key] !== "object" || Array.isArray(world.archive[key])) world.archive[key] = {};
    }
    return world.archive;
  }
  function emptyWorld() {
    return {
      schemaVersion: VERSION, dbVersion: 0, currentSeason: 1, lastCompletedSeason: 0,
      lastAdvancedTo: 0, clubs: {}, players: {}, playerHistory: {}, seasonStats: {},
      leagueTables: {}, completedSeasons: [], transfers: [], marketReports: [],
      nextGeneratedPlayer: 1, transferSequence: 0, notes: [], archive: emptyArchive()
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
      roster: [], matchesPerSeason: Math.max(20, int(row.matchesPerSeason || ((db && typeof db.leagueFor === "function" && db.leagueFor(row.country, row.division)) || {}).matchesPerSeason, int(profile.matches, 34))),
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
    const sourceIdentity = sourcePlayerIdentityKey({ name: row && row.name, position, age });
    const id = generated
      ? "academy-" + hash(club.id + "|" + index + "|" + (row && row.name || "player")).toString(36)
      : "player-" + hash(club.id + "|" + (sourceIdentity || index)).toString(36);
    if (world.players[id]) return world.players[id];
    const player = {
      id, name: String(row && row.name || (club.name + " • ناشئ " + String(index + 1).padStart(2, "0"))),
      clubId: club.id, country: club.country, leagueId: club.leagueId, division: club.division,
      position, group, ovr, potential: clamp(row && row.potential || ovr + 3 + Math.floor(rng() * 18), ovr, 97),
      age, prestige: club.prestige, contractSeasons: 1 + Math.floor(rng() * 5),
      isGenerated: !!generated || !!(row && row.isRealPlayer === false), isRealPlayer: !generated && !!row && row.isRealPlayer !== false,
      lastRating: 0, transferListed: false
    };
    world.players[id] = player;
    club.roster.push(id);
    return player;
  }
  function fillRoster(world, club) {
    club.roster = (club.roster || []).filter(id => {
      const player = world.players[id];
      return !player || !player.retired;
    });
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
    for (const raw of clubs) {
      if (!raw || !raw.name || !raw.country) continue;
      const club = addClub(world, raw, db);
      const sourceRows = Array.isArray(raw.players) && raw.players.length ? raw.players
        : db && typeof db.playerRecordsForClub === "function" ? db.playerRecordsForClub(raw.name, raw.country) : [];
      const rows = sourceRows.slice(0, SIMULATED_SQUAD_LIMIT);
      const seenSourcePlayers = new Set();
      let index = 0;
      for (const row of rows) {
        const identityKey = sourcePlayerIdentityKey(row);
        if (!identityKey || seenSourcePlayers.has(identityKey)) continue;
        seenSourcePlayers.add(identityKey);
        makePlayer(world, row, club, index++, false);
      }
      fillRoster(world, club);
    }
    world.currentSeason = 1;
    world.rosterSchemaVersion = 3;
    return world;
  }
  function reconcileDatabase(world, db) {
    if (!world || !world.clubs) return seedWorld(db);
    world.players = world.players && typeof world.players === "object" ? world.players : {};
    world.playerHistory = world.playerHistory && typeof world.playerHistory === "object" ? world.playerHistory : {};
    const archive = ensureArchive(world);
    // Unsupported competitions leave the active simulation, but their saved data is archived rather than destroyed.
    const supportedLeagueIds = new Set(db && typeof db.leagues === "function"
      ? db.leagues().map(profile => String(profile && profile.id || "")).filter(Boolean) : []);
    const removedClubIds = new Set();
    const removedPlayerIds = new Set();
    if (supportedLeagueIds.size) {
      for (const [id, club] of Object.entries(world.clubs)) {
        if (club && club.leagueId && !supportedLeagueIds.has(String(club.leagueId))) {
          removedClubIds.add(String(id));
          archive.clubs[String(id)] = club;
          delete world.clubs[id];
        }
      }
    }
    if (removedClubIds.size) {
      for (const [id, player] of Object.entries(world.players || {})) {
        if (player && removedClubIds.has(String(player.clubId))) {
          removedPlayerIds.add(String(id));
          archive.players[String(id)] = player;
          if (Object.prototype.hasOwnProperty.call(world.playerHistory, id)) {
            archive.playerHistory[String(id)] = world.playerHistory[id];
            delete world.playerHistory[id];
          }
          delete world.players[id];
        }
      }
      Object.values(world.clubs).forEach(club => {
        club.roster = (club.roster || []).filter(id => !removedPlayerIds.has(String(id)) && !!world.players[id]);
      });
      Object.keys(world.seasonStats || {}).forEach(season => {
        const rows = world.seasonStats[season] || [];
        const archivedRows = rows.filter(row => row && (
          (row.leagueId && !supportedLeagueIds.has(String(row.leagueId)))
          || removedPlayerIds.has(String(row.id || row.playerId || ""))
          || removedClubIds.has(String(row.clubId || ""))
        ));
        if (archivedRows.length) {
          archive.seasonStats[season] = (Array.isArray(archive.seasonStats[season]) ? archive.seasonStats[season] : []).concat(archivedRows);
        }
        world.seasonStats[season] = rows.filter(row => !archivedRows.includes(row));
      });
      Object.keys(world.leagueTables || {}).forEach(season => {
        const tables = world.leagueTables[season] || {};
        const archivedTables = archive.leagueTables[season] && typeof archive.leagueTables[season] === "object"
          ? archive.leagueTables[season] : {};
        Object.keys(tables).forEach(key => {
          if (!supportedLeagueIds.has(String(key).split(":")[0])) {
            archivedTables[key] = tables[key];
            delete tables[key];
          } else if (Array.isArray(tables[key])) {
            const rows = tables[key];
            const archivedRows = rows.filter(row => row && (
              (row.leagueId && !supportedLeagueIds.has(String(row.leagueId)))
              || removedClubIds.has(String(row.clubId || ""))
            ));
            if (archivedRows.length) {
              archive.leagueTableRows[season] = archive.leagueTableRows[season] || {};
              archive.leagueTableRows[season][key] = (archive.leagueTableRows[season][key] || []).concat(archivedRows);
              tables[key] = rows.filter(row => !archivedRows.includes(row));
            }
          }
        });
        if (Object.keys(archivedTables).length) archive.leagueTables[season] = archivedTables;
      });
      Object.keys(world.matchesBySeason || {}).forEach(season => {
        const matches = world.matchesBySeason[season] || [];
        const archivedMatches = matches.filter(match =>
          removedClubIds.has(String(match && match.homeClubId))
          || removedClubIds.has(String(match && match.awayClubId)));
        if (archivedMatches.length) {
          archive.matchesBySeason[season] = (archive.matchesBySeason[season] || []).concat(archivedMatches);
        }
        world.matchesBySeason[season] = matches.filter(match => !archivedMatches.includes(match));
      });
      Object.keys(world.competitionsBySeason || {}).forEach(season => {
        const items = world.competitionsBySeason[season] || [];
        const archivedItems = items.filter(item => item && (
          item.confederation === "AFC"
          || ["afc-cl", "afc-cl-two", "japanese-cup", "japanese-super-cup"].includes(String(item.id || item.competitionId || ""))
        ));
        if (archivedItems.length) {
          archive.competitionsBySeason[season] = (archive.competitionsBySeason[season] || []).concat(archivedItems);
        }
        world.competitionsBySeason[season] = items.filter(item => item && !(
          item.confederation === "AFC"
          || ["afc-cl", "afc-cl-two", "japanese-cup", "japanese-super-cup"].includes(String(item.id || item.competitionId || ""))
        ));
      });
    }
    const rows = db && typeof db.clubs === "function" ? db.clubs() : [];
    const retiredIdentitiesByClub = new Map();
    for (const player of Object.values(world.players || {})) {
      if (!player || !player.retired) continue;
      const clubId = String(player.previousClubId || player.retiredFromClubId || player.clubId || "");
      const identityKey = rosterIdentityKey(player);
      if (!clubId || !identityKey) continue;
      if (!retiredIdentitiesByClub.has(clubId)) retiredIdentitiesByClub.set(clubId, new Set());
      retiredIdentitiesByClub.get(clubId).add(identityKey);
    }
    const knownPlayersByClub = new Map();
    for (const player of Object.values(world.players || {})) {
      if (!player || player.retired) continue;
      const clubId = String(player.clubId || "");
      const identityKey = rosterIdentityKey(player);
      if (!clubId || !identityKey) continue;
      if (!knownPlayersByClub.has(clubId)) knownPlayersByClub.set(clubId, new Set());
      knownPlayersByClub.get(clubId).add(identityKey);
    }
    for (const row of rows) {
      if (!row || !row.name || !row.country) continue;
      const id = clubKey(row.name, row.country);
      const sourceRows = Array.isArray(row.players) && row.players.length ? row.players
        : db && typeof db.playerRecordsForClub === "function" ? db.playerRecordsForClub(row.name, row.country) : [];
      const records = sourceRows.slice(0, SIMULATED_SQUAD_LIMIT);
      if (!world.clubs[id]) {
        const club = addClub(world, row, db);
        const knownForClub = new Set();
        const retiredForClub = retiredIdentitiesByClub.get(id) || new Set();
        let index = 0;
        records.forEach(player => {
          const identityKey = rosterIdentityKey(player);
          if (!identityKey || knownForClub.has(identityKey) || retiredForClub.has(identityKey)) return;
          makePlayer(world, player, club, index++, false);
          knownForClub.add(identityKey);
        });
        knownPlayersByClub.set(id, knownForClub);
        fillRoster(world, club);
      } else {
        const club = world.clubs[id];
        const profile = db && typeof db.leagueFor === "function"
          ? db.leagueFor(row.country, row.division) || {}
          : db && typeof db.leagueById === "function" ? db.leagueById(row.leagueId) || {} : {};
        club.leagueName = String(row.leagueName || profile.name || profile.league || club.leagueName || "");
        club.leagueEnglish = String(row.leagueEnglish || profile.englishName || profile.english || club.leagueEnglish || "");
        const sourceDivision = Math.max(1, int(row.division, 1));
        const savedDivision = Number(club.division);
        // Reconcile roster metadata without undoing in-game promotion/relegation.
        // A valid saved division belongs to this simulation, even if the source catalogue refreshes.
        club.division = Number.isFinite(savedDivision) && savedDivision >= 1
          ? Math.max(1, int(savedDivision, sourceDivision)) : sourceDivision;
        club.matchesPerSeason = Math.max(20, int(row.matchesPerSeason || profile.matchesPerSeason || profile.matches, club.matchesPerSeason || 34));
        // Migrate saves created before complete squads were stored. Replace only generated
        // placeholders; existing real players and their career history are preserved.
        const knownForClub = knownPlayersByClub.get(id) || new Set();
        const retiredForClub = retiredIdentitiesByClub.get(id) || new Set();
        let index = 0;
        for (const playerRow of records) {
          const identityKey = rosterIdentityKey(playerRow);
          if (!identityKey || knownForClub.has(identityKey) || retiredForClub.has(identityKey)) continue;
          while ((club.roster || []).length >= SIMULATED_SQUAD_LIMIT) {
            const generated = (club.roster || []).map(playerId => world.players[playerId]).filter(player => player && player.isGenerated)
              .sort((a, b) => Number(a.ovr || 0) - Number(b.ovr || 0));
            if (!generated.length) break;
            const replace = generated[0];
            club.roster = club.roster.filter(playerId => playerId !== replace.id);
            delete world.players[replace.id];
            knownForClub.delete(rosterIdentityKey(replace));
          }
          if ((club.roster || []).length >= SIMULATED_SQUAD_LIMIT) break;
          makePlayer(world, playerRow, club, index++, false);
          knownForClub.add(identityKey);
        }
        knownPlayersByClub.set(id, knownForClub);
        fillRoster(world, club);
      }
    }
    world.dbVersion = int(db && db.version, world.dbVersion || 0);
    // Mark the expensive roster/database reconciliation as complete. It should only
    // rerun when the catalogue version changes, not on every render or AI query.
    // Migrate existing saves too: early v1 builds misclassified "وسط مهاجم" as an attacker.
    Object.values(world.players).forEach(player => {
      player.group = groupForPosition(player.position);
    });
    Object.values(world.clubs).forEach(club => fillRoster(world, club));
    world.rosterSchemaVersion = 3;
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
    ensureArchive(world);
    world.notes = Array.isArray(world.notes) ? world.notes : [];
    world.nextGeneratedPlayer = Math.max(1, int(world.nextGeneratedPlayer, 1));
    world.transferSequence = Math.max(0, int(world.transferSequence, 0));
    // reconcileDatabase scans the global club/player catalogue and repairs squads.
    // Running it for every dashboard render caused severe avoidable CPU work.
    const catalogueVersion = int(db && db.version, int(world.dbVersion, 0));
    const supportedLeagueIds = new Set(db && typeof db.leagues === "function"
      ? db.leagues().map(profile => String(profile && profile.id || "")).filter(Boolean) : []);
    const hasUnsupportedClub = supportedLeagueIds.size > 0 && Object.values(world.clubs).some(club =>
      club && club.leagueId && !supportedLeagueIds.has(String(club.leagueId)));
    if (catalogueVersion !== int(world.dbVersion, 0)
      || Number(world.rosterSchemaVersion) !== 3 || hasUnsupportedClub) {
      reconcileDatabase(world, db);
    }
    // The world-simulation season is independent of the player's career season.
    // Never rewind completed global seasons just because save.season has not caught up.
    if (Number(world.lastAdvancedTo) > 0) {
      world.currentSeason = Math.max(world.currentSeason, int(world.lastAdvancedTo, world.currentSeason));
    } else {
      world.currentSeason = Math.max(world.currentSeason, Math.max(1, int(save.season, 1)));
    }
    return world;
  }
  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 55;
  }
  function rosterPlayers(world, club) {
    return (club.roster || []).map(id => world.players[id]).filter(player => player && !player.retired);
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
  function generatePlayerSeason(world, player, season, progress = 1, strengthByLeague) {
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
    const production = positionProductionProfile(player.position);
    const rate = production.attackRate;
    const assistRate = production.assistRate;
    const performanceMultiplier = clamp(0.72 + ovr / 100 * 0.38 + (power - 65) * 0.002, 0.72, 1.18);
    const fullGoals = Math.max(0, Math.round(expectedApps * rate * performanceMultiplier + rng() * (group === "attacker" ? 5.5 : 2.1) - 1));
    const fullAssists = Math.max(0, Math.round(expectedApps * assistRate * performanceMultiplier + rng() * 3.2 - 0.5));
    const fullRating = expectedApps > 0 ? clamp(6.15 + (ovr - 60) * 0.026 + (power - 65) * 0.004 + rng() * 0.65 - 0.30, 5.1, 8.95) : 0;
    const leaguePower = leagueStrength(world, player.leagueId, player.division, strengthByLeague);
    const goals = Math.round(fullGoals * clamp(progress, 0, 1));
    const assists = Math.round(fullAssists * clamp(progress, 0, 1));
    const values = {
      id: player.id, season: Number(season), name: player.name, club: club ? club.name : "",
      clubName: club ? club.name : "", country: player.country, leagueId: player.leagueId,
      division: player.division || 1, position: player.position, group, age: player.age, ovr,
      potential: player.potential, appearances: expectedApps, goals: fullGoals, assists: fullAssists,
      averageRating: Number(fullRating.toFixed(2)), leagueStrength: leaguePower,
      prestige: club ? club.prestige : player.prestige, confederation: club ? club.confederation : "",
      originConfederation: club ? club.confederation : "", isGenerated: !!player.isGenerated,
      realPlayer: !player.isGenerated, score: Number((fullRating * 9 + fullGoals * 0.95 + fullAssists * 0.62 + ovr * 0.08).toFixed(3)),
      weightedGoals: Number((fullGoals * (0.82 + leaguePower / 450)).toFixed(3))
    };
    values.displayStats = { appearances, goals, assists, averageRating: Number(fullRating.toFixed(2)) };
    values.seasonStats = { season: Number(season), appearances: expectedApps, goals: fullGoals, assists: fullAssists,
      averageRating: Number(fullRating.toFixed(2)), ovr, club: values.club, country: values.country };
    return values;
  }
  function buildLeagueStrengthLookup(world) {
    const totals = new Map();
    Object.values(world.clubs || {}).forEach(club => {
      if (!club || !club.leagueId) return;
      const division = Math.max(1, int(club.division, 1));
      const key = String(club.leagueId) + "|" + division;
      const row = totals.get(key) || { total: 0, count: 0 };
      row.total += Number(club.power) || 55;
      row.count++;
      totals.set(key, row);
    });
    return new Map(Array.from(totals, ([key, row]) => [
      key, row.count ? Math.round(row.total / row.count) : 55
    ]));
  }
  function leagueStrength(world, leagueId, division, strengthByLeague) {
    const tier = Math.max(1, int(division, 1));
    const key = String(leagueId || "") + "|" + tier;
    if (strengthByLeague && strengthByLeague.has(key)) return strengthByLeague.get(key);
    const clubs = Object.values(world.clubs || {}).filter(club =>
      String(club.leagueId || "") === String(leagueId || "")
      && Math.max(1, int(club.division, 1)) === tier);
    if (clubs.length) return Math.round(average(clubs.map(club => Number(club.power) || 55)));
    if (tier !== 1 && strengthByLeague && strengthByLeague.has(String(leagueId || "") + "|1")) {
      return strengthByLeague.get(String(leagueId || "") + "|1");
    }
    return Math.round(average(Object.values(world.clubs || {}).filter(club =>
      String(club.leagueId || "") === String(leagueId || "") && Math.max(1, int(club.division, 1)) === 1)
      .map(club => Number(club.power) || 55)));
  }
  function getSeasonLines(save, season, progress = 1, db) {
    const world = ensureState(save, db);
    const targetSeason = Math.max(1, int(season, int(save.season, 1)));
    const scale = clamp(progress, 0, 1);
    const completed = world.seasonStats[String(targetSeason)];
    let fullRows = completed;
    if (!Array.isArray(fullRows)) {
      // League strength is shared by every player in a league. Precompute it once per
      // projection instead of scanning all clubs twice for each of the 14k+ players.
      const strengthByLeague = buildLeagueStrengthLookup(world);
      fullRows = Object.values(world.players).map(player =>
        generatePlayerSeason(world, player, targetSeason, 1, strengthByLeague));
    }
    return fullRows.map(row => {
      const rawAppearances = row.appearances !== undefined && row.appearances !== null
        ? Number(row.appearances)
        : Number(row.seasonStats && row.seasonStats.appearances) || 0;
      const apps = Math.round(Math.max(0, Number.isFinite(rawAppearances) ? rawAppearances : 0) * scale);
      const goals = apps > 0 ? Math.round(Math.max(0, Number(row.goals) || 0) * scale) : 0;
      const assists = apps > 0 ? Math.round(Math.max(0, Number(row.assists) || 0) * scale) : 0;
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
    const strengthByLeague = buildLeagueStrengthLookup(world);
    const rows = Object.values(world.players).map(player => generatePlayerSeason(world, player, year, 1, strengthByLeague));
    const tables = simulateLeagueTables(world, year, 1);
    world.seasonStats[String(year)] = rows.map(row => ({ ...row, displayStats: undefined }));
    world.leagueTables[String(year)] = tables;
    world.completedSeasons.push(year);
    world.completedSeasons = world.completedSeasons.sort((a, b) => a - b).slice(-20);
    world.lastCompletedSeason = Math.max(world.lastCompletedSeason || 0, year);
    world.currentSeason = year;
    return { season: year, rows, tables, alreadyCompleted: false, transfers: 0 };
  }
  function inferArchetype(club) {
    const power = clamp(club && club.power, 35, 97);
    const prestige = clamp(club && club.prestige, 25, 100);
    if (power >= 82 && prestige >= 78) return "title-chaser";
    if (power <= 65 && prestige <= 68) return "youth-investor";
    if (power >= 70 && prestige >= 72) return "academy-builder";
    return "balanced";
  }
  function inferCoachArchetype(club) {
    const archetype = inferArchetype(club);
    if (archetype === "title-chaser") return "win-now";
    if (archetype === "youth-investor") return "develop-youth";
    if (archetype === "academy-builder") return "technical-discipline";
    return "balanced-rotation";
  }
  function roleAverages(world, club) {
    const all = rosterPlayers(world, club);
    const stats = {};
    for (const group of Object.keys(TARGETS)) {
      const rows = all.filter(player => player.group === group);
      const ages = rows.map(player => clamp(player.age, 15, 45));
      stats[group] = {
        count: rows.length,
        average: average(rows.map(player => player.ovr)),
        best: rows.length ? Math.max(...rows.map(player => player.ovr)) : 0,
        averageAge: ages.length ? average(ages) : 26,
        youthCount: ages.filter(age => age <= 23).length,
        primeCount: ages.filter(age => age >= 24 && age <= 30).length,
        veteranCount: ages.filter(age => age >= 31).length
      };
    }
    return stats;
  }
  function needScore(club, group, roleStats) {
    const row = roleStats[group];
    if (!row) return 0;
    // This market only adds players; never recruit beyond the squad's role target.
    if (row.count >= TARGETS[group]) return 0;
    const deficit = Math.max(0, TARGETS[group] - row.count);
    const qualityGap = Math.max(0, club.power - row.average - 4);
    const topQualityGap = Math.max(0, club.power - row.best - 6);
    const weakUnitPenalty = row.average < club.power - 5 ? 5 : 0;
    const archetype = inferArchetype(club);
    let ageFit = 0;
    if (archetype === "youth-investor") ageFit += Math.max(0, 26 - row.averageAge) * 0.62 + row.youthCount * 0.12;
    else if (archetype === "title-chaser") ageFit += Math.max(0, row.averageAge - 23) * 0.30 - Math.max(0, row.averageAge - 31) * 0.75;
    else if (archetype === "academy-builder") ageFit += Math.max(0, 28 - row.averageAge) * 0.28;
    const undercovered = row.count < Math.max(1, Math.floor(TARGETS[group] * 0.55));
    return 5 + deficit * 11 + qualityGap * 1.25 + topQualityGap * 0.9
      + weakUnitPenalty + (row.count === 0 ? 18 : 0) + ageFit + (undercovered ? 7 : 0);
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
    const clubs = Object.values(world.clubs).filter(club => Number.isFinite(Number(club.division)) && Number(club.division) >= 1);
    // Apply the new-season operating allocation before deals, while retaining leftover transfer cash.
    // The cap prevents balances from growing without bound over long simulated careers.
    for (const club of clubs) {
      const budgetBase = Math.max(40, Math.round(70 + (Number(club.power) || Number(club.basePower) || 55) * 9 + (Number(club.prestige) || 50) * 2.2));
      const existingBudget = Number(club.budget);
      const carriedBudget = Number.isFinite(existingBudget) && existingBudget >= 0
        ? Math.min(existingBudget, budgetBase * 2) : budgetBase;
      club.budget = Math.round(Math.min(budgetBase * 2, carriedBudget + Math.max(1, Math.round(budgetBase * 0.25))));
    }
    const alreadyUsedClubs = new Set(), alreadyUsedPlayers = new Set(), moves = [];
    const maxMoves = Math.max(10, Math.min(40, Math.round(clubs.length * 0.42)));
    // Interleave divisions so the capped market does not spend every deal on first-tier clubs.
    const buyersByDivision = new Map();
    for (const club of clubs) {
      const division = Math.max(1, int(club.division, 1));
      if (!buyersByDivision.has(division)) buyersByDivision.set(division, []);
      buyersByDivision.get(division).push(club);
    }
    const buyerStrength = (a, b) => {
      const aStrength = a.power + a.prestige * 0.04 + hash(a.id + "|" + season + "|buyer") % 29 / 100;
      const bStrength = b.power + b.prestige * 0.04 + hash(b.id + "|" + season + "|buyer") % 29 / 100;
      return bStrength - aStrength || String(a.id).localeCompare(String(b.id));
    };
    const divisions = Array.from(buyersByDivision.keys()).sort((a, b) => a - b);
    divisions.forEach(division => buyersByDivision.get(division).sort(buyerStrength));
    const buyers = [];
    for (let depth = 0; buyers.length < clubs.length; depth++) {
      let added = false;
      for (const division of divisions) {
        const candidate = buyersByDivision.get(division)[depth];
        if (candidate) { buyers.push(candidate); added = true; }
      }
      if (!added) break;
    }
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
        const archetype = inferArchetype(buyer);
        const coachStyle = inferCoachArchetype(buyer);
        const archetypeFactor = archetype === "youth-investor"
          ? Math.max(0, player.potential - player.ovr) * 0.34 + (player.age <= 23 ? 4 : -2)
          : archetype === "title-chaser"
            ? (player.age >= 24 && player.age <= 30 ? 5 : player.age >= 32 ? -5 : 0) + player.ovr * 0.035
            : archetype === "academy-builder" ? (player.age <= 25 ? 2.5 : -1) : 0;
        const coachFit = coachStyle === "develop-youth" && player.age <= 23 ? 2
          : coachStyle === "win-now" && player.ovr >= buyer.power - 2 ? 1.8
          : coachStyle === "technical-discipline" && player.potential >= player.ovr + 8 ? 1 : 0;
        const score = player.ovr * 0.58 + potentialFactor + ageFactor + needsFactor + prestigeFactor
          + archetypeFactor + coachFit - distancePenalty - fee / Math.max(1, buyer.budget) * 5 + tie;
        candidates.push({ player, seller, fee, score, group: need.group });
      }
      candidates.sort((a, b) => b.score - a.score || b.player.ovr - a.player.ovr);
      const candidate = candidates[0];
      if (!candidate || candidate.score < 37) continue;
      const { player, seller, fee, group } = candidate;
      const origin = seller.name;
      seller.roster = seller.roster.filter(id => id !== player.id);
      buyer.roster.push(player.id);
      // The recorded fee is a direct buyer-to-seller transaction; never discard part of it.
      seller.budget = Math.max(0, Number(seller.budget) || 0) + fee;
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
    // Refill every division after contract expirations; relegated clubs need a complete squad too.
    Object.values(world.clubs).forEach(club => {
      fillRoster(world, club);
      const strength = rosterPlayers(world, club).slice().sort((a, b) => b.ovr - a.ovr).slice(0, 11);
      const squadAverage = average(strength.map(player => player.ovr));
      club.power = clamp(Math.round(club.basePower * 0.70 + squadAverage * 0.30), 35, 97);
      club.updatedSeason = Number(season);
      // Keep the cash balance after fees; recomputing it here would erase the transfer's financial effect.
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
  function shouldRetirePlayer(player, seasonAge, row, season) {
    const isGoalkeeper = String(player.group || "") === "goalkeeper"
      || groupForPosition(player.position) === "goalkeeper";
    const effectiveAge = Math.max(16, Number(seasonAge) - (isGoalkeeper ? 1 : 0));
    if (effectiveAge < 38) return false;
    if (effectiveAge >= 42) return true;
    const rating = Number(row && row.averageRating) || Number(player.lastRating) || 0;
    let chance = effectiveAge >= 41 ? 78 : effectiveAge >= 40 ? 55 : effectiveAge >= 39 ? 30 : 12;
    if (rating >= 7.4) chance -= 12;
    else if (rating > 0 && rating < 6.0) chance += 12;
    if (Number(player.ovr) <= 55) chance += 12;
    return (hash(String(player.id) + "|retirement|" + String(season)) % 100) < clamp(chance, 0, 100);
  }
  function retireWorldPlayer(world, player, season, seasonAge) {
    const currentClubId = String(player.clubId || "");
    const club = currentClubId && world.clubs ? world.clubs[currentClubId] : null;
    if (club && Array.isArray(club.roster)) {
      club.roster = club.roster.filter(id => String(id) !== String(player.id));
    }
    player.previousClubId = currentClubId || player.previousClubId || "";
    player.clubId = "";
    player.leagueId = "";
    player.division = 0;
    player.contractSeasons = 0;
    player.freeAgent = false;
    player.transferListed = false;
    player.retired = true;
    player.retiredSeason = Math.max(1, int(season, 1)) + 1;
    player.retirementAge = Math.max(16, Number(seasonAge) || Number(player.age) || 18);
    player.retirementReason = "age";
    world.playerHistory = world.playerHistory && typeof world.playerHistory === "object" ? world.playerHistory : {};
    const history = Array.isArray(world.playerHistory[player.id]) ? world.playerHistory[player.id] : [];
    history.unshift({
      season: player.retiredSeason,
      club: club ? club.name : "",
      country: club ? club.country : "",
      type: "retirement",
      age: player.retirementAge
    });
    world.playerHistory[player.id] = history.slice(0, 12);
    world.notes = Array.isArray(world.notes) ? world.notes : [];
    world.notes.unshift({
      season: player.retiredSeason,
      type: "retirement",
      text: player.name + " اعتزل كرة القدم بعد نهاية الموسم."
    });
    world.notes = world.notes.slice(0, 30);
  }
  function developPlayers(world, season) {
    const stats = world.seasonStats[String(season)] || [];
    const byId = new Map(stats.map(row => [row.id, row]));
    const seasonAges = new Map();
    Object.values(world.players).forEach(player => {
      if (!player || player.retired) return;
      const row = byId.get(player.id);
      // Season statistics describe the season just played, so development thresholds
      // must use the player's age during that season, before advancing their age.
      const seasonAge = Math.min(43, Math.max(16, Number(player.age) || 18));
      seasonAges.set(player.id, seasonAge);
      player.age = Math.min(43, seasonAge + 1);
      player.contractSeasons = Math.max(0, (Number(player.contractSeasons) || 1) - 1);
      if (row) {
        player.lastRating = Number(row.averageRating) || 0;
        let delta = 0;
        if (seasonAge <= 23 && row.appearances >= 10 && row.averageRating >= 6.45) delta = row.averageRating >= 7.25 ? 2 : 1;
        else if (seasonAge <= 28 && row.appearances >= 16 && row.averageRating >= 7.15) delta = 1;
        else if (seasonAge >= 31) delta = row.averageRating < 6.4 ? -2 : -1;
        else if (seasonAge >= 29 && row.averageRating < 6.0) delta = -1;
        player.ovr = clamp(Number(player.ovr) + delta, 35, 97);
        if (player.potential < player.ovr) player.potential = player.ovr;
      }
    });
    // Contracts now truly expire. A deterministic renewal decision keeps key players
    // when the club needs them, while the rest enter the free-agent pool.
    Object.values(world.players).forEach(player => {
      if (!player || player.retired) return;
      const seasonAge = seasonAges.get(player.id);
      const row = byId.get(player.id);
      if (shouldRetirePlayer(player, seasonAge, row, season)) {
        retireWorldPlayer(world, player, season, seasonAge);
        return;
      }
      if (Number(player.contractSeasons) > 0 || !player.clubId) return;
      const club = world.clubs[player.clubId];
      if (!club) { player.clubId = ""; player.freeAgent = true; return; }
      const roster = rosterPlayers(world, club);
      const sameRole = roster.filter(row => row.group === player.group && row.id !== player.id);
      const roleTarget = Math.max(1, Number(TARGETS[player.group]) || 1);
      const roleNeed = sameRole.length < roleTarget;
      const age = Number(player.age) || 18;
      const quality = Number(player.ovr) || 50;
      const renewalChance = clamp(0.12 + (quality >= club.power - 2 ? 0.28 : 0)
        + (Number(player.lastRating) >= 7.0 ? 0.16 : 0) + (roleNeed ? 0.20 : 0)
        - Math.max(0, age - 30) * 0.055, 0.02, 0.76);
      const roll = hash(player.id + "|" + season + "|contract-renewal-v2") / 4294967296;
      if (roll < renewalChance && age < 36) {
        player.contractSeasons = 2 + (hash(player.id + "|" + season + "|renewed-term") % 3);
        player.freeAgent = false;
        player.lastRenewedSeason = Number(season) + 1;
        world.notes.unshift({ season: Number(season) + 1, type: "contract", text: player.name + " جدد عقده مع " + club.name + " لمدة " + player.contractSeasons + " مواسم." });
      } else {
        club.roster = (club.roster || []).filter(id => id !== player.id);
        player.previousClubId = club.id;
        player.freeAgent = true;
        player.freeAgentSince = Number(season) + 1;
        player.clubId = "";
        player.leagueId = "";
        player.division = 0;
        world.notes.unshift({ season: Number(season) + 1, type: "free-agent", text: player.name + " انتهى عقده وأصبح لاعبًا حرًا." });
      }
    });
    world.notes = world.notes.slice(0, 30);

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
      const displayStats = row.displayStats && typeof row.displayStats === "object" ? row.displayStats : row;
      const appearances = Math.max(0, Number(displayStats.appearances) || 0);
      const goals = appearances > 0 ? Math.max(0, Number(displayStats.goals) || 0) : 0;
      const assists = appearances > 0 ? Math.max(0, Number(displayStats.assists) || 0) : 0;
      const averageRating = appearances > 0
        ? Math.max(0, Number(displayStats.averageRating !== undefined ? displayStats.averageRating : row.averageRating) || 0)
        : 0;
      const score = appearances > 0
        ? Number((averageRating * 9 + goals * 0.95 + assists * 0.62 + Number(row.ovr || 0) * 0.08).toFixed(3))
        : 0;
      const weightedGoals = appearances > 0
        ? Number((goals * (0.82 + Number(row.leagueStrength || 60) / 450)).toFixed(3))
        : 0;
      return { ...row, appearances, goals, assists, averageRating, score, weightedGoals };
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
    version: VERSION, normalize, clubKey, groupForPosition, positionProductionProfile, playerRoleWeight,
    ensureState, completeSeason, advanceToSeason, getSeasonLines, getClubPower, transferTargets,
    getLeagueTable, leaderboard, dashboard
  });
})(window);


/* LAST WHISTLE WORLD SIMULATION V2
 * Shared fixture results drive league tables and player statistics.
 * Competition and transfer outputs are deterministic per season/save.
 */
(function (global) {
  "use strict";
  const base = global.LWWorldAI;
  if (!base) return;
  const ROLE_TARGETS = Object.freeze({ goalkeeper: 2, defender: 5, midfielder: 5, attacker: 4 });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
  const hash = value => {
    let h = 2166136261;
    for (const char of String(value)) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  const random = seed => {
    let value = (Number(seed) >>> 0) || 0x9e3779b9;
    return () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const avg = rows => rows.length ? rows.reduce((sum, n) => sum + n, 0) / rows.length : 55;
  const normalize = value => String(value == null ? "" : value).normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06FF]/g, "");
  function groupRows(world) {
    const groups = new Map();
    Object.values(world.clubs).filter(club => club && club.leagueId && Number(club.division) >= 1 && Number(club.division) <= 2)
      .forEach(club => {
        const key = String(club.leagueId) + ":" + String(club.division || 1);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(club);
      });
    return groups;
  }
  function playersForClub(world, club) {
    return (club.roster || []).map(id => world.players[id]).filter(player => player && !player.freeAgent);
  }
  function makeLineup(world, club) {
    const rows = playersForClub(world, club);
    const selected = [];
    const quotas = [
      ["goalkeeper", 1], ["defender", 4], ["midfielder", 4], ["attacker", 2]
    ];
    quotas.forEach(([group, count]) => {
      rows.filter(player => player.group === group)
        .sort((a, b) => Number(b.ovr || 50) - Number(a.ovr || 50) || String(a.id).localeCompare(String(b.id)))
        .slice(0, count).forEach(player => { if (!selected.some(row => row.id === player.id)) selected.push(player); });
    });
    rows.slice().sort((a, b) => Number(b.ovr || 50) - Number(a.ovr || 50))
      .forEach(player => { if (selected.length < 11 && !selected.some(row => row.id === player.id)) selected.push(player); });
    return selected.slice(0, 11);
  }
  function poisson(rng, lambda) {
    const limit = Math.exp(-clamp(lambda, 0.05, 4));
    let product = 1, count = 0;
    do { count++; product *= Math.max(1e-9, rng()); } while (product > limit && count < 12);
    return Math.max(0, count - 1);
  }
  function compactWorldMatch(match) {
    return { season: Number(match.season), competitionId: match.competitionId || "league",
      division: Number(match.division) || 1, matchday: Number(match.matchday) || 1,
      homeClubId: match.homeClubId, awayClubId: match.awayClubId,
      homeGoals: Number(match.homeGoals) || 0, awayGoals: Number(match.awayGoals) || 0 };
  }
  function expandWorldMatches(world, matches) {
    return (matches || []).map(match => {
      const home = world.clubs[match.homeClubId], away = world.clubs[match.awayClubId];
      return { ...match, id: "world-match-" + match.season + "-" + hash([match.homeClubId, match.awayClubId, match.matchday].join("|")).toString(36),
        home: home ? home.name : "", away: away ? away.name : "",
        result: match.homeGoals === match.awayGoals ? "draw" : match.homeGoals > match.awayGoals ? "home-win" : "away-win" };
    });
  }
  function playerAccumulator() {
    return { appearances: 0, goals: 0, assists: 0, ratingTotal: 0, clubId: "", leagueId: "", division: 0 };
  }
  function weightedPick(rows, rng, purpose) {
    if (!rows.length) return null;
    const weights = rows.map(player => {
      const group = player.group || base.groupForPosition(player.position);
      const fallbackRole = purpose === "goal" ? ({ attacker: 2.4, midfielder: 1.2, defender: 0.42, goalkeeper: 0.03 })[group]
        : ({ attacker: 1.3, midfielder: 1.8, defender: 0.7, goalkeeper: 0.04 })[group];
      const role = typeof base.playerRoleWeight === "function"
        ? base.playerRoleWeight(player, purpose) : fallbackRole;
      return Math.max(0.05, (Number(player.ovr) || 50) - 27) * (Number(role) || 1);
    });
    let roll = rng() * weights.reduce((sum, value) => sum + value, 0);
    for (let i = 0; i < rows.length; i++) { roll -= weights[i]; if (roll <= 0) return rows[i]; }
    return rows[rows.length - 1];
  }
  function lineupForMatch(world, club, cache) {
    if (!(cache instanceof Map)) return makeLineup(world, club);
    if (!cache.has(club.id)) cache.set(club.id, makeLineup(world, club));
    return cache.get(club.id);
  }
  function playMatch(world, home, away, season, division, matchday, sequence, accumulators, competitionId, lineupCache) {
    const seed = hash([season, division, matchday, home.id, away.id, competitionId || "league", "match-v2"].join("|"));
    const rng = random(seed);
    const homeLineup = lineupForMatch(world, home, lineupCache), awayLineup = lineupForMatch(world, away, lineupCache);
    const homeStrength = Number(home.power || home.basePower || 55);
    const awayStrength = Number(away.power || away.basePower || 55);
    const xgHome = clamp(1.28 + (homeStrength - awayStrength) * 0.027 + 0.16, 0.28, 3.05);
    const xgAway = clamp(1.24 + (awayStrength - homeStrength) * 0.027 - 0.06, 0.22, 2.9);
    const homeGoals = poisson(rng, xgHome), awayGoals = poisson(rng, xgAway);
    const homeGoalContributors = [], awayGoalContributors = [];
    function addAppearance(lineup, attackingGoals, concedingGoals, resultForClub, clubId) {
      lineup.forEach(player => {
        const stat = accumulators.get(player.id);
        if (!stat) return;
        stat.appearances++;
        stat.clubId = clubId;
        stat.leagueId = String(world.clubs[clubId].leagueId || "");
        stat.division = Number(world.clubs[clubId].division) || 1;
        let rating = 6.12 + (Number(player.ovr || 55) - 65) * 0.012
          + (resultForClub === "win" ? 0.24 : resultForClub === "draw" ? 0.04 : -0.15)
          + (player.group === "goalkeeper" || player.group === "defender" ? (concedingGoals === 0 ? 0.3 : 0) : 0)
          + rng() * 0.48 - 0.24;
        stat.ratingTotal += clamp(rating, 4.4, 9.8);
      });
    }
    for (let i = 0; i < homeGoals; i++) {
      const scorer = weightedPick(homeLineup, rng, "goal");
      if (!scorer) break;
      accumulators.get(scorer.id).goals++;
      homeGoalContributors.push(scorer.id);
      const helperPool = homeLineup.filter(player => player.id !== scorer.id);
      if (helperPool.length && rng() < 0.72) {
        const helper = weightedPick(helperPool, rng, "assist");
        if (helper) accumulators.get(helper.id).assists++;
      }
    }
    for (let i = 0; i < awayGoals; i++) {
      const scorer = weightedPick(awayLineup, rng, "goal");
      if (!scorer) break;
      accumulators.get(scorer.id).goals++;
      awayGoalContributors.push(scorer.id);
      const helperPool = awayLineup.filter(player => player.id !== scorer.id);
      if (helperPool.length && rng() < 0.72) {
        const helper = weightedPick(helperPool, rng, "assist");
        if (helper) accumulators.get(helper.id).assists++;
      }
    }
    const homeOutcome = homeGoals > awayGoals ? "win" : homeGoals === awayGoals ? "draw" : "loss";
    const awayOutcome = awayGoals > homeGoals ? "win" : awayGoals === homeGoals ? "draw" : "loss";
    addAppearance(homeLineup, homeGoals, awayGoals, homeOutcome, home.id);
    addAppearance(awayLineup, awayGoals, homeGoals, awayOutcome, away.id);
    return {
      id: "world-match-" + season + "-" + hash([home.id, away.id, competitionId || "league", sequence].join("|")).toString(36),
      season: Number(season), competitionId: competitionId || "league", division: Number(division) || 1,
      matchday: Number(matchday) || 1, homeClubId: home.id, awayClubId: away.id,
      home: home.name, away: away.name, homeGoals, awayGoals,
      scorers: homeGoalContributors.concat(awayGoalContributors),
      result: homeGoals === awayGoals ? "draw" : homeGoals > awayGoals ? "home-win" : "away-win"
    };
  }
  function tableRow(club, season, leagueId, division) {
    return { season: Number(season), leagueId: String(leagueId), division: Number(division) || 1,
      country: club.country, clubId: club.id, club: club.name, power: Math.round(Number(club.power) || 55),
      played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: 0, recentForm: "" };
  }
  function applyResult(tablesByClub, match) {
    const home = tablesByClub.get(match.homeClubId), away = tablesByClub.get(match.awayClubId);
    if (!home || !away) return;
    home.played++; away.played++;
    home.gf += match.homeGoals; home.ga += match.awayGoals;
    away.gf += match.awayGoals; away.ga += match.homeGoals;
    if (match.homeGoals > match.awayGoals) { home.w++; away.l++; home.pts += 3; home.recentForm += "W"; away.recentForm += "L"; }
    else if (match.homeGoals < match.awayGoals) { away.w++; home.l++; away.pts += 3; away.recentForm += "W"; home.recentForm += "L"; }
    else { home.d++; away.d++; home.pts++; away.pts++; home.recentForm += "D"; away.recentForm += "D"; }
  }
  function buildPlayerRows(world, season, accumulators) {
    // Precompute club power averages once per league/division. The old implementation
    // rescanned every club twice for every player, adding millions of needless comparisons
    // whenever a complete world season was simulated.
    const powerByLeagueDivision = new Map();
    Object.values(world.clubs).forEach(club => {
      const key = String(club.leagueId || "") + "|" + Number(club.division);
      const summary = powerByLeagueDivision.get(key) || { total: 0, count: 0 };
      summary.total += Number(club.power) || 55;
      summary.count++;
      powerByLeagueDivision.set(key, summary);
    });
    const leagueStrengthFor = (leagueId, division) => {
      const summary = powerByLeagueDivision.get(String(leagueId || "") + "|" + Number(division));
      return summary && summary.count ? Math.round(summary.total / summary.count) : 55;
    };
    return Object.values(world.players).map(player => {
      const acc = accumulators.get(player.id) || playerAccumulator();
      const historicalClub = world.clubs[acc.clubId || player.clubId] || null;
      const apps = Number(acc.appearances) || 0, goals = Number(acc.goals) || 0, assists = Number(acc.assists) || 0;
      const rating = apps ? Number((acc.ratingTotal / apps).toFixed(2)) : 0;
      const leagueId = String(acc.leagueId || player.leagueId || "");
      const leagueDivision = Number(acc.division || player.division || 1);
      const leagueStrength = leagueStrengthFor(leagueId, leagueDivision);
      const row = {
        id: player.id, season: Number(season), name: player.name, club: historicalClub ? historicalClub.name : "",
        clubName: historicalClub ? historicalClub.name : "", clubId: acc.clubId || player.clubId || "",
        country: historicalClub ? historicalClub.country : player.country || "",
        leagueId, division: Number(acc.division || player.division) || 0,
        position: player.position, group: player.group || base.groupForPosition(player.position),
        age: Number(player.age) || 18, ovr: Number(player.ovr) || 50, potential: Number(player.potential) || Number(player.ovr) || 50,
        appearances: apps, goals, assists, averageRating: rating,
        leagueStrength,
        prestige: historicalClub ? historicalClub.prestige : player.prestige || 0,
        confederation: historicalClub ? historicalClub.confederation : "",
        originConfederation: historicalClub ? historicalClub.confederation : "",
        isGenerated: !!player.isGenerated, realPlayer: !player.isGenerated,
        score: Number((rating * 9 + goals * 0.95 + assists * 0.62 + (Number(player.ovr) || 0) * 0.08).toFixed(3)),
        weightedGoals: Number((goals * (0.82 + (leagueStrength || 60) / 450)).toFixed(3)),
        seasonStats: { season: Number(season), appearances: apps, goals, assists, averageRating: rating,
          ovr: Number(player.ovr) || 50, club: historicalClub ? historicalClub.name : "", country: historicalClub ? historicalClub.country : "" }
      };
      row.displayStats = { appearances: apps, goals, assists, averageRating: rating };
      return row;
    });
  }
  function simulateLeagueSeason(save, season, db) {
    const world = base.ensureState(save, db);
    world.matchesBySeason = world.matchesBySeason && typeof world.matchesBySeason === "object" ? world.matchesBySeason : {};
    world.leagueTables = world.leagueTables && typeof world.leagueTables === "object" ? world.leagueTables : {};
    world.seasonStats = world.seasonStats && typeof world.seasonStats === "object" ? world.seasonStats : {};
    world.competitionsBySeason = world.competitionsBySeason && typeof world.competitionsBySeason === "object" ? world.competitionsBySeason : {};
    const year = Math.max(1, int(season, int(save.season, 1)));
    if (Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year))) {
      return { season: year, rows: world.seasonStats[String(year)] || [], tables: world.leagueTables[String(year)] || {},
        matches: expandWorldMatches(world, world.matchesBySeason[String(year)] || []),
        competitions: world.competitionsBySeason[String(year)] || [] };
    }
    const accumulators = new Map(Object.values(world.players).map(player => [player.id, playerAccumulator()]));
    const tables = {}, allMatches = [], groups = groupRows(world);
    // The selected XI cannot change during a season simulation; cache it instead of sorting each squad for every fixture.
    const lineupCache = new Map();
    let sequence = 0;
    for (const [groupKey, clubsRaw] of groups.entries()) {
      const clubs = clubsRaw.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const split = groupKey.lastIndexOf(":");
      const leagueId = groupKey.slice(0, split), division = Number(groupKey.slice(split + 1)) || 1;
      const leagueTables = new Map(), recent = new Map();
      clubs.forEach(club => { leagueTables.set(club.id, tableRow(club, year, leagueId, division)); recent.set(club.id, ""); });
      const groupMatchStartIndex = allMatches.length;
      if (clubs.length >= 2) {
        let rotation = clubs.slice();
        if (rotation.length % 2) rotation.push(null);
        const n = rotation.length, rounds = n - 1;
        for (let round = 0; round < rounds; round++) {
          for (let i = 0; i < n / 2; i++) {
            const one = rotation[i], two = rotation[n - 1 - i];
            if (!one || !two) continue;
            const home = (round + i) % 2 === 0 ? one : two;
            const away = home.id === one.id ? two : one;
            const fixture = playMatch(world, home, away, year, division, round + 1, ++sequence, accumulators, "league", lineupCache);
            allMatches.push(fixture); applyResult(leagueTables, fixture);
          }
          const fixed = rotation[0], rest = rotation.slice(1);
          rest.unshift(rest.pop());
          rotation = [fixed].concat(rest);
        }
        // Reverse the venue for a second leg; both legs use a single shared match result.
        rotation = clubs.slice();
        if (rotation.length % 2) rotation.push(null);
        for (let round = 0; round < rounds; round++) {
          for (let i = 0; i < n / 2; i++) {
            const one = rotation[i], two = rotation[n - 1 - i];
            if (!one || !two) continue;
            const home = (round + i) % 2 === 0 ? two : one;
            const away = home.id === two.id ? one : two;
            const fixture = playMatch(world, home, away, year, division, rounds + round + 1, ++sequence, accumulators, "league", lineupCache);
            allMatches.push(fixture); applyResult(leagueTables, fixture);
          }
          const fixed = rotation[0], rest = rotation.slice(1);
          rest.unshift(rest.pop());
          rotation = [fixed].concat(rest);
        }

        // Scotland's 12-team Premiership plays 33 matches before the league splits.
        // The top and bottom six then play five more fixtures inside their own half.
        if (leagueId === "scotland" && division === 1 && clubs.length === 12) {
          const homeCounts = new Map(clubs.map(club => [club.id, 0]));
          allMatches.slice(groupMatchStartIndex).forEach(match => {
            if (homeCounts.has(match.homeClubId)) {
              homeCounts.set(match.homeClubId, homeCounts.get(match.homeClubId) + 1);
            }
          });

          // Third round-robin leg brings every club to 33 played; choose venues
          // to balance the number of home fixtures accumulated so far.
          let thirdRotation = clubs.slice();
          const thirdRounds = clubs.length - 1;
          for (let round = 0; round < thirdRounds; round++) {
            for (let i = 0; i < thirdRotation.length / 2; i++) {
              const one = thirdRotation[i], two = thirdRotation[thirdRotation.length - 1 - i];
              if (!one || !two) continue;
              const oneHomeCount = homeCounts.get(one.id) || 0;
              const twoHomeCount = homeCounts.get(two.id) || 0;
              let home, away;
              if (oneHomeCount < twoHomeCount) { home = one; away = two; }
              else if (twoHomeCount < oneHomeCount) { home = two; away = one; }
              else { home = (round + i) % 2 === 0 ? one : two; away = home.id === one.id ? two : one; }
              const fixture = playMatch(world, home, away, year, division,
                rounds * 2 + round + 1, ++sequence, accumulators, "league", lineupCache);
              allMatches.push(fixture);
              applyResult(leagueTables, fixture);
              homeCounts.set(home.id, (homeCounts.get(home.id) || 0) + 1);
            }
            const fixed = thirdRotation[0], rest = thirdRotation.slice(1);
            rest.unshift(rest.pop());
            thirdRotation = [fixed].concat(rest);
          }

          // Rank after matchday 33, then keep the final five matchdays inside
          // the top-six and bottom-six groups, as the real league format does.
          const splitStandings = Array.from(leagueTables.values()).map(row => ({
            ...row, gd: Number(row.gf || 0) - Number(row.ga || 0)
          })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
            || b.power - a.power || a.club.localeCompare(b.club, "ar"));
          const topSixIds = new Set(splitStandings.slice(0, 6).map(row => row.clubId));
          const halves = [
            clubs.filter(club => topSixIds.has(club.id)),
            clubs.filter(club => !topSixIds.has(club.id))
          ];
          halves.forEach(half => {
            let splitRotation = half.slice();
            const splitRounds = splitRotation.length - 1;
            for (let round = 0; round < splitRounds; round++) {
              for (let i = 0; i < splitRotation.length / 2; i++) {
                const one = splitRotation[i], two = splitRotation[splitRotation.length - 1 - i];
                if (!one || !two) continue;
                const oneHomeCount = homeCounts.get(one.id) || 0;
                const twoHomeCount = homeCounts.get(two.id) || 0;
                let home, away;
                if (oneHomeCount < twoHomeCount) { home = one; away = two; }
                else if (twoHomeCount < oneHomeCount) { home = two; away = one; }
                else { home = (round + i) % 2 === 0 ? one : two; away = home.id === one.id ? two : one; }
                const fixture = playMatch(world, home, away, year, division,
                  rounds * 3 + round + 1, ++sequence, accumulators, "league", lineupCache);
                allMatches.push(fixture);
                applyResult(leagueTables, fixture);
                homeCounts.set(home.id, (homeCounts.get(home.id) || 0) + 1);
              }
              const fixed = splitRotation[0], rest = splitRotation.slice(1);
              rest.unshift(rest.pop());
              splitRotation = [fixed].concat(rest);
            }
          });
        }
      }
      const ranked = Array.from(leagueTables.values()).map(row => {
        row.gd = row.gf - row.ga;
        row.form = Number((6 + (row.pts / Math.max(1, row.played * 3)) * 1.2).toFixed(2));
        row.recentForm = row.recentForm.slice(-5);
        return row;
      }).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.power - a.power || a.club.localeCompare(b.club, "ar"));
      const tableKey = division === 1 ? leagueId : leagueId + ":" + division;
      tables[tableKey] = ranked.map((row, index) => ({ ...row, rank: index + 1,
        status: division > 1 ? (index < 2 ? "منافس على الصعود — محاكاة" : "مركز الدرجة الثانية")
          : index === 0 ? "بطل المحاكاة" : index >= Math.max(1, ranked.length - 2) ? "منطقة الهبوط — محاكاة" : "مركز الدوري" }));
    }
    const rows = buildPlayerRows(world, year, accumulators);
    // Persist compact match scores and only the most recent complete season of fixtures.
    // This prevents localStorage quota failures when the game contains hundreds of clubs.
    world.matchesBySeason[String(year)] = allMatches.map(compactWorldMatch);
    world.seasonStats[String(year)] = rows.map(row => ({ ...row, displayStats: undefined }));
    world.leagueTables[String(year)] = tables;
    world.competitionsBySeason[String(year)] = simulateCompetitions(world, year, db, tables);
    const matchKeep = Object.keys(world.matchesBySeason).map(Number).sort((a,b)=>a-b).slice(-1);
    const matchKeepSet = new Set(matchKeep.map(String));
    Object.keys(world.matchesBySeason).forEach(key => { if (!matchKeepSet.has(key)) delete world.matchesBySeason[key]; });
    const seasonKeep = Object.keys(world.seasonStats).map(Number).sort((a,b)=>a-b).slice(-2);
    const seasonKeepSet = new Set(seasonKeep.map(String));
    Object.keys(world.seasonStats).forEach(key => { if (!seasonKeepSet.has(key)) delete world.seasonStats[key]; });
    Object.keys(world.leagueTables).forEach(key => { if (!seasonKeepSet.has(key)) delete world.leagueTables[key]; });
    Object.keys(world.competitionsBySeason).forEach(key => { if (!seasonKeepSet.has(key)) delete world.competitionsBySeason[key]; });
    return { season: year, rows, tables, matches: allMatches, competitions: world.competitionsBySeason[String(year)] };
  }
  function knockout(world, season, def, participants) {
    let teams = participants.slice();
    if (teams.length < 2) return null;
    const rng = random(hash(season + "|" + def.id + "|cup-v2"));
    // Seeded shuffle stops the strongest club from winning every competition by construction.
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)); [teams[i], teams[j]] = [teams[j], teams[i]];
    }
    const matches = [];
    let round = 1, sequence = 0;
    while (teams.length > 1 && round <= 8) {
      const next = [];
      for (let i = 0; i < teams.length; i += 2) {
        if (i === teams.length - 1) { next.push(teams[i]); continue; }
        const first = teams[i], second = teams[i + 1];
        const home = round % 2 ? first : second, away = home.id === first.id ? second : first;
        const fixtureSeed = hash(season + "|" + def.id + "|" + round + "|" + home.id + "|" + away.id);
        const matchRng = random(fixtureSeed);
        let homeGoals = poisson(matchRng, clamp(1.24 + (home.power - away.power) * 0.025 + 0.08, 0.2, 2.8));
        let awayGoals = poisson(matchRng, clamp(1.20 + (away.power - home.power) * 0.025, 0.2, 2.7));
        // Cup ties cannot end level: simulate extra time and penalties with a deterministic tiebreak.
        if (homeGoals === awayGoals) {
          if (matchRng() < 0.23) homeGoals++;
          else if (matchRng() < 0.23) awayGoals++;
          else if (matchRng() < 0.5) homeGoals++;
          else awayGoals++;
        }
        const winner = homeGoals > awayGoals ? home : away;
        matches.push({ id: "cup-match-" + season + "-" + def.id + "-" + (++sequence), season: Number(season),
          competitionId: def.id, round, homeClubId: home.id, awayClubId: away.id, home: home.name, away: away.name,
          homeGoals, awayGoals, winnerId: winner.id, winner: winner.name, simulation: true });
        next.push(winner);
      }
      teams = next; round++;
    }
    const champion = teams[0];
    const runnerUp = matches.length ? world.clubs[matches[matches.length - 1].homeGoals > matches[matches.length - 1].awayGoals
      ? matches[matches.length - 1].awayClubId : matches[matches.length - 1].homeClubId] : null;
    return { id: def.id, name: def.name, kind: def.kind, season: Number(season), region: def.region || "",
      confederation: def.confederation || "", participants: participants.map(club => club.id),
      matches, championId: champion.id, champion: champion.name, runnerUpId: runnerUp ? runnerUp.id : "",
      runnerUp: runnerUp ? runnerUp.name : "", source: "محاكاة داخل اللعبة؛ ليست نتائج رسمية مباشرة" };
  }
  function simulateCompetitions(world, season, db, tables) {
    if (!db || typeof db.simulationCupDefinitions !== "function") return [];
    let definitions = [];
    try { definitions = db.simulationCupDefinitions() || []; } catch (_) { return []; }
    const clubs = Object.values(world.clubs).filter(club => club.leagueId && Number(club.division) >= 1);
    const results = [];
    definitions.forEach(def => {
      if (!def || !def.id) return;
      let participants = [];
      if (def.kind === "domestic-cup") {
        const leagueId = Array.isArray(def.countries) ? def.countries[0] : "";
        participants = clubs.filter(club => club.leagueId === leagueId && (def.lower || Number(club.division) === 1));
      } else if (def.kind === "continental") {
        const pool = clubs.filter(club => club.confederation === def.confederation && Number(club.division) === 1)
          .sort((a, b) => Number(b.power || 50) - Number(a.power || 50));
        const maxTeams = Math.min(12, pool.length);
        const usedCountries = new Set();
        for (const club of pool) {
          if (participants.length >= maxTeams) break;
          if (!usedCountries.has(normalize(club.country))) {
            participants.push(club); usedCountries.add(normalize(club.country));
          }
        }
        for (const club of pool) if (participants.length < maxTeams && !participants.some(row => row.id === club.id)) participants.push(club);
      } else if (def.kind === "world") {
        participants = clubs.filter(club => Number(club.division) === 1)
          .sort((a, b) => Number(b.power || 50) - Number(a.power || 50)).slice(0, 16);
      } else if (def.kind === "supercup" && season > 1) {
        const previous = world.competitionsBySeason[String(season - 1)] || [];
        const eligible = previous.filter(row => row && row.championId
          && (!def.confederation || row.confederation === def.confederation));
        eligible.sort((a,b)=>a.kind==="continental" ? -1 : b.kind==="continental" ? 1 : 0);
        eligible.slice(0, 2).forEach(row => {
          const club = world.clubs[row.championId];
          if (club && !participants.some(team => team.id === club.id)) participants.push(club);
        });
        if (participants.length < 2 && def.countries && def.countries.length) {
          const leagueId = def.countries[0];
          const leagueChampion = (tables[leagueId] || [])[0];
          const cupChampion = previous.find(row => row.kind === "domestic-cup" && row.id && row.championId
            && (world.clubs[row.championId] || {}).leagueId === leagueId);
          [leagueChampion && world.clubs[leagueChampion.clubId], cupChampion && world.clubs[cupChampion.championId]]
            .forEach(club => { if (club && !participants.some(team => team.id === club.id)) participants.push(club); });
        }
      } else {
        return;
      }
      const unique = [];
      participants.forEach(club => { if (club && !unique.some(row => row.id === club.id)) unique.push(club); });
      const tournament = knockout(world, season, def, unique.slice(0, 16));
      if (tournament) results.push(tournament);
    });
    return results;
  }
  function applyPromotionRelegation(world, season) {
    world.promotionHistory = Array.isArray(world.promotionHistory) ? world.promotionHistory : [];
    const destinationSeason = Number(season) + 1;
    if (world.promotionHistory.some(row => Number(row.season) === destinationSeason)) return [];
    const tables = world.leagueTables[String(season)] || {};
    const leagueIds = new Set(Object.values(world.clubs).map(club => String(club.leagueId || "")).filter(Boolean));
    const moves = [];
    for (const leagueId of leagueIds) {
      const first = tables[leagueId] || [], second = tables[leagueId + ":2"] || [];
      if (first.length < 6 || second.length < 3) continue;
      const count = Math.min(2, Math.max(1, Math.floor(second.length * 0.15)), Math.max(1, Math.floor(first.length * 0.1)));
      const promoted = second.slice(0, count), relegated = first.slice(-count);
      for (let i = 0; i < count; i++) {
        const up = world.clubs[promoted[i].clubId], down = world.clubs[relegated[i].clubId];
        if (!up || !down) continue;
        up.division = 1; down.division = 2;
        up.roster.forEach(id => { if (world.players[id]) world.players[id].division = 1; });
        down.roster.forEach(id => { if (world.players[id]) world.players[id].division = 2; });
        moves.push({ leagueId, promoted: up.name, relegated: down.name, season: Number(season) + 1 });
      }
    }
    if (moves.length) {
      world.promotionHistory.unshift({ season: Number(season) + 1, moves });
      world.promotionHistory = world.promotionHistory.slice(0, 30);
      world.notes.unshift({ season: Number(season) + 1, type: "promotion", text: "اكتملت حركة الصعود والهبوط بين الدرجات في " + moves.length + " دوريًا." });
      world.notes = world.notes.slice(0, 30);
    }
    return moves;
  }
  function signFreeAgents(world, season, existingMoves) {
    const freeAgents = Object.values(world.players).filter(player => player && !player.retired && player.freeAgent && Number(player.contractSeasons) <= 0)
      .sort((a,b)=>Number(b.ovr||50)-Number(a.ovr||50));
    const clubs = Object.values(world.clubs).filter(club => Number.isFinite(Number(club.division)) && Number(club.division) >= 1 && (club.roster || []).length < 18)
      .sort((a,b)=>Number(b.power||50)-Number(a.power||50));
    const roleCountsByClub = new Map();
    for (const club of clubs) {
      const counts = Object.create(null);
      for (const id of club.roster || []) {
        const player = world.players[id];
        if (!player || player.freeAgent) continue;
        const group = player.group || base.groupForPosition(player.position);
        counts[group] = (counts[group] || 0) + 1;
      }
      roleCountsByClub.set(club.id, counts);
    }
    const usedClubs = new Set(), signed = [];
    const maxSignings = Math.min(12, Math.max(2, Math.round(clubs.length * 0.10)));
    for (const player of freeAgents) {
      if (signed.length >= maxSignings) break;
      const group = player.group || base.groupForPosition(player.position);
      const roleTarget = ROLE_TARGETS[group];
      if (!roleTarget) continue;
      const eligible = clubs.filter(club => {
        const counts = roleCountsByClub.get(club.id) || {};
        return !usedClubs.has(club.id)
          && Number(club.roster.length) < 18
          && (!player.previousClubId || player.previousClubId !== club.id)
          && Number(player.ovr) <= Number(club.power || 55) + 10
          && Number(player.ovr) >= Number(club.power || 55) - 23
          && (player.age || 18) < 37
          && (counts[group] || 0) < roleTarget;
      });
      if (!eligible.length) continue;
      // Prefer the club with the largest vacancy in this exact role, then club strength.
      eligible.sort((a,b) => {
        const aCount = (roleCountsByClub.get(a.id) || {})[group] || 0;
        const bCount = (roleCountsByClub.get(b.id) || {})[group] || 0;
        return aCount - bCount || Number(b.power || 50) - Number(a.power || 50) || String(a.id).localeCompare(String(b.id));
      });
      const buyer = eligible[0];
      const previousClub = player.previousClubId && world.clubs[player.previousClubId];
      const oldClubName = previousClub ? previousClub.name : "لاعب حر";
      player.clubId = buyer.id; player.country = buyer.country; player.leagueId = buyer.leagueId;
      player.division = buyer.division; player.freeAgent = false;
      player.contractSeasons = 2 + (hash(player.id + "|" + season + "|free-agent-term") % 3);
      buyer.roster.push(player.id);
      const counts = roleCountsByClub.get(buyer.id);
      counts[group] = (counts[group] || 0) + 1;
      usedClubs.add(buyer.id);
      const move = {
        id: "world-transfer-" + season + "-free-" + hash(player.id + "|" + buyer.id).toString(36),
        season: Number(season), day: 1, playerId: player.id, player: player.name, position: player.position,
        group, from: oldClubName, fromCountry: previousClub ? previousClub.country : "",
        to: buyer.name, toCountry: buyer.country, fee: 0, currency: buyer.currency,
        reason: "تعاقد مجاني • احتياج في المركز وخبرة/إمكانات مناسبة",
        playerOvr: player.ovr, kind: "تعاقد مع لاعب حر — محاكاة"
      };
      signed.push(move);
      world.playerHistory[player.id] = Array.isArray(world.playerHistory[player.id]) ? world.playerHistory[player.id] : [];
      world.playerHistory[player.id].unshift({ season: Number(season), club: buyer.name, country: buyer.country,
        type: "free-agent-signing", from: oldClubName });
      world.playerHistory[player.id] = world.playerHistory[player.id].slice(0, 12);
    }
    if (signed.length) {
      world.transfers = signed.concat(world.transfers || []).slice(0, 300);
      for (const club of clubs) {
        const top = playersForClub(world, club).slice().sort((a,b)=>Number(b.ovr||50)-Number(a.ovr||50)).slice(0,11);
        if (top.length) club.power = clamp(Math.round(Number(club.basePower||club.power||55)*0.7
          + avg(top.map(player=>Number(player.ovr)||50))*0.3), 35, 97);
      }
      const report = world.marketReports && world.marketReports[0];
      if (report && Number(report.season) === Number(season)) {
        report.moves = Number(report.moves || 0) + signed.length;
        report.transferIds = signed.map(row => row.id).concat(report.transferIds || []);
        report.summary += " تم التعاقد مع " + signed.length + " لاعبًا حرًا بعد انتهاء عقودهم.";
      }
    }
    return signed;
  }
  function completeSeason(save, season, db) {
    const world = base.ensureState(save, db);
    const year = Math.max(1, int(season, int(save.season, 1)));
    const alreadyCompleted = Array.isArray(world.completedSeasons) && world.completedSeasons.includes(year);
    if (alreadyCompleted) {
      // Preserve the legacy fallback for compact saves whose old match list was pruned.
      if (!world.matchesBySeason || !Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year))) {
        return base.completeSeason(save, year, db);
      }
      const sim = simulateLeagueSeason(save, year, db);
      const market = (world.marketReports || []).find(row => Number(row.season) === year) || {};
      return { season: year, rows: sim.rows, tables: sim.tables, matches: sim.matches,
        competitions: sim.competitions, alreadyCompleted: true, transfers: Number(market.moves) || 0 };
    }

    // Simulate once and use those shared fixture results for both tables and player stats.
    // The old flow first generated a projected season for every player, then threw those
    // rows away and simulated the same season again.
    const sim = simulateLeagueSeason(save, year, db);
    world.completedSeasons = Array.isArray(world.completedSeasons) ? world.completedSeasons : [];
    if (!world.completedSeasons.includes(year)) world.completedSeasons.push(year);
    world.completedSeasons = world.completedSeasons.sort((a, b) => a - b).slice(-20);
    world.lastCompletedSeason = Math.max(Number(world.lastCompletedSeason) || 0, year);
    world.currentSeason = year;
    return { season: year, rows: sim.rows, tables: sim.tables, matches: sim.matches,
      competitions: sim.competitions, alreadyCompleted: false, transfers: 0 };
  }
  function getLeagueTable(save, leagueId, season, db) {
    const world = base.ensureState(save, db);
    const year = Math.max(1, int(season, int(save.season, 1)));
    if (world.completedSeasons && world.completedSeasons.includes(year)
      && (!world.matchesBySeason || !Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year)))) {
      return base.getLeagueTable(save, leagueId, year, db);
    }
    const sim = simulateLeagueSeason(save, year, db);
    return (sim.tables[String(leagueId)] || []).slice();
  }
  function getDivisionTable(save, leagueId, division, season, db) {
    const world = base.ensureState(save, db);
    const year = Math.max(1, int(season, int(save.season, 1)));
    const completed = world.completedSeasons && world.completedSeasons.includes(year);
    if (completed && (!world.matchesBySeason || !Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year)))) return [];
    const sim = simulateLeagueSeason(save, year, db);
    return (sim.tables[Number(division) === 2 ? String(leagueId) + ":2" : String(leagueId)] || []).slice();
  }
  function getSeasonLines(save, season, progress, db) {
    const world = base.ensureState(save, db);
    const year = Math.max(1, int(season, int(save.season, 1)));
    if (!(world.completedSeasons && world.completedSeasons.includes(year)
      && (!world.matchesBySeason || !Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year))))) {
      simulateLeagueSeason(save, year, db);
    }
    return base.getSeasonLines(save, year, progress === undefined ? 1 : progress, db);
  }
  function advanceToSeason(save, nextSeason, db) {
    const world = base.ensureState(save, db);
    const next = Math.max(1, int(nextSeason, int(save.season, 1)));
    if (world.lastAdvancedTo >= next) return base.advanceToSeason(save, next, db);
    const previous = Math.max(1, next - 1);
    completeSeason(save, previous, db);
    const promotions = applyPromotionRelegation(world, previous);
    const transition = base.advanceToSeason(save, next, db);
    if (!transition.alreadyAdvanced) {
      const freeAgentMoves = signFreeAgents(world, next, transition.moves || []);
      transition.moves = (transition.moves || []).concat(freeAgentMoves);
      if (world.marketReports && world.marketReports[0] && Number(world.marketReports[0].season) === next) {
        world.marketReports[0].moves = transition.moves.length;
        world.marketReports[0].transferIds = transition.moves.map(row => row.id);
      }
      if (promotions.length) transition.promotions = promotions;
      if (freeAgentMoves.length) world.notes.unshift({ season: next, type: "free-agent-market",
        text: "وقّعت الأندية مع " + freeAgentMoves.length + " لاعبًا حرًا بعد انتهاء عقودهم." });
      world.notes = (world.notes || []).slice(0, 30);
    }
    return transition;
  }
  const dashboardCache = new WeakMap();
  function dashboard(save, db) {
    const world = base.ensureState(save, db);
    const season = Math.max(1, int(world.currentSeason, int(save.season, 1)));
    const matchesBySeason = world.matchesBySeason && typeof world.matchesBySeason === "object" ? world.matchesBySeason : {};
    const statsBySeason = world.seasonStats && typeof world.seasonStats === "object" ? world.seasonStats : {};
    const currentKey = String(season);
    const hasCurrentMatches = Object.prototype.hasOwnProperty.call(matchesBySeason, currentKey);
    const knownSeasons = new Set([
      ...Object.keys(matchesBySeason),
      ...Object.keys(statsBySeason).filter(key => Array.isArray(statsBySeason[key]) && statsBySeason[key].length)
    ].map(Number).filter(value => Number.isFinite(value) && value > 0));
    const statsSeason = hasCurrentMatches ? season : Math.max(0, ...knownSeasons);
    const hasStats = statsSeason > 0 && (
      Object.prototype.hasOwnProperty.call(matchesBySeason, String(statsSeason))
      || (Array.isArray(statsBySeason[String(statsSeason)]) && statsBySeason[String(statsSeason)].length > 0)
    );
    const currentMatches = matchesBySeason[currentKey];
    const currentCompetitions = world.competitionsBySeason && world.competitionsBySeason[currentKey];
    const currentProgress = clamp(Number(save.seasonApps || 0) / Math.max(1, Number(save.seasonAppsTarget || 0)), 0, 1);
    const lastTransfer = (world.transfers || [])[0] || {};
    const lastMarket = (world.marketReports || [])[0] || {};
    const cacheKey = [
      season, int(save.season, 1), int(save.seasonAppsTarget, 0),
      String(save.leagueCountry || ""), int(world.dbVersion, 0), Object.keys(world.clubs || {}).length,
      Object.keys(world.players || {}).length, (world.completedSeasons || []).length,
      Object.keys(matchesBySeason).length, Array.isArray(currentMatches) ? currentMatches.length : -1,
      hasStats ? statsSeason : 0, (statsBySeason[String(statsSeason)] || []).length,
      (world.transfers || []).length, int(world.transferSequence, 0), String(lastTransfer.id || ""),
      int(lastMarket.season, 0), int(lastMarket.moves, 0)
    ].join("|");
    const cached = dashboardCache.get(world);
    if (cached && cached.key === cacheKey) {
      // Progress belongs to the player's career, not the cached global-season projection.
      cached.value.progress = Math.round(currentProgress * 100);
      return cached.value;
    }

    // Dashboard refreshes happen after training, rest, navigation and match actions.
    // Never run every league's full fixture list synchronously from this hot path.
    // Before a global season is completed, show cheap deterministic projections;
    // afterwards, show the persisted full-season results.
    const fullTarget = Math.max(1, int(save.seasonAppsTarget, 34));
    const dashboardSave = Object.assign({}, save, {
      season: statsSeason || season,
      seasonApps: fullTarget,
      seasonAppsTarget: fullTarget
    });
    let output = base.dashboard(dashboardSave, db);
    output.season = season;
    output.progress = Math.round(currentProgress * 100);
    output.freeAgentCount = Object.values(world.players || {}).filter(player => player && player.freeAgent).length;
    output.matchesSimulated = Array.isArray(currentMatches) ? currentMatches.length : 0;
    output.competitionsSimulated = Array.isArray(currentCompetitions) ? currentCompetitions.length : 0;
    output.promotionHistory = world.promotionHistory || [];
    if (hasStats && statsSeason !== season) {
      output.note = String(output.note || "") + " الهدافون والجدول يعرضون آخر موسم عالمي مكتمل (" + statsSeason + ").";
    } else if (!hasStats) {
      output.note = String(output.note || "") + " الهدافون والجدول الحاليان توقعات محاكاة قابلة للتغيّر عند اعتماد نتائج الموسم.";
    }
    dashboardCache.set(world, { key: cacheKey, value: output });
    return output;
  }
  global.LWWorldAI = Object.freeze(Object.assign({}, base, {
    version: base.version,
    completeSeason, advanceToSeason, getLeagueTable, getDivisionTable, getSeasonLines, dashboard,
    seasonMatches: function (save, season, db) {
      const world = base.ensureState(save, db);
      simulateLeagueSeason(save, season, db);
      return expandWorldMatches(world, (world.matchesBySeason[String(Math.max(1, int(season, 1)))] || []).slice());
    },
    seasonCompetitions: function (save, season, db) {
      const world = base.ensureState(save, db);
      simulateLeagueSeason(save, season, db);
      return (world.competitionsBySeason[String(Math.max(1, int(season, 1)))] || []).slice();
    },
    freeAgents: function (save, db) {
      const world = base.ensureState(save, db);
      return Object.values(world.players).filter(player => player && !player.retired && player.freeAgent).map(player => ({
        id: player.id, name: player.name, position: player.position, ovr: player.ovr, age: player.age,
        potential: player.potential, contractSeasons: player.contractSeasons, formerClub: player.previousClubId
      })).sort((a,b)=>Number(b.ovr||50)-Number(a.ovr||50));
    }
  }));
})(window);
/* END LAST WHISTLE WORLD SIMULATION V2 */


/* LAST WHISTLE — age-aware club AI, scouting estimates and worker-backed world jobs. */
(function (global) {
  "use strict";
  const base = global.LWWorldAI;
  if (!base) return;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
  function archetypeForClub(club) {
    const power = clamp(club && club.power, 35, 97), prestige = clamp(club && club.prestige, 25, 100);
    if (power >= 82 && prestige >= 78) return { id: "title-chaser", label: "منافس على البطولات", strategy: "استقطاب الجاهز", coachStyle: "win-now" };
    if (power <= 65 && prestige <= 68) return { id: "youth-investor", label: "استثمار وتطوير شباب", strategy: "تطوير ثم بيع", coachStyle: "develop-youth" };
    if (power >= 70 && prestige >= 72) return { id: "academy-builder", label: "بناء فني منظم", strategy: "تطوير المواهب", coachStyle: "technical-discipline" };
    return { id: "balanced", label: "توازن بين الخبرة والشباب", strategy: "تعاقدات حسب الاحتياج", coachStyle: "balanced-rotation" };
  }
  function ensureProfiles(save, db) {
    const world = base.ensureState(save, db);
    Object.values(world.clubs || {}).forEach(club => {
      if (!club || typeof club !== "object") return;
      const profile = archetypeForClub(club);
      club.aiArchetype = profile.id;
      club.aiStrategy = profile.strategy;
      club.coachArchetype = profile.coachStyle;
    });
    world.aiMetadata = world.aiMetadata && typeof world.aiMetadata === "object" ? world.aiMetadata : {};
    world.aiMetadata.version = 2;
    world.aiMetadata.lastContextSeason = Math.max(1, int(save && save.season, int(world.currentSeason, 1)));
    return world;
  }
  function recruitmentNeeds(save, db) {
    const world = ensureProfiles(save, db);
    const clubs = Object.values(world.clubs || {});
    // Build one player-to-club index instead of scanning the complete world player
    // database separately for every club. This keeps recruitment analysis close to
    // O(players + clubs × squad size), which matters as world saves grow.
    const playersByClubId = new Map();
    Object.values(world.players || {}).forEach(player => {
      if (!player || player.clubId == null) return;
      let rows = playersByClubId.get(player.clubId);
      if (!rows) {
        rows = [];
        playersByClubId.set(player.clubId, rows);
      }
      rows.push(player);
    });
    return clubs.map(club => {
      const rows = playersByClubId.get(club.id) || [];
      const roleNeeds = [
        { id: "goalkeeper", target: 2, label: "حراسة المرمى" },
        { id: "defender", target: 5, label: "الدفاع" },
        { id: "midfielder", target: 5, label: "الوسط" },
        { id: "attacker", target: 4, label: "الهجوم" }
      ].map(role => {
        const players = rows.filter(player => (player.group || base.groupForPosition(player.position)) === role.id);
        const ages = players.map(player => int(player.age, 25));
        const averageOverall = players.length
          ? players.reduce((sum, row) => sum + int(row.ovr, 55), 0) / players.length : 0;
        const averagePotential = players.length
          ? players.reduce((sum, row) => sum + int(row.potential, int(row.ovr, 55)), 0) / players.length : 0;
        const averageAge = ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null;
        const archetype = String(club.aiArchetype || "balanced");
        // A thin position group is always urgent. Age pressure then adjusts the
        // priority to fit the club's strategy instead of treating every squad alike.
        const agePressure = averageAge == null ? 0 : archetype === "youth-investor"
          ? Math.max(0, averageAge - 23) * 0.8
          : archetype === "title-chaser"
            ? Math.max(0, averageAge - 31) * 0.55
            : Math.max(0, averageAge - 28) * 0.7;
        const qualityGap = Math.max(0, Number(club.power) - averageOverall) * 0.25;
        const potentialGap = archetype === "youth-investor"
          ? Math.max(0, 72 - averagePotential) * 0.18 : 0;
        const deficit = Math.max(0, role.target - players.length);
        const priorityScore = Number((deficit * 10 + qualityGap + agePressure + potentialGap).toFixed(2));
        return { group: role.id, label: role.label, count: players.length, target: role.target, deficit,
          averageOverall: Number(averageOverall.toFixed(1)),
          averagePotential: Number(averagePotential.toFixed(1)),
          averageAge: averageAge == null ? null : Number(averageAge.toFixed(1)),
          agePressure: Number(agePressure.toFixed(2)), priorityScore };
      }).sort((a, b) => b.priorityScore - a.priorityScore || b.deficit - a.deficit);
      return { clubId: club.id, club: club.name, country: club.country, power: club.power,
        archetype: club.aiArchetype, strategy: club.aiStrategy, coach: club.coachArchetype,
        rosterSize: rows.length, needs: roleNeeds, priority: roleNeeds[0] || null };
    });
  }
  function scoutingEstimate(player, coverage) {
    const actual = clamp(player && (player.ovr ?? player.overall), 35, 99);
    const potential = clamp(player && player.potential, actual, 99);
    const scouting = clamp(coverage, 0, 100);
    const confidence = Math.min(100, Math.round(25 + scouting * 0.75));
    const uncertainty = Math.max(0, Math.round((100 - scouting) * 0.09));
    return { min: Math.max(35, actual - uncertainty), max: Math.min(99, actual + uncertainty),
      confidence, fullyScouted: scouting >= 100,
      potentialMin: Math.max(actual, potential - Math.round((100 - scouting) * 0.08)),
      potentialMax: Math.min(99, potential + Math.round((100 - scouting) * 0.08)) };
  }
  function applySaveResult(target, source) {
    if (!target || !source || typeof target !== "object" || typeof source !== "object") return;
    Object.keys(target).forEach(key => { if (!Object.prototype.hasOwnProperty.call(source, key)) delete target[key]; });
    Object.keys(source).forEach(key => { target[key] = source[key]; });
  }
  // Keep one world worker alive for the lifetime of the page. Recreating it after
  // every dashboard/season request re-imports the multi-megabyte roster bundle and
  // makes repeated career actions needlessly expensive on mobile devices.
  let sharedWorldWorker = null;
  let worldWorkerQueue = [];
  let activeWorldWorkerRequest = null;
  let worldWorkerSequence = 0;

  function failWorldWorker(worker, error) {
    if (sharedWorldWorker !== worker) return;
    sharedWorldWorker = null;
    try { worker.terminate(); } catch (_) {}
    const failed = [];
    if (activeWorldWorkerRequest) {
      failed.push(activeWorldWorkerRequest);
      activeWorldWorkerRequest = null;
    }
    if (worldWorkerQueue.length) failed.push.apply(failed, worldWorkerQueue);
    worldWorkerQueue = [];
    failed.forEach(request => request.reject(error));
  }

  function getWorldWorker() {
    if (sharedWorldWorker) return sharedWorldWorker;
    const worker = new global.Worker("./football-world-worker.js?v=18");
    sharedWorldWorker = worker;
    worker.onmessage = event => {
      if (sharedWorldWorker !== worker) return;
      const msg = event && event.data || {};
      const request = activeWorldWorkerRequest;
      if (!request) return;
      if (msg.id !== request.id) {
        failWorldWorker(worker, new Error("World worker response ID mismatch"));
        return;
      }
      activeWorldWorkerRequest = null;
      try {
        if (!msg.ok) {
          request.reject(new Error(msg.error || "World worker failed"));
        } else {
          applySaveResult(request.save, msg.save);
          if (global.LWStateStore && typeof global.LWStateStore.publish === "function")
            global.LWStateStore.publish(request.save, { source: "world-worker", command: request.command });
          request.resolve(msg.result);
        }
      } catch (error) {
        request.reject(error);
      }
      pumpWorldWorkerQueue();
    };
    const onWorkerError = event => {
      failWorldWorker(worker, new Error(event && event.message || "World worker crashed"));
    };
    worker.onerror = onWorkerError;
    worker.onmessageerror = () => onWorkerError({ message: "World worker returned an unreadable message" });
    return worker;
  }

  function pumpWorldWorkerQueue() {
    if (activeWorldWorkerRequest || !worldWorkerQueue.length) return;
    let worker;
    try {
      worker = getWorldWorker();
    } catch (error) {
      const failed = worldWorkerQueue;
      worldWorkerQueue = [];
      failed.forEach(request => request.reject(error));
      return;
    }
    const request = worldWorkerQueue.shift();
    request.id = "lw-world-" + Date.now() + "-" + (++worldWorkerSequence);
    activeWorldWorkerRequest = request;
    try {
      // Queueing also prevents simultaneous requests from sending stale copies of
      // the same career save before the previous worker result has been applied.
      worker.postMessage(Object.assign({
        id: request.id, command: request.command, save: request.save
      }, request.data || {}));
    } catch (error) {
      activeWorldWorkerRequest = null;
      request.reject(error);
      pumpWorldWorkerQueue();
    }
  }

  function workerRequest(command, save, data) {
    if (typeof global.Worker !== "function") return Promise.reject(new Error("Web Worker is not supported"));
    return new Promise((resolve, reject) => {
      worldWorkerQueue.push({ command, save, data: data || {}, resolve, reject });
      pumpWorldWorkerQueue();
    });
  }
  function asyncFallback(command, save, data, db) {
    return Promise.resolve().then(() => {
      if (command === "completeSeason") return base.completeSeason(save, data.season, db);
      if (command === "advanceToSeason") return base.advanceToSeason(save, data.season, db);
      return base.dashboard(save, db);
    });
  }
  function worldJob(command, save, data, db) {
    return workerRequest(command, save, data || {}).catch(() => asyncFallback(command, save, data || {}, db));
  }
  global.LWWorldAI = Object.freeze(Object.assign({}, base, {
    version: base.version,
    archetypeForClub,
    ensureState: ensureProfiles,
    recruitmentNeeds,
    scoutingEstimate,
    completeSeasonAsync: (save, season, db) => worldJob("completeSeason", save, { season }, db),
    advanceToSeasonAsync: (save, season, db) => worldJob("advanceToSeason", save, { season }, db),
    dashboardAsync: (save, db) => worldJob("dashboard", save, {}, db)
  }));
})(window);
/* END LAST WHISTLE CONTEXT AI LAYER */
