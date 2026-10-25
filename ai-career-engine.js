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
    "مهاجم": ["shooting", "composure"]
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
    const rows = Array.isArray(state && state.careerMatchHistory) ? state.careerMatchHistory : [];
    return rows.filter(row => row && (row.scope === "league" || row.scope === "cup" || row.scope === "international" || row.rating !== undefined))
      .slice(-8);
  }
  function formRating(state) {
    const rows = recentRows(state).slice(-5);
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
    const rating = formRating(state);
    const goals = number(state.seasonGoals, 0);
    let tactic = "balanced";
    if (ownTactic === "attack") tactic = "counter";
    else if (theirs >= ours + 7) tactic = "press";
    else if (rating >= 7.4 && (goals >= 3 || number(input.overall, 50) >= theirs + 7)) tactic = "compact";
    else if (ownTactic === "defend") tactic = "wide";
    else if (ownTactic === "counter" && theirs > ours - 3) tactic = "press";
    else if (clamp(state.energy, 0, 100) < 35 || clamp(state.fatigue, 0, 100) > 75) tactic = "press";
    return { tactic, label: OPPONENT_LABELS[tactic], reason: tactic === "counter"
      ? "المنافس يترك مساحات خلفه ويتحول للهجوم المرتد أمام اندفاعك."
      : tactic === "compact" ? "المنافس يغلق العمق لأن مستواك الحالي يهدد دفاعه."
      : tactic === "press" ? "المنافس يرفع الضغط لمحاولة تعطيل البناء أو استغلال انخفاض الجاهزية."
      : tactic === "wide" ? "المنافس يحاول توسيع الملعب وسحبك إلى الأطراف."
      : "المنافس يبدأ بتوازن وينتظر قراءة مجريات المباراة." };
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
