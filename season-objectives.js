(function () {
  "use strict";

  var REWARD = 500;
  var DEFINITIONS = [
    { id:"keeper-clean-sheets", group:"goalkeeper", title:"الحارس الحاسم", description:"حافظ على شباكك نظيفة في مبارياتك الرسمية.", metric:"cleanSheets", target:8, unit:"شباك نظيفة" },
    { id:"keeper-saves", group:"goalkeeper", title:"سور المرمى", description:"اجمع تصديات حاسمة طوال الموسم.", metric:"saves", target:45, unit:"تصدي" },
    { id:"keeper-rating", group:"goalkeeper", title:"ثبات الحارس", description:"حافظ على تقييم مرتفع مع عدد مشاركات كافٍ.", metric:"averageRating", target:7.1, minimumAppearances:14, unit:"متوسط تقييم" },
    { id:"defender-clean-sheets", group:"defender", title:"قفل دفاعي", description:"ساهم في مباريات أكثر تخرج فيها بشباك نظيفة.", metric:"cleanSheets", target:8, unit:"شباك نظيفة" },
    { id:"defender-tackles", group:"defender", title:"مدافع شرس", description:"اربح الالتحامات وسجل تدخلات دفاعية ناجحة.", metric:"tackles", target:40, unit:"تدخل ناجح" },
    { id:"defender-rating", group:"defender", title:"ثبات الخط الخلفي", description:"حافظ على تقييم جيد عبر مشاركات منتظمة.", metric:"averageRating", target:7.1, minimumAppearances:14, unit:"متوسط تقييم" },
    { id:"midfield-assists", group:"midfield", title:"مايسترو الصناعة", description:"اصنع أهدافًا لزملائك في مباريات الموسم.", metric:"assists", target:8, unit:"صناعة" },
    { id:"midfield-key-passes", group:"midfield", title:"مهندس اللعب", description:"اصنع فرصًا مباشرة بتمريراتك المفتاحية.", metric:"keyPasses", target:35, unit:"تمريرة مفتاحية" },
    { id:"midfield-rating", group:"midfield", title:"قلب الفريق", description:"حافظ على تأثير ثابت في وسط الملعب.", metric:"averageRating", target:7.2, minimumAppearances:14, unit:"متوسط تقييم" },
    { id:"attacker-goals", group:"attacker", title:"غريزة الهداف", description:"سجل أهدافًا في الدوري والكأس خلال الموسم.", metric:"goals", target:12, unit:"هدف" },
    { id:"attacker-contributions", group:"attacker", title:"مساهم هجومي", description:"اجمع بين التسجيل وصناعة الأهداف.", metric:"contributions", target:18, unit:"مساهمة تهديفية" },
    { id:"attacker-rating", group:"attacker", title:"نجم ثابت", description:"حافظ على تقييم قوي عبر مشاركات منتظمة.", metric:"averageRating", target:7.2, minimumAppearances:14, unit:"متوسط تقييم" }
  ];

  var api = function () { return window.LWStoryRuntime || null; };
  var $ = function (id) { return document.getElementById(id); };
  var lastSignature = "";
  var refreshQueued = false;

  // Saved career rows may contain malformed values. Only finite numbers and
  // non-empty numeric strings are valid numeric inputs; Symbols and objects
  // must never make the season panel or objective calculations throw.
  function finiteNumber(value) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && value.trim() === "") return null;
    var number;
    try { number = Number(value); } catch (error) { return null; }
    return Number.isFinite(number) ? number : null;
  }

  function currentSeason(state) {
    return Math.max(1, finiteNumber(state && state.season) || 1);
  }

  function clone(value) {
    if (value === undefined) return undefined;
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return value; }
  }

  function groupForPosition(position) {
    position = String(position || "");
    if (position === "حارس مرمى" || position === "GK") return "goalkeeper";
    if (["قلب دفاع", "ظهير", "وسط دفاعي", "CB", "RB", "LB", "CDM"].indexOf(position) >= 0) return "defender";
    if (["وسط", "وسط مهاجم", "CM", "CAM"].indexOf(position) >= 0) return "midfield";
    return "attacker";
  }

  function catalogForPosition(position) {
    var group = groupForPosition(position);
    return DEFINITIONS.filter(function (item) { return item.group === group; })
      .map(function (item) { return Object.assign({}, item); });
  }

  function definitionFor(id) {
    for (var i = 0; i < DEFINITIONS.length; i++) {
      if (DEFINITIONS[i].id === String(id || "")) return DEFINITIONS[i];
    }
    return null;
  }

  function stat(row, key) {
    var nested = row && row.stats && typeof row.stats === "object" ? row.stats : {};
    var value = row && row[key] != null ? row[key] : nested[key];
    var number = finiteNumber(value);
    return number === null ? 0 : Math.max(0, number);
  }

  function cleanSheet(row) {
    return !!(row && (row.cleanSheet === true || row.stats && row.stats.cleanSheet === true))
      || stat(row, "cleanSheets") > 0;
  }

  function hasValidPlayingTime(row) {
    var rawMinutes = row && row.minutes;
    if (typeof rawMinutes !== "number" && typeof rawMinutes !== "string") return false;
    if (typeof rawMinutes === "string" && rawMinutes.trim() === "") return false;
    var minutes = finiteNumber(rawMinutes);
    return minutes !== null && minutes > 0;
  }

  function rowsForSeason(state, season) {
    if (!state || typeof state !== "object") return [];
    var legacy = (Array.isArray(state.seasonLog) ? state.seasonLog : []).filter(function (row) {
      if (!row || typeof row !== "object" || Array.isArray(row)) return false;
      var value = row.season;
      return value == null || value === "" || finiteNumber(value) === season;
    }).map(function (row) {
      var copy = Object.assign({}, row);
      copy.season = finiteNumber(copy.season) || season;
      copy.scope = copy.scope || "league";
      return copy;
    });
    var career = (Array.isArray(state.careerMatchHistory) ? state.careerMatchHistory : []).filter(function (row) {
      return row && typeof row === "object" && !Array.isArray(row)
        && finiteNumber(row.season) === season;
    }).map(function (row) {
      var copy = Object.assign({}, row);
      copy.scope = copy.scope || "league";
      return copy;
    });
    // Prefer current careerMatchHistory snapshots when a legacy seasonLog row shares the same fixture ID.
    var combined = career.concat(legacy);
    if (window.LWCareer && typeof window.LWCareer.uniqueMatchRows === "function") {
      try { combined = window.LWCareer.uniqueMatchRows(combined); } catch (error) {}
    } else {
      var seen = Object.create(null);
      combined = combined.filter(function (row) {
        var key = String(row.id || row.matchId || [
          row.season, row.scope, row.competition, row.matchday, row.day,
          row.club, row.opponent, row.minutes, row.goals, row.assists
        ].map(function (value) { return value == null ? "" : String(value); }).join("|"));
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }
    return combined.filter(function (row) {
      var scope = String(row.scope || "league");
      return finiteNumber(row.season) === season && hasValidPlayingTime(row)
        && (scope === "league" || scope === "cup");
    });
  }

  function measure(state, objectiveId, seasonOverride) {
    var definition = definitionFor(objectiveId);
    if (!definition) return { ok:false, reason:"unknown-objective", value:0, target:0, progress:0, complete:false };
    var season = Math.max(1, finiteNumber(seasonOverride) || currentSeason(state));
    var rows = rowsForSeason(state, season);
    var value = 0, ratingCount = 0, ratingTotal = 0;
    if (definition.metric === "averageRating") {
      rows.forEach(function (row) {
        var rating = finiteNumber(row.rating);
        if (rating !== null && rating > 0) { ratingTotal += rating; ratingCount++; }
      });
      value = ratingCount ? ratingTotal / ratingCount : 0;
    } else {
      rows.forEach(function (row) {
        if (definition.metric === "cleanSheets") value += cleanSheet(row) ? 1 : 0;
        else if (definition.metric === "tackles") {
          value += stat(row, row.tacklesWon != null || row.stats && row.stats.tacklesWon != null ? "tacklesWon" : "tackles");
        } else if (definition.metric === "contributions") {
          value += stat(row, "goals") + stat(row, "assists");
        } else value += stat(row, definition.metric);
      });
    }
    var minimum = Number(definition.minimumAppearances) || 0;
    var complete = definition.metric === "averageRating"
      ? rows.length >= minimum && ratingCount >= minimum && value >= definition.target
      : value >= definition.target;
    var progress = definition.metric === "averageRating"
      ? Math.min(100, Math.round(Math.min(
          definition.target > 0 ? value / definition.target : 0,
          minimum > 0 ? rows.length / minimum : 1
        ) * 100))
      : Math.min(100, Math.round((definition.target > 0 ? value / definition.target : 0) * 100));
    return {
      ok:true, id:definition.id, season:season, metric:definition.metric, value:value,
      target:definition.target, progress:progress, complete:complete, appearances:rows.length,
      minimumAppearances:minimum, ratingCount:ratingCount, unit:definition.unit,
      valueText:definition.metric === "averageRating" ? value.toFixed(2) : String(Math.round(value))
    };
  }

  function persist(state, mutation, message) {
    var runtime = api();
    if (!runtime || typeof runtime.save !== "function") return { ok:false, reason:"save-unavailable" };
    var before = {
      objective:clone(state.seasonObjective),
      history:clone(state.seasonObjectiveHistory),
      money:state.money,
      morale:state.morale,
      diary:clone(state.diary)
    };
    try {
      mutation();
      if (runtime.save() === false) throw new Error("save-rejected");
    } catch (error) {
      if (before.objective === undefined) delete state.seasonObjective;
      else state.seasonObjective = before.objective;
      if (before.history === undefined) delete state.seasonObjectiveHistory;
      else state.seasonObjectiveHistory = before.history;
      state.money = before.money;
      state.morale = before.morale;
      if (before.diary === undefined) delete state.diary;
      else state.diary = before.diary;
      return { ok:false, reason:"save-failed" };
    }
    if (typeof runtime.render === "function") runtime.render();
    if (message && typeof runtime.toast === "function") runtime.toast(message);
    scheduleRefresh(true);
    return { ok:true };
  }

  function choose(state, objectiveId) {
    if (!state || typeof state !== "object") return { ok:false, reason:"invalid-state" };
    if (state.retired) return { ok:false, reason:"retired" };
    if (state.seasonFinished) return { ok:false, reason:"season-finished" };
    var season = currentSeason(state);
    var allowed = catalogForPosition(state.pos).some(function (item) { return item.id === String(objectiveId || ""); });
    if (!allowed) return { ok:false, reason:"objective-not-for-position" };
    var current = state.seasonObjective;
    var currentSeasonValue = current ? finiteNumber(current.season) : null;
    if (current && current.season != null && current.season !== "" && currentSeasonValue === null) {
      return { ok:false, reason:"invalid-current-objective" };
    }
    if (current && currentSeasonValue === season) return { ok:false, reason:"objective-already-selected" };
    var dayValue = finiteNumber(state.day);
    var createdDay = Math.max(1, dayValue || 1);
    return persist(state, function () {
      if (current && currentSeasonValue > 0 && currentSeasonValue < season) {
        state.seasonObjectiveHistory = Array.isArray(state.seasonObjectiveHistory) ? state.seasonObjectiveHistory : [];
        var exists = state.seasonObjectiveHistory.some(function (item) {
          return item && finiteNumber(item.season) === currentSeasonValue && String(item.id) === String(current.id);
        });
        if (!exists) {
          state.seasonObjectiveHistory.unshift(clone(current));
          state.seasonObjectiveHistory = state.seasonObjectiveHistory.slice(0, 20);
        }
      }
      state.seasonObjective = {
        id:String(objectiveId), season:season, claimed:false,
        createdDay:createdDay
      };
    }, "تم اعتماد هدفك للموسم. التقدم بيتحسب من مبارياتك الرسمية المسجلة.");
  }

  function objectiveRecordForSeason(state, season) {
    if (state.seasonObjective && finiteNumber(state.seasonObjective.season) === season) return state.seasonObjective;
    var history = Array.isArray(state.seasonObjectiveHistory) ? state.seasonObjectiveHistory : [];
    for (var i = 0; i < history.length; i++) {
      if (history[i] && finiteNumber(history[i].season) === season) return history[i];
    }
    return null;
  }

  function claim(state, seasonOverride) {
    if (!state || typeof state !== "object") return { ok:false, reason:"invalid-state" };
    var season = Math.max(1, finiteNumber(seasonOverride) || currentSeason(state));
    var objective = objectiveRecordForSeason(state, season);
    if (!objective) return { ok:false, reason:"no-objective" };
    if (objective.claimed) return { ok:false, reason:"already-claimed" };
    var definition = definitionFor(objective.id);
    if (!definition) return { ok:false, reason:"unknown-objective" };
    var progress = measure(state, objective.id, season);
    if (!progress.complete) return { ok:false, reason:"not-complete", progress:progress };
    var balanceValue = finiteNumber(state.money);
    var balance = balanceValue === null || balanceValue < 0 ? 0 : balanceValue;
    var moraleValue = finiteNumber(state.morale);
    var morale = moraleValue === null ? 0 : moraleValue;
    var dayValue = finiteNumber(state.day);
    var rewardDay = Math.max(1, dayValue || 1);
    return persist(state, function () {
      state.money = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(balance) + REWARD);
      state.morale = Math.max(0, Math.min(100, Math.round(morale + 5)));
      objective.claimed = true;
      objective.claimedDay = rewardDay;
      state.diary = Array.isArray(state.diary) ? state.diary : [];
      state.diary.unshift({
        season:season, day:rewardDay,
        type:"هدف موسمي",
        text:"أكملت تحدي الموسم: " + definition.title + " واستلمت مكافأة قدرها " + REWARD + " جنيه داخل اللعبة."
      });
      state.diary = state.diary.slice(0, 40);
    }, "مبروك! استلمت مكافأة الهدف الموسمي: 500 جنيه و5 نقاط معنويات.");
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char];
    });
  }

  function ensurePanel() {
    var page = $("page-stats");
    if (!page || typeof page.querySelector !== "function" || typeof document.createElement !== "function") return null;
    var grid = page.querySelector(".grid");
    if (!grid) return null;
    var host = $("lwSeasonObjectivePanel");
    if (!host) {
      host = document.createElement("article");
      host.id = "lwSeasonObjectivePanel";
      host.className = "card span12 lw-season-objectives";
      grid.appendChild(host);
    }
    if (!host.__lwObjectiveClickBound && typeof host.addEventListener === "function") {
      host.__lwObjectiveClickBound = true;
      host.addEventListener("click", function (event) {
        var target = event && event.target;
        var button = target && typeof target.closest === "function" ? target.closest("[data-season-objective-action]") : null;
        if (!button) return;
        var runtime = api();
        var state = runtime && typeof runtime.getState === "function" ? runtime.getState() : null;
        if (!state) return;
        var action = button.getAttribute("data-season-objective-action");
        var season = finiteNumber(button.getAttribute("data-objective-season")) || currentSeason(state);
        if (action === "choose") choose(state, button.getAttribute("data-objective-id"));
        else if (action === "claim") claim(state, season);
      });
    }
    return host;
  }

  function renderPanel(state) {
    var host = ensurePanel();
    if (!host || !state) return;
    host.hidden = !state.careerStarted;
    if (host.hidden) return;
    var season = currentSeason(state);
    var current = state.seasonObjective && finiteNumber(state.seasonObjective.season) === season ? state.seasonObjective : null;
    var html = '<div class="lw-objective-head"><div><span class="hub-overline">SEASON CHALLENGE / PLAYER TARGETS</span><h2>أهداف الموسم</h2><p>اختار تحديًا يناسب مركزك. التقدم بيتحسب من مباريات الدوري والكأس المسجلة فعلًا، مش من أرقام افتراضية.</p></div><span class="pill indigo">الموسم ' + season + '</span></div>';

    var archived = (Array.isArray(state.seasonObjectiveHistory) ? state.seasonObjectiveHistory : [])
      .map(function (item) {
        var itemSeason = item ? finiteNumber(item.season) : null;
        if (!item || item.claimed || itemSeason === null || itemSeason >= season || !definitionFor(item.id)) return null;
        var progress = measure(state, item.id, itemSeason);
        return progress.complete ? { item:item, progress:progress, season:itemSeason } : null;
      }).filter(Boolean);
    if (archived.length) {
      html += '<div class="lw-objective-archive"><b>مكافآت مواسم سابقة جاهزة</b>';
      archived.forEach(function (entry) {
        html += '<div class="lw-objective-archive-row"><span>الموسم ' + entry.season + ' · ' + escapeHTML(definitionFor(entry.item.id).title) + '</span><button type="button" class="btn" data-season-objective-action="claim" data-objective-season="' + entry.season + '">استلم 500 جنيه</button></div>';
      });
      html += '</div>';
    }

    if (current) {
      var definition = definitionFor(current.id);
      if (!definition) {
        html += '<div class="lw-objective-empty">التحدي المحفوظ غير معروف. بيانات المسيرة محفوظة كما هي، ومش هنستبدله تلقائيًا.</div>';
      } else {
        var progress = measure(state, definition.id, season);
        var targetText = definition.metric === "averageRating"
          ? "متوسط " + definition.target.toFixed(1) + " / 10 في " + definition.minimumAppearances + " مشاركة"
          : definition.target + " " + definition.unit;
        html += '<div class="lw-objective-active"><div class="lw-objective-active-copy"><div><span class="lw-objective-label">تحديك الحالي</span><h3>' + escapeHTML(definition.title) + '</h3><p>' + escapeHTML(definition.description) + '</p></div><strong class="lw-objective-value">' + progress.valueText + (definition.metric === "averageRating" ? " / " + definition.target.toFixed(1) : " / " + definition.target) + '</strong></div>';
        html += '<div class="lw-objective-meter"><div class="lw-objective-meter-fill" style="width:' + progress.progress + '%"></div></div>';
        html += '<div class="lw-objective-meta"><span>' + (definition.metric === "averageRating" ? progress.appearances + " / " + definition.minimumAppearances + " مشاركة" : targetText) + '</span><b>' + progress.progress + '%</b></div>';
        if (current.claimed) html += '<div class="lw-objective-complete">تم استلام مكافأة هذا التحدي بالفعل.</div>';
        else if (progress.complete) html += '<div class="lw-objective-ready"><span>وصلت لهدفك!</span><button type="button" class="btn primary" data-season-objective-action="claim" data-objective-season="' + season + '">استلم مكافأتك · 500</button></div>';
        else if (state.retired) html += '<div class="lw-objective-empty">انتهت المسيرة قبل اكتمال الهدف؛ مفيش مكافأة مستحقة.</div>';
        else html += '<div class="lw-objective-note">لسه قدامك فرصة تكمل التحدي. التقدم بيتحدث بعد كل مباراة.</div>';
      }
    } else if (state.retired) {
      html += '<div class="lw-objective-empty">المسيرة انتهت. تقدر تراجع أهدافك السابقة وتستلم أي مكافأة مكتملة لم تُستلم.</div>';
    } else if (!state.seasonFinished) {
      html += '<div class="lw-objective-grid">';
      catalogForPosition(state.pos).forEach(function (item) {
        var targetText = item.metric === "averageRating"
          ? "متوسط " + item.target.toFixed(1) + " / 10 في " + item.minimumAppearances + " مشاركة"
          : item.target + " " + item.unit;
        html += '<section class="lw-objective-option"><div><span class="lw-objective-label">' + escapeHTML(item.unit) + '</span><h3>' + escapeHTML(item.title) + '</h3><p>' + escapeHTML(item.description) + '</p><strong>' + targetText + '</strong></div><button type="button" class="btn" data-season-objective-action="choose" data-objective-id="' + escapeHTML(item.id) + '">اختار التحدي</button></section>';
      });
      html += '</div><p class="lw-objective-footnote">لكل موسم تحدٍ واحد فقط. تقدر تختار هدفًا جديدًا في الموسم التالي.</p>';
    } else {
      html += '<div class="lw-objective-empty">الموسم انتهى. أي هدف مكتمل تقدر تستلم مكافأته قبل بداية الموسم التالي.</div>';
    }
    if (host.innerHTML !== html) host.innerHTML = html;
  }

  function signature(state) {
    var season = currentSeason(state);
    var rows = rowsForSeason(state, season);
    var current = state.seasonObjective || null;
    var history = Array.isArray(state.seasonObjectiveHistory) ? state.seasonObjectiveHistory : [];
    var rowPart = rows.map(function (row) {
      return [
        String(row.id || row.matchId || ""), finiteNumber(row.season) || 0, String(row.scope || ""),
        finiteNumber(row.minutes) || 0, finiteNumber(row.goals) || 0, finiteNumber(row.assists) || 0,
        finiteNumber(row.rating) || 0, stat(row, "saves"), stat(row, "tacklesWon") || stat(row, "tackles"),
        stat(row, "interceptions"), stat(row, "keyPasses"), cleanSheet(row) ? 1 : 0
      ].join(":");
    }).join("|");
    return [
      season, String(state.pos || ""), state.retired ? 1 : 0, state.seasonFinished ? 1 : 0,
      JSON.stringify(current), JSON.stringify(history), rowPart
    ].join("~");
  }

  function refresh(force) {
    if (typeof document === "undefined" || !document || typeof document.getElementById !== "function") return;
    var runtime = api();
    var state = runtime && typeof runtime.getState === "function" ? runtime.getState() : null;
    if (!state) { lastSignature = ""; return; }
    var next = signature(state);
    if (!force && next === lastSignature) return;
    lastSignature = next;
    renderPanel(state);
  }

  function scheduleRefresh(force) {
    refreshQueued = refreshQueued || !!force;
    if (refreshQueued && !scheduleRefresh.pending) {
      scheduleRefresh.pending = true;
      Promise.resolve().then(function () {
        scheduleRefresh.pending = false;
        var shouldForce = refreshQueued;
        refreshQueued = false;
        refresh(shouldForce);
      });
    }
  }

  function start() {
    refresh(true);
    if (window.LWStateStore && typeof window.LWStateStore.subscribe === "function") {
      window.LWStateStore.subscribe(function () { scheduleRefresh(false); });
    }
    window.setInterval(function () { refresh(false); }, 2500);
    window.addEventListener("pageshow", function () { refresh(true); });
    window.addEventListener("storage", function () { refresh(true); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(true); });
  }

  window.LWSeasonObjectives = Object.freeze({
    catalogForPosition:catalogForPosition,
    measure:measure,
    choose:choose,
    claim:claim
  });

  if (document && typeof document.getElementById === "function") {
    if (document.readyState === "loading" && typeof document.addEventListener === "function") {
      document.addEventListener("DOMContentLoaded", start, { once:true });
    } else start();
  }
})();