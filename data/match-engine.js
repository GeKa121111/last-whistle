/* Deterministic, shared event-based match simulation for LAST WHISTLE. No DOM or storage. */
(() => {
  "use strict";
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  function seededRandom(seed) {
    let value = (Number(seed) >>> 0) || 0x9e3779b9;
    return () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(text) {
    let value = 2166136261;
    for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return value >>> 0;
  }
  function positionProfile(position) {
    return ({
      "حارس مرمى": { shooter: 0, creator: 0.04, defender: 0.06, goalkeeper: true },
      "قلب دفاع": { shooter: 0.045, creator: 0.08, defender: 0.35 },
      "ظهير": { shooter: 0.06, creator: 0.18, defender: 0.25 },
      "وسط دفاعي": { shooter: 0.08, creator: 0.21, defender: 0.30 },
      "وسط مهاجم": { shooter: 0.09, creator: 0.36, defender: 0.14 },
      "جناح": { shooter: 0.19, creator: 0.25, defender: 0.10, finishingBonus: 0 },
      "مهاجم": { shooter: 0.19, creator: 0.24, defender: 0.05, finishingBonus: -0.005 },
      "رأس حربة": { shooter: 0.205, creator: 0.08, defender: 0.04, finishingBonus: 0.055 }
    })[position] || { shooter: 0.2, creator: 0.2, defender: 0.15 };
  }
  function squadRoleType(value) {
    const role = String(value || "بديل").trim().toLocaleLowerCase();
    // Keep the historical "بديل أساسي" label as a short-starting rotation role.
    if (role === "بديل أساسي") return "legacy-rotation-starter";
    if (role.includes("نجم الفريق") || role.includes("star player")) return "star";
    if (role === "أساسي" || role.includes("لاعب أساسي") || role.includes("regular starter")) return "starter";
    if (role.includes("تناوب") || role.includes("rotation") || role.includes("squad player")) return "rotation";
    if (role.includes("ناشئ") || role.includes("صاعد") || role.includes("prospect") || role.includes("youngster")) return "prospect";
    if (role.includes("بديل") || role.includes("احتياطي") || role.includes("impact sub") || role.includes("fringe player")) return "substitute";
    return "substitute";
  }
  function selectedMinutes(player, available, random, roleType, startsOnBench) {
    if (!available) return 0;
    // A rotation contract means shared starts and substitute appearances; it is not a fixed cameo role.
    const roleBase = roleType === "star" ? 88
      : roleType === "starter" ? 83
        : roleType === "legacy-rotation-starter" ? 66
          : roleType === "rotation" ? (startsOnBench ? 36 : 69)
            : roleType === "prospect" ? 22 : 39;
    const trust = clamp(player.trust, 0, 100);
    const fitness = clamp(player.fitness, 0, 100);
    const energy = clamp(player.energy, 0, 100);
    const fatigue = clamp(player.fatigue, 0, 100);
    let minutes = roleBase + (trust - 50) * 0.20 + (fitness - 50) * 0.11
      + (energy - 50) * 0.16 - fatigue * 0.20 + (random() * 24 - 12);
    if (energy < 25) minutes -= 15;
    if (fatigue > 70) minutes -= 12;
    return Math.round(clamp(minutes, 0, 90));
  }
  function positionPerformanceImpact(position, stats = {}, goalsAgainst = 0) {
    const tackles = Math.max(0, Number(stats.tacklesWon != null ? stats.tacklesWon : stats.tackles) || 0);
    const interceptions = Math.max(0, Number(stats.interceptions) || 0);
    const saves = Math.max(0, Number(stats.saves) || 0);
    const penaltiesSaved = Math.max(0, Number(stats.penaltiesSaved) || 0);
    const clearances = Math.max(0, Number(stats.clearances) || 0);
    const recoveries = Math.max(0, Number(stats.ballRecoveries) || 0);
    const keyPasses = Math.max(0, Number(stats.keyPasses) || 0);
    const conceded = Math.max(0, Number(goalsAgainst) || 0);
    const cleanSheetBonus = stats.cleanSheet === true ? 1.1 : 0;
    if (position === "حارس مرمى") return saves * 0.42 + penaltiesSaved * 0.75 + cleanSheetBonus - Math.min(4, conceded) * 0.045;
    if (["قلب دفاع", "ظهير", "وسط دفاعي"].includes(position)) {
      return tackles * 0.19 + interceptions * 0.21 + clearances * 0.16 + recoveries * 0.08 + cleanSheetBonus * 0.82;
    }
    if (position === "وسط مهاجم") return tackles * 0.10 + interceptions * 0.12 + recoveries * 0.10 + keyPasses * 0.13;
    if (position === "جناح") return tackles * 0.08 + interceptions * 0.09 + recoveries * 0.06;
    return tackles * 0.05 + interceptions * 0.06 + recoveries * 0.04;
  }
  function playerConcededGoals(minutes, events = [], redCardMinute = null) {
    const played = Math.max(0, Number(minutes) || 0);
    const timeline = Array.isArray(events) ? events : [];
    const entryEvent = timeline.find(event => event && event.type === "substitution-on" && event.side === "player");
    const rawEntryMinute = entryEvent ? Number(entryEvent.minute) : 0;
    const entryMinute = Number.isFinite(rawEntryMinute) ? Math.max(0, rawEntryMinute) : 0;
    const exits = timeline
      .filter(event => event && event.side === "player"
        && ["substitution", "injury", "red-card"].includes(event.type))
      .map(event => ({ type: event.type, minute: Number(event.minute) }))
      .filter(event => Number.isFinite(event.minute))
      .sort((a, b) => a.minute - b.minute);
    const explicitDismissal = redCardMinute == null ? null : Number(redCardMinute);
    const exitCandidates = exits.map(event => event.minute);
    if (Number.isFinite(explicitDismissal)) exitCandidates.push(explicitDismissal);
    // An explicit dismissal minute and event-ledger exits may both be supplied.
    // The earliest one ends responsibility; a later substitution must never override an earlier red card.
    const exitMinute = exitCandidates.length
      ? Math.min(...exitCandidates)
      : (entryMinute > 0 || played < 90 ? entryMinute + played : null);
    // Same-minute goals are ordered after substitution-on and before substitution/exit events.
    return timeline.filter(event => {
      if (!event || event.type !== "goal" || event.side !== "opponent") return false;
      const minute = Number(event.minute);
      if (!Number.isFinite(minute) || minute < entryMinute) return false;
      return exitMinute == null || minute <= exitMinute;
    }).length;
  }
  function playerEarnsCleanSheet(position, minutes, events = [], redCardMinute = null) {
    const eligible = ["حارس مرمى", "قلب دفاع", "ظهير", "وسط دفاعي"].includes(String(position || ""));
    const played = Math.max(0, Number(minutes) || 0);
    return eligible && played >= 60 && playerConcededGoals(played, events, redCardMinute) === 0;
  }
  function sameMinuteEventPriority(event) {
    return event && event.type === "substitution-on" && event.side === "player" ? -2
      : event && event.type === "assist" && event.side === "team" && event.creditedToPlayer === true ? -1
        : event && (event.type === "red-card" || event.type === "injury") ? 1
          : event && event.type === "substitution" && event.side === "player" ? 2 : 0;
  }
  function parseAggregateOffset(value) {
    if (value == null) return 0;
    if (typeof value !== "number" && typeof value !== "string") {
      throw new TypeError("invalid-aggregate-offset");
    }
    if (typeof value === "string" && value.trim() === "") {
      throw new TypeError("invalid-aggregate-offset");
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new TypeError("invalid-aggregate-offset");
    return parsed;
  }
  function validateSimulationSeed(value) {
    if (typeof value !== "number" && typeof value !== "string") {
      throw new TypeError("invalid-match-seed");
    }
    if (typeof value === "string" && value.trim() === "") {
      throw new TypeError("invalid-match-seed");
    }
    if (!Number.isFinite(Number(value))) {
      throw new TypeError("invalid-match-seed");
    }
    return value;
  }
  function simulateMatch(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("invalid-match-options");
    }
    const aggregateOffset = parseAggregateOffset(options.aggregateOffset);
    const simulationSeed = options.seed === undefined ? hash(JSON.stringify(options)) : validateSimulationSeed(options.seed);
    const random = seededRandom(simulationSeed);
    // Keep defensive-action sampling independent so it cannot perturb score/goal RNG.
    const defensiveRandom = seededRandom(hash("defensive-actions:" + String(simulationSeed)));
    const foulRandom = seededRandom(hash("player-fouls:" + String(simulationSeed)));
    const player = options.player && typeof options.player === "object" ? options.player : {};
    const profile = positionProfile(String(player.position || player.pos || ""));
    const teamPower = clamp(options.teamPower ?? options.ourPower ?? 50, 25, 95);
    const opponentPower = clamp(options.opponentPower ?? 50, 25, 95);
    const tactic = ["balanced", "attack", "defend", "counter"].includes(options.tactic) ? options.tactic : "balanced";
    const opponentTactic = ["balanced", "press", "compact", "wide", "counter"].includes(options.opponentTactic) ? options.opponentTactic : "balanced";
    const tacticalIQ = clamp(options.opponentTacticalIQ ?? opponentPower, 25, 98);
    const tacticalScale = clamp(0.72 + (tacticalIQ - 45) * 0.007, 0.55, 1.10);
    const homeAdvantage = options.home ? 3 : 0;
    const unavailable = options.playerAvailable === false || Number(player.injuryDays) > 0
      || Number(player.suspensionMatches) > 0 || Number(player.energy) <= 0;
    const playerRoleType = squadRoleType(player.role);
    // A rotation contract is mostly a bench role, but the player also earns occasional starts.
    const playerStartsOnBench = playerRoleType === "rotation"
      ? (!unavailable && random() < 0.68)
      : playerRoleType === "substitute" || playerRoleType === "prospect";
    const plannedMinutes = selectedMinutes(player, !unavailable, random, playerRoleType, playerStartsOnBench);
    const playerStartMinute = plannedMinutes > 0 && playerStartsOnBench
      ? Math.max(0, 90 - plannedMinutes) : 0;
    const plannedEndMinute = Math.min(90, playerStartMinute + plannedMinutes);
    // Cards/injuries can only occur inside the player's actual on-pitch interval.
    // If both are rolled, the first event ends participation and cancels the later one.
    const redCardRolled = plannedMinutes > 0 && random() < 0.0035;
    // Preserve the original seeded timing distribution for starters; sample substitutes
    // inside their actual entry-to-exit interval so they cannot be carded before entering.
    const redMinuteStart = playerStartMinute > 0 ? playerStartMinute + 1 : 38;
    const redMinuteSpan = playerStartMinute > 0 ? Math.max(1, plannedEndMinute - playerStartMinute) : 48;
    const redMinuteRolled = redCardRolled
      ? Math.floor(redMinuteStart + random() * redMinuteSpan) : 121;
    const injuryChance = plannedMinutes > 0
      ? clamp(0.008 + (100 - clamp(player.energy, 0, 100)) * 0.00032 + clamp(player.fatigue, 0, 100) * 0.00028, 0.008, 0.065)
      : 0;
    const injuryRolled = random() < injuryChance;
    const injuryMinuteStart = playerStartMinute > 0 ? playerStartMinute + 1 : 52;
    const injuryMinuteSpan = playerStartMinute > 0 ? Math.max(1, plannedEndMinute - playerStartMinute) : 39;
    const injuryMinuteRolled = injuryRolled
      ? Math.floor(injuryMinuteStart + random() * injuryMinuteSpan) : 121;
    let redCard = redCardRolled && redMinuteRolled > playerStartMinute && redMinuteRolled <= plannedEndMinute;
    let injured = injuryRolled && injuryMinuteRolled > playerStartMinute && injuryMinuteRolled <= plannedEndMinute;
    if (redCard && injured) {
      if (redMinuteRolled <= injuryMinuteRolled) injured = false;
      else redCard = false;
    }
    const redMinute = redCard ? redMinuteRolled : 121;
    const injuryMinute = injured ? injuryMinuteRolled : 121;
    let minutes = Math.max(0, Math.round(Math.min(plannedEndMinute, redMinute, injuryMinute) - playerStartMinute));
    let playerEndMinute = playerStartMinute + minutes;
    const events = [];
    if (playerStartMinute > 0 && minutes > 0) {
      events.push({ type: "substitution-on", minute: playerStartMinute, side: "player",
        actor: String(player.name || "اللاعب"), reason: "دخول من مقاعد البدلاء", description: "دخل اللاعب من مقاعد البدلاء" });
    }
    const stats = {
      minutes, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, chances: 0,
      keyPasses: 0, tackles: 0, tacklesWon: 0, interceptions: 0, saves: 0, penaltiesSaved: 0,
      clearances: 0, ballRecoveries: 0, passAttempts: 0, passesCompleted: 0, passingAccuracy: 0,
      fouls: 0, cleanSheet: false, yellowCards: 0, redCards: 0,
      injuryDays: injured ? (random() < 0.50 ? 2 : random() < 0.60 ? 5 : random() < 0.75 ? 10 : 21) : 0,
      rating: 0, playerAvailable: minutes > 0
    };
    const regulation = { for: 0, against: 0 };
    const shootout = { used: false, won: null, scoreFor: 0, scoreAgainst: 0, attempts: [] };
    const extraTime = { played: false, for: 0, against: 0, periods: [] };
    const teamName = String(options.teamName || "فريق اللاعب");
    const opponentName = String(options.opponentName || "المنافس");
    const position = String(player.position || player.pos || "");
    const fatigue = clamp(player.fatigue, 0, 100);
    const energy = clamp(player.energy, 0, 100);
    if (redCard) {
      stats.redCards = 1;
      events.push({ type: "red-card", minute: redMinute, side: "player", actor: String(player.name || "اللاعب"), reason: "طرد مباشر في محاكاة اللعبة" });
    }
    if (injured) events.push({ type: "injury", minute: injuryMinute, side: "player", actor: String(player.name || "اللاعب"), days: stats.injuryDays });
    if (minutes > 0 && !redCard && random() < 0.105) {
      stats.yellowCards = 1;
      events.push({ type: "yellow-card", minute: playerStartMinute + 1 + Math.floor(random() * minutes), side: "player", actor: String(player.name || "اللاعب") });
    }
    function createPeriod(periodStart, duration, isExtra) {
      const relativeGap = teamPower + homeAdvantage - opponentPower;
      // A full professional match should contain several attacking sequences per side;
      // the old baseline of six produced too few shots and made player seasons unusually low-scoring.
      let ourVolume = 9.5 + relativeGap / 19 + (tactic === "attack" ? 1.8 : tactic === "defend" ? -0.9 : tactic === "counter" && relativeGap < 0 ? 0.8 : 0);
      let oppVolume = 9.5 - relativeGap / 21 + (tactic === "attack" ? 0.8 : tactic === "defend" ? -1.5 : tactic === "counter" && relativeGap < 0 ? -0.3 : 0);
      const tacticalEffect = ({
        balanced: { our: 0, opponent: 0 },
        press: { our: -0.55, opponent: 0.70 },
        compact: { our: -0.90, opponent: -0.18 },
        wide: { our: -0.10, opponent: 0.45 },
        counter: { our: tactic === "attack" ? -0.50 : 0, opponent: tactic === "attack" ? 0.40 : -0.08 }
      })[opponentTactic];
      ourVolume = clamp(ourVolume + tacticalEffect.our * tacticalScale, 1, 18);
      oppVolume = clamp(oppVolume + tacticalEffect.opponent * tacticalScale, 1, 18);
      if (isExtra) { ourVolume *= 0.38; oppVolume *= 0.38; }
      const scale = duration / 90;
      const ourChances = Math.max(1, Math.round((ourVolume + random() * 3 - 1.5) * scale));
      const oppChances = Math.max(1, Math.round((oppVolume + random() * 3 - 1.5) * scale));
      let goalsFor = 0, goalsAgainst = 0;
      const keeperActive = profile.goalkeeper && playerEndMinute > periodStart && playerStartMinute < periodStart + duration;
      function minuteOf(index, total) {
        return Math.min(periodStart + duration, periodStart + 1 + Math.floor((index + random() * 0.85) / Math.max(1, total) * duration));
      }
      function sideChances(side, count) {
        for (let i = 0; i < count; i++) {
          const minute = minuteOf(i, count);
          events.push({ type: "chance", minute, side });
          if (random() > 0.69) continue;
          events.push({ type: "shot", minute, side, onTarget: false });
          const isOurs = side === "team";
          const playerCanAct = isOurs && minutes > 0 && minute >= playerStartMinute && minute <= playerEndMinute;
          const shooting = clamp(player.shooting, 1, 99);
          const composure = clamp(player.composure, 1, 99);
          // The match timeline already prevents involvement after the player's substitution.
          // Do not multiply the same minutes ratio a second time: doing so undercounts bench appearances.
          const roleSkill = position === "رأس حربة"
            ? shooting * 0.42 + composure * 0.26 + clamp(player.physical, 0, 100) * 0.16
              + clamp(player.speed, 0, 100) * 0.10 + clamp(player.fitness, 0, 100) * 0.06
            : position === "مهاجم"
              ? clamp(player.dribbling, 0, 100) * 0.30 + clamp(player.speed, 0, 100) * 0.26
                + clamp(player.vision, 0, 100) * 0.18 + shooting * 0.16 + clamp(player.passing, 0, 100) * 0.10
              : shooting * 0.36 + composure * 0.20 + clamp(player.dribbling, 0, 100) * 0.20
                + clamp(player.vision, 0, 100) * 0.14 + clamp(player.passing, 0, 100) * 0.10;
          const involvement = playerCanAct
            ? clamp(profile.shooter * (0.82 + roleSkill / 100 * 0.36)
              * (0.82 + energy / 500 - fatigue / 450), 0, 0.70)
            : 0;
          const byPlayer = playerCanAct && !profile.goalkeeper && random() < involvement;
          const defendingGoalkeeper = clamp(options.opponentGoalkeeping ?? 60, 25, 95);
          const playerShotChance = clamp(0.075 + shooting * 0.0022 + composure * 0.00045 + relativeGap * 0.0014 - defendingGoalkeeper * 0.00055
            + (Number(profile.finishingBonus) || 0)
            + (opponentTactic === "compact" ? -0.024 * tacticalScale : opponentTactic === "press" ? -0.010 * tacticalScale : 0), 0.075, 0.48);
          const teamShotChance = clamp(0.21 + relativeGap * 0.0022 - defendingGoalkeeper * 0.0006 + (opponentTactic === "compact" ? -0.020 * tacticalScale : opponentTactic === "press" ? -0.008 * tacticalScale : 0), 0.08, 0.39);
          const opponentShotChance = clamp(0.21 - relativeGap * 0.0018 - clamp(options.teamGoalkeeping ?? 55, 25, 95) * 0.00055 + (opponentTactic === "wide" ? 0.018 * tacticalScale : opponentTactic === "counter" && tactic === "attack" ? 0.022 * tacticalScale : 0), 0.07, 0.38);
          const isGoal = random() < (byPlayer ? playerShotChance : isOurs ? teamShotChance : opponentShotChance);
          const shotEvent = events[events.length - 1];
          shotEvent.shooter = byPlayer ? "player" : isOurs ? "teammate" : "opponent";
          shotEvent.creditedToPlayer = byPlayer;
          shotEvent.onTarget = isGoal || random() < 0.48;
          if (byPlayer) {
            stats.shots++;
            stats.chances++;
            if (shotEvent.onTarget) stats.shotsOnTarget++;
          }
          if (!isGoal) {
            if (!isOurs && keeperActive && minute >= playerStartMinute && minute <= playerEndMinute && shotEvent.onTarget) {
              stats.saves++;
              events.push({ type: "save", minute, side: "team", actor: String(player.name || "حارس اللاعب"), creditedToPlayer: true });
            }
            continue;
          }
          if (isOurs) { goalsFor++; if (byPlayer) stats.goals++; }
          else goalsAgainst++;
          shotEvent.onTarget = true;
          const scorer = byPlayer ? "player" : isOurs ? "teammate" : "opponent";
          const goalEventId = "goal-" + (events.filter(event => event.type === "goal").length + 1);
          events.push({ type: "goal", goalEventId, minute, side, scorer, creditedToPlayer: byPlayer });
          if (isOurs && !byPlayer && playerCanAct && !profile.goalkeeper && random() < clamp(0.005 + clamp(player.passing, 0, 100) * 0.00065 + clamp(player.vision, 0, 100) * 0.00055 + profile.creator * 0.12, 0.04, 0.24)) {
            stats.assists++;
            stats.keyPasses++;
            events.push({ type: "assist", goalEventId, minute: Math.max(playerStartMinute > 0 ? playerStartMinute : 1, minute - 1), side: "team", actor: String(player.name || "اللاعب"), goalMinute: minute, creditedToPlayer: true });
          }
        }
      }
      sideChances("team", ourChances);
      sideChances("opponent", oppChances);
      const playerPeriodStart = Math.max(periodStart, playerStartMinute);
      const playerPeriodEnd = Math.min(periodStart + duration, playerEndMinute);
      const playerActiveDuration = Math.max(0, playerPeriodEnd - playerPeriodStart);
      if (playerActiveDuration > 0 && !profile.goalkeeper) {
        // Use a dedicated RNG stream so defensive and passing stats do not perturb scores.
        const actionTrials = Math.ceil(playerActiveDuration / 9);
        const activityFactor = clamp(1 - fatigue * 0.003, 0.70, 1);
        const defenderWeight = clamp(profile.defender, 0, 1);
        const tackleChance = clamp((0.08 + defenderWeight * 0.42) * activityFactor, 0.05, 0.45);
        const interceptionChance = clamp((0.045 + defenderWeight * 0.30) * activityFactor, 0.03, 0.30);
        for (let attempt = 0; attempt < actionTrials; attempt += 1) {
          if (defensiveRandom() < tackleChance) {
            stats.tackles++; stats.tacklesWon++;
            const minute = playerPeriodStart + 1 + Math.floor(defensiveRandom() * playerActiveDuration);
            events.push({ type: "tackle", minute, side: "player", actor: String(player.name || "اللاعب") });
          }
          if (defensiveRandom() < interceptionChance) {
            stats.interceptions++;
            const minute = playerPeriodStart + 1 + Math.floor(defensiveRandom() * playerActiveDuration);
            events.push({ type: "interception", minute, side: "player", actor: String(player.name || "اللاعب") });
            if (defensiveRandom() < 0.48) {
              stats.ballRecoveries++;
              const recoveryMinute = playerPeriodStart + 1 + Math.floor(defensiveRandom() * playerActiveDuration);
              events.push({ type: "recovery", minute: recoveryMinute, side: "player", actor: String(player.name || "اللاعب") });
            }
          }
          const clearanceChance = clamp((0.025 + defenderWeight * 0.30) * activityFactor, 0.02, 0.34);
          if (defensiveRandom() < clearanceChance) {
            stats.clearances++;
            const clearanceMinute = playerPeriodStart + 1 + Math.floor(defensiveRandom() * playerActiveDuration);
            events.push({ type: "clearance", minute: clearanceMinute, side: "player", actor: String(player.name || "اللاعب") });
          }
        }
        const passTrials = Math.max(1, Math.floor(playerActiveDuration / 3));
        const passingSkill = clamp(player.passing, 0, 100);
        for (let attempt = 0; attempt < passTrials; attempt += 1) {
          stats.passAttempts++;
          if (defensiveRandom() < clamp(0.56 + passingSkill * 0.0042, 0.56, 0.98)) stats.passesCompleted++;
        }
        stats.passingAccuracy = stats.passAttempts > 0
          ? Math.round(stats.passesCompleted / stats.passAttempts * 1000) / 10 : 0;
      }
      if (playerActiveDuration > 0) {
        // Credit the user's own fouls separately; a dedicated RNG stream keeps score and tackle rolls stable.
        const foulTrials = Math.ceil(playerActiveDuration / 25);
        const defenderWeight = clamp(profile.defender, 0, 1);
        const foulChance = clamp(0.22 + defenderWeight * 0.18 + (tactic === "defend" ? 0.04 : 0), 0.18, 0.40);
        for (let attempt = 0; attempt < foulTrials; attempt += 1) {
          if (foulRandom() < foulChance) {
            stats.fouls++;
            const minute = playerPeriodStart + 1 + Math.floor(foulRandom() * playerActiveDuration);
            events.push({ type: "foul", minute, side: "player", actor: String(player.name || "اللاعب") });
          }
        }
      }
      if (random() < 0.16) events.push({ type: "foul", minute: Math.max(1, periodStart + Math.floor(random() * duration)), side: random() < 0.5 ? "team" : "opponent" });
      if (random() < 0.06) events.push({ type: "offside", minute: Math.max(1, periodStart + Math.floor(random() * duration)), side: random() < 0.5 ? "team" : "opponent" });
      return { for: goalsFor, against: goalsAgainst };
    }
    const first = createPeriod(0, 90, false);
    regulation.for = first.for; regulation.against = first.against;
    let finalFor = regulation.for, finalAgainst = regulation.against;
    const needsDecider = options.knockout === true && aggregateOffset + finalFor - finalAgainst === 0;
    if (needsDecider) {
      extraTime.played = true;
      // A player who completes regulation without a dismissal or injury remains active through extra time.
      if (playerEndMinute >= 90 && !redCard && !injured) {
        playerEndMinute = 120;
        minutes = playerEndMinute - playerStartMinute;
        stats.minutes = minutes;
      }
      const firstExtra = createPeriod(90, 15, true);
      const secondExtra = createPeriod(105, 15, true);
      extraTime.periods = [firstExtra, secondExtra];
      extraTime.for = firstExtra.for + secondExtra.for;
      extraTime.against = firstExtra.against + secondExtra.against;
      finalFor += extraTime.for; finalAgainst += extraTime.against;
      if (aggregateOffset + finalFor - finalAgainst === 0) {
        shootout.used = true;
        const skill = clamp(player.composure, 25, 95);
        const playerKeeperActive = Boolean(profile.goalkeeper && playerEndMinute >= 120 && !redCard && !injured);
        const opponentKeeper = clamp(options.opponentGoalkeeping ?? 60, 25, 95);
        const teamKeeper = clamp(playerKeeperActive
          ? (player.goalkeeping ?? options.teamGoalkeeping ?? 55)
          : (options.teamGoalkeeping ?? 55), 25, 95);
        const teamKickChance = clamp(0.76 + (teamPower - opponentPower) * 0.0012
          + (skill - 50) * 0.0007 - (opponentKeeper - 55) * 0.0009, 0.62, 0.88);
        const opponentSaveChance = clamp(0.10 + (teamKeeper - 55) * 0.0025, 0.04, 0.22);
        const opponentMissChance = 0.10;
        const attempts = [];
        let teamGoals = 0;
        let opponentGoals = 0;
        function takeTeamPenalty(round) {
          const scored = random() < teamKickChance;
          attempts.push({ side: "team", round, scored, savedByPlayer: false });
          if (scored) teamGoals++;
        }
        function takeOpponentPenalty(round) {
          const roll = random();
          const savedByPlayer = playerKeeperActive && roll < opponentSaveChance;
          const scored = !savedByPlayer && roll >= opponentSaveChance + opponentMissChance;
          attempts.push({ side: "opponent", round, scored, savedByPlayer });
          if (scored) opponentGoals++;
          if (savedByPlayer) {
            stats.penaltiesSaved++;
            events.push({ type: "penalty-save", minute: 120, side: "team",
              actor: String(player.name || "حارس اللاعب"), creditedToPlayer: true,
              attemptNumber: round, shootoutSide: "opponent" });
          }
        }
        // Standard five-kick sequence, ending early only when the remaining kicks cannot change the winner.
        for (let round = 1; round <= 5; round++) {
          takeTeamPenalty(round);
          takeOpponentPenalty(round);
          if (Math.abs(teamGoals - opponentGoals) > 5 - round) break;
        }
        // Sudden death continues in paired kicks until one side wins a round.
        for (let round = 6; teamGoals === opponentGoals && round <= 30; round++) {
          takeTeamPenalty(round);
          takeOpponentPenalty(round);
        }
        // A deterministic safety decider prevents a pathological PRNG sequence from looping forever.
        if (teamGoals === opponentGoals) {
          const teamScored = random() < teamKickChance;
          const opponentScored = !teamScored;
          attempts.push({ side: "team", round: 31, scored: teamScored, savedByPlayer: false });
          if (teamScored) teamGoals++;
          const savedByPlayer = playerKeeperActive && teamScored && random() < opponentSaveChance;
          attempts.push({ side: "opponent", round: 31, scored: opponentScored, savedByPlayer });
          if (opponentScored) opponentGoals++;
          if (savedByPlayer) {
            stats.penaltiesSaved++;
            events.push({ type: "penalty-save", minute: 120, side: "team",
              actor: String(player.name || "حارس اللاعب"), creditedToPlayer: true,
              attemptNumber: 31, shootoutSide: "opponent" });
          }
        }
        shootout.attempts = attempts;
        shootout.scoreFor = teamGoals;
        shootout.scoreAgainst = opponentGoals;
        shootout.won = teamGoals > opponentGoals;
        events.push({ type: "penalty-shootout", minute: 120, side: "team",
          won: shootout.won, scoreFor: shootout.scoreFor, scoreAgainst: shootout.scoreAgainst });
      }
    }
    const aggregateMargin = aggregateOffset + finalFor - finalAgainst;
    const matchMargin = finalFor - finalAgainst;
    const win = aggregateMargin > 0 || (aggregateMargin === 0 && shootout.won === true);
    const draw = aggregateMargin === 0 && !shootout.used;
    const matchWin = matchMargin > 0 || (matchMargin === 0 && shootout.used && shootout.won === true);
    const matchDraw = matchMargin === 0 && !shootout.used;
    const matchOutcome = matchWin ? "فوز" : matchDraw ? "تعادل" : "خسارة";
    const officialOutcome = matchMargin > 0 ? "فوز" : matchMargin < 0 ? "خسارة" : "تعادل";
    const advancementWinner = shootout.used ? (shootout.won ? teamName : opponentName)
      : aggregateMargin > 0 ? teamName : aggregateMargin < 0 ? opponentName : "";
    if (shootout.used && shootout.won === true && profile.goalkeeper && playerEndMinute >= 120 && !redCard && !injured) {
      stats.penaltiesSaved = 1;
      events.push({ type: "penalty-save", minute: 120, side: "team", actor: String(player.name || "حارس اللاعب"), creditedToPlayer: true });
    }
    const resultBonus = matchWin ? 0.30 : matchDraw ? 0.05 : -0.28;
    stats.cleanSheet = playerEarnsCleanSheet(position, minutes, events, redCard ? redMinute : null);
    const playerConceded = playerConcededGoals(minutes, events, redCard ? redMinute : null);
    const passingImpact = ["وسط مهاجم", "وسط دفاعي"].includes(position)
      ? Math.min(0.65, Math.max(0, stats.passingAccuracy - 70) * 0.018 + Math.min(5, stats.keyPasses) * 0.08) : 0;
    const impact = stats.goals * 1.55 + stats.assists * 0.95 + stats.keyPasses * 0.16
      - stats.fouls * 0.1 + positionPerformanceImpact(position, stats, playerConceded) + passingImpact;
    
    if (minutes > 0) {
      const scale = Math.min(1, minutes / 78);
      stats.rating = Math.round(clamp((6.05 + impact * scale + resultBonus * scale + (clamp(player.trust, 0, 100) - 50) * 0.004 + (clamp(player.fitness, 0, 100) - 50) * 0.003 - fatigue * 0.004), 4.0, 9.7) * 10) / 10;
    }
    if (minutes > 0 && playerEndMinute < 90 && !redCard && !injured) events.push({ type: "substitution", minute: playerEndMinute, side: "player", actor: String(player.name || "اللاعب"), reason: "قرار فني" });
    if (injured) events.push({ type: "substitution", minute: injuryMinute, side: "player", actor: String(player.name || "اللاعب"), reason: "إصابة" });
    if (redCard) events.push({ type: "substitution", minute: redMinute, side: "player", actor: String(player.name || "اللاعب"), reason: "طرد" });
    events.sort((a, b) => a.minute - b.minute || sameMinuteEventPriority(a) - sameMinuteEventPriority(b));
    return {
      home: Boolean(options.home), teamName, opponentName, tactic, regulation, extraTime, shootout,
      score: { for: finalFor, against: finalAgainst },
      outcome: win ? "فوز" : draw ? "تعادل" : "خسارة",
      officialOutcome, advancementWinner, matchOutcome,
      player: stats, events,
      metadata: { seed: simulationSeed, competition: String(options.competition || ""), mode: String(options.mode || "manual"), position, opponentTactic, tacticalIQ, aggregateOffset }
    };
  }
  function validateResult(result) {
    if (!result || !result.score || !result.player || !Array.isArray(result.events)) return { ok: false, reason: "invalid-shape" };
    const scoreValueValid = value =>
      (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
      && Number.isFinite(Number(value)) && Number.isInteger(Number(value)) && Number(value) >= 0;
    if (!scoreValueValid(result.score.for) || !scoreValueValid(result.score.against)) {
      return { ok: false, reason: "invalid-score" };
    }
    for (let index = 0; index < result.events.length; index++) {
      if (!(index in result.events)) return { ok: false, reason: "invalid-event-entry" };
      const event = result.events[index];
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return { ok: false, reason: "invalid-event-entry" };
      }
    }
    const allowedEventTypes = new Set(["assist", "chance", "clearance", "foul", "goal", "injury", "interception", "offside", "penalty-save", "penalty-shootout", "recovery", "red-card", "save", "shot", "substitution", "substitution-on", "tackle", "yellow-card"]);
    if (result.events.some(event => typeof event.type !== "string" || !allowedEventTypes.has(event.type))) {
      return { ok: false, reason: "invalid-event-type" };
    }
    const allowedEventSides = {
      assist: ["team"],
      chance: ["team", "opponent"],
      clearance: ["player"],
      foul: ["player", "team", "opponent"],
      goal: ["team", "opponent"],
      injury: ["player"],
      interception: ["player"],
      offside: ["team", "opponent"],
      "penalty-save": ["team"],
      "penalty-shootout": ["team"],
      recovery: ["player"],
      "red-card": ["player"],
      save: ["team"],
      shot: ["team", "opponent"],
      substitution: ["player"],
      "substitution-on": ["player"],
      tackle: ["player"],
      "yellow-card": ["player"]
    };
    if (result.events.some(event => !allowedEventSides[event.type]?.includes(event.side))) {
      return { ok: false, reason: "invalid-event-side" };
    }
    const numericPlayerStatFields = ["minutes", "goals", "assists", "shots", "shotsOnTarget", "chances", "keyPasses", "fouls", "redCards", "yellowCards", "injuryDays", "tackles", "tacklesWon", "interceptions", "saves", "penaltiesSaved", "clearances", "ballRecoveries", "passAttempts", "passesCompleted", "passingAccuracy", "rating"];
    const integerPlayerStatFields = new Set(["minutes", "goals", "assists", "shots", "shotsOnTarget", "chances", "keyPasses", "fouls", "redCards", "yellowCards", "injuryDays", "tackles", "tacklesWon", "interceptions", "saves", "penaltiesSaved", "clearances", "ballRecoveries", "passAttempts", "passesCompleted"]);
    const playerStatsValid = numericPlayerStatFields.every(field => {
      const value = result.player[field];
      if (value == null) return true; // Preserve older records that omit newer optional stats.
      if (typeof value !== "number" && typeof value !== "string") return false;
      if (typeof value === "string" && !value.trim()) return false;
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) return false;
      if (field === "minutes") return Number.isInteger(numeric) && numeric <= 120;
      if (field === "rating") return numeric <= 10;
      if (field === "passingAccuracy") return numeric <= 100;
      return !integerPlayerStatFields.has(field) || Number.isInteger(numeric);
    });
    const shotsOnTargetValid = result.player.shotsOnTarget == null || result.player.shots == null
      || Number(result.player.shotsOnTarget) <= Number(result.player.shots);
    const shotEvents = result.events.filter(event => event.type === "shot");
    const playerShotEvents = shotEvents.filter(event => event.side === "team" && event.creditedToPlayer === true);
    const modernShotMetadataPresent = shotEvents.some(event =>
      Object.prototype.hasOwnProperty.call(event, "onTarget"));
    const shotTargetMetadataPresent = playerShotEvents.some(event =>
      Object.prototype.hasOwnProperty.call(event, "onTarget"));
    // Once one shot opts into the modern ledger, every shot must carry a boolean target flag.
    // A ledger with no target flags remains a valid legacy record.
    const shotTargetMetadataConsistent = !modernShotMetadataPresent
      || shotEvents.every(event => typeof event.onTarget === "boolean");
    // Validate optional attribution fields whenever they are present, even in legacy
    // ledgers that do not carry onTarget metadata. Fully legacy shots may omit both.
    const shotAttributionConsistent = shotEvents.every(shot => {
      const hasShooter = Object.prototype.hasOwnProperty.call(shot, "shooter");
      const hasPlayerCredit = Object.prototype.hasOwnProperty.call(shot, "creditedToPlayer");
      if (!hasShooter && !hasPlayerCredit) return true;
      if (hasPlayerCredit && typeof shot.creditedToPlayer !== "boolean") return false;
      if (!hasShooter) {
        return shot.side === "team"
          || (shot.side === "opponent" && shot.creditedToPlayer === false);
      }
      if (shot.side === "team") {
        return (shot.shooter === "player" && (!hasPlayerCredit || shot.creditedToPlayer === true))
          || (shot.shooter === "teammate" && (!hasPlayerCredit || shot.creditedToPlayer === false));
      }
      return shot.side === "opponent" && shot.shooter === "opponent"
        && (!hasPlayerCredit || shot.creditedToPlayer === false);
    });
    const shotsOnTargetLedgerConsistent = result.player.shotsOnTarget == null || !shotTargetMetadataPresent
      || (playerShotEvents.every(event => typeof event.onTarget === "boolean")
        && Number(result.player.shotsOnTarget) === playerShotEvents.filter(event => event.onTarget === true).length);
    if (!playerStatsValid || !shotsOnTargetValid) return { ok: false, reason: "invalid-player-stats" };
    if (!shotTargetMetadataConsistent) return { ok: false, reason: "invalid-shot-target-metadata", shotTargetMetadataConsistent };
    if (!shotAttributionConsistent) return { ok: false, reason: "invalid-shot-attribution", shotAttributionConsistent };
    if (!shotsOnTargetLedgerConsistent) return { ok: false, reason: "inconsistent-shot-on-target-ledger" };
    const goalEvents = result.events.filter(event => event.type === "goal");
    // Goal/assist IDs and scorer labels form a modern attribution ledger independently of shot flags.
    const modernGoalMetadataPresent = goalEvents.some(goal =>
      Object.prototype.hasOwnProperty.call(goal, "goalEventId")
        || Object.prototype.hasOwnProperty.call(goal, "scorer"));
    const modernAssistMetadataPresent = result.events.some(event => event.type === "assist"
      && Object.prototype.hasOwnProperty.call(event, "goalEventId"));
    const goalAttributionConsistent = !modernGoalMetadataPresent || (() => {
      const goalIds = new Set();
      return goalEvents.every(goal => {
        if (typeof goal.goalEventId !== "string" || !goal.goalEventId.trim() || goalIds.has(goal.goalEventId)) {
          return false;
        }
        goalIds.add(goal.goalEventId);
        if (typeof goal.creditedToPlayer !== "boolean") return false;
        if (goal.side === "team") {
          return (goal.scorer === "player" && goal.creditedToPlayer === true)
            || (goal.scorer === "teammate" && goal.creditedToPlayer === false);
        }
        return goal.side === "opponent" && goal.scorer === "opponent" && goal.creditedToPlayer === false;
      });
    })();
    const goalShotLedgerConsistent = !(modernShotMetadataPresent || modernGoalMetadataPresent)
      || goalEvents.every(goal => {
        const goalIndex = result.events.indexOf(goal);
        if (goalIndex < 1) return false;
        const shot = result.events[goalIndex - 1];
        if (!shot || shot.type !== "shot" || shot.side !== goal.side
          || Number(shot.minute) !== Number(goal.minute)) return false;
        if (modernShotMetadataPresent) {
          return shot.onTarget === true && shot.shooter === goal.scorer
            && shot.creditedToPlayer === goal.creditedToPlayer;
        }
        const hasShooter = Object.prototype.hasOwnProperty.call(shot, "shooter");
        const hasPlayerCredit = Object.prototype.hasOwnProperty.call(shot, "creditedToPlayer");
        return (!hasShooter || shot.shooter === goal.scorer)
          && (!hasPlayerCredit || (typeof shot.creditedToPlayer === "boolean"
            && shot.creditedToPlayer === goal.creditedToPlayer));
      });
    const assistEvents = result.events.filter(event => event.type === "assist" && event.side === "team");
    const keyPassesLedgerConsistent = result.player.keyPasses == null || !modernShotMetadataPresent
      || (assistEvents.every(event => event.creditedToPlayer === true)
        && Number(result.player.keyPasses) === assistEvents.length);
    const saveEvents = result.events.filter(event => event.type === "save" && event.side === "team");
    const savesLedgerConsistent = !modernShotMetadataPresent
      || (result.player.saves == null
        ? saveEvents.length === 0
        : (saveEvents.every(event => event.creditedToPlayer === true)
          && Number(result.player.saves) === saveEvents.length));
    const saveShotLedgerConsistent = !modernShotMetadataPresent || result.events.every((event, index) => {
      if (event.type !== "save") return true;
      const shot = result.events[index - 1];
      return !!shot && shot.type === "shot" && shot.side === "opponent"
        && Number(shot.minute) === Number(event.minute)
        && shot.onTarget === true && shot.shooter === "opponent"
        && shot.creditedToPlayer === false
        && event.side === "team" && event.creditedToPlayer === true;
    });
    const knownMatchPosition = ["حارس مرمى", "قلب دفاع", "ظهير", "وسط دفاعي", "وسط مهاجم", "جناح", "مهاجم", "رأس حربة"]
      .includes(String(result.metadata?.position || ""));
    const saveRoleConsistent = !modernShotMetadataPresent || !knownMatchPosition
      || positionProfile(result.metadata.position).goalkeeper
      || (saveEvents.length === 0 && (result.player.saves == null || Number(result.player.saves) === 0));
    if (!keyPassesLedgerConsistent) return { ok: false, reason: "inconsistent-key-pass-ledger" };
    if (!savesLedgerConsistent) return { ok: false, reason: "inconsistent-save-ledger" };
    if (!saveShotLedgerConsistent) return { ok: false, reason: "invalid-save-shot-link", saveShotLedgerConsistent };
    if (!saveRoleConsistent) return { ok: false, reason: "invalid-save-player-position", saveRoleConsistent };
    const playerAvailabilityValid = result.player.playerAvailable == null
      || (typeof result.player.playerAvailable === "boolean"
        && (result.player.minutes == null
          || result.player.playerAvailable === (Number(result.player.minutes) > 0)));
    if (!playerAvailabilityValid) return { ok: false, reason: "invalid-player-availability" };
    const teamGoals = result.events.filter(event => event.type === "goal" && event.side === "team").length;
    const opponentGoals = result.events.filter(event => event.type === "goal" && event.side === "opponent").length;
    const playerGoals = result.events.filter(event => event.type === "goal" && event.side === "team" && event.creditedToPlayer).length;
    const assists = result.events.filter(event => event.type === "assist").length;
    const linkedAssistGoalIds = new Set();
    const assistGoalLinksValid = result.events.filter(event => event.type === "assist").every(assist => {
      const hasGoalId = Object.prototype.hasOwnProperty.call(assist, "goalEventId");
      if (!hasGoalId) return !modernShotMetadataPresent && !modernGoalMetadataPresent && !modernAssistMetadataPresent; // Preserve only fully legacy attribution ledgers.
      if (typeof assist.goalEventId !== "string" || !assist.goalEventId.trim()) return false;
      const goalId = assist.goalEventId;
      if (linkedAssistGoalIds.has(goalId)) return false; // A goal can have at most one credited assist.
      const matches = result.events.map((event, index) => ({ event, index }))
        .filter(item => item.event.type === "goal" && item.event.goalEventId === goalId);
      if (matches.length !== 1) return false;
      const { event: goal, index: goalIndex } = matches[0];
      const assistIndex = result.events.indexOf(assist);
      const linkValid = assist.side === "team" && assist.creditedToPlayer === true
        && goal.side === "team" && goal.scorer === "teammate" && goal.creditedToPlayer !== true
        && assistIndex < goalIndex
        && Number.isFinite(Number(assist.minute)) && Number.isFinite(Number(goal.minute))
        && Number(assist.minute) <= Number(goal.minute)
        && Number(assist.goalMinute) === Number(goal.minute);
      if (!linkValid) return false;
      linkedAssistGoalIds.add(goalId);
      return true;
    });
    const shots = result.events.filter(event => event.type === "shot" && event.side === "team" && event.creditedToPlayer === true).length;
    const tackles = result.events.filter(event => event.type === "tackle" && event.side === "player").length;
    const interceptions = result.events.filter(event => event.type === "interception" && event.side === "player").length;
    const fouls = result.events.filter(event => event.type === "foul" && event.side === "player").length;
    const saves = result.events.filter(event => event.type === "save" && event.creditedToPlayer).length;
    const penaltiesSaved = result.events.filter(event => event.type === "penalty-save" && event.creditedToPlayer).length;
    const clearances = result.events.filter(event => event.type === "clearance" && event.side === "player").length;
    const ballRecoveries = result.events.filter(event => event.type === "recovery" && event.side === "player").length;
    const playerExitEvents = result.events.filter(event => event.side === "player"
      && ["red-card", "injury", "yellow-card", "tackle", "interception", "foul", "clearance", "recovery"].includes(event.type));
    const playerEntryEvent = result.events.find(event => event.type === "substitution-on" && event.side === "player");
    const playerEntryMinute = playerEntryEvent ? Math.max(0, Number(playerEntryEvent.minute) || 0) : 0;
    const playerExitEvent = result.events
      .filter(event => event.side === "player" && ["red-card", "injury", "substitution"].includes(event.type))
      .sort((a, b) => Number(a.minute) - Number(b.minute))[0];
    const playerEndMinute = playerExitEvent ? Number(playerExitEvent.minute)
      : playerEntryMinute + Number(result.player.minutes || 0);
    const isPlayerActivityEvent = event => event.type === "penalty-save"
      ? event.creditedToPlayer === true
      : (event.creditedToPlayer === true
        || (event.side === "player" && ["red-card", "injury", "yellow-card", "tackle", "interception", "foul", "clearance", "recovery"].includes(event.type)));
    const isLegacyUnboundedPenaltySave = event => event.type === "penalty-save"
      && !playerExitEvent && playerEntryMinute === 0 && playerEndMinute === 90;
    const playerEventsInBounds = result.events.filter(event =>
      isPlayerActivityEvent(event) && !isLegacyUnboundedPenaltySave(event)).every(event =>
      Number(event.minute) >= playerEntryMinute && Number(event.minute) <= playerEndMinute);
    const eventMinutesValid = result.events.every(event => {
      if (!event || typeof event !== "object"
        || (typeof event.minute !== "number" && typeof event.minute !== "string")
        || (typeof event.minute === "string" && !event.minute.trim())) return false;
      const minute = Number(event.minute);
      if (!Number.isFinite(minute) || !Number.isInteger(minute) || minute < 1 || minute > 120) return false;
      if (event.type === "penalty-shootout") return minute === 120 && result.shootout?.used === true;
      if (minute <= 90) return true;
      return result.extraTime?.played === true;
    });
    let extraTimePeriodLedgerConsistent = true;
    const extraTimeLedgerConsistent = (() => {
      const extraTime = result.extraTime;
      const hasExtraTimeActivity = result.events.some(event =>
        event.type !== "penalty-shootout" && Number(event.minute) > 90);
      const isNonNegativeInteger = value =>
        (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
        && Number.isInteger(Number(value)) && Number(value) >= 0;
      const regulationMetadata = result.regulation;
      const regulationMetadataPresent = regulationMetadata != null;
      if (regulationMetadataPresent
        && (typeof regulationMetadata !== "object" || Array.isArray(regulationMetadata))) return false;
      const regulationScoresPresent = regulationMetadataPresent
        && (regulationMetadata.for != null || regulationMetadata.against != null);
      if (regulationScoresPresent
        && (!isNonNegativeInteger(regulationMetadata.for)
          || !isNonNegativeInteger(regulationMetadata.against))) return false;
      const regulationMatchesFinalScore = () => {
        if (!regulationScoresPresent) return true;
        return isNonNegativeInteger(result.score.for) && isNonNegativeInteger(result.score.against)
          && Number(result.score.for) === Number(regulationMetadata.for)
          && Number(result.score.against) === Number(regulationMetadata.against);
      };
      if (extraTime == null) {
        return !hasExtraTimeActivity && regulationMatchesFinalScore();
      }
      if (typeof extraTime !== "object" || Array.isArray(extraTime)) return false;
      const playedFlagPresent = Object.prototype.hasOwnProperty.call(extraTime, "played");
      if (playedFlagPresent && typeof extraTime.played !== "boolean") return false;
      const periodsPresent = Object.prototype.hasOwnProperty.call(extraTime, "periods");
      const scoreFieldsPresent = extraTime.for != null || extraTime.against != null;
      if (extraTime.played !== true) {
        const noExtraTimeScore = (extraTime.for == null && extraTime.against == null)
          || (isNonNegativeInteger(extraTime.for) && isNonNegativeInteger(extraTime.against)
            && Number(extraTime.for) === 0 && Number(extraTime.against) === 0);
        const noExtraTimePeriods = !periodsPresent
          || (Array.isArray(extraTime.periods) && extraTime.periods.length === 0);
        if (!noExtraTimePeriods) extraTimePeriodLedgerConsistent = false;
        return !hasExtraTimeActivity && noExtraTimeScore && noExtraTimePeriods
          && regulationMatchesFinalScore();
      }
      const extraTimeGoalsFor = result.events.filter(event =>
        event.type === "goal" && event.side === "team" && Number(event.minute) > 90).length;
      const extraTimeGoalsAgainst = result.events.filter(event =>
        event.type === "goal" && event.side === "opponent" && Number(event.minute) > 90).length;
      let extraFor = extraTimeGoalsFor;
      let extraAgainst = extraTimeGoalsAgainst;
      if (scoreFieldsPresent) {
        if (!isNonNegativeInteger(extraTime.for) || !isNonNegativeInteger(extraTime.against)) return false;
        extraFor = Number(extraTime.for);
        extraAgainst = Number(extraTime.against);
        if (extraFor !== extraTimeGoalsFor || extraAgainst !== extraTimeGoalsAgainst) return false;
      }
      if (periodsPresent) {
        if (!Array.isArray(extraTime.periods) || extraTime.periods.length !== 2) {
          extraTimePeriodLedgerConsistent = false;
          return false;
        }
        const periodsValid = extraTime.periods.every(period => period && typeof period === "object"
          && !Array.isArray(period) && isNonNegativeInteger(period.for) && isNonNegativeInteger(period.against));
        if (!periodsValid) {
          extraTimePeriodLedgerConsistent = false;
          return false;
        }
        // Extra-time period one is 91–105; period two is 106–120.
        // Totals alone are insufficient: each period must match its own goal events.
        const periodGoalCounts = [
          {
            for: result.events.filter(event => event.type === "goal" && event.side === "team"
              && Number(event.minute) > 90 && Number(event.minute) <= 105).length,
            against: result.events.filter(event => event.type === "goal" && event.side === "opponent"
              && Number(event.minute) > 90 && Number(event.minute) <= 105).length
          },
          {
            for: result.events.filter(event => event.type === "goal" && event.side === "team"
              && Number(event.minute) > 105 && Number(event.minute) <= 120).length,
            against: result.events.filter(event => event.type === "goal" && event.side === "opponent"
              && Number(event.minute) > 105 && Number(event.minute) <= 120).length
          }
        ];
        extraTimePeriodLedgerConsistent = extraTime.periods.every((period, index) =>
          Number(period.for) === periodGoalCounts[index].for
          && Number(period.against) === periodGoalCounts[index].against);
        if (!extraTimePeriodLedgerConsistent) return false;
        const periodFor = extraTime.periods.reduce((sum, period) => sum + Number(period.for), 0);
        const periodAgainst = extraTime.periods.reduce((sum, period) => sum + Number(period.against), 0);
        if (periodFor !== extraTimeGoalsFor || periodAgainst !== extraTimeGoalsAgainst) return false;
        if (scoreFieldsPresent && (periodFor !== extraFor || periodAgainst !== extraAgainst)) return false;
        extraFor = periodFor;
        extraAgainst = periodAgainst;
      }
      if (regulationScoresPresent) {
        if (!isNonNegativeInteger(result.score.for) || !isNonNegativeInteger(result.score.against)) return false;
        const regulationFor = Number(regulationMetadata.for);
        const regulationAgainst = Number(regulationMetadata.against);
        const finalFor = Number(result.score.for);
        const finalAgainst = Number(result.score.against);
        if (finalFor !== regulationFor + extraFor
          || finalAgainst !== regulationAgainst + extraAgainst) return false;
      }
      return true;
    })();
    // Validate aggregate offsets for every result, not only shootout ledgers.
    // Integer-valued numeric strings remain supported for older career saves.
    const metadataShapeConsistent = result.metadata == null
      || (typeof result.metadata === "object" && !Array.isArray(result.metadata));
    const aggregateOffsetValue = result.metadata?.aggregateOffset;
    const aggregateOffsetPresent = aggregateOffsetValue != null;
    const aggregateOffset = aggregateOffsetPresent ? Number(aggregateOffsetValue) : 0;
    const aggregateOffsetConsistent = !aggregateOffsetPresent
      || ((typeof aggregateOffsetValue === "number"
        || (typeof aggregateOffsetValue === "string" && aggregateOffsetValue.trim() !== ""))
        && Number.isSafeInteger(aggregateOffset));
    const shootoutLedgerConsistent = (() => {
      const shootout = result.shootout;
      const shootoutEvents = result.events.filter(event => event.type === "penalty-shootout");
      if (shootout == null) return shootoutEvents.length === 0;
      if (typeof shootout !== "object" || Array.isArray(shootout)) return false;
      const isNonNegativeInteger = value =>
        (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
        && Number.isInteger(Number(value)) && Number(value) >= 0;
      if (shootout.used !== true) {
        const unusedFlagValid = shootout.used == null || shootout.used === false;
        const unusedWinnerValid = shootout.won == null || shootout.won === false;
        const scoresAbsent = shootout.scoreFor == null && shootout.scoreAgainst == null;
        const scoresAreZero = isNonNegativeInteger(shootout.scoreFor)
          && isNonNegativeInteger(shootout.scoreAgainst)
          && Number(shootout.scoreFor) === 0 && Number(shootout.scoreAgainst) === 0;
        const attemptsAbsentOrEmpty = shootout.attempts == null
          || (Array.isArray(shootout.attempts) && shootout.attempts.length === 0);
        return unusedFlagValid && unusedWinnerValid && shootoutEvents.length === 0
          && (scoresAbsent || scoresAreZero) && attemptsAbsentOrEmpty;
      }
      if (typeof shootout.won !== "boolean"
        || !isNonNegativeInteger(shootout.scoreFor)
        || !isNonNegativeInteger(shootout.scoreAgainst)) return false;
      const scoreFor = Number(shootout.scoreFor);
      const scoreAgainst = Number(shootout.scoreAgainst);
      const hasExplicitExtraTimePlayedFlag = result.extraTime != null
        && Object.prototype.hasOwnProperty.call(result.extraTime, "played");
      const legacyDeciderMetadata = result.regulation == null && !hasExplicitExtraTimePlayedFlag;
      const extraTimeWasPlayed = legacyDeciderMetadata || result.extraTime?.played === true;
      const aggregateIsLevel = aggregateOffsetConsistent
        && isNonNegativeInteger(result.score?.for) && isNonNegativeInteger(result.score?.against)
        && (aggregateOffsetPresent
          ? aggregateOffset + Number(result.score.for) - Number(result.score.against) === 0
          : legacyDeciderMetadata || Number(result.score.for) === Number(result.score.against));
      if (scoreFor === scoreAgainst || shootout.won !== (scoreFor > scoreAgainst)
        || !aggregateIsLevel || !extraTimeWasPlayed || shootoutEvents.length !== 1) return false;
      const summary = shootoutEvents[0];
      const summaryValid = summary.side === "team" && typeof summary.won === "boolean"
        && summary.won === shootout.won
        && isNonNegativeInteger(summary.scoreFor) && isNonNegativeInteger(summary.scoreAgainst)
        && Number(summary.scoreFor) === scoreFor && Number(summary.scoreAgainst) === scoreAgainst;
      if (!summaryValid) return false;
      // Old career saves have only a summary score. Keep them readable; validate the detailed ledger when present.
      if (shootout.attempts == null) return true;
      const attempts = shootout.attempts;
      if (!Array.isArray(attempts) || attempts.length < 6 || attempts.length % 2 !== 0) return false;
      const attemptScores = { team: 0, opponent: 0 };
      const savedRounds = [];
      for (let index = 0; index < attempts.length; index++) {
        const attempt = attempts[index];
        const expectedSide = index % 2 === 0 ? "team" : "opponent";
        const expectedRound = Math.floor(index / 2) + 1;
        if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)
          || attempt.side !== expectedSide || attempt.round !== expectedRound
          || typeof attempt.scored !== "boolean" || typeof attempt.savedByPlayer !== "boolean") return false;
        if (attempt.savedByPlayer && (attempt.side !== "opponent" || attempt.scored)) return false;
        if (attempt.scored) attemptScores[attempt.side]++;
        if (attempt.savedByPlayer) savedRounds.push(attempt.round);
      }
      if (attemptScores.team !== scoreFor || attemptScores.opponent !== scoreAgainst) return false;
      const saveEvents = result.events.filter(event => event.type === "penalty-save");
      if (saveEvents.length !== savedRounds.length) return false;
      const playerIsGoalkeeper = positionProfile(result.metadata?.position || "").goalkeeper === true;
      const playerEntry = result.events.find(event => event.type === "substitution-on" && event.side === "player");
      const playerEntryMinute = playerEntry ? Math.max(0, Number(playerEntry.minute) || 0) : 0;
      const playerExit = result.events
        .filter(event => event.side === "player" && ["red-card", "injury", "substitution"].includes(event.type))
        .sort((a, b) => Number(a.minute) - Number(b.minute))[0];
      const playerEndMinute = playerExit ? Number(playerExit.minute)
        : playerEntryMinute + Number(result.player.minutes || 0);
      const playerKeeperActive = playerIsGoalkeeper && !playerExit && playerEndMinute >= 120;
      if (savedRounds.length > 0 && !playerKeeperActive) return false;
      const eventRounds = [];
      for (const event of saveEvents) {
        if (event.creditedToPlayer !== true || event.side !== "team"
          || Number(event.minute) !== 120 || event.shootoutSide !== "opponent"
          || !Number.isInteger(Number(event.attemptNumber))) return false;
        eventRounds.push(Number(event.attemptNumber));
      }
      savedRounds.sort((a, b) => a - b);
      eventRounds.sort((a, b) => a - b);
      return savedRounds.length === eventRounds.length
        && savedRounds.every((round, index) => round === eventRounds[index]);
    })();
    const eventsChronological = result.events.every((event, index) => index === 0
      || Number(result.events[index - 1].minute) <= Number(event.minute));
    const sameMinuteOrderConsistent = result.events.every((event, index) => {
      if (index === 0) return true;
      const previous = result.events[index - 1];
      return Number(previous.minute) !== Number(event.minute)
        || sameMinuteEventPriority(previous) <= sameMinuteEventPriority(event);
    });
    const exitIndex = result.events.findIndex(event => event.side === "player"
      && ["red-card", "injury", "substitution"].includes(event.type));
    const noPlayerActivityAfterExit = exitIndex < 0
      || !result.events.slice(exitIndex + 1).some(isPlayerActivityEvent);
    const redCards = result.events.filter(event => event.type === "red-card" && event.side === "player").length;
    const yellowCards = result.events.filter(event => event.type === "yellow-card" && event.side === "player").length;
    const injuries = result.events.filter(event => event.type === "injury" && event.side === "player").length;
    const redCardEvent = result.events.find(event => event.type === "red-card" && event.side === "player");
    const matchMargin = Number(result.score.for) - Number(result.score.against);
    const expectedMatchOutcome = matchMargin > 0 ? "فوز" : matchMargin < 0 ? "خسارة"
      : result.shootout?.used ? (result.shootout.won ? "فوز" : "خسارة") : "تعادل";
    const aggregateMargin = aggregateOffset + matchMargin;
    const expectedOutcome = aggregateMargin > 0 ? "فوز" : aggregateMargin < 0 ? "خسارة"
      : result.shootout?.used ? (result.shootout.won ? "فوز" : "خسارة") : "تعادل";
    const outcomeConsistent = !result.outcome || result.outcome === expectedOutcome;
    const matchOutcomeConsistent = !result.matchOutcome || result.matchOutcome === expectedMatchOutcome;
    const cleanSheetConsistent = result.player.cleanSheet == null
      || (typeof result.player.cleanSheet === "boolean" && result.player.cleanSheet === playerEarnsCleanSheet(
        result.metadata?.position || "", result.player.minutes, result.events, redCardEvent ? redCardEvent.minute : null));
    const valid = metadataShapeConsistent && keyPassesLedgerConsistent && savesLedgerConsistent
      && shotTargetMetadataConsistent && shotAttributionConsistent && assistGoalLinksValid && goalAttributionConsistent && goalShotLedgerConsistent && cleanSheetConsistent && outcomeConsistent && matchOutcomeConsistent
      && teamGoals === Number(result.score.for) && opponentGoals === Number(result.score.against)
      && result.player.goals != null && playerGoals === Number(result.player.goals)
      && result.player.assists != null && assists === Number(result.player.assists)
      && Number(result.player.goals) <= shots && Number(result.player.assists) <= teamGoals
      && (!positionProfile(result.metadata?.position || "").goalkeeper || Number(result.player.goals) === 0)
      && result.player.shots != null && Number(result.player.shots) === shots
      && tackles === Number(result.player.tackles || 0)
      && interceptions === Number(result.player.interceptions || 0)
      && fouls === Number(result.player.fouls || 0)
      && (result.player.tacklesWon == null || tackles === Number(result.player.tacklesWon))
      && (!modernShotMetadataPresent || saves === Number(result.player.saves || 0))
      && penaltiesSaved === Number(result.player.penaltiesSaved || 0)
      && clearances === Number(result.player.clearances || 0)
      && ballRecoveries === Number(result.player.ballRecoveries || 0)
      && Number(result.player.passesCompleted || 0) <= Number(result.player.passAttempts || 0)
      && Number(result.player.passingAccuracy || 0) === (Number(result.player.passAttempts) > 0
        ? Math.round(Number(result.player.passesCompleted) / Number(result.player.passAttempts) * 1000) / 10 : 0)
      && playerEventsInBounds && eventMinutesValid && aggregateOffsetConsistent && extraTimeLedgerConsistent && shootoutLedgerConsistent && eventsChronological && sameMinuteOrderConsistent && noPlayerActivityAfterExit
      && redCards === Number(result.player.redCards || 0)
      && yellowCards === Number(result.player.yellowCards || 0)
      && injuries === (Number(result.player.injuryDays || 0) > 0 ? 1 : 0);
    const reason = !metadataShapeConsistent ? "invalid-metadata-shape"
      : !aggregateOffsetConsistent ? "invalid-aggregate-offset" : valid ? "" : "inconsistent-match-ledger";
    return { ok: valid, reason, teamGoals, opponentGoals, playerGoals, assists, shots, tackles, interceptions, fouls, saves, penaltiesSaved, clearances, ballRecoveries, playerEventsInBounds, eventMinutesValid, metadataShapeConsistent, aggregateOffsetConsistent, extraTimeLedgerConsistent, extraTimePeriodLedgerConsistent, shootoutLedgerConsistent, eventsChronological, sameMinuteOrderConsistent, noPlayerActivityAfterExit, shotTargetMetadataConsistent, shotAttributionConsistent, assistGoalLinksValid, goalAttributionConsistent, goalShotLedgerConsistent, redCards, yellowCards, injuries, cleanSheetConsistent, outcomeConsistent, matchOutcomeConsistent };
  }

  function buildStoryReport(result, context) {
    result = result || {};
    context = context || {};
    const finiteNumber = (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    const sanitizeReportValue = (value, ancestors = new WeakSet()) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      if (!value || typeof value !== "object") return value;
      if (ancestors.has(value)) return null;
      ancestors.add(value);
      const sanitized = Array.isArray(value)
        ? value.map(item => sanitizeReportValue(item, ancestors))
        : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeReportValue(item, ancestors)]));
      ancestors.delete(value);
      return sanitized;
    };
    const score = result.score || {};
    const player = result.player || {};
    const reportEvents = Array.isArray(result.events) ? result.events
      .filter(event => event && typeof event === "object")
      .map(event => ({
        minute: finiteNumber(event.minute),
        type: String(event.type || ""),
        side: String(event.side || ""),
        description: String(event.description || event.text || "")
      })) : [];
    return {
      season: finiteNumber(context.season, 1) || 1,
      week: finiteNumber(context.week != null ? context.week : context.day, 1) || 1,
      score: { for: finiteNumber(score.for), against: finiteNumber(score.against) },
      player: {
        minutes: finiteNumber(player.minutes),
        goals: finiteNumber(player.goals),
        assists: finiteNumber(player.assists),
        rating: finiteNumber(player.rating != null ? player.rating : player.averageRating),
        shots: finiteNumber(player.shots),
        fouls: finiteNumber(player.fouls),
        redCards: finiteNumber(player.redCards),
        yellowCards: finiteNumber(player.yellowCards),
        injuryDays: finiteNumber(player.injuryDays),
        tackles: finiteNumber(player.tackles),
        tacklesWon: finiteNumber(player.tacklesWon),
        interceptions: finiteNumber(player.interceptions),
        saves: finiteNumber(player.saves),
        penaltiesSaved: finiteNumber(player.penaltiesSaved),
        clearances: finiteNumber(player.clearances),
        ballRecoveries: finiteNumber(player.ballRecoveries),
        passAttempts: finiteNumber(player.passAttempts),
        passesCompleted: finiteNumber(player.passesCompleted),
        passingAccuracy: finiteNumber(player.passingAccuracy),
        cleanSheet: player.cleanSheet === true
      },
      events: reportEvents,
      metadata: sanitizeReportValue(result.metadata || {})
    };
  }
  window.LWMatch = { simulateMatch, seededRandom, hash, validateResult, positionProfile, positionPerformanceImpact, playerConcededGoals, playerEarnsCleanSheet, buildStoryReport };
})();