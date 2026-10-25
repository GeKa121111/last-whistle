/* Last Whistle career AI panel: presents local decisions based on the active save. */
(function (global) {
  "use strict";
  const $ = id => document.getElementById(id);
  const engine = global.LWCareerAI;
  const runtime = global.LWStoryRuntime;
  let currentMode = "coach";
  let currentTactic = null;
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[char]);
  function getState() {
    try { return runtime && typeof runtime.getState === "function" ? runtime.getState() : null; }
    catch (error) { return null; }
  }
  function overall() {
    try { return runtime && typeof runtime.overall === "function" ? runtime.overall() : 50; }
    catch (error) { return 50; }
  }
  function refresh() {
    if (!engine || !runtime || !$("careerAIPanel")) return;
    const state = getState();
    if (!state || !state.careerStarted) {
      $("careerAIStatus").textContent = "جاهز عند بدء المسيرة";
      $("careerAIOverview").textContent = "ابدأ مسيرتك ليحلل النظام مركزك وأداءك والجاهزية وخيارات التطور.";
      $("careerAIScore").textContent = "—";
      return;
    }
    const report = engine.coachAdvice(state, overall());
    $("careerAIStatus").textContent = report.score >= 72 ? "الحالة مستقرة" : report.score >= 52 ? "فيه مجال للتطوير" : "محتاج مراجعة";
    $("careerAIScore").textContent = report.score + "/100";
    $("careerAIOverview").textContent = report.title + " — " + report.summary;
    if (currentMode === "coach") renderDetail(report.title, report.summary, report.priorities, report.page, report.actionLabel);
  }
  function renderDetail(title, summary, details, page, actionLabel) {
    const titleNode = $("careerAIResultTitle"), body = $("careerAIResultText"), list = $("careerAIResultList");
    if (titleNode) titleNode.textContent = title || "تحليل المسيرة";
    if (body) body.textContent = summary || "";
    if (list) {
      list.replaceChildren();
      (details || []).slice(0, 5).forEach(item => {
        const li = document.createElement("li");
        li.textContent = String(item);
        list.appendChild(li);
      });
    }
    const open = $("careerAIOpenPage");
    if (open) { open.textContent = actionLabel || "افتح القسم المناسب"; open.dataset.aiPage = page || "home"; open.hidden = false; }
    const apply = $("careerAIApplyTactic");
    if (apply) apply.hidden = !currentTactic;
  }
  function upcomingOpponent(state) {
    const clubName = String(state.clubName || "");
    const rounds = Array.isArray(state.fixtureSchedule) ? state.fixtureSchedule : [];
    const round = rounds[Math.max(0, Number(state.leagueRoundIndex) || 0)] || [];
    const fixture = round.find(pair => Array.isArray(pair) && pair.includes(clubName));
    if (!fixture) return { name: "المنافس القادم", power: 55 };
    const name = fixture.find(item => item !== clubName);
    const team = (Array.isArray(state.league) ? state.league : []).find(row => row && row.name === name);
    return { name: name || "المنافس القادم", power: Number(team && (team.power || team.ovr)) || 55 };
  }
  function onAction(action) {
    const state = getState();
    if (!state || !state.careerStarted) {
      renderDetail("ابدأ مسيرتك أولًا", "الذكاء الاصطناعي محتاج بيانات لاعب محفوظة عشان يطلع توصيات مناسبة.", [], "home", "ارجع للرئيسية");
      return;
    }
    currentMode = action;
    currentTactic = null;
    const ov = overall();
    if (action === "coach") {
      const report = engine.coachAdvice(state, ov);
      renderDetail(report.title, report.summary, report.priorities, report.page, report.actionLabel);
    } else if (action === "tactics") {
      const opponent = upcomingOpponent(state);
      const report = engine.recommendPlayerTactic(state, ov, opponent);
      const rival = engine.chooseOpponentTactic({ state, overall: ov, ourTactic: report.tactic,
        teamPower: report.teamPower, opponentPower: report.opponentPower });
      currentTactic = report.tactic;
      renderDetail("خطة مقترحة ضد " + opponent.name,
        report.reason + " قوة فريقك التقديرية " + report.teamPower + " مقابل " + report.opponentPower
          + ". الخصم متوقع يبدأ بـ " + rival.label + "؛ أسلوبه قد يتغير مع اختياراتك.",
        ["خطة فريقك: " + report.label, "أسلوب الخصم المتوقع: " + rival.label,
          "قوة المنافس: " + report.opponentPower + "/94", "الخطة المقترحة: " + report.label],
        "league", "افتح جدول الدوري");
      const apply = $("careerAIApplyTactic");
      if (apply) apply.hidden = false;
    } else if (action === "agent") {
      const clubs = global.LWWorldDB && typeof global.LWWorldDB.clubs === "function" ? global.LWWorldDB.clubs() : [];
      const choices = engine.recommendTransfers(state, clubs, ov);
      const details = choices.map((club, index) => (index + 1) + ". " + club.name + " — " + club.country
        + " (قوة " + club.power + ", فرق " + (club.gap > 0 ? "+" : "") + club.gap + "): " + club.fit);
      const status = state.freeAgent ? "أنت لاعب حر، فراجع العروض المتاحة." :
        Number(state.transferCooldown) > 0 ? "أنت في فترة انتظار بعد انتقال؛ التوصيات تخطيطية فقط." :
        "دي ترشيحات حسب قوتك وسمعة النادي، وليست عروض انتقال مؤكدة.";
      renderDetail("تقرير الوكيل الذكي", choices.length ? status : "قاعدة بيانات الأندية غير متاحة حاليًا؛ افتح السوق يدويًا.", details, "contract", "افتح سوق الانتقالات");
    } else {
      const report = engine.lifestyleAdvice(state);
      renderDetail(report.title, report.summary, [
        "الطاقة: " + report.energy + "/100",
        "الإجهاد: " + report.fatigue + "/100",
        "الرصيد الافتراضي: " + report.money.toLocaleString("en-US"),
        "المتبقي من العقد: " + (state.freeAgent ? "لاعب حر" : report.contract + " موسم")
      ], report.page, report.page === "wellness" ? "افتح الجاهزية" : report.page === "contract" ? "راجع العقد" : report.page === "shop" ? "افتح المتجر" : "افتح الحياة والسمعة");
    }
  }
  function openSuggestedPage() {
    const page = $("careerAIOpenPage") && $("careerAIOpenPage").dataset.aiPage || "home";
    if (runtime && typeof runtime.showPage === "function") runtime.showPage(page);
    if (page === "contract") global.setTimeout(() => $("transferMarket") && $("transferMarket").scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  function applyTactic() {
    if (!currentTactic || !runtime || typeof runtime.match !== "function") return;
    const tactic = currentTactic;
    currentTactic = null;
    const apply = $("careerAIApplyTactic");
    if (apply) apply.hidden = true;
    runtime.match(tactic);
  }
  document.addEventListener("click", event => {
    const action = event.target.closest("[data-ai-action]");
    if (action) { onAction(action.dataset.aiAction); return; }
    if (event.target.closest("#careerAIOpenPage")) { openSuggestedPage(); return; }
    if (event.target.closest("#careerAIApplyTactic")) applyTactic();
  });
  global.LWCareerAIUI = Object.freeze({ refresh, openSuggestedPage, onAction });
  refresh();
  global.addEventListener("load", refresh, { once: true });
})(window);
