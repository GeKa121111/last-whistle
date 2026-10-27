(function (global) {
  "use strict";

  function clamp(value, min, max) {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
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
    return String(value == null ? "" : value).normalize("NFD")
      .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
      .replace(/[إأآ]/g, "ا").replace(/ى/g, "ي")
      .toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
  }

  function roleType(position) {
    const value = normalized(position);
    if (value.includes("حارس")) return "keeper";
    // Central/attacking midfielders are still midfielders; classify their line
    // before checking role words such as "defensive" or "attacking".
    if (value.includes("وسط") || value.includes("ارتكاز") || value.includes("صانع")) return "midfielder";
    if (value.includes("دفاع") || value.includes("ظهير")) return "defender";
    if (value.includes("رأسحربة") || value.includes("راسحربة") || value.includes("راسحربه")) return "striker";
    if (value.includes("جناح") || value.includes("مهاجم")) return "attacker";
    return "midfielder";
  }

  // Use season evidence when available; otherwise create a deterministic career-world
  // projection so goalkeepers are not excluded from end-of-season awards.
  function defensiveAwardBonus(row) {
    const value = key => Math.max(0, Number(row && row[key]) || 0);
    return value("cleanSheets") * 0.35 + value("saves") * 0.025
      + value("penaltiesSaved") * 0.8 + value("tacklesWon") * 0.05
      + value("interceptions") * 0.06 + value("clearances") * 0.015
      + value("ballRecoveries") * 0.025 + value("keyPasses") * 0.08;
  }

  function applyDefensiveSeasonStats(row, player, season) {
    player = player || {};
    const saved = player.seasonStats && Number(player.seasonStats.season) === Number(season)
      ? player.seasonStats : {};
    const type = roleType(row.position || player.position);
    const appearances = Math.max(0, Number(row.appearances) || 0);
    const ovr = clamp(row.ovr || player.ovr || 60, 35, 99);
    const strength = clamp(row.leagueStrength || player.leagueStrength || 60, 25, 100);
    const random = seeded(stableHash("defense|" + season + "|" + String(row.club || player.clubName || player.club || "")
      + "|" + String(row.name || player.name || "")));
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
      return raw === undefined ? Math.max(0, Number(fallback) || 0) : Math.max(0, Number(raw) || 0);
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
      ? row.cleanSheets * 3 + row.saves * 0.3 + row.penaltiesSaved * 2 + Math.max(0, Number(row.averageRating) || 0) * 0.3
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
    if (knownYoung[player.name] !== undefined) return knownYoung[player.name];
    return 24 + (stableHash(player.name + "|" + season) % 10);
  }

  function simulatePlayerSeason(player, season, progress) {
    const saved = player && player.seasonStats;
    if (saved && Number(saved.season) === Number(season)) {
      const scale = clamp(progress === undefined ? 1 : progress, 0, 1);
      const ovr = clamp(saved.ovr || player.ovr || player.power || 60, 35, 99);
      const appearances = Math.round(Math.max(0, Number(saved.appearances) || 0) * scale);
      const goals = Math.round(Math.max(0, Number(saved.goals) || 0) * scale);
      const assists = Math.round(Math.max(0, Number(saved.assists) || 0) * scale);
      const averageRating = appearances > 0 ? clamp(saved.averageRating || 0, 0, 10) : 0;
      const leagueStrength = Number(player.leagueStrength) || 60;
      return {
        name: String(player.name || ""), club: String(saved.club || player.clubName || player.club || ""),
        country: String(saved.country || player.country || ""), position: String(player.position || "غير محدد"),
        age: Number(player.age) || estimatedAge(player, season), ovr, appearances, goals, assists,
        averageRating: Number(averageRating.toFixed(2)),
        score: Number((averageRating * 9 + goals * 0.95 + assists * 0.62 + ovr * 0.08 + leagueStrength * 0.035).toFixed(3)),
        weightedGoals: Number((goals * (0.82 + leagueStrength / 450)).toFixed(3)),
        confederation: player.confederation || "", originConfederation: player.originConfederation || player.confederation || "",
        leagueStrength, realPlayer: player.realPlayer !== false, isUser: !!player.isUser
      };
    }
    const ovr = clamp(player.ovr || player.power || 60, 35, 99);
    const type = roleType(player.position);
    const random = seeded(stableHash(season + "|" + player.clubName + "|" + player.name));
    const expectedApps = 20 + Math.floor(random() * 15);
    const scale = clamp(progress === undefined ? 1 : progress, 0, 1);
    const appearances = Math.round(expectedApps * scale);
    const attackRate = type === "striker" ? 0.62 : type === "attacker" ? 0.43 : type === "midfielder" ? 0.19 : type === "defender" ? 0.055 : 0.005;
    const assistRate = type === "striker" ? 0.20 : type === "attacker" ? 0.30 : type === "midfielder" ? 0.36 : type === "defender" ? 0.10 : 0.015;
    const ratingBase = 5.8 + Math.max(0, ovr - 48) * 0.031 + Math.max(0, (Number(player.prestige) || 60) - 65) * 0.002;
    const goalsFull = Math.max(0, Math.round(Math.max(0, ovr - 42) * attackRate + random() * (type === "striker" ? 8 : type === "attacker" ? 7 : 4)));
    const assistsFull = Math.max(0, Math.round(Math.max(0, ovr - 42) * assistRate + random() * 5));
    const goals = Math.round(goalsFull * scale);
    const assists = Math.round(assistsFull * scale);
    const rating = appearances > 0 ? Math.min(9.2, ratingBase + random() * 0.56) : 0;
    const competitionStrength = Number(player.leagueStrength) || 60;
    const score = appearances > 0
      ? rating * 9 + goals * 0.95 + assists * 0.62 + ovr * 0.08 + competitionStrength * 0.035 + (Number(player.prestige) || 60) * 0.018
      : 0;
    return {
      name: player.name,
      club: player.clubName || player.club || "نادي غير محدد",
      country: player.country || "",
      position: player.position || "غير محدد",
      age: Number(player.age) || estimatedAge(player, season),
      ovr: ovr,
      appearances: appearances,
      goals: goals,
      assists: assists,
      averageRating: Number(rating.toFixed(2)),
      score: Number(score.toFixed(3)),
      weightedGoals: Number((goals * (0.82 + competitionStrength / 450)).toFixed(3)),
      confederation: player.confederation || "",
      originConfederation: player.originConfederation || player.confederation || "",
      leagueStrength: competitionStrength,
      realPlayer: player.realPlayer !== false,
      isUser: !!player.isUser
    };
  }

  function generateOffers(input) {
    input = input || {};
    const player = input.player || {};
    const targets = Array.isArray(input.targets) ? input.targets : [];
    if (!input.windowId || Number(player.appearances) < 2 || Number(player.form || 0) < 5.8) return [];
    const playerOvr = clamp(player.ovr || 50, 35, 99);
    const currentPower = clamp(input.currentClubPower || player.currentClubPower || 50, 35, 99);
    const contributions = Math.max(0, Number(player.goals) || 0) + Math.max(0, Number(player.assists) || 0);
    const formLift = Number(player.form) >= 7.1 ? 4 : Number(player.form) >= 6.7 ? 2 : 0;
    const experienceLift = Math.min(5, Math.floor(contributions * 0.28));
    const progressionMargin = playerOvr < 60 ? 3 : playerOvr < 70 ? 7 : playerOvr < 80 ? 13 : 21;
    const maxPower = Math.min(96, Math.max(currentPower + 4, playerOvr + progressionMargin + formLift + experienceLift));
    const minPower = Math.max(38, currentPower - (playerOvr < 62 ? 9 : 14));
    const seen = new Set();
    const candidates = [];

    for (const raw of targets) {
      if (!raw || !raw.club || !raw.country) continue;
      const key = normalized(raw.country) + "|" + normalized(raw.club);
      if (seen.has(key)) continue;
      seen.add(key);
      if (raw.club === player.currentClub && raw.country === player.country) continue;
      const power = clamp(raw.power || raw.ovr || 50, 35, 99);
      if (power < minPower || power > maxPower) continue;
      if (playerOvr < 60 && power >= 70) continue;
      if (playerOvr < 68 && Number(raw.division) === 1 && power > playerOvr + 3) continue;
      const roleGap = playerOvr - power;
      const role = roleGap >= 9 ? "نجم الفريق" : roleGap >= 4 ? "أساسي" : roleGap >= -1 ? "تناوب" : Number(player.age) <= 21 && Number(player.potential) >= 78 ? "لاعب ناشئ" : "لاعب بديل";
      const positionRivals = (Array.isArray(raw.players) ? raw.players : [])
        .filter(item => item && item.name && normalized(item.position) === normalized(player.position))
        .sort((a, b) => Number(b.ovr || 0) - Number(a.ovr || 0))
        .slice(0, 3).map(item => item.name);
      const stars = (positionRivals.length ? positionRivals : (Array.isArray(raw.stars) ? raw.stars : []))
        .filter(Boolean).slice(0, 4);
      const regionalBonus = raw.country === player.country ? -5 : 2;
      const divisionBonus = Number(raw.division) >= 2 ? -1.5 : 1;
      const proximity = Math.abs(power - Math.min(maxPower, currentPower + 5));
      const scoutScore = proximity + regionalBonus + divisionBonus - (Number(raw.prestige) || 50) * 0.025
        + (stableHash(key + "|" + input.windowId) % 13) * 0.19;
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
    const desired = clamp(2 + Math.floor(Math.max(0, playerOvr - 55) / 15) + (Number(player.form) >= 7.0 ? 1 : 0), 2, 4);
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
      const wage = target.currency === "ج.م"
        ? Math.round(350 + power * 28 + playerOvr * 12)
        : Math.round(80 + power * 18 + playerOvr * 10);
      const sign = Math.round(wage * (4 + (Number(target.prestige) || 60) / 50));
      const goal = Math.max(10, Math.round(wage * 0.18));
      const cleanSheet = Math.max(10, Math.round(wage * 0.12));
      const releaseClause = Math.round(wage * 52 * (1.9 + power / 100));
      return {
        id: "offer-" + String(input.windowId) + "-" + stableHash(target.country + "|" + target.club + "|" + player.name).toString(36),
        windowId: String(input.windowId),
        club: target.club,
        country: target.country,
        league: target.league || target.leagueName || "الدوري المحلي",
        leagueEnglish: target.leagueEnglish || "",
        season: target.season || "",
        source: target.source || "قاعدة اللعبة",
        division: Math.max(1, Number(target.division) || 1),
        power: power,
        prestige: clamp(target.prestige || power, 1, 100),
        currency: target.currency || "ج.م",
        confederation: target.confederation || "",
        stars: candidate.stars,
        positionRivals: candidate.positionRivals,
        role: candidate.role,
        wage: wage,
        maxWage: Math.round(wage * (1.18 + clamp(target.prestige || 50, 0, 100) / 500)),
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
    offer = offer || {};
    terms = terms || {};
    const ratio = function (requested, offered) {
      const base = Math.max(1, Number(offered) || 0);
      return Math.max(0, Number(requested) || 0) / base;
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
    const years = clamp(terms.contractSeasons || 3, 1, 5);
    if (years === 1) pressure += 3;
    if (years === 5) pressure -= 2;
    return Number(clamp(Math.round(pressure), 0, 100));
  }

  function evaluateNegotiation(offer, terms, patience, round) {
    const currentPatience = clamp(patience === undefined ? offer && offer.patience : patience, 0, 100);
    const currentRound = Math.max(0, Math.floor(Number(round) || 0));
    const pressure = negotiationPressure(offer, terms);
    const requestedWage = Math.max(0, Math.round(Number(terms && terms.weeklyWage) || 0));
    const requestedSign = Math.max(0, Math.round(Number(terms && terms.signingBonus) || 0));
    if (pressure <= 12 && requestedWage <= Math.max(1, Number(offer.maxWage) || Number(offer.wage) || 1)) {
      return {
        status: "accepted",
        pressure: pressure,
        patience: currentPatience,
        response: "وافقت الإدارة على مطالبك. جهّز نفسك للتوقيع وبدء الفصل الجديد.",
        terms: Object.assign({}, terms, {
          weeklyWage: requestedWage,
          signingBonus: requestedSign,
          goalBonus: Math.max(0, Math.round(Number(terms.goalBonus) || 0)),
          cleanSheetBonus: Math.max(0, Math.round(Number(terms.cleanSheetBonus) || 0)),
          contractSeasons: clamp(terms.contractSeasons || 3, 1, 5),
          releaseClause: Math.max(0, Math.round(Number(terms.releaseClause) || 0))
        })
      };
    }
    const loss = clamp(Math.round(15 + pressure * 0.92), 15, 68);
    const nextPatience = Math.max(0, currentPatience - loss);
    const counterOffer = {
      weeklyWage: Math.min(requestedWage || Number(offer.wage) || 0, Number(offer.maxWage) || Number(offer.wage) || 0),
      signingBonus: Math.min(requestedSign || Number(offer.signingBonus) || 0, Math.round((Number(offer.signingBonus) || 0) * 1.2)),
      goalBonus: Math.min(Math.max(0, Number(terms.goalBonus) || 0), Math.round((Number(offer.goalBonus) || 0) * 1.25)),
      cleanSheetBonus: Math.min(Math.max(0, Number(terms.cleanSheetBonus) || 0), Math.round((Number(offer.cleanSheetBonus) || 0) * 1.25)),
      contractSeasons: clamp(terms.contractSeasons || 3, 1, 5),
      releaseClause: Math.min(Math.max(0, Number(terms.releaseClause) || 0), Math.round((Number(offer.releaseClause) || 0) * 2.5))
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
    const season = Number(input.season) || 1;
    const progress = clamp(input.progress === undefined ? 1 : input.progress, 0, 1);
    const players = Array.isArray(input.players) ? input.players : [];
    const rows = [];
    const seen = new Set();
    for (const player of players) {
      if (!player || !player.name) continue;
      const key = normalized(player.name) + "|" + normalized(player.clubName || player.club || "");
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(simulatePlayerSeason(player, season, progress));
    }
    if (input.userLine && input.userLine.name) {
      const user = Object.assign({
        club: input.userLine.club || "",
        country: input.userLine.country || "",
        position: input.userLine.position || "غير محدد",
        ovr: Number(input.userLine.ovr) || 50,
        appearances: 0,
        goals: 0,
        assists: 0,
        averageRating: 0,
        score: 0,
        weightedGoals: 0,
        realPlayer: false,
        isUser: true
      }, input.userLine);
      user.score = Number(user.averageRating || 0) * 9 + Number(user.goals || 0) * 0.95
        + Number(user.assists || 0) * 0.62 + Number(user.leagueStrength || 60) * 0.035;
      user.weightedGoals = Number(user.goals || 0) * (0.82 + Number(user.leagueStrength || 60) / 450);
      rows.push(user);
    }
    const unique = new Map();
    for (const row of rows) {
      const key = normalized(row.name) + "|" + normalized(row.club || "");
      const old = unique.get(key);
      if (!old || Number(row.isUser) > Number(old.isUser)) unique.set(key, row);
    }
    return Array.from(unique.values());
  }

  function buildSeasonAwardCeremony(input) {
    input = input || {};
    const season = Number(input.season) || 1;
    const player = input.player || {};
    const realPlayers = Array.isArray(input.realPlayers) ? input.realPlayers : [];
    const trophies = Math.max(0, Number(player.trophies) || 0);
    const candidates = [];
    const seen = new Set();

    for (const realPlayer of realPlayers) {
      if (!realPlayer || !realPlayer.name) continue;
      const key = normalized(realPlayer.name) + "|" + normalized(realPlayer.clubName || realPlayer.club || "");
      if (seen.has(key)) continue;
      seen.add(key);
      const row = applyDefensiveSeasonStats(simulatePlayerSeason(realPlayer, season, 1), realPlayer, season);
      row.trophyBonus = stableHash(season + "|" + row.club + "|trophy") % 8;
      row.ballonScore = row.averageRating * 8.8 + row.goals * 0.94 + row.assists * 0.64
        + row.ovr * 0.08 + row.trophyBonus + (Number(realPlayer.leagueStrength) || 60) * 0.04
        + (Number(realPlayer.prestige) || 60) * 0.025 + row.defensiveBonus;
      row.theBestScore = row.ballonScore + row.averageRating * 0.22
        + (stableHash(row.name + "|" + season + "|best") % 17) / 10;
      row.originConfederation = realPlayer.originConfederation || realPlayer.confederation || "";
      candidates.push(row);
    }

    const user = {
      name: String(player.name || "لاعب المسيرة"),
      club: String(player.club || "نادي غير محدد"),
      country: String(player.country || ""),
      position: String(player.position || "غير محدد"),
      age: Number(player.age) || 18,
      ovr: clamp(player.ovr || 50, 35, 99),
      appearances: Math.max(0, Number(player.appearances) || 0),
      goals: Math.max(0, Number(player.goals) || 0),
      assists: Math.max(0, Number(player.assists) || 0),
      averageRating: Math.max(0, Number(player.averageRating) || 0),
      score: 0,
      weightedGoals: 0,
      trophyBonus: trophies * 5,
      confederation: String(player.confederation || ""),
      originConfederation: String(player.originConfederation || player.confederation || ""),
      leagueStrength: Number(player.leagueStrength) || 60,
      realPlayer: false,
      isUser: true
    };
    applyDefensiveSeasonStats(user, player, season);
    user.score = user.averageRating * 9 + user.goals * 0.95 + user.assists * 0.62
      + user.ovr * 0.08 + user.leagueStrength * 0.035 + trophies * 5 + user.defensiveBonus * 0.3;
    user.weightedGoals = user.goals * (0.82 + user.leagueStrength / 450);
    user.ballonScore = user.averageRating * 8.8 + user.goals * 0.94 + user.assists * 0.64
      + user.ovr * 0.08 + trophies * 5 + user.leagueStrength * 0.04 + user.defensiveBonus;
    user.theBestScore = user.ballonScore + user.averageRating * 0.22 + (Number(player.professionalism) || 50) * 0.025;
    candidates.push(user);

    const rank = function (rows, scoreKey) {
      return rows.slice().sort(function (a, b) {
        return (Number(b[scoreKey]) || 0) - (Number(a[scoreKey]) || 0)
          || Number(b.goals || 0) - Number(a.goals || 0)
          || Number(b.assists || 0) - Number(a.assists || 0)
          || String(a.name).localeCompare(String(b.name), "ar");
      });
    };
    const bestFive = rank(candidates, "ballonScore").slice(0, 5);
    const ballonWinner = bestFive[0] || user;
    const allAwards = [
      { id: "ballon-dor", title: "الكرة الذهبية (Ballon d'Or)", metric: "ballonScore", pool: candidates },
      { id: "fifa-the-best", title: "جائزة ذا بيست (FIFA The Best)", metric: "theBestScore", pool: candidates },
      { id: "world-golden-shoe", title: "الحذاء الذهبي العالمي", metric: "weightedGoals", pool: candidates },
      { id: "golden-glove", title: "القفاز الذهبي (Golden Glove)", metric: "goldenGloveScore",
        pool: candidates.filter(row => roleType(row.position) === "keeper" && Number(row.appearances) >= 10) },
      { id: "golden-boy", title: "الفتى الذهبي (Golden Boy)", metric: "ballonScore", pool: candidates.filter(row => Number(row.age) <= 21) },
      { id: "caf-player", title: "أفضل لاعب في أفريقيا (CAF Player of the Year)", metric: "ballonScore", pool: candidates.filter(row => row.originConfederation === "CAF") },
      { id: "uefa-player", title: "أفضل لاعب في أوروبا (UEFA Best Player)", metric: "ballonScore", pool: candidates.filter(row => row.confederation === "UEFA") },
      { id: "conmebol-player", title: "أفضل لاعب في أمريكا الجنوبية", metric: "ballonScore", pool: candidates.filter(row => row.confederation === "CONMEBOL") }
    ];
    const awards = allAwards.filter(definition => definition.id !== "golden-glove" || definition.pool.length)
      .map(function (definition) {
      const ranked = rank(definition.pool.length ? definition.pool : candidates, definition.metric);
      const winner = ranked[0] || user;
      return {
        id: definition.id,
        title: definition.title,
        winner: {
          name: winner.name,
          club: winner.club,
          country: winner.country,
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
          return { name: row.name, club: row.club, score: Number(row[definition.metric]) || 0,
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
      createdAt: String(input.currentDate || (String(2024 + season) + "-07-31T00:00:00.000Z")),
      ballonDor: {
        winner: { name: ballonWinner.name, club: ballonWinner.club, isUser: !!ballonWinner.isUser },
        topFive: bestFive.map(function (row) {
          return { name: row.name, club: row.club, goals: row.goals, assists: row.assists, averageRating: row.averageRating, score: Number(row.ballonScore) || 0, isUser: !!row.isUser };
        })
      },
      awards: awards,
      playerAwards: userAwards
    };
  }


  // Stage 2: shared performance-led valuation and competition-aware wage guardrails.
  function performanceIndex(player) {
    player = player || {};
    const apps = Math.max(0, Number(player.appearances || player.apps) || 0);
    const minutes = Math.max(0, Number(player.minutes) || apps * 65);
    const rating = clamp(player.averageRating || player.form || 0, 0, 10);
    const goals = Math.max(0, Number(player.goals) || 0);
    const assists = Math.max(0, Number(player.assists) || 0);
    const cleanSheets = Math.max(0, Number(player.cleanSheets) || 0);
    const strength = clamp(player.leagueStrength || 60, 25, 100);
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
    const floor = Math.min(ceiling, Math.max(250, Number(player && player.wage) || 250));
    const performanceCap = ceiling * (.24 + .76 * performance / 100);
    return Math.round(clamp(wage, floor, Math.max(floor, Math.min(ceiling, performanceCap))));
  }

  function buildLoanProposal(input) {
    input = input || {};
    const player = input.player || {};
    const age = Number(player.age) || 24;
    const apps = Number(player.appearances || player.apps) || 0;
    const durationMonths = Number(input.durationMonths) === 6 ? 6 : 12;
    const isYouth = age < 23;
    const minutesTarget = isYouth ? (durationMonths === 6 ? 700 : 1400) : (durationMonths === 6 ? 450 : 900);
    const wageShare = clamp(input.wageShare === undefined ? (isYouth ? .35 : .5) : input.wageShare, 0, 1);
    return {
      type: "loan", durationMonths, minutesTarget,
      loanFee: Math.round(Math.max(0, Number(input.loanFee) || 0)),
      wageShare, optionToBuy: !!input.optionToBuy,
      buyOptionFee: input.optionToBuy ? Math.round(Math.max(0, Number(input.buyOptionFee) || Number(player.marketValue || 0))) : 0,
      developmentPriority: isYouth && apps < 12,
      recallClause: true
    };
  }

  function evaluateSeasonPerformance(player) {
    player = player || {};
    const score = performanceIndex(player);
    const apps = Math.max(0, Number(player.appearances || player.apps) || 0);
    const minutes = Math.max(0, Number(player.minutes) || apps * 65);
    const ovr = clamp(player.ovr || player.power || 50, 35, 99);
    const age = Math.max(16, Number(player.age) || 24);
    const development = age < 23 ? Math.max(0, 23 - age) * .55 : age > 30 ? -(age - 30) * .7 : 0;
    return {
      score: Number(clamp(score + development + Math.min(5, minutes / 900), 0, 100).toFixed(2)),
      marketValueMultiplier: Number(clamp(.55 + score / 85 + development / 100, .45, 1.9).toFixed(3)),
      transferReadiness: clamp((score * .62) + Math.min(18, apps * .45) + Math.max(0, ovr - 60) * .18, 0, 100),
      performanceSample: apps,
      minutes
    };
  }

  global.LWTransferAwards = Object.freeze({
    version: 2,
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