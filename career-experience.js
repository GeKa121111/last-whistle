(function () {
  "use strict";

  var API = function () { return window.LWStoryRuntime || null; };
  var panel = null;
  var overlay = null;
  var currentView = "";
  var penalty = { direction: "", power: 68 };
  var timing = { value: 0, direction: 1, timer: null, running: false };
  var memory = { sequence: [], answers: [], timer: null, stage: "idle" };
  var investmentSequence = 1;
  var lastExperienceSnapshot = "";
  var lastExperienceRuntime = null;
  var lastSettledDay = null;
  var experienceTickScheduled = false;
  var experienceForceQueued = false;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function cap(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
  }

  function world(s) {
    if (!s.careerWorld || typeof s.careerWorld !== "object") {
      s.careerWorld = {
        version: 1, challengeCount: 0, challengeWins: 0, practiceAttempts: 0,
        memoryWins: 0, timingWins: 0, mentorSessions: 0, lastMentorDay: "",
        investments: [], history: [], investmentSequence: 1
      };
    }
    var w = s.careerWorld;
    if (!Array.isArray(w.investments)) w.investments = [];
    if (!Array.isArray(w.history)) w.history = [];
    w.challengeCount = Number(w.challengeCount) || 0;
    w.challengeWins = Number(w.challengeWins) || 0;
    w.practiceAttempts = Number(w.practiceAttempts) || 0;
    w.memoryWins = Number(w.memoryWins) || 0;
    w.timingWins = Number(w.timingWins) || 0;
    w.mentorSessions = Number(w.mentorSessions) || 0;
    w.investmentSequence = Number(w.investmentSequence) || 1;
    // Legacy saves may have an absent or stale sequence counter; keep every investment ID unique.
    var maxInvestmentId = w.investments.reduce(function (max, item) {
      return Math.max(max, Number(item && item.id) || 0);
    }, 0);
    w.investmentSequence = Math.max(w.investmentSequence, maxInvestmentId + 1);
    return w;
  }

  function dayNumber(s) {
    return Math.max(1, Number(s.calendarDay) || Number(s.day) || 1);
  }

  function stat(s, key, delta) {
    var bounded = [
      "energy", "morale", "trust", "fatigue", "professionalism", "mediaReputation",
      "teamChemistry", "coachRelationship", "playerPotential", "fitness", "confidence",
      "shooting", "dribbling", "passing", "speed", "composure", "defending",
      "goalkeeping", "vision"
    ];
    var next = (Number(s[key]) || 0) + Number(delta || 0);
    if (bounded.indexOf(key) >= 0) s[key] = cap(next, 0, 100);
    else if (key === "money" || key === "followers" || key === "careerXP" || key === "levelXP") s[key] = Math.max(0, Math.round(next));
    else s[key] = next;
  }

  function record(s, title, text, cachedWorld) {
    var w = cachedWorld || world(s);
    var row = {
      title: String(title || "حدث في المسيرة"),
      text: String(text || ""),
      season: Number(s.season) || 1,
      day: Number(s.day) || 1
    };
    w.history.unshift(row);
    w.history = w.history.slice(0, 40);
    if (Array.isArray(s.diary)) {
      s.diary.unshift({ season: row.season, day: row.day, type: row.title, text: row.text });
      s.diary = s.diary.slice(0, 40);
    }
    // The game diary entry above is the source of truth; avoid logging it twice.
  }

  function save(s, message) {
    var api = API();
    if (api && api.save) api.save();
    if (api && api.render) api.render();
    renderPanel(s);
    if (message && api && api.toast) api.toast(message);
  }

  function ensurePanel() {
    if (document.getElementById("lw-career-experience")) {
      panel = document.getElementById("lw-career-experience");
      return true;
    }
    var anchor = document.getElementById("lw-story-panel");
    var home = document.getElementById("page-home");
    if (!anchor || !home) return false;
    panel = document.createElement("section");
    panel.id = "lw-career-experience";
    panel.className = "lwcx-panel";
    panel.setAttribute("aria-labelledby", "lwcx-title");
    panel.innerHTML =
      '<div class="lwcx-head"><div><div class="lwcx-kicker">PLAYER LIFE / PERFORMANCE / LEGACY</div><h2 id="lwcx-title">مسيرتك مش بس أرقام</h2><p>جرّب لحظات تفاعلية، خطط لفلوسك داخل اللعبة، ابنِ علاقاتك، وشوف إرثك بيتغيّر مع كل خطوة.</p></div><div class="lwcx-mark" aria-hidden="true">LW<span>+</span></div></div>' +
      '<div class="lwcx-stats">' +
        '<div><small>تحديات ناجحة</small><strong id="lwcx-wins">0</strong><span id="lwcx-attempts">0 محاولة</span></div>' +
        '<div><small>استثمارات مفتوحة</small><strong id="lwcx-investments">0</strong><span id="lwcx-investment-note">إدارة أموالك داخل اللعبة</span></div>' +
        '<div><small>جلسات التوجيه</small><strong id="lwcx-mentors">0</strong><span>علاقات ومسؤولية</span></div>' +
        '<div><small>فصول قصصية</small><strong id="lwcx-stories">0</strong><span>قرارات محفوظة</span></div>' +
      '</div>' +
      '<div class="lwcx-grid">' +
        '<article class="lwcx-card lwcx-card-feature"><div class="lwcx-card-icon">01</div><div class="lwcx-card-copy"><span class="lwcx-tag">PLAYABLE MOMENTS</span><h3>اللحظات الحاسمة</h3><p>ركلة جزاء تدريبية، اختبار توقيت، واختبار تركيز. نتيجتك تطوّر اللاعب من غير تزوير إحصائيات المباريات الرسمية.</p></div><button type="button" class="lwcx-button lwcx-button-primary" data-lwcx-action="open-challenges">ابدأ تحدي <span aria-hidden="true">←</span></button></article>' +
        '<article class="lwcx-card"><div class="lwcx-card-icon">02</div><div class="lwcx-card-copy"><span class="lwcx-tag">MONEY & CHOICES</span><h3>الفلوس والاستثمار</h3><p>ادخار آمن أو مخاطرة محسوبة. استثمر من رصيد اللعبة وتابع استحقاق العائد مع مرور الأيام.</p></div><button type="button" class="lwcx-button" data-lwcx-action="open-finance">إدارة المال <span aria-hidden="true">←</span></button></article>' +
        '<article class="lwcx-card"><div class="lwcx-card-icon">03</div><div class="lwcx-card-copy"><span class="lwcx-tag">PEOPLE AROUND YOU</span><h3>العلاقات والتوجيه</h3><p>جلسة مع المدرب، دعم لاعب أصغر، أو راحة ذهنية. اختار نشاط واحد في اليوم زي نظام المسيرة الأساسي.</p></div><button type="button" class="lwcx-button" data-lwcx-action="open-mentor">اختار نشاط <span aria-hidden="true">←</span></button></article>' +
        '<article class="lwcx-card"><div class="lwcx-card-icon">04</div><div class="lwcx-card-copy"><span class="lwcx-tag">YOUR LEGACY</span><h3>إرثك الكروي</h3><p>بطاقة تتحدّث تلقائيًا حسب المشاركات والأهداف والبطولات والمنتخب والقرارات اللي عشتها.</p></div><button type="button" class="lwcx-button" data-lwcx-action="open-legacy">اعرض الإرث <span aria-hidden="true">←</span></button></article>' +
      '</div><div class="lwcx-footnote"><span class="lwcx-live-dot"></span><span id="lwcx-status">النتائج بتتحفظ مع مسيرتك على نفس الجهاز.</span><span class="lwcx-foot-right">IN-GAME SYSTEMS · NOT REAL MONEY</span></div>';
    anchor.insertAdjacentElement("afterend", panel);
    return true;
  }

  function renderPanel(s, cachedWorld) {
    if (!s || !ensurePanel()) return;
    var w = cachedWorld || world(s);
    var pending = w.investments.filter(function (item) { return !item.settled; }).length;
    function text(id, value) {
      var element = document.getElementById(id);
      if (element) element.textContent = String(value);
    }
    text("lwcx-wins", w.challengeWins);
    text("lwcx-attempts", w.practiceAttempts + " محاولة");
    text("lwcx-investments", pending);
    text("lwcx-investment-note", pending ? "في انتظار يوم الاستحقاق" : "مفيش استثمارات معلّقة");
    text("lwcx-mentors", w.mentorSessions);
    text("lwcx-stories", Array.isArray(s.storyHistory) ? s.storyHistory.length : 0);
    text("lwcx-status", s.retired ? "المسيرة انتهت — تقدر تراجع بطاقة الإرث النهائية." : "الطاقة " + cap(s.energy, 0, 100) + "% · الرصيد " + Math.max(0, Number(s.money) || 0) + " جنيه داخل اللعبة");
    var actions = panel.querySelectorAll("button[data-lwcx-action]");
    actions.forEach(function (button) {
      var action = button.getAttribute("data-lwcx-action");
      if (action === "open-challenges") button.disabled = !!s.retired || !s.careerStarted;
      if (action === "open-mentor") button.disabled = !!s.retired || !s.careerStarted;
      if (action === "open-finance") button.disabled = !!s.retired || !s.careerStarted;
    });
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "lwcx-overlay";
    overlay.className = "lwcx-overlay";
    overlay.hidden = true;
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeModal() {
    if (timing.timer) window.clearInterval(timing.timer);
    timing.timer = null;
    timing.running = false;
    if (memory.timer) window.clearTimeout(memory.timer);
    memory.timer = null;
    if (overlay) {
      overlay.hidden = true;
      overlay.innerHTML = "";
    }
    currentView = "";
  }

  function frame(title, kicker, body, note) {
    var host = ensureOverlay();
    host.hidden = false;
    host.innerHTML =
      '<div class="lwcx-dialog" role="dialog" aria-modal="true" aria-labelledby="lwcx-dialog-title" dir="rtl">' +
        '<div class="lwcx-dialog-top"><div><span class="lwcx-tag">' + esc(kicker || "CAREER EXPERIENCE") + '</span><h2 id="lwcx-dialog-title">' + esc(title) + '</h2></div><button type="button" class="lwcx-close" data-lwcx-action="close" aria-label="إغلاق">×</button></div>' +
        '<div class="lwcx-dialog-body">' + body + '</div>' +
        (note ? '<div class="lwcx-dialog-note">' + esc(note) + '</div>' : '') +
      '</div>';
    var close = host.querySelector(".lwcx-close");
    if (close) close.focus();
  }

  function actionButton(action, label, detail, attrs) {
    return '<button type="button" class="lwcx-option" data-lwcx-action="' + esc(action) + '"' + (attrs || "") + '><span><strong>' + esc(label) + '</strong>' + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</span><b aria-hidden="true">←</b></button>';
  }

  function openChallenges(s) {
    s = s || (API() && API().getState());
    if (!s) return;
    currentView = "challenges";
    var unavailable = !!s.retired || Number(s.injuryDays) > 0;
    var energy = Number(s.energy) || 0;
    frame("اختار اللحظة اللي هتلعبها", "PLAYABLE MOMENTS",
      '<p class="lwcx-intro">دي تحديات تدريبية بتطوّر قدراتك من غير ما تزود إحصائيات المباريات الرسمية. كل تحدي له تكلفة طاقة، والإصابة بتمنع التدريب.</p>' +
      '<div class="lwcx-options">' +
        actionButton("open-penalty", "ركلة جزاء تدريبية", "اختار الاتجاه والقوة وحاول تتغلب على توقع الحارس.", (unavailable || energy < 4) ? ' disabled' : '') +
        actionButton("open-timing", "اختبار التوقيت", "وقّف المؤشر في المنطقة المثالية لرفع هدوئك تحت الضغط.", (unavailable || energy < 3) ? ' disabled' : '') +
        actionButton("open-memory", "اختبار التركيز", "احفظ سلسلة الاتجاهات وكررها بالترتيب.", (unavailable || energy < 1) ? ' disabled' : '') +
      '</div>');
  }

  function openPenalty(s) {
    if (!canPractice(s, 4)) return;
    currentView = "penalty";
    if (!penalty.direction) penalty.direction = "";
    var directions = [
      { id: "left", label: "الزاوية الشمال" },
      { id: "center", label: "نص المرمى" },
      { id: "right", label: "الزاوية اليمين" }
    ];
    frame("ركلة جزاء تدريبية", "PENALTY PRACTICE",
      '<p class="lwcx-intro">اختار مكان التسديدة، وبعدها ظبّط القوة. القوة المثالية حوالي 68%؛ القوة الزيادة بتصعّب التحكم.</p>' +
      '<div class="lwcx-goal" aria-label="اختيار اتجاه التسديدة">' +
        directions.map(function (d) {
          return '<button type="button" class="lwcx-goal-zone ' + (penalty.direction === d.id ? "selected" : "") + '" data-lwcx-action="penalty-target" data-dir="' + d.id + '" aria-pressed="' + (penalty.direction === d.id ? "true" : "false") + '"><span></span><small>' + d.label + '</small></button>';
        }).join("") +
      '</div>' +
      '<label class="lwcx-range-label" for="lwcx-power"><span>قوة التسديدة</span><strong id="lwcx-power-value">' + cap(penalty.power, 25, 95) + '%</strong></label>' +
      '<input class="lwcx-range" id="lwcx-power" type="range" min="25" max="95" step="1" value="' + cap(penalty.power, 25, 95) + '">' +
      '<div class="lwcx-range-scale"><span>تحكم أعلى</span><span>قوة أعلى</span></div>' +
      '<div class="lwcx-modal-actions">' +
        '<button type="button" class="lwcx-button lwcx-button-primary" data-lwcx-action="penalty-shoot"' + (!penalty.direction ? " disabled" : "") + '>سدّد الكرة</button>' +
        '<button type="button" class="lwcx-button" data-lwcx-action="open-challenges">رجوع</button>' +
      '</div>');
  }

  function canPractice(s, energyCost) {
    var api = API();
    var message = "";
    if (!s || !s.careerStarted || s.retired) {
      message = s && s.retired
        ? "المسيرة انتهت بالاعتزال؛ التحديات التدريبية متاحة أثناء اللعب فقط."
        : "ابدأ مسيرتك الأول علشان تستخدم التحديات دي.";
    } else if (Number(s.injuryDays) > 0) {
      message = "اتعافى الأول قبل أي تحدي تدريبي.";
    } else if ((Number(s.energy) || 0) < Math.max(0, Number(energyCost) || 0)) {
      message = "طاقتك مش كفاية للتحدي ده. ارتاح أو تقدّم في أيام المسيرة.";
    }
    if (message) {
      if (api && api.toast) api.toast(message);
      return false;
    }
    return true;
  }

  function finishChallenge(s, title, message, won, skill, amount, energyCost) {
    if (!canPractice(s, energyCost)) {
      closeModal();
      return false;
    }
    var w = world(s);
    w.challengeCount++;
    w.practiceAttempts++;
    if (won) w.challengeWins++;
    if (skill && amount) stat(s, skill, amount);
    stat(s, "energy", -Math.abs(Number(energyCost) || 0));
    stat(s, "careerXP", won ? 8 : 3);
    if (won) {
      stat(s, "morale", 2);
      stat(s, "trust", 1);
    } else {
      stat(s, "composure", 1);
    }
    record(s, title, message + (won ? " نجحت في التحدي، واتسجل التطور في قدراتك." : " النتيجة دي تدريب، وتقدر تحاول تاني في يوم لاحق."));
    save(s, won ? "ممتاز! التحدي اتسجل ونتيجته اتطبقت." : "المحاولة اتحفظت. كمل تدريبك وجرّب تاني.");
    currentView = "challenge-result";
    frame(won ? "نجحت في التحدي" : "المحاولة خلصت", "TRAINING RESULT",
      '<div class="lwcx-result ' + (won ? "success" : "miss") + '"><div class="lwcx-result-mark">' + (won ? "✓" : "↻") + '</div><h3>' + esc(title) + '</h3><p>' + esc(message) + '</p><div class="lwcx-result-stats"><span>طاقة <b>-' + Math.abs(Number(energyCost) || 0) + '</b></span><span>خبرة <b>+' + (won ? 8 : 3) + '</b></span><span>التحديات الناجحة <b>' + w.challengeWins + '</b></span></div></div>' +
      '<div class="lwcx-modal-actions"><button type="button" class="lwcx-button lwcx-button-primary" data-lwcx-action="open-challenges">تحدي تاني</button><button type="button" class="lwcx-button" data-lwcx-action="close">إنهاء</button></div>');
  }

  function shootPenalty(s) {
    if (!canPractice(s, 4)) return;
    if (!penalty.direction) return;
    var keeper = ["left", "center", "right"][Math.floor(Math.random() * 3)];
    var power = cap(penalty.power, 25, 95);
    var accuracyPenalty = Math.abs(power - 68) * 0.48;
    var chance = cap(34 + (Number(s.shooting) || 0) * 0.42 + (Number(s.composure) || 0) * 0.12 - accuracyPenalty - (keeper === penalty.direction ? 27 : 0), 8, 95);
    var goal = Math.random() * 100 < chance;
    var dirLabel = { left: "الشمال", center: "النص", right: "اليمين" };
    var message = goal
      ? "التسديدة دخلت " + dirLabel[penalty.direction] + " المرمى بقوة " + power + "%. الحارس توقّع " + dirLabel[keeper] + "."
      : (keeper === penalty.direction ? "الحارس توقّع اتجاهك وصدّ الكرة عند " + dirLabel[keeper] + "." : "الكرة راحت خارج المرمى؛ القوة أو التحكم محتاجين شغل أكتر.");
    finishChallenge(s, "ركلة جزاء تدريبية", message, goal, goal ? "shooting" : "composure", 1, 4);
    penalty.direction = "";
    penalty.power = 68;
  }

  function openTiming(s) {
    if (!canPractice(s, 3)) return;
    currentView = "timing-intro";
    timing.value = 0;
    timing.direction = 1;
    frame("اختبار التوقيت", "COMPOSURE TEST",
      '<p class="lwcx-intro">المؤشر هيتحرك رايح جاي. وقّفه قريب من العلامة المضيئة في 70% عشان تحقق أفضل نتيجة.</p>' +
      '<div class="lwcx-timing-wrap"><div class="lwcx-timing-track"><i class="lwcx-timing-target"></i><i id="lwcx-timing-marker" class="lwcx-timing-marker" style="left:5%"></i></div><div class="lwcx-range-scale"><span>0%</span><b id="lwcx-timing-readout">استعد</b><span>100%</span></div></div>' +
      '<div class="lwcx-modal-actions"><button type="button" class="lwcx-button lwcx-button-primary" data-lwcx-action="timing-start">ابدأ المؤشر</button><button type="button" class="lwcx-button" data-lwcx-action="open-challenges">رجوع</button></div>',
      "هتحتاج تفاعل يدوي؛ مفيش مكافأة هتتحسب من غير ما توقف المؤشر بنفسك.");
  }

  function startTiming(s) {
    if (!canPractice(s, 3) || timing.running) return;
    if (timing.timer) window.clearInterval(timing.timer);
    timing.value = 5;
    timing.direction = 1;
    timing.running = true;
    currentView = "timing-game";
    var marker = document.getElementById("lwcx-timing-marker");
    var readout = document.getElementById("lwcx-timing-readout");
    if (readout) readout.textContent = "اضغط إيقاف قرب 70%";
    var button = overlay && overlay.querySelector('[data-lwcx-action="timing-start"]');
    if (button) {
      button.textContent = "إيقاف المؤشر";
      button.setAttribute("data-lwcx-action", "timing-stop");
    }
    timing.timer = window.setInterval(function () {
      timing.value += timing.direction * 2.7;
      if (timing.value >= 96) { timing.value = 96; timing.direction = -1; }
      if (timing.value <= 4) { timing.value = 4; timing.direction = 1; }
      if (marker) marker.style.left = timing.value + "%";
      if (readout) readout.textContent = Math.round(timing.value) + "%";
    }, 28);
  }

  function stopTiming(s) {
    if (!timing.running || currentView !== "timing-game") return;
    if (timing.timer) window.clearInterval(timing.timer);
    timing.timer = null;
    timing.running = false;
    var distance = Math.abs(timing.value - 70);
    var won = distance <= 11;
    if (won) world(s).timingWins++;
    finishChallenge(s, "اختبار التوقيت", "وقفت المؤشر عند " + Math.round(timing.value) + "%. المنطقة المثالية تبدأ من 59% لحد 81%.", won, "composure", won ? 2 : 1, 3);
  }

  function createMemorySequence(s) {
    var arrows = ["↑", "→", "↓", "←"];
    var seed = dayNumber(s) * 5 + (Number(s.season) || 1) * 13 + world(s).challengeCount * 7 + (Number(s.apps) || 0) * 3;
    memory.sequence = [];
    for (var i = 0; i < 4; i++) {
      memory.sequence.push(arrows[Math.abs(seed + i * 11 + i * i * 3) % arrows.length]);
    }
    memory.answers = [];
    memory.stage = "show";
  }

  function openMemory(s) {
    if (!canPractice(s, 1)) return;
    createMemorySequence(s);
    currentView = "memory-show";
    drawMemoryShow();
    memory.timer = window.setTimeout(function () {
      if (currentView === "memory-show") {
        var latest = API() && API().getState();
        if (!canPractice(latest, 1)) {
          closeModal();
          return;
        }
        memory.timer = null;
        memory.stage = "answer";
        currentView = "memory-answer";
        drawMemoryAnswer();
      }
    }, 1700);
  }

  function drawMemoryShow() {
    frame("اختبار التركيز", "MEMORY CHALLENGE",
      '<p class="lwcx-intro">احفظ الاتجاهات بالترتيب؛ بعد لحظة هتختفي ولازم تختار نفس السلسلة.</p><div class="lwcx-memory-sequence" aria-live="polite">' +
      memory.sequence.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join("") +
      '</div><p class="lwcx-memory-count">احفظ 4 اتجاهات…</p><div class="lwcx-modal-actions"><button type="button" class="lwcx-button" data-lwcx-action="close">إلغاء التحدي</button></div>');
  }

  function drawMemoryAnswer() {
    frame("كرّر السلسلة", "MEMORY CHALLENGE",
      '<p class="lwcx-intro">اختار الاتجاهات بنفس الترتيب. التقدم الحالي: <strong>' + memory.answers.length + ' من 4</strong>.</p>' +
      '<div class="lwcx-memory-sequence lwcx-memory-hidden">' + memory.answers.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join("") + '<span class="lwcx-memory-placeholder">' + (memory.answers.length < 4 ? "?" : "✓") + '</span></div>' +
      '<div class="lwcx-memory-buttons">' + ["↑", "→", "↓", "←"].map(function (x) {
        return '<button type="button" class="lwcx-memory-key" data-lwcx-action="memory-answer" data-arrow="' + x + '" aria-label="اتجاه ' + x + '">' + x + '</button>';
      }).join("") + '</div>' +
      '<div class="lwcx-modal-actions"><button type="button" class="lwcx-button" data-lwcx-action="memory-reset">ابدأ من جديد</button><button type="button" class="lwcx-button" data-lwcx-action="close">إنهاء</button></div>');
  }

  function answerMemory(s, arrow) {
    if (currentView !== "memory-answer") return;
    if (!canPractice(s, 1)) {
      closeModal();
      return;
    }
    memory.answers.push(arrow);
    if (memory.answers.length < memory.sequence.length) {
      drawMemoryAnswer();
      return;
    }
    var won = memory.answers.every(function (value, index) { return value === memory.sequence[index]; });
    if (won) world(s).memoryWins++;
    finishChallenge(s, "اختبار التركيز", won ? "افتكرت الاتجاهات الأربعة بالترتيب الصحيح." : "السلسلة الصحيحة كانت " + memory.sequence.join(" ") + ". التركيز بيتحسن بالممارسة.", won, "vision", won ? 2 : 1, 1);
  }

  function renderFinance() {
    var s = API().getState();
    var w = world(s);
    var open = w.investments.filter(function (item) { return !item.settled; });
    var recent = w.investments.slice().reverse().slice(0, 5);
    var list = recent.length ? '<div class="lwcx-investment-list">' + recent.map(function (item) {
      var status = item.settled ? "تم الاستحقاق: +" + item.payout + " جنيه" : "الاستحقاق بعد " + Math.max(0, Number(item.dueDay) - dayNumber(s)) + " يوم";
      return '<div class="lwcx-investment-row"><span><strong>' + esc(item.label) + '</strong><small>' + esc(status) + '</small></span><b>' + esc(item.amount) + '</b></div>';
    }).join("") + '</div>' : '<p class="lwcx-empty">مفيش عمليات استثمار مسجلة لسه.</p>';
    frame("إدارة المال والاستثمار", "IN-GAME ECONOMY",
      '<div class="lwcx-balance"><span>رصيدك الحالي</span><strong>' + Math.max(0, Number(s.money) || 0).toLocaleString("en-US") + ' <small>جنيه</small></strong><p>كل المبالغ افتراضية داخل اللعبة فقط.</p></div>' +
      '<div class="lwcx-options">' +
        actionButton("invest-safe", "ادخار آمن", "حجز 100 جنيه لمدة 7 أيام؛ تسترد 118 جنيهًا عند الاستحقاق.", (Number(s.money) < 100 || s.retired || !s.careerStarted || open.length >= 5) ? ' disabled' : '') +
        actionButton("invest-risky", "استثمار عالي المخاطرة", "حجز 200 جنيه لمدة 10 أيام؛ العائد أعلى أو أقل من المبلغ حسب النتيجة.", (Number(s.money) < 200 || s.retired || !s.careerStarted || open.length >= 5) ? ' disabled' : '') +
        actionButton("training-skill", "حصة مدرب متخصص", "تكلفة 180 جنيهًا و8 طاقة؛ تطوّر مهارة تختارها فورًا.", (Number(s.money) < 180 || s.energy < 8 || s.injuryDays > 0 || s.retired) ? ' disabled' : '') +
      '</div><div class="lwcx-subhead"><strong>محفظة الاستثمار</strong><span>' + open.length + ' عملية مفتوحة</span></div>' + list,
      "العوائد تتسجل داخل الحفظ؛ الادخار والاستثمار مش مربوطين بفلوس حقيقية أو مدفوعات.");
  }

  function makeInvestment(s, risky) {
    if (!s) return;
    var w = world(s);
    var amount = risky ? 200 : 100;
    var api = API();
    var openCount = w.investments.filter(function (item) { return item && !item.settled; }).length;
    if (!s.careerStarted || s.retired) {
      if (api && api.toast) api.toast(s.retired
        ? "المسيرة انتهت بالاعتزال؛ مش متاح تبدأ استثمارات جديدة."
        : "ابدأ مسيرتك الأول علشان تستخدم الاستثمار.");
      return;
    }
    if (openCount >= 5) {
      if (api && api.toast) api.toast("عندك 5 عمليات استثمار مفتوحة بالفعل. استنى استحقاق واحدة قبل ما تبدأ غيرها.");
      return;
    }
    if ((Number(s.money) || 0) < amount) {
      if (api && api.toast) api.toast("رصيدك مش كفاية للعملية دي.");
      return;
    }
    s.money = Math.max(0, Number(s.money) - amount);
    var successful = !risky || Math.random() < 0.54;
    var payout = risky ? (successful ? 340 : 55) : 118;
    var item = {
      id: w.investmentSequence++, kind: risky ? "risky" : "safe",
      label: risky ? "استثمار عالي المخاطرة" : "ادخار آمن",
      amount: amount, payout: payout, dueDay: dayNumber(s) + (risky ? 10 : 7),
      settled: false, successful: successful
    };
    w.investments.push(item);
    w.investments = w.investments.slice(-30);
    record(s, item.label, "حجزت " + amount + " جنيه داخل اللعبة؛ الاستحقاق بعد " + (risky ? 10 : 7) + " أيام.");
    save(s, "اتسجلت العملية. راجعها تاني بعد مرور أيام اللعبة.");
    currentView = "finance";
    renderFinance();
  }

  function openTrainingSkill() {
    currentView = "training-skill";
    var s = API().getState();
    frame("حصة مدرب متخصص", "FOCUSED TRAINING",
      '<p class="lwcx-intro">اختار مهارة واحدة. التكلفة 180 جنيهًا داخل اللعبة و8 طاقة، والتدريب يمنح نقطتين في المهارة المختارة.</p>' +
      '<div class="lwcx-skill-grid">' +
        actionButton("skill-shooting", "التسديد", "تحسين إنهاء الفرص.") +
        actionButton("skill-passing", "التمرير", "دقة أفضل في بناء اللعب.") +
        actionButton("skill-dribbling", "المراوغة", "تحكم أحسن في الكرة.") +
        actionButton("skill-speed", "السرعة", "انطلاقة أسرع.") +
        actionButton("skill-fitness", "اللياقة", "قدرة بدنية أعلى.") +
        actionButton("skill-composure", "الهدوء", "ثبات تحت الضغط.") +
        (s.pos === "حارس مرمى" ? actionButton("skill-goalkeeping", "حراسة المرمى", "تدريب تخصصي للحارس فقط.") : "") +
      '</div><div class="lwcx-modal-actions"><button type="button" class="lwcx-button" data-lwcx-action="open-finance">رجوع</button></div>');
  }

  function applyFocusedTraining(s, skill) {
    if (!s) return;
    var allowedSkills = ["shooting", "passing", "dribbling", "speed", "fitness", "composure"];
    if (s.pos === "حارس مرمى") allowedSkills.push("goalkeeping");
    if (allowedSkills.indexOf(skill) < 0) {
      var rejectedApi = API();
      if (rejectedApi && rejectedApi.toast) rejectedApi.toast("المهارة دي مش متاحة لمركزك.");
      return;
    }
    if (s.retired || Number(s.injuryDays) > 0 || Number(s.money) < 180 || Number(s.energy) < 8) {
      var api = API();
      if (api && api.toast) api.toast("راجع الرصيد والطاقة والإصابة قبل التمرين.");
      return;
    }
    var labels = { shooting: "التسديد", passing: "التمرير", dribbling: "المراوغة", speed: "السرعة", fitness: "اللياقة", composure: "الهدوء", goalkeeping: "حراسة المرمى" };
    s.money = Math.max(0, Number(s.money) - 180);
    stat(s, skill, 2);
    stat(s, "energy", -8);
    stat(s, "careerXP", 10);
    record(s, "حصة مدرب متخصص", "دفعت 180 جنيهًا داخل اللعبة وطوّرت مهارة " + labels[skill] + " بنقطتين.");
    save(s, "التدريب المتخصص اتسجل. المهارة اتطورت والطاقة اتخصمت.");
    currentView = "finance";
    renderFinance();
  }

  function settleInvestments(s, cachedWorld) {
    var w = cachedWorld || world(s);
    var today = dayNumber(s);
    var changed = false;
    w.investments.forEach(function (item) {
      if (item.settled || today < Number(item.dueDay)) return;
      item.settled = true;
      s.money = Math.max(0, Number(s.money) || 0) + Math.max(0, Number(item.payout) || 0);
      item.result = item.successful ? "نجحت العملية" : "خسارة استثمارية";
      record(s, "استحقاق استثمار", item.label + ": رجع لحسابك " + item.payout + " جنيه داخل اللعبة (" + item.result + ").", w);
      changed = true;
    });
    if (changed) {
      var api = API();
      if (api && api.save) api.save();
      if (api && api.toast) api.toast("وصل تاريخ استحقاق استثمار؛ رصيدك اتحدّث.");
    }
    return changed;
  }

  function openMentor() {
    currentView = "mentor";
    var s = API().getState();
    var used = !!s.dailyActionUsed && Number(s.dailyActionDay) === Number(s.day);
    var unavailable = !s.careerStarted || !!s.retired;
    var energy = Number(s.energy) || 0;
    frame("العلاقات والتوجيه", "PEOPLE AROUND YOU",
      '<p class="lwcx-intro">قرار خارج الملعب ممكن يحسن ثقتك وانسجامك. جلسة المدرب تحتاج 3 طاقة، ودعم الزميل يحتاج طاقة واحدة؛ الراحة الذهنية متاحة حتى مع الطاقة المنخفضة.</p>' +
      '<div class="lwcx-options">' +
        actionButton("mentor-coach", "جلسة مع المدرب", "ثقة المدرب +5، احترافية +3، مقابل 3 طاقة.", (used || unavailable || energy < 3) ? ' disabled' : '') +
        actionButton("mentor-teammate", "دعم لاعب أصغر", "انسجام الفريق +5 ومعنويات +3، مقابل طاقة واحدة.", (used || unavailable || energy < 1) ? ' disabled' : '') +
        actionButton("mentor-reset", "راحة ذهنية", "معنويات +5 وطاقة +7؛ مفيدة بعد الضغط.", (used || unavailable) ? ' disabled' : '') +
      '</div><div class="lwcx-subhead"><strong>سجل العلاقات</strong><span>' + world(s).mentorSessions + ' جلسة' + '</span></div>' +
      ((world(s).history.filter(function (row) { return /جلسة مع المدرب|دعم لاعب أصغر|راحة ذهنية/.test(row.title); }).slice(0, 4)).map(function (row) {
        return '<div class="lwcx-investment-row"><span><strong>' + esc(row.title) + '</strong><small>الموسم ' + esc(row.season) + ' · اليوم ' + esc(row.day) + '</small></span><b>✓</b></div>';
      }).join("") || '<p class="lwcx-empty">لسه مفيش جلسات مسجلة.</p>'),
      used ? "استخدمت نشاطك الجانبي النهارده. تقدّم ليوم جديد قبل جلسة تانية." : "النشاط بيستهلك فرصة النشاط الجانبي لليوم؛ مش هتقدر تكرر الجلسات في نفس اليوم.");
  }

  function doMentor(s, kind) {
    var api = API();
    if (!s || !s.careerStarted || s.retired) {
      if (api && api.toast) api.toast(s && s.retired
        ? "المسيرة انتهت بالاعتزال؛ أنشطة المسيرة اليومية مش متاحة."
        : "ابدأ مسيرتك الأول علشان تستخدم أنشطة العلاقات.");
      closeModal();
      return;
    }
    if (["coach", "teammate", "reset"].indexOf(kind) < 0) {
      if (api && api.toast) api.toast("النشاط ده مش متاح.");
      return;
    }
    var currentDay = Number(s.day) || 1;
    if (s.dailyActionUsed && Number(s.dailyActionDay) === currentDay) {
      var api = API();
      if (api && api.toast) api.toast("استخدمت نشاطك الجانبي النهارده. تقدّم ليوم جديد.");
      openMentor();
      return;
    }
    var requiredEnergy = kind === "coach" ? 3 : kind === "teammate" ? 1 : 0;
    if ((Number(s.energy) || 0) < requiredEnergy) {
      if (api && api.toast) api.toast("طاقتك مش كفاية للنشاط ده. ارتاح الأول أو اختار الراحة الذهنية.");
      openMentor();
      return;
    }
    if (kind === "coach") {
      stat(s, "coachRelationship", 5);
      stat(s, "trust", 2);
      stat(s, "professionalism", 3);
      stat(s, "energy", -3);
      record(s, "جلسة مع المدرب", "اتكلمت مع المدرب عن دورك وخطة تطويرك. الثقة والاحترافية اتحسنوا.");
    } else if (kind === "teammate") {
      stat(s, "teamChemistry", 5);
      stat(s, "morale", 3);
      stat(s, "professionalism", 1);
      stat(s, "energy", -1);
      record(s, "دعم لاعب أصغر", "خصصت وقت للاعب أصغر وشاركت معاه خبرتك. انسجام الفريق اتحسن.");
    } else {
      stat(s, "morale", 5);
      stat(s, "energy", 7);
      stat(s, "fatigue", -4);
      record(s, "راحة ذهنية", "اخدت وقت تهدّي فيه الضغط وتراجع أولوياتك. معنوياتك وتعافيك اتحسنوا.");
    }
    s.dailyActionUsed = true;
    s.dailyActionType = kind === "coach" ? "جلسة توجيه" : kind === "teammate" ? "دعم زميل" : "راحة ذهنية";
    s.dailyActionDay = currentDay;
    s.nightToday = true;
    world(s).mentorSessions++;
    save(s, "النشاط اتسجل واتطبقت نتائجه على المسيرة.");
    currentView = "mentor";
    openMentor();
  }

  function legacyData(s) {
    var apps = Math.max(Number(s.totalCareerAppearances) || 0, Number(s.apps) || 0);
    var goals = Number(s.goals) || 0;
    var assists = Number(s.assists) || 0;
    var trophies = Number(s.trophies) || 0;
    var caps = Number(s.nationalCaps) || 0;
    var awards = (Array.isArray(s.careerAwards) ? s.careerAwards.length : 0) + (Number(s.topScorerAwards) || 0);
    var transfers = Array.isArray(s.transferHistory) ? s.transferHistory.length : 0;
    var stories = Array.isArray(s.storyHistory) ? s.storyHistory.length : 0;
    var score = apps + goals * 3 + assists * 2 + trophies * 35 + caps * 3 + awards * 12;
    var tags = [];
    if (trophies >= 3) tags.push("جامع بطولات");
    if (goals >= 30) tags.push("هداف المسيرة");
    if (caps >= 10) tags.push("دولي مخضرم");
    if ((Number(s.teamChemistry) || 0) >= 75 && (Number(s.coachRelationship) || 0) >= 70) tags.push("قائد غرفة الملابس");
    if ((Number(s.mediaReputation) || 0) >= 65 || (Number(s.followers) || 0) >= 5000) tags.push("نجم جماهيري");
    if (transfers >= 4) tags.push("رحّالة الملاعب");
    if (apps >= 20 && transfers <= 1) tags.push("وفيّ للنادي");
    if (stories >= 8) tags.push("صاحب حكاية استثنائية");
    if (!tags.length) tags.push("الموهبة لسه بتكتب أول فصل");
    var title = score >= 450 ? "أسطورة كروية" : score >= 220 ? "نجم كبير" : score >= 90 ? "اسم معروف" : "بداية الإرث";
    if (s.retired) title = "الإرث النهائي";
    return { apps: apps, goals: goals, assists: assists, trophies: trophies, caps: caps, awards: awards, transfers: transfers, stories: stories, score: score, tags: tags, title: title };
  }

  function openLegacy() {
    currentView = "legacy";
    var s = API().getState();
    var d = legacyData(s);
    frame(s.retired ? "بطاقة الإرث النهائية" : "إرثك لحد النهارده", "CAREER LEGACY",
      '<div class="lwcx-legacy-card"><span class="lwcx-legacy-overline">LAST WHISTLE · PLAYER DOSSIER</span><div class="lwcx-legacy-title">' + esc(d.title) + '</div><div class="lwcx-legacy-player">' + esc(s.name || "لاعب جديد") + '</div><div class="lwcx-legacy-club">' + esc(s.clubName || "النادي الحالي") + ' · سن ' + esc(s.age || 17) + '</div>' +
      '<div class="lwcx-legacy-score"><strong>' + d.score + '</strong><span>نقاط الإرث التقديرية داخل اللعبة</span></div>' +
      '<div class="lwcx-legacy-stats">' +
        '<div><small>مشاركات</small><b>' + d.apps + '</b></div><div><small>أهداف</small><b>' + d.goals + '</b></div><div><small>صناعة</small><b>' + d.assists + '</b></div><div><small>بطولات</small><b>' + d.trophies + '</b></div><div><small>مباريات دولية</small><b>' + d.caps + '</b></div><div><small>جوائز</small><b>' + d.awards + '</b></div>' +
      '</div><div class="lwcx-legacy-tags">' + d.tags.map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join("") + '</div></div>' +
      '<div class="lwcx-subhead"><strong>إيه اللي شكّل إرثك؟</strong><span>' + d.stories + ' قرار قصصي</span></div>' +
      '<p class="lwcx-intro">البطاقة بتتحدّث من إحصائيات الحفظ الحالي. نقاط الإرث ملخص تقديري داخل Last Whistle، مش جائزة رسمية ولا بديل عن سجل البطولات.</p>' +
      '<div class="lwcx-modal-actions"><button type="button" class="lwcx-button lwcx-button-primary" data-lwcx-action="close">رجوع للمسيرة</button></div>',
      s.retired ? "المسيرة معتزلة بالفعل. أرقام البطاقة مأخوذة من السجل المحفوظ." : "دي بطاقة إرث حية، هتتغير مع أهدافك وبطولاتك وعلاقاتك. الاعتزال الحقيقي يفضل تابعًا لنظام المسيرة الحالي.");
  }

  function handleAction(action, element) {
    var api = API();
    if (!api) return;
    var s = api.getState();
    if (!s) return;
    world(s);
    if (!s.careerStarted && action !== "close" && action !== "open-legacy") {
      if (api.toast) api.toast("ابدأ مسيرتك الأول علشان تستخدم النظام ده.");
      return;
    }
    if (action === "close") { closeModal(); return; }
    if (action === "open-challenges") { openChallenges(s); return; }
    if (action === "open-finance") { currentView = "finance"; renderFinance(); return; }
    if (action === "open-mentor") { openMentor(); return; }
    if (action === "open-legacy") { openLegacy(); return; }
    if (action === "open-penalty") { penalty = { direction: "", power: 68 }; openPenalty(s); return; }
    if (action === "penalty-target") { penalty.direction = element.getAttribute("data-dir") || ""; openPenalty(s); return; }
    if (action === "penalty-shoot") { penalty.power = cap((document.getElementById("lwcx-power") || {}).value || penalty.power, 25, 95); shootPenalty(s); return; }
    if (action === "open-timing") { openTiming(s); return; }
    if (action === "timing-start") { startTiming(s); return; }
    if (action === "timing-stop") { stopTiming(s); return; }
    if (action === "open-memory") { openMemory(s); return; }
    if (action === "memory-answer") { answerMemory(s, element.getAttribute("data-arrow") || ""); return; }
    if (action === "memory-reset") { openMemory(s); return; }
    if (action === "invest-safe") { makeInvestment(s, false); return; }
    if (action === "invest-risky") { makeInvestment(s, true); return; }
    if (action === "training-skill") { openTrainingSkill(); return; }
    if (action.indexOf("skill-") === 0) { applyFocusedTraining(s, action.slice(6)); return; }
    if (action.indexOf("mentor-") === 0) { doMentor(s, action.slice(7)); return; }
  }

  function panelSignature(s, w) {
    var investments = Array.isArray(w.investments) ? w.investments : [];
    var latest = investments.length ? investments[investments.length - 1] : null;
    var latestSignature = latest
      ? [latest.id, latest.dueDay, latest.settled ? 1 : 0].join(":")
      : "-";
    return [
      s.careerStarted ? 1 : 0,
      s.retired ? 1 : 0,
      Number(s.energy) || 0,
      Math.max(0, Number(s.money) || 0),
      dayNumber(s),
      Array.isArray(s.storyHistory) ? s.storyHistory.length : 0,
      Number(w.challengeWins) || 0,
      Number(w.practiceAttempts) || 0,
      Number(w.mentorSessions) || 0,
      investments.length,
      latestSignature
    ].join("|");
  }

  function tick(force) {
    var api = API();
    if (!api) return;
    var s = api.getState();
    if (!s) return;

    var today = dayNumber(s);
    var runtimeChanged = s !== lastExperienceRuntime;
    var currentWorld = s.careerWorld && typeof s.careerWorld === "object" ? s.careerWorld : null;
    var needsSettlementCheck = !!force || runtimeChanged || !currentWorld
      || lastSettledDay === null || today !== lastSettledDay;
    var w = needsSettlementCheck ? world(s) : currentWorld;

    if (needsSettlementCheck) {
      // Set the day before settling: api.save() can synchronously publish twice.
      // The queued follow-up tick must not rescan the portfolio a second time.
      lastSettledDay = today;
      settleInvestments(s, w);
      w = s.careerWorld || w;
    }

    if (!ensurePanel()) {
      lastExperienceSnapshot = "";
      lastExperienceRuntime = s;
      return;
    }

    var signature = panelSignature(s, w);
    if (force || runtimeChanged || signature !== lastExperienceSnapshot) {
      // Background pages still process due investments, but do not mutate the DOM.
      if (!document.hidden) renderPanel(s, w);
      lastExperienceSnapshot = signature;
    }
    lastExperienceRuntime = s;
  }

  function scheduleTick(force) {
    experienceForceQueued = experienceForceQueued || !!force;
    if (experienceTickScheduled) return;
    experienceTickScheduled = true;
    Promise.resolve().then(function () {
      experienceTickScheduled = false;
      var queuedForce = experienceForceQueued;
      experienceForceQueued = false;
      tick(queuedForce);
    });
  }

  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("[data-lwcx-action]") : null;
    if (!button) return;
    if (button.disabled) return;
    event.preventDefault();
    handleAction(button.getAttribute("data-lwcx-action") || "", button);
  });

  document.addEventListener("input", function (event) {
    if (event.target && event.target.id === "lwcx-power") {
      penalty.power = cap(event.target.value, 25, 95);
      var value = document.getElementById("lwcx-power-value");
      if (value) value.textContent = penalty.power + "%";
    }
  });

  function start() {
    tick(true);
    var store = window.LWStateStore;
    if (store && typeof store.subscribe === "function") {
      store.subscribe(function () { scheduleTick(false); });
      window.setInterval(function () { tick(false); }, 5000);
    } else {
      // Older saves/builds without the shared store still receive periodic refreshes.
      window.setInterval(function () { tick(false); }, 2500);
    }
    window.addEventListener("pageshow", function () { tick(true); });
    window.addEventListener("storage", function () { tick(true); });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) tick(true);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();