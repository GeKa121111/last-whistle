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
      "جناح": { shooter: 0.31, creator: 0.25, defender: 0.10 },
      "مهاجم": { shooter: 0.36, creator: 0.22, defender: 0.05 },
      "رأس حربة": { shooter: 0.50, creator: 0.08, defender: 0.04 }
    })[position] || { shooter: 0.2, creator: 0.2, defender: 0.15 };
  }
  function selectedMinutes(player, available, random) {
    if (!available) return 0;
    const role = String(player.role || "بديل");
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
  function simulateMatch(options = {}) {
    const random = seededRandom(options.seed === undefined ? hash(JSON.stringify(options)) : options.seed);
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
    // Cards/injuries are only real if they happen while the player is on the pitch.
    // If both are rolled, the first event ends this player's participation, so the later one is cancelled.
    const redCardRolled = plannedMinutes > 0 && random() < 0.0035;
    const redMinuteRolled = redCardRolled ? Math.floor(38 + random() * 48) : 121;
    const injuryChance = plannedMinutes > 0
      ? clamp(0.008 + (100 - clamp(player.energy, 0, 100)) * 0.00032 + clamp(player.fatigue, 0, 100) * 0.00028, 0.008, 0.065)
      : 0;
    const injuryRolled = random() < injuryChance;
    const injuryMinuteRolled = injuryRolled ? Math.floor(52 + random() * 39) : 121;
    let redCard = redCardRolled && redMinuteRolled <= plannedMinutes;
    let injured = injuryRolled && injuryMinuteRolled <= plannedMinutes;
    if (redCard && injured) {
      if (redMinuteRolled <= injuryMinuteRolled) injured = false;
      else redCard = false;
    }
    const redMinute = redCard ? redMinuteRolled : 121;
    const injuryMinute = injured ? injuryMinuteRolled : 121;
    const minutes = Math.round(Math.min(plannedMinutes, redMinute, injuryMinute));
    const events = [];
    const stats = {
      minutes, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, chances: 0,
      keyPasses: 0, tackles: 0, interceptions: 0, saves: 0, fouls: 0,
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
      events.push({ type: "yellow-card", minute: Math.max(1, Math.floor(random() * minutes)), side: "player", actor: String(player.name || "اللاعب") });
    }
    function createPeriod(periodStart, duration, isExtra) {
      const relativeGap = teamPower + homeAdvantage - opponentPower;
      let ourVolume = 6 + relativeGap / 19 + (tactic === "attack" ? 1.8 : tactic === "defend" ? -0.9 : tactic === "counter" && relativeGap < 0 ? 0.8 : 0);
      let oppVolume = 6 - relativeGap / 21 + (tactic === "attack" ? 0.8 : tactic === "defend" ? -1.5 : tactic === "counter" && relativeGap < 0 ? -0.3 : 0);
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
      const keeperActive = profile.goalkeeper && minutes >= periodStart + 1;
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
          const playerCanAct = isOurs && minutes > 0 && minute <= minutes;
          const involvement = playerCanAct
            ? clamp(profile.shooter * (minutes / 90) * (0.82 + energy / 500 - fatigue / 450), 0, 0.62)
            : 0;
          const byPlayer = playerCanAct && !profile.goalkeeper && random() < involvement;
          const shooting = clamp(player.shooting, 1, 99);
          const composure = clamp(player.composure, 1, 99);
          const defendingGoalkeeper = clamp(options.opponentGoalkeeping ?? 60, 25, 95);
          const playerShotChance = clamp(0.075 + shooting * 0.0022 + composure * 0.00045 + relativeGap * 0.0014 - defendingGoalkeeper * 0.00055 + (opponentTactic === "compact" ? -0.024 * tacticalScale : opponentTactic === "press" ? -0.010 * tacticalScale : 0), 0.075, 0.48);
          const teamShotChance = clamp(0.15 + relativeGap * 0.0022 - defendingGoalkeeper * 0.0006 + (opponentTactic === "compact" ? -0.020 * tacticalScale : opponentTactic === "press" ? -0.008 * tacticalScale : 0), 0.08, 0.39);
          const opponentShotChance = clamp(0.17 - relativeGap * 0.0018 - clamp(options.teamGoalkeeping ?? 55, 25, 95) * 0.00055 + (opponentTactic === "wide" ? 0.018 * tacticalScale : opponentTactic === "counter" && tactic === "attack" ? 0.022 * tacticalScale : 0), 0.07, 0.38);
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
            if (!isOurs && keeperActive && minute <= minutes && shotEvent.onTarget) {
              stats.saves++;
              events.push({ type: "save", minute, side: "team", actor: String(player.name || "حارس اللاعب"), creditedToPlayer: true });
            }
            continue;
          }
          if (isOurs) { goalsFor++; if (byPlayer) stats.goals++; }
          else goalsAgainst++;
          shotEvent.onTarget = true;
          const scorer = byPlayer ? "player" : isOurs ? "teammate" : "opponent";
          events.push({ type: "goal", minute, side, scorer, creditedToPlayer: byPlayer });
          if (isOurs && !byPlayer && playerCanAct && !profile.goalkeeper && random() < clamp(0.07 + clamp(player.passing, 0, 100) * 0.0015 + clamp(player.vision, 0, 100) * 0.0012 + profile.creator * 0.12, 0.07, 0.34)) {
            stats.assists++;
            stats.keyPasses++;
            events.push({ type: "assist", minute: Math.max(1, minute - 1), side: "team", actor: String(player.name || "اللاعب"), goalMinute: minute, creditedToPlayer: true });
          }
        }
      }
      sideChances("team", ourChances);
      sideChances("opponent", oppChances);
      const playerActiveDuration = Math.max(0, Math.min(duration, minutes - periodStart));
      if (playerActiveDuration > 0 && random() < clamp(profile.defender * (playerActiveDuration / 90) * (0.3 + fatigue / 300), 0, 0.46)) {
        stats.tackles++;
        events.push({ type: "tackle", minute: periodStart + 1 + Math.floor(random() * playerActiveDuration), side: "player", actor: String(player.name || "اللاعب") });
      }
      if (playerActiveDuration > 0 && random() < clamp(profile.defender * 0.32 * (playerActiveDuration / 90), 0, 0.20)) {
        stats.interceptions++;
        events.push({ type: "interception", minute: periodStart + 1 + Math.floor(random() * playerActiveDuration), side: "player", actor: String(player.name || "اللاعب") });
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
    const win = aggregateOffset + finalFor - finalAgainst > 0 || (aggregateOffset + finalFor - finalAgainst === 0 && shootout.won === true);
    const draw = aggregateOffset + finalFor - finalAgainst === 0 && !shootout.used;
    const resultBonus = win ? 0.30 : draw ? 0.05 : -0.28;
    const impact = stats.goals * 1.55 + stats.assists * 0.95 + stats.keyPasses * 0.16 + stats.tackles * 0.18 + stats.interceptions * 0.12 + stats.saves * 0.22 - stats.fouls * 0.1;
    const positionContext = profile.goalkeeper ? stats.saves * 0.18 - finalAgainst * 0.24 : position === "قلب دفاع" || position === "ظهير" || position === "وسط دفاعي" ? stats.tackles * 0.12 - finalAgainst * 0.06 : 0;
    if (minutes > 0) {
      const scale = Math.min(1, minutes / 78);
      stats.rating = Math.round(clamp((6.05 + (impact + positionContext) * scale + resultBonus * scale + (clamp(player.trust, 0, 100) - 50) * 0.004 + (clamp(player.fitness, 0, 100) - 50) * 0.003 - fatigue * 0.004), 4.0, 9.7) * 10) / 10;
    }
    if (minutes > 0 && minutes < 90 && !redCard && !injured) events.push({ type: "substitution", minute: minutes, side: "player", actor: String(player.name || "اللاعب"), reason: "قرار فني" });
    if (injured) events.push({ type: "substitution", minute: injuryMinute, side: "player", actor: String(player.name || "اللاعب"), reason: "إصابة" });
    if (redCard) events.push({ type: "substitution", minute: redMinute, side: "player", actor: String(player.name || "اللاعب"), reason: "طرد" });
    const sameMinutePriority = event =>
      event.type === "red-card" || event.type === "injury" ? 1
        : event.type === "substitution" && event.side === "player" ? 2 : 0;
    events.sort((a, b) => a.minute - b.minute || sameMinutePriority(a) - sameMinutePriority(b));
    return {
      home: Boolean(options.home), teamName, opponentName, tactic, regulation, extraTime, shootout,
      score: { for: finalFor, against: finalAgainst },
      outcome: win ? "فوز" : draw ? "تعادل" : "خسارة",
      player: stats, events,
      metadata: { seed: Number(options.seed) >>> 0, competition: String(options.competition || ""), mode: String(options.mode || "manual"), position, opponentTactic, tacticalIQ }
    };
  }
  function validateResult(result) {
    if (!result || !result.score || !result.player || !Array.isArray(result.events)) return { ok: false, reason: "invalid-shape" };
    const teamGoals = result.events.filter(event => event.type === "goal" && event.side === "team").length;
    const opponentGoals = result.events.filter(event => event.type === "goal" && event.side === "opponent").length;
    const playerGoals = result.events.filter(event => event.type === "goal" && event.side === "team" && event.creditedToPlayer).length;
    const assists = result.events.filter(event => event.type === "assist").length;
    const shots = result.events.filter(event => event.type === "shot" && event.side === "team" && event.creditedToPlayer).length;
    const playerExitEvents = result.events.filter(event => event.side === "player"
      && ["red-card", "injury", "yellow-card", "tackle", "interception"].includes(event.type));
    const playerEventsInBounds = playerExitEvents.every(event => Number(event.minute) >= 1
      && Number(event.minute) <= Number(result.player.minutes));
    const eventsChronological = result.events.every((event, index) => index === 0
      || Number(result.events[index - 1].minute) <= Number(event.minute));
    const exitIndex = result.events.findIndex(event => event.side === "player"
      && ["red-card", "injury", "substitution"].includes(event.type));
    const isPlayerActivityEvent = event => event.creditedToPlayer === true
      || (event.side === "player" && ["yellow-card", "tackle", "interception"].includes(event.type));
    const noPlayerActivityAfterExit = exitIndex < 0
      || !result.events.slice(exitIndex + 1).some(isPlayerActivityEvent);
    const redCards = result.events.filter(event => event.type === "red-card" && event.side === "player").length;
    const yellowCards = result.events.filter(event => event.type === "yellow-card" && event.side === "player").length;
    const injuries = result.events.filter(event => event.type === "injury" && event.side === "player").length;
    const valid = teamGoals === result.score.for && opponentGoals === result.score.against
      && playerGoals === result.player.goals && assists === result.player.assists
      && result.player.goals <= shots && result.player.assists <= teamGoals
      && (!positionProfile(result.metadata?.position || "").goalkeeper || result.player.goals === 0)
      && result.player.shots === shots && playerEventsInBounds
      && eventsChronological && noPlayerActivityAfterExit
      && redCards === Number(result.player.redCards || 0)
      && yellowCards === Number(result.player.yellowCards || 0)
      && injuries === (Number(result.player.injuryDays || 0) > 0 ? 1 : 0);
    return { ok: valid, reason: valid ? "" : "inconsistent-match-ledger", teamGoals, opponentGoals, playerGoals, assists, shots, playerEventsInBounds, eventsChronological, noPlayerActivityAfterExit, redCards, yellowCards, injuries };
  }

  function buildStoryReport(result, context) {
    result = result || {};
    context = context || {};
    const score = result.score || {};
    const player = result.player || {};
    return {
      season: Number(context.season) || 1,
      week: Number(context.week != null ? context.week : context.day) || 1,
      score: { for: Number(score.for) || 0, against: Number(score.against) || 0 },
      player: {
        minutes: Number(player.minutes) || 0,
        goals: Number(player.goals) || 0,
        assists: Number(player.assists) || 0,
        rating: Number(player.rating != null ? player.rating : player.averageRating) || 0,
        shots: Number(player.shots) || 0,
        redCards: Number(player.redCards) || 0,
        yellowCards: Number(player.yellowCards) || 0,
        injuryDays: Number(player.injuryDays) || 0
      },
      events: Array.isArray(result.events) ? result.events.map(event => ({
        minute: Number(event.minute) || 0,
        type: String(event.type || ""),
        side: String(event.side || ""),
        description: String(event.description || event.text || "")
      })) : [],
      metadata: result.metadata || {}
    };
  }
  window.LWMatch = { simulateMatch, seededRandom, hash, validateResult, positionProfile, buildStoryReport };
})();