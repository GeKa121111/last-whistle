/* Shared career progression and award engine for LAST WHISTLE. */
(() => {
  "use strict";

  const CONFIG = {
    shooting: { cost: 18, xp: 28, secondary: { composure: 7 } },
    dribbling: { cost: 16, xp: 27, secondary: { speed: 7 } },
    fitness: { cost: 22, xp: 26, secondary: { speed: 8 } },
    passing: { cost: 14, xp: 25, secondary: { vision: 8 } },
    defending: { cost: 18, xp: 25, secondary: { fitness: 6 } },
    goalkeeping: { cost: 19, xp: 28, secondary: { composure: 6 }, goalkeeperOnly: true },
    vision: { cost: 12, xp: 24, secondary: { passing: 6 } },
    composure: { cost: 10, xp: 22, secondary: { passing: 4 } },
    speed: { cost: 20, xp: 24, secondary: { fitness: 7 } },
    physical: { cost: 20, xp: 26, secondary: { defending: 5, fitness: 4 } }
  };
  const POSITION_ALIASES = {
    "gk": "حارس مرمى", "goalkeeper": "حارس مرمى", "keeper": "حارس مرمى", "goalie": "حارس مرمى",
    "cb": "قلب دفاع", "lcb": "قلب دفاع", "rcb": "قلب دفاع", "center back": "قلب دفاع", "centre back": "قلب دفاع", "central defender": "قلب دفاع",
    "lb": "ظهير", "rb": "ظهير", "lwb": "ظهير", "rwb": "ظهير", "wb": "ظهير", "fb": "ظهير",
    "full back": "ظهير", "fullback": "ظهير", "wing back": "ظهير", "wingback": "ظهير",
    "cdm": "وسط دفاعي", "dm": "وسط دفاعي", "defensive midfielder": "وسط دفاعي", "defensive mid": "وسط دفاعي", "holding midfielder": "وسط دفاعي",
    "cam": "وسط مهاجم", "am": "وسط مهاجم", "attacking midfielder": "وسط مهاجم", "attacking mid": "وسط مهاجم",
    "cm": "وسط", "rcm": "وسط", "lcm": "وسط", "central midfielder": "وسط", "midfielder": "وسط",
    "lw": "جناح", "rw": "جناح", "lm": "جناح", "rm": "جناح", "lwf": "جناح", "rwf": "جناح",
    "left wing": "جناح", "right wing": "جناح", "left winger": "جناح", "right winger": "جناح", "winger": "جناح",
    "wide midfielder": "جناح", "left midfielder": "جناح", "right midfielder": "جناح",
    "cf": "مهاجم", "ss": "مهاجم", "second striker": "مهاجم", "mobile forward": "مهاجم",
    "st": "رأس حربة", "fw": "رأس حربة", "fwd": "رأس حربة", "striker": "رأس حربة",
    "forward": "رأس حربة", "centre forward": "رأس حربة", "center forward": "رأس حربة"
  };
  function normalizeCareerPosition(position) {
    const raw = String(position || "").trim();
    if (!raw) return "";
    const key = raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    return POSITION_ALIASES[key] || raw;
  }

  const CAREER_ATTRIBUTE = {
    "حارس مرمى": "goalkeeping", "قلب دفاع": "physical", "ظهير": "speed",
    "وسط": "passing", "وسط دفاعي": "physical", "وسط مهاجم": "vision",
    "جناح": "dribbling", "مهاجم": "dribbling", "رأس حربة": "shooting"
  };

  const DEVELOPMENT_PLANS = {
    "حارس مرمى": { title: "حارس متكامل", summary: "رد الفعل والتمركز والهدوء بالكرة. ارفع الحراسة أولًا، وادعمها بالاتزان والتمرير واللياقة.", primary: ["goalkeeping"], secondary: ["composure", "passing", "fitness"], matchSkill: "goalkeeping" },
    "قلب دفاع": { title: "قلب دفاع قوي وقارئ للعب", summary: "اكسب الالتحامات والكرات الهوائية، وادعم قوتك بالتمركز والهدوء وبداية الهجمة بالتمرير.", primary: ["defending", "physical"], secondary: ["composure", "fitness", "passing"], matchSkill: "defending" },
    "ظهير": { title: "ظهير عصري", summary: "وازن بين السرعة واللياقة والقوة في الالتحامات، مع تمرير يساعدك على بناء الهجمة من الطرف.", primary: ["speed", "fitness"], secondary: ["passing", "defending", "physical"], matchSkill: "speed" },
    "وسط": { title: "لاعب وسط متكامل", summary: "اربط الدفاع بالهجوم، ووزّع اللعب بالتمرير والرؤية مع الحفاظ على اللياقة والقدرة على افتكاك الكرة.", primary: ["passing", "vision"], secondary: ["fitness", "composure", "defending", "dribbling"], matchSkill: "passing" },
    "وسط دفاعي": { title: "محور ارتكاز", summary: "اكسب الالتحامات واقطع الهجمات وابدأ البناء من الخلف. ركّز على الدفاع والتمرير والرؤية.", primary: ["defending", "physical"], secondary: ["vision", "fitness", "composure", "passing"], matchSkill: "defending" },
    "وسط مهاجم": { title: "صانع ألعاب", summary: "سرعة القرار والتمريرة الحاسمة أهم من الجري فقط. طوّر الرؤية والتمرير والهدوء تحت الضغط.", primary: ["vision", "passing"], secondary: ["composure", "dribbling", "shooting"], matchSkill: "vision" },
    "جناح": { title: "جناح اختراق", summary: "اكسب المواجهة واحد ضد واحد بالسرعة والمراوغة، ووازن ده بالقوة وقت الالتحام ثم حسّن الإنهاء وصناعة الفرص.", primary: ["dribbling", "speed"], secondary: ["shooting", "vision", "fitness", "physical"], matchSkill: "dribbling" },
    "مهاجم": { title: "مهاجم متحرك", summary: "مهاجم يشارك في بناء الهجمة، يتحرك بين الخطوط، يراوغ ويدخل المساحات ويصنع الفرص بجانب التسجيل. طوّر المراوغة والسرعة والتمرير مع إنهاء جيد.", primary: ["dribbling", "speed"], secondary: ["shooting", "vision", "passing", "composure"], matchSkill: "dribbling" },
    "رأس حربة": { title: "رأس حربة هدّاف", summary: "مهمتك الأساسية إنهاء الهجمة داخل المنطقة، استغلال العرضيات والكرات البينية، وحماية الكرة تحت ضغط المدافعين. ركّز على التسديد والهدوء والقوة البدنية.", primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"], matchSkill: "shooting" }
  };
  function positionDevelopmentPlan(state) {
    const rawPosition = typeof state === "string" ? state : String(state && state.pos || "جناح");
    const position = normalizeCareerPosition(rawPosition) || "جناح";
    const plan = DEVELOPMENT_PLANS[position] || DEVELOPMENT_PLANS["جناح"];
    return { position, title: plan.title, summary: plan.summary, primary: plan.primary.slice(), secondary: plan.secondary.slice(), matchSkill: plan.matchSkill };
  }
  function trainingFocusMultiplier(state, type) {
    const plan = positionDevelopmentPlan(state);
    if (plan.primary.includes(type)) return 1.2;
    if (plan.secondary.includes(type)) return 1.08;
    return 1;
  }

// Select a squad role from recent form and career output, not a single unusually high rating.
  // The caller passes post-match career totals and the match that has just been completed.
  function evaluateSquadRole(state, matchHistory = [], currentMatch = null) {
    const originalRole = String(state && state.role || "بديل");
    if (!state || state.academyCareer || state.academyReserve || normalizeLegacyBoolean(state.retired)) {
      return { role: originalRole, changed: false, reason: "protected-career", recentAverageRating: 0,
        recentContributionsPer90: 0, careerContributionsPer90: 0 };
    }

    const safeMetric = (value, maximum = 1000000) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(0, Math.min(maximum, numeric)) : 0;
    };
    const validRow = row => row && row.scope !== "international" && safeMetric(row.minutes, 120) > 0;
    const current = validRow(currentMatch) ? { ...currentMatch } : null;
    const allRows = uniqueMatchRows([current, ...(Array.isArray(matchHistory) ? matchHistory : [])])
      .filter(validRow);
    const recent = allRows.slice(0, 8);
    if (!recent.length) {
      return { role: originalRole, changed: false, reason: "no-appearances", recentAverageRating: 0,
        recentContributionsPer90: 0, careerContributionsPer90: 0 };
    }

    const sum = (rows, key) => {
      const maximum = key === "minutes" ? 120 : key === "rating" ? 10 : 20;
      return rows.reduce((total, row) => total + safeMetric(row[key], maximum), 0);
    };
    const recentMinutes = sum(recent, "minutes");
    const recentContributions = sum(recent, "goals") + sum(recent, "assists");
    const recentContributionsPer90 = recentContributions / Math.max(1, recentMinutes / 90);
    const ratedRows = recent.filter(row => safeMetric(row.rating, 10) > 0);
    const recentAverageRating = ratedRows.length
      ? ratedRows.reduce((total, row) => total + safeMetric(row.rating, 10), 0) / ratedRows.length : 0;

    const appearances = Math.floor(safeMetric(state.apps, 1000000));
    const averageCareerMinutes = allRows.length ? sum(allRows, "minutes") / allRows.length : 60;
    // Saves compact long careers, so estimate missing historical minutes from the observed mean.
    const careerMinutes = Math.max(sum(allRows, "minutes"), appearances * Math.max(1, averageCareerMinutes));
    const careerContributions = safeMetric(state.goals, Math.max(0, appearances * 20)) + safeMetric(state.assists, Math.max(0, appearances * 20));
    const careerContributionsPer90 = careerContributions / Math.max(1, careerMinutes / 90);
    const trust = safeMetric(state.trust, 100);
    const roleIsForward = ["رأس حربة", "مهاجم", "جناح", "وسط مهاجم"].includes(normalizeCareerPosition(state.pos));
    const veteranOutput = roleIsForward && appearances >= 35
      && careerContributionsPer90 >= 0.32 && recentAverageRating >= 5.9;
    const recentReady = recentAverageRating >= 6.25
      && (trust >= 22 || recentContributionsPer90 >= 0.25);
    const starterReady = (recentAverageRating >= 6.35
      && (trust >= 30 || recentContributionsPer90 >= 0.30))
      || (appearances >= 35 && roleIsForward && careerContributionsPer90 >= 0.35 && recentAverageRating >= 5.9);
    let role = originalRole;
    const roleKey = role.trim().toLocaleLowerCase();
    const roleIsYouth = roleKey.includes("ناشئ") || roleKey.includes("صاعد")
      || roleKey.includes("prospect") || roleKey.includes("youngster");
    const roleIsRotation = roleKey.includes("تناوب") || roleKey.includes("rotation")
      || roleKey.includes("squad player");
    const roleIsBench = roleKey === "بديل" || roleKey.includes("لاعب بديل")
      || roleKey.includes("احتياطي") || roleKey.includes("impact sub") || roleKey.includes("fringe player");
    if (roleIsYouth && appearances >= 3) role = "بديل";
    if ((role === "بديل" || roleIsBench) && appearances >= 8 && (recentReady || veteranOutput)) role = "بديل أساسي";
    // Rotation players move to a regular starting role only after sustained performance.
    if (roleIsRotation && appearances >= 16 && starterReady) role = "أساسي";
    if (role === "بديل أساسي" && appearances >= 16 && starterReady) role = "أساسي";

    return {
      role, changed: role !== originalRole,
      reason: role === originalRole ? "keep-role" : role === "أساسي" ? "starter-ready" : "rotation-ready",
      recentAverageRating: Math.round(recentAverageRating * 100) / 100,
      recentContributionsPer90: Math.round(recentContributionsPer90 * 100) / 100,
      careerContributionsPer90: Math.round(careerContributionsPer90 * 100) / 100
    };
  }

    const APPEARANCE_MILESTONES = [5, 10, 20, 30];
  const clamp = (value, min = 0, max = 100) =>
    Math.max(min, Math.min(max, Math.round(Number(value) || 0)));

  const STARTING_RANGES = {
    "حارس مرمى": { shooting:[15,35], dribbling:[15,35], passing:[15,35], speed:[15,35], fitness:[15,35], composure:[58,68], defending:[15,35], goalkeeping:[58,68], vision:[58,68], physical:[15,35] },
    "قلب دفاع": { shooting:[25,40], dribbling:[40,50], passing:[45,55], speed:[55,66], fitness:[55,66], composure:[45,55], defending:[55,66], goalkeeping:[0,0], vision:[40,50], physical:[55,66] },
    "ظهير": { shooting:[25,40], dribbling:[48,60], passing:[45,55], speed:[55,66], fitness:[55,66], composure:[45,55], defending:[55,66], goalkeeping:[0,0], vision:[45,55], physical:[52,62] },
    "وسط": { shooting:[42,55], dribbling:[48,60], passing:[56,68], speed:[48,60], fitness:[54,66], composure:[52,64], defending:[42,56], goalkeeping:[0,0], vision:[56,68], physical:[45,58] },
    "وسط دفاعي": { shooting:[40,52], dribbling:[45,58], passing:[55,65], speed:[50,60], fitness:[55,65], composure:[55,65], defending:[52,62], goalkeeping:[0,0], vision:[55,65], physical:[52,62] },
    "وسط مهاجم": { shooting:[50,62], dribbling:[50,62], passing:[55,65], speed:[50,62], fitness:[55,65], composure:[55,65], defending:[35,45], goalkeeping:[0,0], vision:[55,65], physical:[40,55] },
    "جناح": { shooting:[55,68], dribbling:[55,68], passing:[50,60], speed:[55,68], fitness:[50,60], composure:[50,60], defending:[15,28], goalkeeping:[0,0], vision:[50,60], physical:[45,58] },
    "مهاجم": { shooting:[53,65], dribbling:[56,68], passing:[50,61], speed:[57,69], fitness:[51,62], composure:[49,60], defending:[15,28], goalkeeping:[0,0], vision:[51,62], physical:[45,57] },
    "رأس حربة": { shooting:[60,72], dribbling:[44,57], passing:[42,54], speed:[48,61], fitness:[49,61], composure:[54,65], defending:[15,28], goalkeeping:[0,0], vision:[42,54], physical:[53,65] }
  };
  function startingStatsForPosition(position, random = Math.random) {
    const normalizedPosition = normalizeCareerPosition(position || "جناح") || "جناح";
    const ranges = STARTING_RANGES[normalizedPosition] || STARTING_RANGES["جناح"];
    const stats = {};
    for (const [key, range] of Object.entries(ranges)) {
      const roll = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
      stats[key] = range[0] + Math.floor(roll * (range[1] - range[0] + 1));
    }
    if (normalizedPosition !== "حارس مرمى") stats.goalkeeping = 0;
    return stats;
  }


  function uniqueMatchRows(rows) {
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter(row => {
      if (!row || typeof row !== "object") return false;
      const id = String(row.id || row.matchId || "").trim();
      const fallback = [row.scope || "", row.competition || row.leagueCompetition || "",
        row.season || "", row.segmentId || "", row.club || "", row.opponent || "",
        row.day || "", row.calendarDay || "", row.matchday || "",
        row.teamGoals ?? row.scoreFor ?? "", row.oppGoals ?? row.scoreAgainst ?? "",
        row.minutes ?? "", row.goals ?? "", row.assists ?? ""].join("|");
      const key = id ? "id:" + id : "row:" + fallback;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function uniqueCareerHistory(state) {
    const leagueRows = (Array.isArray(state.seasonLog) ? state.seasonLog : [])
      .filter(row => row && typeof row === "object")
      .map(row => ({ ...row, scope: row.scope || "league" }));
    const careerRows = Array.isArray(state.careerMatchHistory) ? state.careerMatchHistory : [];
    return uniqueMatchRows([...leagueRows, ...careerRows]);
  }

  const normalizeLegacyBoolean = (value, fallback = false) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value !== 0 : fallback;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off", ""].includes(normalized)) return false;
    }
    return fallback;
  };

  const safeLegacyMinutes = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(120, Math.floor(numeric))) : 0;
  };
  const safeLegacyCount = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numeric))) : 0;
  };
  const safeLegacyRating = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(10, numeric)) : 0;
  };

  function rebuildLegacyCareerStats(state) {
    const rows = uniqueCareerHistory(state);
    const normalizedRows = rows.map(row => ({ row, minutes: safeLegacyMinutes(row.minutes) }));
    state.qualifyingAppearances = normalizedRows.filter(entry => entry.minutes >= 20).length;
    state.careerAppearances = Math.max(safeLegacyCount(state.apps), safeLegacyCount(state.careerAppearances));
    state.careerMinutes = normalizedRows.reduce((sum, entry) => sum + entry.minutes, 0);
    state.careerMilestonesEarned = APPEARANCE_MILESTONES
      .filter(threshold => state.qualifyingAppearances >= threshold).map(String);
    return rows;
  }

  function deriveLeagueRatingStats(state) {
    const rows = uniqueCareerHistory(state).filter(row => row.scope === "league"
      && safeLegacyMinutes(row.minutes) > 0 && Number.isFinite(Number(row.rating)));
    state.leagueRatingSum = rows.reduce((sum, row) => sum + safeLegacyRating(row.rating), 0);
    state.leagueRatingCount = rows.length;
    return { sum: state.leagueRatingSum, count: state.leagueRatingCount };
  }

  function ensureState(state) {
    if (state.pos && String(state.pos).trim()) state.pos = normalizeCareerPosition(state.pos);
    state.freeAgent = normalizeLegacyBoolean(state.freeAgent);
    state.retired = normalizeLegacyBoolean(state.retired);
    state.playedToday = normalizeLegacyBoolean(state.playedToday);
    state.trainedToday = normalizeLegacyBoolean(state.trainedToday);
    state.nightToday = normalizeLegacyBoolean(state.nightToday);
    state.dailyActionUsed = normalizeLegacyBoolean(state.dailyActionUsed);
    state.journeyTransferReviewed = normalizeLegacyBoolean(state.journeyTransferReviewed);
    state.journeyEventSeen = normalizeLegacyBoolean(state.journeyEventSeen);
    state.journeySeasonReviewed = normalizeLegacyBoolean(state.journeySeasonReviewed);
    state.seasonFinished = normalizeLegacyBoolean(state.seasonFinished);
    state.winterBreakPending = normalizeLegacyBoolean(state.winterBreakPending);
    state.nationalCalled = normalizeLegacyBoolean(state.nationalCalled);
    state.nationalTournamentDone = normalizeLegacyBoolean(state.nationalTournamentDone);
    state.nationalTournamentQualified = normalizeLegacyBoolean(state.nationalTournamentQualified);
    state.nationalTournamentWinner = normalizeLegacyBoolean(state.nationalTournamentWinner);
    state.internationalPlayed = normalizeLegacyBoolean(state.internationalPlayed);
    if (state.cupState && typeof state.cupState === "object" && !Array.isArray(state.cupState)) {
      state.cupState.champion = normalizeLegacyBoolean(state.cupState.champion);
      state.cupState.eliminated = normalizeLegacyBoolean(state.cupState.eliminated);
      state.cupState.abandoned = normalizeLegacyBoolean(state.cupState.abandoned);
    }
    if (Array.isArray(state.cupHistory)) {
      state.cupHistory = state.cupHistory.map(row => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return row;
        const normalizedRow = { ...row };
        for (const flag of ["champion", "eliminated", "abandoned", "leftByTransfer"]) {
          if (Object.prototype.hasOwnProperty.call(normalizedRow, flag)) {
            normalizedRow[flag] = normalizeLegacyBoolean(normalizedRow[flag]);
          }
        }
        return normalizedRow;
      });
    } else {
      state.cupHistory = [];
    }
    state.academyCareer = normalizeLegacyBoolean(state.academyCareer);
    state.academyReserve = normalizeLegacyBoolean(state.academyReserve);
    state.academyGraduationPending = normalizeLegacyBoolean(state.academyGraduationPending);
    state.academyGraduated = normalizeLegacyBoolean(state.academyGraduated);
    state.privateCoach = normalizeLegacyBoolean(state.privateCoach);
    state.xpMultiplier = normalizeLegacyBoolean(state.xpMultiplier);
    state.careerStarted = normalizeLegacyBoolean(state.careerStarted);
    state.leagueSegmentIsPartial = normalizeLegacyBoolean(state.leagueSegmentIsPartial);
    state.boots = normalizeLegacyBoolean(state.boots);
    if (!state.agent || typeof state.agent !== "object") state.agent = normalizeLegacyBoolean(state.agent);
    state.diet = normalizeLegacyBoolean(state.diet);
    state.speedBoots = normalizeLegacyBoolean(state.speedBoots);
    state.strengthProgram = normalizeLegacyBoolean(state.strengthProgram);
    state.videoAnalyst = normalizeLegacyBoolean(state.videoAnalyst);
    state.homeGym = normalizeLegacyBoolean(state.homeGym);
    state.sleepCoach = normalizeLegacyBoolean(state.sleepCoach);
    state.physio = normalizeLegacyBoolean(state.physio);
    state.recoveryRoom = normalizeLegacyBoolean(state.recoveryRoom);
    state.privateChef = normalizeLegacyBoolean(state.privateChef);
    state.homeUpgrade = normalizeLegacyBoolean(state.homeUpgrade);
    state.sportsPsych = normalizeLegacyBoolean(state.sportsPsych);
    state.mediaTraining = normalizeLegacyBoolean(state.mediaTraining);
    state.creatorStudio = normalizeLegacyBoolean(state.creatorStudio);
    state.stylist = normalizeLegacyBoolean(state.stylist);
    state.charityFoundation = normalizeLegacyBoolean(state.charityFoundation);
    state.randomSeed = Number(state.randomSeed) >>> 0 || 0x6d2b79f5;
    state.trainingXP = state.trainingXP && typeof state.trainingXP === "object" ? state.trainingXP : {};
    state.careerAwards = Array.isArray(state.careerAwards) ? state.careerAwards : [];
    const moneyValue = Number(state.money);
    state.money = Number.isFinite(moneyValue)
      ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, moneyValue)) : 0;
    const savedWageMissing = state.weeklyWage === undefined || state.weeklyWage === null || state.weeklyWage === "";
    if (savedWageMissing) state.weeklyWage = state.freeAgent || state.retired ? 0 : 250;
    else {
      const weeklyWageValue = Number(state.weeklyWage);
      state.weeklyWage = Number.isFinite(weeklyWageValue)
        ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(weeklyWageValue))) : 0;
    }
    state.agentCommissionPaid = finiteCount(state.agentCommissionPaid);
    const contractSeasonsMissing = state.contractSeasons === undefined || state.contractSeasons === null || state.contractSeasons === "";
    if (contractSeasonsMissing) state.contractSeasons = state.freeAgent || state.retired ? 0 : 2;
    else {
      const contractSeasonsValue = Number(state.contractSeasons);
      state.contractSeasons = Number.isFinite(contractSeasonsValue)
        ? Math.max(0, Math.min(10, Math.floor(contractSeasonsValue)))
        : (state.freeAgent || state.retired ? 0 : 2);
    }
    const negotiationDaysMissing = state.daysSinceNegotiation === undefined || state.daysSinceNegotiation === null || state.daysSinceNegotiation === "";
    state.daysSinceNegotiation = negotiationDaysMissing ? 99 : finiteCount(state.daysSinceNegotiation);
    const careerXPValue = Number(state.careerXP);
    state.careerXP = Number.isFinite(careerXPValue)
      ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(careerXPValue))) : 0;
    const careerLevelValue = Number(state.careerLevel);
    state.careerLevel = Number.isFinite(careerLevelValue)
      ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(careerLevelValue))) : 1;
    const levelXPThreshold = 100 + Math.min(80, (state.careerLevel - 1) * 8);
    const levelXPValue = Number(state.levelXP);
    state.levelXP = Number.isFinite(levelXPValue)
      ? Math.max(0, Math.min(levelXPThreshold - 0.01, levelXPValue)) : 0;
    state.trainingSessions = finiteCount(state.trainingSessions);
    state.injuryDays = Math.min(60, finiteCount(state.injuryDays));
    state.playerPotential = clamp(state.playerPotential || 82, 65, 97);
    state.trainingIntensity = ["light", "normal", "intense"].includes(state.trainingIntensity) ? state.trainingIntensity : "normal";
    const hadMilestoneLedger = Array.isArray(state.careerMilestonesEarned);
    state.progressionMatchIds = Array.isArray(state.progressionMatchIds) ? state.progressionMatchIds : [];
    state.careerMilestonesEarned = hadMilestoneLedger ? state.careerMilestonesEarned : [];
    state.competitionStats = state.competitionStats && typeof state.competitionStats === "object"
      && !Array.isArray(state.competitionStats) ? state.competitionStats : {};
    const careerAppearancesValue = Number(state.careerAppearances);
    const legacyAppsValue = Number(state.apps);
    const appearanceSource = Number.isFinite(careerAppearancesValue)
      ? (careerAppearancesValue || (Number.isFinite(legacyAppsValue) ? legacyAppsValue : 0))
      : (Number.isFinite(legacyAppsValue) ? legacyAppsValue : 0);
    state.careerAppearances = finiteCount(appearanceSource);
    state.careerMinutes = finiteCount(state.careerMinutes);
    const leagueRatingSumValue = Number(state.leagueRatingSum);
    state.leagueRatingSum = Number.isFinite(leagueRatingSumValue)
      ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, leagueRatingSumValue)) : 0;
    state.leagueRatingCount = finiteCount(state.leagueRatingCount);
    if (state.qualifyingAppearances === undefined) {
      state.qualifyingAppearances = uniqueCareerHistory(state).filter(row => safeLegacyMinutes(row.minutes) >= 20).length;
    }
    state.qualifyingAppearances = finiteCount(state.qualifyingAppearances);
    state.suspensions = state.suspensions && typeof state.suspensions === "object" && !Array.isArray(state.suspensions) ? state.suspensions : {};
    for (const suspensionKey of Object.keys(state.suspensions)) {
      state.suspensions[suspensionKey] = Math.min(2, finiteCount(state.suspensions[suspensionKey]));
    }
    state.bookings = state.bookings && typeof state.bookings === "object" && !Array.isArray(state.bookings) ? state.bookings : {};
    for (const bookingKey of Object.keys(state.bookings)) {
      state.bookings[bookingKey] = Math.min(4, finiteCount(state.bookings[bookingKey]));
    }
    for (const [competitionKey, stats] of Object.entries(state.competitionStats)) {
      if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
        state.competitionStats[competitionKey] = {
          appearances: 0, qualifyingAppearances: 0, minutes: 0, goals: 0, assists: 0
        };
        continue;
      }
      for (const field of ["appearances", "qualifyingAppearances", "minutes", "goals", "assists"]) {
        stats[field] = finiteCount(stats[field]);
      }
    }
    if (!hadMilestoneLedger) {
      state.careerMilestonesEarned = APPEARANCE_MILESTONES
        .filter(threshold => state.qualifyingAppearances >= threshold).map(String);
    }
    state.fatigue = clamp(state.fatigue || 0, 0, 100);
    const trainingXPThreshold = Number(state.age) >= 30 ? 125 : Number(state.age) <= 21 ? 92 : 108;
    for (const key of Object.keys(CONFIG)) {
      const trainingXPValue = Number(state.trainingXP[key]);
      state.trainingXP[key] = Number.isFinite(trainingXPValue)
        ? Math.max(0, Math.min(trainingXPThreshold - 0.01, trainingXPValue)) : 0;
      const attributeValue = state[key] === null || state[key] === undefined || state[key] === "" ? NaN : Number(state[key]);
      state[key] = Number.isFinite(attributeValue) ? clamp(attributeValue, 0, 100) : 50;
    }
    // Repair legacy outfield saves without altering any other career or roster data.
    if (state.pos && state.pos !== "حارس مرمى") state.goalkeeping = 0;
    return state;
  }

  const OVR_WEIGHTS = {
    "حارس مرمى": { goalkeeping:.52,composure:.14,vision:.12,fitness:.08,passing:.06,physical:.04,speed:.02,defending:.02 },
    "قلب دفاع": { defending:.25,physical:.20,fitness:.15,speed:.12,composure:.10,passing:.08,vision:.05,dribbling:.03,shooting:.02 },
    "ظهير": { speed:.20,defending:.18,fitness:.15,physical:.12,passing:.12,dribbling:.08,vision:.05,composure:.05,shooting:.05 },
    "وسط": { passing:.18,vision:.16,fitness:.13,dribbling:.12,defending:.12,composure:.10,physical:.08,speed:.06,shooting:.05 },
    "وسط دفاعي": { defending:.20,passing:.18,vision:.16,physical:.12,fitness:.12,composure:.10,speed:.06,dribbling:.03,shooting:.03 },
    "وسط مهاجم": { vision:.22,passing:.22,composure:.14,dribbling:.12,shooting:.10,speed:.07,fitness:.07,physical:.03,defending:.03 },
    "جناح": { shooting:.18,dribbling:.20,speed:.19,passing:.13,vision:.10,fitness:.08,composure:.07,physical:.03,defending:.02 },
    "مهاجم": { shooting:.22,dribbling:.17,speed:.15,passing:.11,vision:.11,composure:.10,fitness:.08,physical:.04,defending:.02 },
    "رأس حربة": { shooting:.32,composure:.16,physical:.14,fitness:.10,speed:.09,dribbling:.07,vision:.05,passing:.04,defending:.02,goalkeeping:.01 }
  };
  function overall(state) {
    ensureState(state);
    const weights = OVR_WEIGHTS[state.pos] || OVR_WEIGHTS["جناح"];
    let weighted = 0, totalWeight = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (state.pos !== "حارس مرمى" && key === "goalkeeping") continue;
      const value = Number(state[key]);
      weighted += (Number.isFinite(value) ? value : 0) * weight;
      totalWeight += weight;
    }
    return Math.round(weighted / (totalWeight || 1));
  }

  function limitFor(state, key) {
    const agePenalty = Number(state.age) >= 30 ? Math.min(8, Number(state.age) - 29) : 0;
    const positionBonus = key === CAREER_ATTRIBUTE[state.pos] ? 3 : 0;
    return Math.max(Number(state[key]) || 0, Math.min(99, state.playerPotential + positionBonus - agePenalty));
  }

  function addTrainingXP(state, key, amount) {
    const threshold = Number(state.age) >= 30 ? 125 : Number(state.age) <= 21 ? 92 : 108;
    const amountValue = Number(amount);
    const safeAmount = Number.isFinite(amountValue) ? Math.max(0, Math.min(1000, amountValue)) : 0;
    const trainingXPValue = Number(state.trainingXP[key]);
    state.trainingXP[key] = (Number.isFinite(trainingXPValue)
      ? Math.max(0, Math.min(threshold - 0.01, trainingXPValue)) : 0) + safeAmount;
    let gained = 0;
    while (state.trainingXP[key] >= threshold && Number(state[key]) < limitFor(state, key)) {
      state.trainingXP[key] -= threshold;
      state[key] = clamp(Number(state[key]) + 1, 0, limitFor(state, key));
      gained++;
    }
    if (Number(state[key]) >= limitFor(state, key)) state.trainingXP[key] = 0;
    return gained;
  }

  function addCareerXP(state, amount) {
    const amountValue = Number(amount);
    const xp = Number.isFinite(amountValue) ? Math.max(0, Math.min(10000, Math.round(amountValue))) : 0;
    const careerXPValue = Number(state.careerXP);
    state.careerXP = Math.min(Number.MAX_SAFE_INTEGER, (Number.isFinite(careerXPValue)
      ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(careerXPValue))) : 0) + xp);
    const careerLevelValue = Number(state.careerLevel);
    state.careerLevel = Number.isFinite(careerLevelValue)
      ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(careerLevelValue))) : 1;
    const threshold = 100 + Math.min(80, (state.careerLevel - 1) * 8);
    const levelXPValue = Number(state.levelXP);
    state.levelXP = (Number.isFinite(levelXPValue)
      ? Math.max(0, Math.min(threshold - 0.01, levelXPValue)) : 0) + xp;
    const oldLevel = state.careerLevel;
    while (state.levelXP >= 100 + Math.min(80, (state.careerLevel - 1) * 8)) {
      state.levelXP -= 100 + Math.min(80, (state.careerLevel - 1) * 8);
      state.careerLevel++;
    }
    return state.careerLevel - oldLevel;
  }

  function train(state, type, options = {}) {
    ensureState(state);
    const random = typeof options.random === "function" ? options.random : () => {
      let x = (Number(state.randomSeed) >>> 0) || 0x6d2b79f5;
      x = (x + 0x6d2b79f5) >>> 0; state.randomSeed = x;
      let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const setup = CONFIG[type];
    if (!setup) return { ok: false, message: "نوع التدريب غير معروف." };
    if (setup.goalkeeperOnly && state.pos !== "حارس مرمى") return { ok: false, message: "تدريب الحراس متاح للاعب حارس المرمى فقط." };
    if (state.injuryDays > 0) return { ok: false, message: "لازم تكمّل الاستشفاء قبل التدريب." };
    if (state.playedToday) return { ok: false, message: "مفيش تدريب في يوم المباراة. تقدّم لليوم التالي عشان تتمرن." };
    if (state.trainedToday) return { ok: false, message: "أنهيت حصة اليوم. خُد راحة أو تقدّم لليوم التالي." };

    const intensity = state.trainingIntensity;
    const multipliers = {
      light: { energy: 0.70, xp: 0.75, risk: 0 },
      normal: { energy: 1.00, xp: 1.00, risk: 0.01 },
      intense: { energy: 1.30, xp: 1.32, risk: 0.09 }
    }[intensity] || { energy: 1, xp: 1, risk: 0.01 };
    const cost = Math.ceil(setup.cost * multipliers.energy);
    if (Number(state.energy) < cost) return { ok: false, message: "طاقتك " + state.energy + "%، والحصة تحتاج " + cost + "%. خُد راحة الأول." };

    state.energy = clamp(state.energy - cost);
    const coachBonus = state.privateCoach ? 8 : 0;
    const trainingAgeFactor = Number(state.age) >= 30 ? 0.78 : 1;
    const fatiguePenalty = 1 - clamp(state.fatigue, 0, 100) * 0.0035;
    const focusMultiplier = trainingFocusMultiplier(state, type);
    const storeXPMultiplier = state.xpMultiplier ? 1.25 : 1;
    const baseXP = Math.max(1, Math.round((setup.xp * multipliers.xp + coachBonus) * trainingAgeFactor * fatiguePenalty * focusMultiplier * storeXPMultiplier));
    const primaryGain = addTrainingXP(state, type, baseXP);
    const secondaryGains = [];
    for (const [skill, share] of Object.entries(setup.secondary)) {
      const gained = addTrainingXP(state, skill, Math.round(baseXP * share / 28));
      if (gained) secondaryGains.push(skill);
    }
    state.trainingSessions++;
    state.fatigue = clamp(Number(state.fatigue) + (intensity === "intense" ? 20 : intensity === "light" ? 7 : 13));
    const levels = addCareerXP(state, Math.round(baseXP * 0.45));
    state.morale = clamp(Number(state.morale) + 2);
    state.trainedToday = true;

    const tired = state.energy < 18 || state.fatigue >= 82;
    const risk = Math.min(0.32, multipliers.risk + Math.max(0, Number(state.fatigue) - 45) * 0.003);
    const injured = intensity === "intense" && (tired || random() < risk);
    if (injured) {
      const injuryRoll = random();
      const injuryDays = tired ? 7 : injuryRoll < 0.65 ? 2 : injuryRoll < 0.92 ? 5 : 10;
      state.injuryDays = Math.max(Number(state.injuryDays) || 0, injuryDays);
      state.injuryName = injuryDays >= 10 ? "إصابة عضلية متوسطة" : injuryDays >= 5 ? "شد عضلي" : "إجهاد تدريبي";
      state.morale = clamp(state.morale - 3);
    }
    return {
      ok: true, cost, xp: baseXP, gain: primaryGain, secondaryGains, levels, injured, focusMultiplier,
      message: primaryGain
        ? "زادت " + type + " نقطة" + (primaryGain > 1 ? "ين" : " واحدة") + " بعد تراكم الخبرة."
        : "اتسجلت " + baseXP + " نقطة خبرة في " + type + ". كل "
          + (Number(state.age) <= 21 ? 92 : Number(state.age) >= 30 ? 125 : 108)
          + " نقطة ترفع المهارة نقطة حتى سقف إمكاناتك."
    };
  }

  function matchDevelopment(state, match, legacyMinutes) {
    ensureState(state);
    const data = match && typeof match === "object" ? match : { rating: match, minutes: legacyMinutes };
    const minutesValue = Number(data.minutes);
    const played = Number.isFinite(minutesValue) ? Math.max(0, Math.min(120, Math.floor(minutesValue))) : 0;
    if (!played) return { gained: 0, skill: "", qualifying: false, milestones: [] };
    const safeMatchCount = (value, maximum = 100) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(0, Math.min(maximum, Math.floor(numeric))) : 0;
    };
    const goals = safeMatchCount(data.goals, 20);
    const assists = safeMatchCount(data.assists, 20);
    const matchId = String(data.matchId || ("legacy:" + (state.season || 1) + ":" + (state.apps || 0)
      + ":" + (state.seasonLog?.length || 0) + ":" + played));
    if (state.progressionMatchIds.includes(matchId)) return { gained: 0, skill: "", duplicate: true, qualifying: played >= 20, milestones: [] };
    state.progressionMatchIds.push(matchId);
    if (state.progressionMatchIds.length > 5000) state.progressionMatchIds.splice(0, state.progressionMatchIds.length - 5000);
    state.careerAppearances = Math.min(Number.MAX_SAFE_INTEGER, state.careerAppearances + 1);
    state.careerMinutes = Math.min(Number.MAX_SAFE_INTEGER, state.careerMinutes + played);
    const qualifying = played >= 20;
    const competitionKey = String(data.competitionKey || "club|unknown");
    const competition = state.competitionStats[competitionKey] || (state.competitionStats[competitionKey] = {
      appearances: 0, qualifyingAppearances: 0, minutes: 0, goals: 0, assists: 0
    });
    if (!competition || typeof competition !== "object" || Array.isArray(competition)) {
      state.competitionStats[competitionKey] = {
        appearances: 0, qualifyingAppearances: 0, minutes: 0, goals: 0, assists: 0
      };
    }
    const competitionStats = state.competitionStats[competitionKey];
    competitionStats.appearances = Math.min(Number.MAX_SAFE_INTEGER, finiteCount(competitionStats.appearances) + 1);
    competitionStats.minutes = Math.min(Number.MAX_SAFE_INTEGER, finiteCount(competitionStats.minutes) + played);
    competitionStats.goals = Math.min(Number.MAX_SAFE_INTEGER, finiteCount(competitionStats.goals) + goals);
    competitionStats.assists = Math.min(Number.MAX_SAFE_INTEGER, finiteCount(competitionStats.assists) + assists);
    if (qualifying) {
      state.qualifyingAppearances = Math.min(Number.MAX_SAFE_INTEGER, state.qualifyingAppearances + 1);
      competitionStats.qualifyingAppearances = Math.min(Number.MAX_SAFE_INTEGER,
        finiteCount(competitionStats.qualifyingAppearances) + 1);
    }
    const skill = CAREER_ATTRIBUTE[state.pos] || "passing";
    const ageFactor = Number(state.age) >= 30 ? 0.7 : Number(state.age) <= 21 ? 1.15 : 1;
    const rating = clamp(data.rating || 6, 3, 10);
    const performanceFactor = 0.72 + rating * 0.047;
    const potentialFactor = clamp(0.82 + (Number(state.playerPotential) - overall(state)) * 0.012, 0.68, 1.24);
    const fatigueFactor = clamp(1 - Number(state.fatigue || 0) * 0.0025, 0.70, 1);
    const storeXPMultiplier = state.xpMultiplier ? 1.25 : 1;
    const matchStats = data.stats && typeof data.stats === "object" ? data.stats : data;
    const tackles = safeMatchCount(matchStats.tacklesWon != null ? matchStats.tacklesWon : matchStats.tackles);
    const interceptions = safeMatchCount(matchStats.interceptions);
    const saves = safeMatchCount(matchStats.saves);
    const penaltiesSaved = safeMatchCount(matchStats.penaltiesSaved);
    const clearances = safeMatchCount(matchStats.clearances);
    const recoveries = safeMatchCount(matchStats.ballRecoveries);
    const keyPasses = safeMatchCount(matchStats.keyPasses);
    const cleanSheet = matchStats.cleanSheet === true;
    const defensivePosition = ["قلب دفاع", "ظهير", "وسط دفاعي"].includes(String(state.pos || ""));
    const creativeMidfieldPosition = ["وسط", "وسط مهاجم"].includes(String(state.pos || ""));
    const positionActionXP = state.pos === "حارس مرمى"
      ? Math.min(18, saves * 2 + penaltiesSaved * 5 + (cleanSheet ? 5 : 0))
      : defensivePosition
        ? Math.min(20, tackles * 1.8 + interceptions * 2.5 + clearances * 1.2 + recoveries * 1.1 + (cleanSheet ? 4 : 0))
        : creativeMidfieldPosition
          ? state.pos === "وسط"
            ? Math.min(12, keyPasses * 1.1 + recoveries * 0.8 + tackles * 0.3)
            : Math.min(12, keyPasses * 1.4 + recoveries * 0.6)
          : Math.min(12, goals * 4 + assists * 2);
    const xp = Math.max(1, Math.round(((played / 90) * rating * 1.8 * ageFactor * performanceFactor * potentialFactor * fatigueFactor
      + positionActionXP * Math.min(1, played / 75)) * storeXPMultiplier));
    const levels = addCareerXP(state, xp);
    const focusMultiplier = trainingFocusMultiplier(state, skill);
    const gained = addTrainingXP(state, skill, Math.round(xp * 0.75 * focusMultiplier));
    let defensiveXP = 0, goalkeeperXP = 0;
    if (defensivePosition && (tackles > 0 || interceptions > 0 || clearances > 0 || recoveries > 0 || cleanSheet)) {
      defensiveXP = Math.round((tackles * 2 + interceptions * 3 + clearances * 1.2 + recoveries * 1.1 + (cleanSheet ? 4 : 0)) * storeXPMultiplier
        * trainingFocusMultiplier(state, "defending") * Math.min(1, played / 75));
      addTrainingXP(state, "defending", defensiveXP);
    }
    if (state.pos === "حارس مرمى" && (saves > 0 || penaltiesSaved > 0 || cleanSheet)) {
      goalkeeperXP = Math.round((saves * 2.2 + penaltiesSaved * 5 + (cleanSheet ? 4 : 0)) * storeXPMultiplier
        * trainingFocusMultiplier(state, "goalkeeping") * Math.min(1, played / 75));
      addTrainingXP(state, "goalkeeping", goalkeeperXP);
    }
    const milestones = [];
    if (qualifying) {
      for (const threshold of APPEARANCE_MILESTONES) {
        const key = String(threshold);
        if (state.qualifyingAppearances >= threshold && !state.careerMilestonesEarned.includes(key)) {
          state.careerMilestonesEarned.push(key);
          const milestoneXP = 8 + threshold;
          addCareerXP(state, milestoneXP);
          const milestoneGain = addTrainingXP(state, skill, milestoneXP);
          if (milestoneGain) state[skill] = clamp(state[skill], 0, limitFor(state, skill));
          milestones.push({ appearances: threshold, xp: milestoneXP, skill, gained: milestoneGain });
        }
      }
    }
    return { gained, skill, xp, levels, qualifying, milestones, defensiveXP, goalkeeperXP, positionActionXP, careerAppearances: state.careerAppearances, qualifyingAppearances: state.qualifyingAppearances };
  }

  function hash(text) {
    let value = 2166136261;
    for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return value >>> 0;
  }

  function seeded(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function calendarGameDateISO(state) {
    const calendarDay = Math.max(1, Math.floor(Number(state && state.calendarDay) || 1));
    const elapsed = calendarDay - 1;
    const gameYear = 2024 + Math.floor(elapsed / 365);
    const dayInSeason = elapsed % 365;
    const reference = new Date(Date.UTC(2021, 7, 1) + dayInSeason * 86400000);
    const pad = value => String(value).padStart(2, "0");
    return String(gameYear).padStart(4, "0") + "-" + pad(reference.getUTCMonth() + 1) + "-"
      + pad(reference.getUTCDate()) + "T00:00:00.000Z";
  }

  function seasonAwards(state, league, teamRank) {
    ensureState(state);
    const log = uniqueMatchRows(Array.isArray(state.seasonLog) ? state.seasonLog : []);
    const competition = String(state.leagueCompetition || "");
    const country = String(state.leagueCountry || "");
    const awardCount = value => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.floor(numeric))) : 0;
    };
    const awardMinutes = value => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(0, Math.min(120, numeric)) : 0;
    };
    const awardRating = value => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(0, Math.min(10, numeric)) : 0;
    };
    const rankValue = Number(teamRank);
    const safeTeamRank = Number.isFinite(rankValue) && rankValue > 0 ? rankValue : 6;
    const playerMatches = log.filter(row => row && normalizeLegacyBoolean(row.playerAvailable, true) && awardMinutes(row.minutes) > 0
      && (!row.leagueCountry || row.leagueCountry === country)
      && (!row.leagueCompetition || !competition || row.leagueCompetition === competition));
    const appearances = playerMatches.length;
    if (appearances < 3) return [];
    const goals = playerMatches.reduce((sum, row) => sum + awardCount(row.goals), 0);
    const assists = playerMatches.reduce((sum, row) => sum + awardCount(row.assists), 0);
    const average = playerMatches.reduce((sum, row) => sum + awardRating(row.rating), 0) / appearances;
    const playerScore = average * 10 + goals * 0.34 + assists * 0.28 + Math.max(0, 6 - safeTeamRank) * 0.7;
    const opponents = (Array.isArray(league) ? league : []).filter(team => team && team.name !== state.clubName).map(team => {
      const rng = seeded(hash(String(state.season) + "|" + String(state.leagueCountry) + "|" + team.name));
      const powerValue = Number(team.power);
      const power = Number.isFinite(powerValue) && powerValue !== 0
        ? Math.max(0, Math.min(100, powerValue)) : 50;
      return {
        age: 18 + Math.floor(rng() * 18),
        goals: Math.max(0, Math.round(appearances * (0.04 + power / 850 + rng() * 0.09))),
        assists: Math.max(0, Math.round(appearances * (0.05 + power / 1100 + rng() * 0.07))),
        rating: 6.05 + power * 0.014 + rng() * 0.48,
        score: 0
      };
    });
    for (const player of opponents) player.score = player.rating * 10 + player.goals * 0.34 + player.assists * 0.28;
    const eligible = Number(state.age) <= 21;
    const youngOpponents = opponents.filter(player => player.age <= 21);
    const awardScope = String(state.season) + "|" + country + "|" + competition;
    const alreadyWon = new Set((state.careerAwards || []).map(award =>
      String(award.season) + "|" + (award.country || "") + "|" + (award.competition || "") + "|" + award.id));
    const definitions = [
      { id: "league-player", title: "لاعب الموسم — محاكاة", value: playerScore,
        compare: Math.max(0, ...opponents.map(p => p.score)), minimum: 69,
        note: "تقييم " + average.toFixed(2) + " • " + goals + " هدف • " + assists + " صناعة • مركز " + teamRank },
      { id: "golden-boot", title: "الحذاء الذهبي — محاكاة", value: goals,
        compare: Math.max(0, ...opponents.map(p => p.goals)), minimum: 3,
        note: goals + " هدف في " + appearances + " مشاركة" },
      { id: "playmaker", title: "صانع ألعاب الموسم — محاكاة", value: assists,
        compare: Math.max(0, ...opponents.map(p => p.assists)), minimum: 3,
        note: assists + " تمريرة حاسمة في " + appearances + " مشاركة" },
      { id: "young-player", title: "أفضل لاعب شاب — محاكاة", value: playerScore,
        compare: Math.max(0, ...youngOpponents.map(p => p.score)), minimum: 64, eligible,
        note: state.age + " سنة • " + appearances + " مشاركة • تقييم " + average.toFixed(2) }
    ];
    const won = [];
    for (const definition of definitions) {
      if (alreadyWon.has(awardScope + "|" + definition.id) || definition.eligible === false) continue;
      if (definition.value < definition.minimum || definition.value <= definition.compare) continue;
      const award = {
        id: definition.id, title: definition.title, season: Number(state.season) || 1,
        club: String(state.clubName || ""), country, competition, note: definition.note,
        date: calendarGameDateISO(state)
      };
      state.careerAwards.unshift(award);
      won.push(award);
    }
    const scorerCount = Number(state.topScorerAwards);
    const safeScorerCount = Number.isFinite(scorerCount)
      ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER - 1, Math.floor(scorerCount))) : 0;
    state.topScorerAwards = safeScorerCount + (won.some(award => award.id === "golden-boot") ? 1 : 0);
    const rewards = { "league-player": 650, "golden-boot": 450, playmaker: 400, "young-player": 500 };
    const balanceValue = Number(state.money);
    const balance = Number.isFinite(balanceValue) ? Math.max(0, balanceValue) : 0;
    state.money = balance + won.reduce((sum, award) => sum + (rewards[award.id] || 0), 0);
    return won;
  }

  function leagueMatchTarget(teamCount) {
    const n = Math.max(0, Math.floor(Number(teamCount) || 0));
    return n < 2 ? 0 : 2 * (n - 1);
  }

  function leagueMatchDaysRemaining(lastMatchCalendarDay, currentCalendarDay, minimumGap = 5) {
    const last = Math.max(0, Math.floor(Number(lastMatchCalendarDay) || 0));
    const current = Math.max(0, Math.floor(Number(currentCalendarDay) || 0));
    const gap = Math.max(1, Math.floor(Number(minimumGap) || 7));
    if (last <= 0 || current >= last + gap) return 0;
    return last + gap - current;
  }

  const toNonNegativeInteger = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
  };

  const finiteCount = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numeric))) : 0;
  };

  function normalizeLeagueRoundIndex(savedRoundIndex, roundHistory, leagueApps, roundCount) {
    const history = Array.isArray(roundHistory) ? roundHistory : [];
    const historyRound = history.reduce((maximum, row) =>
      Math.max(maximum, toNonNegativeInteger(row?.matchday)), 0);
    const legacyRound = Math.max(historyRound, toNonNegativeInteger(leagueApps));
    const hasSavedIndex = savedRoundIndex !== undefined && savedRoundIndex !== null && savedRoundIndex !== "";
    const saved = Number(savedRoundIndex);
    const candidate = hasSavedIndex && Number.isFinite(saved)
      ? Math.max(0, Math.floor(saved), legacyRound)
      : legacyRound;
    return Math.min(candidate, toNonNegativeInteger(roundCount));
  }

  function contractStateForSeasonTransition(state) {
    if (!state || !state.loan) return state;
    const loan = state.loan;
    const parentWageValue = Number(loan.parentWage);
    const parentContractSeasonsValue = Number(loan.parentContractSeasons);
    const parentFreeAgent = normalizeLegacyBoolean(loan.parentFreeAgent);
    return {
      ...state,
      clubName: String(loan.parentClub || state.clubName || ""),
      leagueCountry: String(loan.parentCountry || state.leagueCountry || ""),
      weeklyWage: Number.isFinite(parentWageValue)
        ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(parentWageValue))) : 0,
      contractSeasons: Number.isFinite(parentContractSeasonsValue)
        ? Math.max(0, Math.min(10, Math.floor(parentContractSeasonsValue))) : 0,
      freeAgent: parentFreeAgent
    };
  }

  function wageNegotiationStatus(state) {
    if (!state) return "invalid-state";
    if (normalizeLegacyBoolean(state.retired)) return "retired";
    if (normalizeLegacyBoolean(state.freeAgent)) return "free-agent";
    const contractSeasons = Number(state.contractSeasons);
    if (!Number.isFinite(contractSeasons)) return "contract-expiring";
    if (contractSeasons <= 0) return "free-agent";
    if (contractSeasons <= 1) return "contract-expiring";
    const daysSinceNegotiation = Number(state.daysSinceNegotiation);
    if (!Number.isFinite(daysSinceNegotiation) || Math.max(0, daysSinceNegotiation) < 7) return "cooldown";
    return "ready";
  }
  function canNegotiateInSeason(state) { return wageNegotiationStatus(state) === "ready"; }

  function loanRequestStatus(state, options = {}) {
    if (!state) return "invalid-state";
    if (normalizeLegacyBoolean(state.retired)) return "retired";
    const contractSeasons = Number(state.contractSeasons);
    if (normalizeLegacyBoolean(state.freeAgent) || !Number.isFinite(contractSeasons) || contractSeasons <= 0) return "free-agent";
    if (state.loan) return "already-loaned";
    if (options.cupActive) return "cup-active";
    if (!options.windowOpen) return "window-closed";
    const appearances = Number(state.apps);
    if (!Number.isFinite(appearances) || appearances < 2) return "appearances-required";
    return "ready";
  }

  function loanTargetStatus(state, target, options = {}) {
    const requestStatus = loanRequestStatus(state, options);
    if (requestStatus !== "ready") return requestStatus;
    if (!target || typeof target.club !== "string" || !target.club.trim()
      || typeof target.country !== "string" || !target.country.trim()) return "invalid-target";
    if (target.club === state.clubName && target.country === state.leagueCountry) return "same-club";
    if (!options.isListed) return "unlisted-target";
    return "ready";
  }

  function loanSquadRole(state, target) {
    if (!state || typeof state !== "object") return "بديل أساسي";
    const playerOverall = overall(state);
    const rawTargetPower = Number(target && target.power);
    const targetPower = Number.isFinite(rawTargetPower) && rawTargetPower > 0
      ? clamp(rawTargetPower, 25, 95) : 50;
    const powerGap = playerOverall - targetPower;
    return powerGap >= 5 ? "أساسي" : powerGap >= -2 ? "بديل أساسي" : "بديل";
  }

  function purchaseItem(state, item) {
    if (!state || !item || typeof item.id !== "string" || !item.id.trim()
      || !Number.isFinite(Number(item.price)) || Number(item.price) < 0) return { ok: false, status: "invalid-item" };
    if (normalizeLegacyBoolean(state.retired)) return { ok: false, status: "retired" };
    if (["ovr", "overall", "ovrBoost", "overallBoost", "overallRating", "ratingPoints"].includes(item.id)) {
      return { ok: false, status: "direct-rating-purchase-disabled" };
    }
    // Only IDs present in the player shop may be purchased. Keep "boots" for legacy saves/tests.
    const allowedStoreItems = [
      "boots", "xpMultiplier", "speedBoots", "strengthProgram", "privateCoach",
      "homeGym", "videoAnalyst", "diet", "sleepCoach", "physio", "recoveryRoom",
      "privateChef", "homeUpgrade", "sportsPsych", "mediaTraining", "creatorStudio",
      "stylist", "charityFoundation"
    ];
    if (!allowedStoreItems.includes(item.id)) return { ok: false, status: "invalid-item" };
    if (state[item.id]) return { ok: false, status: "already-owned" };
    const cost = Math.round(Number(item.price));
    const balance = Number(state.money);
    if (!Number.isFinite(balance) || balance < cost) return { ok: false, status: "insufficient-funds" };
    state.money = balance - cost;
    state[item.id] = true;
    if (item.id === "boots") {
      state.shooting = Math.max(0, Math.min(100, Math.round((Number(state.shooting) || 0) + 3)));
      state.dribbling = Math.max(0, Math.min(100, Math.round((Number(state.dribbling) || 0) + 3)));
    }
    return { ok: true, status: "purchased", itemId: item.id, cost, money: state.money };
  }

  function nextRandomUnit(state) {
    let x = (Number(state.randomSeed) >>> 0) || 0x6d2b79f5;
    x = (x + 0x6d2b79f5) >>> 0;
    state.randomSeed = x;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function resolveWageNegotiation(state, chance, level) {
    const status = wageNegotiationStatus(state);
    if (status !== "ready") return { ok: false, status };
    if (![0, 1, 2].includes(Number(level))) return { ok: false, status: "invalid-level" };
    const wageValue = Number(state.weeklyWage);
    const oldWage = Number.isFinite(wageValue)
      ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(wageValue))) : 0;
    state.weeklyWage = oldWage;
    state.daysSinceNegotiation = 0;
    const success = nextRandomUnit(state) * 100 < Math.max(5, Math.min(95, Number(chance) || 0));
    if (!success) {
      state.trust = Math.max(0, Math.min(100, Math.round((Number(state.trust) || 0) - 2)));
      return { ok: true, status: "failed", oldWage, wage: oldWage, trust: state.trust };
    }
    const factor = Number(level) === 2 ? 1.35 : Number(level) === 1 ? 1.15 : 1.05;
    state.weeklyWage = Math.min(Number.MAX_SAFE_INTEGER, Math.round(oldWage * factor));
    state.trust = Math.max(0, Math.min(100, Math.round((Number(state.trust) || 0) + 3)));
    return { ok: true, status: "success", oldWage, wage: state.weeklyWage, trust: state.trust };
  }

  function shouldRetire(state, maximumAge = 40) {
    return Boolean(state && (normalizeLegacyBoolean(state.retired) || Number(state.age) >= maximumAge));
  }

  function makeContractOffer(state, withAgent = false) {
    const savedWage = Number(state?.weeklyWage);
    const currentWage = Number.isFinite(savedWage) && savedWage > 0
      ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(savedWage)) : 250;
    const contractMultiplier = withAgent && typeof withAgent === "object"
      ? Math.max(0.96, Math.min(1.18, Number(withAgent.contractMultiplier) || 1.08))
      : withAgent ? 1.1 : 1;
    const ratingValue = Number(overall(state));
    const rating = Number.isFinite(ratingValue) ? Math.max(0, Math.min(100, ratingValue)) : 50;
    const trustValue = Number(state?.trust);
    const trust = Number.isFinite(trustValue) ? Math.max(0, Math.min(100, trustValue)) : 0;
    const calculatedWage = Math.round(currentWage * (0.9 + rating / 500 + trust / 1000) * contractMultiplier);
    const wage = Math.max(currentWage, Math.min(Number.MAX_SAFE_INTEGER, calculatedWage));
    return { club: String(state?.clubName || ""), wage, seasons: 3, season: Number(state?.season) || 1 };
  }

  function resolveContractDecision(state, decision, offer) {
    if (!state || !["accept", "decline"].includes(decision)) return { ok: false, status: "invalid-decision" };
    if (normalizeLegacyBoolean(state.retired)) return { ok: false, status: "retired" };
    if (decision === "accept") {
      if (!offer || !Number.isFinite(Number(offer.wage)) || Number(offer.wage) < 0) return { ok: false, status: "invalid-offer" };
      state.weeklyWage = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(Number(offer.wage))));
      const offerSeasonsValue = Number(offer.seasons);
      const offerSeasons = Number.isFinite(offerSeasonsValue) && offerSeasonsValue > 0
        ? Math.max(1, Math.min(5, Math.floor(offerSeasonsValue))) : 3;
      state.contractSeasons = offerSeasons + 1;
      state.freeAgent = false;
      state.contractOffer = null;
      return { ok: true, status: "renewed", wage: state.weeklyWage, seasonsBeforeNewSeason: state.contractSeasons };
    }
    state.contractSeasons = 0; state.weeklyWage = 0; state.freeAgent = true; state.contractOffer = null;
    return { ok: true, status: "free-agent", wage: 0, seasonsBeforeNewSeason: 0 };
  }

  function recordNationalTournamentMatch(state, outcome) {
    if (!state || typeof state !== "object") return { ok: false, status: "invalid-state" };
    state.nationalTournamentDone = normalizeLegacyBoolean(state.nationalTournamentDone);
    state.nationalTournamentQualified = normalizeLegacyBoolean(state.nationalTournamentQualified);
    state.nationalTournamentWinner = normalizeLegacyBoolean(state.nationalTournamentWinner);
    state.internationalPlayed = normalizeLegacyBoolean(state.internationalPlayed);
    if (state.nationalTournamentDone) return { ok: false, status: "tournament-closed" };
    const finiteTournamentCounter = (value, maximum) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(0, Math.min(maximum, Math.floor(numeric))) : 0;
    };
    const played = finiteTournamentCounter(state.nationalTournamentMatches, 4);
    const points = finiteTournamentCounter(state.nationalTournamentPoints, Math.min(9, played * 3));
    if (played >= 4) {
      state.nationalTournamentMatches = 4;
      state.nationalTournamentPoints = points;
      return { ok: false, status: "tournament-closed" };
    }
    if (!["فوز", "تعادل", "خسارة"].includes(outcome)) return { ok: false, status: "invalid-outcome" };
    state.nationalTournamentMatches = played;
    state.nationalTournamentPoints = points;
    if (played >= 3 && state.nationalTournamentQualified !== true) {
      return { ok: false, status: "not-qualified" };
    }
    if (played < 3) {
      state.nationalTournamentPoints = Math.min(9, points
        + (outcome === "فوز" ? 3 : outcome === "تعادل" ? 1 : 0));
      state.nationalTournamentMatches = played + 1;
      if (state.nationalTournamentMatches === 3) {
        // Three group fixtures; four points is the simplified qualifying threshold.
        state.nationalTournamentQualified = state.nationalTournamentPoints >= 4;
        state.nationalTournamentDone = !state.nationalTournamentQualified;
        state.nationalTournamentWinner = false;
        state.nationalTournamentFinalOutcome = "";
      }
      state.internationalPlayed = Boolean(state.nationalTournamentDone);
      return { ok: true, status: state.nationalTournamentMatches < 3 ? "group" : state.nationalTournamentQualified ? "final-qualified" : "eliminated", points: state.nationalTournamentPoints };
    }
    if (outcome === "تعادل") return { ok: false, status: "final-winner-required" };
    state.nationalTournamentMatches = 4;
    state.nationalTournamentDone = true;
    state.internationalPlayed = true;
    state.nationalTournamentWinner = outcome === "فوز";
    state.nationalTournamentFinalOutcome = outcome;
    return { ok: true, status: state.nationalTournamentWinner ? "champion" : "final-lost", points: state.nationalTournamentPoints };
  }

  function applySeasonAging(state) {
    if (!state || typeof state !== "object") return "";
    const age = Math.max(0, Number(state.age) || 0), position = String(state.pos || "");
    const highProfessionalism = Number(state.professionalism) > 80;
    const decayThisSeason = !highProfessionalism || age % 2 === 0;
    if (position === "حارس مرمى") {
      if (age < 35) return "";
      const notes = [];
      if (decayThisSeason) { state.fitness = clamp(Number(state.fitness) - 1); notes.push("اللياقة"); }
      if (age >= 37 && decayThisSeason) { state.physical = clamp(Number(state.physical) - 1); notes.push("القوة البدنية"); }
      return notes.length ? "منحنى عمر الحارس أبطأ: راقب " + notes.join(" و") + " مع التقدم في السن."
        : "احترافيتك وخبرتك ساعدتاك على إبطاء تراجع السمات البدنية.";
    }
    if (age < 32) return "";
    const notes = [];
    if (decayThisSeason) { state.fitness = clamp(Number(state.fitness) - 1); notes.push("اللياقة"); }
    if (age >= 32 && ["ظهير", "جناح", "مهاجم", "رأس حربة"].includes(position) && decayThisSeason) {
      state.speed = clamp(Number(state.speed) - 1); notes.push("السرعة");
    }
    if (age >= 35 && decayThisSeason) { state.physical = clamp(Number(state.physical) - 1); notes.push("القوة البدنية"); }
    return notes.length ? "مع تقدم العمر، منحنى التطور اتغير: راقب " + notes.join(" و") + "، وركّز على التمركز والخبرة والاستشفاء."
      : "الاحترافية ساعدتك على تقليل تراجع السمات في هذا الموسم.";
  }
  window.LWCareer = {
    calendarGameDateISO, ensureState, uniqueMatchRows, rebuildLegacyCareerStats, deriveLeagueRatingStats, overall, train, matchDevelopment,
    appearanceMilestones: APPEARANCE_MILESTONES, seasonAwards, applySeasonAging, leagueMatchTarget, leagueMatchDaysRemaining,
    normalizeLeagueRoundIndex, contractStateForSeasonTransition, wageNegotiationStatus, canNegotiateInSeason,
    loanRequestStatus, loanTargetStatus, loanSquadRole, normalizeCareerPosition, purchaseItem, resolveWageNegotiation, shouldRetire, makeContractOffer,
    resolveContractDecision, recordNationalTournamentMatch, positionDevelopmentPlan, startingStatsForPosition, trainingFocusMultiplier, evaluateSquadRole, trainingTypes: Object.keys(CONFIG)
  };
})();