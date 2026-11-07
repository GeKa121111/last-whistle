(function (global) {
  "use strict";

  var api = function () { return global.LWStoryRuntime || null; };
  var $ = function (id) { return document.getElementById(id); };
  var lastSignature = "";
  var lastWorldRef = null;
  var lastWorldKey = "";
  var cachedSeasonLines = [];
  var refreshQueued = false;

  function finiteNumber(value) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && value.trim() === "") return null;
    var valueNumber = Number(value);
    return Number.isFinite(valueNumber) ? valueNumber : null;
  }
  function num(value, fallback) {
    var safeFallback = Number.isFinite(fallback) ? fallback : 0;
    var parsed = finiteNumber(value);
    return parsed === null ? safeFallback : parsed;
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, num(value, 0)));
  }
  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char];
    });
  }
  function normalise(value) {
    var world = global.LWWorldAI;
    if (world && typeof world.normalize === "function") return world.normalize(value);
    return String(value == null ? "" : value).normalize("NFKC").toLowerCase()
      .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/[^\w\u0600-\u06FF]/g, "");
  }
  function seasonOf(state) {
    return Math.max(1, Math.floor(num(state && state.season, 1)));
  }
  // Only explicit numeric seasons (or genuinely missing legacy values) may enter current-season form.
  function currentSeasonForRow(row, season) {
    var rawSeason = row && row.season;
    if (rawSeason == null || (typeof rawSeason === "string" && rawSeason.trim() === "")) return season;
    if (typeof rawSeason !== "number" && typeof rawSeason !== "string") return null;
    return finiteNumber(rawSeason);
  }
  function roleGroup(position) {
    var world = global.LWWorldAI;
    if (world && typeof world.groupForPosition === "function") {
      try { return String(world.groupForPosition(position) || ""); } catch (error) {}
    }
    position = String(position || "");
    if (position === "حارس مرمى") return "goalkeeper";
    if (["قلب دفاع", "ظهير", "وسط دفاعي"].indexOf(position) >= 0) return "defender";
    if (["وسط", "وسط مهاجم"].indexOf(position) >= 0) return "midfielder";
    return "attacker";
  }
  function currentClub(state, world) {
    if (!world || !world.clubs || typeof world.clubs !== "object") return null;
    var name = String(state.clubName || state.club || "").trim();
    var country = String(state.leagueCountry || "").trim();
    if (!name) return null;
    var entries = Object.keys(world.clubs).map(function (id) {
      var club = world.clubs[id];
      return club ? Object.assign({ id:String(club.id || id) }, club) : null;
    }).filter(Boolean);
    return entries.find(function (club) {
      return normalise(club.name) === normalise(name)
        && (!country || !club.country || normalise(club.country) === normalise(country));
    }) || entries.find(function (club) {
      return normalise(club.name) === normalise(name);
    }) || null;
  }
  function clubIdentity(club) {
    if (!club) return "";
    var ai = global.LWWorldAI;
    if (ai && typeof ai.clubKey === "function") {
      try { return String(ai.clubKey(club.name, club.country)); } catch (error) {}
    }
    return normalise(club.country) + "|" + normalise(club.name);
  }
  function safeRows(state) {
    var season = seasonOf(state);
    var career = (Array.isArray(state.careerMatchHistory) ? state.careerMatchHistory : [])
      .filter(function (row) {
        return row && typeof row === "object" && !Array.isArray(row)
          && currentSeasonForRow(row, season) === season;
      }).map(function (row) {
        var copy = Object.assign({}, row);
        copy.scope = copy.scope || "league";
        copy.season = currentSeasonForRow(row, season);
        return copy;
      });
    // Legacy seasonLog is appended oldest-first; reverse it so formRows always start with the latest match.
    var legacy = (Array.isArray(state.seasonLog) ? state.seasonLog.slice().reverse() : [])
      .filter(function (row) {
        return row && typeof row === "object" && !Array.isArray(row)
          && currentSeasonForRow(row, season) === season;
      }).map(function (row) {
        var copy = Object.assign({}, row);
        copy.scope = copy.scope || "league";
        copy.season = currentSeasonForRow(row, season);
        return copy;
      });
    var combined = career.concat(legacy);
    var engine = global.LWCareer;
    if (engine && typeof engine.uniqueMatchRows === "function") {
      try { combined = engine.uniqueMatchRows(combined); } catch (error) {}
    } else {
      var seen = Object.create(null);
      combined = combined.filter(function (row) {
        var key = String(row.id || row.matchId || [
          row.season, row.scope, row.club, row.opponent, row.day,
          row.minutes, row.goals, row.assists, row.rating
        ].join("|"));
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }
    return combined.filter(function (row) {
      var scope = String(row.scope || "league");
      return currentSeasonForRow(row, season) === season && num(row.minutes) > 0
        && (scope === "league" || scope === "cup");
    });
  }
  function playerStats(rows) {
    var appearances = rows.length;
    var rated = rows.filter(function (row) { return num(row.rating) > 0; });
    var minutes = rows.reduce(function (sum, row) { return sum + Math.max(0, num(row.minutes)); }, 0);
    var goals = rows.reduce(function (sum, row) { return sum + Math.max(0, num(row.goals)); }, 0);
    var assists = rows.reduce(function (sum, row) { return sum + Math.max(0, num(row.assists)); }, 0);
    var averageRating = rated.length
      ? rated.reduce(function (sum, row) { return sum + num(row.rating); }, 0) / rated.length : 0;
    return {
      appearances:appearances, minutes:minutes, goals:goals, assists:assists,
      averageRating:averageRating, ratedAppearances:rated.length,
      formRows:rows.slice(0, 4)
    };
  }
  function getSeasonLines(state, world) {
    var ai = global.LWWorldAI;
    if (!ai || typeof ai.getSeasonLines !== "function" || !world) return [];
    var progress = clamp(
      num(state.seasonApps) / Math.max(1, num(state.seasonAppsTarget, 34)), 0, 1
    );
    var key = [
      seasonOf(state), Math.round(progress * 1000),
      num(world.projectionRevision), num(world.rosterMembershipSchemaVersion),
      Object.keys(world.players || {}).length, Object.keys(world.clubs || {}).length
    ].join("|");
    if (world === lastWorldRef && key === lastWorldKey) return cachedSeasonLines;
    try {
      cachedSeasonLines = ai.getSeasonLines(state, seasonOf(state), progress, global.LWWorldDB) || [];
    } catch (error) {
      cachedSeasonLines = [];
    }
    lastWorldRef = world;
    lastWorldKey = key;
    return cachedSeasonLines;
  }
  function lineMap(lines) {
    var result = Object.create(null);
    (Array.isArray(lines) ? lines : []).forEach(function (line) {
      if (line && line.id != null) result[String(line.id)] = line;
    });
    return result;
  }
  function lineStats(line, player) {
    line = line || {};
    var display = line.displayStats && typeof line.displayStats === "object" ? line.displayStats : line;
    return {
      appearances:Math.max(0, num(display.appearances, num(line.appearances))),
      goals:Math.max(0, num(display.goals, num(line.goals))),
      assists:Math.max(0, num(display.assists, num(line.assists))),
      averageRating:Math.max(0, num(display.averageRating, num(line.averageRating, num(player && player.lastRating))))
    };
  }
  function teammateLeadershipScore(player, stats) {
    var age = Math.max(16, Math.min(38, num(player.age, 22)));
    return Number((
      clamp(player.ovr, 35, 99) * 0.48
      + clamp((age - 17) * 0.42, 0, 9)
      + clamp(player.prestige, 0, 100) * 0.10
      + clamp(stats.averageRating, 0, 10) * 1.1
      + clamp(stats.appearances, 0, 50) * 0.07
    ).toFixed(2));
  }
  function playerLeadershipScore(state, overall, stats) {
    var age = Math.max(12, Math.min(40, num(state.age, 18)));
    return clamp(Number((
      clamp(overall, 0, 100) * 0.48
      + clamp((age - 17) * 0.42, 0, 9)
      + clamp(state.trust, 0, 100) * 0.14
      + clamp(state.professionalism, 0, 100) * 0.12
      + clamp(state.teamChemistry, 0, 100) * 0.08
      + clamp(stats.averageRating, 0, 10) * 1.1
      + clamp(stats.appearances, 0, 50) * 0.07
    ).toFixed(2)), 0, 100);
  }
  function rivalScore(stats, player) {
    return Number((
      clamp(stats.averageRating, 0, 10) * 10
      + clamp(stats.goals, 0, 60) * 0.8
      + clamp(stats.assists, 0, 40) * 0.55
      + clamp(stats.appearances, 0, 60) * 0.1
      + clamp(player.ovr, 35, 99) * 0.08
    ).toFixed(2));
  }
  function buildSnapshot(state) {
    if (!state || !state.careerStarted) return { ready:false, reason:"career-not-started" };
    var world = state.worldSimulation;
    if (!world || typeof world !== "object" || !world.clubs || !world.players) {
      return { ready:false, reason:"world-not-ready" };
    }
    var ai = global.LWWorldAI;
    if (!ai || typeof ai.rosterPlayers !== "function") return { ready:false, reason:"world-api-unavailable" };
    var club = currentClub(state, world);
    if (!club) return { ready:false, reason:"club-not-found" };
    var roster = [];
    try { roster = ai.rosterPlayers(world, club) || []; } catch (error) { roster = []; }
    roster = roster.filter(function (player) {
      return player && player.id != null && String(player.name || "").trim();
    });
    if (!roster.length) return { ready:false, reason:"roster-empty", club:club };
    var rows = safeRows(state);
    var stats = playerStats(rows);
    var runtime = api();
    var overall = 0;
    try { overall = runtime && typeof runtime.overall === "function" ? runtime.overall() : num(state.ovr, 50); }
    catch (error) { overall = num(state.ovr, 50); }
    overall = clamp(overall || state.ovr || 50, 1, 99);
    var myLeadership = playerLeadershipScore(state, overall, stats);
    var group = roleGroup(state.pos);
    var lines = getSeasonLines(state, world);
    var byId = lineMap(lines);
    var enriched = roster.map(function (player) {
      var line = byId[String(player.id)] || null;
      var current = lineStats(line, player);
      return {
        id:String(player.id), name:String(player.name), position:String(player.position || ""),
        group:String(player.group || roleGroup(player.position)), ovr:clamp(player.ovr, 35, 99),
        age:Math.max(16, num(player.age, 22)), prestige:clamp(player.prestige, 0, 100),
        isGenerated:!!(player.isGenerated || player.isRealPlayer === false),
        stats:current, leadershipScore:teammateLeadershipScore(player, current),
        rivalryScore:rivalScore(current, player)
      };
    });
    var leader = enriched.slice().sort(function (a, b) {
      return b.leadershipScore - a.leadershipScore || b.ovr - a.ovr || a.name.localeCompare(b.name, "ar");
    })[0] || null;
    var rivals = enriched.filter(function (player) { return player.group === group; }).sort(function (a, b) {
      var aAbove = a.ovr >= overall ? 0 : 1, bAbove = b.ovr >= overall ? 0 : 1;
      return aAbove - bAbove || Math.abs(a.ovr - overall) - Math.abs(b.ovr - overall)
        || b.leadershipScore - a.leadershipScore || a.name.localeCompare(b.name, "ar");
    });
    var leadership = state.teamLeadership && typeof state.teamLeadership === "object"
      ? state.teamLeadership : {};
    var clubKey = clubIdentity(club);
    var selectedRivalId = String(leadership.rivalId || "");
    var rival = rivals.find(function (player) { return player.id === selectedRivalId; }) || rivals[0] || null;
    var challenge = leadership.challenge && typeof leadership.challenge === "object"
      ? leadership.challenge : null;
    var activeChallenge = challenge && challenge.clubKey === clubKey
      && finiteNumber(challenge.season) === seasonOf(state) ? challenge : null;
    var activeCaptain = leadership.activeCaptain && typeof leadership.activeCaptain === "object"
      ? leadership.activeCaptain : null;
    var isCaptain = !!(activeCaptain && activeCaptain.clubKey === clubKey);
    var challengeMatches = activeChallenge
      ? Math.max(0, stats.appearances - Math.max(0, num(activeChallenge.startAppearances))) : 0;
    var recentRows = stats.formRows.filter(function (row) { return num(row.rating) > 0; });
    var recentAverage = recentRows.length
      ? recentRows.reduce(function (sum, row) { return sum + num(row.rating); }, 0) / recentRows.length : 0;
    var captainGap = leader ? myLeadership - leader.leadershipScore : 0;
    var progressMatches = activeChallenge ? clamp(challengeMatches / 4 * 100, 0, 100) : 0;
    var progressScore = leader ? clamp((myLeadership / Math.max(1, leader.leadershipScore * 0.92)) * 100, 0, 100) : 0;
    var progress = activeChallenge ? Math.round(Math.min(progressMatches, progressScore)) : 0;
    var readyToRequest = !state.retired && !state.academyCareer && !state.academyReserve
      && !state.seasonFinished && !isCaptain && !activeChallenge
      && num(state.age) >= 18 && stats.appearances >= 8
      && num(state.trust) >= 50 && num(state.professionalism) >= 60
      && stats.averageRating >= 6.4;
    var requestReason = state.retired ? "المسيرة انتهت."
      : state.academyCareer || state.academyReserve ? "تحدي القيادة متاح بعد الانتقال للمنافسات الاحترافية."
      : num(state.age) < 18 ? "محتاج توصل إلى 18 سنة قبل طلب شارة قيادة الفريق الأول."
      : stats.appearances < 8 ? "محتاج 8 مشاركات رسمية على الأقل مع النادي."
      : num(state.trust) < 50 ? "ثقة الجهاز الفني لازم توصل إلى 50 على الأقل."
      : num(state.professionalism) < 60 ? "محتاج احترافية 60 على الأقل."
      : stats.averageRating < 6.4 ? "متوسط تقييمك الرسمي لازم يوصل إلى 6.4."
      : state.seasonFinished ? "ابدأ التحدي مع بداية الموسم التالي."
      : "";
    var recentFour = stats.formRows.slice(0, 4).filter(function (row) { return num(row.minutes) > 0 && num(row.rating) > 0; });
    var challengeReady = !!(activeChallenge && !isCaptain && leader
      && challengeMatches >= 4 && recentFour.length >= 4
      && recentFour.reduce(function (sum, row) { return sum + num(row.rating); }, 0) / recentFour.length >= 6.8
      && num(state.trust) >= 60 && num(state.professionalism) >= 65
      && myLeadership >= leader.leadershipScore * 0.92);
    var myRivalryScore = Number((
      stats.averageRating * 10 + stats.goals * 0.8 + stats.assists * 0.55
      + stats.appearances * 0.1 + overall * 0.08
    ).toFixed(2));
    var rivalDifference = rival ? Number((myRivalryScore - rival.rivalryScore).toFixed(2)) : 0;
    return {
      ready:true, club:club, clubKey:clubKey, clubName:String(club.name || state.clubName || ""),
      season:seasonOf(state), positionGroup:group, overall:overall, stats:stats,
      leadershipScore:myLeadership, leader:leader, leaderGap:Number(captainGap.toFixed(2)),
      challenge:activeChallenge, isCaptain:isCaptain, activeCaptain:activeCaptain,
      challengeMatches:challengeMatches, challengeProgress:progress,
      challengeReady:challengeReady, readyToRequest:readyToRequest, requestReason:requestReason,
      rival:rival, rivals:rivals, rivalDifference:rivalDifference,
      rivalryStatus:!rival || !stats.appearances ? "waiting"
        : rivalDifference >= 2.5 ? "ahead" : rivalDifference <= -2.5 ? "behind" : "level",
      worldSeason:Math.max(1, num(world.currentSeason, seasonOf(state)))
    };
  }
  function clone(value) {
    if (value === undefined) return undefined;
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return value; }
  }
  function persist(state, mutation, message) {
    var runtime = api();
    if (!runtime || typeof runtime.save !== "function") return { ok:false, reason:"save-unavailable" };
    var before = {
      teamLeadership:clone(state.teamLeadership),
      teamChemistry:state.teamChemistry, morale:state.morale, diary:clone(state.diary)
    };
    try {
      mutation();
      if (runtime.save() === false) throw new Error("save-rejected");
    } catch (error) {
      if (before.teamLeadership === undefined) delete state.teamLeadership;
      else state.teamLeadership = before.teamLeadership;
      state.teamChemistry = before.teamChemistry;
      state.morale = before.morale;
      if (before.diary === undefined) delete state.diary;
      else state.diary = before.diary;
      return { ok:false, reason:"save-failed" };
    }
    try { if (typeof runtime.render === "function") runtime.render(); } catch (error) {}
    try { if (message && typeof runtime.toast === "function") runtime.toast(message); } catch (error) {}
    scheduleRefresh(true);
    return { ok:true };
  }
  function requestCaptaincy(state) {
    var view = buildSnapshot(state);
    if (!view.ready) return { ok:false, reason:view.reason };
    if (view.isCaptain) return { ok:false, reason:"already-captain" };
    if (view.challenge) return { ok:false, reason:"challenge-already-active" };
    if (!view.readyToRequest) return { ok:false, reason:"not-eligible", message:view.requestReason };
    return persist(state, function () {
      var leadership = state.teamLeadership && typeof state.teamLeadership === "object"
        ? state.teamLeadership : {};
      leadership.challenge = {
        clubKey:view.clubKey, clubName:view.clubName, season:view.season,
        startedDay:Math.max(1, num(state.day, 1)),
        startAppearances:view.stats.appearances,
        startLeadershipScore:view.leadershipScore,
        leaderId:view.leader ? view.leader.id : "",
        leaderName:view.leader ? view.leader.name : ""
      };
      state.teamLeadership = leadership;
    }, "بدأت منافستك على شارة القيادة. أثبت استحقاقك في أربع مباريات رسمية على الأقل.");
  }
  function claimCaptaincy(state) {
    var view = buildSnapshot(state);
    if (!view.ready) return { ok:false, reason:view.reason };
    if (view.isCaptain) return { ok:false, reason:"already-captain" };
    if (!view.challenge) return { ok:false, reason:"no-active-challenge" };
    if (!view.challengeReady) return { ok:false, reason:"challenge-not-complete" };
    return persist(state, function () {
      var leadership = state.teamLeadership && typeof state.teamLeadership === "object"
        ? state.teamLeadership : {};
      var record = {
        clubKey:view.clubKey, clubName:view.clubName, season:view.season,
        appointedDay:Math.max(1, num(state.day, 1)),
        previousLeaderId:view.leader ? view.leader.id : "",
        previousLeaderName:view.leader ? view.leader.name : ""
      };
      leadership.activeCaptain = record;
      leadership.captainHistory = Array.isArray(leadership.captainHistory) ? leadership.captainHistory : [];
      leadership.captainHistory.unshift(clone(record));
      leadership.captainHistory = leadership.captainHistory.slice(0, 10);
      leadership.challenge = null;
      state.teamLeadership = leadership;
      state.teamChemistry = clamp(num(state.teamChemistry, 50) + 4, 0, 100);
      state.morale = clamp(num(state.morale, 50) + 3, 0, 100);
      state.diary = Array.isArray(state.diary) ? state.diary : [];
      state.diary.unshift({
        season:view.season, day:Math.max(1, num(state.day, 1)),
        type:"شارة القيادة",
        text:"أصبحت قائد " + view.clubName + " بعد اجتياز تحدي القيادة وتحقيق متطلبات الأداء والثقة."
      });
      state.diary = state.diary.slice(0, 40);
    }, "مبروك! كسبت شارة قيادة " + view.clubName + ". زادت كيمياء الفريق والمعنويات.");
  }
  function selectRival(state) {
    var view = buildSnapshot(state);
    if (!view.ready) return { ok:false, reason:view.reason };
    if (view.rivals.length < 2) return { ok:false, reason:"not-enough-rivals" };
    var current = view.rival ? view.rivals.findIndex(function (item) { return item.id === view.rival.id; }) : -1;
    var next = view.rivals[(current + 1 + view.rivals.length) % view.rivals.length];
    return persist(state, function () {
      var leadership = state.teamLeadership && typeof state.teamLeadership === "object"
        ? state.teamLeadership : {};
      leadership.rivalId = next.id;
      state.teamLeadership = leadership;
    }, "تم تغيير المنافس المباشر إلى " + next.name + ".");
  }
  function ensurePanel() {
    var page = $("page-contract");
    if (!page || typeof page.querySelector !== "function" || typeof document.createElement !== "function") return null;
    var grid = page.querySelector(".grid");
    if (!grid) return null;
    var host = $("lwTeamDynamicsPanel");
    if (!host) {
      host = document.createElement("article");
      host.id = "lwTeamDynamicsPanel";
      host.className = "card span12 lw-team-dynamics";
      if (grid.children && grid.children.length > 1) grid.insertBefore(host, grid.children[2] || null);
      else grid.appendChild(host);
    }
    if (!host.__lwTeamDynamicsBound && typeof host.addEventListener === "function") {
      host.__lwTeamDynamicsBound = true;
      host.addEventListener("click", function (event) {
        var target = event && event.target;
        var button = target && typeof target.closest === "function"
          ? target.closest("[data-team-dynamics-action]") : null;
        if (!button) return;
        var runtime = api();
        var state = runtime && typeof runtime.getState === "function" ? runtime.getState() : null;
        if (!state) return;
        var action = button.getAttribute("data-team-dynamics-action");
        if (action === "request-captaincy") requestCaptaincy(state);
        else if (action === "claim-captaincy") claimCaptaincy(state);
        else if (action === "select-rival") selectRival(state);
      });
    }
    return host;
  }
  function renderPanel(state) {
    var host = ensurePanel();
    if (!host) return;
    host.hidden = !state || !state.careerStarted;
    if (host.hidden) return;
    var view = buildSnapshot(state);
    var html = '<div class="lw-team-head"><div><span class="hub-overline">DRESSING ROOM / LEADERSHIP</span><h2>غرفة الملابس</h2><p>القيادة والمنافسة على مركزك مبنيتان على تشكيلتك وأدائك المحفوظ.</p></div><span class="pill indigo">الموسم ' + seasonOf(state) + '</span></div>';
    if (!view.ready) {
      var messages = {
        "world-not-ready":"قاعدة عالم الكرة لسه بتجهز. لوحة القيادة هتظهر أول ما بيانات النادي تكتمل.",
        "world-api-unavailable":"خدمات تشكيلات عالم الكرة غير متاحة حاليًا.",
        "club-not-found":"ملقيناش تشكيلتك الحالية داخل قاعدة عالم الكرة. مش هننشئ لاعبين بدلاء من عندنا.",
        "roster-empty":"مفيش قائمة لاعبين متاحة للنادي حاليًا."
      };
      html += '<div class="lw-team-empty">' + escapeHTML(messages[view.reason] || "بيانات الفريق غير متاحة حاليًا.") + '</div>';
      if (host.innerHTML !== html) host.innerHTML = html;
      return;
    }
    var leader = view.leader;
    html += '<div class="lw-team-grid">';
    html += '<section class="lw-team-card"><div class="lw-team-card-head"><span class="lw-team-kicker">TEAM LEADER / مرشح القيادة</span><span class="pill gold">أعلى مؤشر قيادة</span></div>';
    if (leader) {
      html += '<h3>' + escapeHTML(leader.name) + '</h3><p>' + escapeHTML(leader.position || "مركز غير محدد")
        + ' · تقييم ' + leader.ovr + ' · ' + leader.age + ' سنة</p>';
      html += '<div class="lw-team-statline"><span>مؤشر القيادة التقديري</span><b>' + leader.leadershipScore + '/100</b></div>';
      html += '<small>' + (leader.isGenerated ? 'لاعب مولّد داخل محاكاة النادي' : 'لاعب من قائمة النادي المسجلة') + '</small>';
    } else html += '<div class="lw-team-empty">لا يوجد مرشح قيادة قابل للعرض.</div>';
    html += '<p class="lw-team-disclaimer">ده ترشيح حسابي من التقييم والعمر والسمعة وأداء الموسم، مش إعلان عن قائد رسمي مسجل في بيانات النادي.</p>';
    if (view.isCaptain) {
      html += '<div class="lw-team-success">أنت قائد ' + escapeHTML(view.clubName)
        + ' · تم التعيين في الموسم ' + escapeHTML(view.activeCaptain.season) + '</div>';
    } else if (view.challenge) {
      html += '<div class="lw-team-challenge"><div class="lw-team-statline"><span>تحدي شارة القيادة</span><b>' + view.challengeProgress + '%</b></div>';
      html += '<div class="lw-team-meter"><span style="width:' + view.challengeProgress + '%"></span></div>';
      html += '<p>مشاركات بعد بداية التحدي: ' + view.challengeMatches + ' / 4 · الفارق عن مرشح القيادة: '
        + (view.leaderGap >= 0 ? '+' : '') + view.leaderGap.toFixed(1) + '</p>';
      if (view.challengeReady) html += '<button type="button" class="btn primary" data-team-dynamics-action="claim-captaincy">اقبل شارة القيادة</button>';
      else html += '<small>للاستحقاق: 4 مشاركات جديدة، متوسط آخر 4 مباريات 6.8، ثقة 60، احترافية 65 ومؤشر قيادة قريب من المرشح الحالي.</small>';
      html += '</div>';
    } else if (view.readyToRequest) {
      html += '<button type="button" class="btn primary" data-team-dynamics-action="request-captaincy">ابدأ التنافس على شارة القيادة</button>';
    } else {
      html += '<div class="lw-team-eligibility">لسه مش مستوفي شروط طلب الشارة: ' + escapeHTML(view.requestReason) + '</div>';
    }
    html += '</section>';

    html += '<section class="lw-team-card"><div class="lw-team-card-head"><span class="lw-team-kicker">POSITION RIVAL / منافسك المباشر</span><span class="pill">نفس مجموعة مركزك</span></div>';
    if (view.rival) {
      var rival = view.rival;
      html += '<h3>' + escapeHTML(rival.name) + '</h3><p>' + escapeHTML(rival.position || "مركز غير محدد")
        + ' · تقييم ' + rival.ovr + ' · ' + rival.age + ' سنة</p>';
      html += '<div class="lw-team-duel"><div><span>أنت</span><b>' + view.stats.averageRating.toFixed(2) + '</b><small>متوسط تقييمك</small></div><div class="lw-team-versus">VS</div><div><span>المنافس</span><b>' + rival.stats.averageRating.toFixed(2) + '</b><small>تقييمه الموسمي المتوقع</small></div></div>';
      html += '<div class="lw-team-rival-status">' + (view.rivalryStatus === "ahead" ? "أنت متقدم في سباق الموسم"
        : view.rivalryStatus === "behind" ? "المنافس متقدم في سباق الموسم"
        : view.rivalryStatus === "level" ? "المنافسة متقاربة"
        : "بانتظار مشاركات رسمية للمقارنة") + '</div>';
      html += '<small>' + (rival.isGenerated ? 'بيانات المنافس مولّدة داخل محاكاة النادي' : 'بيانات المنافس من قائمة النادي المسجلة')
        + ' · ' + rival.stats.appearances + ' مشاركة محاكاة · ' + rival.stats.goals + ' هدف · ' + rival.stats.assists + ' صناعة</small>';
      if (view.rivals.length > 1) html += '<button type="button" class="btn" data-team-dynamics-action="select-rival">اختار منافسًا آخر</button>';
    } else {
      html += '<div class="lw-team-empty">لا توجد بيانات كافية للاعب آخر من مجموعة مركزك في قائمة النادي.</div>';
    }
    html += '<p class="lw-team-disclaimer">أرقام زميلك محاكاة للموسم من محرك عالم الكرة، وليست إحصاءات رسمية حية. المقارنة لا تغيّر نتائج المباريات.</p>';
    html += '</section></div>';
    if (state.retired) html += '<div class="lw-team-footnote">المسيرة انتهت؛ لوحة الفريق للرجوع إلى سجل القيادة والمنافسة فقط.</div>';
    if (host.innerHTML !== html) host.innerHTML = html;
  }
  function signature(state) {
    if (!state) return "";
    // Match-history rows are sometimes updated in place, so their array length
    // cannot invalidate this panel. The state-store revision changes on every
    // published career mutation and gives this lightweight renderer a safe key.
    var stateRevision = -1;
    try {
      var store = global.LWStateStore;
      if (store && typeof store.getRevision === "function") stateRevision = num(store.getRevision(), -1);
    } catch (error) {}
    return [
      stateRevision,
      !!state.careerStarted, !!state.retired, state.currentPage || "",
      state.name || "", state.clubName || "", state.leagueCountry || "",
      state.season, state.day, state.pos, state.age, state.overall,
      state.trust, state.professionalism, state.teamChemistry, state.morale,
      state.seasonApps, state.seasonAppsTarget, state.seasonFinished,
      JSON.stringify(state.teamLeadership || {}),
      state.worldSimulation && state.worldSimulation.projectionRevision,
      state.worldSimulation && Object.keys(state.worldSimulation.players || {}).length,
      (Array.isArray(state.careerMatchHistory) ? state.careerMatchHistory.length : 0),
      (Array.isArray(state.seasonLog) ? state.seasonLog.length : 0)
    ].join("|");
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
    if (global.LWStateStore && typeof global.LWStateStore.subscribe === "function") {
      global.LWStateStore.subscribe(function () { scheduleRefresh(false); });
    }
    global.setInterval(function () { refresh(false); }, 5000);
    global.addEventListener("pageshow", function () { refresh(true); });
    global.addEventListener("storage", function () { refresh(true); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(true); });
  }

  global.LWTeamDynamics = Object.freeze({
    snapshot:buildSnapshot,
    requestCaptaincy:requestCaptaincy,
    claimCaptaincy:claimCaptaincy,
    selectRival:selectRival
  });

  if (typeof document !== "undefined" && document && typeof document.getElementById === "function") {
    if (document.readyState === "loading" && typeof document.addEventListener === "function") {
      document.addEventListener("DOMContentLoaded", start, { once:true });
    } else start();
  }
})(window);