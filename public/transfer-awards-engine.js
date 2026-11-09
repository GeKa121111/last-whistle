(function (global) {
  "use strict";

  function finiteNumericValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function clamp(value, min, max) {
    const number = finiteNumericValue(value);
    return Math.max(min, Math.min(max, number === null ? min : number));
  }

  const MAX_SEASON_STAT = 1000000;

  function safeAmount(value, fallback = 0) {
    const parsed = finiteNumericValue(value);
    const fallbackValue = finiteNumericValue(fallback);
    const amount = parsed === null ? (fallbackValue === null ? 0 : fallbackValue) : parsed;
    return Math.round(Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, amount)));
  }

  function safeCount(value, fallback = 0) {
    const number = finiteNumericValue(value);
    if (number === null) {
      const fallbackNumber = finiteNumericValue(fallback);
      return fallbackNumber === null ? 0 : Math.max(0, Math.min(MAX_SEASON_STAT, fallbackNumber));
    }
    return Math.max(0, Math.min(MAX_SEASON_STAT, number));
  }

  function safeRating(value, fallback = 0) {
    const number = finiteNumericValue(value);
    if (number !== null) return clamp(number, 0, 10);
    const fallbackNumber = finiteNumericValue(fallback);
    return clamp(fallbackNumber === null ? 0 : fallbackNumber, 0, 10);
  }

  function safeStrength(value, fallback = 60) {
    const number = finiteNumericValue(value);
    if (number === null || number <= 0) {
      const fallbackNumber = finiteNumericValue(fallback);
      return fallbackNumber === null ? 60 : fallbackNumber;
    }
    return clamp(number, 25, 100);
  }

  function safePrestige(value, fallback = 60) {
    const number = finiteNumericValue(value);
    if (number === null || number <= 0) {
      const fallbackNumber = finiteNumericValue(fallback);
      return fallbackNumber === null ? 60 : fallbackNumber;
    }
    return clamp(number, 1, 100);
  }

  function isYouthAwardEligible(value) {
    const age = finiteNumericValue(value);
    return age !== null && age >= 16 && age <= 21;
  }

  function isYouthAwardEligibleForPlayer(player, fallbackAge) {
    const rawAge = player && player.age;
    if (rawAge === undefined || rawAge === null || (typeof rawAge === "string" && rawAge.trim() === "")) {
      return isYouthAwardEligible(fallbackAge);
    }
    const age = finiteNumericValue(rawAge);
    return age === 0
      ? isYouthAwardEligible(fallbackAge)
      : isYouthAwardEligible(age);
  }

  function safeAge(value, fallback = 18) {
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) return fallback;
    const number = finiteNumericValue(value);
    if (number === null || number < 0) return 100;
    if (number === 0) return fallback;
    return Math.min(100, Math.floor(number));
  }

  function safePercent(value, fallback = 50) {
    const number = finiteNumericValue(value);
    if (number !== null) return clamp(number, 0, 100);
    const fallbackNumber = finiteNumericValue(fallback);
    return fallbackNumber === null ? 50 : fallbackNumber;
  }

  // Saved identity/display fields are accepted only when they are primitive text
  // or finite numbers. Never invoke user-controlled toString/valueOf methods.
  function safeText(value, fallback = "") {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const char of safeText(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
  }

  function seeded(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let current = value;
      current = Math.imul(current ^ (current >>> 15), current | 1);
      current ^= current + Math.imul(current ^ (current >>> 7), current | 61);
      return ((current ^ (current >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalized(value) {
    const raw = safeText(value);
    return raw.normalize("NFD")
      .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
      .replace(/[إأآ]/g, "ا").replace(/ى/g, "ي")
      .toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
  }

  // Keep every supported legacy ID form when rows are projected and deduplicated.
  function stablePlayerId(player) {
    player = player || {};
    for (const value of [player.id, player.playerId, player.uid]) {
      if (value === undefined || value === null) continue;
      const id = safeText(value).trim();
      if (id) return id;
    }
    return "";
  }

  // Player names and club names are not globally unique. Prefer the stable player
  // ID; legacy rows fall back to country, position, age and shirt/birth details.
  function playerIdentityKey(player) {
    player = player || {};
    const id = stablePlayerId(player);
    if (id) return "id|" + normalized(id);
    const ageValue = finiteNumericValue(player.age);
    const age = ageValue !== null && ageValue > 0 ? String(Math.floor(ageValue)) : "";
    return [
      "fallback",
      normalized(player.name || ""),
      normalized(player.clubName || player.club || player.currentClub || ""),
      normalized(player.country || ""),
      normalized(player.position || ""),
      normalized(player.birthDate || player.dateOfBirth || player.dob || ""),
      age,
      normalized(player.shirtNumber || player.jerseyNumber || player.number || "")
    ].join("|");
  }

  // Projection randomness follows stable player identity, not position wording;
  // role production rates still distinguish strikers, mobile forwards and midfielders.
  function playerProjectionKey(player) {
    player = player || {};
    const id = stablePlayerId(player);
    if (id) return "id|" + normalized(id);
    const ageValue = finiteNumericValue(player.age);
    const age = ageValue !== null && ageValue > 0 ? String(Math.floor(ageValue)) : "";
    return [
      "fallback",
      normalized(player.name || ""),
      normalized(player.clubName || player.club || player.currentClub || ""),
      normalized(player.country || ""),
      normalized(player.birthDate || player.dateOfBirth || player.dob || ""),
      age,
      normalized(player.shirtNumber || player.jerseyNumber || player.number || "")
    ].join("|");
  }

  // Keep award projections consistent with the career/match engines when a
  // roster stores an English position abbreviation instead of its Arabic label.
  const POSITION_ROLE_ALIASES = Object.freeze({
    gk: "keeper", goalkeeper: "keeper", keeper: "keeper", goalie: "keeper",
    cb: "defender", lcb: "defender", rcb: "defender", centerback: "defender",
    centreback: "defender", centraldefender: "defender",
    lb: "defender", rb: "defender", lwb: "defender", rwb: "defender", wb: "defender", fb: "defender",
    leftback: "defender", rightback: "defender", leftwingback: "defender", rightwingback: "defender",
    fullback: "defender", wingback: "defender",
    cdm: "midfielder", dm: "midfielder", defensivemidfielder: "midfielder",
    defensivemid: "midfielder", holdingmidfielder: "midfielder",
    cm: "midfielder", rcm: "midfielder", lcm: "midfielder",
    centralmidfielder: "midfielder", centralmidfield: "midfielder", midfielder: "midfielder",
    cam: "midfielder", am: "midfielder", attackingmidfielder: "midfielder", attackingmid: "midfielder",
    lw: "winger", rw: "winger", lm: "winger", rm: "winger", lwf: "winger", rwf: "winger",
    leftwing: "winger", rightwing: "winger", leftwinger: "winger", rightwinger: "winger",
    winger: "winger", widemidfielder: "winger", leftmidfielder: "winger", rightmidfielder: "winger",
    cf: "attacker", ss: "attacker", secondstriker: "attacker", mobileforward: "attacker",
    st: "striker", fw: "striker", fwd: "striker", striker: "striker", forward: "striker",
    centreforward: "striker", centerforward: "striker"
  });
  function roleType(position) {
    const store = global.LWStateStore;
    const safePosition = safeText(position);
    const canonical = store && typeof store.normalizePosition === "function"
      ? store.normalizePosition(safePosition) : safePosition;
    const value = normalized(canonical);
    if (Object.prototype.hasOwnProperty.call(POSITION_ROLE_ALIASES, value)) return POSITION_ROLE_ALIASES[value];
    if (value.includes("حارس")) return "keeper";
    // Central/attacking midfielders are still midfielders; classify their line
    // before checking role words such as "defensive" or "attacking".
    if (value.includes("وسط") || value.includes("ارتكاز") || value.includes("صانع")) return "midfielder";
    if (value.includes("دفاع") || value.includes("ظهير")) return "defender";
    if (value.includes("رأسحربة") || value.includes("راسحربة") || value.includes("راسحربه")) return "striker";
    if (value.includes("جناح")) return "winger";
    if (value.includes("مهاجم")) return "attacker";
    return "midfielder";
  }

  function isKnownPosition(position) {
    const value = normalized(position);
    return !!value && (Object.prototype.hasOwnProperty.call(POSITION_ROLE_ALIASES, value)
      || value.includes("حارس")
      || value.includes("وسط") || value.includes("ارتكاز") || value.includes("صانع")
      || value.includes("دفاع") || value.includes("ظهير")
      || value.includes("رأسحربة") || value.includes("راسحربة") || value.includes("راسحربه")
      || value.includes("جناح") || value.includes("مهاجم"));
  }

  function samePositionRole(left, right) {
    const leftValue = normalized(left);
    const rightValue = normalized(right);
    if (!leftValue || !rightValue) return false;
    if (isKnownPosition(left) && isKnownPosition(right)) {
      return roleType(left) === roleType(right);
    }
    // Unknown labels should only match the exact same label; roleType's
    // default-to-midfielder behavior is for projection, not rival discovery.
    return leftValue === rightValue;
  }

  function projectedMinutesForRole(value) {
    const role = normalized(value == null ? "" : value);
    if (!role) return null;
    if ((role.includes("بديل") && role.includes("اساسي")) || role === "coresubstitute") return 66;
    if (role.includes("نجمالفريق") || role.includes("starplayer")) return 88;
    if (role === "اساسي" || role.includes("لاعباساسي") || role.includes("regularstarter")) return 83;
    if (role.includes("تناوب") || role.includes("rotation") || role.includes("squadplayer")) return 43;
    if (role.includes("ناشي") || role.includes("ناشئ") || role.includes("صاعد") || role.includes("prospect") || role.includes("youngster")
      || role.includes("فريقالرديف") || role.includes("لاعبتحتالتقييم") || role.includes("reserve") || role.includes("academy")) return 20;
    if (role.includes("بديل") || role.includes("احتياطي") || role.includes("impactsub") || role.includes("fringeplayer")) return 28;
    return null;
  }

  function projectedMinutesPerAppearance(player) {
    const candidates = [player && player.role, player && player.squadRole, player && player.playingTime];
    for (const candidate of candidates) {
      const minutes = projectedMinutesForRole(candidate);
      if (minutes !== null) return minutes;
    }
    // The match engine defaults missing or unrecognized squad roles to substitute (28 minutes).
    return 28;
  }
  function seasonProductionRates(type) {
    const profiles = {
      striker: { goalsPer90: 0.37, assistsPer90: 0.085 },
      attacker: { goalsPer90: 0.26, assistsPer90: 0.14 },
      winger: { goalsPer90: 0.22, assistsPer90: 0.17 },
      midfielder: { goalsPer90: 0.105, assistsPer90: 0.125 },
      defender: { goalsPer90: 0.04, assistsPer90: 0.045 },
      keeper: { goalsPer90: 0.001, assistsPer90: 0.002 }
    };
    return Object.prototype.hasOwnProperty.call(profiles, type) ? profiles[type] : profiles.midfielder;
  }

  // Use season evidence when available; otherwise create a deterministic career-world
  // projection so goalkeepers are not excluded from end-of-season awards.
  function defensiveAwardBonus(row) {
    const value = key => safeCount(row && row[key]);
    return value("cleanSheets") * 0.35 + value("saves") * 0.025
      + value("penaltiesSaved") * 0.8 + value("tacklesWon") * 0.05
      + value("interceptions") * 0.06 + value("clearances") * 0.015
      + value("ballRecoveries") * 0.025 + value("keyPasses") * 0.08;
  }

  function applyDefensiveSeasonStats(row, player, season) {
    player = player || {};
    const savedSeason = player.seasonStats && finiteNumericValue(player.seasonStats.season);
    const currentSeason = finiteNumericValue(season);
    const saved = player.seasonStats && savedSeason !== null && currentSeason !== null && savedSeason === currentSeason
      ? player.seasonStats : {};
    const type = roleType(row.position || player.position);
    const appearances = safeCount(row.appearances);
    const minutes = seasonMinutes(row, appearances);
    if (appearances <= 0 || minutes <= 0) {
      row.cleanSheets = 0;
      row.saves = 0;
      row.penaltiesSaved = 0;
      row.tacklesWon = 0;
      row.interceptions = 0;
      row.clearances = 0;
      row.ballRecoveries = 0;
      row.keyPasses = 0;
      row.defensiveBonus = 0;
      row.goldenGloveScore = 0;
      return row;
    }
    const ovr = clamp(row.ovr || player.ovr || 60, 35, 99);
    const strength = safeStrength(row.leagueStrength || player.leagueStrength);
    const random = seeded(stableHash("defense|" + season + "|" + playerProjectionKey(Object.assign({}, player, row))));
    const cleanRate = type === "keeper"
      ? clamp(0.25 + (ovr - 60) * 0.006 + (strength - 60) * 0.002 + (random() - 0.5) * 0.08, 0.12, 0.68)
      : type === "defender"
        ? clamp(0.18 + (ovr - 60) * 0.003 + (strength - 60) * 0.002 + (random() - 0.5) * 0.05, 0.05, 0.52)
        : 0;
    const projectedCleanSheets = Math.round(appearances * cleanRate);
    const projectedSaves = type === "keeper"
      ? Math.round(appearances * clamp(1.6 + (100 - ovr) * 0.025 + (60 - strength) * 0.008 + random() * 0.6, 0.8, 4.2))
      : 0;
    const value = (key, fallback = 0) => {
      const raw = saved[key] != null ? saved[key] : player[key] != null ? player[key] : undefined;
      return raw === undefined ? safeCount(fallback) : safeCount(raw);
    };
    row.cleanSheets = value("cleanSheets", projectedCleanSheets);
    row.saves = value("saves", projectedSaves);
    row.penaltiesSaved = value("penaltiesSaved", 0);
    row.tacklesWon = value("tacklesWon", value("tackles", 0));
    row.interceptions = value("interceptions", 0);
    row.clearances = value("clearances", 0);
    row.ballRecoveries = value("ballRecoveries", 0);
    row.keyPasses = value("keyPasses", 0);
    row.defensiveBonus = defensiveAwardBonus(row);
    row.goldenGloveScore = type === "keeper"
      ? row.cleanSheets * 3 + row.saves * 0.3 + row.penaltiesSaved * 2 + safeRating(row.averageRating) * 0.3
      : 0;
    return row;
  }

  function estimatedAge(player, season) {
    const knownYoung = {
      "لامين يامال": 19,
      "إندريك": 20,
      "أردا غولر": 21,
      "روني بردغجي": 20,
      "باو كوبارسي": 19,
      "إيثان نوانيري": 19,
      "كيندري بايز": 19,
      "فرانكو ماستانتونو": 18,
      "نيكو أوريلي": 21
    };
    const name = safeText(player && player.name);
    const sourcedAge = finiteNumericValue(player && player.age);
    const firstSeasonAge = sourcedAge !== null && sourcedAge >= 1
      ? Math.floor(sourcedAge)
      : Object.prototype.hasOwnProperty.call(knownYoung, name)
        ? knownYoung[name]
        : 24 + (stableHash(playerProjectionKey(player)) % 10);
    const seasonValue = finiteNumericValue(season);
    const seasonNumber = Math.max(1, Math.floor(seasonValue === null ? 1 : seasonValue));
    // Sourced age, known-player baseline, or fallback estimate all describe the
    // player's age in season one. Advance the same baseline once per season.
    return Math.min(40, firstSeasonAge + seasonNumber - 1);
  }

  function simulatePlayerSeason(player, season, progress) {
    const saved = player && player.seasonStats;
    const savedSeason = saved && finiteNumericValue(saved.season);
    const requestedSeason = finiteNumericValue(season);
    if (saved && savedSeason !== null && requestedSeason !== null && savedSeason === requestedSeason) {
      const scale = clamp(progress === undefined ? 1 : progress, 0, 1);
      const ovr = clamp(saved.ovr || player.ovr || player.power || 60, 35, 99);
      const appearances = Math.round(safeCount(saved.appearances) * scale);
      const savedMinutesValue = saved.minutes;
      const hasSavedMinutes = savedMinutesValue !== undefined && savedMinutesValue !== null && savedMinutesValue !== "";
      const savedMinutes = hasSavedMinutes
        ? safeCount(savedMinutesValue)
        : safeCount(saved.appearances) * projectedMinutesPerAppearance(player);
      const minutes = appearances > 0
        ? Math.round(Math.min(savedMinutes, safeCount(saved.appearances) * 120) * scale) : 0;
      const hasPlayingTime = appearances > 0 && minutes > 0;
      const goals = hasPlayingTime ? Math.round(safeCount(saved.goals) * scale) : 0;
      const assists = hasPlayingTime ? Math.round(safeCount(saved.assists) * scale) : 0;
      const averageRating = hasPlayingTime ? safeRating(saved.averageRating) : 0;
      const leagueStrength = safeStrength(player.leagueStrength);
      return {
        id: stablePlayerId(player),
        name: safeText(player.name), club: safeText(saved.club) || safeText(player.clubName) || safeText(player.club) || "نادي غير محدد",
        country: safeText(saved.country) || safeText(player.country), position: safeText(player.position) || "غير محدد",
        age: estimatedAge(player, season), ovr, appearances, minutes, goals, assists,
        averageRating: Number(averageRating.toFixed(2)),
        score: hasPlayingTime ? Number((averageRating * 9 + goals * 0.95 + assists * 0.62 + ovr * 0.08 + leagueStrength * 0.035).toFixed(3)) : 0,
        weightedGoals: Number((goals * (0.82 + leagueStrength / 450)).toFixed(3)),
        confederation: safeText(player.confederation), originConfederation: safeText(player.originConfederation) || safeText(player.confederation),
        leagueStrength, realPlayer: player.realPlayer !== false, isUser: !!player.isUser
      };
    }
    const ovr = clamp(player.ovr || player.power || 60, 35, 99);
    const type = roleType(player.position);
    const random = seeded(stableHash(season + "|" + playerProjectionKey(player)));
    const expectedApps = 20 + Math.floor(random() * 15);
    const scale = clamp(progress === undefined ? 1 : progress, 0, 1);
    const appearances = Math.round(expectedApps * scale);
    const minutesPerAppearance = projectedMinutesPerAppearance(player);
    const fullSeasonMinutes = Math.round(expectedApps * minutesPerAppearance);
    const projectedMinutes = Math.round(fullSeasonMinutes * scale);
    const production = seasonProductionRates(type);
    const overallMultiplier = clamp(0.85 + (ovr - 60) * 0.004, 0.75, 1.08);
    // Build a full-season production baseline, then apply progress once to the final totals.
    const goalsExpected = fullSeasonMinutes / 90 * production.goalsPer90 * overallMultiplier;
    const assistsExpected = fullSeasonMinutes / 90 * production.assistsPer90 * overallMultiplier;
    const goalsFull = Math.max(0, Math.round(goalsExpected * (0.84 + random() * 0.32)));
    const assistsFull = Math.max(0, Math.round(assistsExpected * (0.84 + random() * 0.32)));
    const goals = appearances > 0 ? Math.round(goalsFull * scale) : 0;
    const assists = appearances > 0 ? Math.round(assistsFull * scale) : 0;
    const prestige = safePrestige(player.prestige);
    const ratingBase = 5.8 + Math.max(0, ovr - 48) * 0.031 + Math.max(0, prestige - 65) * 0.002;
    const rating = appearances > 0 ? Math.min(9.2, ratingBase + random() * 0.56) : 0;
    const competitionStrength = safeStrength(player.leagueStrength);
    const score = appearances > 0
      ? rating * 9 + goals * 0.95 + assists * 0.62 + ovr * 0.08 + competitionStrength * 0.035 + prestige * 0.018
      : 0;
    return {
      id: stablePlayerId(player),
      name: safeText(player.name),
      club: safeText(player.clubName) || safeText(player.club) || "نادي غير محدد",
      country: safeText(player.country),
      position: safeText(player.position) || "غير محدد",
      age: estimatedAge(player, season),
      ovr: ovr,
      appearances: appearances,
      minutes: projectedMinutes,
      goals: goals,
      assists: assists,
      averageRating: Number(rating.toFixed(2)),
      score: Number(score.toFixed(3)),
      weightedGoals: Number((goals * (0.82 + competitionStrength / 450)).toFixed(3)),
      confederation: safeText(player.confederation),
      originConfederation: safeText(player.originConfederation) || safeText(player.confederation),
      leagueStrength: competitionStrength,
      realPlayer: player.realPlayer !== false,
      isUser: !!player.isUser
    };
  }

  function generateOffers(input) {
    input = input || {};
    const player = input.player || {};
    const targets = Array.isArray(input.targets) ? input.targets : [];
    const windowId = safeText(input.windowId).trim();
    const appearances = parseSeasonAppearanceValue(player.appearances);
    const form = finiteNumericValue(player.form);
    if (!windowId || appearances === null || appearances < 2
      || form === null || form < 5.8) return [];
    const playerOvr = clamp(player.ovr || 50, 35, 99);
    const currentPower = clamp(input.currentClubPower || player.currentClubPower || 50, 35, 99);
    const contributions = safeCount(player.goals) + safeCount(player.assists);
    const formLift = form >= 7.1 ? 4 : form >= 6.7 ? 2 : 0;
    const experienceLift = Math.min(5, Math.floor(contributions * 0.28));
    const progressionMargin = playerOvr < 60 ? 3 : playerOvr < 70 ? 7 : playerOvr < 80 ? 13 : 21;
    const maxPower = Math.min(96, Math.max(currentPower + 4, playerOvr + progressionMargin + formLift + experienceLift));
    const minPower = Math.max(38, currentPower - (playerOvr < 62 ? 9 : 14));
    const seen = new Set();
    const candidates = [];

    for (const raw of targets) {
      if (!raw) continue;
      const targetClub = safeText(raw.club).trim();
      const targetCountry = safeText(raw.country).trim();
      if (!targetClub || !targetCountry) continue;
      const key = normalized(targetCountry) + "|" + normalized(targetClub);
      if (seen.has(key)) continue;
      seen.add(key);
      if (normalized(raw.club) === normalized(player.currentClub)
        && normalized(raw.country) === normalized(player.country)) continue;
      const power = clamp(raw.power || raw.ovr || 50, 35, 99);
      if (power < minPower || power > maxPower) continue;
      if (playerOvr < 60 && power >= 70) continue;
      const divisionValue = finiteNumericValue(raw.division);
      if (playerOvr < 68 && divisionValue === 1 && power > playerOvr + 3) continue;
      const ageValue = finiteNumericValue(player.age);
      const potentialValue = finiteNumericValue(player.potential);
      const roleGap = playerOvr - power;
      const role = roleGap >= 9 ? "نجم الفريق" : roleGap >= 4 ? "أساسي" : roleGap >= -1 ? "تناوب"
        : ageValue !== null && ageValue <= 21 && potentialValue !== null && potentialValue >= 78
          ? "لاعب ناشئ" : "لاعب بديل";
      const positionRivals = (Array.isArray(raw.players) ? raw.players : [])
        .filter(item => item && safeText(item.name).trim() && samePositionRole(item.position, player.position))
        .sort((a, b) => {
          const aOvr = finiteNumericValue(a.ovr);
          const bOvr = finiteNumericValue(b.ovr);
          return (bOvr === null ? 0 : bOvr) - (aOvr === null ? 0 : aOvr);
        })
        .slice(0, 3).map(item => safeText(item.name).trim());
      const stars = (positionRivals.length ? positionRivals : (Array.isArray(raw.stars) ? raw.stars : []))
        .map(item => safeText(item).trim()).filter(Boolean).slice(0, 4);
      const regionalBonus = normalized(raw.country) === normalized(player.country) ? -5 : 2;
      const divisionBonus = divisionValue !== null && divisionValue >= 2 ? -1.5 : 1;
      const prestigeValue = finiteNumericValue(raw.prestige);
      const prestigeForScore = prestigeValue === null || prestigeValue === 0 ? 50 : prestigeValue;
      const proximity = Math.abs(power - Math.min(maxPower, currentPower + 5));
      const scoutScore = proximity + regionalBonus + divisionBonus - prestigeForScore * 0.025
        + (stableHash(key + "|" + windowId) % 13) * 0.19;
      candidates.push({
        target: raw,
        power: power,
        role: role,
        stars: stars,
        positionRivals: positionRivals,
        scoutScore: scoutScore
      });
    }

    candidates.sort((a, b) => a.scoutScore - b.scoutScore || b.power - a.power);
    const desired = clamp(2 + Math.floor(Math.max(0, playerOvr - 55) / 15) + (form >= 7.0 ? 1 : 0), 2, 4);
    const selected = [];
    for (const candidate of candidates) {
      if (selected.length >= desired) break;
      const sameTierAlready = selected.some(item => Math.abs(item.power - candidate.power) < 3);
      if (sameTierAlready && candidates.length > desired) continue;
      selected.push(candidate);
    }
    if (!selected.length && candidates.length) selected.push(candidates[0]);

    return selected.map((candidate, index) => {
      const target = candidate.target;
      const power = candidate.power;
      const currency = safeText(target.currency).trim() || "ج.م";
      const wage = currency === "ج.م"
        ? Math.round(350 + power * 28 + playerOvr * 12)
        : Math.round(80 + power * 18 + playerOvr * 10);
      const targetPrestigeValue = finiteNumericValue(target.prestige);
      const signPrestige = targetPrestigeValue === null || targetPrestigeValue === 0 ? 60 : targetPrestigeValue;
      const displayPrestige = safePrestige(target.prestige, power);
      const maxWagePrestige = targetPrestigeValue === null || targetPrestigeValue === 0
        ? 50 : clamp(targetPrestigeValue, 0, 100);
      const targetDivisionValue = finiteNumericValue(target.division);
      const sign = Math.round(wage * (4 + signPrestige / 50));
      const goal = Math.max(10, Math.round(wage * 0.18));
      const cleanSheet = Math.max(10, Math.round(wage * 0.12));
      const releaseClause = Math.round(wage * 52 * (1.9 + power / 100));
      return {
        id: "offer-" + windowId + "-" + stableHash(targetCountry + "|" + targetClub + "|" + playerIdentityKey(player)).toString(36),
        windowId: windowId,
        club: targetClub,
        country: targetCountry,
        league: safeText(target.league) || safeText(target.leagueName) || "الدوري المحلي",
        leagueEnglish: safeText(target.leagueEnglish),
        season: safeText(target.season),
        source: safeText(target.source) || "قاعدة اللعبة",
        division: targetDivisionValue === null ? 1 : Math.max(1, Math.floor(targetDivisionValue)),
        power: power,
        prestige: displayPrestige,
        currency: currency,
        confederation: safeText(target.confederation),
        stars: candidate.stars,
        positionRivals: candidate.positionRivals,
        role: candidate.role,
        wage: wage,
        maxWage: Math.round(wage * (1.18 + clamp(maxWagePrestige, 0, 100) / 500)),
        signingBonus: sign,
        goalBonus: goal,
        cleanSheetBonus: cleanSheet,
        contractSeasons: 3,
        releaseClause: releaseClause,
        patience: 100,
        status: "pending",
        generatedIndex: index
      };
    });
  }

  function negotiationPressure(offer, terms) {
    offer = offer && typeof offer === "object" && !Array.isArray(offer) ? offer : {};
    terms = terms && typeof terms === "object" && !Array.isArray(terms) ? terms : {};
    const numericOrZero = value => {
      const number = finiteNumericValue(value);
      return number === null ? 0 : number;
    };
    const ratio = function (requested, offered) {
      const base = Math.max(1, numericOrZero(offered));
      return Math.max(0, numericOrZero(requested)) / base;
    };
    const wageRatio = ratio(terms.weeklyWage, offer.wage);
    const signRatio = ratio(terms.signingBonus, offer.signingBonus);
    const goalRatio = ratio(terms.goalBonus, offer.goalBonus);
    const cleanRatio = ratio(terms.cleanSheetBonus, offer.cleanSheetBonus);
    const clauseRatio = ratio(terms.releaseClause, offer.releaseClause);
    let pressure = Math.max(0, wageRatio - 1) * 58
      + Math.max(0, signRatio - 1) * 24
      + Math.max(0, goalRatio - 1) * 10
      + Math.max(0, cleanRatio - 1) * 10
      + Math.max(0, clauseRatio - 2.5) * 7;
    const years = clamp(numericOrZero(terms.contractSeasons) || 3, 1, 5);
    if (years === 1) pressure += 3;
    if (years === 5) pressure -= 2;
    return Number(clamp(Math.round(pressure), 0, 100));
  }

  function evaluateNegotiation(offer, terms, patience, round) {
    offer = offer && typeof offer === "object" && !Array.isArray(offer) ? offer : {};
    terms = terms && typeof terms === "object" && !Array.isArray(terms) ? terms : {};
    const numericOrZero = value => {
      const number = finiteNumericValue(value);
      return number === null ? 0 : number;
    };
    const roundedNonNegative = value => Math.max(0, Math.round(numericOrZero(value)));
    const suppliedPatience = finiteNumericValue(patience);
    const savedOfferPatience = finiteNumericValue(offer.patience);
    const currentPatience = clamp(
      suppliedPatience !== null ? suppliedPatience : savedOfferPatience !== null ? savedOfferPatience : 100,
      0, 100
    );
    const roundValue = finiteNumericValue(round);
    const currentRound = Math.max(0, Math.floor(roundValue === null ? 0 : roundValue));
    const pressure = negotiationPressure(offer, terms);
    const requestedWage = roundedNonNegative(terms.weeklyWage);
    const requestedSign = roundedNonNegative(terms.signingBonus);
    const requestedGoal = roundedNonNegative(terms.goalBonus);
    const requestedCleanSheet = roundedNonNegative(terms.cleanSheetBonus);
    const requestedReleaseClause = roundedNonNegative(terms.releaseClause);
    const offerWage = roundedNonNegative(offer.wage);
    const offerMaxWage = roundedNonNegative(offer.maxWage);
    const offerSigning = roundedNonNegative(offer.signingBonus);
    const offerGoal = roundedNonNegative(offer.goalBonus);
    const offerCleanSheet = roundedNonNegative(offer.cleanSheetBonus);
    const offerReleaseClause = roundedNonNegative(offer.releaseClause);
    const years = clamp(numericOrZero(terms.contractSeasons) || 3, 1, 5);
    if (pressure <= 12 && requestedWage <= Math.max(1, offerMaxWage || offerWage || 1)) {
      return {
        status: "accepted",
        pressure: pressure,
        patience: currentPatience,
        response: "وافقت الإدارة على مطالبك. جهّز نفسك للتوقيع وبدء الفصل الجديد.",
        terms: Object.assign({}, terms, {
          weeklyWage: requestedWage,
          signingBonus: requestedSign,
          goalBonus: requestedGoal,
          cleanSheetBonus: requestedCleanSheet,
          contractSeasons: years,
          releaseClause: requestedReleaseClause
        })
      };
    }
    const loss = clamp(Math.round(15 + pressure * 0.92), 15, 68);
    const nextPatience = Math.max(0, currentPatience - loss);
    const counterOffer = {
      weeklyWage: Math.min(requestedWage || offerWage, offerMaxWage || offerWage),
      signingBonus: Math.min(requestedSign || offerSigning, Math.round(offerSigning * 1.2)),
      goalBonus: Math.min(requestedGoal, Math.round(offerGoal * 1.25)),
      cleanSheetBonus: Math.min(requestedCleanSheet, Math.round(offerCleanSheet * 1.25)),
      contractSeasons: years,
      releaseClause: Math.min(requestedReleaseClause, Math.round(offerReleaseClause * 2.5))
    };
    const withdraw = nextPatience <= 0 || currentRound >= 2;
    if (withdraw) {
      return {
        status: "withdrawn",
        pressure: pressure,
        patience: nextPatience,
        response: "نفد صبر الإدارة وسحبت عرضها. لازم تستنى نافذة انتقالات جديدة عشان تتواصل مع النادي.",
        counterOffer: counterOffer
      };
    }
    return {
      status: "counter",
      pressure: pressure,
      patience: nextPatience,
      response: "إدارة النادي شايفة مطالبك أعلى من ميزانيتها. ده آخر عرض مضاد عندهم؛ لو بالغت مرة تانية ممكن ينسحبوا.",
      counterOffer: counterOffer
    };
  }

  function buildLeagueLeaderboard(input) {
    input = input || {};
    const seasonValue = finiteNumericValue(input.season);
    const season = seasonValue || 1;
    const progress = clamp(input.progress === undefined ? 1 : input.progress, 0, 1);
    const players = Array.isArray(input.players) ? input.players : [];
    const rows = [];
    const seen = new Set();
    for (const player of players) {
      if (!player || !safeText(player.name).trim()) continue;
      const key = playerIdentityKey(player);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(simulatePlayerSeason(player, season, progress));
    }
    if (input.userLine && safeText(input.userLine.name).trim()) {
      const user = Object.assign({
        club: input.userLine.club || "",
        country: input.userLine.country || "",
        position: input.userLine.position || "غير محدد",
        ovr: finiteNumericValue(input.userLine.ovr) || 50,
        appearances: 0,
        goals: 0,
        assists: 0,
        averageRating: 0,
        score: 0,
        weightedGoals: 0,
        realPlayer: false,
        isUser: true
      }, input.userLine);
      const appearanceValue = user.appearances !== undefined && user.appearances !== null
        ? user.appearances : user.apps;
      const userAppearances = safeCount(appearanceValue);
      const userMinutes = seasonMinutes(user, userAppearances);
      const hasUserPlayingTime = userAppearances > 0 && userMinutes > 0;
      const userGoals = hasUserPlayingTime ? safeCount(user.goals) : 0;
      const userAssists = hasUserPlayingTime ? safeCount(user.assists) : 0;
      const userAverageRating = hasUserPlayingTime ? safeRating(user.averageRating) : 0;
      const userLeagueStrength = safeStrength(user.leagueStrength);
      user.appearances = userAppearances;
      user.minutes = userMinutes;
      user.goals = userGoals;
      user.assists = userAssists;
      user.averageRating = userAverageRating;
      user.leagueStrength = userLeagueStrength;
      user.ovr = clamp(user.ovr || 50, 35, 99);
      if (!hasUserPlayingTime) {
        user.score = 0;
        user.weightedGoals = 0;
      } else {
        user.score = userAverageRating * 9 + userGoals * 0.95
          + userAssists * 0.62 + userLeagueStrength * 0.035;
        user.weightedGoals = userGoals * (0.82 + userLeagueStrength / 450);
      }
      rows.push(user);
    }
    const unique = new Map();
    for (const row of rows) {
      const key = playerIdentityKey(row);
      const old = unique.get(key);
      if (!old || Number(row.isUser) > Number(old.isUser)) unique.set(key, row);
    }
    return Array.from(unique.values());
  }

  function buildSeasonAwardCeremony(input) {
    input = input || {};
    const seasonValue = finiteNumericValue(input.season);
    const season = seasonValue || 1;
    const player = input.player || {};
    const realPlayers = Array.isArray(input.realPlayers) ? input.realPlayers : [];
    const trophies = safeCount(player.trophies);
    const candidates = [];
    const seen = new Set();

    for (const realPlayer of realPlayers) {
      if (!realPlayer || !safeText(realPlayer.name).trim()) continue;
      const key = playerIdentityKey(realPlayer);
      if (seen.has(key)) continue;
      seen.add(key);
      const row = applyDefensiveSeasonStats(simulatePlayerSeason(realPlayer, season, 1), realPlayer, season);
      row.youthAwardEligible = isYouthAwardEligibleForPlayer(realPlayer, row.age);
      row.trophyBonus = stableHash(season + "|" + row.club + "|trophy") % 8;
      row.ballonScore = row.averageRating * 8.8 + row.goals * 0.94 + row.assists * 0.64
        + row.ovr * 0.08 + row.trophyBonus + row.leagueStrength * 0.04
        + safePrestige(realPlayer.prestige) * 0.025 + row.defensiveBonus;
      row.theBestScore = row.ballonScore + row.averageRating * 0.22
        + (stableHash(playerIdentityKey(row) + "|" + season + "|best") % 17) / 10;
      row.originConfederation = safeText(realPlayer.originConfederation) || safeText(realPlayer.confederation);
      candidates.push(row);
    }

    const userAppearances = safeCount(player.appearances);
    const userMinutes = seasonMinutes(player, userAppearances);
    const hasUserPlayingTime = userAppearances > 0 && userMinutes > 0;
    const userGoals = hasUserPlayingTime ? safeCount(player.goals) : 0;
    const userAssists = hasUserPlayingTime ? safeCount(player.assists) : 0;
    const userAverageRating = hasUserPlayingTime ? safeRating(player.averageRating) : 0;
    const user = {
      id: stablePlayerId(player),
      name: safeText(player.name) || "لاعب المسيرة",
      club: safeText(player.club) || "نادي غير محدد",
      country: safeText(player.country),
      position: safeText(player.position) || "غير محدد",
      age: safeAge(player.age),
      youthAwardEligible: isYouthAwardEligibleForPlayer(player, safeAge(player.age)),
      ovr: clamp(player.ovr || 50, 35, 99),
      appearances: userAppearances,
      minutes: userMinutes,
      goals: userGoals,
      assists: userAssists,
      averageRating: userAverageRating,
      score: 0,
      weightedGoals: 0,
      trophyBonus: trophies * 5,
      confederation: safeText(player.confederation),
      originConfederation: safeText(player.originConfederation) || safeText(player.confederation),
      leagueStrength: safeStrength(player.leagueStrength),
      realPlayer: false,
      isUser: true
    };
    applyDefensiveSeasonStats(user, player, season);
    user.score = user.averageRating * 9 + user.goals * 0.95 + user.assists * 0.62
      + user.ovr * 0.08 + user.leagueStrength * 0.035 + trophies * 5 + user.defensiveBonus * 0.3;
    user.weightedGoals = user.goals * (0.82 + user.leagueStrength / 450);
    user.ballonScore = user.averageRating * 8.8 + user.goals * 0.94 + user.assists * 0.64
      + user.ovr * 0.08 + trophies * 5 + user.leagueStrength * 0.04 + user.defensiveBonus;
    user.theBestScore = user.ballonScore + user.averageRating * 0.22 + safePercent(player.professionalism) * 0.025;
    candidates.push(user);

    const rank = function (rows, scoreKey) {
      return rows.slice().sort(function (a, b) {
        return (Number(b[scoreKey]) || 0) - (Number(a[scoreKey]) || 0)
          || Number(b.goals || 0) - Number(a.goals || 0)
          || Number(b.assists || 0) - Number(a.assists || 0)
          || safeText(a.name).localeCompare(safeText(b.name), "ar")
        || playerIdentityKey(a).localeCompare(playerIdentityKey(b), "en");
      });
    };
    const eligibleCandidates = candidates.filter(row =>
      safeCount(row.appearances) >= 10 && seasonMinutes(row, safeCount(row.appearances)) > 0);
    const bestFive = rank(eligibleCandidates, "ballonScore").slice(0, 5);
    const ballonWinner = bestFive[0] || { name: "لا يوجد لاعب مؤهل", club: "", isUser: false };
    const allAwards = [
      { id: "ballon-dor", title: "الكرة الذهبية (Ballon d'Or)", metric: "ballonScore", pool: eligibleCandidates },
      { id: "fifa-the-best", title: "جائزة ذا بيست (FIFA The Best)", metric: "theBestScore", pool: eligibleCandidates },
      { id: "world-golden-shoe", title: "الحذاء الذهبي العالمي", metric: "weightedGoals", pool: eligibleCandidates },
      { id: "golden-glove", title: "القفاز الذهبي (Golden Glove)", metric: "goldenGloveScore",
        pool: eligibleCandidates.filter(row => roleType(row.position) === "keeper" && safeCount(row.appearances) >= 10) },
      { id: "golden-boy", title: "الفتى الذهبي (Golden Boy)", metric: "ballonScore", pool: eligibleCandidates.filter(row => row.youthAwardEligible === true) },
      { id: "caf-player", title: "أفضل لاعب في أفريقيا (CAF Player of the Year)", metric: "ballonScore", pool: eligibleCandidates.filter(row => row.originConfederation === "CAF") },
      { id: "uefa-player", title: "أفضل لاعب في أوروبا (UEFA Best Player)", metric: "ballonScore", pool: eligibleCandidates.filter(row => row.confederation === "UEFA") },
      { id: "conmebol-player", title: "أفضل لاعب في أمريكا الجنوبية", metric: "ballonScore", pool: eligibleCandidates.filter(row => row.confederation === "CONMEBOL") }
    ];
    const awards = allAwards.filter(definition => definition.pool.length)
      .map(function (definition) {
      const ranked = rank(definition.pool, definition.metric);
      const winner = ranked[0];
      return {
        id: definition.id,
        title: definition.title,
        winner: {
          id: safeText(winner.id),
          name: winner.name,
          club: winner.club,
          country: winner.country,
          position: winner.position,
          goals: winner.goals,
          assists: winner.assists,
          averageRating: winner.averageRating,
          cleanSheets: winner.cleanSheets,
          saves: winner.saves,
          penaltiesSaved: winner.penaltiesSaved,
          age: winner.age,
          isUser: !!winner.isUser
        },
        topThree: ranked.slice(0, 3).map(function (row) {
          return { id: safeText(row.id), name: row.name, club: row.club,
            country: row.country, position: row.position, score: Number(row[definition.metric]) || 0,
            cleanSheets: row.cleanSheets, saves: row.saves, penaltiesSaved: row.penaltiesSaved, isUser: !!row.isUser };
        })
      };
    });
    const userAwards = awards.filter(row => row.winner.isUser).map(function (row) {
      return {
        id: row.id,
        title: row.title + " — محاكاة المسيرة",
        season: season,
        club: user.club,
        country: user.country,
        competition: "جوائز نهاية الموسم",
        note: row.id === "golden-glove"
          ? "حافظت على " + user.cleanSheets + " شباك نظيفة وسجلت " + user.saves + " تصديًا خلال الموسم."
          : "فزت بالجائزة بعد تقييم الأهداف والصناعة ومتوسط الأداء وقوة المنافسة والإنجازات.",
        winner: user.name
      };
    });
    return {
      season: season,
      club: user.club,
      country: user.country,
      createdAt: safeText(input.currentDate).trim() || (safeText(2024 + season) + "-07-31T00:00:00.000Z"),
      ballonDor: {
        winner: { id: String(ballonWinner.id || ""), name: ballonWinner.name, club: ballonWinner.club,
          country: ballonWinner.country, position: ballonWinner.position, isUser: !!ballonWinner.isUser },
        topFive: bestFive.map(function (row) {
          return { id: safeText(row.id), name: row.name, club: row.club, country: row.country,
            position: row.position, goals: row.goals, assists: row.assists, averageRating: row.averageRating,
            score: Number(row.ballonScore) || 0, isUser: !!row.isUser };
        })
      },
      awards: awards,
      playerAwards: userAwards
    };
  }


  // Stage 2: shared performance-led valuation and competition-aware wage guardrails.
  function parseSeasonAppearanceValue(value) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function seasonAppearanceCount(player) {
    player = player || {};
    const rawAppearances = player.appearances;
    const hasAppearances = rawAppearances !== undefined && rawAppearances !== null && rawAppearances !== "";
    // Do not coerce booleans, arrays, objects, or Symbols into appearance counts.
    // Also avoid touching the legacy alias when a current-season value exists:
    // old saves may contain malformed career-wide apps beside valid season data.
    const parsed = hasAppearances
      ? parseSeasonAppearanceValue(rawAppearances)
      : parseSeasonAppearanceValue(player.apps);
    return parsed === null ? 0 : Math.max(0, parsed);
  }

  function seasonMinutes(player, appearances) {
    if (appearances <= 0) return 0;
    const rawMinutes = player && player.minutes;
    const missingMinutes = rawMinutes === undefined || rawMinutes === null
      || (typeof rawMinutes === "string" && rawMinutes.trim() === "");
    // Only legacy saves with no minute value receive the 65-minute estimate.
    // An explicitly stored but malformed value is not evidence of playing time.
    if (missingMinutes) return appearances * 65;
    const parsedMinutes = typeof rawMinutes === "number" || typeof rawMinutes === "string"
      ? Number(rawMinutes) : NaN;
    if (!Number.isFinite(parsedMinutes)) return 0;
    return Math.max(0, parsedMinutes);
  }

  function performanceIndex(player) {
    player = player || {};
    const apps = seasonAppearanceCount(player);
    const minutes = seasonMinutes(player, apps);
    // A saved zero is meaningful: do not fall back to career totals or stale
    // minutes when the current season has no actual appearances.
    if (apps <= 0 || minutes <= 0) return 0;
    const averageRating = finiteNumericValue(player.averageRating);
    const formRating = finiteNumericValue(player.form);
    const rating = safeRating(averageRating !== null && averageRating !== 0
      ? averageRating : formRating === null ? 0 : formRating);
    const goals = safeCount(player.goals);
    const assists = safeCount(player.assists);
    const cleanSheets = safeCount(player.cleanSheets);
    const rawStrength = finiteNumericValue(player.leagueStrength);
    const strength = rawStrength === null ? 60 : clamp(rawStrength || 60, 25, 100);
    const participation = clamp(minutes / Math.max(1, apps * 90), 0, 1);
    const role = roleType(player.position);
    const contribution = role === "attacker" ? goals * 1.05 + assists * .72
      : role === "midfielder" ? goals * .9 + assists * .95
      : role === "defender" ? goals * .55 + assists * .6 + cleanSheets * .32
      : goals * .2 + cleanSheets * .55;
    const sampleFactor = clamp(apps / 18, .35, 1);
    return Number(clamp((rating * 6.2 + contribution * .42 + strength * .075 + participation * 7) * sampleFactor, 0, 100).toFixed(2));
  }

  function leagueWageCeiling(league) {
    const key = normalized(typeof league === "object" ? (league.name || league.country || league.id) : league);
    const ceilings = [
      [/premierleague|england|انجلترا/, 450000],
      [/saudi|السعوديه|روشن/, 600000],
      [/laliga|spain|اسبانيا/, 350000],
      [/bundesliga|germany|المانيا/, 320000],
      [/seriea|italy|ايطاليا/, 300000],
      [/ligue1|france|فرنسا/, 260000],
      [/egypt|مصر|egyptian/, 140000],
      [/championship|second|درجةثانيه/, 90000]
    ];
    for (const row of ceilings) if (row[0].test(key)) return row[1];
    return 180000;
  }

  function capWageOffer(wage, league, player) {
    const ceiling = leagueWageCeiling(league);
    const performance = performanceIndex(player);
    const savedWage = finiteNumericValue(player && player.wage);
    const floor = Math.min(ceiling, Math.max(250, savedWage === null ? 250 : savedWage));
    const performanceCap = ceiling * (.24 + .76 * performance / 100);
    return Math.round(clamp(wage, floor, Math.max(floor, Math.min(ceiling, performanceCap))));
  }

  function buildLoanProposal(input) {
    input = input || {};
    const player = input.player || {};
    const ageValue = finiteNumericValue(player.age);
    const age = ageValue === null || ageValue === 0 ? 24 : ageValue;
    const apps = seasonAppearanceCount(player);
    const durationMonths = finiteNumericValue(input.durationMonths) === 6 ? 6 : 12;
    const isYouth = age < 23;
    const minutesTarget = isYouth ? (durationMonths === 6 ? 700 : 1400) : (durationMonths === 6 ? 450 : 900);
    const wageShare = clamp(input.wageShare === undefined ? (isYouth ? .35 : .5) : input.wageShare, 0, 1);
    const requestedBuyOptionFee = finiteNumericValue(input.buyOptionFee);
    const marketValue = finiteNumericValue(player.marketValue);
    const buyOptionFee = requestedBuyOptionFee === null || requestedBuyOptionFee === 0
      ? marketValue : requestedBuyOptionFee;
    return {
      type: "loan", durationMonths, minutesTarget,
      loanFee: safeAmount(input.loanFee),
      wageShare, optionToBuy: !!input.optionToBuy,
      buyOptionFee: input.optionToBuy ? safeAmount(buyOptionFee) : 0,
      developmentPriority: isYouth && apps < 12,
      recallClause: true
    };
  }

  function evaluateSeasonPerformance(player) {
    player = player || {};
    const apps = seasonAppearanceCount(player);
    const minutes = seasonMinutes(player, apps);
    const hasSeasonPerformance = apps > 0 && minutes > 0;
    const score = hasSeasonPerformance ? performanceIndex(player) : 0;
    const ovr = clamp(player.ovr || player.power || 50, 35, 99);
    const ageValue = finiteNumericValue(player.age);
    const age = Math.max(16, ageValue === null || ageValue === 0 ? 24 : ageValue);
    const development = age < 23 ? Math.max(0, 23 - age) * .55 : age > 30 ? -(age - 30) * .7 : 0;
    const seasonScore = hasSeasonPerformance ? score + development + Math.min(5, minutes / 900) : 0;
    return {
      score: Number(clamp(seasonScore, 0, 100).toFixed(2)),
      marketValueMultiplier: Number(clamp(.55 + score / 85 + development / 100, .45, 1.9).toFixed(3)),
      transferReadiness: clamp((score * .62) + Math.min(18, apps * .45) + Math.max(0, ovr - 60) * .18, 0, 100),
      performanceSample: apps,
      minutes
    };
  }

  global.LWTransferAwards = Object.freeze({
    version: 27,
    roleType: roleType,
    generateOffers: generateOffers,
    negotiationPressure: negotiationPressure,
    evaluateNegotiation: evaluateNegotiation,
    simulatePlayerSeason: simulatePlayerSeason,
    buildLeagueLeaderboard: buildLeagueLeaderboard,
    buildSeasonAwardCeremony: buildSeasonAwardCeremony,
    performanceIndex: performanceIndex,
    leagueWageCeiling: leagueWageCeiling,
    capWageOffer: capWageOffer,
    buildLoanProposal: buildLoanProposal,
    evaluateSeasonPerformance: evaluateSeasonPerformance
  });
})(window);