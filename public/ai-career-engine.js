/* Deterministic career AI for LAST WHISTLE. Runs locally; no external API or secret keys. */
(function (global) {
  "use strict";
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const POSITION_FOCUS = Object.freeze({
    "حارس مرمى": ["goalkeeping", "composure"],
    "قلب دفاع": ["defending", "physical"],
    "ظهير": ["speed", "fitness"],
    "وسط دفاعي": ["defending", "passing"],
    "وسط مهاجم": ["passing", "vision"],
    "جناح": ["speed", "dribbling"],
    "مهاجم": ["dribbling", "speed", "vision"],
    "رأس حربة": ["shooting", "composure", "physical"]
  });
  const SKILL_LABELS = Object.freeze({
    goalkeeping: "حراسة المرمى", composure: "الهدوء", defending: "الدفاع",
    physical: "القوة البدنية", speed: "السرعة", fitness: "اللياقة",
    passing: "التمرير", vision: "الرؤية", dribbling: "المراوغة", shooting: "التسديد"
  });
  const TACTIC_LABELS = Object.freeze({
    balanced: "متوازن", attack: "ضغط هجومي", defend: "دفاع منظم", counter: "مرتدات"
  });
  const OPPONENT_LABELS = Object.freeze({
    balanced: "متوازن", press: "ضغط عالي", compact: "تكتل دفاعي", wide: "لعب على الأطراف", counter: "هجمات مرتدة"
  });
  function recentRows(state) {
    const careerRows = Array.isArray(state && state.careerMatchHistory) ? state.careerMatchHistory : [];
    // Modern history is newest-first; legacy seasonLog is oldest-first.
    // Fall back only when modern history is absent/empty to avoid mixing duplicate records.
    const rows = careerRows.length ? careerRows :
      Array.isArray(state && state.seasonLog) ? state.seasonLog.slice().reverse() : [];
    return rows.filter(row => {
      if (!row) return false;
      // A zero-minute bench/suspension row is not a performance rating.
      const minutesKnown = row.minutes !== undefined && row.minutes !== null;
      const participated = minutesKnown ? number(row.minutes, 0) > 0 : number(row.rating, 0) > 0;
      return participated && (row.scope === "league" || row.scope === "cup"
        || row.scope === "international" || row.rating !== undefined);
    }).slice(0, 8);
  }
  function formRating(state) {
    const rows = recentRows(state).slice(0, 5);
    const ratings = rows.map(row => number(row.rating, NaN)).filter(value => Number.isFinite(value) && value >= 0 && value <= 10);
    if (ratings.length) return ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
    const last = number(state && state.lastRating, NaN);
    if (Number.isFinite(last) && last > 0) return last;
    const sum = number(state && state.averageRatingSum, 0);
    const count = number(state && state.averageRatingCount, 0);
    return count > 0 ? clamp(sum / count, 0, 10) : 6.2;
  }
  function teamPower(state, overall) {
    return clamp(number(overall, number(state && state.ovr, 55)) + number(state && state.trust, 50) * 0.08
      + number(state && state.morale, 50) * 0.04 + (number(state && state.clubPower, 52) - 55) * 0.16, 30, 94);
  }
  function coachAdvice(state, overall) {
    state = state || {};
    const rating = formRating(state);
    const energy = clamp(state.energy, 0, 100);
    const fatigue = clamp(state.fatigue, 0, 100);
    const trust = clamp(state.trust, 0, 100);
    const injury = Math.max(0, number(state.injuryDays, 0));
    const focus = POSITION_FOCUS[String(state.pos || "جناح")] || POSITION_FOCUS["جناح"];
    const primarySkill = focus[0];
    const skillValue = clamp(state[primarySkill], 0, 100);
    let title, summary, page = "training", actionLabel = "افتح التدريب";
    if (injury > 0) {
      title = "الأولوية للتعافي";
      summary = "أنت مصاب لمدة " + injury + " يوم. لا تحاول تعويض الوقت بتدريب إضافي؛ ركّز على التعافي حتى تنتهي مدة الإصابة.";
      page = "wellness"; actionLabel = "افتح الجاهزية";
    } else if (energy < 30 || fatigue >= 76) {
      title = "جسمك محتاج راحة";
      summary = "الطاقة " + energy + "/100 والإجهاد " + fatigue + "/100. الراحة الآن تقلل مخاطرة تدهور الأداء قبل المباراة القادمة.";
      page = "wellness"; actionLabel = "افتح الجاهزية";
    } else if (trust < 35 && String(state.role || "").includes("بديل")) {
      title = "اكسب ثقة الجهاز الفني";
      summary = "ثقة المدرب منخفضة (" + trust + "/100). حافظ على الجاهزية، واختر تدريبًا مناسبًا لمركزك، وحاول تقديم تقييم ثابت قبل طلب دور أكبر.";
      page = "wellness"; actionLabel = "راجع جاهزيتك";
    } else if (rating < 6.1) {
      title = "ارفع جودة الأداء أولًا";
      summary = "آخر مؤشر أداء متاح " + rating.toFixed(1) + "/10. ركّز على أساسيات مركزك بدل التدريب العشوائي، ووازن بين شدة الحصة والاستشفاء.";
    } else {
      title = "خطة تطوير مخصصة لمركزك";
      summary = "مؤشر الأداء " + rating.toFixed(1) + "/10. الأولوية الحالية هي " + (SKILL_LABELS[primarySkill] || primarySkill)
        + "؛ قيمة المهارة " + skillValue + "/100. كلما استقر أداؤك زادت قوة حجتك لطلب دور أكبر.";
    }
    const priorities = [
      "المركز: " + String(state.pos || "جناح"),
      "التقييم العام: " + clamp(overall, 0, 99) + "/99",
      "الجاهزية: طاقة " + energy + "%، إجهاد " + fatigue + "%",
      "ثقة المدرب: " + trust + "/100",
      "التدريب المقترح: " + (SKILL_LABELS[primarySkill] || primarySkill)
    ];
    return { title, summary, page, actionLabel, rating, focus: primarySkill, priorities, score: Math.round(clamp(
      number(overall, 50) * 0.35 + trust * 0.20 + energy * 0.18 + (100 - fatigue) * 0.12
      + clamp(state.morale, 0, 100) * 0.10 + rating * 5, 0, 100)) };
  }
  function recommendPlayerTactic(state, overall, opponent) {
    state = state || {};
    opponent = opponent || {};
    const ours = teamPower(state, overall);
    const theirs = clamp(number(opponent.power, 55), 30, 94);
    const gap = ours - theirs;
    const energy = clamp(state.energy, 0, 100);
    const fatigue = clamp(state.fatigue, 0, 100);
    let tactic = "balanced", reason = "القوتان متقاربتان؛ ابدأ بخطة متوازنة وغيّرها بناءً على نتيجة المباراة.";
    if (number(state.injuryDays, 0) > 0 || energy < 30 || fatigue > 78) {
      tactic = gap < -4 ? "counter" : "defend";
      reason = "الجاهزية منخفضة؛ قلّل الاندفاع وحافظ على المساحات والطاقة.";
    } else if (gap >= 9) {
      tactic = "attack";
      reason = "فريقك أعلى قوة من المنافس؛ الضغط الهجومي قد يساعدك على فرض المباراة، بشرط ألا تهمل التوازن.";
    } else if (gap <= -9) {
      tactic = "counter";
      reason = "المنافس أقوى على الورق؛ استغل المساحات خلفه بدل الدخول في تبادل هجمات مفتوح.";
    } else if (String(state.pos || "") === "حارس مرمى" || String(state.pos || "") === "قلب دفاع") {
      tactic = "defend";
      reason = "التوازن الدفاعي يقلل الضغط على الخط الخلفي ويمنح الفريق وقتًا لتنظيم البناء.";
    }
    return { tactic, label: TACTIC_LABELS[tactic], reason, teamPower: Math.round(ours), opponentPower: Math.round(theirs), gap: Math.round(gap) };
  }
  function chooseOpponentTactic(input) {
    input = input || {};
    const state = input.state || input.player || {};
    const ownTactic = TACTIC_LABELS[input.ourTactic] ? input.ourTactic : "balanced";
    const ours = clamp(input.teamPower, 25, 95);
    const theirs = clamp(input.opponentPower, 25, 95);
    const managerIQ = clamp(input.managerIQ ?? (theirs * 0.82 + Number(input.opponentPrestige || theirs) * 0.18), 25, 98);
    const rating = formRating(state);
    const goals = number(state.seasonGoals, 0);
    const history = recentRows(state);
    const repeatedStyle = history.filter(row => String(row.tactic || row.playerTactic || "") === ownTactic).length;
    let tactic = "balanced";
    if (ownTactic === "attack") tactic = "counter";
    else if (theirs >= ours + 7) tactic = "press";
    else if (rating >= 7.4 && (goals >= 3 || number(input.overall, 50) >= theirs + 7)) tactic = "compact";
    else if (ownTactic === "defend") tactic = "wide";
    else if (ownTactic === "counter" && theirs > ours - 3) tactic = "press";
    else if (clamp(state.energy, 0, 100) < 35 || clamp(state.fatigue, 0, 100) > 75) tactic = "press";
    const readYou = repeatedStyle >= 3 && managerIQ >= 67;
    if (readYou) {
      tactic = ownTactic === "attack" ? "compact" : ownTactic === "defend" ? "wide"
        : ownTactic === "counter" ? "press" : (theirs >= ours - 2 ? "press" : "compact");
    }
    const reason = readYou
      ? "المدرب المنافس قرأ تكرار خطتك في آخر المباريات وغيّر أسلوبه لمواجهتها."
      : tactic === "counter" ? "المنافس يترك مساحات خلفه ويتحول للهجوم المرتد أمام اندفاعك."
      : tactic === "compact" ? "المنافس يغلق العمق لأن مستواك الحالي يهدد دفاعه."
      : tactic === "press" ? "المنافس يرفع الضغط لمحاولة تعطيل البناء أو استغلال انخفاض الجاهزية."
      : tactic === "wide" ? "المنافس يحاول توسيع الملعب وسحبك إلى الأطراف."
      : "المنافس يبدأ بتوازن وينتظر قراءة مجريات المباراة.";
    return { tactic, label: OPPONENT_LABELS[tactic], reason, iq: managerIQ, repeatedStyle, adapted: readYou };
  }
  function recommendTransfers(state, clubs, overall) {
    state = state || {};
    clubs = Array.isArray(clubs) ? clubs : [];
    const current = clamp(overall, 35, 99);
    const age = number(state.age, 24);
    const seen = new Set();
    return clubs.filter(club => club && club.name && club.country)
      .filter(club => !(String(club.name) === String(state.clubName) && String(club.country) === String(state.leagueCountry || "مصر")))
      .map(club => {
        const power = clamp(club.ovr || club.power || 55, 25, 99);
        const gap = power - current;
        const key = String(club.name).trim().toLocaleLowerCase() + "|" + String(club.country).trim().toLocaleLowerCase();
        return { name: String(club.name), country: String(club.country), power, prestige: clamp(club.prestige || 50, 0, 100),
          gap, key, score: 100 - Math.abs(gap - 5) * 3.2 + clamp(club.prestige || 50, 0, 100) * 0.12
            - Math.max(0, gap - 14) * 2.5 - Math.max(0, -gap - 18) * 1.1 + (age <= 23 && gap >= 0 ? 3 : 0) };
      })
      .filter(row => {
        if (seen.has(row.key)) return false;
        seen.add(row.key);
        return row.gap <= 18 && row.gap >= -22;
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map(row => ({ name: row.name, country: row.country, power: row.power, gap: row.gap,
        fit: row.gap >= -5 && row.gap <= 8 ? "خطوة مناسبة" : row.gap > 8 ? "قفزة طموحة" : "نادي لتحسين دقائق اللعب",
        reason: row.gap > 8 ? "تحدٍ أكبر من مستواك الحالي؛ راجع فرص المشاركة قبل القرار." :
          row.gap < -5 ? "قد يمنحك مستوى منافسة أقرب وفرصة لإثبات نفسك." : "قوة النادي قريبة من مستواك، فقيّم دورك المتوقع وشروط العقد." }));
  }
  function lifestyleAdvice(state) {
    state = state || {};
    const energy = clamp(state.energy, 0, 100), fatigue = clamp(state.fatigue, 0, 100);
    const money = number(state.money, 0), wage = number(state.weeklyWage, 0);
    const contract = number(state.contractSeasons, 0);
    let title = "وازن بين الملعب والحياة";
    let summary = "حافظ على روتين ثابت، ولا تصرف موارد اللعبة على عنصر لا يخدم هدفك الحالي.";
    let page = "life";
    if (number(state.injuryDays, 0) > 0 || energy < 30 || fatigue > 75) {
      title = "الصحة قبل أي مكسب";
      summary = "التعافي والراحة أولًا. تجنّب التدريب المكثف قبل رجوع الطاقة وتقليل الإجهاد.";
      page = "wellness";
    } else if (contract <= 1 && !state.freeAgent) {
      title = "استعد لموعد العقد";
      summary = "متبقي " + contract + " موسم في عقدك. راجع التجديد وشروط الوكيل مبكرًا لتجنب الوصول لوضع لاعب حر من غير خطة.";
      page = "contract";
    } else if (wage > 0 && money < wage * 3) {
      title = "السيولة داخل اللعبة محدودة";
      summary = "رصيدك أقل من ثلاثة أسابيع من مرتبك. أجّل المشتريات غير الضرورية وراقب المصروفات داخل اللعبة.";
      page = "shop";
    }
    return { title, summary, page, energy, fatigue, money, wage, contract };
  }
  global.LWCareerAI = Object.freeze({
    version: 1,
    positionFocus: POSITION_FOCUS,
    skillLabels: SKILL_LABELS,
    tacticLabels: TACTIC_LABELS,
    opponentTacticLabels: OPPONENT_LABELS,
    formRating,
    teamPower,
    coachAdvice,
    recommendPlayerTactic,
    chooseOpponentTactic,
    recommendTransfers,
    lifestyleAdvice
  });
})(window);


/* LAST WHISTLE Context-Aware Utility AI v2.
 * Preserves the established public API while adding context, seasonal memory, consequence links
 * and age-stage-specific career advice. No external APIs or non-deterministic model calls.
 */
(function (global) {
  "use strict";
  const base = global.LWCareerAI;
  if (!base) return;
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const LEDGER_VERSION = 1, LEDGER_LIMIT = 180;
  const AGE_STAGES = Object.freeze({
    academy: { min: 0, max: 18, label: "ناشئ في الأكاديمية" },
    development: { min: 19, max: 23, label: "مرحلة التطور" },
    peak: { min: 24, max: 29, label: "لاعب في قمة العطاء" },
    veteran: { min: 30, max: 99, label: "لاعب مخضرم" }
  });
  function seasonOf(state) { return Math.max(1, num(state && state.season, 1)); }
  function dayOf(state) { return Math.max(0, num(state && (state.calendarDay ?? state.day), 0)); }
  function ledgerOf(state) {
    if (!state || typeof state !== "object") return { version: LEDGER_VERSION, events: [], decisions: [] };
    let ledger = state.aiMemoryLedger;
    if (!ledger || typeof ledger !== "object" || Number(ledger.version) !== LEDGER_VERSION) {
      ledger = { version: LEDGER_VERSION, events: [], decisions: [], nextId: 1 };
      state.aiMemoryLedger = ledger;
    }
    if (!Array.isArray(ledger.events)) ledger.events = [];
    if (!Array.isArray(ledger.decisions)) ledger.decisions = [];
    if (!Number.isFinite(Number(ledger.nextId))) ledger.nextId = ledger.events.length + ledger.decisions.length + 1;
    return ledger;
  }
  function hasEvent(state, type, key, season) {
    const ledger = ledgerOf(state);
    return ledger.events.some(item => item && item.type === String(type) && item.key === String(key)
      && Number(item.season) === Math.max(1, num(season, seasonOf(state))));
  }
  function recordEvent(state, event) {
    if (!state || typeof state !== "object" || !event || !event.type || !event.key) return false;
    const ledger = ledgerOf(state), season = Math.max(1, num(event.season, seasonOf(state)));
    const type = String(event.type), key = String(event.key);
    if (ledger.events.some(item => item && item.type === type && item.key === key && Number(item.season) === season)) return false;
    ledger.events.unshift({
      id: "ai-event-" + ledger.nextId++, type, key, season, day: dayOf(state),
      context: event.context && typeof event.context === "object" ? event.context : {},
      outcome: event.outcome == null ? null : String(event.outcome), createdAt: Date.now()
    });
    ledger.events = ledger.events.slice(0, LEDGER_LIMIT);
    return true;
  }
  function recordDecision(state, decision) {
    if (!state || typeof state !== "object" || !decision || !decision.type) return null;
    const ledger = ledgerOf(state), season = seasonOf(state), day = dayOf(state), type = String(decision.type);
    const signature = type + "|" + season + "|" + day;
    const duplicate = ledger.decisions.find(item => item && item.signature === signature);
    if (duplicate) return duplicate;
    const row = { id: "ai-decision-" + ledger.nextId++, signature, type, season, day,
      details: decision.details || {}, outcome: "pending",
      followUpAt: day + Math.max(7, num(decision.followUpDays, 14)) };
    ledger.decisions.unshift(row);
    ledger.decisions = ledger.decisions.slice(0, 60);
    if (type === "criticize-coach" || type === "public-coach-criticism") {
      state.coachRelationship = clamp(num(state.coachRelationship, num(state.trust, 50)) - 8, 0, 100);
      if (state.trust != null) state.trust = clamp(num(state.trust, 50) - 5, 0, 100);
      row.consequence = "coach-trust-risk";
    } else if (type === "request-transfer" || type === "demand-transfer") row.consequence = "contract-and-role-review";
    else if (type === "reject-loan") row.consequence = "minutes-opportunity-may-narrow";
    return row;
  }
  function resolveDecision(state, id, outcome) {
    const row = ledgerOf(state).decisions.find(item => item && item.id === String(id));
    if (!row) return false;
    row.outcome = String(outcome || "resolved"); row.resolvedAt = dayOf(state); return true;
  }
  function stageFor(state) {
    const age = clamp(num(state && state.age, 24), 0, 99);
    const isAcademy = age <= 18 && (state.youthAcademy || state.inAcademy || state.academyReserve
      || /ناشئ|أكاديمية|شباب|academy|youth/i.test(String(state.role || state.careerPhase || "")));
    return isAcademy ? "academy" : age >= 30 ? "veteran" : age <= 23 ? "development" : "peak";
  }
  function getLastResult(row) {
    row = row || {};
    let goalsFor = num(row.teamGoals, num(row.scoreFor, num(row.goalsFor, NaN)));
    let goalsAgainst = num(row.oppGoals, num(row.scoreAgainst, num(row.goalsAgainst, NaN)));
    if (!Number.isFinite(goalsFor) || !Number.isFinite(goalsAgainst)) {
      const result = String(row.result || row.outcome || "").toUpperCase();
      return { outcome: ["W", "WIN", "فوز"].includes(result) ? "win" :
        ["L", "LOSS", "خسارة"].includes(result) ? "loss" :
        ["D", "DRAW", "تعادل"].includes(result) ? "draw" : "unknown",
        goalsFor: null, goalsAgainst: null, matchId: row.matchId || row.id || null };
    }
    return { outcome: goalsFor > goalsAgainst ? "win" : goalsFor < goalsAgainst ? "loss" : "draw",
      goalsFor, goalsAgainst, matchId: row.matchId || row.id || null };
  }
  function clubRank(state) {
    const name = String(state && state.clubName || "");
    const rows = Array.isArray(state && state.leagueTable) ? state.leagueTable :
      Array.isArray(state && state.standings) ? state.standings : Array.isArray(state && state.league) ? state.league : [];
    const row = rows.find(item => item && String(item.club || item.name || item.team || "") === name);
    if (!row) return { rank: null, points: null, teams: rows.length };
    const rank = num(row.rank, num(row.position, rows.indexOf(row) + 1));
    const pointsValue = row.pts ?? row.points;
    return { rank, points: Number.isFinite(Number(pointsValue)) ? num(pointsValue) : null, teams: rows.length };
  }
  function contextSnapshot(state, overall) {
    state = state || {};
    const raw = Array.isArray(state.careerMatchHistory) ? state.careerMatchHistory :
      Array.isArray(state.seasonLog) ? state.seasonLog : [];
    const played = raw.filter(row => row && (row.minutes == null ? num(row.rating, 0) > 0 : num(row.minutes, 0) > 0)).slice(0, 5);
    const ratings = played.map(row => num(row.rating, NaN)).filter(value => Number.isFinite(value) && value >= 0 && value <= 10);
    const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : base.formRating(state);
    const goals = played.reduce((sum, row) => sum + Math.max(0, num(row.goals, 0)), 0);
    const assists = played.reduce((sum, row) => sum + Math.max(0, num(row.assists, 0)), 0);
    const tackles = played.reduce((sum, row) => sum + Math.max(0, num(row.tackles ?? row.stats?.tackles, 0)), 0);
    const interceptions = played.reduce((sum, row) => sum + Math.max(0, num(row.interceptions ?? row.stats?.interceptions, 0)), 0);
    const saves = played.reduce((sum, row) => sum + Math.max(0, num(row.saves ?? row.stats?.saves, 0)), 0);
    const keyPasses = played.reduce((sum, row) => sum + Math.max(0, num(row.keyPasses ?? row.stats?.keyPasses, 0)), 0);
    const shotsOnTarget = played.reduce((sum, row) => sum + Math.max(0, num(row.shotsOnTarget ?? row.stats?.shotsOnTarget, 0)), 0);
    const cleanSheets = played.filter(row => row.cleanSheet === true || row.stats?.cleanSheet === true).length;
    const position = String(state.pos || state.position || "غير محدد");
    const goalkeeperContribution = /حارس/.test(position) && (saves >= 2 || cleanSheets > 0);
    const defensiveContribution = ["قلب دفاع", "ظهير", "وسط دفاعي"].includes(position)
      && (tackles >= 3 || interceptions >= 2 || cleanSheets > 0);
    const creatorContribution = position === "وسط مهاجم"
      && (keyPasses >= 2 || goals > 0 || assists > 0 || tackles >= 3 || interceptions >= 2);
    const attackerContribution = ["جناح", "مهاجم", "مهاجم متحرك", "رأس حربة"].includes(position)
      && (goals > 0 || assists > 0 || shotsOnTarget >= 2 || keyPasses >= 2);
    const roleContributionLastFive = goalkeeperContribution || defensiveContribution
      || creatorContribution || attackerContribution
      || goals > 0 || assists > 0 || keyPasses >= 2;
    const minutesLastFive = played.reduce((sum, row) => sum + Math.max(0, num(row.minutes, 0)), 0);
    const ledger = ledgerOf(state), currentSeason = seasonOf(state);
    const recentDecision = ledger.decisions.find(row => row && Number(row.season) === currentSeason);
    const daysSinceDecision = recentDecision ? dayOf(state) - num(recentDecision.day, dayOf(state)) : null;
    const coachRelationship = clamp(num(state.coachRelationship, num(state.trust, 50)), 0, 100);
    const freeAgent = !!state.freeAgent;
    const contractSeasons = freeAgent ? 0 : Math.max(0, num(state.contractSeasons, num(state.contractYears, 0)));
    const age = clamp(num(state.age, 24), 0, 99), stage = stageFor(state), rank = clubRank(state);
    return {
      season: currentSeason, day: dayOf(state), age, stage, stageLabel: AGE_STAGES[stage].label,
      position: String(state.pos || state.position || "غير محدد"), clubName: String(state.clubName || ""),
      overall: clamp(num(overall, num(state.ovr, 50)), 0, 99), recentMatches: played.length,
      averageRating: Number(averageRating.toFixed(2)), goalsLastFive: goals, assistsLastFive: assists,
      tacklesLastFive: tackles, interceptionsLastFive: interceptions, savesLastFive: saves,
      keyPassesLastFive: keyPasses, shotsOnTargetLastFive: shotsOnTarget, cleanSheetsLastFive: cleanSheets,
      roleContributionLastFive, minutesLastFive, lastResult: getLastResult(played[0]), leaguePosition: rank.rank,
      leaguePoints: rank.points, leagueTeamCount: rank.teams, coachRelationship, contractSeasons,
      freeAgent, energy: clamp(state.energy, 0, 100), fatigue: clamp(state.fatigue, 0, 100),
      injuryDays: Math.max(0, num(state.injuryDays, 0)), decisionHistoryCount: ledger.decisions.length,
      pendingConsequence: recentDecision && recentDecision.outcome === "pending" && daysSinceDecision >= 14
        ? recentDecision.consequence || recentDecision.type : null
    };
  }
  function utilities(context) {
    const recovery = context.injuryDays > 0 ? 100 : Math.max(0, 32 - context.energy) * 2.2 + Math.max(0, context.fatigue - 68) * 1.5;
    const playingTime = Math.max(0, 330 - context.minutesLastFive) / 3.5 + Math.max(0, 45 - context.coachRelationship) * 0.45;
    const poorIndividualForm = context.averageRating < 6.4 && !context.roleContributionLastFive;
    const form = Math.max(0, 6.7 - context.averageRating) * 11
      + (context.lastResult.outcome === "loss" && poorIndividualForm ? 2 : 0);
    const contract = context.freeAgent ? 18 : context.contractSeasons <= 1 ? 24 : context.contractSeasons === 2 ? 10 : 0;
    const development = context.stage === "academy" ? 24 : context.stage === "development" ? 18 : context.stage === "veteran" ? 13 : 8;
    const leadership = context.stage === "veteran" && context.averageRating >= 7.1 ? 15 : 0;
    const teamChallenge = context.leaguePosition != null && context.leagueTeamCount > 0
      && context.leaguePosition >= Math.ceil(context.leagueTeamCount * 0.7) ? 10 : 0;
    return { recovery: clamp(recovery, 0, 100), playingTime: clamp(playingTime, 0, 100),
      form: clamp(form, 0, 100), contract: clamp(contract, 0, 100),
      development: clamp(development, 0, 100), leadership: clamp(leadership, 0, 100),
      teamChallenge: clamp(teamChallenge, 0, 100) };
  }
  const originalCoachAdvice = base.coachAdvice;
  function coachAdvice(state, overall) {
    state = state || {};
    const core = originalCoachAdvice(state, overall);
    const context = contextSnapshot(state, overall), utility = utilities(context);
    let report = Object.assign({}, core, { context, utilities: utility });
    if (context.injuryDays > 0 || context.energy < 30 || context.fatigue >= 76) {
      report.id = "recovery";
    } else if (context.stage === "academy") {
      report.id = "academy-development";
      report.title = context.minutesLastFive < 120 ? "اطلب دقائق لعب مفيدة للناشئين" : "طوّر الأساسيات قبل القفزة الاحترافية";
      report.summary = context.minutesLastFive < 120
        ? "أنت في مرحلة التكوين، ودقائق لعبك في آخر خمس مشاركات قليلة. الأولوية لتدريب مركزك والمشاركة المنتظمة، وليس مطاردة انتقال كبير مبكرًا."
        : "في سن الأكاديمية، ثبات المهارات الأساسية والجاهزية أهم من القفز إلى نادٍ أكبر. ركّز على مركزك وراقب التقدم كل عدة أسابيع.";
      report.page = "training"; report.actionLabel = "افتح التدريب";
    } else if (context.pendingConsequence === "coach-trust-risk" && context.coachRelationship < 45) {
      report.id = "repair-coach-relationship"; report.title = "رمّم علاقتك بالجهاز الفني";
      report.summary = "ذاكرة المسيرة تسجّل خلافًا سابقًا مع المدرب. قلّل التصريحات التصادمية، واظهر الالتزام في التدريب؛ استمرار التوتر قد يقلّل دقائقك ويجعل الإعارة خيارًا مطروحًا.";
      report.page = "wellness"; report.actionLabel = "راجع الجاهزية";
    } else if (context.contractSeasons <= 1 && !context.freeAgent && context.averageRating >= 6.8) {
      report.id = "contract-planning"; report.title = "اختار توقيت التفاوض على العقد";
      report.summary = "عقدك يقترب من نهايته وأداؤك الأخير يدعم موقفك. قارن دورك المتوقع والراتب والمكافآت قبل التوقيع، ولا تنتظر آخر لحظة.";
      report.page = "contract"; report.actionLabel = "راجع العقد";
    } else if (context.minutesLastFive < 130 && context.coachRelationship < 48) {
      report.id = "playing-time"; report.title = "دقائق اللعب هي الأولوية";
      report.summary = "مشاركاتك وثقة الجهاز الفني منخفضتان. ثبّت الجاهزية، واطلب هدف مشاركة واضحًا؛ لو الوضع استمر لأسابيع، ناقش إعارة تضمن لك دقائق فعلية بدل انتقال لمجرد الاسم.";
      report.page = "wellness"; report.actionLabel = "افتح الجاهزية";
    } else if (context.stage === "veteran") {
      report.id = "veteran-management"; report.title = "إدارة الخبرة والحمل البدني";
      report.summary = context.averageRating >= 7.1
        ? "أداؤك ثابت في مرحلة الخبرة. وازن الحمل البدني، وشارك خبرتك مع الأصغر سنًا؛ القيادة والاستشفاء الآن يحافظان على تأثيرك أكثر من التدريب المفرط."
        : "مع التقدم في العمر، خفّض الحمل البدني غير الضروري وركّز على المهارات الذهنية والتمركز والقيادة، مع متابعة أي إصابة مبكرًا.";
    } else if (context.averageRating >= 7.6 && context.minutesLastFive >= 300) {
      report.id = "consistent-performance"; report.title = "حوّل مستواك الثابت إلى دور أكبر";
      report.summary = "متوسط تقييمك في آخر خمس مشاركات مرتفع مع دقائق لعب كافية. حافظ على نفس المستوى، وناقش زيادة الدور أو تحسين العقد في التوقيت المناسب.";
      report.page = context.contractSeasons <= 2 ? "contract" : "training";
      report.actionLabel = context.contractSeasons <= 2 ? "راجع العقد" : "افتح التدريب";
    } else report.id = context.stage === "development" ? "development-plan" : "position-plan";
    const seen = new Set(ledgerOf(state).events.filter(item => item && item.type === "coach-recommendation"
      && Number(item.season) === context.season).map(item => String(item.key)));
    if (seen.has(report.id) && report.id !== "recovery") {
      const options = [
        { id: "position-plan", title: "تطوير مهارة مرتبطة بمركزك", summary: "استخدم خطة تدريب ثابتة لمهارة مرتبطة بمركزك، ثم قارن متوسط آخر خمس مباريات بدل الحكم من مباراة واحدة.", page: "training", actionLabel: "افتح التدريب", focus: core.focus },
        { id: "match-review", title: "راجع تفاصيل آخر مباراة", summary: "قارن دقائق اللعب والتقييم والأهداف والصناعة ونتيجة الفريق قبل تغيير خطتك. قرار واحد مبني على بيانات أدق أفضل من تكرار نفس النصيحة.", page: "league", actionLabel: "راجع جدول الدوري", focus: core.focus },
        { id: "recovery-routine", title: "خطّة أسبوعية متوازنة", summary: "حافظ على التوازن بين التدريب والراحة، وراقب طاقتك وإجهادك بعد كل مباراة لتبني تطورًا مستدامًا على مدار الموسم.", page: "training", actionLabel: "افتح التدريب", focus: core.focus }
      ];
      const alternate = options.find(item => !seen.has(item.id));
      if (alternate) report = Object.assign(report, alternate);
    }
    report.score = Math.round(clamp(num(core.score, 50) * 0.62 + Math.max(...Object.values(utility)) * 0.38, 0, 100));
    report.priorities = [
      "المرحلة: " + context.stageLabel + " | السن: " + context.age,
      "آخر 5 مباريات: " + context.averageRating.toFixed(1) + "/10، أهداف " + context.goalsLastFive + "، صناعة " + context.assistsLastFive,
      "الدقائق: " + context.minutesLastFive + " | آخر نتيجة: " + context.lastResult.outcome,
      "علاقة المدرب: " + context.coachRelationship + "/100 | العقد: " + (context.freeAgent ? "لاعب حر" : context.contractSeasons + " موسم"),
      "أعلى أولوية: " + Object.entries(utility).sort((a,b) => b[1] - a[1])[0][0]
    ];
    return report;
  }
  function recordRecommendation(state, report) {
    if (!report) return false;
    return recordEvent(state, { type: "coach-recommendation", key: report.id || report.title,
      context: { age: num(state && state.age, 0), club: String(state && state.clubName || ""),
        lastResult: report.context && report.context.lastResult, utilities: report.utilities || {} } });
  }
  const originalTransfers = base.recommendTransfers;
  function recommendTransfers(state, clubs, overall) {
    const context = contextSnapshot(state, overall);
    return originalTransfers(state, clubs, overall).map(row => {
      const club = (Array.isArray(clubs) ? clubs : []).find(item => item && String(item.name) === row.name);
      const prestige = clamp(num(club && club.prestige, 50), 0, 100);
      const rotationRisk = context.minutesLastFive < 130 && num(club && (club.power || club.ovr), 55) > context.overall + 8;
      const youthPath = context.stage === "academy" || context.stage === "development";
      return Object.assign({}, row, {
        fit: rotationRisk ? "مخاطرة قلة دقائق اللعب" : row.fit,
        contextScore: Math.round(clamp(70 - Math.abs(row.gap || 0) * 1.5
          + (youthPath ? Math.max(0, 75 - prestige) * 0.12 : 0)
          + (context.averageRating >= 7.2 ? 5 : 0) - (rotationRisk ? 18 : 0), 0, 100)),
        youthPath: youthPath ? "افحص خطة التطوير وفرص المشاركة قبل التفاوض" : "وازن بين الدور الحالي والراتب وقوة الدوري"
      });
    }).sort((a,b) => num(b.contextScore, 0) - num(a.contextScore, 0));
  }
  function decisionConsequences(state) {
    const context = contextSnapshot(state, num(state && state.ovr, 50));
    const pending = ledgerOf(state).decisions.filter(row => row && row.outcome === "pending" && context.day >= num(row.followUpAt, Infinity));
    return pending.map(row => ({
      decisionId: row.id, decision: row.type, consequence: row.consequence || "career-review",
      urgency: context.coachRelationship < 40 ? "high" : "normal",
      recommendation: row.consequence === "coach-trust-risk"
        ? (context.minutesLastFive < 120 ? "ناقش إعارة قصيرة لاستعادة دقائق اللعب" : "رمّم العلاقة مع المدرب قبل تصعيد الخلاف")
        : row.consequence === "contract-and-role-review" ? "راجع دورك المتوقع وشروط العقد" : "أعد تقييم خطة المشاركة",
      ageStage: context.stage
    }));
  }
  global.LWCareerAI = Object.freeze(Object.assign({}, base, {
    version: base.version,
    ageStages: AGE_STAGES,
    contextSnapshot,
    utilityScores: (state, overall) => {
      const context = contextSnapshot(state, overall);
      return Object.assign({}, utilities(context), { context });
    },
    hasEvent, recordEvent, recordDecision, resolveDecision, recordRecommendation, decisionConsequences,
    coachAdvice, recommendTransfers
  }));
})(window);
