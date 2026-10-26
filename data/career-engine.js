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
  const CAREER_ATTRIBUTE = {
    "حارس مرمى": "goalkeeping", "قلب دفاع": "physical", "ظهير": "speed",
    "وسط دفاعي": "physical", "وسط مهاجم": "vision", "جناح": "dribbling", "مهاجم": "dribbling", "رأس حربة": "shooting"
  };

  const DEVELOPMENT_PLANS = {
    "حارس مرمى": { title: "حارس متكامل", summary: "رد الفعل والتمركز والهدوء بالكرة. ارفع الحراسة أولًا، وادعمها بالاتزان والتمرير واللياقة.", primary: ["goalkeeping"], secondary: ["composure", "passing", "fitness"], matchSkill: "goalkeeping" },
    "قلب دفاع": { title: "قلب دفاع قوي وقارئ للعب", summary: "اكسب الالتحامات والكرات الهوائية، وادعم قوتك بالتمركز والهدوء وبداية الهجمة بالتمرير.", primary: ["defending", "physical"], secondary: ["composure", "fitness", "passing"], matchSkill: "defending" },
    "ظهير": { title: "ظهير عصري", summary: "وازن بين السرعة واللياقة والقوة في الالتحامات، مع تمرير يساعدك على بناء الهجمة من الطرف.", primary: ["speed", "fitness"], secondary: ["passing", "defending", "physical"], matchSkill: "speed" },
    "وسط دفاعي": { title: "محور ارتكاز", summary: "اكسب الالتحامات واقطع الهجمات وابدأ البناء من الخلف. ركّز على الدفاع والتمرير والرؤية.", primary: ["defending", "physical"], secondary: ["vision", "fitness", "composure", "passing"], matchSkill: "defending" },
    "وسط مهاجم": { title: "صانع ألعاب", summary: "سرعة القرار والتمريرة الحاسمة أهم من الجري فقط. طوّر الرؤية والتمرير والهدوء تحت الضغط.", primary: ["vision", "passing"], secondary: ["composure", "dribbling", "shooting"], matchSkill: "vision" },
    "جناح": { title: "جناح اختراق", summary: "اكسب المواجهة واحد ضد واحد بالسرعة والمراوغة، ووازن ده بالقوة وقت الالتحام ثم حسّن الإنهاء وصناعة الفرص.", primary: ["dribbling", "speed"], secondary: ["shooting", "vision", "fitness", "physical"], matchSkill: "dribbling" },
    "مهاجم": { title: "مهاجم متحرك", summary: "مهاجم يشارك في بناء الهجمة، يتحرك بين الخطوط، يراوغ ويدخل المساحات ويصنع الفرص بجانب التسجيل. طوّر المراوغة والسرعة والتمرير مع إنهاء جيد.", primary: ["dribbling", "speed"], secondary: ["shooting", "vision", "passing", "composure"], matchSkill: "dribbling" },
    "رأس حربة": { title: "رأس حربة هدّاف", summary: "مهمتك الأساسية إنهاء الهجمة داخل المنطقة، استغلال العرضيات والكرات البينية، وحماية الكرة تحت ضغط المدافعين. ركّز على التسديد والهدوء والقوة البدنية.", primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"], matchSkill: "shooting" }
  };
  function positionDevelopmentPlan(state) {
    const position = typeof state === "string" ? state : String(state && state.pos || "جناح");
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
    if (!state || state.academyCareer || state.academyReserve || state.retired) {
      return { role: originalRole, changed: false, reason: "protected-career", recentAverageRating: 0,
        recentContributionsPer90: 0, careerContributionsPer90: 0 };
    }

    const validRow = row => row && row.scope !== "international" && Number(row.minutes) > 0;
    const current = validRow(currentMatch) ? { ...currentMatch } : null;
    const allRows = [current, ...(Array.isArray(matchHistory) ? matchHistory : [])]
      .filter(validRow);
    const recent = allRows.slice(0, 8);
    if (!recent.length) {
      return { role: originalRole, changed: false, reason: "no-appearances", recentAverageRating: 0,
        recentContributionsPer90: 0, careerContributionsPer90: 0 };
    }

    const sum = (rows, key) => rows.reduce((total, row) => total + Math.max(0, Number(row[key]) || 0), 0);
    const recentMinutes = sum(recent, "minutes");
    const recentContributions = sum(recent, "goals") + sum(recent, "assists");
    const recentContributionsPer90 = recentContributions / Math.max(1, recentMinutes / 90);
    const ratedRows = recent.filter(row => Number(row.rating) > 0);
    const recentAverageRating = ratedRows.length
      ? ratedRows.reduce((total, row) => total + Number(row.rating), 0) / ratedRows.length : 0;

    const appearances = Math.max(0, Math.floor(Number(state.apps) || 0));
    const averageCareerMinutes = allRows.length ? sum(allRows, "minutes") / allRows.length : 60;
    // Saves compact long careers, so estimate missing historical minutes from the observed mean.
    const careerMinutes = Math.max(sum(allRows, "minutes"), appearances * Math.max(1, averageCareerMinutes));
    const careerContributions = Math.max(0, Number(state.goals) || 0) + Math.max(0, Number(state.assists) || 0);
    const careerContributionsPer90 = careerContributions / Math.max(1, careerMinutes / 90);
    const trust = Math.max(0, Math.min(100, Number(state.trust) || 0));
    const roleIsForward = ["رأس حربة", "مهاجم", "جناح", "وسط مهاجم"].includes(String(state.pos || ""));
    const veteranOutput = roleIsForward && appearances >= 35
      && careerContributionsPer90 >= 0.32 && recentAverageRating >= 5.9;
    const recentReady = recentAverageRating >= 6.25
      && (trust >= 22 || recentContributionsPer90 >= 0.25);
    let role = originalRole;

    // Non-academy youth players start with this display label; it should not lock them out of promotion forever.
    if (role.startsWith("ناشئ") && appearances >= 3) role = "بديل";
    if (role === "بديل" && appearances >= 8 && (recentReady || veteranOutput)) role = "بديل أساسي";
    if (role === "بديل أساسي" && appearances >= 16
      && ((recentAverageRating >= 6.35 && (trust >= 30 || recentContributionsPer90 >= 0.30))
        || (appearances >= 35 && roleIsForward && careerContributionsPer90 >= 0.35 && recentAverageRating >= 5.9))) {
      role = "أساسي";
    }

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
    "قلب دفاع": { shooting:[25,40], dribbling:[40,50], passing:[45,55], speed:[55,66], fitness:[55,66], composure:[45,55], defending:[55,66], goalkeeping:[5,12], vision:[40,50], physical:[55,66] },
    "ظهير": { shooting:[25,40], dribbling:[48,60], passing:[45,55], speed:[55,66], fitness:[55,66], composure:[45,55], defending:[55,66], goalkeeping:[5,12], vision:[45,55], physical:[52,62] },
    "وسط دفاعي": { shooting:[40,52], dribbling:[45,58], passing:[55,65], speed:[50,60], fitness:[55,65], composure:[55,65], defending:[52,62], goalkeeping:[5,12], vision:[55,65], physical:[52,62] },
    "وسط مهاجم": { shooting:[50,62], dribbling:[50,62], passing:[55,65], speed:[50,62], fitness:[55,65], composure:[55,65], defending:[35,45], goalkeeping:[5,12], vision:[55,65], physical:[40,55] },
    "جناح": { shooting:[55,68], dribbling:[55,68], passing:[50,60], speed:[55,68], fitness:[50,60], composure:[50,60], defending:[15,28], goalkeeping:[5,12], vision:[50,60], physical:[45,58] },
    "مهاجم": { shooting:[53,65], dribbling:[56,68], passing:[50,61], speed:[57,69], fitness:[51,62], composure:[49,60], defending:[15,28], goalkeeping:[5,12], vision:[51,62], physical:[45,57] },
    "رأس حربة": { shooting:[60,72], dribbling:[44,57], passing:[42,54], speed:[48,61], fitness:[49,61], composure:[54,65], defending:[15,28], goalkeeping:[5,12], vision:[42,54], physical:[53,65] }
  };
  function startingStatsForPosition(position, random = Math.random) {
    const ranges = STARTING_RANGES[String(position || "جناح")] || STARTING_RANGES["جناح"];
    const stats = {};
    for (const [key, range] of Object.entries(ranges)) {
      const roll = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
      stats[key] = range[0] + Math.floor(roll * (range[1] - range[0] + 1));
    }
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

  function rebuildLegacyCareerStats(state) {
    const rows = uniqueCareerHistory(state);
    state.qualifyingAppearances = rows.filter(row => Number(row.minutes) >= 20).length;
    state.careerAppearances = Math.max(Number(state.apps) || 0, Number(state.careerAppearances) || 0);
    state.careerMinutes = rows.reduce((sum, row) => sum + (Number(row.minutes) || 0), 0);
    state.careerMilestonesEarned = APPEARANCE_MILESTONES
      .filter(threshold => state.qualifyingAppearances >= threshold).map(String);
    return rows;
  }

  function deriveLeagueRatingStats(state) {
    const rows = uniqueCareerHistory(state).filter(row => row.scope === "league"
      && Number(row.minutes) > 0 && Number.isFinite(Number(row.rating)));
    state.leagueRatingSum = rows.reduce((sum, row) => sum + Number(row.rating), 0);
    state.leagueRatingCount = rows.length;
    return { sum: state.leagueRatingSum, count: state.leagueRatingCount };
  }

  function ensureState(state) {
    state.randomSeed = Number(state.randomSeed) >>> 0 || 0x6d2b79f5;
    state.trainingXP = state.trainingXP && typeof state.trainingXP === "object" ? state.trainingXP : {};
    state.careerAwards = Array.isArray(state.careerAwards) ? state.careerAwards : [];
    state.careerXP = Number(state.careerXP) || 0;
    state.levelXP = Number(state.levelXP) || 0;
    state.careerLevel = Math.max(1, Number(state.careerLevel) || 1);
    state.trainingSessions = Number(state.trainingSessions) || 0;
    state.playerPotential = clamp(state.playerPotential || 82, 65, 97);
    state.trainingIntensity = ["light", "normal", "intense"].includes(state.trainingIntensity) ? state.trainingIntensity : "normal";
    const hadMilestoneLedger = Array.isArray(state.careerMilestonesEarned);
    state.progressionMatchIds = Array.isArray(state.progressionMatchIds) ? state.progressionMatchIds : [];
    state.careerMilestonesEarned = hadMilestoneLedger ? state.careerMilestonesEarned : [];
    state.competitionStats = state.competitionStats && typeof state.competitionStats === "object" ? state.competitionStats : {};
    state.careerAppearances = Math.max(0, Number(state.careerAppearances) || Number(state.apps) || 0);
    state.careerMinutes = Math.max(0, Number(state.careerMinutes) || 0);
    state.leagueRatingSum = Math.max(0, Number(state.leagueRatingSum) || 0);
    state.leagueRatingCount = Math.max(0, Number(state.leagueRatingCount) || 0);
    if (state.qualifyingAppearances === undefined) {
      state.qualifyingAppearances = uniqueCareerHistory(state).filter(row => Number(row.minutes) >= 20).length;
    }
    state.qualifyingAppearances = Math.max(0, Number(state.qualifyingAppearances) || 0);
    if (!hadMilestoneLedger) {
      state.careerMilestonesEarned = APPEARANCE_MILESTONES
        .filter(threshold => state.qualifyingAppearances >= threshold).map(String);
    }
    state.fatigue = clamp(state.fatigue || 0, 0, 100);
    for (const key of Object.keys(CONFIG)) {
      state.trainingXP[key] = Math.max(0, Number(state.trainingXP[key]) || 0);
      if (!Number.isFinite(Number(state[key]))) state[key] = 50;
    }
    return state;
  }

  const OVR_WEIGHTS = {
    "حارس مرمى": { goalkeeping:.52,composure:.14,vision:.12,fitness:.08,passing:.06,physical:.04,speed:.02,defending:.02 },
    "قلب دفاع": { defending:.25,physical:.20,fitness:.15,speed:.12,composure:.10,passing:.08,vision:.05,dribbling:.03,shooting:.02 },
    "ظهير": { speed:.20,defending:.18,fitness:.15,physical:.12,passing:.12,dribbling:.08,vision:.05,composure:.05,shooting:.05 },
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
    state.trainingXP[key] = (Number(state.trainingXP[key]) || 0) + amount;
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
    const xp = Math.max(0, Math.round(Number(amount) || 0));
    state.careerXP += xp;
    state.levelXP += xp;
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
    const baseXP = Math.max(1, Math.round((setup.xp * multipliers.xp + coachBonus) * trainingAgeFactor * fatiguePenalty * focusMultiplier));
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
    const played = Math.max(0, Number(data.minutes) || 0);
    if (!played) return { gained: 0, skill: "", qualifying: false, milestones: [] };
    const matchId = String(data.matchId || ("legacy:" + (state.season || 1) + ":" + (state.apps || 0)
      + ":" + (state.seasonLog?.length || 0) + ":" + played));
    if (state.progressionMatchIds.includes(matchId)) return { gained: 0, skill: "", duplicate: true, qualifying: played >= 20, milestones: [] };
    state.progressionMatchIds.push(matchId);
    if (state.progressionMatchIds.length > 5000) state.progressionMatchIds.splice(0, state.progressionMatchIds.length - 5000);
    state.careerAppearances++;
    state.careerMinutes += played;
    const qualifying = played >= 20;
    const competitionKey = String(data.competitionKey || "club|unknown");
    const competition = state.competitionStats[competitionKey] || (state.competitionStats[competitionKey] = {
      appearances: 0, qualifyingAppearances: 0, minutes: 0, goals: 0, assists: 0
    });
    competition.appearances++;
    competition.minutes += played;
    competition.goals += Math.max(0, Number(data.goals) || 0);
    competition.assists += Math.max(0, Number(data.assists) || 0);
    if (qualifying) { state.qualifyingAppearances++; competition.qualifyingAppearances++; }
    const skill = CAREER_ATTRIBUTE[state.pos] || "passing";
    const ageFactor = Number(state.age) >= 30 ? 0.7 : Number(state.age) <= 21 ? 1.15 : 1;
    const rating = clamp(data.rating || 6, 3, 10);
    const performanceFactor = 0.72 + rating * 0.047;
    const potentialFactor = clamp(0.82 + (Number(state.playerPotential) - overall(state)) * 0.012, 0.68, 1.24);
    const fatigueFactor = clamp(1 - Number(state.fatigue || 0) * 0.0025, 0.70, 1);
    const xp = Math.max(1, Math.round((played / 90) * rating * 1.8 * ageFactor * performanceFactor * potentialFactor * fatigueFactor));
    const levels = addCareerXP(state, xp);
    const focusMultiplier = trainingFocusMultiplier(state, skill);
    const gained = addTrainingXP(state, skill, Math.round(xp * 0.75 * focusMultiplier));
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
    return { gained, skill, xp, levels, qualifying, milestones, careerAppearances: state.careerAppearances, qualifyingAppearances: state.qualifyingAppearances };
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

  function seasonAwards(state, league, teamRank) {
    ensureState(state);
    const log = Array.isArray(state.seasonLog) ? state.seasonLog : [];
    const competition = String(state.leagueCompetition || "");
    const country = String(state.leagueCountry || "");
    const playerMatches = log.filter(row => row && row.playerAvailable !== false && Number(row.minutes) > 0
      && (!row.leagueCountry || row.leagueCountry === country)
      && (!row.leagueCompetition || !competition || row.leagueCompetition === competition));
    const appearances = playerMatches.length;
    if (appearances < 3) return [];
    const goals = playerMatches.reduce((sum, row) => sum + (Number(row.goals) || 0), 0);
    const assists = playerMatches.reduce((sum, row) => sum + (Number(row.assists) || 0), 0);
    const average = playerMatches.reduce((sum, row) => sum + (Number(row.rating) || 0), 0) / appearances;
    const playerScore = average * 10 + goals * 0.34 + assists * 0.28 + Math.max(0, 6 - Number(teamRank || 6)) * 0.7;
    const opponents = (Array.isArray(league) ? league : []).filter(team => team && team.name !== state.clubName).map(team => {
      const rng = seeded(hash(String(state.season) + "|" + String(state.leagueCountry) + "|" + team.name));
      const power = Number(team.power) || 50;
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
        date: new Date().toISOString()
      };
      state.careerAwards.unshift(award);
      won.push(award);
    }
    if (won.some(award => award.id === "golden-boot")) state.topScorerAwards = (Number(state.topScorerAwards) || 0) + 1;
    const rewards = { "league-player": 650, "golden-boot": 450, playmaker: 400, "young-player": 500 };
    state.money = (Number(state.money) || 0) + won.reduce((sum, award) => sum + (rewards[award.id] || 0), 0);
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

  function normalizeLeagueRoundIndex(savedRoundIndex, roundHistory, leagueApps, roundCount) {
    const history = Array.isArray(roundHistory) ? roundHistory : [];
    const legacyRound = history.length ? Math.max(0, ...history.map(row => Number(row?.matchday) || 0))
      : Math.max(0, Number(leagueApps) || 0);
    const hasSavedIndex = savedRoundIndex !== undefined && savedRoundIndex !== null && savedRoundIndex !== "";
    const saved = Number(savedRoundIndex);
    const candidate = hasSavedIndex && Number.isInteger(saved) ? Math.max(0, saved) : legacyRound;
    return Math.min(candidate, Math.max(0, Math.floor(Number(roundCount) || 0)));
  }

  function contractStateForSeasonTransition(state) {
    if (!state || !state.loan) return state;
    const loan = state.loan;
    return {
      ...state,
      clubName: String(loan.parentClub || state.clubName || ""),
      leagueCountry: String(loan.parentCountry || state.leagueCountry || ""),
      weeklyWage: Math.max(0, Number(loan.parentWage) || 0),
      contractSeasons: Math.max(0, Number(loan.parentContractSeasons) || 0),
      freeAgent: Boolean(loan.parentFreeAgent)
    };
  }

  function wageNegotiationStatus(state) {
    if (!state) return "invalid-state";
    if (state.retired) return "retired";
    if (state.freeAgent || Number(state.contractSeasons) <= 0) return "free-agent";
    if (Number(state.contractSeasons) <= 1) return "contract-expiring";
    if (Math.max(0, Number(state.daysSinceNegotiation) || 0) < 7) return "cooldown";
    return "ready";
  }
  function canNegotiateInSeason(state) { return wageNegotiationStatus(state) === "ready"; }

  function loanRequestStatus(state, options = {}) {
    if (!state) return "invalid-state";
    if (state.retired) return "retired";
    if (state.freeAgent || Number(state.contractSeasons) <= 0) return "free-agent";
    if (state.loan) return "already-loaned";
    if (options.cupActive) return "cup-active";
    if (!options.windowOpen) return "window-closed";
    if (Math.max(0, Number(state.apps) || 0) < 2) return "appearances-required";
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

  function purchaseItem(state, item) {
    if (!state || !item || typeof item.id !== "string" || !item.id.trim()
      || !Number.isFinite(Number(item.price)) || Number(item.price) < 0) return { ok: false, status: "invalid-item" };
    if (state.retired) return { ok: false, status: "retired" };
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
    const oldWage = Math.max(0, Number(state.weeklyWage) || 0);
    state.daysSinceNegotiation = 0;
    const success = nextRandomUnit(state) * 100 < Math.max(5, Math.min(95, Number(chance) || 0));
    if (!success) {
      state.trust = Math.max(0, Math.min(100, Math.round((Number(state.trust) || 0) - 2)));
      return { ok: true, status: "failed", oldWage, wage: oldWage, trust: state.trust };
    }
    const factor = Number(level) === 2 ? 1.35 : Number(level) === 1 ? 1.15 : 1.05;
    state.weeklyWage = Math.round(oldWage * factor);
    state.trust = Math.max(0, Math.min(100, Math.round((Number(state.trust) || 0) + 3)));
    return { ok: true, status: "success", oldWage, wage: state.weeklyWage, trust: state.trust };
  }

  function shouldRetire(state, maximumAge = 40) { return Boolean(state && (state.retired || Number(state.age) >= maximumAge)); }

  function makeContractOffer(state, withAgent = false) {
    const currentWage = Math.max(0, Number(state?.weeklyWage) || 250);
    const contractMultiplier = withAgent && typeof withAgent === "object"
      ? Math.max(0.96, Math.min(1.18, Number(withAgent.contractMultiplier) || 1.08))
      : withAgent ? 1.1 : 1;
    const wage = Math.max(currentWage, Math.round(currentWage * (0.9 + overall(state) / 500
      + (Number(state?.trust) || 0) / 1000) * contractMultiplier));
    return { club: String(state?.clubName || ""), wage, seasons: 3, season: Number(state?.season) || 1 };
  }

  function resolveContractDecision(state, decision, offer) {
    if (!state || !["accept", "decline"].includes(decision)) return { ok: false, status: "invalid-decision" };
    if (decision === "accept") {
      if (!offer || !Number.isFinite(Number(offer.wage)) || Number(offer.wage) < 0) return { ok: false, status: "invalid-offer" };
      state.weeklyWage = Math.max(0, Math.round(Number(offer.wage)));
      state.contractSeasons = Math.max(1, Math.floor(Number(offer.seasons) || 3) + 1);
      state.freeAgent = false;
      state.contractOffer = null;
      return { ok: true, status: "renewed", wage: state.weeklyWage, seasonsBeforeNewSeason: state.contractSeasons };
    }
    state.contractSeasons = 0; state.weeklyWage = 0; state.freeAgent = true; state.contractOffer = null;
    return { ok: true, status: "free-agent", wage: 0, seasonsBeforeNewSeason: 0 };
  }

  function recordNationalTournamentMatch(state, outcome) {
    if (!state || state.nationalTournamentDone || Number(state.nationalTournamentMatches || 0) >= 3) return { ok: false, status: "tournament-closed" };
    const played = Math.max(0, Math.floor(Number(state.nationalTournamentMatches) || 0));
    if (played < 2) {
      state.nationalTournamentPoints = Math.max(0, Number(state.nationalTournamentPoints) || 0)
        + (outcome === "فوز" ? 3 : outcome === "تعادل" ? 1 : 0);
      state.nationalTournamentMatches = played + 1;
      if (state.nationalTournamentMatches === 2) {
        state.nationalTournamentQualified = state.nationalTournamentPoints >= 3;
        state.nationalTournamentDone = !state.nationalTournamentQualified;
      }
      state.internationalPlayed = Boolean(state.nationalTournamentDone);
      return { ok: true, status: state.nationalTournamentMatches < 2 ? "group" : state.nationalTournamentQualified ? "final-qualified" : "eliminated", points: state.nationalTournamentPoints };
    }
    state.nationalTournamentMatches = 3; state.nationalTournamentDone = true; state.internationalPlayed = true;
    return { ok: true, status: "final-complete", points: state.nationalTournamentPoints };
  }

  function applySeasonAging(state) {
    if (Number(state.age) >= 30) {
      state.fitness = clamp(Number(state.fitness) - 1);
      if (Number(state.age) >= 33) state.speed = clamp(Number(state.speed) - 1);
      return Number(state.age) >= 33 ? "مع تقدم العمر، زادت أهمية إدارة السرعة والاستشفاء." : "مع تقدم العمر، حافظ على اللياقة والاستشفاء.";
    }
    return "";
  }

  window.LWCareer = {
    ensureState, uniqueMatchRows, rebuildLegacyCareerStats, deriveLeagueRatingStats, overall, train, matchDevelopment,
    appearanceMilestones: APPEARANCE_MILESTONES, seasonAwards, applySeasonAging, leagueMatchTarget, leagueMatchDaysRemaining,
    normalizeLeagueRoundIndex, contractStateForSeasonTransition, wageNegotiationStatus, canNegotiateInSeason,
    loanRequestStatus, loanTargetStatus, purchaseItem, resolveWageNegotiation, shouldRetire, makeContractOffer,
    resolveContractDecision, recordNationalTournamentMatch, positionDevelopmentPlan, startingStatsForPosition, trainingFocusMultiplier, evaluateSquadRole, trainingTypes: Object.keys(CONFIG)
  };
})();