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
  var pendingInvestmentsWorld = null;
  var pendingInvestmentsRevision = null;
  var pendingInvestmentsLength = -1;
  var pendingInvestmentsTail = "";
  var pendingInvestmentsCount = 0;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function finiteNumber(value) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && value.trim() === "") return null;
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function safeCounter(value, fallback) {
    var parsed = finiteNumber(value);
    if (parsed === null) return fallback;
    return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(parsed)));
  }

  function cap(value, min, max) {
    var parsed = finiteNumber(value);
    return Math.max(min, Math.min(max, Math.round(parsed === null ? min : parsed)));
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
    w.challengeCount = safeCounter(w.challengeCount, 0);
    w.challengeWins = safeCounter(w.challengeWins, 0);
    w.practiceAttempts = safeCounter(w.practiceAttempts, 0);
    w.memoryWins = safeCounter(w.memoryWins, 0);
    w.timingWins = safeCounter(w.timingWins, 0);
    w.mentorSessions = safeCounter(w.mentorSessions, 0);
    w.investmentSequence = Math.max(1, safeCounter(w.investmentSequence, 1));
    // Legacy saves may have an absent or stale sequence counter; keep every investment ID unique.
    // Only finite, non-negative safe integer IDs may advance the sequence.
    var maxInvestmentId = w.investments.reduce(function (max, item) {
      var rawId;
      try { rawId = item && item.id; } catch (error) { return max; }
      var id = finiteNumber(rawId);
      return id !== null && Number.isSafeInteger(id) && id >= 0 ? Math.max(max, id) : max;
    }, 0);
    var nextInvestmentSequence = maxInvestmentId >= Number.MAX_SAFE_INTEGER
      ? Number.MAX_SAFE_INTEGER : maxInvestmentId + 1;
    w.investmentSequence = Math.max(w.investmentSequence, nextInvestmentSequence);
    return w;
  }

  function dayNumber(s) {
    var calendarDay = null, day = null;
    try { calendarDay = finiteNumber(s && s.calendarDay); } catch (error) {}
    if (calendarDay !== null && calendarDay > 0) {
      return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(calendarDay)));
    }
    try { day = finiteNumber(s && s.day); } catch (error) {}
    if (day !== null && day > 0) {
      return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(day)));
    }
    return 1;
  }

  function careerDay(s) {
    var day = finiteNumber(s && s.day);
    return day !== null && Number.isSafeInteger(day) && day >= 1 ? day : null;
  }

  function dailyActionUsedOnDay(s, today) {
    if (!s || !s.dailyActionUsed) return false;
    if (today === null) return true;
    var rawDay = s.dailyActionDay;
    // Older saves may only have the boolean flag. Fail closed for a used action
    // with a missing/corrupt day until the normal day rollover clears the flag.
    if (rawDay == null || (typeof rawDay === "string" && rawDay.trim() === "")) return true;
    var savedDay = finiteNumber(rawDay);
    return savedDay === null || !Number.isSafeInteger(savedDay) || savedDay < 1 || savedDay === today;
  }

  function safeInvestmentDueDay(item) {
    if (!financeRecord(item)) return null;
    var rawDueDay;
    try { rawDueDay = item.dueDay; } catch (error) { return null; }
    var dueDay = finiteNumber(rawDueDay);
    return dueDay !== null && Number.isSafeInteger(dueDay) && dueDay >= 1
      ? dueDay : null;
  }

  function investmentIsDue(item, today) {
    if (!financeRecord(item) || item.settled) return false;
    var dueDay = safeInvestmentDueDay(item);
    return dueDay !== null && today >= dueDay;
  }

  function stat(s, key, delta) {
    var bounded = [
      "energy", "morale", "trust", "fatigue", "professionalism", "mediaReputation",
      "teamChemistry", "coachRelationship", "playerPotential", "fitness", "confidence",
      "shooting", "dribbling", "passing", "speed", "composure", "defending",
      "goalkeeping", "vision"
    ];
    var current = finiteNumber(s && s[key]);
    var change = finiteNumber(delta);
    var next = (current === null ? 0 : current) + (change === null ? 0 : change);
    if (!Number.isFinite(next)) next = 0;
    if (bounded.indexOf(key) >= 0) s[key] = cap(next, 0, 100);
    else if (key === "money" || key === "followers" || key === "careerXP" || key === "levelXP") {
      s[key] = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(next)));
    } else s[key] = next;
  }

  function record(s, title, text, cachedWorld) {
    var w = cachedWorld || world(s);
    var row = {
      title: String(title || "حدث في المسيرة"),
      text: String(text || ""),
      season: (function () {
        var savedSeason = finiteNumber(s && s.season);
        return savedSeason !== null && savedSeason >= 1
          ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(savedSeason)) : 1;
      })(),
      day: dayNumber(s)
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

  var financeMutationPending = false;

  function acquireSharedMutationLock(owner) {
    var coordinator = window.__LW_DURABLE_MUTATION_LOCK__;
    if (!coordinator || typeof coordinator !== "object") {
      coordinator = { owner: "", queue: [] };
      window.__LW_DURABLE_MUTATION_LOCK__ = coordinator;
    }
    if (!Array.isArray(coordinator.queue)) coordinator.queue = [];
    owner = String(owner || "");
    if (!owner) return false;
    if (!coordinator.owner) {
      coordinator.owner = owner;
      return true;
    }
    return new Promise(function(resolve) { coordinator.queue.push({ owner: owner, resolve: resolve }); });
  }
  function releaseSharedMutationLock(owner) {
    var coordinator = window.__LW_DURABLE_MUTATION_LOCK__;
    if (!coordinator || coordinator.owner !== owner) return;
    var next = Array.isArray(coordinator.queue) ? coordinator.queue.shift() : null;
    if (next && next.owner) {
      coordinator.owner = next.owner;
      next.resolve(true);
    } else {
      coordinator.owner = "";
    }
  }

  function safeWholeMoney(value) {
    var amount = finiteNumber(value);
    if (amount === null || amount < 0 || amount > Number.MAX_SAFE_INTEGER) return null;
    var whole = Math.floor(amount);
    return Number.isSafeInteger(whole) ? whole : null;
  }

  function cloneFinanceState(state) {
    if (state === undefined || state === null || typeof state !== "object") return state;
    try { if (typeof window.structuredClone === "function") return window.structuredClone(state); } catch (error) {}
    try { return JSON.parse(JSON.stringify(state)); } catch (error) { return null; }
  }

  function financeValueEquals(left, right) {
    if (Object.is(left, right)) return true;
    if (left == null || right == null || typeof left !== "object" || typeof right !== "object") return false;
    try { return JSON.stringify(left) === JSON.stringify(right); } catch (error) { return false; }
  }

  function financeRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function financeArrayItemIdentity(item) {
    if (!item || typeof item !== "object") return typeof item + ":" + String(item);
    var stableKeys = ["id", "key", "investmentId", "playerId"];
    for (var i = 0; i < stableKeys.length; i++) {
      var stableValue = item[stableKeys[i]];
      if (stableValue !== undefined && stableValue !== null && String(stableValue) !== "") {
        return stableKeys[i] + ":" + String(stableValue);
      }
    }
    // Descriptive fields are not unique: two events can share a title, body,
    // season and day. Without a stable ID, only exact object equality is safe.
    return null;
  }

  function findFinanceArrayItem(array, item, used) {
    if (!Array.isArray(array)) return -1;
    // Prefer exact equality before stable IDs. A descriptive or duplicate ID
    // match must never steal a different row when an exact copy is available.
    for (var j = 0; j < array.length; j++) {
      if ((!used || !used[j]) && financeValueEquals(array[j], item)) return j;
    }
    var identity = financeArrayItemIdentity(item);
    if (identity !== null) {
      for (var i = 0; i < array.length; i++) {
        if ((!used || !used[i]) && financeArrayItemIdentity(array[i]) === identity) return i;
      }
    }
    return -1;
  }

  function restoreFinanceArray(target, before, applied, path, conflicts) {
    if (financeValueEquals(target, before)) return target;
    if (financeValueEquals(target, applied)) return cloneFinanceState(before);
    if (!Array.isArray(target) || !Array.isArray(before) || !Array.isArray(applied)) {
      conflicts.push(path);
      return target;
    }
    var beforeUsed = [], targetUsed = [], additions = [], pairs = [];
    applied.forEach(function (afterItem) {
      var beforeIndex = findFinanceArrayItem(before, afterItem, beforeUsed);
      if (beforeIndex < 0) {
        additions.push(afterItem);
        return;
      }
      beforeUsed[beforeIndex] = true;
      pairs.push({ before: before[beforeIndex], after: afterItem });
    });
    pairs.forEach(function (pair) {
      if (financeValueEquals(pair.before, pair.after)) return;
      var targetIndex = findFinanceArrayItem(target, pair.after, targetUsed);
      if (targetIndex < 0) {
        conflicts.push(path + "[" + (financeArrayItemIdentity(pair.after) || "item") + "]");
        return;
      }
      targetUsed[targetIndex] = true;
      var currentItem = target[targetIndex];
      if (financeValueEquals(currentItem, pair.after)) {
        target[targetIndex] = cloneFinanceState(pair.before);
      } else if (financeRecord(pair.before) && financeRecord(pair.after) && financeRecord(currentItem)) {
        restoreFinanceObject(currentItem, pair.before, pair.after, path + "[" + (financeArrayItemIdentity(pair.after) || targetIndex) + "]", conflicts);
      } else if (Array.isArray(pair.before) && Array.isArray(pair.after) && Array.isArray(currentItem)) {
        target[targetIndex] = restoreFinanceArray(currentItem, pair.before, pair.after, path + "[" + targetIndex + "]", conflicts);
      } else if (typeof pair.before === "number" && typeof pair.after === "number" && typeof currentItem === "number"
        && Number.isFinite(pair.before) && Number.isFinite(pair.after) && Number.isFinite(currentItem)) {
        target[targetIndex] = currentItem - (pair.after - pair.before);
      } else {
        conflicts.push(path + "[" + (financeArrayItemIdentity(pair.after) || targetIndex) + "]");
      }
    });
    additions.forEach(function (addedItem) {
      var targetIndex = findFinanceArrayItem(target, addedItem);
      if (targetIndex < 0) return;
      if (financeValueEquals(target[targetIndex], addedItem)) {
        target.splice(targetIndex, 1);
      } else {
        conflicts.push(path + "[" + (financeArrayItemIdentity(addedItem) || "new-item") + "]");
      }
    });
    before.forEach(function (beforeItem, index) {
      if (beforeUsed[index]) return;
      if (findFinanceArrayItem(target, beforeItem) < 0) {
        target.splice(Math.min(index, target.length), 0, cloneFinanceState(beforeItem));
      }
    });
    return target;
  }

  function restoreFinanceObject(target, before, applied, path, conflicts) {
    var keys = Object.keys(before || {}).concat(Object.keys(applied || {}).filter(function (key) {
      return !Object.prototype.hasOwnProperty.call(before || {}, key);
    }));
    keys.forEach(function (key) {
      var beforeHas = Object.prototype.hasOwnProperty.call(before || {}, key);
      var appliedHas = Object.prototype.hasOwnProperty.call(applied || {}, key);
      var beforeValue = beforeHas ? before[key] : undefined;
      var appliedValue = appliedHas ? applied[key] : undefined;
      if (beforeHas === appliedHas && (!beforeHas || financeValueEquals(beforeValue, appliedValue))) return;
      var currentHas = Object.prototype.hasOwnProperty.call(target, key);
      var currentValue = currentHas ? target[key] : undefined;
      var fieldPath = path ? path + "." + key : key;
      if (currentHas === beforeHas && (!beforeHas || financeValueEquals(currentValue, beforeValue))) return;

      if (!beforeHas && appliedHas && financeRecord(appliedValue) && currentHas && financeRecord(currentValue)) {
        restoreFinanceObject(currentValue, {}, appliedValue, fieldPath, conflicts);
        if (Object.keys(currentValue).length === 0) delete target[key];
        return;
      }
      if (!beforeHas && appliedHas && Array.isArray(appliedValue) && currentHas && Array.isArray(currentValue)) {
        var restoredNewArray = restoreFinanceArray(currentValue, [], appliedValue, fieldPath, conflicts);
        if (restoredNewArray.length) target[key] = restoredNewArray;
        else delete target[key];
        return;
      }
      if (beforeHas && appliedHas && financeRecord(beforeValue) && financeRecord(appliedValue)
        && currentHas && financeRecord(currentValue)) {
        restoreFinanceObject(currentValue, beforeValue, appliedValue, fieldPath, conflicts);
        return;
      }
      if (beforeHas && appliedHas && Array.isArray(beforeValue) && Array.isArray(appliedValue)
        && currentHas && Array.isArray(currentValue)) {
        target[key] = restoreFinanceArray(currentValue, beforeValue, appliedValue, fieldPath, conflicts);
        return;
      }
      if (beforeHas && appliedHas && typeof beforeValue === "number" && typeof appliedValue === "number"
        && currentHas && typeof currentValue === "number"
        && Number.isFinite(beforeValue) && Number.isFinite(appliedValue) && Number.isFinite(currentValue)) {
        if (financeValueEquals(currentValue, appliedValue)) target[key] = beforeValue;
        else if (!financeValueEquals(currentValue, beforeValue)) target[key] = currentValue - (appliedValue - beforeValue);
        return;
      }
      if (currentHas === appliedHas && (!appliedHas || financeValueEquals(currentValue, appliedValue))) {
        if (beforeHas) target[key] = cloneFinanceState(beforeValue);
        else delete target[key];
        return;
      }
      conflicts.push(fieldPath);
    });
  }

  function restoreFinanceState(target, snapshot, appliedSnapshot) {
    if (!target || !snapshot || typeof snapshot !== "object") throw new Error("invalid-finance-snapshot");
    if (!appliedSnapshot || typeof appliedSnapshot !== "object") {
      Object.keys(target).forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(snapshot, key)) delete target[key];
      });
      Object.keys(snapshot).forEach(function (key) { target[key] = cloneFinanceState(snapshot[key]); });
      return [];
    }
    var conflicts = [];
    restoreFinanceObject(target, snapshot, appliedSnapshot, "", conflicts);
    return conflicts;
  }

  async function flushFinanceState(api, state) {
    var queued = api.save();
    if (queued && typeof queued.then === "function") queued = await queued;
    if (queued === false) return false;
    var pending;
    if (typeof window.flushQueuedSave === "function") pending = window.flushQueuedSave({ backupFirst: true });
    else if (window.LWStateStore && typeof window.LWStateStore.flush === "function") pending = window.LWStateStore.flush(state);
    else return false;
    return await Promise.resolve(pending) === true;
  }

  async function runCareerMutation(state, operation, successMessage, category) {
    var api = API();
    var isFinance = category === "finance";
    var label = isFinance ? "العملية المالية" : "النشاط";
    if (financeMutationPending) {
      if (api && api.toast) api.toast(isFinance
        ? "فيه عملية مالية تانية بيتأكد حفظها دلوقتي. استنى لحظة."
        : "فيه نشاط تاني بيتأكد حفظه دلوقتي. استنى لحظة.");
      return { ok: false, reason: isFinance ? "finance-mutation-pending" : "career-mutation-pending" };
    }
    if (!state || typeof operation !== "function" || !api || typeof api.save !== "function") {
      return { ok: false, reason: isFinance ? "finance-persistence-unavailable" : "career-persistence-unavailable" };
    }
    financeMutationPending = true;
    var mutationLockAcquired = false;
    var snapshot = null;
    var mutationStarted = false;
    var payload = null;
    var appliedSnapshot = null;
    try {
      var mutationLock = acquireSharedMutationLock("career-experience");
      if (mutationLock && typeof mutationLock.then === "function") mutationLock = await mutationLock;
      if (mutationLock !== true) {
        try { if (api.toast) api.toast("تعذر تأمين قفل الحفظ؛ لم يتم تنفيذ " + label + "."); } catch (toastError) {}
        return { ok: false, reason: isFinance ? "finance-mutation-lock-unavailable" : "career-mutation-lock-unavailable" };
      }
      mutationLockAcquired = true;
      snapshot = cloneFinanceState(state);
      if (!snapshot) {
        try { if (api.toast) api.toast("تعذر تأمين نسخة من المسيرة؛ لم يتم تنفيذ " + label + "."); } catch (toastError) {}
        return { ok: false, reason: isFinance ? "finance-snapshot-unavailable" : "career-snapshot-unavailable" };
      }
      mutationStarted = true;
      payload = operation();
      if (payload === false || payload == null) throw new Error("career mutation rejected");
      appliedSnapshot = cloneFinanceState(state);
      if (!appliedSnapshot) throw new Error("career post-mutation snapshot unavailable");
      if (!(await flushFinanceState(api, state))) throw new Error("career save not confirmed");
    } catch (error) {
      if (!mutationStarted || !snapshot) {
        var setupReason = mutationLockAcquired
          ? (isFinance ? "finance-mutation-snapshot-failed" : "career-mutation-snapshot-failed")
          : (isFinance ? "finance-mutation-lock-failed" : "career-mutation-lock-failed");
        try { if (api.toast) api.toast("تعذر تجهيز الحفظ الآمن؛ لم يتم تنفيذ " + label + "."); } catch (toastError) {}
        if (window.console && window.console.warn) window.console.warn("Career mutation setup failed", error);
        return { ok: false, reason: setupReason, rollbackPersisted: false };
      }
      var rollbackTarget = state;
      try {
        var latestState = api && typeof api.getState === "function" ? api.getState() : null;
        if (latestState && typeof latestState === "object") rollbackTarget = latestState;
      } catch (stateReadError) {}
      var rollbackConflicts = [];
      try { rollbackConflicts = restoreFinanceState(rollbackTarget, snapshot, appliedSnapshot); }
      catch (restoreError) {
        try {
          if (api.toast) api.toast(isFinance
            ? "تعذر استعادة بيانات العملية المالية. أوقف اللعب وصدّر نسخة احتياطية قبل المتابعة."
            : "تعذر استعادة بيانات النشاط. أوقف اللعب وصدّر نسخة احتياطية قبل المتابعة.");
        } catch (toastError) {}
        try { if (api.render) api.render(); } catch (renderError) {}
        return { ok: false, reason: "career-rollback-restore-failed", rollbackPersisted: false };
      }
      var rollbackPersisted = false;
      try { rollbackPersisted = await flushFinanceState(api, rollbackTarget) === true; }
      catch (rollbackError) {
        if (window.console && window.console.warn) window.console.warn("Career rollback persistence failed", rollbackError);
      }
      try { if (api.render) api.render(); } catch (renderError) {}
      try { renderPanel(rollbackTarget, rollbackTarget.careerWorld && typeof rollbackTarget.careerWorld === "object" ? rollbackTarget.careerWorld : null); } catch (panelError) {}
      var conflictNote = rollbackConflicts.length
        ? (isFinance
          ? " حصلت تغييرات أحدث أثناء الحفظ، واحتفظنا بيها بدل ما نمسحها. راجع الرصيد والمحفظة قبل إعادة المحاولة."
          : " حصلت تغييرات أحدث أثناء الحفظ، واحتفظنا بيها بدل ما نمسحها. راجع بيانات المسيرة قبل إعادة المحاولة.")
        : "";
      var message = rollbackPersisted
        ? (isFinance
          ? "تعذر تأكيد العملية المالية؛ رجّعنا التغييرات غير المتعارضة وحفظنا الحالة السابقة. تقدر تحاول تاني."
          : "تعذر تأكيد حفظ النشاط؛ رجّعنا تأثيره غير المتعارض وحفظنا الحالة السابقة. تقدر تحاول تاني.")
          + conflictNote
        : "رجّعنا تأثير العملية داخل اللعبة، لكن تعذر تأكيد حفظ الحالة. صدّر نسخة احتياطية قبل المتابعة." + conflictNote;
      try { if (api.toast) api.toast(message); } catch (toastError) {}
      if (window.console && window.console.warn) window.console.warn("Career mutation rolled back", error);
      return { ok: false, reason: message, rollbackPersisted: rollbackPersisted, rollbackConflicts: rollbackConflicts };
    } finally {
      financeMutationPending = false;
      if (mutationLockAcquired) {
        try { releaseSharedMutationLock("career-experience"); }
        catch (releaseError) {
          if (window.console && window.console.warn) window.console.warn("Career mutation lock release failed", releaseError);
        }
      }
    }
    try { if (api.render) api.render(); } catch (renderError) {}
    try { renderPanel(state, state.careerWorld && typeof state.careerWorld === "object" ? state.careerWorld : null); } catch (panelError) {}
    try { if (successMessage && api.toast) api.toast(successMessage); } catch (toastError) {}
    return Object.assign({ ok: true }, payload && typeof payload === "object" ? payload : {});
  }

  function runFinanceMutation(state, operation, successMessage) {
    return runCareerMutation(state, operation, successMessage, "finance");
  }

  function ensurePanel() {
    var host = document.getElementById("lifePageGrid");
    if (!host) {
      var lifePage = document.getElementById("page-life");
      host = lifePage && lifePage.querySelector(".grid");
      if (!host) return false;
      host.id = "lifePageGrid";
    }

    panel = document.getElementById("lw-career-experience");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "lw-career-experience";
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
    }

    panel.className = "lwcx-panel span12";
    panel.setAttribute("aria-labelledby", "lwcx-title");
    if (panel.parentElement !== host || host.firstElementChild !== panel) {
      host.insertBefore(panel, host.firstElementChild);
    }
    return true;
  }

  function renderPanel(s, cachedWorld) {
    if (!s || !ensurePanel()) return;
    var w = cachedWorld || world(s);
    var pending = w.investments.filter(function (item) { return financeRecord(item) && !item.settled; }).length;
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
    text("lwcx-status", s.retired ? "المسيرة انتهت — تقدر تراجع بطاقة الإرث النهائية." : "إنجازاتك واستثماراتك محفوظة مع بيانات مسيرتك على نفس الجهاز.");
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
    var rawInjuryDays = s.injuryDays;
    var injuryDays = rawInjuryDays == null ? 0 : finiteNumber(rawInjuryDays);
    var parsedEnergy = finiteNumber(s.energy);
    var unavailable = !!s.retired || injuryDays === null || injuryDays > 0 || parsedEnergy === null;
    var energy = parsedEnergy === null ? 0 : parsedEnergy;
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
    } else {
      var rawInjuryDays = s.injuryDays;
      var injuryDays = rawInjuryDays == null ? 0 : finiteNumber(rawInjuryDays);
      var energy = finiteNumber(s.energy);
      var cost = finiteNumber(energyCost);
      if (injuryDays === null || injuryDays > 0) {
        message = "اتعافى الأول قبل أي تحدي تدريبي.";
      } else if (energy === null || cost === null || energy < Math.max(0, cost)) {
        message = "طاقتك مش كفاية للتحدي ده. ارتاح أو تقدّم في أيام المسيرة.";
      }
    }
    if (message) {
      if (api && api.toast) api.toast(message);
      return false;
    }
    return true;
  }

  async function finishChallenge(s, title, message, won, skill, amount, energyCost, successCounter) {
    if (!canPractice(s, energyCost)) {
      closeModal();
      return { ok: false, reason: "practice-unavailable" };
    }
    var result = await runCareerMutation(s, function () {
      var rawInjuryDays = s && s.injuryDays;
      var injuryDays = rawInjuryDays == null ? 0 : finiteNumber(rawInjuryDays);
      var energy = finiteNumber(s && s.energy);
      var cost = finiteNumber(energyCost);
      if (!s || !s.careerStarted || s.retired || injuryDays === null || injuryDays > 0
        || energy === null || cost === null || energy < Math.max(0, cost)) return false;
      var w = world(s);
      w.challengeCount++;
      w.practiceAttempts++;
      if (won) {
        w.challengeWins++;
        if (successCounter === "timingWins" || successCounter === "memoryWins") w[successCounter]++;
      }
      if (skill && amount) stat(s, skill, amount);
      stat(s, "energy", -Math.abs(cost));
      stat(s, "careerXP", won ? 8 : 3);
      if (won) {
        stat(s, "morale", 2);
        stat(s, "trust", 1);
      } else {
        stat(s, "composure", 1);
      }
      record(s, title, message + (won ? " نجحت في التحدي، واتسجل التطور في قدراتك." : " النتيجة دي تدريب، وتقدر تحاول تاني في يوم لاحق."), w);
      return { challengeWins: w.challengeWins, challengeCount: w.challengeCount };
    }, won ? "ممتاز! التحدي اتسجل واتأكد حفظه." : "المحاولة اتحفظت واتأكد حفظها.", "activity");
    if (!result.ok) {
      if (result.reason === "career-mutation-pending" || result.reason === "finance-mutation-pending") return result;
      currentView = "challenge-save-failed";
      frame("النتيجة ما اتحفظتش", "SAVE NOT CONFIRMED",
        '<p class="lwcx-intro">تعذر تأكيد حفظ نتيجة التحدي. رجّعنا الطاقة والخبرة والمهارات وسجل المحاولات للحالة السابقة.</p>' +
        '<div class="lwcx-modal-actions"><button type="button" class="lwcx-button lwcx-button-primary" data-lwcx-action="open-challenges">الرجوع للتحديات</button><button type="button" class="lwcx-button" data-lwcx-action="close">إغلاق</button></div>',
        "لم يتم تسجيل مكافأة أو خصم طاقة؛ ابدأ محاولة جديدة بعد التأكد من الحفظ.");
      return result;
    }
    var w = world(s);
    currentView = "challenge-result";
    frame(won ? "نجحت في التحدي" : "المحاولة خلصت", "TRAINING RESULT",
      '<div class="lwcx-result ' + (won ? "success" : "miss") + '"><div class="lwcx-result-mark">' + (won ? "✓" : "↻") + '</div><h3>' + esc(title) + '</h3><p>' + esc(message) + '</p><div class="lwcx-result-stats"><span>طاقة <b>-' + Math.abs(Number(energyCost) || 0) + '</b></span><span>خبرة <b>+' + (won ? 8 : 3) + '</b></span><span>التحديات الناجحة <b>' + w.challengeWins + '</b></span></div></div>' +
      '<div class="lwcx-modal-actions"><button type="button" class="lwcx-button lwcx-button-primary" data-lwcx-action="open-challenges">تحدي تاني</button><button type="button" class="lwcx-button" data-lwcx-action="close">إنهاء</button></div>');
    return result;
  }

  async function shootPenalty(s) {
    if (!canPractice(s, 4)) return { ok: false, reason: "practice-unavailable" };
    if (!penalty.direction) return { ok: false, reason: "penalty-direction-required" };
    var keeper = ["left", "center", "right"][Math.floor(Math.random() * 3)];
    var power = cap(penalty.power, 25, 95);
    var accuracyPenalty = Math.abs(power - 68) * 0.48;
    var shooting = cap(s.shooting, 0, 100);
    var composure = cap(s.composure, 0, 100);
    var chance = cap(34 + shooting * 0.42 + composure * 0.12 - accuracyPenalty - (keeper === penalty.direction ? 27 : 0), 8, 95);
    var goal = Math.random() * 100 < chance;
    var dirLabel = { left: "الشمال", center: "النص", right: "اليمين" };
    var message = goal
      ? "التسديدة دخلت " + dirLabel[penalty.direction] + " المرمى بقوة " + power + "%. الحارس توقّع " + dirLabel[keeper] + "."
      : (keeper === penalty.direction ? "الحارس توقّع اتجاهك وصدّ الكرة عند " + dirLabel[keeper] + "." : "الكرة راحت خارج المرمى؛ القوة أو التحكم محتاجين شغل أكتر.");
    var result = await finishChallenge(s, "ركلة جزاء تدريبية", message, goal, goal ? "shooting" : "composure", 1, 4);
    if (result && result.ok) {
      penalty.direction = "";
      penalty.power = 68;
    }
    return result;
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
    return finishChallenge(s, "اختبار التوقيت", "وقفت المؤشر عند " + Math.round(timing.value) + "%. المنطقة المثالية تبدأ من 59% لحد 81%.", won, "composure", won ? 2 : 1, 3, "timingWins");
  }

  function createMemorySequence(s) {
    var arrows = ["↑", "→", "↓", "←"];
    var season = Math.max(1, safeCounter(s.season, 1));
    var apps = safeCounter(s.apps, 0);
    var challengeCount = safeCounter(world(s).challengeCount, 0);
    var seed = dayNumber(s) * 5 + season * 13 + challengeCount * 7 + apps * 3;
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
    return finishChallenge(s, "اختبار التركيز", won ? "افتكرت الاتجاهات الأربعة بالترتيب الصحيح." : "السلسلة الصحيحة كانت " + memory.sequence.join(" ") + ". التركيز بيتحسن بالممارسة.", won, "vision", won ? 2 : 1, 1, "memoryWins");
  }

  function renderFinance() {
    var s = API().getState();
    var w = world(s);
    var balance = safeWholeMoney(s.money);
    var displayBalance = balance === null ? 0 : balance;
    var open = w.investments.filter(function (item) { return financeRecord(item) && !item.settled; });
    var recent = w.investments.slice().reverse().filter(financeRecord).slice(0, 5);
    var list = recent.length ? '<div class="lwcx-investment-list">' + recent.map(function (item) {
      var dueDay = safeInvestmentDueDay(item);
      var status = item.settled ? "تم الاستحقاق: +" + item.payout + " جنيه"
        : dueDay === null ? "موعد الاستحقاق غير صالح — راجع الحفظ"
        : "الاستحقاق بعد " + Math.max(0, dueDay - dayNumber(s)) + " يوم";
      return '<div class="lwcx-investment-row"><span><strong>' + esc(item.label) + '</strong><small>' + esc(status) + '</small></span><b>' + esc(item.amount) + '</b></div>';
    }).join("") + '</div>' : '<p class="lwcx-empty">مفيش عمليات استثمار مسجلة لسه.</p>';
    frame("إدارة المال والاستثمار", "IN-GAME ECONOMY",
      '<div class="lwcx-balance"><span>رصيدك الحالي</span><strong>' + displayBalance.toLocaleString("en-US") + ' <small>جنيه</small></strong><p>كل المبالغ افتراضية داخل اللعبة فقط.</p></div>' +
      '<div class="lwcx-options">' +
        actionButton("invest-safe", "ادخار آمن", "حجز 100 جنيه لمدة 7 أيام؛ تسترد 118 جنيهًا عند الاستحقاق.", (balance === null || balance < 100 || s.retired || !s.careerStarted || open.length >= 5) ? ' disabled' : '') +
        actionButton("invest-risky", "استثمار عالي المخاطرة", "حجز 200 جنيه لمدة 10 أيام؛ العائد أعلى أو أقل من المبلغ حسب النتيجة.", (balance === null || balance < 200 || s.retired || !s.careerStarted || open.length >= 5) ? ' disabled' : '') +
        actionButton("training-skill", "حصة مدرب متخصص", "تكلفة 180 جنيهًا و8 طاقة؛ تطوّر مهارة تختارها فورًا.", (balance === null || balance < 180 || s.energy < 8 || s.injuryDays > 0 || s.retired) ? ' disabled' : '') +
      '</div><div class="lwcx-subhead"><strong>محفظة الاستثمار</strong><span>' + open.length + ' عملية مفتوحة</span></div>' + list,
      "العوائد تتسجل داخل الحفظ؛ الادخار والاستثمار مش مربوطين بفلوس حقيقية أو مدفوعات.");
  }

  function makeInvestment(s, risky) {
    if (!s) return Promise.resolve({ ok: false, reason: "career-state-unavailable" });
    var api = API();
    if (financeMutationPending) {
      if (api && api.toast) api.toast("فيه عملية مالية تانية بيتأكد حفظها دلوقتي. استنى لحظة.");
      return Promise.resolve({ ok: false, reason: "finance-mutation-pending" });
    }
    var amount = risky ? 200 : 100;
    if (!s.careerStarted || s.retired) {
      if (api && api.toast) api.toast(s.retired ? "المسيرة انتهت بالاعتزال؛ مش متاح تبدأ استثمارات جديدة." : "ابدأ مسيرتك الأول علشان تستخدم الاستثمار.");
      return Promise.resolve({ ok: false, reason: "investment-unavailable" });
    }
    var balance = safeWholeMoney(s.money);
    if (balance === null) {
      if (api && api.toast) api.toast("رصيدك غير صالح؛ راجع الحفظ قبل أي عملية مالية.");
      return Promise.resolve({ ok: false, reason: "invalid-balance" });
    }
    var w = world(s);
    var openCount = w.investments.filter(function (item) { return financeRecord(item) && !item.settled; }).length;
    if (openCount >= 5) {
      if (api && api.toast) api.toast("عندك 5 عمليات استثمار مفتوحة بالفعل. استنى استحقاق واحدة قبل ما تبدأ غيرها.");
      return Promise.resolve({ ok: false, reason: "investment-limit" });
    }
    if (balance < amount) {
      if (api && api.toast) api.toast("رصيدك مش كفاية للعملية دي.");
      return Promise.resolve({ ok: false, reason: "insufficient-balance" });
    }
    return runFinanceMutation(s, function () {
      var currentBalance = safeWholeMoney(s.money);
      var currentOpenCount = w.investments.filter(function (item) { return financeRecord(item) && !item.settled; }).length;
      if (currentBalance === null || currentBalance < amount || currentOpenCount >= 5) return false;
      s.money = currentBalance - amount;
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
      record(s, item.label, "حجزت " + amount + " جنيه داخل اللعبة؛ الاستحقاق بعد " + (risky ? 10 : 7) + " أيام.", w);
      return { investment: item };
    }, "اتسجلت العملية واتأكد حفظ الرصيد والمحفظة. راجعها تاني بعد مرور أيام اللعبة.").then(function (result) {
      if (result.ok) { currentView = "finance"; renderFinance(); }
      return result;
    });
  }

  function focusedTrainingBlockReason(s) {
    if (!s || !s.careerStarted || s.retired) return "career-unavailable";
    if (s.playedToday) return "played-today";
    if (s.trainedToday) return "training-already-used";
    var rawInjuryDays = s.injuryDays;
    var injuryDays = rawInjuryDays == null || rawInjuryDays === "" ? 0 : finiteNumber(rawInjuryDays);
    var energy = finiteNumber(s.energy);
    var balance = safeWholeMoney(s.money);
    if (injuryDays === null || injuryDays > 0 || balance === null || balance < 180 || energy === null || energy < 8) {
      return "training-requirements-not-met";
    }
    return "";
  }

  function openTrainingSkill() {
    currentView = "training-skill";
    var s = API().getState();
    var blockReason = focusedTrainingBlockReason(s);
    var blockMessage = blockReason === "training-already-used"
      ? "أنهيت تدريب اليوم. تقدر تختار حصة جديدة بعد ما تتقدم ليوم تاني."
      : blockReason === "played-today"
        ? "يوم المباراة خلص؛ التدريب المتخصص متاح بعد يوم جديد."
        : blockReason === "career-unavailable"
          ? "التدريب المتخصص متاح أثناء المسيرة الاحترافية فقط."
          : blockReason
            ? "التدريب يحتاج 180 جنيهًا، و8 طاقة على الأقل، ومن غير إصابة."
            : "";
    var disabled = blockReason ? " disabled" : "";
    frame("حصة مدرب متخصص", "FOCUSED TRAINING",
      '<p class="lwcx-intro">اختار مهارة واحدة. التكلفة 180 جنيهًا داخل اللعبة و8 طاقة، والتدريب يمنح نقطتين في المهارة المختارة.</p>' +
      (blockMessage ? '<p class="lwcx-intro">' + esc(blockMessage) + '</p>' : '') +
      '<div class="lwcx-skill-grid">' +
        actionButton("skill-shooting", "التسديد", "تحسين إنهاء الفرص.", disabled) +
        actionButton("skill-passing", "التمرير", "دقة أفضل في بناء اللعب.", disabled) +
        actionButton("skill-dribbling", "المراوغة", "تحكم أحسن في الكرة.", disabled) +
        actionButton("skill-speed", "السرعة", "انطلاقة أسرع.", disabled) +
        actionButton("skill-fitness", "اللياقة", "قدرة بدنية أعلى.", disabled) +
        actionButton("skill-composure", "الهدوء", "ثبات تحت الضغط.", disabled) +
        (s.pos === "حارس مرمى" ? actionButton("skill-goalkeeping", "حراسة المرمى", "تدريب تخصصي للحارس فقط.", disabled) : "") +
      '</div><div class="lwcx-modal-actions"><button type="button" class="lwcx-button" data-lwcx-action="open-finance">رجوع</button></div>');
  }

  function applyFocusedTraining(s, skill) {
    if (!s) return Promise.resolve({ ok: false, reason: "career-state-unavailable" });
    var allowedSkills = ["shooting", "passing", "dribbling", "speed", "fitness", "composure"];
    if (s.pos === "حارس مرمى") allowedSkills.push("goalkeeping");
    if (allowedSkills.indexOf(skill) < 0) {
      var rejectedApi = API();
      if (rejectedApi && rejectedApi.toast) rejectedApi.toast("المهارة دي مش متاحة لمركزك.");
      return Promise.resolve({ ok: false, reason: "invalid-training-skill" });
    }
    var api = API();
    if (financeMutationPending) {
      if (api && api.toast) api.toast("فيه عملية مالية تانية بيتأكد حفظها دلوقتي. استنى لحظة.");
      return Promise.resolve({ ok: false, reason: "finance-mutation-pending" });
    }
    var blockReason = focusedTrainingBlockReason(s);
    if (blockReason) {
      if (api && api.toast) api.toast(blockReason === "training-already-used"
        ? "أنهيت تدريب اليوم. تقدر تختار حصة جديدة بعد ما تتقدم ليوم تاني."
        : blockReason === "played-today"
          ? "يوم المباراة خلص؛ التدريب المتخصص متاح بعد يوم جديد."
          : "راجع حالة المسيرة والرصيد والطاقة والإصابة قبل التمرين.");
      return Promise.resolve({ ok: false, reason: blockReason });
    }
    var labels = { shooting: "التسديد", passing: "التمرير", dribbling: "المراوغة", speed: "السرعة", fitness: "اللياقة", composure: "الهدوء", goalkeeping: "حراسة المرمى" };
    var w = world(s);
    return runFinanceMutation(s, function () {
      // Recheck after acquiring the shared transaction lock: a standard session,
      // match, or another module may have consumed today's training slot.
      if (focusedTrainingBlockReason(s)) return false;
      var currentBalance = safeWholeMoney(s.money), currentEnergy = finiteNumber(s.energy);
      if (currentBalance === null || currentBalance < 180 || currentEnergy === null || currentEnergy < 8) return false;
      s.money = currentBalance - 180;
      s.trainedToday = true;
      stat(s, skill, 2);
      stat(s, "energy", -8);
      stat(s, "careerXP", 10);
      record(s, "حصة مدرب متخصص", "دفعت 180 جنيهًا داخل اللعبة وطوّرت مهارة " + labels[skill] + " بنقطتين.", w);
      return { skill: skill };
    }, "التدريب المتخصص اتسجل واتأكد حفظ الرصيد والتطور والطاقة.").then(function (result) {
      if (result.ok) { currentView = "finance"; renderFinance(); }
      return result;
    });
  }

  function settleInvestments(s, cachedWorld) {
    var w = cachedWorld || world(s);
    var today = dayNumber(s);
    var due = w.investments.filter(function (item) { return investmentIsDue(item, today); });
    if (!due.length) return false;
    var api = API();
    if (financeMutationPending) return Promise.resolve({ ok: false, changed: false, reason: "finance-mutation-pending" });
    if (safeWholeMoney(s.money) === null) {
      if (api && api.toast) api.toast("فيه رصيد غير صالح؛ استحقاق الاستثمار متوقف لحد ما تراجع الحفظ.");
      return Promise.resolve({ ok: false, changed: false, reason: "invalid-balance" });
    }
    return runFinanceMutation(s, function () {
      var currentBalance = safeWholeMoney(s.money);
      if (currentBalance === null) return false;
      var dueNow = w.investments.filter(function (item) { return investmentIsDue(item, today); });
      if (!dueNow.length) return { changed: false, settledCount: 0 };
      var nextBalance = currentBalance, settledCount = 0;
      dueNow.forEach(function (item) {
        var normalizedPayout = safeWholeMoney(item.payout);
        var payout = normalizedPayout === null ? 0 : normalizedPayout;
        if (normalizedPayout === null) {
          item.payout = 0;
          item.result = "تم رفض العائد غير الصالح";
        } else {
          item.result = item.successful ? "نجحت العملية" : "خسارة استثمارية";
        }
        var credited = Math.min(payout, Number.MAX_SAFE_INTEGER - nextBalance);
        nextBalance += credited;
        if (credited < payout) item.result = "تم تحديد العائد عند الحد الآمن";
        item.settled = true;
        record(s, "استحقاق استثمار", item.label + ": رجع لحسابك " + credited + " جنيه داخل اللعبة (" + item.result + ").", w);
        settledCount++;
      });
      s.money = nextBalance;
      return { changed: settledCount > 0, settledCount: settledCount };
    }, null).then(function (result) {
      if (result.ok && result.changed) {
        var currentApi = API();
        if (currentApi && currentApi.toast) currentApi.toast("وصل تاريخ استحقاق استثمار؛ رصيدك اتحدّث واتحفظ.");
        return { ok: true, changed: true };
      }
      return { ok: result.ok, changed: false, reason: result.reason };
    });
  }

  function openMentor() {
    currentView = "mentor";
    var s = API().getState();
    var today = careerDay(s);
    var used = dailyActionUsedOnDay(s, today);
    var unavailable = !s.careerStarted || !!s.retired;
    var parsedEnergy = finiteNumber(s.energy);
    var energy = parsedEnergy === null ? 0 : parsedEnergy;
    var energyInvalid = parsedEnergy === null;
    frame("العلاقات والتوجيه", "PEOPLE AROUND YOU",
      '<p class="lwcx-intro">قرار خارج الملعب ممكن يحسن ثقتك وانسجامك. جلسة المدرب تحتاج 3 طاقة، ودعم الزميل يحتاج طاقة واحدة؛ الراحة الذهنية متاحة حتى مع الطاقة المنخفضة.</p>' +
      '<div class="lwcx-options">' +
        actionButton("mentor-coach", "جلسة مع المدرب", "ثقة المدرب +5، احترافية +3، مقابل 3 طاقة.", (used || unavailable || energyInvalid || energy < 3) ? ' disabled' : '') +
        actionButton("mentor-teammate", "دعم لاعب أصغر", "انسجام الفريق +5 ومعنويات +3، مقابل طاقة واحدة.", (used || unavailable || energyInvalid || energy < 1) ? ' disabled' : '') +
        actionButton("mentor-reset", "راحة ذهنية", "معنويات +5 وطاقة +7؛ مفيدة بعد الضغط.", (used || unavailable || energyInvalid) ? ' disabled' : '') +
      '</div><div class="lwcx-subhead"><strong>سجل العلاقات</strong><span>' + world(s).mentorSessions + ' جلسة' + '</span></div>' +
      ((world(s).history.filter(function (row) { return /جلسة مع المدرب|دعم لاعب أصغر|راحة ذهنية/.test(row.title); }).slice(0, 4)).map(function (row) {
        return '<div class="lwcx-investment-row"><span><strong>' + esc(row.title) + '</strong><small>الموسم ' + esc(row.season) + ' · اليوم ' + esc(row.day) + '</small></span><b>✓</b></div>';
      }).join("") || '<p class="lwcx-empty">لسه مفيش جلسات مسجلة.</p>'),
      used ? "استخدمت نشاطك الجانبي النهارده. تقدّم ليوم جديد قبل جلسة تانية." : "النشاط بيستهلك فرصة النشاط الجانبي لليوم؛ مش هتقدر تكرر الجلسات في نفس اليوم.");
  }

  async function doMentor(s, kind) {
    var api = API();
    if (!s || !s.careerStarted || s.retired) {
      if (api && api.toast) api.toast(s && s.retired
        ? "المسيرة انتهت بالاعتزال؛ أنشطة المسيرة اليومية مش متاحة."
        : "ابدأ مسيرتك الأول علشان تستخدم أنشطة العلاقات.");
      closeModal();
      return { ok: false, reason: "career-unavailable" };
    }
    if (["coach", "teammate", "reset"].indexOf(kind) < 0) {
      if (api && api.toast) api.toast("النشاط ده مش متاح.");
      return { ok: false, reason: "invalid-mentor-action" };
    }
    var currentDay = careerDay(s);
    if (dailyActionUsedOnDay(s, currentDay)) {
      if (api && api.toast) api.toast("استخدمت نشاطك الجانبي النهارده. تقدّم ليوم جديد.");
      openMentor();
      return { ok: false, reason: "daily-action-used" };
    }
    var requiredEnergy = kind === "coach" ? 3 : kind === "teammate" ? 1 : 0;
    var currentEnergy = finiteNumber(s.energy);
    if (currentEnergy === null || currentEnergy < requiredEnergy) {
      if (api && api.toast) api.toast("طاقتك مش كفاية للنشاط ده. ارتاح الأول أو اختار الراحة الذهنية.");
      openMentor();
      return { ok: false, reason: "insufficient-energy" };
    }
    var result = await runCareerMutation(s, function () {
      var actionDay = careerDay(s);
      var actionEnergy = finiteNumber(s.energy);
      if (!s.careerStarted || s.retired || dailyActionUsedOnDay(s, actionDay)
        || actionEnergy === null || actionEnergy < requiredEnergy) return false;
      if (actionDay === null) actionDay = 1;
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
      s.dailyActionDay = actionDay;
      s.nightToday = true;
      world(s).mentorSessions++;
      return { kind: kind, day: actionDay };
    }, "النشاط اتسجل واتأكد حفظه على المسيرة.", "activity");
    if (result.ok) {
      currentView = "mentor";
      openMentor();
    }
    return result;
  }

  function legacyData(s) {
    var apps = Math.max(safeCounter(s.totalCareerAppearances, 0), safeCounter(s.apps, 0));
    var goals = safeCounter(s.goals, 0);
    var assists = safeCounter(s.assists, 0);
    var trophies = safeCounter(s.trophies, 0);
    var caps = safeCounter(s.nationalCaps, 0);
    var awards = (Array.isArray(s.careerAwards) ? s.careerAwards.length : 0) + safeCounter(s.topScorerAwards, 0);
    var transfers = Array.isArray(s.transferHistory) ? s.transferHistory.length : 0;
    var stories = Array.isArray(s.storyHistory) ? s.storyHistory.length : 0;
    var teamChemistry = cap(s.teamChemistry, 0, 100);
    var coachRelationship = cap(s.coachRelationship, 0, 100);
    var mediaReputation = cap(s.mediaReputation, 0, 100);
    var followers = safeCounter(s.followers, 0);
    var score = apps + goals * 3 + assists * 2 + trophies * 35 + caps * 3 + awards * 12;
    var tags = [];
    if (trophies >= 3) tags.push("جامع بطولات");
    if (goals >= 30) tags.push("هداف المسيرة");
    if (caps >= 10) tags.push("دولي مخضرم");
    if (teamChemistry >= 75 && coachRelationship >= 70) tags.push("قائد غرفة الملابس");
    if (mediaReputation >= 65 || followers >= 5000) tags.push("نجم جماهيري");
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
    if (action === "penalty-shoot") { penalty.power = cap((document.getElementById("lwcx-power") || {}).value || penalty.power, 25, 95); return shootPenalty(s); }
    if (action === "open-timing") { openTiming(s); return; }
    if (action === "timing-start") { startTiming(s); return; }
    if (action === "timing-stop") { return stopTiming(s); }
    if (action === "open-memory") { openMemory(s); return; }
    if (action === "memory-answer") { return answerMemory(s, element.getAttribute("data-arrow") || ""); }
    if (action === "memory-reset") { openMemory(s); return; }
    if (action === "invest-safe") { return makeInvestment(s, false); }
    if (action === "invest-risky") { return makeInvestment(s, true); }
    if (action === "training-skill") { openTrainingSkill(); return; }
    if (action.indexOf("skill-") === 0) { return applyFocusedTraining(s, action.slice(6)); }
    if (action.indexOf("mentor-") === 0) { return doMentor(s, action.slice(7)); }
  }

  function pendingInvestmentCount(w, revision, force) {
    var investments = Array.isArray(w.investments) ? w.investments : [];
    var latest = investments.length ? investments[investments.length - 1] : null;
    var tail = latest ? [
      safeCounter(latest.id, -1),
      safeInvestmentDueDay(latest) === null ? "invalid-due-day" : safeInvestmentDueDay(latest),
      latest.settled ? 1 : 0
    ].join(":") : "-";
    if (force || w !== pendingInvestmentsWorld || revision !== pendingInvestmentsRevision
      || investments.length !== pendingInvestmentsLength || tail !== pendingInvestmentsTail) {
      pendingInvestmentsCount = investments.reduce(function (count, item) {
        return count + (financeRecord(item) && !item.settled ? 1 : 0);
      }, 0);
      pendingInvestmentsWorld = w;
      pendingInvestmentsRevision = revision;
      pendingInvestmentsLength = investments.length;
      pendingInvestmentsTail = tail;
    }
    return pendingInvestmentsCount;
  }

  function panelSignature(s, w, revision, forcePendingCount) {
    var investments = Array.isArray(w.investments) ? w.investments : [];
    var balance = safeWholeMoney(s.money);
    var latest = investments.length ? investments[investments.length - 1] : null;
    var latestDueDay = latest ? safeInvestmentDueDay(latest) : null;
    var latestSignature = latest
      ? [safeCounter(latest.id, -1), latestDueDay === null ? "invalid-due-day" : latestDueDay,
        latest.settled ? 1 : 0].join(":")
      : "-";
    return [
      s.careerStarted ? 1 : 0,
      s.retired ? 1 : 0,
      finiteNumber(s.energy) === null ? "invalid-energy" : finiteNumber(s.energy),
      balance === null ? "invalid-balance" : balance,
      dayNumber(s),
      Array.isArray(s.storyHistory) ? s.storyHistory.length : 0,
      safeCounter(w.challengeWins, 0),
      safeCounter(w.practiceAttempts, 0),
      safeCounter(w.mentorSessions, 0),
      investments.length,
      latestSignature,
      pendingInvestmentCount(w, revision, !!forcePendingCount)
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
      var settledInvestments = settleInvestments(s, w);
      w = s.careerWorld || w;
      if (settledInvestments && typeof settledInvestments.then === "function") {
        settledInvestments.then(function (result) {
          if (result && result.changed) pendingInvestmentsWorld = null;
          if (result && result.ok === false && lastSettledDay === today) lastSettledDay = null;
        }).catch(function (error) {
          if (window.console && window.console.warn) window.console.warn("Career investment settlement failed", error);
          if (lastSettledDay === today) lastSettledDay = null;
        });
      } else if (settledInvestments) {
        pendingInvestmentsWorld = null;
      }
    }

    if (!ensurePanel()) {
      lastExperienceSnapshot = "";
      lastExperienceRuntime = s;
      return;
    }

    var store = window.LWStateStore;
    var revision = store && typeof store.getRevision === "function" ? Number(store.getRevision()) : null;
    if (!Number.isFinite(revision)) revision = null;
    var signature = panelSignature(s, w, revision, needsSettlementCheck || runtimeChanged);
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
    return handleAction(button.getAttribute("data-lwcx-action") || "", button);
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