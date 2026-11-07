/* Living football-world simulation for LAST WHISTLE.
 * Club recruitment, player progression, standings and statistics are deterministic and persisted in the career save.
 * All ratings and future statistics are simulation estimates, not official live football data.
 */
(function (global) {
  "use strict";
  const VERSION = 1;
  const ROSTER_MEMBERSHIP_SCHEMA_VERSION = 6;
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
  function hasCompletedSeasonMarker(world, season) {
    return Array.isArray(world && world.completedSeasons)
      && world.completedSeasons.some(value => safeNumber(value, NaN) === season);
  }
  // Keep malformed legacy markers inert and intact without letting them coerce during sort
  // or consume the 20-valid-season retention window.
  function sortCompletedSeasonMarkers(values) {
    const valid = [];
    const invalid = [];
    (Array.isArray(values) ? values : []).forEach((value, index) => {
      const numeric = safeNumber(value, NaN);
      if (Number.isSafeInteger(numeric) && numeric >= 1) valid.push({ value, numeric, index });
      else invalid.push({ value, index });
    });
    valid.sort((a, b) => a.numeric - b.numeric || a.index - b.index);
    return valid.slice(-20).map(entry => entry.value).concat(invalid.map(entry => entry.value));
  }
  const clamp = (value, min, max) => Math.max(min, Math.min(max, safeNumber(value, 0)));
  const int = (value, fallback = 0) => Math.round(
    value === null || (typeof value === "string" && value.trim() === "") ? 0 : safeNumber(value, fallback)
  );
  function normalizeClubDivision(value, missingFallback = 1) {
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      return missingFallback;
    }
    if (typeof value !== "number" && typeof value !== "string") return 0;
    const numeric = typeof value === "string" ? Number(value.trim()) : value;
    return Number.isSafeInteger(numeric) && numeric >= 1 ? numeric : 0;
  }
  const divisionForClub = club => {
    if (!club || typeof club !== "object") return 0;
    try { return normalizeClubDivision(club.division, 1); } catch (_) { return 0; }
  };
  function safeWorldIdentifier(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  }
  function safeWorldRecordIdentifier(record, field) {
    try { return safeWorldIdentifier(record && record[field]); } catch (_) { return ""; }
  }
  function safeWorldText(value) {
    if (typeof value === "string") return value.trim();
    return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  }
  function safeWorldRecordText(record, field) {
    try { return safeWorldText(record && record[field]); } catch (_) { return ""; }
  }
  function safeWorldOwnValue(record, key) {
    try {
      if (!record || typeof record !== "object" || !Object.prototype.hasOwnProperty.call(record, key)) return undefined;
      return record[key];
    } catch (_) { return undefined; }
  }
  function safeWorldSchemaVersion(world) {
    const value = safeWorldOwnValue(world, "schemaVersion");
    // Only finite primitive numeric values participate in version comparison.
    // Invalid strings and non-finite numbers are metadata noise, not proof that the
    // saved world is incompatible; preserve the existing player and club data.
    if (typeof value !== "number" && typeof value !== "string") return VERSION;
    const numericVersion = safeNumber(value, NaN);
    return Number.isFinite(numericVersion) ? numericVersion : VERSION;
  }
  function isFutureWorldSchema(world) {
    return safeWorldSchemaVersion(world) > VERSION;
  }
  function safeWorldObjectKeys(record) {
    try { return record && typeof record === "object" ? Object.keys(record) : []; } catch (_) { return []; }
  }
  function safeWorldArrayField(record, field) {
    try {
      const value = record && record[field];
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }
  function hasPendingClubRosterRecovery(world, clubId) {
    const id = safeWorldIdentifier(clubId);
    if (!id) return false;
    const recoveryKey = "clubRoster:" + id;
    for (const bucketName of ["legacyRecoveryData", "legacyRecoveryDataFallback"]) {
      const bucket = safeWorldOwnValue(world, bucketName);
      if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) continue;
      try {
        if (Object.prototype.hasOwnProperty.call(bucket, recoveryKey)) return true;
      } catch (_) {}
    }
    return false;
  }
  function prepareClubRosterRecovery(world) {
    const clubs = safeWorldOwnValue(world, "clubs");
    if (!clubs || typeof clubs !== "object" || Array.isArray(clubs)) return false;
    const malformedRosters = [];
    for (const key of safeWorldObjectKeys(clubs)) {
      const club = safeWorldOwnValue(clubs, key);
      if (!club || typeof club !== "object" || Array.isArray(club)) continue;
      const clubId = safeWorldClubIdentifier(club, key);
      if (!clubId) continue;
      const savedRoster = safeWorldOwnValue(club, "roster");
      if (savedRoster !== undefined && !Array.isArray(savedRoster)) {
        malformedRosters.push({ club, clubId, value: savedRoster });
      }
    }
    // Preserve every malformed payload before replacing any of the active fields.
    for (const item of malformedRosters) {
      if (!preserveMalformedWorldField(world, "clubRoster:" + item.clubId, item.value)) return false;
    }
    for (const item of malformedRosters) {
      if (!safeWorldTrySetOwnValue(item.club, "roster", [])) return false;
    }
    return true;
  }
  function safeWorldSetField(record, field, value) {
    try {
      if (!record || typeof record !== "object") return false;
      record[field] = value;
      return true;
    } catch (_) { return false; }
  }
  function safeWorldSetOwnValue(record, key, value) {
    if (!record || typeof record !== "object") throw new TypeError("A transfer-history record is required");
    if (key === "__proto__") {
      Object.defineProperty(record, key, { value, writable: true, enumerable: true, configurable: true });
    } else {
      record[key] = value;
    }
    return true;
  }
  function safeWorldTrySetOwnValue(record, key, value) {
    try { return safeWorldSetOwnValue(record, key, value) === true; } catch (_) { return false; }
  }
  // Use the primary recovery bucket when possible, then a fallback bucket if the
  // primary itself is malformed or read-only. Never overwrite either original bucket.
  function getWorldRecoveryBucket(world, fieldName) {
    let bucket = safeWorldOwnValue(world, fieldName);
    if (bucket === undefined) {
      bucket = {};
      if (!safeWorldTrySetOwnValue(world, fieldName, bucket)) return null;
    }
    if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) return null;
    try { if (!Object.isExtensible(bucket)) return null; } catch (_) { return null; }
    return bucket;
  }
  function preserveRecoveryEntry(bucket, field, value) {
    let hasExisting = false;
    try { hasExisting = Object.prototype.hasOwnProperty.call(bucket, field); } catch (_) { return false; }
    if (!hasExisting) return safeWorldTrySetOwnValue(bucket, field, value);
    const existing = safeWorldOwnValue(bucket, field);
    if (existing === undefined || existing === value) return safeWorldTrySetOwnValue(bucket, field, value);
    if (Array.isArray(existing)) {
      if (existing.includes(value)) return true;
      return safeWorldTrySetOwnValue(bucket, field, existing.concat([value]));
    }
    return safeWorldTrySetOwnValue(bucket, field, [existing, value]);
  }
  function preserveMalformedWorldField(world, field, value) {
    if (value === undefined) return true;
    const primary = getWorldRecoveryBucket(world, "legacyRecoveryData");
    if (primary && preserveRecoveryEntry(primary, field, value)) return true;
    const fallback = getWorldRecoveryBucket(world, "legacyRecoveryDataFallback");
    if (!fallback) return false;
    const originalRecovery = safeWorldOwnValue(world, "legacyRecoveryData");
    if (originalRecovery !== undefined) {
      let hasPrevious = false;
      try { hasPrevious = Object.prototype.hasOwnProperty.call(fallback, "previousRecoveryData"); } catch (_) { return false; }
      if (!hasPrevious) {
        if (!safeWorldTrySetOwnValue(fallback, "previousRecoveryData", originalRecovery)) return false;
      } else {
        const previous = safeWorldOwnValue(fallback, "previousRecoveryData");
        if (previous !== originalRecovery) {
          const combined = Array.isArray(previous) ? previous.concat([originalRecovery]) : [previous, originalRecovery];
          if (!safeWorldTrySetOwnValue(fallback, "previousRecoveryData", combined)) return false;
        }
      }
    }
    return preserveRecoveryEntry(fallback, field, value);
  }
  function normalizeWorldArrayField(world, field) {
    const value = safeWorldOwnValue(world, field);
    if (Array.isArray(value)) return true;
    if (value !== undefined && !preserveMalformedWorldField(world, field, value)) return false;
    return safeWorldTrySetOwnValue(world, field, []);
  }
  function normalizeWorldMapField(world, field, rejectArrays = false) {
    const value = safeWorldOwnValue(world, field);
    if (value && typeof value === "object" && (!rejectArrays || !Array.isArray(value))) return true;
    if (value !== undefined && !preserveMalformedWorldField(world, field, value)) return false;
    return safeWorldTrySetOwnValue(world, field, {});
  }
  function safeWorldClubIdentifierForWorld(world, club) {
    if (!club || typeof club !== "object") return "";
    let value;
    try { value = club.id; } catch (_) { return ""; }
    const missing = value === undefined || value === null
      || (typeof value === "string" && value.trim() === "");
    if (!missing) return safeWorldIdentifier(value);
    const clubs = safeWorldOwnValue(world, "clubs");
    for (const key of safeWorldObjectKeys(clubs)) {
      if (safeWorldOwnValue(clubs, key) === club) return safeWorldIdentifier(key);
    }
    return "";
  }
  function safeWorldClubIdentifier(club, fallbackKey) {
    if (!club || typeof club !== "object") return "";
    try {
      const value = club.id;
      if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
        return safeWorldIdentifier(fallbackKey);
      }
      return safeWorldIdentifier(value);
    } catch (_) { return ""; }
  }
  function safeWorldLeagueIdentifier(club) {
    try { return safeWorldIdentifier(club && club.leagueId); } catch (_) { return ""; }
  }
  function worldLeagueClubEntries(world) {
    const source = world && world.clubs;
    if (!source || typeof source !== "object" || Array.isArray(source)) return [];
    let rows;
    try { rows = Object.entries(source); } catch (_) { return []; }
    const byId = new Map();
    for (const [key, club] of rows) {
      if (!club || typeof club !== "object") continue;
      const clubId = safeWorldClubIdentifier(club, key);
      const leagueId = safeWorldLeagueIdentifier(club);
      if (!clubId || !leagueId) continue;
      const division = divisionForClub(club);
      if (division < 1) continue;
      const entry = { key, club, clubId, leagueId, division };
      const current = byId.get(clubId);
      if (!current || (key === clubId && current.key !== current.clubId)) byId.set(clubId, entry);
    }
    return Array.from(byId.values());
  }
  function supportedWorldLeagueIds(db) {
    const supported = new Set();
    if (!db || typeof db.leagues !== "function") return supported;
    let profiles = [];
    try { profiles = db.leagues(); } catch (_) { return supported; }
    for (const profile of Array.isArray(profiles) ? profiles : []) {
      let id = "";
      try { id = safeWorldIdentifier(profile && profile.id); } catch (_) {}
      if (id) supported.add(id);
    }
    return supported;
  }
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
  function syncClubDivisionMetadata(world, club, division, db, sourceRow, clubIdOverride) {
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
    const safeIdentifier = value => {
      if (typeof value === "string") return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      return "";
    };
    const clubId = safeIdentifier(clubIdOverride) || safeIdentifier(club.id);
    if (clubId) {
      Object.values(world && world.players || {}).forEach(player => {
        if (player && safeIdentifier(player.clubId) === clubId) player.division = tier;
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
  function positiveClubPower(club) {
    const savedPower = safeNumber(club && club.power, 0);
    if (savedPower > 0) return savedPower;
    const basePower = safeNumber(club && club.basePower, 0);
    return basePower > 0 ? basePower : 0;
  }
  function marketClubPower(club, fallback = 55) {
    const power = positiveClubPower(club);
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
    if (!world || typeof world !== "object") return null;
    let hasArchive = false;
    try { hasArchive = Object.prototype.hasOwnProperty.call(world, "archive"); } catch (_) { return null; }
    let archive = safeWorldOwnValue(world, "archive");
    if (!hasArchive) {
      archive = emptyArchive();
      if (!safeWorldTrySetOwnValue(world, "archive", archive)) return null;
    } else if (!archive || typeof archive !== "object" || Array.isArray(archive)) {
      // A malformed archive may still contain irreplaceable legacy data. Do not
      // replace it with an empty object and continue a destructive reconciliation.
      return null;
    }
    for (const key of ["clubs", "players", "playerHistory", "seasonStats", "leagueTables", "leagueTableRows", "matchesBySeason", "competitionsBySeason"]) {
      let hasBucket = false;
      try { hasBucket = Object.prototype.hasOwnProperty.call(archive, key); } catch (_) { return null; }
      const bucket = safeWorldOwnValue(archive, key);
      if (!hasBucket) {
        if (!safeWorldTrySetOwnValue(archive, key, {})) return null;
        continue;
      }
      if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) return null;
      // Archive maps must be able to accept new keys. A frozen/sealed bucket
      // cannot safely receive removed clubs or player records.
      try { if (!Object.isExtensible(bucket)) return null; } catch (_) { return null; }
    }
    return archive;
  }
  function archiveGeneratedPlayerBeforeRosterReplacement(world, player, playerMapKey) {
    // The players-map key and club roster entry are authoritative. A legacy internal
    // ID is usable as an alias only when it is unique across active and archived players.
    const playerId = safeWorldIdentifier(playerMapKey) || safeWorldRecordIdentifier(player, "id");
    if (!world || !playerId || !player || typeof player !== "object") return false;
    const players = safeWorldOwnValue(world, "players");
    const playerMapKeys = safeWorldObjectKeys(players);
    const archive = ensureArchive(world);
    const archivedPlayers = safeWorldOwnValue(archive, "players");
    const existingArchivedPlayer = safeWorldOwnValue(archivedPlayers, playerId);
    if (existingArchivedPlayer !== undefined && existingArchivedPlayer !== player) return false;

    const internalPlayerId = safeWorldRecordIdentifier(player, "id");
    let internalPlayerIdCount = 0;
    const countInternalPlayerIds = source => {
      for (const key of safeWorldObjectKeys(source)) {
        const candidate = safeWorldOwnValue(source, key);
        if (!candidate || candidate === player) continue;
        if (safeWorldRecordIdentifier(candidate, "id") === internalPlayerId) internalPlayerIdCount++;
      }
    };
    if (internalPlayerId && internalPlayerId !== playerId) {
      for (const key of playerMapKeys) {
        const candidate = safeWorldOwnValue(players, key);
        if (safeWorldRecordIdentifier(candidate, "id") === internalPlayerId) internalPlayerIdCount++;
      }
      countInternalPlayerIds(archivedPlayers);
    }
    const hasUniqueLegacyAlias = !!internalPlayerId && internalPlayerId !== playerId
      && internalPlayerIdCount === 1
      && !playerMapKeys.includes(internalPlayerId)
      && !safeWorldOwnValue(archivedPlayers, internalPlayerId);
    const playerIdentityIds = new Set([playerId]);
    const historyKeys = [playerId];
    if (hasUniqueLegacyAlias) {
      playerIdentityIds.add(internalPlayerId);
      historyKeys.push(internalPlayerId);
    }

    const mergeRows = (existingRows, sourceRows) => {
      if (existingRows !== undefined && !Array.isArray(existingRows)) return null;
      const mergedRows = Array.isArray(existingRows) ? existingRows.slice() : sourceRows.slice();
      sourceRows.forEach(row => {
        if (!mergedRows.includes(row)) mergedRows.push(row);
      });
      return mergedRows;
    };

    // Preflight every archive destination before changing active player/history/stats.
    const playerHistory = safeWorldOwnValue(world, "playerHistory");
    let historySourceRows = null;
    for (const key of historyKeys) {
      const historyRows = safeWorldOwnValue(playerHistory, key);
      if (historyRows === undefined) continue;
      if (!Array.isArray(historyRows)) return false;
      if (!historySourceRows) historySourceRows = historyRows.slice();
      else historyRows.forEach(row => {
        if (!historySourceRows.includes(row)) historySourceRows.push(row);
      });
    }
    const existingArchivedHistory = safeWorldOwnValue(archive.playerHistory, playerId);
    const mergedHistory = historySourceRows && historySourceRows.length
      ? mergeRows(existingArchivedHistory, historySourceRows) : null;
    if (historySourceRows && historySourceRows.length && !mergedHistory) return false;

    const seasonStats = safeWorldOwnValue(world, "seasonStats");
    const seasonUpdates = [];
    for (const season of safeWorldObjectKeys(seasonStats)) {
      const rows = safeWorldOwnValue(seasonStats, season);
      if (!Array.isArray(rows)) continue;
      const archivedRows = rows.filter(row => {
        if (!row || typeof row !== "object") return false;
        return playerIdentityIds.has(safeWorldRecordIdentifier(row, "id"))
          || playerIdentityIds.has(safeWorldRecordIdentifier(row, "playerId"));
      });
      if (!archivedRows.length) continue;
      const existingRows = safeWorldOwnValue(archive.seasonStats, season);
      const mergedRows = mergeRows(existingRows, archivedRows);
      if (!mergedRows) return false;
      seasonUpdates.push({ season, rows, archivedRows, mergedRows });
    }

    const transferHistory = safeWorldOwnValue(world, "transferClubHistoryByPlayer");
    let mergedTransferRows = null;
    if (hasUniqueLegacyAlias && transferHistory && typeof transferHistory === "object"
      && !Array.isArray(transferHistory)) {
      const legacyTransferRows = safeWorldOwnValue(transferHistory, internalPlayerId);
      if (legacyTransferRows !== undefined) {
        if (!Array.isArray(legacyTransferRows)) return false;
        const canonicalTransferRows = safeWorldOwnValue(transferHistory, playerId);
        if (canonicalTransferRows !== undefined && !Array.isArray(canonicalTransferRows)) return false;
        mergedTransferRows = Array.isArray(canonicalTransferRows)
          ? canonicalTransferRows.slice() : legacyTransferRows.slice();
        legacyTransferRows.forEach(endpoint => {
          const endpointId = safeWorldRecordIdentifier(endpoint, "clubId");
          const endpointName = normalize(safeWorldRecordText(endpoint, "name"));
          const endpointCountry = normalize(safeWorldRecordText(endpoint, "country"));
          const duplicate = mergedTransferRows.some(existing => {
            const existingId = safeWorldRecordIdentifier(existing, "clubId");
            if (endpointId && existingId) return endpointId === existingId;
            return !!endpointName
              && normalize(safeWorldRecordText(existing, "name")) === endpointName
              && normalize(safeWorldRecordText(existing, "country")) === endpointCountry;
          });
          if (!duplicate) mergedTransferRows.push(endpoint);
        });
      }
    }

    if (!safeWorldTrySetOwnValue(archive.players, playerId, player)) return false;
    if (mergedHistory && !safeWorldTrySetOwnValue(archive.playerHistory, playerId, mergedHistory)) return false;
    for (const update of seasonUpdates) {
      if (!safeWorldTrySetOwnValue(archive.seasonStats, update.season, update.mergedRows)) return false;
    }
    if (mergedTransferRows && !safeWorldTrySetOwnValue(transferHistory, playerId, mergedTransferRows)) return false;

    // Keep live records until the caller confirms that the player was removed.
    // A failed roster write or non-configurable player key must not strand an active
    // player without the career history and season statistics it still owns.
    return {
      historyKeys,
      seasonUpdates,
      transferAlias: mergedTransferRows ? internalPlayerId : ""
    };
  }
  function removeArchivedGeneratedPlayerLiveRecords(world, archivePlan) {
    if (!world || !archivePlan) return false;
    const playerHistory = safeWorldOwnValue(world, "playerHistory");
    for (const key of Array.isArray(archivePlan.historyKeys) ? archivePlan.historyKeys : []) {
      if (!playerHistory || typeof playerHistory !== "object"
        || safeWorldOwnValue(playerHistory, key) === undefined) continue;
      try { delete playerHistory[key]; } catch (_) {}
    }
    const transferAlias = safeWorldIdentifier(archivePlan.transferAlias);
    const transferHistory = safeWorldOwnValue(world, "transferClubHistoryByPlayer");
    if (transferAlias && transferHistory && typeof transferHistory === "object" && !Array.isArray(transferHistory)) {
      try { delete transferHistory[transferAlias]; } catch (_) {}
    }
    const seasonStats = safeWorldOwnValue(world, "seasonStats");
    for (const update of Array.isArray(archivePlan.seasonUpdates) ? archivePlan.seasonUpdates : []) {
      const rows = safeWorldOwnValue(seasonStats, update.season);
      if (!Array.isArray(rows)) continue;
      safeWorldTrySetOwnValue(seasonStats, update.season,
        rows.filter(row => !update.archivedRows.includes(row)));
    }
    return true;
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
    const key = safeWorldIdentifier(playerId);
    if (!world || !key) return;
    const endpointId = safeWorldIdentifier(clubId);
    const clubName = safeWorldText(name);
    const countryName = safeWorldText(country);
    if (!endpointId && !clubName) return;

    let history = safeWorldOwnValue(world, "transferClubHistoryByPlayer");
    if (!history || typeof history !== "object" || Array.isArray(history)) {
      history = {};
      if (!safeWorldSetField(world, "transferClubHistoryByPlayer", history)) return;
    }
    let rows = safeWorldOwnValue(history, key);
    if (!Array.isArray(rows)) {
      rows = [];
      if (!safeWorldSetOwnValue(history, key, rows)) return;
    }
    const duplicate = rows.find(row => {
      if (!row || typeof row !== "object") return false;
      const existingId = safeWorldRecordIdentifier(row, "clubId");
      if (endpointId && existingId) return existingId === endpointId;
      return clubName && normalize(safeWorldRecordText(row, "name")) === normalize(clubName)
        && normalize(safeWorldRecordText(row, "country")) === normalize(countryName);
    });
    if (duplicate) {
      if (endpointId && !safeWorldRecordIdentifier(duplicate, "clubId")) {
        safeWorldSetOwnValue(duplicate, "clubId", endpointId);
      }
      if (clubName && !safeWorldRecordText(duplicate, "name")) {
        safeWorldSetOwnValue(duplicate, "name", clubName);
      }
      if (countryName && !safeWorldRecordText(duplicate, "country")) {
        safeWorldSetOwnValue(duplicate, "country", countryName);
      }
      return;
    }
    rows.push({ clubId: endpointId, name: clubName, country: countryName });
  }
  function ensureTransferClubHistory(world) {
    if (!world || typeof world !== "object") return {};
    const currentHistory = safeWorldOwnValue(world, "transferClubHistoryByPlayer");
    const hasHistory = currentHistory && typeof currentHistory === "object" && !Array.isArray(currentHistory);
    const history = hasHistory ? currentHistory : {};
    if (!hasHistory) {
      if (currentHistory !== undefined && !preserveMalformedWorldField(world, "transferClubHistoryByPlayer", currentHistory)) return {};
      if (!safeWorldTrySetOwnValue(world, "transferClubHistoryByPlayer", history)) return {};
    }
    const schemaVersion = safeNumber(safeWorldOwnValue(world, "transferClubHistorySchemaVersion"), 0);
    if (hasHistory && schemaVersion >= 1) return history;

    const importTransfer = transfer => {
      if (!transfer || typeof transfer !== "object" || Array.isArray(transfer)) return;
      const playerId = safeWorldRecordIdentifier(transfer, "playerId");
      if (!playerId) return;
      addTransferClubHistoryEndpoint(world, playerId,
        safeWorldRecordIdentifier(transfer, "fromClubId"),
        safeWorldRecordText(transfer, "from"),
        safeWorldRecordText(transfer, "fromCountry"));
      addTransferClubHistoryEndpoint(world, playerId,
        safeWorldRecordIdentifier(transfer, "toClubId"),
        safeWorldRecordText(transfer, "to"),
        safeWorldRecordText(transfer, "toCountry"));
    };
    safeWorldArrayField(world, "transfers").forEach(importTransfer);

    const importPlayerHistory = playerHistory => {
      if (!playerHistory || typeof playerHistory !== "object" || Array.isArray(playerHistory)) return;
      for (const playerId of safeWorldObjectKeys(playerHistory)) {
        const entries = safeWorldOwnValue(playerHistory, playerId);
        if (!Array.isArray(entries)) continue;
        entries.forEach(entry => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
          addTransferClubHistoryEndpoint(world, playerId,
            safeWorldRecordIdentifier(entry, "fromClubId"),
            safeWorldRecordText(entry, "from"),
            safeWorldRecordText(entry, "fromCountry"));
          addTransferClubHistoryEndpoint(world, playerId,
            safeWorldRecordIdentifier(entry, "clubId"),
            safeWorldRecordText(entry, "club"),
            safeWorldRecordText(entry, "country"));
        });
      }
    };
    importPlayerHistory(safeWorldOwnValue(world, "playerHistory"));
    const archive = safeWorldOwnValue(world, "archive");
    importPlayerHistory(safeWorldOwnValue(archive, "playerHistory"));
    safeWorldSetOwnValue(world, "transferClubHistorySchemaVersion", 1);
    return history;
  }
  function rememberTransferClubEndpoints(world, transfer) {
    if (!world || !transfer || typeof transfer !== "object" || Array.isArray(transfer)
      || isFutureWorldSchema(world)) return;
    ensureTransferClubHistory(world);
    const playerId = safeWorldRecordIdentifier(transfer, "playerId");
    if (!playerId) return;
    addTransferClubHistoryEndpoint(world, playerId,
      safeWorldRecordIdentifier(transfer, "fromClubId"),
      safeWorldRecordText(transfer, "from"),
      safeWorldRecordText(transfer, "fromCountry"));
    addTransferClubHistoryEndpoint(world, playerId,
      safeWorldRecordIdentifier(transfer, "toClubId"),
      safeWorldRecordText(transfer, "to"),
      safeWorldRecordText(transfer, "toCountry"));
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
    const clubId = safeWorldClubIdentifierForWorld(world, club);
    if (!clubId) return null;
    const rng = random(hash(clubId + "|" + (row && row.name || "academy") + "|" + index + "|" + VERSION));
    let position = String(row && row.position || "");
    if (!position || normalizePosition(position).includes("غيرمحدد")) position = pickPosition(forcedGroup || "midfielder", rng);
    const group = groupForPosition(position);
    const ovr = clamp(row && (row.ovr || row.power) || marketClubPower(club) - 5 + Math.round(rng() * 9 - 5), 38, 96);
    const age = Math.max(16, Math.min(37, int(row && row.age, 18 + Math.floor(rng() * 15))));
    const sourceIdentity = sourcePlayerIdentityKey({ name: row && row.name, position, age });
    const id = generated
      ? "academy-" + hash(clubId + "|" + index + "|" + (row && row.name || "player")).toString(36)
      : "player-" + hash(clubId + "|" + (sourceIdentity || index)).toString(36);
    if (world.players[id]) return world.players[id];
    if (hasPendingClubRosterRecovery(world, clubId)) return null;
    const player = {
      id, name: String(row && row.name || (club.name + " • ناشئ " + String(index + 1).padStart(2, "0"))),
      clubId, country: club.country, leagueId: club.leagueId, division: club.division,
      position, group, ovr, potential: clamp(row && row.potential || ovr + 3 + Math.floor(rng() * 18), ovr, 97),
      age, prestige: club.prestige, contractSeasons: 1 + Math.floor(rng() * 5),
      isGenerated: !!generated || !!(row && row.isRealPlayer === false), isRealPlayer: !generated && !!row && row.isRealPlayer !== false,
      lastRating: 0, transferListed: false
    };
    world.players[id] = player;
    if (!Array.isArray(club.roster)) club.roster = [];
    club.roster.push(id);
    return player;
  }
  function activeRosterIds(world, club, fallbackClubId) {
    const seen = new Set();
    const clubId = fallbackClubId
      ? safeWorldClubIdentifier(club, fallbackClubId)
      : safeWorldClubIdentifierForWorld(world, club);
    if (!clubId) return [];
    const players = safeWorldOwnValue(world, "players");
    if (!players || typeof players !== "object") return [];
    return safeWorldArrayField(club, "roster").filter(id => {
      const key = safeWorldIdentifier(id);
      if (!key || seen.has(key)) return false;
      const player = safeWorldOwnValue(players, key);
      if (!player || typeof player !== "object") return false;
      let retired = false, freeAgent = false;
      try {
        retired = isTrueFlag(player.retired);
        freeAgent = isTrueFlag(player.freeAgent);
      } catch (_) { return false; }
      if (retired || freeAgent) return false;
      const ownerClubId = safeWorldRecordIdentifier(player, "clubId");
      if (ownerClubId && ownerClubId !== clubId) return false;
      seen.add(key);
      return true;
    });
  }
  function syncPlayerClubMetadata(player, club) {
    if (!player || !club) return;
    const country = safeWorldRecordText(club, "country");
    const leagueId = safeWorldRecordIdentifier(club, "leagueId");
    if (country) safeWorldSetField(player, "country", country);
    if (leagueId) safeWorldSetField(player, "leagueId", leagueId);
    const division = divisionForClub(club);
    // A corrupt explicit club tier must not overwrite a player's last known valid tier.
    if (division >= 1) safeWorldSetField(player, "division", division);
  }
  function normalizeRosterMembership(world) {
    if (!world || typeof world !== "object") return world;
    const clubs = safeWorldOwnValue(world, "clubs");
    const players = safeWorldOwnValue(world, "players");
    if (!clubs || typeof clubs !== "object" || Array.isArray(clubs)
      || !players || typeof players !== "object" || Array.isArray(players)) return world;

    if (!prepareClubRosterRecovery(world)) return false;
    const memberships = new Map();
    const clubEntries = [];
    const clubById = new Map();
    for (const key of safeWorldObjectKeys(clubs)) {
      const club = safeWorldOwnValue(clubs, key);
      if (!club || typeof club !== "object" || Array.isArray(club)) continue;
      const clubId = safeWorldClubIdentifier(club, key);
      if (!clubId) continue;
      const entry = { key, club, clubId };
      clubEntries.push(entry);
      const current = clubById.get(clubId);
      if (!current || (key === clubId && current.key !== current.clubId)) clubById.set(clubId, entry);
    }
    for (const entry of clubEntries) {
      const localSeen = new Set();
      for (const rosterId of safeWorldArrayField(entry.club, "roster")) {
        const playerId = safeWorldIdentifier(rosterId);
        if (!playerId || localSeen.has(playerId)) continue;
        localSeen.add(playerId);
        if (!memberships.has(playerId)) memberships.set(playerId, []);
        memberships.get(playerId).push(entry.clubId);
      }
    }

    const ambiguous = new Set();
    for (const id of safeWorldObjectKeys(players)) {
      const player = safeWorldOwnValue(players, id);
      if (!player || typeof player !== "object" || Array.isArray(player)) continue;
      let retired = false, freeAgent = false;
      try {
        // Legacy saves may encode boolean flags as strings; normalize before interpreting roster ownership.
        retired = isTrueFlag(player.retired);
        freeAgent = retired ? false : isTrueFlag(player.freeAgent);
        player.retired = retired;
        player.freeAgent = freeAgent;
      } catch (_) { continue; }

      const ownerClubId = safeWorldRecordIdentifier(player, "clubId");
      const candidates = Array.from(new Set(memberships.get(id) || [])).filter(Boolean);

      // Retirement/free agency is authoritative. Old roster references must never
      // resurrect an unattached player or turn a former club into their current club.
      if (retired || freeAgent) {
        const formerClubId = ownerClubId && clubById.has(ownerClubId)
          ? ownerClubId : candidates.length === 1 ? candidates[0] : "";
        if (formerClubId && !safeWorldRecordIdentifier(player, "previousClubId")) {
          safeWorldSetField(player, "previousClubId", formerClubId);
        }
        safeWorldSetField(player, "clubId", "");
        safeWorldSetField(player, "leagueId", "");
        safeWorldSetField(player, "division", 0);
        safeWorldSetField(player, "contractSeasons", 0);
        safeWorldSetField(player, "transferListed", false);
        if (retired) safeWorldSetField(player, "freeAgent", false);
        continue;
      }

      const ownerEntry = ownerClubId ? clubById.get(ownerClubId) : null;
      if (ownerEntry) {
        // The canonical owner is authoritative even when an interrupted save lost
        // the roster reference. Restore membership before any squad refill runs.
        const owner = ownerEntry.club;
        let roster = safeWorldArrayField(owner, "roster");
        if (!Array.isArray(safeWorldOwnValue(owner, "roster"))) {
          if (!safeWorldSetField(owner, "roster", [])) {
            syncPlayerClubMetadata(player, owner);
            continue;
          }
          roster = safeWorldArrayField(owner, "roster");
        }
        if (!roster.some(rosterId => safeWorldIdentifier(rosterId) === id)) {
          try { owner.roster.push(id); } catch (_) {}
        }
        syncPlayerClubMetadata(player, owner);
        continue;
      }

      if (candidates.length === 1) {
        const inferredClub = clubById.get(candidates[0]);
        if (inferredClub && safeWorldSetField(player, "clubId", candidates[0])) {
          syncPlayerClubMetadata(player, inferredClub.club);
        }
      } else if (candidates.length > 1) {
        // Keep the player record, but do not assign an ambiguous legacy player to two clubs.
        ambiguous.add(id);
      }
    }

    for (const entry of clubEntries) {
      const roster = activeRosterIds(world, entry.club, entry.clubId)
        .filter(id => !ambiguous.has(safeWorldIdentifier(id)));
      const currentRoster = safeWorldArrayField(entry.club, "roster");
      const unchanged = currentRoster.length === roster.length
        && currentRoster.every((id, index) => safeWorldIdentifier(id) === roster[index]);
      if (!unchanged && !safeWorldTrySetOwnValue(entry.club, "roster", roster)) return false;
    }
    return world;
  }
  function fillRoster(world, club) {
    const clubId = safeWorldClubIdentifierForWorld(world, club);
    if (!clubId) return;
    club.roster = activeRosterIds(world, club, clubId);
    // Do not invent replacement players while a malformed legacy roster awaits recovery.
    if (hasPendingClubRosterRecovery(world, clubId)) return;
    const minimum = 16;
    const counts = Object.fromEntries(Object.keys(TARGETS).map(key => [key, 0]));
    club.roster.forEach(id => {
      const player = safeWorldOwnValue(world && world.players, id);
      if (player) counts[player.group] = (counts[player.group] || 0) + 1;
    });
    while (club.roster.length < minimum) {
      const group = Object.keys(TARGETS).sort((a, b) =>
        counts[a] / TARGETS[a] - counts[b] / TARGETS[b] || counts[a] - counts[b] || a.localeCompare(b))[0];
      const index = world.nextGeneratedPlayer++;
      const rng = random(hash(clubId + "|" + index + "|" + world.dbVersion));
      const ovr = clamp(club.basePower - 8 + Math.round(rng() * 12 - 5), 38, 88);
      const row = { name: club.name + " • ناشئ " + String(index).padStart(3, "0"), position: pickPosition(group, rng), ovr, potential: clamp(ovr + 5 + Math.floor(rng() * 15), ovr, 96), age: 17 + Math.floor(rng() * 7) };
      const player = makePlayer(world, row, club, index, true, group);
      if (!player) break;
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
    const lastAdvancedTo = Math.max(0, int(safeWorldOwnValue(world, "lastAdvancedTo"), 0));
    const currentSeason = Math.max(1, int(safeWorldOwnValue(world, "currentSeason"), lastAdvancedTo || 1));
    const season = Math.max(1, currentSeason, lastAdvancedTo);
    const savedCompletedSeasons = safeWorldOwnValue(world, "completedSeasons");
    const completedSeasons = Array.isArray(savedCompletedSeasons) ? savedCompletedSeasons : [];
    if (completedSeasons.some(value => safeNumber(value, NaN) === season)
      || Math.max(0, int(safeWorldOwnValue(world, "lastCompletedSeason"), 0)) >= season) return false;
    const key = String(season);
    let invalidated = false;
    ["matchesBySeason", "seasonStats", "leagueTables", "competitionsBySeason"].forEach(field => {
      const collection = safeWorldOwnValue(world, field);
      if (!collection || typeof collection !== "object" || Array.isArray(collection)) return;
      if (Object.prototype.hasOwnProperty.call(collection, key)) {
        delete collection[key];
        invalidated = true;
      }
    });
    return invalidated;
  }
  function reconcileDatabase(world, db) {
    if (!world || typeof world !== "object" || Array.isArray(world)) return seedWorld(db);
    const archive = ensureArchive(world);
    if (!archive) return world;
    const savedClubs = safeWorldOwnValue(world, "clubs");
    if (savedClubs === undefined || savedClubs === null) {
      if (!safeWorldTrySetOwnValue(world, "clubs", {})) return world;
    } else if (typeof savedClubs !== "object" || Array.isArray(savedClubs)) {
      return world;
    }
    const savedPlayers = safeWorldOwnValue(world, "players");
    if (savedPlayers === undefined || savedPlayers === null) {
      if (!safeWorldTrySetOwnValue(world, "players", {})) return world;
    } else if (typeof savedPlayers !== "object" || Array.isArray(savedPlayers)) {
      return world;
    }
    const savedPlayerHistory = safeWorldOwnValue(world, "playerHistory");
    if (savedPlayerHistory === undefined || savedPlayerHistory === null) {
      if (!safeWorldTrySetOwnValue(world, "playerHistory", {})) return world;
    } else if (typeof savedPlayerHistory !== "object" || Array.isArray(savedPlayerHistory)) {
      return world;
    }
    // Preserve malformed roster payloads before any unsupported-club cleanup or
    // catalogue reconciliation can replace the only surviving player references.
    if (!prepareClubRosterRecovery(world)) return world;
    const transferClubHistoryByPlayer = ensureTransferClubHistory(world);
    // Unsupported competitions leave the active simulation, but their saved data is archived rather than destroyed.
    const supportedLeagueIds = supportedWorldLeagueIds(db);
    const removedClubIds = new Set();
    const removedPlayerIds = new Set();
    // Snapshot identity collisions before unsupported clubs/players are removed.
    // Otherwise deleting one colliding player can make another player's legacy ID
    // appear unique and incorrectly transfer the removed player's history.
    const internalPlayerIdCounts = new Map();
    const countInternalPlayerIds = players => {
      for (const key of safeWorldObjectKeys(players)) {
        const player = safeWorldOwnValue(players, key);
        const internalPlayerId = safeWorldRecordIdentifier(player, "id");
        if (!internalPlayerId) continue;
        internalPlayerIdCounts.set(internalPlayerId, (internalPlayerIdCounts.get(internalPlayerId) || 0) + 1);
      }
    };
    countInternalPlayerIds(world.players);
    countInternalPlayerIds(safeWorldOwnValue(archive, "players"));
    const archiveRecordFields = {
      club: ["id", "name", "country", "leagueId", "division"],
      player: ["id", "name", "country", "clubId", "position", "age"]
    };
    const sameArchivedRecord = (existing, source, kind) => {
      if (existing === source) return true;
      if (!existing || typeof existing !== "object" || !source || typeof source !== "object") return false;
      const fields = archiveRecordFields[kind] || [];
      if (!fields.some(field => safeWorldOwnValue(source, field) !== undefined)) return false;
      return fields.every(field => safeWorldOwnValue(existing, field) === safeWorldOwnValue(source, field));
    };
    const archiveRecordCanAccept = (bucket, key, source, kind) => {
      let hasExisting = false;
      try { hasExisting = Object.prototype.hasOwnProperty.call(bucket, key); } catch (_) { return false; }
      if (!hasExisting) return true;
      return sameArchivedRecord(safeWorldOwnValue(bucket, key), source, kind);
    };
    const archiveRecordIfUnconflicted = (bucket, key, source, kind) => {
      if (!archiveRecordCanAccept(bucket, key, source, kind)) return false;
      let hasExisting = false;
      try { hasExisting = Object.prototype.hasOwnProperty.call(bucket, key); } catch (_) { return false; }
      if (hasExisting) return true;
      return safeWorldTrySetOwnValue(bucket, key, source)
        && safeWorldOwnValue(bucket, key) === source;
    };
    const archiveRemovedPlayerHistory = (sourcePlayerId, canonicalPlayerId) => {
      const sourceRows = safeWorldOwnValue(world.playerHistory, sourcePlayerId);
      if (sourceRows === undefined) return true;
      if (!Array.isArray(sourceRows)) return false;
      const existingRows = safeWorldOwnValue(archive.playerHistory, canonicalPlayerId);
      if (existingRows !== undefined && !Array.isArray(existingRows)) return false;
      const mergedRows = Array.isArray(existingRows) ? existingRows.slice() : sourceRows.slice();
      sourceRows.forEach(entry => {
        if (!mergedRows.includes(entry)) mergedRows.push(entry);
      });
      if (!safeWorldTrySetOwnValue(archive.playerHistory, canonicalPlayerId, mergedRows)) return false;
      // Keep the active copy until the player-map deletion is confirmed.
      return true;
    };
    const mergeRemovedPlayerTransferHistory = (sourcePlayerId, canonicalPlayerId) => {
      const sourceRows = safeWorldOwnValue(transferClubHistoryByPlayer, sourcePlayerId);
      if (sourceRows === undefined) return true;
      if (!Array.isArray(sourceRows)) return false;
      const existingRows = safeWorldOwnValue(transferClubHistoryByPlayer, canonicalPlayerId);
      if (existingRows !== undefined && !Array.isArray(existingRows)) return false;
      const mergedRows = Array.isArray(existingRows) ? existingRows.slice() : sourceRows.slice();
      sourceRows.forEach(endpoint => {
        const endpointId = safeWorldRecordIdentifier(endpoint, "clubId");
        const endpointName = normalize(safeWorldRecordText(endpoint, "name"));
        const endpointCountry = normalize(safeWorldRecordText(endpoint, "country"));
        const duplicate = mergedRows.some(existing => {
          const existingId = safeWorldRecordIdentifier(existing, "clubId");
          if (endpointId && existingId) return endpointId === existingId;
          return !!endpointName
            && normalize(safeWorldRecordText(existing, "name")) === endpointName
            && normalize(safeWorldRecordText(existing, "country")) === endpointCountry;
        });
        if (!duplicate) mergedRows.push(endpoint);
      });
      if (!safeWorldTrySetOwnValue(transferClubHistoryByPlayer, canonicalPlayerId, mergedRows)) return false;
      // Keep the alias until the player-map deletion is confirmed.
      return true;
    };
    // Index players by their current club once. Re-scanning the full player map
    // for every unsupported club made large-world reconciliation unnecessarily O(clubs × players).
    const playersByClubId = new Map();
    for (const [playerId, player] of Object.entries(world.players || {})) {
      const playerClubId = safeWorldRecordIdentifier(player, "clubId");
      if (!playerClubId) continue;
      if (!playersByClubId.has(playerClubId)) playersByClubId.set(playerClubId, []);
      playersByClubId.get(playerClubId).push([playerId, player]);
    }
    if (supportedLeagueIds.size) {
      for (const [clubId, club] of Object.entries(world.clubs)) {
        const leagueId = safeWorldLeagueIdentifier(club);
        if (!club || !leagueId || supportedLeagueIds.has(leagueId)) continue;
        // Do not discard the active club if its archive key already belongs to a
        // different historical club record.
        if (!archiveRecordCanAccept(archive.clubs, clubId, club, "club")) continue;
        const playersForClub = playersByClubId.get(clubId) || [];
        for (const [playerId, player] of playersForClub) {
          // Archive player/history data before removing the live player. A conflicting
          // archived record or an unwritable history bucket keeps the player active.
          if (!archiveRecordIfUnconflicted(archive.players, playerId, player, "player")) continue;
          const internalPlayerId = safeWorldRecordIdentifier(player, "id");
          const hasUniqueLegacyAlias = !!internalPlayerId && internalPlayerId !== playerId
            && internalPlayerIdCounts.get(internalPlayerId) === 1
            && !safeWorldOwnValue(world.players, internalPlayerId);
          if (!archiveRemovedPlayerHistory(playerId, playerId)) continue;
          if (hasUniqueLegacyAlias) {
            if (!archiveRemovedPlayerHistory(internalPlayerId, playerId)) continue;
            if (!mergeRemovedPlayerTransferHistory(internalPlayerId, playerId)) continue;
          }
          try { delete world.players[playerId]; } catch (_) { continue; }
          if (safeWorldOwnValue(world.players, playerId) !== undefined) continue;
          const historyKeysToRemove = hasUniqueLegacyAlias ? [playerId, internalPlayerId] : [playerId];
          historyKeysToRemove.forEach(historyKey => {
            try { delete world.playerHistory[historyKey]; } catch (_) {}
          });
          if (hasUniqueLegacyAlias) {
            try { delete transferClubHistoryByPlayer[internalPlayerId]; } catch (_) {}
          }
          removedPlayerIds.add(playerId);
        }
        const hasRemainingPlayers = playersForClub.some(([playerId]) =>
          safeWorldOwnValue(world.players, playerId) !== undefined);
        if (hasRemainingPlayers) continue;
        // Only archive/remove the club after every attached player has been safely
        // archived and removed; this prevents active players pointing at a missing club.
        if (!archiveRecordIfUnconflicted(archive.clubs, clubId, club, "club")) continue;
        try { delete world.clubs[clubId]; } catch (_) { continue; }
        if (safeWorldOwnValue(world.clubs, clubId) !== undefined) continue;
        removedClubIds.add(clubId);
      }
    }
    if (removedClubIds.size || removedPlayerIds.size) {
      if (removedPlayerIds.size) {
        Object.values(world.clubs).forEach(club => {
          if (!club || typeof club !== "object") return;
          const roster = safeWorldArrayField(club, "roster");
          safeWorldSetOwnValue(club, "roster", roster.filter(rawId => {
            const playerId = safeWorldIdentifier(rawId);
            return !!playerId && !removedPlayerIds.has(playerId)
              && !!safeWorldOwnValue(world.players, playerId);
          }));
        });
      }
      const mergeArchiveRows = (existingRows, sourceRows) => {
        if (existingRows !== undefined && !Array.isArray(existingRows)) return null;
        const mergedRows = Array.isArray(existingRows) ? existingRows.slice() : sourceRows.slice();
        sourceRows.forEach(row => {
          if (!mergedRows.includes(row)) mergedRows.push(row);
        });
        return mergedRows;
      };
      const seasonStats = safeWorldOwnValue(world, "seasonStats");
      for (const season of safeWorldObjectKeys(seasonStats)) {
        const rows = safeWorldOwnValue(seasonStats, season);
        if (!Array.isArray(rows)) continue;
        const archivedRows = rows.filter(row => {
          if (!row || typeof row !== "object") return false;
          const playerIds = [
            safeWorldRecordIdentifier(row, "id"),
            safeWorldRecordIdentifier(row, "playerId")
          ].filter(Boolean);
          const clubId = safeWorldRecordIdentifier(row, "clubId");
          // Unsupported league metadata alone is not proof that a player row can
          // be removed. Keep statistics active unless their player or club was
          // successfully archived in this reconciliation pass.
          return playerIds.some(playerId => removedPlayerIds.has(playerId))
            || (clubId && removedClubIds.has(clubId));
        });
        if (!archivedRows.length) continue;
        const previousRows = safeWorldOwnValue(archive.seasonStats, season);
        const mergedRows = mergeArchiveRows(previousRows, archivedRows);
        if (!mergedRows) continue;
        // Commit the archive copy first. If it cannot be written, retain every active row.
        if (!safeWorldTrySetOwnValue(archive.seasonStats, season, mergedRows)) continue;
        safeWorldTrySetOwnValue(seasonStats, season, rows.filter(row => !archivedRows.includes(row)));
      }

      const leagueTables = safeWorldOwnValue(world, "leagueTables");
      for (const season of safeWorldObjectKeys(leagueTables)) {
        const tables = safeWorldOwnValue(leagueTables, season);
        if (!tables || typeof tables !== "object" || Array.isArray(tables)) continue;
        const savedArchiveTables = safeWorldOwnValue(archive.leagueTables, season);
        const archivedTables = savedArchiveTables === undefined ? {}
          : savedArchiveTables && typeof savedArchiveTables === "object" && !Array.isArray(savedArchiveTables)
            ? savedArchiveTables : null;
        for (const key of safeWorldObjectKeys(tables)) {
          if (!supportedLeagueIds.has(key.split(":")[0])) {
            if (!archivedTables) continue;
            const tableValue = safeWorldOwnValue(tables, key);
            const previousTable = safeWorldOwnValue(archivedTables, key);
            const mergedTable = Array.isArray(previousTable) && Array.isArray(tableValue)
              ? mergeArchiveRows(previousTable, tableValue)
              : previousTable === undefined ? tableValue : null;
            if (mergedTable === null) continue;
            if (!safeWorldTrySetOwnValue(archivedTables, key, mergedTable)) continue;
            if (!safeWorldTrySetOwnValue(archive.leagueTables, season, archivedTables)) continue;
            try { delete tables[key]; } catch (_) {}
            continue;
          }
          const rows = safeWorldOwnValue(tables, key);
          if (!Array.isArray(rows)) continue;
          const archivedRows = rows.filter(row => {
            if (!row || typeof row !== "object") return false;
            const leagueId = safeWorldRecordIdentifier(row, "leagueId");
            const clubId = safeWorldRecordIdentifier(row, "clubId");
            return (leagueId && !supportedLeagueIds.has(leagueId))
              || (clubId && removedClubIds.has(clubId));
          });
          if (!archivedRows.length) continue;
          const savedArchiveRowsBySeason = safeWorldOwnValue(archive.leagueTableRows, season);
          const archivedRowsBySeason = savedArchiveRowsBySeason === undefined ? {}
            : savedArchiveRowsBySeason && typeof savedArchiveRowsBySeason === "object"
              && !Array.isArray(savedArchiveRowsBySeason) ? savedArchiveRowsBySeason : null;
          if (!archivedRowsBySeason) continue;
          const previousRows = safeWorldOwnValue(archivedRowsBySeason, key);
          const mergedRows = mergeArchiveRows(previousRows, archivedRows);
          if (!mergedRows) continue;
          if (!safeWorldTrySetOwnValue(archivedRowsBySeason, key, mergedRows)) continue;
          if (!safeWorldTrySetOwnValue(archive.leagueTableRows, season, archivedRowsBySeason)) continue;
          safeWorldTrySetOwnValue(tables, key, rows.filter(row => !archivedRows.includes(row)));
        }
      }

      const matchesBySeason = safeWorldOwnValue(world, "matchesBySeason");
      for (const season of safeWorldObjectKeys(matchesBySeason)) {
        const matches = safeWorldOwnValue(matchesBySeason, season);
        if (!Array.isArray(matches)) continue;
        const archivedMatches = matches.filter(match => {
          const homeClubId = safeWorldRecordIdentifier(match, "homeClubId");
          const awayClubId = safeWorldRecordIdentifier(match, "awayClubId");
          return (homeClubId && removedClubIds.has(homeClubId))
            || (awayClubId && removedClubIds.has(awayClubId));
        });
        if (!archivedMatches.length) continue;
        const previousMatches = safeWorldOwnValue(archive.matchesBySeason, season);
        const mergedMatches = mergeArchiveRows(previousMatches, archivedMatches);
        if (!mergedMatches) continue;
        if (!safeWorldTrySetOwnValue(archive.matchesBySeason, season, mergedMatches)) continue;
        safeWorldTrySetOwnValue(matchesBySeason, season, matches.filter(match => !archivedMatches.includes(match)));
      }

      const competitionsBySeason = safeWorldOwnValue(world, "competitionsBySeason");
      const unsupportedCompetitionIds = ["afc-cl", "afc-cl-two", "japanese-cup", "japanese-super-cup"];
      for (const season of safeWorldObjectKeys(competitionsBySeason)) {
        const items = safeWorldOwnValue(competitionsBySeason, season);
        if (!Array.isArray(items)) continue;
        const isUnsupportedCompetition = item => {
          if (!item || typeof item !== "object") return false;
          const confederation = safeWorldRecordText(item, "confederation");
          const competitionId = safeWorldRecordIdentifier(item, "id")
            || safeWorldRecordIdentifier(item, "competitionId");
          return confederation === "AFC" || unsupportedCompetitionIds.includes(competitionId);
        };
        const archivedItems = items.filter(isUnsupportedCompetition);
        if (!archivedItems.length) continue;
        const previousItems = safeWorldOwnValue(archive.competitionsBySeason, season);
        const mergedItems = mergeArchiveRows(previousItems, archivedItems);
        if (!mergedItems) continue;
        if (!safeWorldTrySetOwnValue(archive.competitionsBySeason, season, mergedItems)) continue;
        safeWorldTrySetOwnValue(competitionsBySeason, season, items.filter(item => !isUnsupportedCompetition(item)));
      }
    }
    // Rebuild player-to-club membership only after unsupported-club records have
    // been archived, preserving the established reconciliation order.
    if (normalizeRosterMembership(world) === false) return world;
    const rows = db && typeof db.clubs === "function" ? db.clubs() : [];
    const unavailableIdentitiesByClub = new Map();
    const allClubs = Object.values(world.clubs || {});
    const mergeLegacyHistoryKey = (historyMap, canonicalPlayerId, legacyPlayerId) => {
      if (!historyMap || typeof historyMap !== "object" || Array.isArray(historyMap)
        || !canonicalPlayerId || !legacyPlayerId || canonicalPlayerId === legacyPlayerId) {
        return safeWorldOwnValue(historyMap, canonicalPlayerId);
      }
      const canonicalRows = safeWorldOwnValue(historyMap, canonicalPlayerId);
      const legacyRows = safeWorldOwnValue(historyMap, legacyPlayerId);
      if (!Array.isArray(legacyRows) || !legacyRows.length) return canonicalRows;
      const mergedRows = Array.isArray(canonicalRows) ? canonicalRows.slice() : [];
      legacyRows.forEach(entry => {
        if (!mergedRows.includes(entry)) mergedRows.push(entry);
      });
      if (!safeWorldSetOwnValue(historyMap, canonicalPlayerId, mergedRows)) {
        return mergedRows;
      }
      try { delete historyMap[legacyPlayerId]; } catch (_) {}
      return mergedRows;
    };
    const archivedPlayerHistory = safeWorldOwnValue(archive, "playerHistory");
    for (const [playerMapKey, player] of Object.entries(world.players || {})) {
      if (!player || typeof player !== "object") continue;
      const playerId = safeWorldIdentifier(playerMapKey) || safeWorldRecordIdentifier(player, "id");
      const internalPlayerId = safeWorldRecordIdentifier(player, "id");
      const hasUniqueLegacyAlias = !!internalPlayerId && internalPlayerId !== playerId
        && internalPlayerIdCounts.get(internalPlayerId) === 1
        && !safeWorldOwnValue(world.players, internalPlayerId);
      let isDetachedPlayer = false;
      try {
        isDetachedPlayer = isTrueFlag(safeWorldOwnValue(player, "retired"))
          || isTrueFlag(safeWorldOwnValue(player, "freeAgent"));
      } catch (_) {}
      const currentClubId = safeWorldRecordIdentifier(player, "clubId");
      if (hasUniqueLegacyAlias) {
        mergeLegacyHistoryKey(archivedPlayerHistory, playerId, internalPlayerId);
      }
      const historyValue = playerId
        ? (hasUniqueLegacyAlias
          ? mergeLegacyHistoryKey(world.playerHistory, playerId, internalPlayerId)
          : safeWorldOwnValue(world.playerHistory, playerId)) : undefined;
      const history = Array.isArray(historyValue) ? historyValue : [];
      const transferRowsValue = playerId
        ? (hasUniqueLegacyAlias
          ? mergeLegacyHistoryKey(transferClubHistoryByPlayer, playerId, internalPlayerId)
          : safeWorldOwnValue(transferClubHistoryByPlayer, playerId)) : undefined;
      const transferClubRows = Array.isArray(transferRowsValue) ? transferRowsValue : [];
      const hasFormerClubTrail = isDetachedPlayer
        || !!safeWorldRecordIdentifier(player, "previousClubId")
        || !!safeWorldRecordIdentifier(player, "retiredFromClubId")
        || history.some(entry => !!safeWorldRecordIdentifier(entry, "fromClubId")
          || !!safeWorldRecordText(entry, "from"))
        || transferClubRows.length > 0;
      if (!hasFormerClubTrail) continue;
      let identityKey = "";
      try { identityKey = rosterIdentityKey(player); } catch (_) {}
      if (!identityKey) continue;
      const clubIds = new Set();
      const addFormerClubId = value => {
        const id = safeWorldIdentifier(value);
        if (id && id !== currentClubId) clubIds.add(id);
      };
      addFormerClubId(safeWorldRecordIdentifier(player, "previousClubId"));
      addFormerClubId(safeWorldRecordIdentifier(player, "retiredFromClubId"));
      for (const entry of history) {
        if (!entry || typeof entry !== "object") continue;
        // Normal transfers retain both endpoints in player history. Protect only
        // the former club; never hide the player from the club they currently join.
        const fromClubId = safeWorldRecordIdentifier(entry, "fromClubId");
        addFormerClubId(fromClubId);
        const historyClubId = safeWorldRecordIdentifier(entry, "clubId");
        addFormerClubId(historyClubId);
        const clubName = safeWorldRecordText(entry, "club");
        if (clubName && (isDetachedPlayer || (historyClubId && historyClubId !== currentClubId))) {
          const country = safeWorldRecordText(entry, "country");
          const matches = allClubs.filter(club =>
            normalize(safeWorldRecordText(club, "name")) === normalize(clubName)
            && (!country || normalize(safeWorldRecordText(club, "country")) === normalize(country)));
          if (matches.length) matches.forEach(club => addFormerClubId(safeWorldRecordIdentifier(club, "id")));
          else if (country) addFormerClubId(clubKey(clubName, country));
        }
        // Older history rows may have a textual origin but no fromClubId. Resolve
        // it only when the country/name combination identifies a former club.
        const fromName = safeWorldRecordText(entry, "from");
        const fromCountry = safeWorldRecordText(entry, "fromCountry");
        if (fromName && !fromClubId) {
          const matches = allClubs.filter(club =>
            normalize(safeWorldRecordText(club, "name")) === normalize(fromName)
            && (!fromCountry || normalize(safeWorldRecordText(club, "country")) === normalize(fromCountry)));
          // Do not block every club with the same name when a legacy row lacks country data.
          if (matches.length === 1) addFormerClubId(safeWorldRecordIdentifier(matches[0], "id"));
          else if (matches.length === 0 && fromCountry) addFormerClubId(clubKey(fromName, fromCountry));
        }
      }
      for (const endpoint of transferClubRows) {
        if (!endpoint || typeof endpoint !== "object") continue;
        const endpointId = safeWorldRecordIdentifier(endpoint, "clubId");
        if (endpointId) addFormerClubId(endpointId);
        const clubName = safeWorldRecordText(endpoint, "name");
        if (!clubName || (endpointId && allClubs.some(club =>
          safeWorldRecordIdentifier(club, "id") === endpointId))) continue;
        const countryName = safeWorldRecordText(endpoint, "country");
        const matches = allClubs.filter(club =>
          normalize(safeWorldRecordText(club, "name")) === normalize(clubName)
          && (!countryName || normalize(safeWorldRecordText(club, "country")) === normalize(countryName)));
        if (matches.length === 1) addFormerClubId(safeWorldRecordIdentifier(matches[0], "id"));
        else if (matches.length === 0 && countryName) addFormerClubId(clubKey(clubName, countryName));
      }
      for (const clubId of clubIds) {
        if (!unavailableIdentitiesByClub.has(clubId)) unavailableIdentitiesByClub.set(clubId, new Set());
        unavailableIdentitiesByClub.get(clubId).add(identityKey);
      }
    }
    const knownPlayersByClub = new Map();
    for (const player of Object.values(world.players || {})) {
      if (!player || typeof player !== "object" || isTrueFlag(safeWorldOwnValue(player, "retired"))) continue;
      const clubId = safeWorldRecordIdentifier(player, "clubId");
      let identityKey = "";
      try { identityKey = rosterIdentityKey(player); } catch (_) {}
      if (!clubId || !identityKey) continue;
      if (!knownPlayersByClub.has(clubId)) knownPlayersByClub.set(clubId, new Set());
      knownPlayersByClub.get(clubId).add(identityKey);
    }
    for (const row of rows) {
      const rowName = safeWorldRecordText(row, "name");
      const rowCountry = safeWorldRecordText(row, "country");
      if (!row || !rowName || !rowCountry) continue;
      const id = clubKey(rowName, rowCountry);
      const savedPlayers = safeWorldOwnValue(row, "players");
      const sourceRows = Array.isArray(savedPlayers) && savedPlayers.length ? savedPlayers
        : db && typeof db.playerRecordsForClub === "function" ? db.playerRecordsForClub(rowName, rowCountry) : [];
      const records = Array.isArray(sourceRows) ? sourceRows.slice(0, SIMULATED_SQUAD_LIMIT) : [];
      if (!world.clubs[id]) {
        const club = addClub(world, row, db);
        const knownForClub = new Set(knownPlayersByClub.get(id) || []);
        const unavailableForClub = unavailableIdentitiesByClub.get(id) || new Set();
        let index = 0;
        records.forEach(player => {
          const identityKey = rosterIdentityKey(player);
          if (!identityKey || knownForClub.has(identityKey) || unavailableForClub.has(identityKey)) return;
          makePlayer(world, player, club, index++, false);
          knownForClub.add(identityKey);
        });
        knownPlayersByClub.set(id, knownForClub);
      } else {
        const club = world.clubs[id];
        const sourceDivision = Math.max(1, int(row.division, 1));
        const savedDivision = normalizeClubDivision(club.division, 0);
        // A valid saved in-game tier remains authoritative after promotion/relegation.
        // Malformed saved values fall back to the trusted database tier without coercion.
        const activeDivision = savedDivision >= 1 ? savedDivision : sourceDivision;
        syncClubDivisionMetadata(world, club, activeDivision, db, row);
        // Migrate saves created before complete squads were stored. Replace only generated
        // placeholders; existing real players and their career history are preserved.
        const knownForClub = knownPlayersByClub.get(id) || new Set();
        const unavailableForClub = unavailableIdentitiesByClub.get(id) || new Set();
        if (hasPendingClubRosterRecovery(world, id)) {
          knownPlayersByClub.set(id, knownForClub);
          continue;
        }
        let index = 0;
        for (const playerRow of records) {
          const identityKey = rosterIdentityKey(playerRow);
          if (!identityKey || knownForClub.has(identityKey) || unavailableForClub.has(identityKey)) continue;
          while ((club.roster || []).length >= SIMULATED_SQUAD_LIMIT) {
            const generated = (club.roster || []).map(playerId => ({
              playerId,
              player: safeWorldOwnValue(world.players, safeWorldIdentifier(playerId))
            })).filter(entry => entry.player && entry.player.isGenerated)
              .sort((a, b) => safeNumber(a.player && a.player.ovr, 0) - safeNumber(b.player && b.player.ovr, 0));
            if (!generated.length) break;
            const replace = generated[0];
            const replaceId = safeWorldIdentifier(replace.playerId);
            if (!replaceId) break;
            const archivePlan = archiveGeneratedPlayerBeforeRosterReplacement(world, replace.player, replaceId);
            if (!archivePlan) break;
            const previousRoster = safeWorldArrayField(club, "roster");
            const nextRoster = previousRoster.filter(playerId => safeWorldIdentifier(playerId) !== replaceId);
            if (!safeWorldTrySetOwnValue(club, "roster", nextRoster)) break;
            try { delete world.players[replaceId]; } catch (_) {
              safeWorldTrySetOwnValue(club, "roster", previousRoster);
              break;
            }
            if (safeWorldOwnValue(world.players, replaceId) !== undefined) {
              safeWorldTrySetOwnValue(club, "roster", previousRoster);
              break;
            }
            removeArchivedGeneratedPlayerLiveRecords(world, archivePlan);
            knownForClub.delete(rosterIdentityKey(replace.player));
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
    if (normalizeRosterMembership(world) === false) return world;
    Object.values(world.clubs).forEach(club => fillRoster(world, club));
    safeWorldSetField(world, "rosterSchemaVersion", 3);
    safeWorldSetField(world, "rosterMembershipSchemaVersion", ROSTER_MEMBERSHIP_SCHEMA_VERSION);
    world.projectionRevision = Math.max(0, int(world.projectionRevision, 0)) + 1;
    invalidateUnfinishedSeasonProjection(world);
    return world;
  }
  function ensureState(save, db) {
    if (!save || typeof save !== "object") return emptyWorld();
    let world = save.worldSimulation;
    if (!world || typeof world !== "object" || Array.isArray(world)) {
      world = seedWorld(db);
      save.worldSimulation = world;
      return world;
    }
    // Older snapshots can be upgraded by the idempotent in-place normalizers below.
    // A future schema marker must never cause this older client to replace the saved world.
    const savedSchemaVersion = safeWorldSchemaVersion(world);
    // A newer engine owns this save format. Do not let older normalizers rewrite its fields.
    if (savedSchemaVersion > VERSION) return world;
    // Keep a malformed archive untouched and defer normalization rather than
    // silently replacing legacy archive data with empty buckets.
    if (!ensureArchive(world)) return world;
    // Missing legacy maps are recoverable. Rebuild only the absent maps in place
    // so the existing player records, history, archive, and season data survive.
    let recoveredWorldMap = false;
    for (const field of ["clubs", "players"]) {
      const savedMap = safeWorldOwnValue(world, field);
      if (savedMap === undefined || savedMap === null) {
        if (!safeWorldTrySetOwnValue(world, field, {})) return world;
        recoveredWorldMap = true;
      } else if (typeof savedMap !== "object" || Array.isArray(savedMap)) {
        // A malformed map may still contain legacy data; do not overwrite it.
        return world;
      }
    }
    // Back up malformed active history containers before normalizing them. If the
    // recovery bucket itself is unusable, defer repair rather than discard another payload.
    if (!normalizeWorldArrayField(world, "completedSeasons")
      || !normalizeWorldMapField(world, "seasonStats")
      || !normalizeWorldMapField(world, "leagueTables")
      || !normalizeWorldArrayField(world, "transfers")
      || !normalizeWorldArrayField(world, "marketReports")
      || !normalizeWorldMapField(world, "playerHistory")
      || !normalizeWorldArrayField(world, "notes")
      || !normalizeWorldMapField(world, "matchesBySeason", true)
      || !normalizeWorldMapField(world, "competitionsBySeason", true)
      || !normalizeWorldArrayField(world, "promotionHistory")
      || !normalizeWorldMapField(world, "aiMetadata", true)
      || !normalizeWorldMapField(world, "transferClubHistoryByPlayer", true)) return world;
    world.currentSeason = Math.max(1, int(world.currentSeason, int(save.season, 1)));
    ensureTransferClubHistory(world);
    world.nextGeneratedPlayer = Math.max(1, int(world.nextGeneratedPlayer, 1));
    world.transferSequence = Math.max(0, int(world.transferSequence, 0));
    const lastAdvancedTo = Math.max(0, int(safeWorldOwnValue(world, "lastAdvancedTo"), 0));
    safeWorldSetField(world, "lastAdvancedTo", lastAdvancedTo);
    if (!Object.prototype.hasOwnProperty.call(world, "lastDevelopedSeason")) {
      world.lastDevelopedSeason = Math.max(0, lastAdvancedTo - 1);
    } else {
      world.lastDevelopedSeason = Math.max(0, int(world.lastDevelopedSeason, 0));
    }
    if (!Object.prototype.hasOwnProperty.call(world, "lastFreeAgentMarketSeason")) {
      world.lastFreeAgentMarketSeason = lastAdvancedTo;
    } else {
      world.lastFreeAgentMarketSeason = Math.max(0, int(world.lastFreeAgentMarketSeason, 0));
    }
    world.projectionRevision = Math.max(0, int(world.projectionRevision, 0));
    // Resolve the active world season before any roster migration invalidates cached projections.
    // Legacy saves can have a newer career season while the world-season marker still lags.
    if (lastAdvancedTo > 0) {
      world.currentSeason = Math.max(world.currentSeason, int(lastAdvancedTo, world.currentSeason));
    } else {
      world.currentSeason = Math.max(world.currentSeason, Math.max(1, int(save.season, 1)));
    }
    // reconcileDatabase scans the global club/player catalogue and repairs squads.
    // Running it for every dashboard render caused severe avoidable CPU work.
    const catalogueVersion = int(db && db.version, int(world.dbVersion, 0));
    const supportedLeagueIds = supportedWorldLeagueIds(db);
    const hasUnsupportedClub = supportedLeagueIds.size > 0 && Object.values(world.clubs).some(club => {
      const leagueId = safeWorldLeagueIdentifier(club);
      return !!leagueId && !supportedLeagueIds.has(leagueId);
    });
    if (recoveredWorldMap || catalogueVersion !== int(world.dbVersion, 0)
      || safeNumber(safeWorldOwnValue(world, "rosterSchemaVersion"), NaN) !== 3 || hasUnsupportedClub) {
      reconcileDatabase(world, db);
    }
    if (safeNumber(safeWorldOwnValue(world, "rosterMembershipSchemaVersion"), NaN) !== ROSTER_MEMBERSHIP_SCHEMA_VERSION) {
      if (normalizeRosterMembership(world) === false) return world;
      if (!safeWorldTrySetOwnValue(world, "rosterMembershipSchemaVersion", ROSTER_MEMBERSHIP_SCHEMA_VERSION)) return world;
      world.projectionRevision = Math.max(0, int(world.projectionRevision, 0)) + 1;
      invalidateUnfinishedSeasonProjection(world);
    }
    // Advance an older schema marker only after every in-place migration succeeded.
    if (savedSchemaVersion < VERSION) safeWorldTrySetOwnValue(world, "schemaVersion", VERSION);
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
    for (const entry of worldLeagueClubEntries(world)) {
      const key = entry.leagueId + "|" + entry.division;
      if (!groups.has(key)) groups.set(key, { division: entry.division, clubs: [] });
      groups.get(key).clubs.push(entry);
    }
    const matchesByClub = new Map();
    groups.forEach(group => {
      const clubs = group.clubs;
      const clubCount = clubs.length;
      const clubMatchValues = clubs.map(entry => Math.max(0, int(entry.club.matchesPerSeason, 34)));
      const fallbackMatches = clubCount > 1
        ? Math.max(0, Math.min(60, Math.round(average(clubMatchValues)))) : 0;
      let profile = {};
      try {
        profile = db && typeof db.leagueFor === "function"
          ? db.leagueFor(clubs[0] && clubs[0].club && clubs[0].club.country, group.division) || {} : {};
      } catch (_) {}
      const expectedTeamCount = Math.max(0, int(profile.teamCount, 0));
      let matchesPerClub = fallbackMatches;
      if (expectedTeamCount > 1) {
        if (clubCount === expectedTeamCount) {
          const officialMatches = safeNumber(profile.matchesPerSeason, 0);
          if (officialMatches > 0) matchesPerClub = Math.round(officialMatches);
        } else {
          matchesPerClub = 2 * Math.max(0, clubCount - 1);
        }
      }
      matchesPerClub = Math.max(0, Math.min(60, matchesPerClub));
      if (clubCount % 2 === 1 && matchesPerClub % 2 === 1) matchesPerClub = Math.max(0, matchesPerClub - 1);
      clubs.forEach(entry => matchesByClub.set(entry.clubId, matchesPerClub));
    });
    return matchesByClub;
  }
  function normalizedClubPower(club) {
    return marketClubPower(club);
  }
  function generatePlayerSeason(world, player, season, progress = 1, strengthByLeague, matchesByClub, playerMapKey) {
    const playerId = safeWorldIdentifier(playerMapKey) || safeWorldRecordIdentifier(player, "id");
    if (!playerId) return null;
    const playerClubId = safeWorldIdentifier(player && player.clubId);
    const savedClub = playerClubId && world.clubs ? world.clubs[playerClubId] : null;
    const clubId = savedClub ? safeWorldClubIdentifier(savedClub, playerClubId) : "";
    const club = savedClub && clubId ? savedClub : null;
    const savedDivision = normalizeClubDivision(player && player.division, 0);
    const division = savedDivision >= 1 ? savedDivision : divisionForClub(club);
    const rng = random(hash(playerId + "|" + season + "|season-stat-v" + VERSION));
    const power = club ? normalizedClubPower(club) : 55;
    const matches = club
      ? Math.max(0, Math.min(60, int(matchesByClub && matchesByClub.get(clubId), Math.max(0, int(club.matchesPerSeason, 34)))))
      : 34;
    const ovr = clamp(safeNumber(player.ovr, 55) || 55, 35, 99);
    const group = player.group || groupForPosition(player.position);
    const peers = club ? activeRosterIds(world, club).map(id => ({
      playerId: id, player: safeWorldOwnValue(world.players, id)
    })).filter(entry => entry.player && (entry.player.group || groupForPosition(entry.player.position)) === group)
      : [{ playerId, player }];
    const roleStrength = peers.length ? peers.slice().sort((a, b) =>
      safeNumber(b.player && b.player.ovr, 50) - safeNumber(a.player && a.player.ovr, 50))
      .findIndex(entry => entry.playerId === playerId) : 0;
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
    const leaguePower = leagueStrength(world, player.leagueId, division, strengthByLeague);
    const goals = Math.round(fullGoals * clamp(progress, 0, 1));
    const assists = Math.round(fullAssists * clamp(progress, 0, 1));
    const values = {
      id: playerId, playerId, season: Number(season), name: player.name, club: club ? club.name : "",
      clubName: club ? club.name : "", country: player.country, leagueId: player.leagueId,
      division, position: player.position, group,
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
    for (const entry of worldLeagueClubEntries(world)) {
      const key = entry.leagueId + "|" + entry.division;
      const row = totals.get(key) || { total: 0, count: 0 };
      row.total += normalizedClubPower(entry.club);
      row.count++;
      totals.set(key, row);
    }
    return new Map(Array.from(totals, ([key, row]) => [
      key, row.count ? Math.round(row.total / row.count) : 55
    ]));
  }
  function leagueStrength(world, leagueId, division, strengthByLeague) {
    const tier = normalizeClubDivision(division, 1);
    const safeLeagueId = safeWorldIdentifier(leagueId);
    if (tier < 1 || !safeLeagueId) return 55;
    const key = safeLeagueId + "|" + tier;
    if (strengthByLeague && strengthByLeague.has(key)) return strengthByLeague.get(key);
    const entries = worldLeagueClubEntries(world);
    const clubs = entries.filter(entry => entry.leagueId === safeLeagueId && entry.division === tier);
    if (clubs.length) return Math.round(average(clubs.map(entry => normalizedClubPower(entry.club))));
    if (tier !== 1 && strengthByLeague && strengthByLeague.has(safeLeagueId + "|1")) {
      return strengthByLeague.get(safeLeagueId + "|1");
    }
    return Math.round(average(entries
      .filter(entry => entry.leagueId === safeLeagueId && entry.division === 1)
      .map(entry => normalizedClubPower(entry.club))));
  }

  function getProjectedSeasonRows(world, targetSeason, db) {
    const signature = [
      int(world.projectionRevision, 0), int(world.dbVersion, 0), safeNumber(safeWorldOwnValue(world, "rosterSchemaVersion"), 0),
      int(world.currentSeason, 1), safeNumber(safeWorldOwnValue(world, "lastAdvancedTo"), 0), int(world.lastCompletedSeason, 0),
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
      const rows = Object.entries(world.players || {}).filter(([playerMapKey, player]) => {
        const playerId = safeWorldIdentifier(playerMapKey) || safeWorldRecordIdentifier(player, "id");
        const playerClubId = safeWorldIdentifier(player && player.clubId);
        const club = playerClubId && world.clubs ? world.clubs[playerClubId] : null;
        return !!playerId && player && !isTrueFlag(player.retired) && !isTrueFlag(player.freeAgent)
          && !!playerClubId && !!club
          && !!safeWorldClubIdentifier(club, playerClubId)
          && divisionForClub(club) >= 1;
      }).map(([playerMapKey, player]) =>
        generatePlayerSeason(world, player, targetSeason, 1, strengthByLeague, matchesByClub, playerMapKey))
        .filter(row => row && typeof row === "object");
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
    for (const entry of worldLeagueClubEntries(world)) {
      const tableKey = entry.division === 1 ? entry.leagueId : entry.leagueId + ":" + entry.division;
      if (!byLeague.has(tableKey)) byLeague.set(tableKey, {
        leagueId: entry.leagueId, division: entry.division, clubs: []
      });
      byLeague.get(tableKey).clubs.push(entry);
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
      const clubs = sourceClubs.slice().sort((a, b) => a.clubId.localeCompare(b.clubId));
      const clubCount = clubs.length;
      const matchesByClub = suppliedMatchesByClub instanceof Map
        ? suppliedMatchesByClub : buildLeagueMatchCountLookup(world, db);
      const matchesPerClub = clubCount > 1
        ? Math.max(0, Math.min(60, int(matchesByClub.get(clubs[0].clubId), 34)))
        : 0;
      const statsByClub = new Map(clubs.map(entry => [entry.clubId, {
        played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, home: 0, away: 0
      }]));
      let fixtureNumber = 0;
      function playFixture(firstEntry, secondEntry, cycle) {
        const first = firstEntry.club, second = secondEntry.club;
        const firstStats = statsByClub.get(firstEntry.clubId);
        const secondStats = statsByClub.get(secondEntry.clubId);
        const firstHomeCost = Math.abs((firstStats.home + 1) - firstStats.away)
          + Math.abs(secondStats.home - (secondStats.away + 1));
        const secondHomeCost = Math.abs((secondStats.home + 1) - secondStats.away)
          + Math.abs(firstStats.home - (firstStats.away + 1));
        let homeEntry, awayEntry;
        if (firstHomeCost < secondHomeCost) {
          homeEntry = firstEntry; awayEntry = secondEntry;
        } else if (secondHomeCost < firstHomeCost) {
          homeEntry = secondEntry; awayEntry = firstEntry;
        } else if (hash([leagueId, season, cycle, firstEntry.clubId, secondEntry.clubId, "home-choice-v2"].join("|")) % 2 === 0) {
          homeEntry = firstEntry; awayEntry = secondEntry;
        } else {
          homeEntry = secondEntry; awayEntry = firstEntry;
        }
        const homeClub = homeEntry.club, awayClub = awayEntry.club;
        const relativePower = clamp((normalizedClubPower(homeClub) - normalizedClubPower(awayClub)) / 100, -0.55, 0.55);
        const rng = random(hash([leagueId, season, cycle, fixtureNumber++, homeEntry.clubId, awayEntry.clubId, "league-fixture-v2"].join("|")));
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
        const home = statsByClub.get(homeEntry.clubId);
        const away = statsByClub.get(awayEntry.clubId);
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
      const rows = clubs.map(entry => {
        const club = entry.club;
        const stats = statsByClub.get(entry.clubId);
        const points = stats.w * 3 + stats.d;
        const goalDifference = stats.gf - stats.ga;
        const form = stats.played > 0
          ? clamp(5.7 + points / stats.played * 0.55 + goalDifference / stats.played * 0.12, 5.1, 8.8)
          : 0;
        return {
          season: Number(season), leagueId, division, country: club.country, clubId: entry.clubId,
          club: club.name, power: Math.round(normalizedClubPower(club)), played: stats.played,
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
    if (isFutureWorldSchema(world)) {
      return { season: year, rows: [], tables: {}, alreadyCompleted: true,
        readOnly: true, futureSchema: true, transfers: 0 };
    }
    if (hasCompletedSeasonMarker(world, year)) {
      const marketReports = Array.isArray(world.marketReports) ? world.marketReports : [];
      const market = marketReports.find(row => row && safeNumber(row.season, NaN) === year) || {};
      return {
        season: year, rows: world.seasonStats[String(year)] || [], tables: world.leagueTables[String(year)] || {},
        alreadyCompleted: true, transfers: safeNumber(market.moves, 0)
      };
    }
    const strengthByLeague = buildLeagueStrengthLookup(world);
    const matchesByClub = buildLeagueMatchCountLookup(world, db);
    const rows = Object.entries(world.players || {}).filter(([playerMapKey, player]) => {
      const playerId = safeWorldIdentifier(playerMapKey) || safeWorldRecordIdentifier(player, "id");
      return !!playerId && player && !isTrueFlag(player.retired) && !isTrueFlag(player.freeAgent)
        && player.clubId && world.clubs[player.clubId];
    }).map(([playerMapKey, player]) =>
      generatePlayerSeason(world, player, year, 1, strengthByLeague, matchesByClub, playerMapKey))
      .filter(row => row && typeof row === "object");
    const tables = simulateLeagueTables(world, year, 1, db, matchesByClub);
    world.seasonStats[String(year)] = rows.map(row => ({ ...row, displayStats: undefined }));
    world.leagueTables[String(year)] = tables;
    world.completedSeasons.push(year);
    world.completedSeasons = sortCompletedSeasonMarkers(world.completedSeasons);
    world.lastCompletedSeason = Math.max(safeNumber(world.lastCompletedSeason, 0), year);
    world.currentSeason = year;
    return { season: year, rows, tables, alreadyCompleted: false, transfers: 0 };
  }
  function inferArchetype(club) {
    const power = marketClubPower(club);
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
    const rows = activeRosterIds(world, seller).map(playerId => ({
      playerId,
      player: safeWorldOwnValue(world.players, playerId)
    })).filter(entry => entry.player && entry.player.group === group && !usedPlayers.has(entry.playerId));
    if (rows.length <= Math.max(1, Math.min(2, TARGETS[group] - 1))) return null;
    const quality = roleStats(world, seller)[group];
    const sellerPower = marketClubPower(seller);
    const candidates = rows.filter(entry => {
      const player = entry.player;
      const rating = marketPlayerRating(player);
      const age = marketPlayerAge(player);
      const contract = marketContractSeasons(player);
      return rating < quality.best - 2 || age >= 29 || contract <= 1 || rating < sellerPower - 12;
    });
    candidates.sort((a, b) => {
      const score = entry => {
        const player = entry.player;
        const age = marketPlayerAge(player);
        const contract = marketContractSeasons(player);
        const rating = marketPlayerRating(player);
        const potential = marketPlayerPotential(player, rating);
        return (age >= 29 ? 8 : 0) + (contract <= 1 ? 5 : 0)
          + Math.max(0, sellerPower - rating) * 0.8 - potential * 0.13
          + hash(entry.playerId + "|" + seller.updatedSeason) % 17 / 10;
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
    if (isFutureWorldSchema(world)) return { committed: false, readOnly: true, futureSchema: true };
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
        const selling = sellingCandidate(world, seller, need.group, alreadyUsedPlayers);
        if (!selling) continue;
        const { player, playerId } = selling;
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
        const tie = hash(playerId + "|" + buyer.id + "|" + season) % 41 / 100;
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
        candidates.push({ player, playerId, seller, fee, score, group: need.group });
      }
      candidates.sort((a, b) => b.score - a.score || marketPlayerRating(b.player) - marketPlayerRating(a.player));
      const candidate = candidates[0];
      if (!candidate || candidate.score < 37) continue;
      const { player, playerId, seller, fee, group } = candidate;
      transaction.capturePlayer(player);
      transaction.captureHistory(playerId);
      const origin = seller.name;
      // Rebuild both memberships from active ownership before moving the player.
      // This discards stale, duplicate, retired, free-agent, and cross-club IDs.
      seller.roster = activeRosterIds(world, seller).filter(id => id !== playerId);
      buyer.roster = activeRosterIds(world, buyer).filter(id => id !== playerId);
      buyer.roster.push(playerId);
      // The recorded fee is a direct buyer-to-seller transaction; never discard part of it.
      seller.budget = Math.max(0, safeNumber(seller.budget, 0)) + fee;
      buyer.budget = Math.max(0, safeNumber(buyer.budget, 0) - fee);
      player.clubId = buyer.id; player.country = buyer.country; player.leagueId = buyer.leagueId;
      player.division = divisionForClub(buyer); player.contractSeasons = 2 + (hash(playerId + "|" + season + "|contract") % 4);
      player.transferListed = false;
      alreadyUsedClubs.add(seller.id); alreadyUsedClubs.add(buyer.id); alreadyUsedPlayers.add(playerId);
      const transfer = {
        id: "world-transfer-" + season + "-" + (++world.transferSequence),
        season: Number(season), day: 1, playerId, player: player.name, position: player.position,
        group, from: origin, fromCountry: seller.country, fromClubId: String(seller.id),
        to: buyer.name, toCountry: buyer.country, toClubId: String(buyer.id),
        fee, currency: buyer.currency, reason: roleNeedsLabel(group) + " • " + (marketPlayerAge(player) <= 23 ? "استثمار في المستقبل" : marketPlayerAge(player) >= 30 ? "خبرة جاهزة" : "تعزيز فوري"),
        playerOvr: marketPlayerRating(player), kind: "انتقال — محاكاة"
      };
      moves.push(transfer);
      world.transfers.unshift(transfer);
      const historyMap = safeWorldOwnValue(world, "playerHistory");
      const playerHistory = historyMap && typeof historyMap === "object" ? historyMap : {};
      if (playerHistory !== historyMap) safeWorldSetField(world, "playerHistory", playerHistory);
      const existingHistory = safeWorldOwnValue(playerHistory, playerId);
      const history = Array.isArray(existingHistory) ? existingHistory : [];
      history.unshift({ season: Number(season), clubId: String(buyer.id),
        club: buyer.name, country: buyer.country, fromClubId: String(seller.id),
        type: "transfer-in", from: origin });
      safeWorldSetOwnValue(playerHistory, playerId, history.slice(0, 12));
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
  function shouldRetirePlayer(player, seasonAge, row, season, playerMapKey) {
    const playerId = safeWorldIdentifier(playerMapKey) || safeWorldRecordIdentifier(player, "id");
    if (!playerId) return false;
    const group = safeWorldRecordText(player, "group");
    const position = safeWorldRecordText(player, "position");
    const isGoalkeeper = group === "goalkeeper" || groupForPosition(position) === "goalkeeper";
    const effectiveAge = Math.max(16, safeNumber(seasonAge, 18) - (isGoalkeeper ? 1 : 0));
    if (effectiveAge < 38) return false;
    if (effectiveAge >= 42) return true;
    const rating = safeNumber(safeWorldOwnValue(row, "averageRating"),
      safeNumber(safeWorldOwnValue(player, "lastRating"), 0));
    let chance = effectiveAge >= 41 ? 78 : effectiveAge >= 40 ? 55 : effectiveAge >= 39 ? 30 : 12;
    if (rating >= 7.4) chance -= 12;
    else if (rating > 0 && rating < 6.0) chance += 12;
    if (safeNumber(safeWorldOwnValue(player, "ovr"), 0) <= 55) chance += 12;
    return (hash(playerId + "|retirement|" + String(season)) % 100) < clamp(chance, 0, 100);
  }
  function worldPlayerRosterIdentifiers(world, player, playerMapKey) {
    const identifiers = new Set();
    const canonicalId = safeWorldIdentifier(playerMapKey) || safeWorldRecordIdentifier(player, "id");
    if (canonicalId) identifiers.add(canonicalId);
    const internalId = safeWorldRecordIdentifier(player, "id");
    if (internalId && !identifiers.has(internalId)) {
      const playerMap = safeWorldOwnValue(world, "players");
      const internalOwner = safeWorldOwnValue(playerMap, internalId);
      // Keep a legacy alias only when it is not another player's real map key.
      if (!internalOwner || internalOwner === player) identifiers.add(internalId);
    }
    return identifiers;
  }
  function retireWorldPlayer(world, player, season, seasonAge, playerMapKey) {
    const playerId = safeWorldIdentifier(playerMapKey) || safeWorldRecordIdentifier(player, "id");
    if (!world || !player || !playerId) return false;
    const currentClubId = safeWorldRecordIdentifier(player, "clubId");
    const clubs = safeWorldOwnValue(world, "clubs");
    const club = currentClubId && clubs && typeof clubs === "object"
      ? safeWorldOwnValue(clubs, currentClubId) : null;
    if (club && Array.isArray(safeWorldOwnValue(club, "roster"))) {
      const roster = safeWorldArrayField(club, "roster");
      const rosterIdentifiers = worldPlayerRosterIdentifiers(world, player, playerId);
      safeWorldSetField(club, "roster", roster.filter(id => !rosterIdentifiers.has(safeWorldIdentifier(id))));
    }
    if (currentClubId) safeWorldSetField(player, "previousClubId", currentClubId);
    safeWorldSetField(player, "clubId", "");
    safeWorldSetField(player, "leagueId", "");
    safeWorldSetField(player, "division", 0);
    safeWorldSetField(player, "contractSeasons", 0);
    safeWorldSetField(player, "freeAgent", false);
    safeWorldSetField(player, "transferListed", false);
    safeWorldSetField(player, "retired", true);
    const retiredSeason = Math.max(1, int(season, 1)) + 1;
    const retirementAge = Math.max(16,
      safeNumber(seasonAge, 0) || safeNumber(safeWorldOwnValue(player, "age"), 0) || 18);
    safeWorldSetField(player, "retiredSeason", retiredSeason);
    safeWorldSetField(player, "retirementAge", retirementAge);
    safeWorldSetField(player, "retirementReason", "age");

    let historyMap = safeWorldOwnValue(world, "playerHistory");
    if (!historyMap || typeof historyMap !== "object") {
      historyMap = {};
      safeWorldSetField(world, "playerHistory", historyMap);
    }
    const existingHistory = safeWorldOwnValue(historyMap, playerId);
    const history = Array.isArray(existingHistory) ? existingHistory : [];
    history.unshift({
      season: retiredSeason,
      club: safeWorldRecordText(club, "name"),
      country: safeWorldRecordText(club, "country"),
      type: "retirement",
      age: retirementAge
    });
    // Retirement is terminal: retain every previous history row under the canonical player-map key.
    safeWorldSetOwnValue(historyMap, playerId, history);
    const notes = safeWorldArrayField(world, "notes");
    notes.unshift({
      season: retiredSeason,
      type: "retirement",
      text: safeWorldRecordText(player, "name") + " اعتزل كرة القدم بعد نهاية الموسم."
    });
    safeWorldSetField(world, "notes", notes.slice(0, 30));
    return true;
  }
  function developPlayers(world, season) {
    const developmentSeason = Math.max(1, int(season, 1));
    if (Math.max(0, int(world.lastDevelopedSeason, 0)) >= developmentSeason) return false;
    const seasonStats = safeWorldOwnValue(world, "seasonStats");
    const seasonRows = safeWorldOwnValue(seasonStats, String(season));
    const stats = Array.isArray(seasonRows) ? seasonRows : [];
    const byId = new Map();
    stats.forEach(row => {
      const id = safeWorldRecordIdentifier(row, "id") || safeWorldRecordIdentifier(row, "playerId");
      if (id) byId.set(id, row);
    });
    const playerMap = safeWorldOwnValue(world, "players");
    const playerEntries = playerMap && typeof playerMap === "object" && !Array.isArray(playerMap)
      ? Object.entries(playerMap) : [];
    const seasonAges = new Map();
    const seasonRowsByPlayer = new Map();
    const playerIdForEntry = (mapKey, player) =>
      safeWorldIdentifier(mapKey) || safeWorldRecordIdentifier(player, "id");
    const rowForPlayer = (playerId, player) => {
      const canonicalRow = byId.get(playerId);
      if (canonicalRow) return canonicalRow;
      const internalId = safeWorldRecordIdentifier(player, "id");
      if (!internalId || internalId === playerId) return undefined;
      const internalOwner = safeWorldOwnValue(playerMap, internalId);
      if (internalOwner && internalOwner !== player) return undefined;
      return byId.get(internalId);
    };

    // Player-map keys are authoritative across progression, even when a legacy record's
    // internal id is stale or malformed. Statistics can still fall back to an unclaimed
    // legacy internal ID when no canonical-key row exists.
    for (const [mapKey, player] of playerEntries) {
      if (!player || typeof player !== "object" || isTrueFlag(safeWorldOwnValue(player, "retired"))) continue;
      const playerId = playerIdForEntry(mapKey, player);
      if (!playerId) continue;
      const row = rowForPlayer(playerId, player);
      const seasonAge = Math.min(43, Math.max(16, safeNumber(safeWorldOwnValue(player, "age"), 18) || 18));
      seasonAges.set(playerId, seasonAge);
      seasonRowsByPlayer.set(playerId, row);
      safeWorldSetField(player, "age", Math.min(43, seasonAge + 1));
      safeWorldSetField(player, "contractSeasons",
        Math.max(0, (safeNumber(safeWorldOwnValue(player, "contractSeasons"), 1) || 1) - 1));
      if (row) {
        const rowAppearances = safeNumber(safeWorldOwnValue(row, "appearances"), 0);
        const rowAverageRating = safeNumber(safeWorldOwnValue(row, "averageRating"), 0);
        safeWorldSetField(player, "lastRating", rowAverageRating);
        let delta = 0;
        if (seasonAge <= 23 && rowAppearances >= 10 && rowAverageRating >= 6.45) delta = rowAverageRating >= 7.25 ? 2 : 1;
        else if (seasonAge <= 28 && rowAppearances >= 16 && rowAverageRating >= 7.15) delta = 1;
        else if (seasonAge >= 31) delta = rowAverageRating < 6.4 ? -2 : -1;
        else if (seasonAge >= 29 && rowAverageRating < 6.0) delta = -1;
        const nextOverall = clamp(safeNumber(safeWorldOwnValue(player, "ovr"), 35) + delta, 35, 97);
        safeWorldSetField(player, "ovr", nextOverall);
        const potentialValue = safeNumber(safeWorldOwnValue(player, "potential"), null);
        if (potentialValue === null && safeWorldOwnValue(player, "potential") !== undefined) {
          safeWorldSetField(player, "potential", nextOverall);
        } else if (potentialValue !== null && potentialValue < nextOverall) {
          safeWorldSetField(player, "potential", nextOverall);
        }
      }
    }

    // Contracts now truly expire. Renewal and retirement decisions use the same canonical
    // identity that owns the player record and appears in the club roster.
    for (const [mapKey, player] of playerEntries) {
      if (!player || typeof player !== "object" || isTrueFlag(safeWorldOwnValue(player, "retired"))) continue;
      const playerId = playerIdForEntry(mapKey, player);
      if (!playerId) continue;
      const seasonAge = seasonAges.get(playerId);
      if (!Number.isFinite(seasonAge)) continue;
      const row = seasonRowsByPlayer.get(playerId);
      if (shouldRetirePlayer(player, seasonAge, row, season, playerId)) {
        retireWorldPlayer(world, player, season, seasonAge, playerId);
        continue;
      }
      const orphanedClubId = safeWorldRecordIdentifier(player, "clubId");
      const clubs = safeWorldOwnValue(world, "clubs");
      const club = orphanedClubId && clubs && typeof clubs === "object"
        ? safeWorldOwnValue(clubs, orphanedClubId) : null;
      if (isTrueFlag(safeWorldOwnValue(player, "freeAgent")) || !orphanedClubId || !club) {
        const wasFreeAgent = isTrueFlag(safeWorldOwnValue(player, "freeAgent"));
        const previousClubIdValue = safeWorldOwnValue(player, "previousClubId");
        const previousClubId = safeWorldIdentifier(previousClubIdValue || "");
        const hasStaleFreeAgentState = Boolean(orphanedClubId) || !wasFreeAgent
          || safeNumber(safeWorldOwnValue(player, "contractSeasons"), 0) > 0
          || Boolean(safeWorldRecordIdentifier(player, "leagueId"))
          || safeNumber(safeWorldOwnValue(player, "division"), 0) > 0
          || safeWorldOwnValue(player, "transferListed") === true;
        if (orphanedClubId && !previousClubIdValue) safeWorldSetField(player, "previousClubId", orphanedClubId);
        // Free-agent saves can retain a former-club roster entry even after clubId was cleared.
        const staleRosterClubIds = [orphanedClubId, previousClubId]
          .filter((clubId, index, ids) => clubId && ids.indexOf(clubId) === index);
        staleRosterClubIds.forEach(clubId => {
          const staleClub = clubs && typeof clubs === "object" ? safeWorldOwnValue(clubs, clubId) : null;
          if (staleClub && Array.isArray(safeWorldOwnValue(staleClub, "roster"))) {
            const roster = safeWorldArrayField(staleClub, "roster");
            const rosterIdentifiers = worldPlayerRosterIdentifiers(world, player, playerId);
            safeWorldSetField(staleClub, "roster", roster.filter(id => !rosterIdentifiers.has(safeWorldIdentifier(id))));
          }
        });
        if (hasStaleFreeAgentState) {
          safeWorldSetField(player, "clubId", "");
          safeWorldSetField(player, "leagueId", "");
          safeWorldSetField(player, "division", 0);
          safeWorldSetField(player, "contractSeasons", 0);
          safeWorldSetField(player, "freeAgent", true);
          const freeAgentSince = safeNumber(safeWorldOwnValue(player, "freeAgentSince"), 0);
          safeWorldSetField(player, "freeAgentSince", Number.isFinite(freeAgentSince) && freeAgentSince > 0
            ? freeAgentSince : safeNumber(season, 1) + 1);
          safeWorldSetField(player, "transferListed", false);
          if (!wasFreeAgent) {
            const notes = safeWorldArrayField(world, "notes");
            notes.unshift({ season: safeNumber(season, 1) + 1, type: "free-agent",
              text: safeWorldRecordText(player, "name") + " فقد ارتباطه بناديه السابق وأصبح متاحًا في سوق اللاعبين." });
            safeWorldSetField(world, "notes", notes.slice(0, 30));
          }
        }
        continue;
      }
      if (safeNumber(safeWorldOwnValue(player, "contractSeasons"), 0) > 0) continue;
      const roster = rosterPlayers(world, club);
      const sameRole = roster.filter(row => row.group === player.group && row !== player);
      const roleTarget = Math.max(1, Number(TARGETS[player.group]) || 1);
      const roleNeed = sameRole.length < roleTarget;
      const age = safeNumber(safeWorldOwnValue(player, "age"), 18) || 18;
      const quality = safeNumber(safeWorldOwnValue(player, "ovr"), 50) || 50;
      const clubPower = marketClubPower(club);
      const renewalChance = clamp(0.12 + (quality >= clubPower - 2 ? 0.28 : 0)
        + (safeNumber(safeWorldOwnValue(player, "lastRating"), 0) >= 7.0 ? 0.16 : 0) + (roleNeed ? 0.20 : 0)
        - Math.max(0, age - 30) * 0.055, 0.02, 0.76);
      const roll = hash(playerId + "|" + season + "|contract-renewal-v2") / 4294967296;
      if (roll < renewalChance && age < 36) {
        const renewedTerm = 2 + (hash(playerId + "|" + season + "|renewed-term") % 3);
        safeWorldSetField(player, "contractSeasons", renewedTerm);
        safeWorldSetField(player, "freeAgent", false);
        safeWorldSetField(player, "lastRenewedSeason", safeNumber(season, 1) + 1);
        world.notes.unshift({ season: safeNumber(season, 1) + 1, type: "contract",
          text: safeWorldRecordText(player, "name") + " جدد عقده مع " + safeWorldRecordText(club, "name")
            + " لمدة " + renewedTerm + " مواسم." });
      } else {
        const clubRoster = safeWorldArrayField(club, "roster");
        const rosterIdentifiers = worldPlayerRosterIdentifiers(world, player, playerId);
        safeWorldSetField(club, "roster", clubRoster.filter(id => !rosterIdentifiers.has(safeWorldIdentifier(id))));
        safeWorldSetField(player, "previousClubId", safeWorldRecordIdentifier(club, "id") || orphanedClubId);
        safeWorldSetField(player, "freeAgent", true);
        safeWorldSetField(player, "freeAgentSince", safeNumber(season, 1) + 1);
        safeWorldSetField(player, "clubId", "");
        safeWorldSetField(player, "leagueId", "");
        safeWorldSetField(player, "division", 0);
        world.notes.unshift({ season: safeNumber(season, 1) + 1, type: "free-agent",
          text: safeWorldRecordText(player, "name") + " انتهى عقده وأصبح لاعبًا حرًا." });
      }
    }
    world.notes = (Array.isArray(world.notes) ? world.notes : []).slice(0, 30);
    world.lastDevelopedSeason = developmentSeason;
    return true;
  }
  function advanceToSeason(save, nextSeason, db) {
    const world = ensureState(save, db);
    const next = Math.max(1, int(nextSeason, int(save.season, 1)));
    if (isFutureWorldSchema(world)) {
      return { season: Math.max(1, int(safeWorldOwnValue(world, "currentSeason"), int(save.season, 1))),
        moves: [], alreadyAdvanced: true, readOnly: true, futureSchema: true };
    }
    const lastAdvancedTo = Math.max(0, safeNumber(safeWorldOwnValue(world, "lastAdvancedTo"), 0));
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
    safeWorldSetField(world, "lastAdvancedTo", next);
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
      .map(player => {
        const savedGoalkeeping = safeNumber(player && player.goalkeeping, 0);
        const fallbackOverall = safeNumber(player && player.ovr, 0) || 55;
        return clamp(savedGoalkeeping > 0 ? savedGoalkeeping : fallbackOverall, 35, 99);
      })
      .sort((a, b) => b - a);
    const starter = goalkeepers.length ? goalkeepers[0] : null;
    const backup = goalkeepers.length > 1 ? goalkeepers[1] : starter;
    const goalkeeping = starter == null ? null : clamp(Math.round(starter * 0.88 + backup * 0.12), 35, 99);
    const clubPower = positiveClubPower(club);
    return { power: clubPower > 0 ? clubPower : null, goalkeeping };
  }
  function getClubPower(save, name, country, db) {
    const world = ensureState(save, db);
    const club = findClubByIdentity(world, name, country);
    if (!club) return null;
    const clubPower = positiveClubPower(club);
    return clubPower > 0 ? clubPower : null;
  }
  function transferTargets(save, db) {
    const world = ensureState(save, db);
    return Object.values(world.clubs).map(club => {
      const players = activeRosterIds(world, club).map(playerId => {
        const player = safeWorldOwnValue(world.players, playerId);
        return player ? {
          id: playerId, name: player.name, position: player.position, ovr: player.ovr, potential: player.potential,
          age: player.age, contractSeasons: player.contractSeasons
        } : null;
      }).filter(Boolean);
      const stars = players.slice().sort((a, b) =>
        safeNumber(b && b.ovr, 50) - safeNumber(a && a.ovr, 50)).slice(0, 7).map(player => player.name);
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
        power: marketClubPower(club), prestige: club.prestige, confederation: club.confederation,
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
    if (isFutureWorldSchema(world)) {
      const objectMap = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const arrayValue = value => Array.isArray(value) ? value : [];
      const clubs = objectMap(safeWorldOwnValue(world, "clubs"));
      const players = objectMap(safeWorldOwnValue(world, "players"));
      const transfers = arrayValue(safeWorldOwnValue(world, "transfers"));
      const marketReports = arrayValue(safeWorldOwnValue(world, "marketReports"));
      const completed = arrayValue(safeWorldOwnValue(world, "completedSeasons"));
      return {
        season: Math.max(1, int(safeWorldOwnValue(world, "currentSeason"), int(save.season, 1))),
        clubCount: Object.keys(clubs).length, playerCount: Object.keys(players).length,
        totalTransfers: transfers.length, lastMarket: marketReports[0] || null,
        recentTransfers: transfers.slice(0, 6), goalsLeaders: [], assistLeaders: [], leagueTable: [],
        progress: Math.round(progress * 100), completedSeasons: completed.length,
        readOnly: true, futureSchema: true,
        note: "الحفظ يستخدم إصدارًا أحدث من محرك العالم الحالي؛ تم فتحه للقراءة فقط دون تعديل بياناته."
      };
    }
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
    const completedWithoutMatches = hasCompletedSeasonMarker(world, year) && !hasSavedMatches;
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
    version: VERSION, normalize, normalizePosition, normalizeClubDivision, divisionForClub, clubKey, syncClubDivisionMetadata, groupForPosition, positionProductionProfile, playerRoleWeight,
    ensureState, isFutureWorldSchema, completeSeason, advanceToSeason, getSeasonLines, getClubPower, getClubMatchProfile, transferTargets,
    sortCompletedSeasonMarkers,
    getLeagueTable, leaderboard, dashboard, rosterPlayers, withTransferMarketTransaction,
    rememberTransferClubEndpoints, isTrueFlag, activeRosterIds
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
  const hasCompletedSeasonMarker = (world, season) => Array.isArray(world && world.completedSeasons)
    && world.completedSeasons.some(value => safeNumber(value, NaN) === season);
  // Persisted standings may contain arrays, boxed numbers, Symbols, or hostile objects.
  // Only primitive numeric values and numeric strings are valid table metrics.
  function hasStandingValue(value) {
    return value !== null && value !== undefined
      && !(typeof value === "string" && value.trim() === "");
  }
  function safeStandingText(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  }
  function safeStandingRank(value) {
    const numeric = safeNumber(value, NaN);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }
  const clamp = (value, min, max) => Math.max(min, Math.min(max, safeNumber(value, 0)));
  const int = (value, fallback = 0) => {
    const numeric = safeNumber(value, NaN);
    return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
  };
  function safeWorldOwnValue(record, key) {
    try {
      if (!record || typeof record !== "object" || !Object.prototype.hasOwnProperty.call(record, key)) return undefined;
      return record[key];
    } catch (_) { return undefined; }
  }
  function clubPowerForSimulation(club, fallback = 55) {
    const currentPower = safeNumber(club && club.power, 0);
    const basePower = safeNumber(club && club.basePower, 0);
    return clamp(currentPower > 0 ? currentPower : basePower > 0 ? basePower : fallback, 25, 100);
  }
  const divisionForClub = club => base.divisionForClub(club);
  function safeSimulationIdentifier(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  }
  function simulationClubEntries(world) {
    const source = world && world.clubs;
    if (!source || typeof source !== "object" || Array.isArray(source)) return [];
    let rows;
    try { rows = Object.entries(source); } catch (_) { return []; }
    const byId = new Map();
    for (const [key, club] of rows) {
      if (!club || typeof club !== "object") continue;
      let savedId, savedLeagueId, savedDivision;
      try {
        savedId = club.id;
        savedLeagueId = club.leagueId;
        savedDivision = club.division;
      } catch (_) { continue; }
      const missingId = savedId === undefined || savedId === null
        || (typeof savedId === "string" && savedId.trim() === "");
      const clubId = missingId ? safeSimulationIdentifier(key) : safeSimulationIdentifier(savedId);
      const leagueId = safeSimulationIdentifier(savedLeagueId);
      const division = base.normalizeClubDivision(savedDivision, 1);
      if (!clubId) continue;
      const entry = { key, club, clubId, leagueId, division };
      const current = byId.get(clubId);
      if (!current || (key === clubId && current.key !== current.clubId)) byId.set(clubId, entry);
    }
    return Array.from(byId.values());
  }
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
  function playerOverall(player, fallback = 50) {
    return clamp(safeNumber(player && player.ovr, 0) || fallback, 1, 99);
  }

  const normalize = value => String(value == null ? "" : value).normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06FF]/g, "");
  function groupRows(world) {
    const groups = new Map();
    const source = world && world.clubs;
    if (!source || typeof source !== "object" || Array.isArray(source)) return groups;
    let rows;
    try { rows = Object.entries(source); } catch (_) { return groups; }
    const safeIdentifier = value => {
      if (typeof value === "string") return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      return "";
    };
    const unique = new Map();
    for (const [key, club] of rows) {
      if (!club || typeof club !== "object") continue;
      let savedId, savedLeagueId, savedDivision;
      try {
        savedId = club.id;
        savedLeagueId = club.leagueId;
        savedDivision = club.division;
      } catch (_) { continue; }
      const missingId = savedId === undefined || savedId === null
        || (typeof savedId === "string" && savedId.trim() === "");
      const clubId = missingId ? safeIdentifier(key) : safeIdentifier(savedId);
      const leagueId = safeIdentifier(savedLeagueId);
      if (!clubId || !leagueId) continue;
      let division = 0;
      if (savedDivision === undefined || savedDivision === null
        || (typeof savedDivision === "string" && savedDivision.trim() === "")) {
        division = 1;
      } else if (typeof savedDivision === "number" || typeof savedDivision === "string") {
        const numeric = typeof savedDivision === "string" ? Number(savedDivision.trim()) : savedDivision;
        if (Number.isSafeInteger(numeric) && numeric >= 1) division = numeric;
      }
      if (division < 1 || division > 2) continue;
      const entry = { key, club, clubId, leagueId, division };
      const current = unique.get(clubId);
      if (!current || (key === clubId && current.key !== current.clubId)) unique.set(clubId, entry);
    }
    for (const entry of unique.values()) {
      const key = entry.leagueId + ":" + entry.division;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry.club);
    }
    return groups;
  }

  function playersForClub(world, club) {
    return base.rosterPlayers(world, club);
  }
  function safeRecordIdentifier(record, field) {
    try {
      const value = record && record[field];
      if (typeof value === "string") return value.trim();
      return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
    } catch (_) { return ""; }
  }
  function activeRosterIdsForClub(world, club) {
    return typeof base.activeRosterIds === "function" ? base.activeRosterIds(world, club) : [];
  }
  function makeLineup(world, club, playerKeyByObject) {
    const rows = playersForClub(world, club);
    const selected = [];
    const playerIdentity = player => {
      const mapped = playerKeyByObject && typeof playerKeyByObject.get === "function"
        ? playerKeyByObject.get(player) : "";
      return safeSimulationIdentifier(mapped) || safeRecordIdentifier(player, "id");
    };
    const quotas = [
      ["goalkeeper", 1], ["defender", 4], ["midfielder", 4], ["attacker", 2]
    ];
    quotas.forEach(([group, count]) => {
      rows.filter(player => player.group === group)
        .sort((a, b) => playerOverall(b) - playerOverall(a)
          || playerIdentity(a).localeCompare(playerIdentity(b)))
        .slice(0, count).forEach(player => {
          const playerId = playerIdentity(player);
          if (playerId && !selected.some(row => playerIdentity(row) === playerId)) selected.push(player);
        });
    });
    rows.slice().sort((a, b) => playerOverall(b) - playerOverall(a)
      || playerIdentity(a).localeCompare(playerIdentity(b)))
      .forEach(player => {
        const playerId = playerIdentity(player);
        if (selected.length < 11 && playerId && !selected.some(row => playerIdentity(row) === playerId)) {
          selected.push(player);
        }
      });
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
  function expandWorldMatches(world, matches, expectedSeason) {
    if (!Array.isArray(matches)) return [];
    const clubs = world && world.clubs && typeof world.clubs === "object" ? world.clubs : {};
    const requiredSeason = Number.isSafeInteger(expectedSeason) && expectedSeason >= 1 ? expectedSeason : null;
    const legacySeasonFallback = requiredSeason === null ? 1 : requiredSeason;
    const safeText = value => {
      if (typeof value === "string") return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      return "";
    };
    const isMissingLegacyValue = value => value === undefined || value === null
      || (typeof value === "string" && value.trim() === "");
    const safePositiveInteger = (value, fallback) => {
      if (isMissingLegacyValue(value)) return fallback;
      const numeric = safeNumber(value, NaN);
      return Number.isSafeInteger(numeric) && numeric >= 1 ? numeric : null;
    };
    const safeNonNegativeInteger = (value, fallback = 0) => {
      if (isMissingLegacyValue(value)) return fallback;
      const numeric = safeNumber(value, NaN);
      return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
    };
    const expanded = [];
    for (const match of matches) {
      if (!match || typeof match !== "object" || Array.isArray(match)) continue;
      try {
        const homeClubId = safeText(match.homeClubId);
        const awayClubId = safeText(match.awayClubId);
        if (!homeClubId || !awayClubId) continue;
        const season = safePositiveInteger(match.season, legacySeasonFallback);
        const matchday = safePositiveInteger(match.matchday, 1);
        const homeGoals = safeNonNegativeInteger(match.homeGoals, 0);
        const awayGoals = safeNonNegativeInteger(match.awayGoals, 0);
        if (season === null || (requiredSeason !== null && season !== requiredSeason)
          || matchday === null || homeGoals === null || awayGoals === null
          || homeClubId === awayClubId) continue;
        const division = base.normalizeClubDivision(match.division, 1);
        if (!Number.isSafeInteger(division) || division < 1) continue;
        const competitionId = isMissingLegacyValue(match.competitionId) ? "league" : safeText(match.competitionId);
        if (!competitionId) continue;
        const home = clubs[homeClubId] || null;
        const away = clubs[awayClubId] || null;
        expanded.push({
          season, competitionId, division, matchday, homeClubId, awayClubId, homeGoals, awayGoals,
          id: "world-match-" + season + "-" + hash([season, competitionId, division, matchday, homeClubId, awayClubId].join("|")).toString(36),
          home: safeText(home && home.name), away: safeText(away && away.name),
          result: homeGoals === awayGoals ? "draw" : homeGoals > awayGoals ? "home-win" : "away-win"
        });
      } catch (_) {
        // A malformed saved match must not prevent the rest of a completed season from loading.
      }
    }
    return expanded;
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
      const roleWeight = safeNumber(role, fallbackRole) || 1;
      return Math.max(0.05, playerOverall(player) - 27) * roleWeight;
    });
    let roll = rng() * weights.reduce((sum, value) => sum + value, 0);
    for (let i = 0; i < rows.length; i++) { roll -= weights[i]; if (roll <= 0) return rows[i]; }
    return rows[rows.length - 1];
  }
  function lineupForMatch(world, club, cache, playerKeyByObject) {
    if (!(cache instanceof Map)) return makeLineup(world, club, playerKeyByObject);
    if (!cache.has(club.id)) cache.set(club.id, makeLineup(world, club, playerKeyByObject));
    return cache.get(club.id);
  }
  function playMatch(world, home, away, season, division, matchday, sequence, accumulators, competitionId, lineupCache, playerKeyByObject) {
    const playerIdentity = player => {
      const mapped = playerKeyByObject && typeof playerKeyByObject.get === "function"
        ? playerKeyByObject.get(player) : "";
      return safeSimulationIdentifier(mapped) || safeRecordIdentifier(player, "id");
    };
    const seed = hash([season, division, matchday, home.id, away.id, competitionId || "league", "match-v2"].join("|"));
    const rng = random(seed);
    const homeLineup = lineupForMatch(world, home, lineupCache, playerKeyByObject);
    const awayLineup = lineupForMatch(world, away, lineupCache, playerKeyByObject);
    const homeStrength = clamp(clubPowerForSimulation(home), 25, 95);
    const awayStrength = clamp(clubPowerForSimulation(away), 25, 95);
    const xgHome = clamp(1.28 + (homeStrength - awayStrength) * 0.027 + 0.16, 0.28, 3.05);
    const xgAway = clamp(1.24 + (awayStrength - homeStrength) * 0.027 - 0.06, 0.22, 2.9);
    const homeGoals = poisson(rng, xgHome), awayGoals = poisson(rng, xgAway);
    const homeGoalContributors = [], awayGoalContributors = [];
    function addAppearance(lineup, attackingGoals, concedingGoals, resultForClub, clubId) {
      lineup.forEach(player => {
        const stat = accumulators.get(playerIdentity(player));
        if (!stat) return;
        stat.appearances++;
        stat.clubId = clubId;
        stat.leagueId = String(world.clubs[clubId].leagueId || "");
        stat.division = divisionForClub(world.clubs[clubId]);
        let rating = 6.12 + (playerOverall(player, 55) - 65) * 0.012
          + (resultForClub === "win" ? 0.24 : resultForClub === "draw" ? 0.04 : -0.15)
          + (player.group === "goalkeeper" || player.group === "defender" ? (concedingGoals === 0 ? 0.3 : 0) : 0)
          + rng() * 0.48 - 0.24;
        stat.ratingTotal += clamp(rating, 4.4, 9.8);
      });
    }
    for (let i = 0; i < homeGoals; i++) {
      const scorer = weightedPick(homeLineup, rng, "goal");
      if (!scorer) break;
      const scorerId = playerIdentity(scorer);
      const scorerStat = accumulators.get(scorerId);
      if (scorerStat) scorerStat.goals++;
      if (scorerId) homeGoalContributors.push(scorerId);
      const helperPool = homeLineup.filter(player => playerIdentity(player) !== scorerId);
      if (helperPool.length && rng() < 0.72) {
        const helper = weightedPick(helperPool, rng, "assist");
        if (helper) {
          const helperStat = accumulators.get(playerIdentity(helper));
          if (helperStat) helperStat.assists++;
        }
      }
    }
    for (let i = 0; i < awayGoals; i++) {
      const scorer = weightedPick(awayLineup, rng, "goal");
      if (!scorer) break;
      const scorerId = playerIdentity(scorer);
      const scorerStat = accumulators.get(scorerId);
      if (scorerStat) scorerStat.goals++;
      if (scorerId) awayGoalContributors.push(scorerId);
      const helperPool = awayLineup.filter(player => playerIdentity(player) !== scorerId);
      if (helperPool.length && rng() < 0.72) {
        const helper = weightedPick(helperPool, rng, "assist");
        if (helper) {
          const helperStat = accumulators.get(playerIdentity(helper));
          if (helperStat) helperStat.assists++;
        }
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
      country: club.country, clubId: club.id, club: club.name, power: Math.round(clubPowerForSimulation(club)),
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
    // Precompute strength only from unique clubs with safe persisted identifiers.
    if (!world || typeof world !== "object") return [];
    const seasonNumber = safeNumber(season, NaN);
    if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 1) return [];
    const players = world.players && typeof world.players === "object" ? world.players : {};
    const clubEntries = simulationClubEntries(world);
    const clubsById = new Map(clubEntries.map(entry => [entry.clubId, entry]));
    const powerByLeagueDivision = new Map();
    clubEntries.forEach(entry => {
      if (!entry.leagueId || entry.division < 1) return;
      const key = entry.leagueId + "|" + entry.division;
      const summary = powerByLeagueDivision.get(key) || { total: 0, count: 0 };
      const savedPower = clubPowerForSimulation(entry.club);
      summary.total += savedPower > 0 ? clamp(savedPower, 25, 100) : 55;
      summary.count++;
      powerByLeagueDivision.set(key, summary);
    });
    const leagueStrengthFor = (leagueId, division) => {
      const safeLeagueId = safeSimulationIdentifier(leagueId);
      const divisionNumber = base.normalizeClubDivision(division, 0);
      if (divisionNumber < 1 || !safeLeagueId) return 55;
      const summary = powerByLeagueDivision.get(safeLeagueId + "|" + divisionNumber);
      return summary && summary.count ? Math.round(summary.total / summary.count) : 55;
    };
    return Object.entries(players).filter(([playerMapKey, player]) => {
      const playerId = safeSimulationIdentifier(playerMapKey) || safeRecordIdentifier(player, "id");
      if (!playerId || !player || base.isTrueFlag(player.retired) || base.isTrueFlag(player.freeAgent)) return false;
      const clubId = safeSimulationIdentifier(player.clubId);
      return !!clubId && clubsById.has(clubId);
    }).map(([playerMapKey, player]) => {
      const playerId = safeSimulationIdentifier(playerMapKey) || safeRecordIdentifier(player, "id");
      const playerClubId = safeSimulationIdentifier(player.clubId);
      const savedAccumulator = accumulators && typeof accumulators.get === "function"
        ? accumulators.get(playerId) : null;
      const acc = savedAccumulator && typeof savedAccumulator === "object" && !Array.isArray(savedAccumulator)
        ? savedAccumulator : playerAccumulator();
      const accumulatorClubId = safeSimulationIdentifier(acc.clubId);
      const historicalEntry = accumulatorClubId ? clubsById.get(accumulatorClubId) : null;
      const currentEntry = clubsById.get(playerClubId);
      const historicalClub = accumulatorClubId
        ? (historicalEntry ? historicalEntry.club : null)
        : currentEntry.club;
      const apps = Math.min(MAX_WORLD_SEASON_APPEARANCES,
        Math.max(0, Math.floor(safeNumber(acc.appearances, 0))));
      const goals = Math.min(MAX_WORLD_SEASON_STAT,
        Math.max(0, Math.floor(safeNumber(acc.goals, 0))));
      const assists = Math.min(MAX_WORLD_SEASON_STAT,
        Math.max(0, Math.floor(safeNumber(acc.assists, 0))));
      const ratingTotal = Math.min(apps * 10, Math.max(0, safeNumber(acc.ratingTotal, 0)));
      const rating = apps ? Number((clamp(ratingTotal / apps, 0, 10)).toFixed(2)) : 0;
      const leagueId = safeSimulationIdentifier(acc.leagueId)
        || safeSimulationIdentifier(player.leagueId)
        || safeSimulationIdentifier(historicalClub && historicalClub.leagueId);
      const accumulatorDivision = base.normalizeClubDivision(acc.division, 0);
      const playerDivision = base.normalizeClubDivision(player.division, 0);
      const historicalDivision = historicalClub ? divisionForClub(historicalClub) : 0;
      const leagueDivision = accumulatorDivision >= 1 ? accumulatorDivision
        : historicalClub ? historicalDivision : playerDivision;
      const leagueStrength = leagueDivision >= 1 ? leagueStrengthFor(leagueId, leagueDivision) : 55;
      const age = clamp(safeNumber(player.age, 18) || 18, 14, 60);
      const ovr = clamp(safeNumber(player.ovr, 50) || 50, 1, 99);
      const potential = clamp(safeNumber(player.potential, ovr) || ovr, 1, 99);
      const savedDivision = leagueDivision;
      const prestige = clamp(safeNumber(historicalClub ? historicalClub.prestige : player.prestige, 0), 0, 100);
      const row = {
        id: playerId, playerId, season: seasonNumber, name: player.name, club: historicalClub ? historicalClub.name : "",
        clubName: historicalClub ? historicalClub.name : "",
        clubId: accumulatorClubId || playerClubId,
        country: historicalClub ? historicalClub.country : player.country || "",
        leagueId, division: savedDivision,
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
    const uniqueTeams = new Map();
    for (const club of Array.isArray(clubs) ? clubs : []) {
      if (!club || typeof club !== "object") continue;
      let savedId;
      try { savedId = club.id; } catch (_) { continue; }
      const id = safeSimulationIdentifier(savedId);
      if (!id || uniqueTeams.has(id)) continue;
      uniqueTeams.set(id, { id, club });
    }
    const teams = Array.from(uniqueTeams.values());
    const teamCount = teams.length;
    if (teamCount < 2) return [];
    let target = Math.max(0, Math.min(60, int(matchesPerClub, 2 * (teamCount - 1))));
    if (teamCount % 2 === 1 && target % 2 === 1) target--;
    if (!target) return [];
    const fixtures = [], homeCounts = new Map(teams.map(team => [team.id, 0]));
    let matchday = 0;
    const addFixture = (first, second, day, cycle) => {
      if (!first || !second || first.id === second.id) return;
      const firstId = first.id, secondId = second.id;
      const firstHomes = homeCounts.get(firstId) || 0, secondHomes = homeCounts.get(secondId) || 0;
      let home, away;
      if (firstHomes < secondHomes) { home = first; away = second; }
      else if (secondHomes < firstHomes) { home = second; away = first; }
      else if (hash([seed, cycle, day, firstId, secondId, "balanced-home"].join("|")) % 2 === 0) {
        home = first; away = second;
      } else { home = second; away = first; }
      homeCounts.set(home.id, (homeCounts.get(home.id) || 0) + 1);
      fixtures.push({ home: home.club, away: away.club, round: day });
    };
    const cycleSize = teamCount - 1, fullCycles = Math.floor(target / cycleSize), remainder = target % cycleSize;
    for (let cycle = 0; cycle < fullCycles; cycle++) {
      let rotation = teams.slice();
      if (rotation.length % 2) rotation.push(null);
      const roundCount = rotation.length - 1;
      for (let round = 0; round < roundCount; round++) {
        matchday++;
        for (let index = 0; index < rotation.length / 2; index++) {
          const first = rotation[index], second = rotation[rotation.length - 1 - index];
          if (first && second) addFixture(first, second, matchday, cycle);
        }
        const fixed = rotation[0], rest = rotation.slice(1);
        rest.unshift(rest.pop());
        rotation = [fixed].concat(rest);
      }
    }
    const remainderPairs = [], usedPairs = new Set();
    const addRemainderPair = (left, right) => {
      if (left === right) return;
      const low = Math.min(left, right), high = Math.max(left, right), key = low + "|" + high;
      if (usedPairs.has(key)) return;
      usedPairs.add(key);
      remainderPairs.push([teams[left], teams[right]]);
    };
    for (let distance = 1; distance <= Math.floor(remainder / 2); distance++) {
      for (let index = 0; index < teamCount; index++) addRemainderPair(index, (index + distance) % teamCount);
    }
    if (remainder % 2 === 1 && teamCount % 2 === 0) {
      for (let index = 0; index < teamCount / 2; index++) addRemainderPair(index, index + teamCount / 2);
    }
    const remainderMatchdays = [];
    remainderPairs.forEach(pair => {
      let dayIndex = 0;
      while (dayIndex < remainderMatchdays.length
        && remainderMatchdays[dayIndex].some(row => row.includes(pair[0]) || row.includes(pair[1]))) dayIndex++;
      if (!remainderMatchdays[dayIndex]) remainderMatchdays[dayIndex] = [];
      remainderMatchdays[dayIndex].push(pair);
    });
    remainderMatchdays.forEach(dayPairs => {
      matchday++;
      dayPairs.forEach(([home, away]) => addFixture(home, away, matchday, fullCycles));
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
    const year = Math.max(1, int(season, int(save.season, 1)));
    if (base.isFutureWorldSchema(world)) {
      const objectMap = field => {
        const value = world[field];
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
      };
      const seasonKey = String(year);
      const savedRows = objectMap("seasonStats")[seasonKey];
      const savedTables = objectMap("leagueTables")[seasonKey];
      const savedMatches = objectMap("matchesBySeason")[seasonKey];
      const savedCompetitions = objectMap("competitionsBySeason")[seasonKey];
      return {
        season: year,
        rows: Array.isArray(savedRows) ? savedRows : [],
        tables: savedTables && typeof savedTables === "object" && !Array.isArray(savedTables) ? savedTables : {},
        matches: Array.isArray(savedMatches) ? savedMatches.slice() : [],
        competitions: Array.isArray(savedCompetitions) ? savedCompetitions.slice() : [],
        readOnly: true, futureSchema: true
      };
    }
    world.matchesBySeason = world.matchesBySeason && typeof world.matchesBySeason === "object" ? world.matchesBySeason : {};
    world.leagueTables = world.leagueTables && typeof world.leagueTables === "object" ? world.leagueTables : {};
    world.seasonStats = world.seasonStats && typeof world.seasonStats === "object" ? world.seasonStats : {};
    world.competitionsBySeason = world.competitionsBySeason && typeof world.competitionsBySeason === "object" ? world.competitionsBySeason : {};
    if (Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year))) {
      const seasonKey = String(year);
      const savedRows = world.seasonStats[seasonKey];
      const savedTables = world.leagueTables[seasonKey];
      const savedCompetitions = world.competitionsBySeason[seasonKey];
      return {
        season: year,
        rows: Array.isArray(savedRows) ? savedRows : [],
        tables: savedTables && typeof savedTables === "object" && !Array.isArray(savedTables) ? savedTables : {},
        matches: expandWorldMatches(world, world.matchesBySeason[seasonKey], year),
        competitions: Array.isArray(savedCompetitions) ? savedCompetitions : []
      };
    }
    const playerKeyByObject = new WeakMap();
    const accumulators = new Map();
    for (const [playerMapKey, player] of Object.entries(world.players || {})) {
      if (!player || typeof player !== "object") continue;
      const playerId = safeSimulationIdentifier(playerMapKey) || safeRecordIdentifier(player, "id");
      if (!playerId) continue;
      if (!playerKeyByObject.has(player)) playerKeyByObject.set(player, playerId);
      accumulators.set(playerId, playerAccumulator());
    }
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
            const fixture = playMatch(world, home, away, year, division, round + 1, ++sequence, accumulators, "league", lineupCache, playerKeyByObject);
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
            const fixture = playMatch(world, home, away, year, division, rounds + round + 1, ++sequence, accumulators, "league", lineupCache, playerKeyByObject);
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
                rounds * 2 + round + 1, ++sequence, accumulators, "league", lineupCache, playerKeyByObject);
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
                  rounds * 3 + round + 1, ++sequence, accumulators, "league", lineupCache, playerKeyByObject);
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
              fixture.round, ++sequence, accumulators, "league", lineupCache, playerKeyByObject);
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
        const homePower = clubPowerForSimulation(home);
        const awayPower = clubPowerForSimulation(away);
        let homeGoals = poisson(matchRng, clamp(1.24 + (homePower - awayPower) * 0.025 + 0.08, 0.2, 2.8));
        let awayGoals = poisson(matchRng, clamp(1.20 + (awayPower - homePower) * 0.025, 0.2, 2.7));
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
    const standingPoints = row => safeNumber(row && row.pts, 0);
    const standingGoalDifference = row => {
      const saved = safeNumber(row && row.gd, NaN);
      return Number.isFinite(saved) ? saved
        : safeNumber(row && row.gf, 0) - safeNumber(row && row.ga, 0);
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
          .map(value => safeNumber(value, NaN))
          .filter(value => Number.isSafeInteger(value) && value > 0))).sort((a, b) => a - b);
        if (!qualificationPlaces.length) return;
        const qualificationPlaceSet = new Set(qualificationPlaces);
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
            const hasSavedRank = hasStandingValue(row && row.rank);
            const savedRank = safeStandingRank(row && row.rank);
            // Array order is a legacy fallback only when rank is absent; a malformed
            // explicit rank must not be converted into a qualifying position.
            return { row, rank: savedRank === null ? (hasSavedRank ? null : index + 1) : savedRank };
          }).filter(entry => entry.rank !== null && qualificationPlaceSet.has(entry.rank))
            .sort((a, b) => a.rank - b.rank
              || standingPoints(b.row) - standingPoints(a.row)
              || standingGoalDifference(b.row) - standingGoalDifference(a.row)
              || safeStandingText(a.row && a.row.clubId).localeCompare(safeStandingText(b.row && b.row.clubId)));
          const eligibleRankedRows = rankedRows.filter(entry => {
            const row = entry.row || {};
            const clubId = safeStandingText(row.clubId);
            const club = clubId && world.clubs ? world.clubs[clubId] : null;
            if (!club || String(club.leagueId || "") !== leagueId || divisionForClub(club) !== 1
              || String(club.confederation || "") !== String(def.confederation || "")) return false;
            if (hasStandingValue(row.leagueId)) {
              const rowLeagueId = safeStandingText(row.leagueId);
              if (!rowLeagueId || rowLeagueId !== leagueId) return false;
            }
            if (hasStandingValue(row.division)) {
              const rowDivision = safeNumber(row.division, NaN);
              if (!Number.isInteger(rowDivision) || rowDivision !== 1) return false;
            }
            return true;
          });
          const qualifyingRankCounts = new Map();
          eligibleRankedRows.forEach(entry => {
            qualifyingRankCounts.set(entry.rank, (qualifyingRankCounts.get(entry.rank) || 0) + 1);
          });
          const seenLeagueClubIds = new Set();
          for (const entry of eligibleRankedRows) {
            // Duplicate eligible ranks are ambiguous; do not award the same slot twice.
            if (qualifyingRankCounts.get(entry.rank) !== 1) continue;
            const row = entry.row || {};
            const clubId = safeStandingText(row.clubId);
            if (!clubId || seenLeagueClubIds.has(clubId)) continue;
            const club = world.clubs[clubId];
            seenLeagueClubIds.add(clubId);
            candidates.push({
              club, rank: entry.rank,
              globalTier: safeNumber(profile && profile.globalTier, 99) || 99,
              leagueStrength: safeNumber(profile && profile.strength, 0),
              points: standingPoints(row),
              goalDifference: standingGoalDifference(row)
            });
          }
        }
        candidates.sort((a, b) => a.rank - b.rank || a.globalTier - b.globalTier
          || b.leagueStrength - a.leagueStrength || b.points - a.points
          || b.goalDifference - a.goalDifference
          || normalizedClubPower(b.club) - normalizedClubPower(a.club)
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
          const hasLeagueRowRanks = leagueRows.some(row => row && hasStandingValue(row.rank));
          const leagueClubAtRank = rank => {
            const candidates = hasLeagueRowRanks
              ? leagueRows.filter(row => row && safeStandingRank(row.rank) === rank)
              : [leagueRows[rank - 1]];
            return candidates.map(row => {
              if (!row) return null;
              const clubId = safeStandingText(row.clubId);
              if (!clubId) return null;
              const club = world.clubs && world.clubs[clubId];
              const clubDivision = divisionForClub(club);
              if (!club || String(club.leagueId || "") !== leagueId || clubDivision !== 1) return null;
              if (hasStandingValue(row.leagueId)) {
                const rowLeagueId = safeStandingText(row.leagueId);
                if (!rowLeagueId || rowLeagueId !== leagueId) return null;
              }
              if (hasStandingValue(row.division)) {
                const rowDivision = safeNumber(row.division, NaN);
                if (!Number.isInteger(rowDivision) || rowDivision !== 1) return null;
              }
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
    if (world.promotionHistory.some(row => safeNumber(row && row.season, NaN) === destinationSeason)) return [];
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
    const safeIdentifier = value => {
      if (typeof value === "string") return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      return "";
    };
    const isMissingIdentifier = value => value === undefined || value === null
      || (typeof value === "string" && value.trim() === "");
    const leagueIds = new Set();
    Object.values(world.clubs || {}).forEach(club => {
      const leagueId = safeIdentifier(club && club.leagueId);
      if (leagueId) leagueIds.add(leagueId);
    });
    const eligibleTableRows = (rows, leagueId, expectedDivision) => {
      const eligible = [];
      let sourceIndex = 0;
      for (const row of Array.isArray(rows) ? rows : []) {
        const index = sourceIndex++;
        const clubId = safeIdentifier(row && row.clubId);
        if (!clubId) continue;
        const club = world.clubs && world.clubs[clubId];
        if (!club || safeIdentifier(club.leagueId) !== leagueId) continue;
        const savedClubId = safeIdentifier(club.id);
        if (!isMissingIdentifier(club.id) && (!savedClubId || savedClubId !== clubId)) continue;
        // Only a genuinely absent legacy division defaults to the top flight.
        // Explicit but malformed tiers must not be coerced into division 1.
        const savedDivision = club.division;
        const hasExplicitDivision = savedDivision !== undefined && savedDivision !== null
          && !(typeof savedDivision === "string" && savedDivision.trim() === "");
        const clubDivision = hasExplicitDivision ? finiteStandingNumber(savedDivision) : 1;
        if (!Number.isInteger(clubDivision) || clubDivision < 1 || clubDivision !== expectedDivision) continue;
        const rowLeagueMissing = isMissingIdentifier(row.leagueId);
        const rowLeagueId = safeIdentifier(row.leagueId);
        if (!rowLeagueMissing && (!rowLeagueId || rowLeagueId !== leagueId)) continue;
        const hasExplicitRowDivision = row.division !== undefined && row.division !== null
          && !(typeof row.division === "string" && row.division.trim() === "");
        if (hasExplicitRowDivision) {
          const rowDivision = finiteStandingNumber(row.division);
          if (!Number.isInteger(rowDivision) || rowDivision !== expectedDivision) continue;
        }
        eligible.push({ club, row, index, clubId });
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
      const powerFor = club => {
        const currentPower = finiteStandingNumber(club && club.power);
        if (currentPower !== null && currentPower > 0) return currentPower;
        const basePower = finiteStandingNumber(club && club.basePower);
        return basePower !== null && basePower > 0 ? basePower : 50;
      };
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
      // Sort every valid row first, then keep the best-ranked row for each club.
      // Deduplicating while collecting makes the result depend on imported array order.
      const seen = new Set();
      return eligible.filter(entry => {
        if (seen.has(entry.clubId)) return false;
        seen.add(entry.clubId);
        return true;
      });
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
        const upEntry = promoted[i], downEntry = relegated[i];
        const up = upEntry && upEntry.club, down = downEntry && downEntry.club;
        const upId = upEntry && upEntry.clubId, downId = downEntry && downEntry.clubId;
        if (!up || !down || !upId || !downId || upId === downId
          || scheduledClubIds.has(upId) || scheduledClubIds.has(downId)) continue;
        scheduledClubIds.add(upId);
        scheduledClubIds.add(downId);
        plannedMoves.push({ leagueId, up, down, upId, downId });
      }
    }
    if (!plannedMoves.length) return [];

    // Apply the complete promotion batch atomically. A metadata lookup can fail after the
    // division field changes, so retain both club metadata and every attached player's tier.
    const affectedClubIds = new Set();
    const clubSnapshots = new Map();
    const clubFields = ["division", "leagueName", "leagueEnglish", "matchesPerSeason"];
    for (const plan of plannedMoves) {
      for (const [club, id] of [[plan.up, plan.upId], [plan.down, plan.downId]]) {
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
      if (player && affectedClubIds.has(safeIdentifier(player.clubId))) {
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
        base.syncClubDivisionMetadata(world, plan.up, 1, db, null, plan.upId);
        base.syncClubDivisionMetadata(world, plan.down, 2, db, null, plan.downId);
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
      const savedPower = marketNumber(club && club.power, NaN);
      if (Number.isFinite(savedPower) && savedPower > 0) return savedPower;
      const basePower = marketNumber(club && club.basePower, NaN);
      return Number.isFinite(basePower) && basePower > 0 ? basePower : 55;
    };
    const seasonNumber = marketNumber(season, NaN);
    if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 1) return [];
    const freeAgents = Object.entries(world.players || {}).map(([playerId, player]) => ({ playerId, player }))
      .filter(entry => {
        const player = entry.player;
        if (!entry.playerId || !player || base.isTrueFlag(player.retired) || !base.isTrueFlag(player.freeAgent)) return false;
        const contractSeasons = marketNumber(player.contractSeasons, NaN);
        return Number.isFinite(contractSeasons) && contractSeasons <= 0;
      }).sort((a,b)=>marketNumber(b.player.ovr,50)-marketNumber(a.player.ovr,50));
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
    for (const freeAgent of freeAgents) {
      if (signed.length >= maxSignings) break;
      const { playerId, player } = freeAgent;
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
      transaction.captureHistory(playerId);
      buyer.roster = activeRosterIdsForClub(world, buyer).filter(id => id !== playerId);
      const previousClub = previousClubId ? world.clubs[previousClubId] : null;
      const oldClubName = previousClub ? previousClub.name : "لاعب حر";
      player.clubId = buyer.id; player.country = buyer.country; player.leagueId = buyer.leagueId;
      player.division = divisionForClub(buyer); player.freeAgent = false;
      player.freeAgentSince = 0;
      player.contractSeasons = 2 + (hash(playerId + "|" + seasonNumber + "|free-agent-term") % 3);
      buyer.roster.push(playerId);
      const counts = roleCountsByClub.get(buyer.id);
      counts[group] = (counts[group] || 0) + 1;
      usedClubs.add(buyer.id);
      const move = {
        id: "world-transfer-" + seasonNumber + "-free-" + hash(playerId + "|" + buyer.id).toString(36),
        season: seasonNumber, day: 1, playerId, player: player.name, position: player.position,
        group, from: oldClubName, fromCountry: previousClub ? previousClub.country : "",
        fromClubId: previousClub ? String(previousClub.id) : "",
        to: buyer.name, toCountry: buyer.country, toClubId: String(buyer.id), fee: 0, currency: buyer.currency,
        reason: "تعاقد مجاني • احتياج في المركز وخبرة/إمكانات مناسبة",
        playerOvr, kind: "تعاقد مع لاعب حر — محاكاة"
      };
      signed.push(move);
      const historyMap = world.playerHistory && typeof world.playerHistory === "object"
        ? world.playerHistory : (world.playerHistory = {});
      const previousHistory = Object.prototype.hasOwnProperty.call(historyMap, playerId)
        ? historyMap[playerId] : undefined;
      const history = Array.isArray(previousHistory) ? previousHistory : [];
      history.unshift({ season: seasonNumber, clubId: String(buyer.id),
        club: buyer.name, country: buyer.country, fromClubId: previousClub ? String(previousClub.id) : "",
        type: "free-agent-signing", from: oldClubName });
      if (playerId === "__proto__") {
        Object.defineProperty(historyMap, playerId, { configurable: true, enumerable: true, writable: true, value: history.slice(0, 12) });
      } else {
        historyMap[playerId] = history.slice(0, 12);
      }
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
      const marketReports = Array.isArray(world.marketReports) ? world.marketReports : [];
      const report = marketReports.find(row => row && typeof row === "object" && !Array.isArray(row)
        && marketNumber(row.season, NaN) === seasonNumber);
      if (report) {
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
    if (base.isFutureWorldSchema(world)) {
      const snapshot = simulateLeagueSeason(save, year, db);
      return Object.assign({}, snapshot, { alreadyCompleted: true, readOnly: true, futureSchema: true, transfers: 0 });
    }
    const stableCurrentSeason = Math.max(1, int(world.currentSeason, int(save.season, 1)));
    const alreadyCompleted = hasCompletedSeasonMarker(world, year);
    // Do not fabricate an older season from today's squads when a stale completion request arrives.
    if (stableCurrentSeason > year && !alreadyCompleted) {
      const marketReports = Array.isArray(world.marketReports) ? world.marketReports : [];
      const market = marketReports.find(row => row && safeNumber(row.season, NaN) === year) || {};
      return {
        season: stableCurrentSeason, rows: [], tables: {}, matches: [], competitions: [],
        alreadyCompleted: true, staleRequest: true, transfers: safeNumber(market.moves, 0)
      };
    }
    if (alreadyCompleted) {
      // Preserve the legacy fallback for compact saves whose old match list was pruned.
      if (!world.matchesBySeason || !Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year))) {
        return base.completeSeason(save, year, db);
      }
      const sim = simulateLeagueSeason(save, year, db);
      const marketReports = Array.isArray(world.marketReports) ? world.marketReports : [];
      const market = marketReports.find(row => row && safeNumber(row.season, NaN) === year) || {};
      return { season: year, rows: sim.rows, tables: sim.tables, matches: sim.matches,
        competitions: sim.competitions, alreadyCompleted: true, transfers: safeNumber(market.moves, 0) };
    }

    // Simulate once and use those shared fixture results for both tables and player stats.
    // The old flow first generated a projected season for every player, then threw those
    // rows away and simulated the same season again.
    const sim = simulateLeagueSeason(save, year, db);
    world.completedSeasons = Array.isArray(world.completedSeasons) ? world.completedSeasons : [];
    if (!hasCompletedSeasonMarker(world, year)) world.completedSeasons.push(year);
    world.completedSeasons = base.sortCompletedSeasonMarkers(world.completedSeasons);
    world.lastCompletedSeason = Math.max(safeNumber(world.lastCompletedSeason, 0), year);
    world.currentSeason = year;
    return { season: year, rows: sim.rows, tables: sim.tables, matches: sim.matches,
      competitions: sim.competitions, alreadyCompleted: false, transfers: 0 };
  }
  function getLeagueTable(save, leagueId, season, db) {
    const world = base.ensureState(save, db);
    const year = Math.max(1, int(season, int(save.season, 1)));
    if (hasCompletedSeasonMarker(world, year)
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
    const completed = hasCompletedSeasonMarker(world, year);
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
    if (!(hasCompletedSeasonMarker(world, year)
      && (!world.matchesBySeason || !Object.prototype.hasOwnProperty.call(world.matchesBySeason, String(year))))) {
      simulateLeagueSeason(save, year, db);
    }
    return base.getSeasonLines(save, year, progress === undefined ? 1 : progress, db);
  }
  function advanceToSeason(save, nextSeason, db) {
    const world = base.ensureState(save, db);
    const next = Math.max(1, int(nextSeason, int(save.season, 1)));
    if (base.isFutureWorldSchema(world)) {
      return { season: Math.max(1, int(world.currentSeason, int(save.season, 1))),
        moves: [], alreadyAdvanced: true, readOnly: true, futureSchema: true };
    }
    const lastAdvancedTo = Math.max(0, safeNumber(safeWorldOwnValue(world, "lastAdvancedTo"), 0));
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
        const marketReports = Array.isArray(world.marketReports) ? world.marketReports : [];
        const report = marketReports.find(row => row && safeNumber(row.season, NaN) === next);
        const paidIds = new Set(Array.isArray(report && report.transferIds)
          ? report.transferIds.map(id => String(id || "")) : []);
        const transfers = Array.isArray(world.transfers) ? world.transfers : [];
        paidMoves = transfers.filter(move => move
          && safeNumber(move.season, NaN) === next && paidIds.has(String(move.id || "")));
      }
      const freeAgentMoves = signFreeAgents(world, next, paidMoves);
      if (freeAgentMoves.length) {
        world.projectionRevision = Math.max(0, int(world.projectionRevision, 0)) + 1;
        const nextKey = String(next);
        const nextSeasonAlreadyCompleted = hasCompletedSeasonMarker(world, next)
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
    if (base.isFutureWorldSchema(world)) {
      const summary = base.dashboard(save, db);
      const matches = world.matchesBySeason && typeof world.matchesBySeason === "object" && !Array.isArray(world.matchesBySeason)
        ? world.matchesBySeason : {};
      const competitions = world.competitionsBySeason && typeof world.competitionsBySeason === "object"
        && !Array.isArray(world.competitionsBySeason) ? world.competitionsBySeason : {};
      const season = Math.max(1, int(world.currentSeason, int(save.season, 1)));
      summary.matchesSimulated = Array.isArray(matches[String(season)]) ? matches[String(season)].length : 0;
      summary.competitionsSimulated = Array.isArray(competitions[String(season)]) ? competitions[String(season)].length : 0;
      summary.promotionHistory = Array.isArray(world.promotionHistory) ? world.promotionHistory : [];
      return summary;
    }
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
      safeNumber(safeWorldOwnValue(world, "rosterSchemaVersion"), 0), safeNumber(safeWorldOwnValue(world, "rosterMembershipSchemaVersion"), 0),
      safeNumber(safeWorldOwnValue(world, "lastAdvancedTo"), 0), int(world.lastCompletedSeason, 0),
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
      const year = Math.max(1, int(season, 1));
      const savedMatches = world.matchesBySeason && typeof world.matchesBySeason === "object"
        ? world.matchesBySeason[String(year)] : null;
      return Array.isArray(savedMatches) ? expandWorldMatches(world, savedMatches.slice(), year) : [];
    },
    seasonCompetitions: function (save, season, db) {
      const world = base.ensureState(save, db);
      simulateLeagueSeason(save, season, db);
      const year = Math.max(1, int(season, 1));
      const savedCompetitions = world.competitionsBySeason && typeof world.competitionsBySeason === "object"
        ? world.competitionsBySeason[String(year)] : null;
      return Array.isArray(savedCompetitions) ? savedCompetitions.slice() : [];
    },
    freeAgents: function (save, db) {
      const world = base.ensureState(save, db);
      return Object.entries(world.players || {}).filter(([playerMapKey, player]) =>
        !!safeSimulationIdentifier(playerMapKey) && player
          && !base.isTrueFlag(player.retired) && base.isTrueFlag(player.freeAgent))
        .map(([playerMapKey, player]) => ({
          id: safeSimulationIdentifier(playerMapKey), name: player.name, position: player.position,
          ovr: player.ovr, age: player.age, potential: player.potential,
          contractSeasons: player.contractSeasons, formerClub: player.previousClubId
        })).sort((a,b)=>safeNumber(b && b.ovr,50)-safeNumber(a && a.ovr,50));
    }
  }));
})(window);
/* END LAST WHISTLE WORLD SIMULATION V2 */


/* LAST WHISTLE — age-aware club AI, scouting estimates and worker-backed world jobs. */
(function (global) {
  "use strict";
  const base = global.LWWorldAI;
  if (!base) return;
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
  function clubPowerForAI(club, fallback = 55) {
    const currentPower = safeNumber(club && club.power, 0);
    const basePower = safeNumber(club && club.basePower, 0);
    return clamp(currentPower > 0 ? currentPower : basePower > 0 ? basePower : fallback, 25, 100);
  }
  function archetypeForClub(club) {
    const power = clamp(clubPowerForAI(club), 35, 97), prestige = clamp(club && club.prestige, 25, 100);
    if (power >= 82 && prestige >= 78) return { id: "title-chaser", label: "منافس على البطولات", strategy: "استقطاب الجاهز", coachStyle: "win-now" };
    if (power <= 65 && prestige <= 68) return { id: "youth-investor", label: "استثمار وتطوير شباب", strategy: "تطوير ثم بيع", coachStyle: "develop-youth" };
    if (power >= 70 && prestige >= 72) return { id: "academy-builder", label: "بناء فني منظم", strategy: "تطوير المواهب", coachStyle: "technical-discipline" };
    return { id: "balanced", label: "توازن بين الخبرة والشباب", strategy: "تعاقدات حسب الاحتياج", coachStyle: "balanced-rotation" };
  }
  function ensureProfiles(save, db) {
    const world = base.ensureState(save, db);
    if (base.isFutureWorldSchema(world)) return world;
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
        const qualityGap = Math.max(0, clubPowerForAI(club) - averageOverall) * 0.25;
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
      return { clubId: club.id, club: club.name, country: club.country, power: clubPowerForAI(club),
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
    const worker = new global.Worker("./football-world-worker.js?v=85");
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
