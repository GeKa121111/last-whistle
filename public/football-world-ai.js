/* Living football-world simulation for LAST WHISTLE.
 * Club recruitment, player progression, standings and statistics are deterministic and persisted in the career save.
 * All ratings and future statistics are simulation estimates, not official live football data.
 */
(function (global) {
  "use strict";
  const VERSION = 1;
  const ROSTER_MEMBERSHIP_SCHEMA_VERSION = 5;
  const TARGETS = Object.freeze({ goalkeeper: 2, defender: 5, midfielder: 5, attacker: 4 });
  // The full roster catalogue is available in the database/UI. The career save simulates a
  // compact 16-player matchday pool per club so long saves remain within browser storage limits.
  const SIMULATED_SQUAD_LIMIT = 16;
  const MAX_WORLD_SEASON_APPEARANCES = 1000;
  const MAX_WORLD_SEASON_STAT = 1000000;
  const seasonProjectionCache = new WeakMap();
  const POSITIONS = Object.freeze({
    goalkeeper: ["حارس مرمى"],
    defender: ["قلب دفاع", "ظهير"],
    midfielder: ["وسط دفاعي", "وسط مهاجم", "وسط"],
    attacker: ["جناح", "مهاجم", "رأس حربة"]
  });
  function safeNumber(value, fallback = 0) {
    if (typeof value !== "number" && typeof value !== "string") return fallback;
    if (typeof value === "string" && value.trim() === "") return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  const clamp = (value, min, max) => Math.max(min, Math.min(max, safeNumber(value, 0)));
  const int = (value, fallback = 0) => Math.round(
    value === null || (typeof value === "string" && value.trim() === "") ? 0 : safeNumber(value, fallback)
  );
  const divisionForClub = club => Math.max(1, int(club && club.division, 1));
  function isTrueFlag(value) {
    if (value === true || value === 1) return true;
    if (typeof value !== "string") return false;
    return /^(?:true|1|yes|on)$/i.test(value.trim());
  }
  function normalize(value) {
    return String(value == null ? "" : value).normalize("NFKC").toLocaleLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
      .replace(/[^a-z0-9\u0600-\u06FF]/g, "");
  }
  function normalizePosition(value) {
    const store = global.LWStateStore;
    const canonical = store && typeof store.normalizePosition === "function"
      ? store.normalizePosition(value) : value;
    return normalize(canonical);
  }
  function hash(value) {
    let h = 2166136261;
    for (const char of String(value)) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  function random(seed) {
    let value = (safeNumber(seed, 0) >>> 0) || 0x9e3779b9;
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
    const p = normalizePosition(position);
    if (p.includes("حارس") || ["gk", "goalkeeper", "goalie", "keeper"].includes(p) || p.includes("goalkeeper")) return "goalkeeper";
    // Classify the tactical line before role wording so defensive midfielders stay in midfield.
    if (p.includes("وسط") || p.includes("ارتكاز") || p.includes("صانع")
      || ["dm", "cdm", "cm", "rcm", "lcm", "am", "cam", "lam", "ram", "lm", "rm", "mf"].includes(p)
      || p.includes("midfielder") || p.includes("midfield")) return "midfielder";
    if (p.includes("دفاع") || p.includes("ظهير") || p.includes("مدافع")
      || ["cb", "rcb", "lcb", "lb", "rb", "rwb", "lwb", "wb", "sw", "df"].includes(p)
      || p.includes("defender") || p.includes("centreback") || p.includes("centerback")
      || p.includes("fullback") || p.includes("wingback")) return "defender";
    if (p.includes("مهاجم") || p.includes("جناح") || p.includes("رأسحربة") || p.includes("راسحربة") || p.includes("راسحربه")
      || ["st", "f", "striker", "cf", "ss", "fw", "lw", "rw", "lwf", "rwf", "wf"].includes(p)
      || p.includes("forward") || p.includes("winger") || p.includes("wing")) return "attacker";
    return "midfielder";
  }
  function positionProductionProfile(position) {
    const p = normalizePosition(position);
    // Centre strikers should finish moves more often; mobile forwards and wingers
    // should contribute more assists rather than sharing one generic attacker rate.
    if (p === "st" || p === "f" || p === "striker"
      || p.includes("راسحربة") || p.includes("راسحربه")
      || p.includes("centreforward") || p.includes("centerforward")) {
      return { role: "centre-striker", goalWeight: 3.25, assistWeight: 0.72, attackRate: 0.44, assistRate: 0.14 };
    }
    if (p.includes("جناح") || ["lw", "rw", "lwf", "rwf", "wf"].includes(p)
      || p.includes("winger") || p.includes("wing")) {
      return { role: "winger", goalWeight: 2.05, assistWeight: 1.8, attackRate: 0.27, assistRate: 0.31 };
    }
    if (p.includes("مهاجم") || p === "cf" || p === "ss" || p === "fw"
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
  function findClubByIdentity(world, name, country) {
    const normalizedName = normalize(name);
    if (!normalizedName || !world || !world.clubs || typeof world.clubs !== "object") return null;
    const normalizedCountry = normalize(country);
    const keyed = world.clubs[clubKey(name, country)];
    if (normalizedCountry && keyed && normalize(keyed.name) === normalizedName
      && normalize(keyed.country) === normalizedCountry) return keyed;
    const matches = Object.values(world.clubs).filter(club => club
      && normalize(club.name) === normalizedName
      && (!normalizedCountry || normalize(club.country) === normalizedCountry));
    // Legacy callers may omit country only when the club name is globally unique.
    // Never let a same-name club in another country supply the wrong match profile.
    return matches.length === 1 ? matches[0] : null;
  }
  function syncClubDivisionMetadata(world, club, division, db, sourceRow) {
    if (!club) return null;
    const tier = Math.max(1, int(division, int(club.division, 1)));
    club.division = tier;
    const profile = db && typeof db.leagueFor === "function"
      ? db.leagueFor(club.country, tier) || {}
      : db && typeof db.leagueById === "function" ? db.leagueById(club.leagueId) || {} : {};
    const profileName = profile.name || (tier >= 2 ? profile.tier2 : profile.league);
    const profileEnglish = profile.englishName || (tier >= 2 ? profile.tier2English : profile.english);
    const sourceTier = Math.max(1, int(sourceRow && sourceRow.division, 1));
    if (profileName) club.leagueName = String(profileName);
    else if (sourceTier === tier && sourceRow && sourceRow.leagueName) club.leagueName = String(sourceRow.leagueName);
    if (profileEnglish) club.leagueEnglish = String(profileEnglish);
    else if (sourceTier === tier && sourceRow && sourceRow.leagueEnglish) club.leagueEnglish = String(sourceRow.leagueEnglish);
    const profileMatches = profile.matchesPerSeason || (tier >= 2 ? profile.tier2MatchesPerSeason : profile.matches);
    const sourceMatches = sourceTier === tier && sourceRow ? sourceRow.matchesPerSeason : 0;
    const matches = Number(profileMatches || sourceMatches);
    if (Number.isFinite(matches) && matches > 0) club.matchesPerSeason = Math.max(20, Math.round(matches));
    const clubId = String(club.id || "");
    if (clubId) {
      Object.values(world && world.players || {}).forEach(player => {
        if (player && String(player.clubId || "") === clubId) player.division = tier;
      });
    }
    return profile;
  }
  function sourcePlayerIdentityKey(player) {
    const name = normalize(player && player.name);
    if (!name) return "";
    return [name, normalizePosition(player && player.position), int(player && player.age, 0)].join("|");
  }
  function rosterIdentityKey(player) {
    const name = normalize(player && player.name);
    return name ? name + "|" + normalizePosition(player && player.position) : "";
  }
  function marketPlayerRating(player, fallback = 50) {
    const rating = safeNumber(player && player.ovr, fallback);
    return rating > 0 ? clamp(rating, 1, 99) : fallback;
  }
  function marketPlayerPotential(player, fallback) {
    const value = safeNumber(player && player.potential, fallback);
    return value > 0 ? clamp(value, 1, 99) : fallback;
  }
  function marketPlayerAge(player, fallback = 26) {
    const age = safeNumber(player && player.age, fallback);
    return age > 0 ? clamp(age, 15, 45) : fallback;
  }
  function marketContractSeasons(player) {
    return Math.max(0, Math.min(10, int(player && player.contractSeasons, 0)));
  }
  function marketClubPower(club, fallback = 55) {
    const power = safeNumber(club && club.power, safeNumber(club && club.basePower, fallback));
    return power > 0 ? clamp(power, 25, 100) : fallback;
  }
  function marketClubPrestige(club, fallback = 50) {
    const prestige = safeNumber(club && club.prestige, fallback);
    return prestige > 0 ? clamp(prestige, 0, 100) : fallback;
  }
  function marketValue(player, seller) {
    const ovr = clamp(safeNumber(player && player.ovr, 0), 35, 99);
    const potential = clamp(safeNumber(player && player.potential, ovr), ovr, 99);
    const prestige = marketClubPrestige(seller);
    const rawValue = Math.pow(Math.max(1, ovr - 35), 2) * 0.18
      + potential * 1.12 + Math.max(0, prestige) * 0.28;
    const term = marketContractSeasons(player);
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
  function archiveGeneratedPlayerBeforeRosterReplacement(world, player) {
    const playerId = String(player && player.id || "");
    if (!world || !playerId) return;
    const archive = ensureArchive(world);
    archive.players[playerId] = player;
    if (world.playerHistory && Object.prototype.hasOwnProperty.call(world.playerHistory, playerId)) {
      archive.playerHistory[playerId] = world.playerHistory[playerId];
      delete world.playerHistory[playerId];
    }
    Object.keys(world.seasonStats || {}).forEach(season => {
      const rows = Array.isArray(world.seasonStats[season]) ? world.seasonStats[season] : [];
      const archivedRows = rows.filter(row => row
        && String(row.id || row.playerId || "") === playerId);
      if (!archivedRows.length) return;
      archive.seasonStats[season] = (Array.isArray(archive.seasonStats[season])
        ? archive.seasonStats[season] : []).concat(archivedRows);
      world.seasonStats[season] = rows.filter(row => !archivedRows.includes(row));
    });
  }
  function emptyWorld() {
    return {
      schemaVersion: VERSION, dbVersion: 0, currentSeason: 1, lastCompletedSeason: 0,
      lastAdvancedTo: 0, lastDevelopedSeason: 0, lastFreeAgentMarketSeason: 0,
      clubs: {}, players: {}, playerHistory: {}, transferClubHistoryByPlayer: {},
      transferClubHistorySchemaVersion: 1, seasonStats: {},
      leagueTables: {}, completedSeasons: [], transfers: [], marketReports: [],
      nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 0, notes: [], archive: emptyArchive(),
      rosterMembershipSchemaVersion: ROSTER_MEMBERSHIP_SCHEMA_VERSION
    };
  }
  // Keep compact per-player club endpoints independently of the rolling 300-row transfer feed.
  // This preserves long-career former-club identity without retaining every full transfer record.
  function addTransferClubHistoryEndpoint(world, playerId, clubId, name, country) {
    const key = String(playerId || "").trim();
    if (!world || !key) return;
    const endpointId = String(clubId || "").trim();
    const clubName = String(name || "").trim();
    const countryName = String(country || "").trim();
    if (!endpointId && !clubName) return;
    const history = world.transferClubHistoryByPlayer && typeof world.transferClubHistoryByPlayer === "object"
      && !Array.isArray(world.transferClubHistoryByPlayer)
      ? world.transferClubHistoryByPlayer : (world.transferClubHistoryByPlayer = {});
    const rows = Array.isArray(history[key]) ? history[key] : (history[key] = []);
    const duplicate = rows.find(row => {
      if (!row) return false;
      const existingId = String(row.clubId || "").trim();
      if (endpointId && existingId) return existingId === endpointId;
      return clubName && normalize(row.name) === normalize(clubName)
        && normalize(row.country) === normalize(countryName);
    });
    if (duplicate) {
      if (endpointId && !String(duplicate.clubId || "").trim()) duplicate.clubId = endpointId;
      if (clubName && !String(duplicate.name || "").trim()) duplicate.name = clubName;
      if (countryName && !String(duplicate.country || "").trim()) duplicate.country = countryName;
      return;
    }
    rows.push({ clubId: endpointId, name: clubName, country: countryName });
  }
  function ensureTransferClubHistory(world) {
    if (!world || typeof world !== "object") return {};
    const hasHistory = world.transferClubHistoryByPlayer
      && typeof world.transferClubHistoryByPlayer === "object"
      && !Array.isArray(world.transferClubHistoryByPlayer);
    const history = hasHistory ? world.transferClubHistoryByPlayer : {};
    world.transferClubHistoryByPlayer = history;
    if (hasHistory && Number(world.transferClubHistorySchemaVersion) >= 1) return history;

    const importTransfer = transfer => {
      if (!transfer) return;
      const playerId = String(transfer.playerId || "").trim();
      if (!playerId) return;
      addTransferClubHistoryEndpoint(world, playerId, transfer.fromClubId, transfer.from, transfer.fromCountry);
      addTransferClubHistoryEndpoint(world, playerId, transfer.toClubId, transfer.to, transfer.toCountry);
    };
    (Array.isArray(world.transfers) ? world.transfers : []).forEach(importTransfer);
    const importPlayerHistory = playerHistory => {
      Object.entries(playerHistory && typeof playerHistory === "object" ? playerHistory : {}).forEach(([playerId, entries]) => {
        (Array.isArray(entries) ? entries : []).forEach(entry => {
          if (!entry) return;
          addTransferClubHistoryEndpoint(world, playerId, entry.fromClubId, entry.from, entry.fromCountry);
          addTransferClubHistoryEndpoint(world, playerId, entry.clubId, entry.club, entry.country);
        });
      });
    };
    importPlayerHistory(world.playerHistory);
    importPlayerHistory(world.archive && world.archive.playerHistory);
    world.transferClubHistorySchemaVersion = 1;
    return history;
  }
  function rememberTransferClubEndpoints(world, transfer) {
    if (!world || !transfer) return;
    ensureTransferClubHistory(world);
    const playerId = String(transfer.playerId || "").trim();
    if (!playerId) return;
    addTransferClubHistoryEndpoint(world, playerId, transfer.fromClubId, transfer.from, transfer.fromCountry);
    addTransferClubHistoryEndpoint(world, playerId, transfer.toClubId, transfer.to, transfer.toCountry);
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
    if (!position || normalizePosition(position).includes("غيرمحدد")) position = pickPosition(forcedGroup || "midfielder", rng);
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
  function activeRosterIds(world, club) {
    const seen = new Set();
    return (Array.isArray(club && club.roster) ? club.roster : []).filter(id => {
      const key = String(id || "");
      const player = world && world.players && world.players[key];
      if (!key || seen.has(key) || !player || isTrueFlag(player.retired) || isTrueFlag(player.freeAgent)) return false;
      const ownerClubId = String(player.clubId || "").trim();
      if (ownerClubId && ownerClubId !== String(club.id)) return false;
      seen.add(key);
      return true;
    });
  }
  function syncPlayerClubMetadata(player, club) {
    if (!player || !club) return;
    const country = String(club.country || "").trim();
    const leagueId = String(club.leagueId || "").trim();
    if (country) player.country = country;
    if (leagueId) player.leagueId = leagueId;
    player.division = divisionForClub(club);
  }
  function normalizeRosterMembership(world) {
    if (!world || !world.clubs || !world.players) return world;
    const memberships = new Map();
    Object.values(world.clubs).forEach(club => {
      if (!club) return;
      const localSeen = new Set();
      (Array.isArray(club.roster) ? club.roster : []).forEach(id => {
        const key = String(id || "");
        if (!key || localSeen.has(key)) return;
        localSeen.add(key);
        if (!memberships.has(key)) memberships.set(key, []);
        memberships.get(key).push(String(club.id || ""));
      });
    });
    const ambiguous = new Set();
    Object.entries(world.players).forEach(([id, player]) => {
      if (!player) return;
      // Legacy saves may encode boolean flags as strings; normalize before interpreting roster ownership.
      player.retired = isTrueFlag(player.retired);
      player.freeAgent = player.retired ? false : isTrueFlag(player.freeAgent);
      const ownerClubId = String(player.clubId || "").trim();
      const candidates = Array.from(new Set(memberships.get(String(id)) || [])).filter(Boolean);

      // Retirement/free agency is authoritative. Old roster references must never
      // resurrect an unattached player or turn a former club into their current club.
      if (isTrueFlag(player.retired) || isTrueFlag(player.freeAgent)) {
        const formerClubId = ownerClubId && world.clubs[ownerClubId]
          ? ownerClubId : candidates.length === 1 ? candidates[0] : "";
        if (formerClubId && !String(player.previousClubId || "").trim()) {
          player.previousClubId = formerClubId;
        }
        player.clubId = "";
        player.leagueId = "";
        player.division = 0;
        player.contractSeasons = 0;
        player.transferListed = false;
        if (isTrueFlag(player.retired)) player.freeAgent = false;
        return;
      }

      if (ownerClubId && world.clubs[ownerClubId]) {
        // The canonical owner is authoritative even when an interrupted save lost
        // the roster reference. Restore membership before any squad refill runs.
        const owner = world.clubs[ownerClubId];
        if (!Array.isArray(owner.roster)) owner.roster = [];
        if (!owner.roster.some(rosterId => String(rosterId) === String(id))) {
          owner.roster.push(String(id));
        }
        syncPlayerClubMetadata(player, owner);
        return;
      }
      if (candidates.length === 1) {
        const clubId = candidates[0], club = world.clubs[clubId];
        player.clubId = clubId;
        syncPlayerClubMetadata(player, club);
      } else if (candidates.length > 1) {
        // Keep the player record, but do not assign an ambiguous legacy player to two clubs.
        ambiguous.add(String(id));
      }
    });
    Object.values(world.clubs).forEach(club => {
      if (!club) return;
      club.roster = activeRosterIds(world, club).filter(id => !ambiguous.has(String(id)));
    });
    return world;
  }
  function fillRoster(world, club) {
    club.roster = activeRosterIds(world, club);
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
    world.rosterMembershipSchemaVersion = ROSTER_MEMBERSHIP_SCHEMA_VERSION;
    return world;
  }
  function invalidateUnfinishedSeasonProjection(world) {
    if (!world || typeof world !== "object") return false;
    const season = Math.max(1, int(world.currentSeason, int(world.lastAdvancedTo, 1)),
      int(world.lastAdvancedTo, 0));
    const completedSeasons = Array.isArray(world.completedSeasons) ? world.completedSeasons : [];
    if (completedSeasons.some(value => Number(value) === season)
      || Math.max(0, int(world.lastCompletedSeason, 0)) >= season) return false;
    const key = String(season);
    let invalidated = false;
    ["matchesBySeason", "seasonStats", "leagueTables", "competitionsBySeason"].forEach(field => {
      const collection = world[field];
      if (!collection || typeof collection !== "object" || Array.isArray(collection)) return;
      if (Object.prototype.hasOwnProperty.call(collection, key)) {
        delete collection[key];
        invalidated = true;
      }
    });
    return invalidated;
  }
  function reconcileDatabase(world, db) {
    if (!world || !world.clubs) return seedWorld(db);
    world.players = world.players && typeof world.players === "object" ? world.players : {};
    world.playerHistory = world.playerHistory && typeof world.playerHistory === "object" ? world.playerHistory : {};
    const archive = ensureArchive(world);
    const transferClubHistoryByPlayer = ensureTransferClubHistory(world);
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
    // Restore authoritative player-to-club links before database reconciliation can
    // refill a missing squad slot with a generated placeholder.
    normalizeRosterMembership(world);
    const rows = db && typeof db.clubs === "function" ? db.clubs() : [];
    const unavailableIdentitiesByClub = new Map();
    const allClubs = Object.values(world.clubs || {});
    for (const player of Object.values(world.players || {})) {
      if (!player) continue;
      const isDetachedPlayer = isTrueFlag(player.retired) || isTrueFlag(player.freeAgent);
      const currentClubId = String(player.clubId || "").trim();
      const history = world.playerHistory && Array.isArray(world.playerHistory[player.id])
        ? world.playerHistory[player.id] : [];
      const transferClubRows = Array.isArray(transferClubHistoryByPlayer[String(player.id || "")])
        ? transferClubHistoryByPlayer[String(player.id || "")] : [];
      const hasFormerClubTrail = isDetachedPlayer
        || !!String(player.previousClubId || "").trim()
        || !!String(player.retiredFromClubId || "").trim()
        || history.some(entry => !!String(entry && (entry.fromClubId || entry.from) || "").trim())
        || transferClubRows.length > 0;
      if (!hasFormerClubTrail) continue;
      const identityKey = rosterIdentityKey(player);
      if (!identityKey) continue;
      const clubIds = new Set();
      const addFormerClubId = value => {
        const id = String(value || "").trim();
        if (id && id !== currentClubId) clubIds.add(id);
      };
      addFormerClubId(player.previousClubId);
      addFormerClubId(player.retiredFromClubId);
      for (const entry of history) {
        if (!entry) continue;
        // Normal transfers retain both endpoints in player history. Protect only
        // the former club; never hide the player from the club they currently join.
        addFormerClubId(entry.fromClubId);
        const historyClubId = String(entry.clubId || "").trim();
        addFormerClubId(historyClubId);
        const clubName = String(entry.club || "").trim();
        if (clubName && (isDetachedPlayer || (historyClubId && historyClubId !== currentClubId))) {
          const country = String(entry.country || "").trim();
          const matches = allClubs.filter(club =>
            normalize(club.name) === normalize(clubName)
            && (!country || normalize(club.country) === normalize(country)));
          if (matches.length) matches.forEach(club => addFormerClubId(club.id));
          else if (country) addFormerClubId(clubKey(clubName, country));
        }
        // Older history rows may have a textual origin but no fromClubId. Resolve
        // it only when the country/name combination identifies a former club.
        const fromName = String(entry.from || "").trim();
        const fromCountry = String(entry.fromCountry || "").trim();
        if (fromName && !String(entry.fromClubId || "").trim()) {
          const matches = allClubs.filter(club =>
            normalize(club.name) === normalize(fromName)
            && (!fromCountry || normalize(club.country) === normalize(fromCountry)));
          // Do not block every club with the same name when a legacy row lacks country data.
          if (matches.length === 1) addFormerClubId(matches[0].id);
          else if (matches.length === 0 && fromCountry) addFormerClubId(clubKey(fromName, fromCountry));
        }
      }
      for (const endpoint of transferClubRows) {
        if (!endpoint) continue;
        const endpointId = String(endpoint.clubId || "").trim();
        if (endpointId) addFormerClubId(endpointId);
        const clubName = String(endpoint.name || "").trim();
        if (!clubName || (endpointId && allClubs.some(club => String(club.id || "") === endpointId))) continue;
        const countryName = String(endpoint.country || "").trim();
        const matches = allClubs.filter(club =>
          normalize(club.name) === normalize(clubName)
          && (!countryName || normalize(club.country) === normalize(countryName)));
        if (matches.length === 1) addFormerClubId(matches[0].id);
        else if (matches.length === 0 && countryName) addFormerClubId(clubKey(clubName, countryName));
      }
      for (const clubId of clubIds) {
        if (!unavailableIdentitiesByClub.has(clubId)) unavailableIdentitiesByClub.set(clubId, new Set());
        unavailableIdentitiesByClub.get(clubId).add(identityKey);
      }
    }
    const knownPlayersByClub = new Map();
    for (const player of Object.values(world.players || {})) {
      if (!player || isTrueFlag(player.retired)) continue;
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
        const unavailableForClub = unavailableIdentitiesByClub.get(id) || new Set();
        let index = 0;
        records.forEach(player => {
          const identityKey = rosterIdentityKey(player);
          if (!identityKey || knownForClub.has(identityKey) || unavailableForClub.has(identityKey)) return;
          makePlayer(world, player, club, index++, false);
          knownForClub.add(identityKey);
        });
        knownPlayersByClub.set(id, knownForClub);
        fillRoster(world, club);
      } else {
        const club = world.clubs[id];
        const sourceDivision = Math.max(1, int(row.division, 1));
        const savedDivision = Number(club.division);
        // A saved in-game tier is authoritative after promotion/relegation. Resolve all
        // division-dependent metadata from that tier, not from the source roster's seed tier.
        const activeDivision = Number.isFinite(savedDivision) && savedDivision >= 1
          ? Math.max(1, int(savedDivision, sourceDivision)) : sourceDivision;
        syncClubDivisionMetadata(world, club, activeDivision, db, row);
        // Migrate saves created before complete squads were stored. Replace only generated
        // placeholders; existing real players and their career history are preserved.
        const knownForClub = knownPlayersByClub.get(id) || new Set();
        const unavailableForClub = unavailableIdentitiesByClub.get(id) || new Set();
        let index = 0;
        for (const playerRow of records) {
          const identityKey = rosterIdentityKey(playerRow);
          if (!identityKey || knownForClub.has(identityKey) || unavailableForClub.has(identityKey)) continue;
          while ((club.roster || []).length >= SIMULATED_SQUAD_LIMIT) {
            const generated = (club.roster || []).map(playerId => world.players[playerId]).filter(player => player && player.isGenerated)
              .sort((a, b) => Number(a.ovr || 0) - Number(b.ovr || 0));
            if (!generated.length) break;
            const replace = generated[0];
            club.roster = club.roster.filter(playerId => playerId !== replace.id);
            archiveGeneratedPlayerBeforeRosterReplacement(world, replace);
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
    normalizeRosterMembership(world);
    Object.values(world.clubs).forEach(club => fillRoster(world, club));
    world.rosterSchemaVersion = 3;
    world.rosterMembershipSchemaVersion = ROSTER_MEMBERSHIP_SCHEMA_VERSION;
    world.projectionRevision = Math.max(0, int(world.projectionRevision, 0)) + 1;
    invalidateUnfinishedSeasonProjection(world);
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
    ensureTransferClubHistory(world);
    world.notes = Array.isArray(world.notes) ? world.notes : [];
    world.nextGeneratedPlayer = Math.max(1, int(world.nextGeneratedPlayer, 1));
    world.transferSequence = Math.max(0, int(world.transferSequence, 0));
    world.lastAdvancedTo = Math.max(0, int(world.lastAdvancedTo, 0));
    if (!Object.prototype.hasOwnProperty.call(world, "lastDevelopedSeason")) {
      world.lastDevelopedSeason = Math.max(0, world.lastAdvancedTo - 1);
    } else {
      world.lastDevelopedSeason = Math.max(0, int(world.lastDevelopedSeason, 0));
    }
    if (!Object.prototype.hasOwnProperty.call(world, "lastFreeAgentMarketSeason")) {
      world.lastFreeAgentMarketSeason = world.lastAdvancedTo;
    } else {
      world.lastFreeAgentMarketSeason = Math.max(0, int(world.lastFreeAgentMarketSeason, 0));
    }
    world.projectionRevision = Math.max(0, int(world.projectionRevision, 0));
    // Resolve the active world season before any roster migration invalidates cached projections.
    // Legacy saves can have a newer career season while the world-season marker still lags.
    if (Number(world.lastAdvancedTo) > 0) {
      world.currentSeason = Math.max(world.currentSeason, int(world.lastAdvancedTo, world.currentSeason));
    } else {
      world.currentSeason = Math.max(world.currentSeason, Math.max(1, int(save.season, 1)));
    }
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
    if (Number(world.rosterMembershipSchemaVersion) !== ROSTER_MEMBERSHIP_SCHEMA_VERSION) {
      normalizeRosterMembership(world);
      world.rosterMembershipSchemaVersion = ROSTER_MEMBERSHIP_SCHEMA_VERSION;
      world.projectionRevision = Math.max(0, int(world.projectionRevision, 0)) + 1;
      invalidateUnfinishedSeasonProjection(world);
    }
    return world;
  }
  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 55;
  }
  function rosterPlayers(world, club) {
    return activeRosterIds(world, club).map(id => world.players[id]);
  }
  function roleStats(world, club) {
    const output = {};
    for (const group of Object.keys(TARGETS)) {
      const rows = rosterPlayers(world, club).filter(player => player.group === group);
      const ratings = rows.map(player => marketPlayerRating(player));
      output[group] = { count: rows.length, average: average(ratings),
        best: ratings.length ? Math.max(...ratings) : 0 };
    }
    return output;
  }
  function buildLeagueMatchCountLookup(world, db) {
    const groups = new Map();
    Object.values(world.clubs || {}).forEach(club => {
      if (!club || !club.leagueId) return;
      const division = divisionForClub(club);
      const key = String(club.leagueId) + "|" + division;
      if (!groups.has(key)) groups.set(key, { division, clubs: [] });
      groups.get(key).clubs.push(club);
    });
    const matchesByClub = new Map();
    groups.forEach(group => {
      const clubs = group.clubs;
      const clubCount = clubs.length;
      const clubMatchValues = clubs.map(club => Math.max(0, int(club.matchesPerSeason, 34)));
      const fallbackMatches = clubCount > 1
        ? Math.max(0, Math.min(60, Math.round(average(clubMatchValues)))) : 0;
      let profile = {};
      try {
        profile = db && typeof db.leagueFor === "function"
          ? db.leagueFor(clubs[0] && clubs[0].country, group.division) || {} : {};
      } catch (_) {}
      const expectedTeamCount = Math.max(0, int(profile.teamCount, 0));
      let matchesPerClub = fallbackMatches;
      if (expectedTeamCount > 1) {
        if (clubCount === expectedTeamCount) {
          const officialMatches = Number(profile.matchesPerSeason);
          if (Number.isFinite(officialMatches) && officialMatches > 0) matchesPerClub = Math.round(officialMatches);
        } else {
          // An incomplete catalogue must not simulate a full season against only a handful of known clubs.
          matchesPerClub = 2 * Math.max(0, clubCount - 1);
        }
      }
      matchesPerClub = Math.max(0, Math.min(60, matchesPerClub));
      if (clubCount % 2 === 1 && matchesPerClub % 2 === 1) matchesPerClub = Math.max(0, matchesPerClub - 1);
      clubs.forEach(club => matchesByClub.set(String(club.id), matchesPerClub));
    });
    return matchesByClub;
  }
  function normalizedClubPower(club) {
    const power = safeNumber(club && club.power, 55);
    return power > 0 ? clamp(power, 25, 100) : 55;
  }
  function generatePlayerSeason(world, player, season, progress = 1, strengthByLeague, matchesByClub) {
    const club = world.clubs[player.clubId];
    const rng = random(hash(player.id + "|" + season + "|season-stat-v" + VERSION));
    const power = club ? normalizedClubPower(club) : 55;
    const matches = club
      ? Math.max(0, Math.min(60, int(matchesByClub && matchesByClub.get(String(club.id)), Math.max(0, int(club.matchesPerSeason, 34)))))
      : 34;
    const ovr = clamp(safeNumber(player.ovr, 55) || 55, 35, 99);
    const group = player.group || groupForPosition(player.position);
    const peers = club ? rosterPlayers(world, club).filter(row => row.group === group) : [player];
    const roleStrength = peers.length ? (peers.slice().sort((a, b) => b.ovr - a.ovr).findIndex(row => row.id === player.id)) : 0;
    const expectedApps = matches > 0
      ? clamp(Math.round(matches * (0.63 + ovr * 0.0032 + rng() * 0.12 - roleStrength * 0.075)), Math.min(4, matches), matches)
      : 0;
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
      division: Math.max(1, int(player.division, 1)), position: player.position, group,
      age: clamp(safeNumber(player.age, 18) || 18, 14, 60), ovr,
      potential: clamp(safeNumber(player.potential, ovr) || ovr, 1, 99), appearances: expectedApps, goals: fullGoals, assists: fullAssists,
      averageRating: Number(fullRating.toFixed(2)), leagueStrength: leaguePower,
      prestige: clamp(safeNumber(club ? club.prestige : player.prestige, 0), 0, 100), confederation: club ? club.confederation : "",
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
      const division = divisionForClub(club);
      const key = String(club.leagueId) + "|" + division;
      const row = totals.get(key) || { total: 0, count: 0 };
      row.total += normalizedClubPower(club);
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
      && divisionForClub(club) === tier);
    if (clubs.length) return Math.round(average(clubs.map(normalizedClubPower)));
    if (tier !== 1 && strengthByLeague && strengthByLeague.has(String(leagueId || "") + "|1")) {
      return strengthByLeague.get(String(leagueId || "") + "|1");
    }
    return Math.round(average(Object.values(world.clubs || {}).filter(club =>
      String(club.leagueId || "") === String(leagueId || "") && divisionForClub(club) === 1)
      .map(normalizedClubPower)));
  }
  function getProjectedSeasonRows(world, targetSeason, db) {
    const signature = [
      int(world.projectionRevision, 0), int(world.dbVersion, 0), int(world.rosterSchemaVersion, 0),
      int(world.currentSeason, 1), int(world.lastAdvancedTo, 0), int(world.lastCompletedSeason, 0),
      int(world.transferSequence, 0), Object.keys(world.players || {}).length, Object.keys(world.clubs || {}).length
    ].join("|");
    let cached = seasonProjectionCache.get(world);
    if (!cached || cached.signature !== signature) {
      cached = { signature, rows: new Map() };
      seasonProjectionCache.set(world, cached);
    }
    if (!cached.rows.has(targetSeason)) {
      const strengthByLeague = buildLeagueStrengthLookup(world);
      const matchesByClub = buildLeagueMatchCountLookup(world, db);
      const rows = Object.values(world.players || {}).filter(player => player && !isTrueFlag(player.retired) && !isTrueFlag(player.freeAgent) && player.clubId && world.clubs[player.clubId]).map(player =>
        generatePlayerSeason(world, player, targetSeason, 1, strengthByLeague, matchesByClub));
      cached.rows.set(targetSeason, rows);
      // Only unfinished projections need caching; keep the memory footprint bounded.
      if (cached.rows.size > 2) cached.rows.delete(cached.rows.keys().next().value);
    }
    return cached.rows.get(targetSeason);
  }
  function getSeasonLines(save, season, progress = 1, db) {
    const world = ensureState(save, db);
    const targetSeason = Math.max(1, int(season, int(save.season, 1)));
    const scale = clamp(progress, 0, 1);
    const completed = world.seasonStats[String(targetSeason)];
    const fullRows = Array.isArray(completed) ? completed : getProjectedSeasonRows(world, targetSeason, db);
    return (Array.isArray(fullRows) ? fullRows : []).filter(row =>
      row && typeof row === "object" && !Array.isArray(row)).map(row => {
      const savedStats = row.seasonStats && typeof row.seasonStats === "object" && !Array.isArray(row.seasonStats)
        ? row.seasonStats : {};
      const rawAppearances = safeNumber(row.appearances !== undefined && row.appearances !== null
        ? row.appearances : savedStats.appearances, 0);
      const fullAppearances = Math.min(MAX_WORLD_SEASON_APPEARANCES, Math.max(0, rawAppearances));
      const fullGoals = Math.min(MAX_WORLD_SEASON_STAT,
        Math.max(0, safeNumber(row.goals, safeNumber(savedStats.goals, 0))));
      const fullAssists = Math.min(MAX_WORLD_SEASON_STAT,
        Math.max(0, safeNumber(row.assists, safeNumber(savedStats.assists, 0))));
      const apps = Math.round(fullAppearances * scale);
      const goals = apps > 0 ? Math.round(fullGoals * scale) : 0;
      const assists = apps > 0 ? Math.round(fullAssists * scale) : 0;
      const rating = clamp(safeNumber(row.averageRating, safeNumber(savedStats.averageRating, 0)), 0, 10);
      const ovr = clamp(safeNumber(row.ovr, safeNumber(savedStats.ovr, 50)) || 50, 1, 99);
      const seasonStats = {
        ...savedStats,
        season: Math.max(1, int(savedStats.season, targetSeason)),
        appearances: Math.min(MAX_WORLD_SEASON_APPEARANCES,
          Math.max(0, safeNumber(savedStats.appearances, fullAppearances))),
        goals: Math.min(MAX_WORLD_SEASON_STAT, Math.max(0, safeNumber(savedStats.goals, fullGoals))),
        assists: Math.min(MAX_WORLD_SEASON_STAT, Math.max(0, safeNumber(savedStats.assists, fullAssists))),
        averageRating: clamp(safeNumber(savedStats.averageRating, rating), 0, 10),
        ovr: clamp(safeNumber(savedStats.ovr, ovr) || ovr, 1, 99),
        club: savedStats.club || row.club || row.clubName || "",
        country: savedStats.country || row.country || ""
      };
      return {
        ...row, id: row.id,
        age: clamp(safeNumber(row.age, 18) || 18, 14, 60),
        ovr,
        potential: clamp(safeNumber(row.potential, ovr) || ovr, 1, 99),
        leagueStrength: clamp(safeNumber(row.leagueStrength, 60), 25, 100),
        prestige: clamp(safeNumber(row.prestige, 0), 0, 100),
        appearances: apps, goals, assists,
        averageRating: apps > 0 ? rating : 0,
        seasonStats,
        displayStats: { appearances: apps, goals, assists, averageRating: apps > 0 ? rating : 0 }
      };
    });
  }
  function promotionPlaces(firstTierCount, secondTierCount) {
    const firstCount = Math.max(0, int(firstTierCount, 0));
    const secondCount = Math.max(0, int(secondTierCount, 0));
    if (firstCount < 6 || secondCount < 3) return 0;
    return Math.min(2, Math.max(1, Math.floor(secondCount * 0.15)), Math.max(1, Math.floor(firstCount * 0.1)));
  }
  function simulateLeagueTables(world, season, progress = 1, db, suppliedMatchesByClub) {
    const byLeague = new Map();
    for (const club of Object.values(world.clubs)) {
      if (!club || !club.leagueId) continue;
      const leagueId = String(club.leagueId);
      const division = divisionForClub(club);
      const tableKey = division === 1 ? leagueId : leagueId + ":" + division;
      if (!byLeague.has(tableKey)) byLeague.set(tableKey, { leagueId, division, clubs: [] });
      byLeague.get(tableKey).clubs.push(club);
    }
    const tables = {};
    for (const [tableKey, group] of byLeague.entries()) {
      const leagueId = group.leagueId;
      const division = group.division;
      const sourceClubs = group.clubs;
      const promotionSlots = division === 2
        ? promotionPlaces((byLeague.get(leagueId) || {}).clubs?.length || 0, sourceClubs.length) : 0;
      const relegationSlots = division === 1
        ? promotionPlaces(sourceClubs.length, (byLeague.get(leagueId + ":2") || {}).clubs?.length || 0) : 0;
      const clubs = sourceClubs.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const clubCount = clubs.length;
      const matchesByClub = suppliedMatchesByClub instanceof Map
        ? suppliedMatchesByClub : buildLeagueMatchCountLookup(world, db);
      const matchesPerClub = clubCount > 1
        ? Math.max(0, Math.min(60, int(matchesByClub.get(String(clubs[0].id)), 34)))
        : 0;
      const statsByClub = new Map(clubs.map(club => [String(club.id), {
        played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, home: 0, away: 0
      }]));
      let fixtureNumber = 0;
      function playFixture(first, second, cycle) {
        const firstStats = statsByClub.get(String(first.id));
        const secondStats = statsByClub.get(String(second.id));
        const firstHomeCost = Math.abs((firstStats.home + 1) - firstStats.away)
          + Math.abs(secondStats.home - (secondStats.away + 1));
        const secondHomeCost = Math.abs((secondStats.home + 1) - secondStats.away)
          + Math.abs(firstStats.home - (firstStats.away + 1));
        let homeClub, awayClub;
        if (firstHomeCost < secondHomeCost) {
          homeClub = first; awayClub = second;
        } else if (secondHomeCost < firstHomeCost) {
          homeClub = second; awayClub = first;
        } else if (hash([leagueId, season, cycle, first.id, second.id, "home-choice-v2"].join("|")) % 2 === 0) {
          homeClub = first; awayClub = second;
        } else {
          homeClub = second; awayClub = first;
        }
        const relativePower = clamp(((Number(homeClub.power) || 55) - (Number(awayClub.power) || 55)) / 100, -0.55, 0.55);
        const rng = random(hash([leagueId, season, cycle, fixtureNumber++, homeClub.id, awayClub.id, "league-fixture-v2"].join("|")));
        function sampleGoals(rate) {
          const threshold = Math.exp(-rate);
          let product = 1, goals = 0;
          do {
            goals++;
            product *= rng();
          } while (product > threshold && goals < 8);
          return goals - 1;
        }
        const homeGoals = sampleGoals(clamp(1.30 + relativePower * 1.65, 0.25, 2.85));
        const awayGoals = sampleGoals(clamp(1.20 - relativePower * 1.65, 0.20, 2.75));
        const home = statsByClub.get(String(homeClub.id));
        const away = statsByClub.get(String(awayClub.id));
        home.played++; away.played++;
        home.home++; away.away++;
        home.gf += homeGoals; home.ga += awayGoals;
        away.gf += awayGoals; away.ga += homeGoals;
        if (homeGoals > awayGoals) {
          home.w++; away.l++;
        } else if (homeGoals < awayGoals) {
          home.l++; away.w++;
        } else {
          home.d++; away.d++;
        }
      }
      if (clubCount > 1 && matchesPerClub > 0) {
        // A full cycle gives every club one match against every other club.
        // A balanced circulant remainder graph handles leagues whose configured
        // match count is not an exact multiple of (clubs - 1).
        const matchesPerFullCycle = clubCount - 1;
        const fullCycles = Math.floor(matchesPerClub / matchesPerFullCycle);
        const remainder = matchesPerClub % matchesPerFullCycle;
        for (let cycle = 0; cycle < fullCycles; cycle++) {
          for (let i = 0; i < clubCount; i++) {
            for (let j = i + 1; j < clubCount; j++) playFixture(clubs[i], clubs[j], cycle);
          }
        }
        const usedPairs = new Set();
        const addRemainderPair = (left, right) => {
          if (left === right) return;
          const low = Math.min(left, right), high = Math.max(left, right);
          const key = low + "|" + high;
          if (usedPairs.has(key)) return;
          usedPairs.add(key);
          playFixture(clubs[low], clubs[high], fullCycles);
        };
        for (let distance = 1; distance <= Math.floor(remainder / 2); distance++) {
          for (let index = 0; index < clubCount; index++) addRemainderPair(index, (index + distance) % clubCount);
        }
        if (remainder % 2 === 1 && clubCount % 2 === 0) {
          for (let index = 0; index < clubCount / 2; index++) addRemainderPair(index, index + clubCount / 2);
        }
      }
      const rows = clubs.map(club => {
        const stats = statsByClub.get(String(club.id));
        const points = stats.w * 3 + stats.d;
        const goalDifference = stats.gf - stats.ga;
        const form = stats.played > 0
          ? clamp(5.7 + points / stats.played * 0.55 + goalDifference / stats.played * 0.12, 5.1, 8.8)
          : 0;
        return {
          season: Number(season), leagueId, division, country: club.country, clubId: club.id,
          club: club.name, power: Math.round(Number(club.power) || 55), played: stats.played,
          w: stats.w, d: stats.d, l: stats.l, gf: stats.gf, ga: stats.ga,
          pts: points, form: Number(form.toFixed(2))
        };
      });
      const ranked = rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || b.power - a.power);
      tables[tableKey] = ranked.map((row, index) => ({ ...row, rank: index + 1,
        status: division === 1
          ? index === 0 ? "بطل المحاكاة" : relegationSlots > 0 && index >= ranked.length - relegationSlots ? "منطقة الهبوط — محاكاة" : "مركز الدوري"
          : index === 0 ? promotionSlots > 0 ? "بطل الدرجة الثانية — صاعد" : "بطل الدرجة الثانية"
            : index < promotionSlots ? "منافس على الصعود — محاكاة" : "مركز الدرجة الثانية" }));
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
    const matchesByClub = buildLeagueMatchCountLookup(world, db);
    const rows = Object.values(world.players).filter(player => player && !isTrueFlag(player.retired) && !isTrueFlag(player.freeAgent) && player.clubId && world.clubs[player.clubId]).map(player =>
      generatePlayerSeason(world, player, year, 1, strengthByLeague, matchesByClub));
    const tables = simulateLeagueTables(world, year, 1, db, matchesByClub);
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
      const ratings = rows.map(player => marketPlayerRating(player));
      const ages = rows.map(player => marketPlayerAge(player));
      stats[group] = {
        count: rows.length,
        average: average(ratings),
        best: ratings.length ? Math.max(...ratings) : 0,
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
    const clubPower = marketClubPower(club);
    const qualityGap = Math.max(0, clubPower - row.average - 4);
    const topQualityGap = Math.max(0, clubPower - row.best - 6);
    const weakUnitPenalty = row.average < clubPower - 5 ? 5 : 0;
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
    const sellerPower = marketClubPower(seller);
    const candidates = rows.filter(player => {
      const rating = marketPlayerRating(player);
      const age = marketPlayerAge(player);
      const contract = marketContractSeasons(player);
      return rating < quality.best - 2 || age >= 29 || contract <= 1 || rating < sellerPower - 12;
    });
    candidates.sort((a, b) => {
      const score = player => {
        const age = marketPlayerAge(player);
        const contract = marketContractSeasons(player);
        const rating = marketPlayerRating(player);
        const potential = marketPlayerPotential(player, rating);
        return (age >= 29 ? 8 : 0) + (contract <= 1 ? 5 : 0)
          + Math.max(0, sellerPower - rating) * 0.8 - potential * 0.13
          + hash(player.id + "|" + seller.updatedSeason) % 17 / 10;
      };
      return score(b) - score(a);
    });
    return candidates[0] || null;
  }
  // A transfer window touches several linked records. Keep each market phase atomic:
  // if any roster/history/report update fails, restore the exact pre-window state.
  function captureTransferValue(value) {
    return Array.isArray(value)
      ? { isArray: true, reference: value, items: value.slice() }
      : { isArray: false, value };
  }
  function restoreTransferValue(snapshot) {
    if (!snapshot || !snapshot.isArray) return snapshot && snapshot.value;
    snapshot.reference.splice(0, snapshot.reference.length, ...snapshot.items);
    return snapshot.reference;
  }
  function captureTransferFields(target, fields) {
    return fields.map(key => ({
      key,
      present: Object.prototype.hasOwnProperty.call(target, key),
      value: captureTransferValue(target[key])
    }));
  }
  function captureTransferClubHistoryValue(value) {
    if (!Array.isArray(value)) return captureTransferValue(value);
    return {
      isArray: true,
      reference: value,
      items: value.slice(),
      itemSnapshots: value.map(item => item && typeof item === "object"
        ? { item, fields: captureTransferFields(item, ["clubId", "name", "country"]) }
        : null)
    };
  }
  function restoreTransferClubHistoryValue(snapshot) {
    if (!snapshot || !snapshot.isArray) return snapshot && snapshot.value;
    snapshot.reference.splice(0, snapshot.reference.length, ...snapshot.items);
    (snapshot.itemSnapshots || []).forEach(itemSnapshot => {
      if (itemSnapshot) restoreTransferFields(itemSnapshot.item, itemSnapshot.fields);
    });
    return snapshot.reference;
  }
  function restoreTransferFields(target, snapshots) {
    snapshots.forEach(snapshot => {
      if (snapshot.present) target[snapshot.key] = restoreTransferValue(snapshot.value);
      else delete target[snapshot.key];
    });
  }
  function withTransferMarketTransaction(world, operation) {
    const playerMap = world && world.players && typeof world.players === "object" ? world.players : null;
    const originalPlayers = new Map(playerMap ? Object.entries(playerMap) : []);
    const originalPlayerIds = new Set(originalPlayers.keys());
    const clubSnapshots = new Map();
    const playerSnapshots = new Map();
    const historySnapshots = new Map();
    const historyMap = world && world.playerHistory && typeof world.playerHistory === "object"
      ? world.playerHistory : null;
    const transferClubHistoryMap = world && world.transferClubHistoryByPlayer
      && typeof world.transferClubHistoryByPlayer === "object" && !Array.isArray(world.transferClubHistoryByPlayer)
      ? world.transferClubHistoryByPlayer : null;
    const transferClubHistorySnapshots = new Map();
    const worldSnapshots = captureTransferFields(world, [
      "transferSequence", "nextGeneratedPlayer", "transfers", "marketReports",
      "transferClubHistoryByPlayer", "transferClubHistorySchemaVersion"
    ]);
    const reportSnapshots = (Array.isArray(world.marketReports) ? world.marketReports : [])
      .filter(report => report && typeof report === "object")
      .map(report => ({
        report,
        fields: captureTransferFields(report, ["moves", "transferIds", "summary"])
      }));
    const transaction = {
      captureClub(club) {
        if (club && !clubSnapshots.has(club)) {
          clubSnapshots.set(club, captureTransferFields(club, ["budget", "roster", "power", "updatedSeason"]));
        }
      },
      capturePlayer(player) {
        if (player && !playerSnapshots.has(player)) {
          playerSnapshots.set(player, captureTransferFields(player, [
            "clubId", "country", "leagueId", "division", "contractSeasons",
            "transferListed", "freeAgent", "freeAgentSince", "previousClubId"
          ]));
        }
      },
      captureHistory(playerId) {
        const key = String(playerId || "");
        if (!key || historySnapshots.has(key) || !historyMap) return;
        const present = Object.prototype.hasOwnProperty.call(historyMap, key);
        historySnapshots.set(key, {
          present,
          value: present ? captureTransferValue(historyMap[key]) : null
        });
      },
      captureTransferClubHistory(playerId) {
        const key = String(playerId || "");
        if (!key || transferClubHistorySnapshots.has(key) || !transferClubHistoryMap) return;
        const present = Object.prototype.hasOwnProperty.call(transferClubHistoryMap, key);
        transferClubHistorySnapshots.set(key, {
          present,
          value: present ? captureTransferClubHistoryValue(transferClubHistoryMap[key]) : null
        });
      }
    };
    try {
      return operation(transaction);
    } catch (error) {
      clubSnapshots.forEach((snapshot, club) => restoreTransferFields(club, snapshot));
      playerSnapshots.forEach((snapshot, player) => restoreTransferFields(player, snapshot));
      if (playerMap && world.players === playerMap) {
        Object.keys(playerMap).forEach(id => {
          if (!originalPlayerIds.has(id)) delete playerMap[id];
        });
        originalPlayers.forEach((player, id) => {
          if (!Object.prototype.hasOwnProperty.call(playerMap, id)) playerMap[id] = player;
        });
      }
      reportSnapshots.forEach(snapshot => restoreTransferFields(snapshot.report, snapshot.fields));
      restoreTransferFields(world, worldSnapshots);
      if (historyMap && world.playerHistory === historyMap) {
        historySnapshots.forEach((snapshot, key) => {
          if (snapshot.present) historyMap[key] = restoreTransferValue(snapshot.value);
          else delete historyMap[key];
        });
      }
      if (transferClubHistoryMap && world.transferClubHistoryByPlayer === transferClubHistoryMap) {
        transferClubHistorySnapshots.forEach((snapshot, key) => {
          if (!snapshot.present) {
            delete transferClubHistoryMap[key];
            return;
          }
          const restored = restoreTransferClubHistoryValue(snapshot.value);
          if (transferClubHistoryMap[key] !== restored) transferClubHistoryMap[key] = restored;
        });
      }
      throw error;
    }
  }
  function runTransferWindow(world, season) {
    return withTransferMarketTransaction(world, function(transaction) {
      const clubs = Object.values(world.clubs || {}).filter(club => club && divisionForClub(club) >= 1);
      Object.values(world.clubs || {}).forEach(club => transaction.captureClub(club));
    // Apply the new-season operating allocation before deals, while retaining leftover transfer cash.
    // The cap prevents balances from growing without bound over long simulated careers.
    for (const club of clubs) {
      const power = marketClubPower(club);
      const prestige = marketClubPrestige(club);
      const budgetBase = Math.max(40, Math.round(70 + power * 9 + prestige * 2.2));
      const existingBudget = safeNumber(club.budget, -1);
      const carriedBudget = Number.isFinite(existingBudget) && existingBudget >= 0
        ? Math.min(existingBudget, budgetBase * 2) : budgetBase;
      club.budget = Math.round(Math.min(budgetBase * 2, carriedBudget + Math.max(1, Math.round(budgetBase * 0.25))));
    }
    const alreadyUsedClubs = new Set(), alreadyUsedPlayers = new Set(), moves = [];
    const maxMoves = Math.max(10, Math.min(40, Math.round(clubs.length * 0.42)));
    // Interleave divisions so the capped market does not spend every deal on first-tier clubs.
    const buyersByDivision = new Map();
    for (const club of clubs) {
      const division = divisionForClub(club);
      if (!buyersByDivision.has(division)) buyersByDivision.set(division, []);
      buyersByDivision.get(division).push(club);
    }
    const buyerStrength = (a, b) => {
      const aStrength = marketClubPower(a) + marketClubPrestige(a) * 0.04 + hash(a.id + "|" + season + "|buyer") % 29 / 100;
      const bStrength = marketClubPower(b) + marketClubPrestige(b) * 0.04 + hash(b.id + "|" + season + "|buyer") % 29 / 100;
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
      if (activeRosterIds(world, buyer).length >= 18) continue;
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
        const playerOvr = marketPlayerRating(player);
        const playerPotential = marketPlayerPotential(player, playerOvr);
        const playerAge = marketPlayerAge(player);
        const buyerPower = marketClubPower(buyer);
        const buyerPrestige = marketClubPrestige(buyer);
        const sellerPrestige = marketClubPrestige(seller);
        const powerGap = buyerPower - playerOvr;
        if (powerGap < -14 || powerGap > 18) continue;
        const ageFactor = playerAge <= 23 ? 7 : playerAge <= 27 ? 4 : playerAge >= 31 ? -5 : 0;
        const potentialFactor = (playerPotential - playerOvr) * 0.65;
        const needsFactor = need.score * 0.8;
        const prestigeFactor = (buyerPrestige - sellerPrestige) * 0.04;
        const distancePenalty = buyer.leagueId === seller.leagueId ? 0 : 1.5;
        const tie = hash(player.id + "|" + buyer.id + "|" + season) % 41 / 100;
        const archetype = inferArchetype(buyer);
        const coachStyle = inferCoachArchetype(buyer);
        const archetypeFactor = archetype === "youth-investor"
          ? Math.max(0, playerPotential - playerOvr) * 0.34 + (playerAge <= 23 ? 4 : -2)
          : archetype === "title-chaser"
            ? (playerAge >= 24 && playerAge <= 30 ? 5 : playerAge >= 32 ? -5 : 0) + playerOvr * 0.035
            : archetype === "academy-builder" ? (playerAge <= 25 ? 2.5 : -1) : 0;
        const coachFit = coachStyle === "develop-youth" && playerAge <= 23 ? 2
          : coachStyle === "win-now" && playerOvr >= buyerPower - 2 ? 1.8
          : coachStyle === "technical-discipline" && playerPotential >= playerOvr + 8 ? 1 : 0;
        const score = playerOvr * 0.58 + potentialFactor + ageFactor + needsFactor + prestigeFactor
          + archetypeFactor + coachFit - distancePenalty - fee / Math.max(1, safeNumber(buyer.budget, 0)) * 5 + tie;
        candidates.push({ player, seller, fee, score, group: need.group });
      }
      candidates.sort((a, b) => b.score - a.score || marketPlayerRating(b.player) - marketPlayerRating(a.player));
      const candidate = candidates[0];
      if (!candidate || candidate.score < 37) continue;
      const { player, seller, fee, group } = candidate;
      transaction.capturePlayer(player);
      transaction.captureHistory(player.id);
      const origin = seller.name;
      // Rebuild both memberships from active ownership before moving the player.
      // This discards stale, duplicate, retired, free-agent, and cross-club IDs.
      seller.roster = activeRosterIds(world, seller).filter(id => id !== String(player.id));
      buyer.roster = activeRosterIds(world, buyer).filter(id => id !== String(player.id));
      buyer.roster.push(String(player.id));
      // The recorded fee is a direct buyer-to-seller transaction; never discard part of it.
      seller.budget = Math.max(0, safeNumber(seller.budget, 0)) + fee;
      buyer.budget = Math.max(0, safeNumber(buyer.budget, 0) - fee);
      player.clubId = buyer.id; player.country = buyer.country; player.leagueId = buyer.leagueId;
      player.division = divisionForClub(buyer); player.contractSeasons = 2 + (hash(player.id + "|" + season + "|contract") % 4);
      player.transferListed = false;
      alreadyUsedClubs.add(seller.id); alreadyUsedClubs.add(buyer.id); alreadyUsedPlayers.add(player.id);
      const transfer = {
        id: "world-transfer-" + season + "-" + (++world.transferSequence),
        season: Number(season), day: 1, playerId: player.id, player: player.name, position: player.position,
        group, from: origin, fromCountry: seller.country, fromClubId: String(seller.id),
        to: buyer.name, toCountry: buyer.country, toClubId: String(buyer.id),
        fee, currency: buyer.currency, reason: roleNeedsLabel(group) + " • " + (playerAge <= 23 ? "استثمار في المستقبل" : playerAge >= 30 ? "خبرة جاهزة" : "تعزيز فوري"),
        playerOvr, kind: "انتقال — محاكاة"
      };
      moves.push(transfer);
      world.transfers.unshift(transfer);
      world.playerHistory[player.id] = Array.isArray(world.playerHistory[player.id]) ? world.playerHistory[player.id] : [];
      world.playerHistory[player.id].unshift({ season: Number(season), clubId: String(buyer.id),
        club: buyer.name, country: buyer.country, fromClubId: String(seller.id),
        type: "transfer-in", from: origin });
      world.playerHistory[player.id] = world.playerHistory[player.id].slice(0, 12);
    }
    world.transfers = world.transfers.slice(0, 300);
    // Refill every division after contract expirations; relegated clubs need a complete squad too.
    Object.values(world.clubs).forEach(club => {
      fillRoster(world, club);
      const strength = rosterPlayers(world, club).slice()
        .sort((a, b) => marketPlayerRating(b) - marketPlayerRating(a)).slice(0, 11);
      const squadAverage = average(strength.map(player => marketPlayerRating(player)));
      const basePower = safeNumber(club.basePower, marketClubPower(club));
      club.power = clamp(Math.round(basePower * 0.70 + squadAverage * 0.30), 35, 97);
      club.updatedSeason = Number(season);
      // Keep the cash balance after fees; recomputing it here would erase the transfer's financial effect.
    });
    world.marketReports.unshift({
      season: Number(season), moves: moves.length,
      summary: moves.length ? "اتحرك سوق الانتقالات بناءً على نقص المراكز، القوة، السن، والإمكانات." : "مفيش انتقالات كبيرة مناسبة لاحتياجات الأندية في نافذة الموسم دي.",
      transferIds: moves.map(item => item.id)
    });
    world.marketReports = world.marketReports.slice(0, 12);
    moves.forEach(move => {
      transaction.captureTransferClubHistory(move.playerId);
      rememberTransferClubEndpoints(world, move);
    });
    return moves;
    });
  }
  function roleNeedsLabel(group) {
    return ({ goalkeeper: "تدعيم حراسة المرمى", defender: "تدعيم الدفاع", midfielder: "تدعيم الوسط", attacker: "تدعيم الهجوم" })[group] || "تدعيم الفريق";
  }
  function shouldRetirePlayer(player, seasonAge, row, season) {
    const isGoalkeeper = String(player.group || "") === "goalkeeper"
      || groupForPosition(player.position) === "goalkeeper";
    const effectiveAge = Math.max(16, safeNumber(seasonAge, 18) - (isGoalkeeper ? 1 : 0));
    if (effectiveAge < 38) return false;
    if (effectiveAge >= 42) return true;
    const rating = safeNumber(row && row.averageRating, safeNumber(player.lastRating, 0));
    let chance = effectiveAge >= 41 ? 78 : effectiveAge >= 40 ? 55 : effectiveAge >= 39 ? 30 : 12;
    if (rating >= 7.4) chance -= 12;
    else if (rating > 0 && rating < 6.0) chance += 12;
    if (safeNumber(player.ovr, 0) <= 55) chance += 12;
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
    player.retirementAge = Math.max(16, safeNumber(seasonAge, 0) || safeNumber(player.age, 0) || 18);
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
    // Retirement is a terminal career event: keep every prior history row, including older saves.
    world.playerHistory[player.id] = history;
    world.notes = Array.isArray(world.notes) ? world.notes : [];
    world.notes.unshift({
      season: player.retiredSeason,
      type: "retirement",
      text: player.name + " اعتزل كرة القدم بعد نهاية الموسم."
    });
    world.notes = world.notes.slice(0, 30);
  }
  function developPlayers(world, season) {
    const developmentSeason = Math.max(1, int(season, 1));
    if (Math.max(0, int(world.lastDevelopedSeason, 0)) >= developmentSeason) return false;
    const stats = world.seasonStats[String(season)] || [];
    const byId = new Map(stats.map(row => [row.id, row]));
    const seasonAges = new Map();
    Object.values(world.players).forEach(player => {
      if (!player || isTrueFlag(player.retired)) return;
      const row = byId.get(player.id);
      // Season statistics describe the season just played, so development thresholds
      // must use the player's age during that season, before advancing their age.
      const seasonAge = Math.min(43, Math.max(16, safeNumber(player.age, 18) || 18));
      seasonAges.set(player.id, seasonAge);
      player.age = Math.min(43, seasonAge + 1);
      player.contractSeasons = Math.max(0, (safeNumber(player.contractSeasons, 1) || 1) - 1);
      if (row) {
        const rowAppearances = safeNumber(row.appearances, 0);
        const rowAverageRating = safeNumber(row.averageRating, 0);
        player.lastRating = rowAverageRating;
        let delta = 0;
        if (seasonAge <= 23 && rowAppearances >= 10 && rowAverageRating >= 6.45) delta = rowAverageRating >= 7.25 ? 2 : 1;
        else if (seasonAge <= 28 && rowAppearances >= 16 && rowAverageRating >= 7.15) delta = 1;
        else if (seasonAge >= 31) delta = rowAverageRating < 6.4 ? -2 : -1;
        else if (seasonAge >= 29 && rowAverageRating < 6.0) delta = -1;
        player.ovr = clamp(safeNumber(player.ovr, 35) + delta, 35, 97);
        const potentialValue = safeNumber(player.potential, null);
        if (potentialValue === null && player.potential !== undefined) player.potential = player.ovr;
        else if (potentialValue !== null && potentialValue < player.ovr) player.potential = player.ovr;
      }
    });
    // Contracts now truly expire. A deterministic renewal decision keeps key players
    // when the club needs them, while the rest enter the free-agent pool.
    Object.values(world.players).forEach(player => {
      if (!player || isTrueFlag(player.retired)) return;
      const seasonAge = seasonAges.get(player.id);
      const row = byId.get(player.id);
      if (shouldRetirePlayer(player, seasonAge, row, season)) {
        retireWorldPlayer(world, player, season, seasonAge);
        return;
      }
      const orphanedClubId = String(player.clubId || "");
      const club = orphanedClubId ? world.clubs[orphanedClubId] : null;
      if (isTrueFlag(player.freeAgent) || !orphanedClubId || !club) {
        const wasFreeAgent = isTrueFlag(player.freeAgent);
        const hasStaleFreeAgentState = Boolean(orphanedClubId) || !wasFreeAgent
          || safeNumber(player.contractSeasons, 0) > 0
          || Boolean(String(player.leagueId || "").trim())
          || safeNumber(player.division, 0) > 0
          || player.transferListed === true;
        if (orphanedClubId) player.previousClubId = player.previousClubId || orphanedClubId;
        // Free-agent saves can have an empty clubId but retain a stale former-club roster entry.
        const staleRosterClubIds = [orphanedClubId, String(player.previousClubId || "").trim()]
          .filter((clubId, index, ids) => clubId && ids.indexOf(clubId) === index);
        staleRosterClubIds.forEach(clubId => {
          const staleClub = world.clubs[clubId];
          if (staleClub && Array.isArray(staleClub.roster)) {
            staleClub.roster = staleClub.roster.filter(id => String(id) !== String(player.id));
          }
        });
        if (hasStaleFreeAgentState) {
          player.clubId = "";
          player.leagueId = "";
          player.division = 0;
          player.contractSeasons = 0;
          player.freeAgent = true;
          const freeAgentSince = safeNumber(player.freeAgentSince, 0);
          player.freeAgentSince = Number.isFinite(freeAgentSince) && freeAgentSince > 0
            ? freeAgentSince : safeNumber(season, 1) + 1;
          player.transferListed = false;
          if (!wasFreeAgent) {
            world.notes = Array.isArray(world.notes) ? world.notes : [];
            world.notes.unshift({ season: safeNumber(season, 1) + 1, type: "free-agent",
              text: player.name + " فقد ارتباطه بناديه السابق وأصبح متاحًا في سوق اللاعبين." });
            world.notes = world.notes.slice(0, 30);
          }
        }
        return;
      }
      if (safeNumber(player.contractSeasons, 0) > 0) return;
      const roster = rosterPlayers(world, club);
      const sameRole = roster.filter(row => row.group === player.group && row.id !== player.id);
      const roleTarget = Math.max(1, Number(TARGETS[player.group]) || 1);
      const roleNeed = sameRole.length < roleTarget;
      const age = safeNumber(player.age, 18) || 18;
      const quality = safeNumber(player.ovr, 50) || 50;
      const renewalChance = clamp(0.12 + (quality >= club.power - 2 ? 0.28 : 0)
        + (safeNumber(player.lastRating, 0) >= 7.0 ? 0.16 : 0) + (roleNeed ? 0.20 : 0)
        - Math.max(0, age - 30) * 0.055, 0.02, 0.76);
      const roll = hash(player.id + "|" + season + "|contract-renewal-v2") / 4294967296;
      if (roll < renewalChance && age < 36) {
        player.contractSeasons = 2 + (hash(player.id + "|" + season + "|renewed-term") % 3);
        player.freeAgent = false;
        player.lastRenewedSeason = safeNumber(season, 1) + 1;
        world.notes.unshift({ season: safeNumber(season, 1) + 1, type: "contract", text: player.name + " جدد عقده مع " + club.name + " لمدة " + player.contractSeasons + " مواسم." });
      } else {
        club.roster = (club.roster || []).filter(id => String(id) !== String(player.id));
        player.previousClubId = club.id;
        player.freeAgent = true;
        player.freeAgentSince = safeNumber(season, 1) + 1;
        player.clubId = "";
        player.leagueId = "";
        player.division = 0;
        world.notes.unshift({ season: safeNumber(season, 1) + 1, type: "free-agent", text: player.name + " انتهى عقده وأصبح لاعبًا حرًا." });
      }
    });
    world.notes = world.notes.slice(0, 30);
    world.lastDevelopedSeason = developmentSeason;
    return true;
  }
  function advanceToSeason(save, nextSeason, db) {
    const world = ensureState(save, db);
    const next = Math.max(1, int(nextSeason, int(save.season, 1)));
    const lastAdvancedTo = Math.max(0, int(world.lastAdvancedTo, 0));
    const currentSeason = Math.max(1, int(world.currentSeason, 1));
    if (lastAdvancedTo >= next || currentSeason > next) {
      const stableSeason = Math.max(currentSeason, lastAdvancedTo);
      world.currentSeason = stableSeason;
      return { season: stableSeason, moves: [], alreadyAdvanced: true };
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
    world.projectionRevision = Math.max(0, int(world.projectionRevision, 0)) + 1;
    // Player development, promotion/relegation and the paid market all run before
    // the new season becomes active. Discard any projection built against the old squads.
    invalidateUnfinishedSeasonProjection(world);
    return { season: next, moves, alreadyAdvanced: false };
  }
  function getClubMatchProfile(save, name, country, db) {
    const world = ensureState(save, db);
    const club = findClubByIdentity(world, name, country);
    if (!club) return null;
    const goalkeepers = rosterPlayers(world, club)
      .filter(player => (String(player.position || "").trim()
        ? groupForPosition(player.position) : player.group) === "goalkeeper")
      .map(player => clamp(Number(player.goalkeeping) || Number(player.ovr) || 55, 35, 99))
      .sort((a, b) => b - a);
    const starter = goalkeepers.length ? goalkeepers[0] : null;
    const backup = goalkeepers.length > 1 ? goalkeepers[1] : starter;
    const goalkeeping = starter == null ? null : clamp(Math.round(starter * 0.88 + backup * 0.12), 35, 99);
    return { power: Number(club.power) || Number(club.basePower) || null, goalkeeping };
  }
  function getClubPower(save, name, country, db) {
    const world = ensureState(save, db);
    const club = findClubByIdentity(world, name, country);
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
      const division = divisionForClub(club);
      // League membership can change after promotion/relegation. Resolve the competition
      // from the club's current division instead of reusing the seed-time tier-one label.
      const profile = db && typeof db.leagueFor === "function"
        ? db.leagueFor(club.country, division) || {}
        : db && typeof db.leagueById === "function" ? db.leagueById(club.leagueId) || {} : {};
      const league = profile.name || (division >= 2 ? profile.tier2 : profile.league) || club.leagueName;
      const leagueEnglish = profile.englishName || (division >= 2 ? profile.tier2English : profile.english) || club.leagueEnglish;
      return {
        country: club.country, club: club.name, league: league, leagueEnglish: leagueEnglish,
        season: "موسم " + world.currentSeason, source: "محاكاة عالم الكرة", division: division,
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
    const table = simulateLeagueTables(world, year, 1, db)[String(leagueId)] || [];
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
      && (!options.division || safeNumber(row.division, 0) === safeNumber(options.division, NaN)));
    return lines.map(row => {
      const displayStats = row.displayStats && typeof row.displayStats === "object" && !Array.isArray(row.displayStats)
        ? row.displayStats : row;
      const appearances = Math.min(MAX_WORLD_SEASON_APPEARANCES,
        Math.max(0, safeNumber(displayStats.appearances, 0)));
      const goals = appearances > 0 ? Math.min(MAX_WORLD_SEASON_STAT,
        Math.max(0, safeNumber(displayStats.goals, 0))) : 0;
      const assists = appearances > 0 ? Math.min(MAX_WORLD_SEASON_STAT,
        Math.max(0, safeNumber(displayStats.assists, 0))) : 0;
      const averageRating = appearances > 0
        ? clamp(safeNumber(displayStats.averageRating !== undefined
          ? displayStats.averageRating : row.averageRating, 0), 0, 10) : 0;
      const ovr = clamp(safeNumber(row.ovr, 0), 0, 99);
      const leagueStrength = clamp(safeNumber(row.leagueStrength, 60), 25, 100);
      const score = appearances > 0
        ? Number((averageRating * 9 + goals * 0.95 + assists * 0.62 + ovr * 0.08).toFixed(3))
        : 0;
      const weightedGoals = appearances > 0
        ? Number((goals * (0.82 + leagueStrength / 450)).toFixed(3)) : 0;
      return { ...row, appearances, goals, assists, averageRating, ovr, leagueStrength, score, weightedGoals };
    });
  }
  function dashboard(save, db) {
    const world = ensureState(save, db);
    const progress = clamp(safeNumber(save.seasonApps, 0) / Math.max(1, safeNumber(save.seasonAppsTarget, 0)), 0, 1);
    const year = Math.max(1, int(save.season, 1));
    const rows = leaderboard(save, { season: year, progress }, db);
    const goals = rows.slice().sort((a, b) => b.goals - a.goals || b.averageRating - a.averageRating).slice(0, 5);
    const assists = rows.slice().sort((a, b) => b.assists - a.assists || b.averageRating - a.averageRating).slice(0, 5);
    const currentClub = findClubByIdentity(world, save.clubName, save.leagueCountry || "مصر");
    const division = currentClub ? divisionForClub(currentClub) : Math.max(1, int(save.leagueDivision, 1));
    const tableKey = currentClub && currentClub.leagueId
      ? (division === 1 ? String(currentClub.leagueId) : String(currentClub.leagueId) + ":" + division)
      : "";
    const savedTables = world.leagueTables && world.leagueTables[String(year)] || {};
    const savedTable = tableKey ? savedTables[tableKey] : null;
    const hasSavedMatches = world.matchesBySeason
      && Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year));
    const completedWithoutMatches = Array.isArray(world.completedSeasons)
      && world.completedSeasons.includes(year) && !hasSavedMatches;
    const projectedTables = tableKey && !Array.isArray(savedTable) && !completedWithoutMatches
      ? simulateLeagueTables(world, year, progress, db) : null;
    const table = Array.isArray(savedTable) ? savedTable.slice(0, 5)
      : projectedTables ? (projectedTables[tableKey] || []).slice(0, 5) : [];
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
    version: VERSION, normalize, normalizePosition, clubKey, syncClubDivisionMetadata, groupForPosition, positionProductionProfile, playerRoleWeight,
    ensureState, completeSeason, advanceToSeason, getSeasonLines, getClubPower, getClubMatchProfile, transferTargets,
    getLeagueTable, leaderboard, dashboard, rosterPlayers, withTransferMarketTransaction,
    rememberTransferClubEndpoints, isTrueFlag
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
  const WORLD_CLUB_CUP_CYCLE_YEARS = 4;
  const WORLD_CLUB_CUP_TEAM_COUNT = 32;
  const WORLD_CLUB_CUP_COMPETITION_WEIGHTS = Object.freeze({
    ucl: 7, libertadores: 7, "caf-cl": 6
  });
  // This extension is a separate IIFE from the core world engine. Parse only primitive
  // numeric values so malformed arrays/objects/booleans cannot leak into season tables.
  const safeNumber = (value, fallback = 0) => {
    if (typeof value !== "number" && typeof value !== "string") return fallback;
    if (typeof value === "string" && value.trim() === "") return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, safeNumber(value, 0)));
  const int = (value, fallback = 0) => {
    const numeric = safeNumber(value, NaN);
    return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
  };
  const divisionForClub = club => Math.max(1, int(club && club.division, 1));
  const hash = value => {
    let h = 2166136261;
    for (const char of String(value)) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  const random = seed => {
    let value = (safeNumber(seed, 0) >>> 0) || 0x9e3779b9;
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
    Object.values(world.clubs || {}).forEach(club => {
      if (!club || !club.leagueId) return;
      // Keep legacy saves consistent with addClub and simulateLeagueTables:
      // an absent/invalid division is the first tier, not a reason to omit the club.
      const division = divisionForClub(club);
      if (division > 2) return;
      const key = String(club.leagueId) + ":" + String(division);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(club);
    });
    return groups;
  }
  function playersForClub(world, club) {
    return base.rosterPlayers(world, club);
  }
  function activeRosterIdsForClub(world, club) {
    return playersForClub(world, club).map(player => String(player && player.id || "")).filter(Boolean);
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
        stat.division = divisionForClub(world.clubs[clubId]);
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
  const MAX_WORLD_SEASON_APPEARANCES = 1000;
  const MAX_WORLD_SEASON_STAT = 1000000;
  function buildPlayerRows(world, season, accumulators) {
    // Precompute club power averages once per league/division. The old implementation
    // rescanned every club twice for every player, adding millions of needless comparisons
    // whenever a complete world season was simulated.
    if (!world || typeof world !== "object") return [];
    const seasonNumber = safeNumber(season, NaN);
    if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 1) return [];
    const clubs = world.clubs && typeof world.clubs === "object" ? world.clubs : {};
    const players = world.players && typeof world.players === "object" ? world.players : {};
    const powerByLeagueDivision = new Map();
    Object.values(clubs).forEach(club => {
      if (!club) return;
      const key = String(club.leagueId || "") + "|" + divisionForClub(club);
      const summary = powerByLeagueDivision.get(key) || { total: 0, count: 0 };
      const savedPower = safeNumber(club.power, 55);
      summary.total += savedPower > 0 ? clamp(savedPower, 25, 100) : 55;
      summary.count++;
      powerByLeagueDivision.set(key, summary);
    });
    const leagueStrengthFor = (leagueId, division) => {
      const divisionNumber = Math.max(1, Math.round(safeNumber(division, 1)));
      const summary = powerByLeagueDivision.get(String(leagueId || "") + "|" + divisionNumber);
      return summary && summary.count ? Math.round(summary.total / summary.count) : 55;
    };
    return Object.values(players).filter(player => player && !base.isTrueFlag(player.retired)
      && !base.isTrueFlag(player.freeAgent) && player.clubId && clubs[player.clubId]).map(player => {
      const savedAccumulator = accumulators && typeof accumulators.get === "function"
        ? accumulators.get(player.id) : null;
      const acc = savedAccumulator && typeof savedAccumulator === "object" && !Array.isArray(savedAccumulator)
        ? savedAccumulator : playerAccumulator();
      const historicalClub = clubs[acc.clubId || player.clubId] || null;
      const apps = Math.min(MAX_WORLD_SEASON_APPEARANCES,
        Math.max(0, Math.floor(safeNumber(acc.appearances, 0))));
      const goals = Math.min(MAX_WORLD_SEASON_STAT,
        Math.max(0, Math.floor(safeNumber(acc.goals, 0))));
      const assists = Math.min(MAX_WORLD_SEASON_STAT,
        Math.max(0, Math.floor(safeNumber(acc.assists, 0))));
      const ratingTotal = Math.min(apps * 10, Math.max(0, safeNumber(acc.ratingTotal, 0)));
      const rating = apps ? Number((clamp(ratingTotal / apps, 0, 10)).toFixed(2)) : 0;
      const leagueId = String(acc.leagueId || player.leagueId || "");
      const accumulatorDivision = safeNumber(acc.division, NaN);
      const playerDivision = safeNumber(player.division, NaN);
      const leagueDivision = Math.max(1, Math.round(accumulatorDivision > 0
        ? accumulatorDivision : playerDivision > 0 ? playerDivision : 1));
      const leagueStrength = leagueStrengthFor(leagueId, leagueDivision);
      const age = clamp(safeNumber(player.age, 18) || 18, 14, 60);
      const ovr = clamp(safeNumber(player.ovr, 50) || 50, 1, 99);
      const potential = clamp(safeNumber(player.potential, ovr) || ovr, 1, 99);
      const savedDivision = accumulatorDivision > 0 ? accumulatorDivision
        : playerDivision > 0 ? playerDivision : 0;
      const prestige = clamp(safeNumber(historicalClub ? historicalClub.prestige : player.prestige, 0), 0, 100);
      const row = {
        id: player.id, season: seasonNumber, name: player.name, club: historicalClub ? historicalClub.name : "",
        clubName: historicalClub ? historicalClub.name : "", clubId: acc.clubId || player.clubId || "",
        country: historicalClub ? historicalClub.country : player.country || "",
        leagueId, division: Math.max(0, Math.round(savedDivision)),
        position: player.position, group: player.group || base.groupForPosition(player.position),
        age, ovr, potential,
        appearances: apps, goals, assists, averageRating: rating,
        leagueStrength,
        prestige,
        confederation: historicalClub ? historicalClub.confederation : "",
        originConfederation: historicalClub ? historicalClub.confederation : "",
        isGenerated: !!player.isGenerated, realPlayer: !player.isGenerated,
        score: Number((rating * 9 + goals * 0.95 + assists * 0.62 + ovr * 0.08).toFixed(3)),
        weightedGoals: Number((goals * (0.82 + (leagueStrength || 60) / 450)).toFixed(3)),
        seasonStats: { season: seasonNumber, appearances: apps, goals, assists, averageRating: rating,
          ovr, club: historicalClub ? historicalClub.name : "", country: historicalClub ? historicalClub.country : "" }
      };
      row.displayStats = { appearances: apps, goals, assists, averageRating: rating };
      return row;
    });
  }
  function buildBalancedLeagueSchedule(clubs, matchesPerClub, seed) {
    const teams = Array.isArray(clubs) ? clubs.slice() : [];
    const teamCount = teams.length;
    if (teamCount < 2) return [];
    let target = Math.max(0, Math.min(60, int(matchesPerClub, 2 * (teamCount - 1))));
    if (teamCount % 2 === 1 && target % 2 === 1) target--;
    if (!target) return [];
    const fixtures = [], homeCounts = new Map(teams.map(club => [String(club.id), 0]));
    let matchday = 0;
    const addFixture = (first, second, day, cycle) => {
      if (!first || !second || String(first.id) === String(second.id)) return;
      const firstId=String(first.id), secondId=String(second.id);
      const firstHomes=homeCounts.get(firstId)||0, secondHomes=homeCounts.get(secondId)||0;
      let home,away;
      if(firstHomes<secondHomes){home=first;away=second;}
      else if(secondHomes<firstHomes){home=second;away=first;}
      else if(hash([seed,cycle,day,firstId,secondId,"balanced-home"].join("|"))%2===0){home=first;away=second;}
      else{home=second;away=first;}
      homeCounts.set(String(home.id),(homeCounts.get(String(home.id))||0)+1);
      fixtures.push({home,away,round:day});
    };
    const cycleSize=teamCount-1, fullCycles=Math.floor(target/cycleSize), remainder=target%cycleSize;
    for(let cycle=0;cycle<fullCycles;cycle++){
      let rotation=teams.slice(); if(rotation.length%2) rotation.push(null);
      const roundCount=rotation.length-1;
      for(let round=0;round<roundCount;round++){
        matchday++;
        for(let index=0;index<rotation.length/2;index++){
          const first=rotation[index],second=rotation[rotation.length-1-index];
          if(first&&second)addFixture(first,second,matchday,cycle);
        }
        const fixed=rotation[0],rest=rotation.slice(1);rest.unshift(rest.pop());rotation=[fixed].concat(rest);
      }
    }
    const remainderPairs=[],usedPairs=new Set();
    const addRemainderPair=(left,right)=>{
      if(left===right)return;
      const low=Math.min(left,right),high=Math.max(left,right),key=low+"|"+high;
      if(usedPairs.has(key))return;
      usedPairs.add(key);remainderPairs.push([teams[left],teams[right]]);
    };
    for(let distance=1;distance<=Math.floor(remainder/2);distance++)
      for(let index=0;index<teamCount;index++)addRemainderPair(index,(index+distance)%teamCount);
    if(remainder%2===1&&teamCount%2===0)
      for(let index=0;index<teamCount/2;index++)addRemainderPair(index,index+teamCount/2);
    const remainderMatchdays=[];
    remainderPairs.forEach(pair=>{
      let dayIndex=0;
      while(dayIndex<remainderMatchdays.length&&remainderMatchdays[dayIndex].some(row=>row.includes(pair[0])||row.includes(pair[1])))dayIndex++;
      if(!remainderMatchdays[dayIndex])remainderMatchdays[dayIndex]=[];
      remainderMatchdays[dayIndex].push(pair);
    });
    remainderMatchdays.forEach(dayPairs=>{
      matchday++;dayPairs.forEach(([home,away])=>addFixture(home,away,matchday,fullCycles));
    });
    return fixtures;
  }
  function promotionPlaces(firstTierCount, secondTierCount) {
    const firstCount = Math.max(0, int(firstTierCount, 0));
    const secondCount = Math.max(0, int(secondTierCount, 0));
    if (firstCount < 6 || secondCount < 3) return 0;
    return Math.min(2, Math.max(1, Math.floor(secondCount * 0.15)), Math.max(1, Math.floor(firstCount * 0.1)));
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
      const firstTierCount = (groups.get(leagueId + ":1") || []).length;
      const secondTierCount = (groups.get(leagueId + ":2") || []).length;
      const promotionSlots = division === 2 ? promotionPlaces(firstTierCount, clubs.length) : 0;
      const relegationSlots = division === 1 ? promotionPlaces(clubs.length, secondTierCount) : 0;
      const leagueTables = new Map(), recent = new Map();
      clubs.forEach(club => { leagueTables.set(club.id, tableRow(club, year, leagueId, division)); recent.set(club.id, ""); });
      const groupMatchStartIndex = allMatches.length;
      const standardMatchesPerClub = Math.max(0, 2 * (clubs.length - 1));
      const leagueProfile = db && typeof db.leagueFor === "function"
        ? db.leagueFor(clubs[0] && clubs[0].country, division) || {} : {};
      const expectedTeamCount = Math.max(0, int(leagueProfile.teamCount, 0));
      // Only use the official season length when every registered club is present.
      // An incomplete catalogue must not create a long league between a few known clubs.
      const hasCompleteLeagueField = expectedTeamCount > 1 && clubs.length === expectedTeamCount;
      const configuredMatches = Number(leagueProfile.matchesPerSeason);
      let targetMatchesPerClub = hasCompleteLeagueField && Number.isFinite(configuredMatches) && configuredMatches > 0
        ? Math.max(0, Math.min(60, Math.round(configuredMatches))) : standardMatchesPerClub;
      if (clubs.length % 2 === 1 && targetMatchesPerClub % 2 === 1) targetMatchesPerClub--;
      const isScottishPremiership = leagueId === "scotland" && division === 1 && clubs.length === 12;
      if (clubs.length >= 2) {
        if (isScottishPremiership || targetMatchesPerClub === standardMatchesPerClub) {
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
        } else {
          const fixtures = buildBalancedLeagueSchedule(clubs, targetMatchesPerClub,
            [leagueId, division, year, "configured-league-schedule-v1"].join("|"));
          fixtures.forEach(fixture => {
            const match = playMatch(world, fixture.home, fixture.away, year, division,
              fixture.round, ++sequence, accumulators, "league", lineupCache);
            allMatches.push(match);
            applyResult(leagueTables, match);
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
        status: division === 1
          ? index === 0 ? "بطل المحاكاة" : relegationSlots > 0 && index >= ranked.length - relegationSlots ? "منطقة الهبوط — محاكاة" : "مركز الدوري"
          : index === 0 ? promotionSlots > 0 ? "بطل الدرجة الثانية — صاعد" : "بطل الدرجة الثانية"
            : index < promotionSlots ? "منافس على الصعود — محاكاة" : "مركز الدرجة الثانية" }));
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
    // Standings are compact snapshots needed for promotion history and historical tables.
    // Keep the same 20-season window as completedSeasons; only detailed fixtures and
    // player-season rows are aggressively pruned to control save size.
    const tableKeep = Object.keys(world.leagueTables).map(Number).sort((a,b)=>a-b).slice(-20);
    const tableKeepSet = new Set(tableKeep.map(String));
    Object.keys(world.leagueTables).forEach(key => { if (!tableKeepSet.has(key)) delete world.leagueTables[key]; });
    // The four-year world club qualification cycle needs a compact history of
    // completed top-tier continental competitions, independent of player-season stats.
    retainCompetitionHistory(world, WORLD_CLUB_CUP_CYCLE_YEARS);
    return { season: year, rows, tables, matches: allMatches, competitions: world.competitionsBySeason[String(year)] };
  }
  function retainCompetitionHistory(world, limit = WORLD_CLUB_CUP_CYCLE_YEARS) {
    if (!world || typeof world !== "object") return;
    if (!world.competitionsBySeason || typeof world.competitionsBySeason !== "object"
      || Array.isArray(world.competitionsBySeason)) world.competitionsBySeason = {};
    const keepCount = Math.max(1, Math.floor(Number(limit) || WORLD_CLUB_CUP_CYCLE_YEARS));
    const keep = Object.keys(world.competitionsBySeason).map(key => ({ key, season: Number(key) }))
      .filter(entry => Number.isSafeInteger(entry.season) && entry.season > 0)
      .sort((a, b) => a.season - b.season)
      .slice(-keepCount);
    const keepKeys = new Set(keep.map(entry => entry.key));
    Object.keys(world.competitionsBySeason).forEach(key => {
      if (!keepKeys.has(key)) delete world.competitionsBySeason[key];
    });
  }
  function worldClubCupParticipants(world, season, def) {
    const currentSeason = Math.max(1, Math.floor(Number(season) || 1));
    const cycleYears = WORLD_CLUB_CUP_CYCLE_YEARS;
    if (!def || String(def.system || "") !== "world32" || currentSeason <= cycleYears
      || (currentSeason - 1) % cycleYears !== 0) return [];
    const clubs = world && world.clubs && typeof world.clubs === "object" ? world.clubs : {};
    const history = world && world.competitionsBySeason && typeof world.competitionsBySeason === "object"
      ? world.competitionsBySeason : {};
    const candidates = new Map();
    const firstSeason = currentSeason - cycleYears;
    for (let historySeason = firstSeason; historySeason < currentSeason; historySeason++) {
      const competitions = history[String(historySeason)];
      // A missing season is not a blank season: it means the save cannot prove a
      // complete qualification cycle, so do not invent replacement entrants.
      if (!Array.isArray(competitions)) return [];
      competitions.forEach(competition => {
        if (!competition || competition.kind !== "continental") return;
        const weight = WORLD_CLUB_CUP_COMPETITION_WEIGHTS[String(competition.id || "")];
        // Only top-tier continental championships award world-cup qualification.
        // Secondary cups are not treated as equivalent to the Champions League.
        if (!weight) return;
        const confederation = String(competition.confederation || "").trim();
        if (!confederation) return;
        const participantIds = Array.from(new Set((Array.isArray(competition.participants)
          ? competition.participants : []).map(id => String(id || "").trim()).filter(Boolean)));
        if (!participantIds.length) return;
        const participantSet = new Set(participantIds);
        const matchStats = new Map();
        const recordAppearance = (clubId, round, won) => {
          const stat = matchStats.get(clubId) || { wins: 0, matches: 0, highestRound: 0 };
          stat.matches++;
          stat.highestRound = Math.max(stat.highestRound, round);
          if (won) stat.wins++;
          matchStats.set(clubId, stat);
        };
        (Array.isArray(competition.matches) ? competition.matches : []).forEach(match => {
          if (!match) return;
          const homeId = String(match.homeClubId || "");
          const awayId = String(match.awayClubId || "");
          if (!homeId || !awayId || homeId === awayId) return;
          const round = Math.max(0, Math.floor(Number(match.round) || 0));
          const winnerId = String(match.winnerId || "");
          if (participantSet.has(homeId)) recordAppearance(homeId, round, winnerId === homeId);
          if (participantSet.has(awayId)) recordAppearance(awayId, round, winnerId === awayId);
        });
        participantIds.forEach(clubId => {
          const club = clubs[clubId];
          const division = divisionForClub(club);
          if (!club || !club.leagueId || !Number.isFinite(division) || division < 1
            || String(club.confederation || "") !== confederation) return;
          let entry = candidates.get(clubId);
          if (!entry) {
            entry = { club, champions: 0, runnersUp: 0, points: 0, latestSeason: 0 };
            candidates.set(clubId, entry);
          }
          if (String(competition.championId || "") === clubId) entry.champions++;
          if (String(competition.runnerUpId || "") === clubId) entry.runnersUp++;
          const stat = matchStats.get(clubId) || { wins: 0, matches: 0, highestRound: 0 };
          entry.points += weight * 100 + stat.highestRound * 20 + stat.wins * 5
            + stat.matches + (historySeason - firstSeason);
          entry.latestSeason = Math.max(entry.latestSeason, historySeason);
        });
      });
    }
    const selected = Array.from(candidates.values()).sort((a, b) =>
      b.champions - a.champions
      || b.runnersUp - a.runnersUp
      || b.points - a.points
      || b.latestSeason - a.latestSeason
      || String(a.club.id).localeCompare(String(b.club.id)))
      .slice(0, WORLD_CLUB_CUP_TEAM_COUNT);
    // A 32-team field must be earned through recorded top-tier continental results.
    // Never fall back to global squad power, static example names, or generated clubs.
    return selected.length === WORLD_CLUB_CUP_TEAM_COUNT ? selected.map(entry => entry.club) : [];
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
          // Use one fair draw. Chained conditional draws gave the home club a 52.645% win probability on a neutral tiebreak.
          if (matchRng() < 0.5) homeGoals++;
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
    const clubs = Object.values(world.clubs || {}).filter(club => club && club.leagueId && divisionForClub(club) >= 1);
    const results = [];
    const isRecordedParticipant = (row, clubId) => {
      const id = String(clubId || "").trim();
      if (!row || !id) return false;
      if (!Object.prototype.hasOwnProperty.call(row, "participants")) return true;
      if (!Array.isArray(row.participants)) return false;
      return row.participants.some(participantId => String(participantId || "").trim() === id);
    };
    definitions.forEach(def => {
      if (!def || !def.id) return;
      let participants = [];
      if (def.kind === "domestic-cup") {
        const leagueId = Array.isArray(def.countries) ? def.countries[0] : "";
        participants = clubs.filter(club => club.leagueId === leagueId && (def.lower || divisionForClub(club) === 1));
      } else if (def.kind === "continental") {
        // Continental places come from domestic standings, not raw squad power. A
        // season uses the previous completed table; the current table is only the
        // bootstrap source when no historical table exists for that league.
        const previousSeason = Math.max(0, Math.floor(Number(season) || 1) - 1);
        const previousTables = world.leagueTables && world.leagueTables[String(previousSeason)] || {};
        const currentTables = tables && typeof tables === "object" ? tables : {};
        const qualificationPlaces = Array.from(new Set((Array.isArray(def.qualificationPlaces) ? def.qualificationPlaces : [])
          .map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0))).sort((a, b) => a - b);
        if (!qualificationPlaces.length) return;
        const slotStart = qualificationPlaces[0];
        const slotCount = qualificationPlaces.length;
        const leagueIds = Array.from(new Set(clubs
          .filter(club => club.confederation === def.confederation && divisionForClub(club) === 1 && club.leagueId)
          .map(club => String(club.leagueId)))).sort();
        const candidates = [];
        for (const leagueId of leagueIds) {
          const historicalRows = previousTables[leagueId];
          const rows = Array.isArray(historicalRows) && historicalRows.length ? historicalRows : currentTables[leagueId];
          if (!Array.isArray(rows)) continue;
          const sampleClub = clubs.find(club => String(club.leagueId) === leagueId);
          let profile = null;
          try {
            if (db && typeof db.leagueById === "function") profile = db.leagueById(leagueId) || null;
            if (!profile && db && typeof db.leagueFor === "function" && sampleClub) {
              profile = db.leagueFor(sampleClub.country, 1) || null;
            }
          } catch (_) { profile = null; }
          const rankedRows = rows.map((row, index) => {
            const savedRank = Number(row && row.rank);
            return { row, rank: Number.isInteger(savedRank) && savedRank > 0 ? savedRank : index + 1 };
          }).filter(entry => entry.rank >= slotStart)
            .sort((a, b) => a.rank - b.rank
              || Number(b.row && b.row.pts || 0) - Number(a.row && a.row.pts || 0)
              || (Number(b.row && b.row.gf || 0) - Number(b.row && b.row.ga || 0))
                - (Number(a.row && a.row.gf || 0) - Number(a.row && a.row.ga || 0))
              || String(a.row && a.row.clubId || "").localeCompare(String(b.row && b.row.clubId || "")));
          const seenLeagueClubIds = new Set();
          let filledSlots = 0;
          for (const entry of rankedRows) {
            if (filledSlots >= slotCount) break;
            const row = entry.row || {};
            const clubId = String(row.clubId || "");
            if (!clubId || seenLeagueClubIds.has(clubId)) continue;
            const club = world.clubs && world.clubs[clubId];
            if (!club || String(club.leagueId || "") !== leagueId || divisionForClub(club) !== 1
              || String(club.confederation || "") !== String(def.confederation || "")) continue;
            if (row.leagueId != null && String(row.leagueId).trim() && String(row.leagueId).trim() !== leagueId) continue;
            if (row.division != null && String(row.division).trim() && Number(row.division) !== 1) continue;
            seenLeagueClubIds.add(clubId);
            filledSlots++;
            candidates.push({
              club, rank: entry.rank,
              globalTier: Number(profile && profile.globalTier) || 99,
              leagueStrength: Number(profile && profile.strength) || 0,
              points: Number(row.pts) || 0,
              goalDifference: Number(row.gd) || (Number(row.gf || 0) - Number(row.ga || 0))
            });
          }
        }
        candidates.sort((a, b) => a.rank - b.rank || a.globalTier - b.globalTier
          || b.leagueStrength - a.leagueStrength || b.points - a.points
          || b.goalDifference - a.goalDifference
          || Number(b.club.power || 50) - Number(a.club.power || 50)
          || String(a.club.id).localeCompare(String(b.club.id)));
        participants = candidates.slice(0, 12).map(entry => entry.club);
      } else if (def.kind === "world") {
        participants = worldClubCupParticipants(world, season, def);
      } else if (def.kind === "supercup" && season > 1) {
        const previous = Array.isArray(world.competitionsBySeason[String(season - 1)])
          ? world.competitionsBySeason[String(season - 1)] : [];
        const addParticipant = club => {
          if (club && !participants.some(team => team.id === club.id)) participants.push(club);
        };
        if (Array.isArray(def.countries) && def.countries.length) {
          // Domestic supercups use the previous season's league and domestic-cup winners.
          // Never substitute continental champions or this season's still-unfinished table.
          const leagueId = String(def.countries[0]);
          const previousTables = world.leagueTables && world.leagueTables[String(season - 1)] || {};
          const leagueRows = Array.isArray(previousTables[leagueId]) ? previousTables[leagueId] : [];
          // Legacy tables may omit rank, but an explicit rank must never let a stale or
          // cross-league club claim the domestic supercup place.
          const hasLeagueRowRanks = leagueRows.some(row => row && row.rank != null && String(row.rank).trim() !== "");
          const leagueClubAtRank = rank => {
            const candidates = hasLeagueRowRanks
              ? leagueRows.filter(row => row && Number(row.rank) === rank)
              : [leagueRows[rank - 1]];
            return candidates.map(row => {
              if (!row) return null;
              const club = world.clubs && world.clubs[row.clubId];
              const clubDivision = divisionForClub(club);
              if (!club || String(club.leagueId || "") !== leagueId || clubDivision !== 1) return null;
              const rowLeagueId = String(row.leagueId || "").trim();
              if (rowLeagueId && rowLeagueId !== leagueId) return null;
              if (row.division != null && String(row.division).trim() !== "" && Number(row.division) !== 1) return null;
              return club;
            }).find(Boolean) || null;
          };
          const leagueChampion = leagueClubAtRank(1);
          const leagueRunnerUp = leagueClubAtRank(2);
          const qualifierCupId = String(def.qualifierCupId || "").trim();
          const qualifierCupDefinition = qualifierCupId
            ? definitions.find(item => item && String(item.id || "") === qualifierCupId && item.kind === "domestic-cup")
            : null;
          const qualifierCupName = String(qualifierCupDefinition && qualifierCupDefinition.name || "").trim();
          const domesticCup = qualifierCupDefinition ? previous.find(row => {
            const champion = row && row.championId && world.clubs && world.clubs[row.championId];
            const rowLeagueId = String(row && row.leagueId || "").trim();
            const rowId = String(row && (row.id || row.tournamentId) || "").trim();
            const matchesPrimaryCup = rowId
              ? rowId === qualifierCupId
              : !!qualifierCupName && String(row && row.name || "").trim() === qualifierCupName;
            return row && row.kind === "domestic-cup" && matchesPrimaryCup && champion
              && String(champion.leagueId || "") === leagueId
              && isRecordedParticipant(row, row.championId)
              && (!rowLeagueId || rowLeagueId === leagueId);
          }) : null;
          const isEligibleForQualifierCup = club => {
            if (!club || String(club.leagueId || "") !== leagueId) return false;
            const division = divisionForClub(club);
            return Number.isInteger(division) && division >= 1
              && (!!(qualifierCupDefinition && qualifierCupDefinition.lower) || division === 1);
          };
          const cupRunnerUpId = String(domesticCup && domesticCup.runnerUpId || "").trim();
          const cupRunnerUp = cupRunnerUpId && world.clubs && world.clubs[cupRunnerUpId];
          const runnerUpIsRecorded = !!cupRunnerUpId
            && cupRunnerUpId !== String(domesticCup && domesticCup.championId || "").trim()
            && isRecordedParticipant(domesticCup, cupRunnerUpId);
          const eligibleCupRunnerUp = runnerUpIsRecorded && isEligibleForQualifierCup(cupRunnerUp) ? cupRunnerUp : null;
          const domesticCupChampion = domesticCup && world.clubs[domesticCup.championId];
          const eligibleDomesticCupChampion = isEligibleForQualifierCup(domesticCupChampion) ? domesticCupChampion : null;
          // Both primary qualifiers must be verified. A missing cup result must not
          // silently turn the league runner-up into the cup winner.
          if (leagueChampion && eligibleDomesticCupChampion) {
            addParticipant(leagueChampion);
            addParticipant(eligibleDomesticCupChampion);
            if (participants.length < 2) {
              // A lower-tier cup runner-up is eligible only when the configured cup admits lower divisions.
              addParticipant(eligibleCupRunnerUp);
              if (participants.length < 2) addParticipant(leagueRunnerUp);
            }
          }
        } else {
          // Continental supercups may only use winners of continental competitions.
          const confederation = String(def.confederation || "").trim();
          const confederationForClub = club => {
            if (!club) return "";
            let value = String(club.confederation || "").trim();
            if (!value && db && typeof db.leagueById === "function") {
              try {
                const profile = db.leagueById(club.leagueId);
                value = String(profile && profile.confederation || "").trim();
              } catch (_) { /* An unknown club confederation is not a verified qualifier. */ }
            }
            return value;
          };
          const qualifierIds = Array.isArray(def.qualifierCompetitionIds)
            ? Array.from(new Set(def.qualifierCompetitionIds.map(id => String(id || "").trim()).filter(Boolean)))
            : [];
          const eligibleById = new Map();
          previous.forEach(row => {
            const rowId = String(row && row.id || "").trim();
            const championId = String(row && row.championId || "").trim();
            if (!row || row.kind !== "continental" || !rowId || !qualifierIds.includes(rowId)
              || !championId || !isRecordedParticipant(row, championId)) return;
            if (confederation && String(row.confederation || "").trim() !== confederation) return;
            const club = world.clubs && world.clubs[championId];
            if (!club || (confederation && confederationForClub(club) !== confederation)) return;
            if (!eligibleById.has(rowId)) eligibleById.set(rowId, row);
          });
          if (qualifierIds.length < 2 || qualifierIds.some(id => !eligibleById.has(id))) return;
          const qualifierRows = qualifierIds.map(id => eligibleById.get(id));
          const championIds = new Set();
          qualifierRows.forEach(row => {
            const championId = String(row && row.championId || "").trim();
            if (!championId) return;
            championIds.add(championId);
            addParticipant(world.clubs && world.clubs[championId]);
          });
          // If one club won multiple feeder competitions, fill the vacant place
          // with the first verified runner-up who actually entered a feeder cup.
          if (participants.length < 2) {
            for (const row of qualifierRows) {
              const runnerUpId = String(row && row.runnerUpId || "").trim();
              if (!runnerUpId || championIds.has(runnerUpId) || !isRecordedParticipant(row, runnerUpId)) continue;
              const runnerUp = world.clubs && world.clubs[runnerUpId];
              if (!runnerUp || (confederation && confederationForClub(runnerUp) !== confederation)) continue;
              addParticipant(runnerUp);
              if (participants.length >= 2) break;
            }
          }
        }
      } else {
        return;
      }
      const unique = [];
      participants.forEach(club => { if (club && !unique.some(row => row.id === club.id)) unique.push(club); });
      // Domestic cups with lower-tier entry must retain every eligible club; knockout() handles byes.
      const tournament = knockout(world, season, def, unique);
      if (tournament) results.push(tournament);
    });
    return results;
  }
  function applyPromotionRelegation(world, season, db) {
    world.promotionHistory = Array.isArray(world.promotionHistory) ? world.promotionHistory : [];
    const destinationSeason = Number(season) + 1;
    if (world.promotionHistory.some(row => Number(row.season) === destinationSeason)) return [];
    const tables = world.leagueTables && world.leagueTables[String(season)] || {};
    const finiteStandingNumber = value => {
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      if (typeof value !== "string" || value.trim() === "") return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const compareDescendingStandingMetric = (a, b) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return b - a;
    };
    const leagueIds = new Set(Object.values(world.clubs || {}).map(club => String(club && club.leagueId || "")).filter(Boolean));
    const eligibleTableRows = (rows, leagueId, expectedDivision) => {
      const seen = new Set();
      const eligible = [];
      let sourceIndex = 0;
      for (const row of Array.isArray(rows) ? rows : []) {
        const index = sourceIndex++;
        const clubId = String(row && row.clubId || "");
        if (!clubId || seen.has(clubId)) continue;
        const club = world.clubs && world.clubs[clubId];
        if (!club || String(club.leagueId || "") !== String(leagueId)) continue;
        const rawClubDivision = finiteStandingNumber(club.division);
        const clubDivision = rawClubDivision === null ? 1 : Math.max(1, Math.round(rawClubDivision));
        if (!Number.isInteger(clubDivision) || clubDivision !== expectedDivision) continue;
        const rowLeagueId = String(row.leagueId || "").trim();
        if (rowLeagueId && rowLeagueId !== String(leagueId)) continue;
        if (row.division !== undefined && row.division !== null && String(row.division).trim() !== "") {
          const rowDivision = finiteStandingNumber(row.division);
          if (!Number.isInteger(rowDivision) || rowDivision !== expectedDivision) continue;
        }
        seen.add(clubId);
        eligible.push({ club, row, index });
      }
      // New season tables are rank-sorted, but imported/legacy snapshots are not
      // guaranteed to preserve array order. Honor an explicit rank first, then use
      // standings metrics as a deterministic fallback for older rows without rank.
      const pointsFor = row => finiteStandingNumber(row && row.pts);
      const goalDifferenceFor = row => {
        const saved = finiteStandingNumber(row && row.gd);
        if (saved !== null) return saved;
        const goalsFor = finiteStandingNumber(row && row.gf);
        const goalsAgainst = finiteStandingNumber(row && row.ga);
        return (goalsFor === null ? 0 : goalsFor) - (goalsAgainst === null ? 0 : goalsAgainst);
      };
      const goalsFor = row => finiteStandingNumber(row && row.gf) ?? 0;
      const powerFor = club => finiteStandingNumber(club && club.power) || 50;
      eligible.sort((a, b) => {
        const aRank = finiteStandingNumber(a.row && a.row.rank), bRank = finiteStandingNumber(b.row && b.row.rank);
        const aHasRank = Number.isInteger(aRank) && aRank > 0;
        const bHasRank = Number.isInteger(bRank) && bRank > 0;
        if (aHasRank && bHasRank && aRank !== bRank) return aRank - bRank;
        if (aHasRank !== bHasRank) return aHasRank ? -1 : 1;
        return compareDescendingStandingMetric(pointsFor(a.row), pointsFor(b.row))
          || compareDescendingStandingMetric(goalDifferenceFor(a.row), goalDifferenceFor(b.row))
          || compareDescendingStandingMetric(goalsFor(a.row), goalsFor(b.row))
          || compareDescendingStandingMetric(powerFor(a.club), powerFor(b.club))
          || a.index - b.index;
      });
      return eligible.map(entry => entry.club);
    };
    const plannedMoves = [];
    const scheduledClubIds = new Set();
    for (const leagueId of leagueIds) {
      // Standings can outlive a transfer or a division change in legacy saves. Only clubs
      // that still belong to this league and tier may take part in the current promotion.
      const first = eligibleTableRows(tables[leagueId], leagueId, 1);
      const second = eligibleTableRows(tables[leagueId + ":2"], leagueId, 2);
      const count = promotionPlaces(first.length, second.length);
      if (!count) continue;
      const promoted = second.slice(0, count), relegated = first.slice(-count);
      for (let i = 0; i < count; i++) {
        const up = promoted[i], down = relegated[i];
        if (!up || !down || up.id === down.id
          || scheduledClubIds.has(String(up.id)) || scheduledClubIds.has(String(down.id))) continue;
        scheduledClubIds.add(String(up.id));
        scheduledClubIds.add(String(down.id));
        plannedMoves.push({ leagueId, up, down });
      }
    }
    if (!plannedMoves.length) return [];

    // Apply the complete promotion batch atomically. A metadata lookup can fail after the
    // division field changes, so retain both club metadata and every attached player's tier.
    const affectedClubIds = new Set();
    const clubSnapshots = new Map();
    const clubFields = ["division", "leagueName", "leagueEnglish", "matchesPerSeason"];
    for (const plan of plannedMoves) {
      for (const club of [plan.up, plan.down]) {
        const id = String(club.id || "");
        affectedClubIds.add(id);
        if (!clubSnapshots.has(club)) {
          const snapshot = {};
          clubFields.forEach(field => {
            snapshot[field] = {
              present: Object.prototype.hasOwnProperty.call(club, field),
              value: club[field]
            };
          });
          clubSnapshots.set(club, snapshot);
        }
      }
    }
    const playerSnapshots = [];
    Object.values(world.players || {}).forEach(player => {
      if (player && affectedClubIds.has(String(player.clubId || ""))) {
        playerSnapshots.push({
          player,
          present: Object.prototype.hasOwnProperty.call(player, "division"),
          value: player.division
        });
      }
    });

    const moves = [];
    try {
      for (const plan of plannedMoves) {
        base.syncClubDivisionMetadata(world, plan.up, 1, db);
        base.syncClubDivisionMetadata(world, plan.down, 2, db);
        moves.push({
          leagueId: plan.leagueId,
          promoted: plan.up.name,
          relegated: plan.down.name,
          season: destinationSeason
        });
      }
    } catch (error) {
      for (const [club, snapshot] of clubSnapshots) {
        for (const [field, saved] of Object.entries(snapshot)) {
          if (saved.present) club[field] = saved.value;
          else delete club[field];
        }
      }
      playerSnapshots.forEach(snapshot => {
        if (snapshot.present) snapshot.player.division = snapshot.value;
        else delete snapshot.player.division;
      });
      throw error;
    }

    world.promotionHistory.unshift({ season: destinationSeason, moves });
    world.promotionHistory = world.promotionHistory.slice(0, 30);
    world.notes = Array.isArray(world.notes) ? world.notes : [];
    world.notes.unshift({ season: destinationSeason, type: "promotion", text: "اكتملت حركة الصعود والهبوط بين الدرجات في " + moves.length + " دوريًا." });
    world.notes = world.notes.slice(0, 30);
    return moves;
  }
  function signFreeAgents(world, season, existingMoves) {
    return base.withTransferMarketTransaction(world, function(transaction) {
    // This function lives in a separate IIFE from the shared world-engine number helper.
    // Keep the market parser local so standalone regression extraction uses the same rules.
    const marketNumber = (value, fallback = 0) => {
      if (typeof value !== "number" && typeof value !== "string") return fallback;
      if (typeof value === "string" && value.trim() === "") return fallback;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    };
    const clubPowerForMarket = club => {
      const rawPower = club && club.power;
      const missing = rawPower === undefined || rawPower === null
        || (typeof rawPower === "string" && rawPower.trim() === "");
      return marketNumber(rawPower, missing ? 55 : NaN);
    };
    const seasonNumber = marketNumber(season, NaN);
    if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 1) return [];
    const freeAgents = Object.values(world.players || {}).filter(player => {
      if (!player || base.isTrueFlag(player.retired) || !base.isTrueFlag(player.freeAgent)) return false;
      const contractSeasons = marketNumber(player.contractSeasons, NaN);
      return Number.isFinite(contractSeasons) && contractSeasons <= 0;
    }).sort((a,b)=>marketNumber(b.ovr,50)-marketNumber(a.ovr,50));
    const clubs = Object.values(world.clubs || {}).filter(club => {
      if (!club || divisionForClub(club) < 1) return false;
      const power = clubPowerForMarket(club);
      return Number.isFinite(power) && power > 0 && activeRosterIdsForClub(world, club).length < 18;
    }).sort((a,b)=>clubPowerForMarket(b)-clubPowerForMarket(a));
    Object.values(world.clubs || {}).forEach(club => transaction.captureClub(club));
    const roleCountsByClub = new Map();
    for (const club of clubs) {
      const counts = Object.create(null);
      for (const player of playersForClub(world, club)) {
        if (!player) continue;
        const group = player.group || base.groupForPosition(player.position);
        counts[group] = (counts[group] || 0) + 1;
      }
      roleCountsByClub.set(club.id, counts);
    }
    const usedClubs = new Set();
    // The paid market runs first. Carry both sides of its completed deals into
    // this phase so one club cannot make a second move in the same window.
    for (const move of Array.isArray(existingMoves) ? existingMoves : []) {
      if (!move) continue;
      for (const side of ["from", "to"]) {
        const clubId = String(move[side + "ClubId"] || "").trim();
        if (clubId && world.clubs[clubId]) {
          usedClubs.add(clubId);
          continue;
        }
        const name = String(move[side] || "").trim();
        if (!name) continue;
        const country = String(move[side + "Country"] || "").trim();
        const matches = Object.values(world.clubs).filter(club => club
          && String(club.name || "").trim() === name
          && (!country || String(club.country || "").trim() === country));
        // Legacy transfer rows have no stable club IDs. Only resolve their names
        // when the name/country pair identifies exactly one club.
        if (matches.length === 1) usedClubs.add(String(matches[0].id || ""));
      }
    }
    const signed = [];
    const maxSignings = Math.min(12, Math.max(2, Math.round(clubs.length * 0.10)));
    for (const player of freeAgents) {
      if (signed.length >= maxSignings) break;
      const group = player.group || base.groupForPosition(player.position);
      const roleTarget = ROLE_TARGETS[group];
      if (!roleTarget) continue;
      const formerClubSince = marketNumber(player.freeAgentSince, NaN);
      // Only primitive legacy IDs are valid club identifiers; malformed objects/arrays
      // must not be string-coerced into an accidental former-club match.
      const rawPreviousClubId = player.previousClubId;
      const previousClubIdMissing = rawPreviousClubId === undefined || rawPreviousClubId === null
        || (typeof rawPreviousClubId === "string" && rawPreviousClubId.trim() === "");
      if (!previousClubIdMissing && typeof rawPreviousClubId !== "string"
        && !(typeof rawPreviousClubId === "number" && Number.isFinite(rawPreviousClubId))) continue;
      const previousClubId = previousClubIdMissing ? ""
        : typeof rawPreviousClubId === "string" ? rawPreviousClubId.trim() : String(rawPreviousClubId);
      // Do not let a just-expired player bounce straight back to the same club.
      // After one complete free-agent season, a former club may recruit them again.
      // Legacy saves without a freeAgentSince marker keep the conservative old guard.
      // A free-agent start marker is a whole season ordinal; fractional or unsafe
      // values are corrupt and must never shorten the former-club waiting period.
      const formerClubReturnEligible = Number.isSafeInteger(formerClubSince)
        && formerClubSince > 0 && seasonNumber > formerClubSince;
      const playerOvr = marketNumber(player.ovr, NaN);
      const ageMissing = player.age === undefined || player.age === null
        || (typeof player.age === "string" && player.age.trim() === "");
      const playerAge = ageMissing ? 18 : marketNumber(player.age, NaN);
      if (!Number.isFinite(playerOvr) || !Number.isFinite(playerAge)) continue;
      const eligible = clubs.filter(club => {
        const counts = roleCountsByClub.get(club.id) || {};
        const clubPower = clubPowerForMarket(club);
        return Number.isFinite(clubPower) && clubPower > 0
          && !usedClubs.has(club.id)
          && activeRosterIdsForClub(world, club).length < 18
          && (!previousClubId || previousClubId !== String(club.id || "").trim() || formerClubReturnEligible)
          && playerOvr <= clubPower + 10
          && playerOvr >= clubPower - 23
          && playerAge < 37
          && (counts[group] || 0) < roleTarget;
      });
      if (!eligible.length) continue;
      // Prefer the club with the largest vacancy in this exact role, then club strength.
      eligible.sort((a,b) => {
        const aCount = (roleCountsByClub.get(a.id) || {})[group] || 0;
        const bCount = (roleCountsByClub.get(b.id) || {})[group] || 0;
        return aCount - bCount || clubPowerForMarket(b) - clubPowerForMarket(a) || String(a.id).localeCompare(String(b.id));
      });
      const buyer = eligible[0];
      transaction.captureClub(buyer);
      transaction.capturePlayer(player);
      transaction.captureHistory(player.id);
      buyer.roster = activeRosterIdsForClub(world, buyer).filter(id => id !== String(player.id));
      const previousClub = previousClubId ? world.clubs[previousClubId] : null;
      const oldClubName = previousClub ? previousClub.name : "لاعب حر";
      player.clubId = buyer.id; player.country = buyer.country; player.leagueId = buyer.leagueId;
      player.division = divisionForClub(buyer); player.freeAgent = false;
      player.freeAgentSince = 0;
      player.contractSeasons = 2 + (hash(player.id + "|" + seasonNumber + "|free-agent-term") % 3);
      buyer.roster.push(String(player.id));
      const counts = roleCountsByClub.get(buyer.id);
      counts[group] = (counts[group] || 0) + 1;
      usedClubs.add(buyer.id);
      const move = {
        id: "world-transfer-" + seasonNumber + "-free-" + hash(player.id + "|" + buyer.id).toString(36),
        season: seasonNumber, day: 1, playerId: player.id, player: player.name, position: player.position,
        group, from: oldClubName, fromCountry: previousClub ? previousClub.country : "",
        fromClubId: previousClub ? String(previousClub.id) : "",
        to: buyer.name, toCountry: buyer.country, toClubId: String(buyer.id), fee: 0, currency: buyer.currency,
        reason: "تعاقد مجاني • احتياج في المركز وخبرة/إمكانات مناسبة",
        playerOvr, kind: "تعاقد مع لاعب حر — محاكاة"
      };
      signed.push(move);
      world.playerHistory[player.id] = Array.isArray(world.playerHistory[player.id]) ? world.playerHistory[player.id] : [];
      world.playerHistory[player.id].unshift({ season: seasonNumber, clubId: String(buyer.id),
        club: buyer.name, country: buyer.country, fromClubId: previousClub ? String(previousClub.id) : "",
        type: "free-agent-signing", from: oldClubName });
      world.playerHistory[player.id] = world.playerHistory[player.id].slice(0, 12);
    }
    if (signed.length) {
      world.transfers = signed.concat(world.transfers || []).slice(0, 300);
      for (const club of clubs) {
        const top = playersForClub(world, club).slice().sort((a,b)=>marketNumber(b.ovr,50)-marketNumber(a.ovr,50)).slice(0,11);
        if (top.length) {
          const currentPower = clubPowerForMarket(club);
          const basePowerValue = marketNumber(club.basePower, currentPower);
          const basePower = basePowerValue > 0 ? basePowerValue : currentPower;
          club.power = clamp(Math.round(basePower * 0.7
            + avg(top.map(player=>marketNumber(player.ovr,50))) * 0.3), 35, 97);
        }
      }
      const report = world.marketReports && world.marketReports[0];
      if (report && marketNumber(report.season, NaN) === seasonNumber) {
        report.moves = marketNumber(report.moves || 0, 0) + signed.length;
        report.transferIds = signed.map(row => row.id).concat(Array.isArray(report.transferIds) ? report.transferIds : []);
        report.summary = String(report.summary || "") + " تم التعاقد مع " + signed.length + " لاعبًا حرًا بعد انتهاء عقودهم.";
      }
    }
    signed.forEach(move => {
      transaction.captureTransferClubHistory(move.playerId);
      base.rememberTransferClubEndpoints(world, move);
    });
    return signed;
    });
  }
  function completeSeason(save, season, db) {
    const world = base.ensureState(save, db);
    const year = Math.max(1, int(season, int(save.season, 1)));
    const stableCurrentSeason = Math.max(1, int(world.currentSeason, int(save.season, 1)));
    const alreadyCompleted = Array.isArray(world.completedSeasons) && world.completedSeasons.includes(year);
    // Do not fabricate an older season from today's squads when a stale completion request arrives.
    if (stableCurrentSeason > year && !alreadyCompleted) {
      const market = (world.marketReports || []).find(row => Number(row.season) === year) || {};
      return {
        season: stableCurrentSeason, rows: [], tables: {}, matches: [], competitions: [],
        alreadyCompleted: true, staleRequest: true, transfers: Number(market.moves) || 0
      };
    }
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
      // Once detailed fixtures are pruned, only a saved standings snapshot is authoritative.
      // Never rebuild a completed historical table from clubs' current divisions.
      const storedTables = world.leagueTables && world.leagueTables[String(year)] || {};
      const snapshot = storedTables[String(leagueId)];
      return Array.isArray(snapshot) ? snapshot.slice() : [];
    }
    const sim = simulateLeagueSeason(save, year, db);
    return (sim.tables[String(leagueId)] || []).slice();
  }
  function getDivisionTable(save, leagueId, division, season, db) {
    const world = base.ensureState(save, db);
    const year = Math.max(1, int(season, int(save.season, 1)));
    const divisionNumber = Math.max(1, int(division, 1));
    const tableKey = divisionNumber === 1 ? String(leagueId) : String(leagueId) + ":" + divisionNumber;
    const completed = world.completedSeasons && world.completedSeasons.includes(year);
    const hasSavedMatches = world.matchesBySeason
      && Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year));
    if (completed && !hasSavedMatches) {
      // The simulator keeps recent standings longer than detailed fixtures. Preserve
      // historical division tables rather than returning an empty table after pruning.
      const storedTables = world.leagueTables && world.leagueTables[String(year)] || {};
      return (storedTables[tableKey] || []).slice();
    }
    const sim = simulateLeagueSeason(save, year, db);
    return (sim.tables[tableKey] || []).slice();
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
    const lastAdvancedTo = Math.max(0, int(world.lastAdvancedTo, 0));
    const currentSeason = Math.max(1, int(world.currentSeason, 1));
    // A stale request must never replay a market for an older season.
    if (lastAdvancedTo > next || currentSeason > next) return base.advanceToSeason(save, next, db);

    const alreadyAdvancedToNext = lastAdvancedTo === next;
    const previous = Math.max(1, next - 1);
    let promotions = [];
    if (!alreadyAdvancedToNext) {
      completeSeason(save, previous, db);
      promotions = applyPromotionRelegation(world, previous, db);
    }

    const transition = base.advanceToSeason(save, next, db);
    if (promotions.length) transition.promotions = promotions;

    // The paid market commits before free-agent recruitment. If the latter fails,
    // the world season is already advanced; retry that unfinished phase from the
    // saved paid-move IDs instead of silently treating the whole transition as done.
    const lastFreeAgentMarketSeason = Math.max(0, int(world.lastFreeAgentMarketSeason, 0));
    if (lastFreeAgentMarketSeason < next) {
      let paidMoves = Array.isArray(transition.moves) ? transition.moves.slice() : [];
      if (transition.alreadyAdvanced) {
        const report = (world.marketReports || []).find(row => Number(row && row.season) === next);
        const paidIds = new Set(Array.isArray(report && report.transferIds)
          ? report.transferIds.map(id => String(id || "")) : []);
        paidMoves = (world.transfers || []).filter(move => move
          && Number(move.season) === next && paidIds.has(String(move.id || "")));
      }
      const freeAgentMoves = signFreeAgents(world, next, paidMoves);
      if (freeAgentMoves.length) {
        world.projectionRevision = Math.max(0, int(world.projectionRevision, 0)) + 1;
        const nextKey = String(next);
        const nextSeasonAlreadyCompleted = (Array.isArray(world.completedSeasons)
          && world.completedSeasons.some(value => Number(value) === next))
          || Math.max(0, int(world.lastCompletedSeason, 0)) >= next;
        if (!nextSeasonAlreadyCompleted) {
          // A dashboard can materialize the new season while a failed free-agent phase
          // is awaiting retry. Discard only that unfinished snapshot so signings enter
          // the regenerated fixtures, tables, competitions, and player statistics.
          ["matchesBySeason", "seasonStats", "leagueTables", "competitionsBySeason"].forEach(field => {
            const collection = world[field];
            if (collection && typeof collection === "object" && !Array.isArray(collection)) {
              delete collection[nextKey];
            }
          });
        }
      }
      world.lastFreeAgentMarketSeason = next;
      transition.moves = paidMoves.concat(freeAgentMoves);
      if (freeAgentMoves.length) {
        world.notes = Array.isArray(world.notes) ? world.notes : [];
        world.notes.unshift({ season: next, type: "free-agent-market",
          text: "وقّعت الأندية مع " + freeAgentMoves.length + " لاعبًا حرًا بعد انتهاء عقودهم." });
      }
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
      String(save.leagueCountry || ""), String(save.clubName || ""), int(save.leagueDivision, 0),
      int(world.dbVersion, 0), int(world.projectionRevision, 0),
      int(world.rosterSchemaVersion, 0), int(world.rosterMembershipSchemaVersion, 0),
      int(world.lastAdvancedTo, 0), int(world.lastCompletedSeason, 0),
      Object.keys(world.clubs || {}).length,
      Object.keys(world.players || {}).length, (world.completedSeasons || []).length,
      Object.keys(matchesBySeason).length, Array.isArray(currentMatches) ? currentMatches.length : -1,
      Array.isArray(currentCompetitions) ? currentCompetitions.length : -1,
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
    output.freeAgentCount = Object.values(world.players || {}).filter(player => player && base.isTrueFlag(player.freeAgent)).length;
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
      return Object.values(world.players).filter(player => player && !base.isTrueFlag(player.retired) && base.isTrueFlag(player.freeAgent)).map(player => ({
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
  function getStateStoreRevision() {
    const store = global.LWStateStore;
    if (!store || typeof store.getRevision !== "function") return null;
    const revision = Number(store.getRevision());
    return Number.isFinite(revision) ? revision : null;
  }
  function getCurrentCareerState() {
    const store = global.LWStateStore;
    return store && typeof store.getState === "function" ? store.getState() : null;
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
    failed.forEach(request => {
      const currentRevision = getStateStoreRevision();
      const revisionChanged = request.revision !== currentRevision
        && (request.revision !== null || currentRevision !== null);
      if (revisionChanged) {
        const staleError = new Error("World worker failed after the career state changed");
        staleError.code = "LW_WORLD_WORKER_STALE_SAVE";
        request.reject(staleError);
      } else {
        request.reject(error);
      }
    });
  }

  function getWorldWorker() {
    if (sharedWorldWorker) return sharedWorldWorker;
    const worker = new global.Worker("./football-world-worker.js?v=75");
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
        const currentRevision = getStateStoreRevision();
        const revisionChanged = request.revision !== currentRevision
          && (request.revision !== null || currentRevision !== null);
        if (revisionChanged) {
          const staleError = new Error("World worker result superseded by a newer career state");
          staleError.code = "LW_WORLD_WORKER_STALE_SAVE";
          request.reject(staleError);
        } else if (!msg.ok) {
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
    const currentRevision = getStateStoreRevision();
    const latestState = getCurrentCareerState();
    // The shared store is the authoritative career object. A caller may still hold
    // an older object even when its captured revision happens to match the store.
    if (latestState && typeof latestState === "object") request.save = latestState;
    request.revision = currentRevision;
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
      worldWorkerQueue.push({ command, save, data: data || {}, resolve, reject, revision: getStateStoreRevision() });
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
    const payload = data || {};
    return workerRequest(command, save, payload).catch(error => {
      const store = global.LWStateStore;
      const latestState = getCurrentCareerState();
      const target = latestState && typeof latestState === "object" ? latestState : save;
      // Worker failures are not proof that the input snapshot is still current.
      // Always recover against the store's latest career object when one exists.
      return asyncFallback(command, target, payload, db).then(result => {
        if (store && typeof store.publish === "function"
          && (!store.getState || store.getState() === target)) {
          store.publish(target, {
            source: "world-worker-fallback",
            command,
            stale: !!(error && error.code === "LW_WORLD_WORKER_STALE_SAVE")
          });
        }
        return result;
      });
    });
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
