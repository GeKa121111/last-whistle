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
      "قلب دفاع": { shooter: 0.06, creator: 0.08, defender: 0.35 },
      "ظهير": { shooter: 0.11, creator: 0.18, defender: 0.25 },
      "وسط دفاعي": { shooter: 0.13, creator: 0.21, defender: 0.30 },
      "وسط مهاجم": { shooter: 0.27, creator: 0.36, defender: 0.14 },
      "جناح": { shooter: 0.31, creator: 0.25, defender: 0.10, finishingBonus: 0 },
      "مهاجم": { shooter: 0.36, creator: 0.24, defender: 0.05, finishingBonus: -0.005 },
      "رأس حربة": { shooter: 0.60, creator: 0.08, defender: 0.04, finishingBonus: 0.055 }
    })[position] || { shooter: 0.2, creator: 0.2, defender: 0.15 };
  }
  function selectedMinutes(player, available, random) {
    if (!available) return 0;
    const role = String(player.role || "بديل").trim();
    const roleBase = role === "أساسي" ? 83 : role === "بديل أساسي" ? 66 : 39;
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
    const tackles = Math.max(0, Number(stats.tackles) || 0);
    const interceptions = Math.max(0, Number(stats.interceptions) || 0);
    const saves = Math.max(0, Number(stats.saves) || 0);
    const conceded = Math.max(0, Number(goalsAgainst) || 0);
    const cleanSheetBonus = stats.cleanSheet === true ? 0.55 : 0;
    if (position === "حارس مرمى") return saves * 0.38 + cleanSheetBonus - Math.min(4, conceded) * 0.06;
    if (["قلب دفاع", "ظهير", "وسط دفاعي"].includes(position)) {
      return tackles * 0.16 + interceptions * 0.18 + cleanSheetBonus * 0.65;
    }
    if (position === "وسط مهاجم") return tackles * 0.10 + interceptions * 0.12;
    if (position === "جناح") return tackles * 0.08 + interceptions * 0.09;
    return tackles * 0.05 + interceptions * 0.06;
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
  function simulateMatch(options = {}) {
    const simulationSeed = options.seed === undefined ? hash(JSON.stringify(options)) : options.seed;
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
    const plannedMinutes = selectedMinutes(player, !unavailable, random);
    // A true bench substitute enters late and plays through the end of regulation;
    // other squad roles retain their existing start-and-exit minute model.
    const playerRole = String(player.role || "بديل").trim();
    const playerStartsOnBench = playerRole.includes("بديل") && playerRole !== "بديل أساسي";
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
      keyPasses: 0, tackles: 0, interceptions: 0, saves: 0, fouls: 0, cleanSheet: false,
      yellowCards: 0, redCards: 0, injuryDays: injured ? (random() < 0.50 ? 2 : random() < 0.60 ? 5 : random() < 0.75 ? 10 : 21) : 0,
      rating: 0, playerAvailable: minutes > 0
    };
    const regulation = { for: 0, against: 0 };
    const shootout = { used: false, won: null, scoreFor: 0, scoreAgainst: 0 };
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
          const teamShotChance = clamp(0.18 + relativeGap * 0.0022 - defendingGoalkeeper * 0.0006 + (opponentTactic === "compact" ? -0.020 * tacticalScale : opponentTactic === "press" ? -0.008 * tacticalScale : 0), 0.08, 0.39);
          const opponentShotChance = clamp(0.19 - relativeGap * 0.0018 - clamp(options.teamGoalkeeping ?? 55, 25, 95) * 0.00055 + (opponentTactic === "wide" ? 0.018 * tacticalScale : opponentTactic === "counter" && tactic === "attack" ? 0.022 * tacticalScale : 0), 0.07, 0.38);
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
          if (isOurs && !byPlayer && playerCanAct && !profile.goalkeeper && random() < clamp(0.07 + clamp(player.passing, 0, 100) * 0.0015 + clamp(player.vision, 0, 100) * 0.0012 + profile.creator * 0.22, 0.07, 0.34)) {
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
        // Sample roughly one defensive opportunity per nine minutes played. The old
        // one-roll-per-half logic produced well under one tackle per full match.
        const actionTrials = Math.ceil(playerActiveDuration / 9);
        const activityFactor = clamp(1 - fatigue * 0.003, 0.70, 1);
        const defenderWeight = clamp(profile.defender, 0, 1);
        const tackleChance = clamp((0.08 + defenderWeight * 0.42) * activityFactor, 0.05, 0.45);
        const interceptionChance = clamp((0.045 + defenderWeight * 0.30) * activityFactor, 0.03, 0.30);
        for (let attempt = 0; attempt < actionTrials; attempt += 1) {
          if (defensiveRandom() < tackleChance) {
            stats.tackles++;
            const minute = playerPeriodStart + 1 + Math.floor(defensiveRandom() * playerActiveDuration);
            events.push({ type: "tackle", minute, side: "player", actor: String(player.name || "اللاعب") });
          }
          if (defensiveRandom() < interceptionChance) {
            stats.interceptions++;
            const minute = playerPeriodStart + 1 + Math.floor(defensiveRandom() * playerActiveDuration);
            events.push({ type: "interception", minute, side: "player", actor: String(player.name || "اللاعب") });
          }
        }
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
    const aggregateOffset = Number(options.aggregateOffset) || 0;
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
        const chance = clamp(0.50 + (teamPower - opponentPower) * 0.004 + (skill - 50) * 0.002, 0.33, 0.67);
        shootout.won = random() < chance;
        shootout.scoreFor = shootout.won ? 5 : 4;
        shootout.scoreAgainst = shootout.won ? 4 : 5;
        events.push({ type: "penalty-shootout", minute: 120, side: "team", won: shootout.won, scoreFor: shootout.scoreFor, scoreAgainst: shootout.scoreAgainst });
      }
    }
    const aggregateMargin = aggregateOffset + finalFor - finalAgainst;
    const matchMargin = finalFor - finalAgainst;
    // The cup tie may be won on aggregate while this individual leg is a draw or loss.
    // Keep tie progression separate from the fixture result used for player match ratings.
    const win = aggregateMargin > 0 || (aggregateMargin === 0 && shootout.won === true);
    const draw = aggregateMargin === 0 && !shootout.used;
    const matchWin = matchMargin > 0 || (matchMargin === 0 && shootout.used && shootout.won === true);
    const matchDraw = matchMargin === 0 && !shootout.used;
    const matchOutcome = matchWin ? "فوز" : matchDraw ? "تعادل" : "خسارة";
    const resultBonus = matchWin ? 0.30 : matchDraw ? 0.05 : -0.28;
    // Extra-time player minutes and contributions are included before clean-sheet and concession accounting.
    stats.cleanSheet = playerEarnsCleanSheet(position, minutes, events, redCard ? redMinute : null);
    const playerConceded = playerConcededGoals(minutes, events, redCard ? redMinute : null);
    const impact = stats.goals * 1.55 + stats.assists * 0.95 + stats.keyPasses * 0.16 - stats.fouls * 0.1 + positionPerformanceImpact(position, stats, playerConceded);
    
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
      matchOutcome,
      player: stats, events,
      metadata: { seed: Number(options.seed) >>> 0, competition: String(options.competition || ""), mode: String(options.mode || "manual"), position, opponentTactic, tacticalIQ, aggregateOffset }
    };
  }
  function validateResult(result) {
    if (!result || !result.score || !result.player || !Array.isArray(result.events)) return { ok: false, reason: "invalid-shape" };
    for (let index = 0; index < result.events.length; index++) {
      if (!(index in result.events)) return { ok: false, reason: "invalid-event-entry" };
      const event = result.events[index];
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return { ok: false, reason: "invalid-event-entry" };
      }
    }
    const allowedEventTypes = new Set(["assist", "chance", "foul", "goal", "injury", "interception", "offside", "penalty-shootout", "red-card", "save", "shot", "substitution", "substitution-on", "tackle", "yellow-card"]);
    if (result.events.some(event => typeof event.type !== "string" || !allowedEventTypes.has(event.type))) {
      return { ok: false, reason: "invalid-event-type" };
    }
    const allowedEventSides = {
      assist: ["team"],
      chance: ["team", "opponent"],
      foul: ["player", "team", "opponent"],
      goal: ["team", "opponent"],
      injury: ["player"],
      interception: ["player"],
      offside: ["team", "opponent"],
      "penalty-shootout": ["team"],
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
    const numericPlayerStatFields = ["minutes", "goals", "assists", "shots", "shotsOnTarget", "chances", "keyPasses", "fouls", "redCards", "yellowCards", "injuryDays", "tackles", "interceptions", "saves", "rating"];
    const integerPlayerStatFields = new Set(["minutes", "goals", "assists", "shots", "shotsOnTarget", "chances", "keyPasses", "fouls", "redCards", "yellowCards", "injuryDays", "tackles", "interceptions", "saves"]);
    const playerStatsValid = numericPlayerStatFields.every(field => {
      const value = result.player[field];
      if (value == null) return true; // Preserve older records that omit newer optional stats.
      if (typeof value !== "number" && typeof value !== "string") return false;
      if (typeof value === "string" && !value.trim()) return false;
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) return false;
      if (field === "minutes") return Number.isInteger(numeric) && numeric <= 120;
      if (field === "rating") return numeric <= 10;
      return !integerPlayerStatFields.has(field) || Number.isInteger(numeric);
    });
    const shotsOnTargetValid = result.player.shotsOnTarget == null || result.player.shots == null
      || Number(result.player.shotsOnTarget) <= Number(result.player.shots);
    if (!playerStatsValid || !shotsOnTargetValid) return { ok: false, reason: "invalid-player-stats" };
    const playerAvailabilityValid = result.player.playerAvailable == null
      || (typeof result.player.playerAvailable === "boolean"
        && (result.player.minutes == null
          || result.player.playerAvailable === (Number(result.player.minutes) > 0)));
    if (!playerAvailabilityValid) return { ok: false, reason: "invalid-player-availability" };
    const teamGoals = result.events.filter(event => event.type === "goal" && event.side === "team").length;
    const opponentGoals = result.events.filter(event => event.type === "goal" && event.side === "opponent").length;
    const playerGoals = result.events.filter(event => event.type === "goal" && event.side === "team" && event.creditedToPlayer).length;
    const assists = result.events.filter(event => event.type === "assist").length;
    const assistGoalLinksValid = result.events.filter(event => event.type === "assist").every(assist => {
      const goalId = String(assist.goalEventId || "");
      if (!goalId) return true; // Keep validation compatible with legacy event records.
      const matches = result.events.map((event, index) => ({ event, index }))
        .filter(item => item.event.type === "goal" && item.event.goalEventId === goalId);
      if (matches.length !== 1) return false;
      const { event: goal, index: goalIndex } = matches[0];
      const assistIndex = result.events.indexOf(assist);
      return assist.side === "team" && assist.creditedToPlayer === true
        && goal.side === "team" && goal.scorer === "teammate" && goal.creditedToPlayer !== true
        && assistIndex < goalIndex
        && Number.isFinite(Number(assist.minute)) && Number.isFinite(Number(goal.minute))
        && Number(assist.minute) <= Number(goal.minute)
        && Number(assist.goalMinute) === Number(goal.minute);
    });
    const shots = result.events.filter(event => event.type === "shot" && event.side === "team" && event.creditedToPlayer).length;
    const tackles = result.events.filter(event => event.type === "tackle" && event.side === "player").length;
    const interceptions = result.events.filter(event => event.type === "interception" && event.side === "player").length;
    const fouls = result.events.filter(event => event.type === "foul" && event.side === "player").length;
    const playerExitEvents = result.events.filter(event => event.side === "player"
      && ["red-card", "injury", "yellow-card", "tackle", "interception", "foul"].includes(event.type));
    const playerEntryEvent = result.events.find(event => event.type === "substitution-on" && event.side === "player");
    const playerEntryMinute = playerEntryEvent ? Math.max(0, Number(playerEntryEvent.minute) || 0) : 0;
    const playerExitEvent = result.events
      .filter(event => event.side === "player" && ["red-card", "injury", "substitution"].includes(event.type))
      .sort((a, b) => Number(a.minute) - Number(b.minute))[0];
    const playerEndMinute = playerExitEvent ? Number(playerExitEvent.minute)
      : playerEntryMinute + Number(result.player.minutes || 0);
    const isPlayerActivityEvent = event => event.creditedToPlayer === true
      || (event.side === "player" && ["red-card", "injury", "yellow-card", "tackle", "interception", "foul"].includes(event.type));
    const playerEventsInBounds = result.events.filter(isPlayerActivityEvent).every(event =>
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
    const extraTimeLedgerConsistent = (() => {
      const extraTime = result.extraTime;
      const hasExtraTimeActivity = result.events.some(event =>
        event.type !== "penalty-shootout" && Number(event.minute) > 90);
      const isNonNegativeInteger = value =>
        (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
        && Number.isInteger(Number(value)) && Number(value) >= 0;
      const regulationMatchesFinalScore = () => {
        const regulation = result.regulation;
        if (!regulation || typeof regulation !== "object"
          || (regulation.for == null && regulation.against == null)) return true;
        return isNonNegativeInteger(regulation.for) && isNonNegativeInteger(regulation.against)
          && isNonNegativeInteger(result.score.for) && isNonNegativeInteger(result.score.against)
          && Number(result.score.for) === Number(regulation.for)
          && Number(result.score.against) === Number(regulation.against);
      };
      if (!extraTime || typeof extraTime !== "object") {
        return !hasExtraTimeActivity && regulationMatchesFinalScore();
      }
      const periodsPresent = Object.prototype.hasOwnProperty.call(extraTime, "periods");
      const scoreFieldsPresent = extraTime.for != null || extraTime.against != null;
      if (extraTime.played !== true) {
        const noExtraTimeScore = (extraTime.for == null && extraTime.against == null)
          || (isNonNegativeInteger(extraTime.for) && isNonNegativeInteger(extraTime.against)
            && Number(extraTime.for) === 0 && Number(extraTime.against) === 0);
        const noExtraTimePeriods = !periodsPresent
          || (Array.isArray(extraTime.periods) && extraTime.periods.length === 0);
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
        if (!Array.isArray(extraTime.periods) || extraTime.periods.length !== 2) return false;
        const periodsValid = extraTime.periods.every(period => period && typeof period === "object"
          && isNonNegativeInteger(period.for) && isNonNegativeInteger(period.against));
        if (!periodsValid) return false;
        const periodFor = extraTime.periods.reduce((sum, period) => sum + Number(period.for), 0);
        const periodAgainst = extraTime.periods.reduce((sum, period) => sum + Number(period.against), 0);
        if (periodFor !== extraTimeGoalsFor || periodAgainst !== extraTimeGoalsAgainst) return false;
        if (scoreFieldsPresent && (periodFor !== extraFor || periodAgainst !== extraAgainst)) return false;
        extraFor = periodFor;
        extraAgainst = periodAgainst;
      }
      if (result.regulation && typeof result.regulation === "object"
        && (result.regulation.for != null || result.regulation.against != null)) {
        if (!isNonNegativeInteger(result.regulation.for) || !isNonNegativeInteger(result.regulation.against)
          || !isNonNegativeInteger(result.score.for) || !isNonNegativeInteger(result.score.against)) return false;
        const regulationFor = Number(result.regulation.for);
        const regulationAgainst = Number(result.regulation.against);
        const finalFor = Number(result.score.for);
        const finalAgainst = Number(result.score.against);
        if (finalFor !== regulationFor + extraFor
          || finalAgainst !== regulationAgainst + extraAgainst) return false;
      }
      return true;
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
    const aggregateMargin = (Number(result.metadata?.aggregateOffset) || 0) + matchMargin;
    const expectedOutcome = aggregateMargin > 0 ? "فوز" : aggregateMargin < 0 ? "خسارة"
      : result.shootout?.used ? (result.shootout.won ? "فوز" : "خسارة") : "تعادل";
    const outcomeConsistent = !result.outcome || result.outcome === expectedOutcome;
    const matchOutcomeConsistent = !result.matchOutcome || result.matchOutcome === expectedMatchOutcome;
    const cleanSheetConsistent = result.player.cleanSheet === playerEarnsCleanSheet(
      result.metadata?.position || "", result.player.minutes, result.events, redCardEvent ? redCardEvent.minute : null);
    const valid = assistGoalLinksValid && cleanSheetConsistent && outcomeConsistent && matchOutcomeConsistent
      && teamGoals === result.score.for && opponentGoals === result.score.against
      && playerGoals === result.player.goals && assists === result.player.assists
      && result.player.goals <= shots && result.player.assists <= teamGoals
      && (!positionProfile(result.metadata?.position || "").goalkeeper || result.player.goals === 0)
      && result.player.shots === shots
      && tackles === Number(result.player.tackles || 0)
      && interceptions === Number(result.player.interceptions || 0)
      && fouls === Number(result.player.fouls || 0)
      && playerEventsInBounds && eventMinutesValid && extraTimeLedgerConsistent && eventsChronological && sameMinuteOrderConsistent && noPlayerActivityAfterExit
      && redCards === Number(result.player.redCards || 0)
      && yellowCards === Number(result.player.yellowCards || 0)
      && injuries === (Number(result.player.injuryDays || 0) > 0 ? 1 : 0);
    return { ok: valid, reason: valid ? "" : "inconsistent-match-ledger", teamGoals, opponentGoals, playerGoals, assists, shots, tackles, interceptions, fouls, playerEventsInBounds, eventMinutesValid, extraTimeLedgerConsistent, eventsChronological, sameMinuteOrderConsistent, noPlayerActivityAfterExit, assistGoalLinksValid, redCards, yellowCards, injuries, cleanSheetConsistent, outcomeConsistent, matchOutcomeConsistent };
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
        interceptions: finiteNumber(player.interceptions),
        saves: finiteNumber(player.saves),
        cleanSheet: player.cleanSheet === true
      },
      events: reportEvents,
      metadata: sanitizeReportValue(result.metadata || {})
    };
  }
  window.LWMatch = { simulateMatch, seededRandom, hash, validateResult, positionProfile, positionPerformanceImpact, playerConcededGoals, playerEarnsCleanSheet, buildStoryReport };
})();