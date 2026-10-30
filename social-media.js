(function (window) {
  "use strict";

  var MAX_POSTS = 80;
  var MAX_COMMENTS = 5;
  var MAX_SEEN_ITEMS = 1000;
  var api = function () { return window.LWStoryRuntime || null; };
  var activeFilter = "all";
  var draft = "";
  var refreshTimer = 0;
  var lastRenderedSignature = "";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
  }

  function hash(value) {
    var text = String(value || "");
    var result = 2166136261;
    for (var i = 0; i < text.length; i++) {
      result ^= text.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function seeded(seed, max) {
    return max > 0 ? hash(seed) % max : 0;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>\"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch];
    });
  }

  function dayKey(state) {
    return String(Number(state.season) || 1) + ":" + String(Number(state.day) || 1);
  }

  function ensureState(state) {
    if (!state || typeof state !== "object") throw new TypeError("social-state-required");
    if (!state.socialMedia || typeof state.socialMedia !== "object" || Array.isArray(state.socialMedia)) {
      state.socialMedia = {
        version: 3, nextId: 1, initialized: false, posts: [],
        seen: { matches: [], press: [], relationships: [], transfers: [], awards: [], offers: [] },
        observedRole: String(state.role || ""),
        lockerRoomCrisisActive: Number(state.teamChemistry) <= 28,
        lastBenchStoryCalendarDay: 0, lastBenchStoryMatchId: "", lastReplyDay: ""
      };
    }
    var social = state.socialMedia;
    var previousVersion = Math.max(1, Number(social.version) || 1);
    social.nextId = Math.max(1, Number(social.nextId) || 1);
    if (!Array.isArray(social.posts)) social.posts = [];
    if (!social.seen || typeof social.seen !== "object" || Array.isArray(social.seen)) social.seen = {};
    var hadOfferCursor = Array.isArray(social.seen.offers);
    ["matches", "press", "relationships", "transfers", "awards", "offers"].forEach(function (key) {
      if (!Array.isArray(social.seen[key])) social.seen[key] = [];
      social.seen[key] = social.seen[key].filter(function (item) { return typeof item === "string"; }).slice(0, MAX_SEEN_ITEMS);
    });
    // Version 1 stored a shorter history; retain the existing safe migration.
    if (previousVersion < 2 && social.initialized) seedSeen(social, state);
    // Version 2 did not track offers or the new narrative baselines. Seed only
    // those new cursors so pre-existing events are never replayed.
    if (previousVersion < 3 && social.initialized) {
      if (!hadOfferCursor) {
        social.seen.offers = (Array.isArray(state.transferOffers) ? state.transferOffers : []).map(offerKey).filter(Boolean).slice(0, MAX_SEEN_ITEMS);
      }
      if (typeof social.observedRole !== "string" || !social.observedRole) social.observedRole = String(state.role || "");
      if (typeof social.lockerRoomCrisisActive !== "boolean") social.lockerRoomCrisisActive = Number(state.teamChemistry) <= 28;
      if (!Number(social.lastBenchStoryCalendarDay)) social.lastBenchStoryCalendarDay = Math.max(1, Number(state.calendarDay) || Number(state.day) || 1);
      if (!social.lastBenchStoryMatchId) {
        var oldDomestic = (Array.isArray(state.careerMatchHistory) ? state.careerMatchHistory : [])
          .filter(function (match) { return match && match.scope !== "international"; });
        social.lastBenchStoryMatchId = oldDomestic[0] ? String(oldDomestic[0].id || matchKey(oldDomestic[0])) : "";
      }
    }
    if (typeof social.observedRole !== "string") social.observedRole = String(state.role || "");
    if (typeof social.lockerRoomCrisisActive !== "boolean") social.lockerRoomCrisisActive = Number(state.teamChemistry) <= 28;
    social.lastBenchStoryCalendarDay = Math.max(0, Number(social.lastBenchStoryCalendarDay) || 0);
    social.lastBenchStoryMatchId = String(social.lastBenchStoryMatchId || "");
    social.version = 3;
    social.posts = social.posts.filter(function (post) {
      return post && typeof post === "object" && typeof post.body === "string";
    }).slice(0, MAX_POSTS);
    social.lastReplyDay = String(social.lastReplyDay || "");
    return social;
  }

  function matchKey(match) {
    if (!match || typeof match !== "object") return "";
    return [
      match.id || match.matchId || "",
      match.season || "",
      match.day || "",
      match.matchday || "",
      match.competition || "",
      match.club || "",
      match.opponent || "",
      match.teamGoals == null ? "" : match.teamGoals,
      match.oppGoals == null ? "" : match.oppGoals,
      match.minutes == null ? "" : match.minutes,
      match.rating == null ? "" : match.rating,
      match.goals == null ? "" : match.goals,
      match.assists == null ? "" : match.assists
    ].join("|");
  }

  function eventKey(item) {
    if (!item || typeof item !== "object") return "";
    return [
      item.id || item.eventId || "",
      item.season || "",
      item.day || "",
      item.type || item.title || item.name || "",
      item.text || item.choice || item.outcome || ""
    ].join("|");
  }

  function offerKey(offer) {
    if (!offer || typeof offer !== "object") return "";
    return String(offer.id || [offer.windowId || "", offer.country || "", offer.club || ""].join("|"));
  }

  function textSentiment(text) {
    var value = String(text || "").toLowerCase();
    if (/اعتذر|آسف|شكرا|شكرًا|ممتن|الجمهور|الفريق|زمايلي|زملائي|هنشتغل|هشتغل|التعب|الحمد/.test(value)) return 2;
    if (/ظلم|الحكم|تحكيم|مش هكمل|مش عاجبني|مش طايق|أستحق|استحق|أنا الأفضل|انا الافضل|المدرب مش فاهم|فضيحة|خيانة|جدل|أزمة|توتر|خلاف|مشادة|شائعة|تسريب|اتهام|غضب|رحيل/.test(value)) return -2;
    if (/تدريب|تطور|أتعلم|اتعلم|جاهز|مستمر|هدفي|حلمي|تركيز|شغل/.test(value)) return 1;
    return 0;
  }

  function matchSentiment(match) {
    var minutes = Math.max(0, Number(match.minutes) || 0);
    var rating = Number(match.rating) || 0;
    var goals = Math.max(0, Number(match.goals) || 0);
    var assists = Math.max(0, Number(match.assists) || 0);
    var score = minutes > 0 ? (rating - 6.4) * 0.65 + goals * 0.85 + assists * 0.55 : -0.7;
    var forGoals = Number(match.teamGoals) || 0;
    var against = Number(match.oppGoals) || 0;
    if (forGoals > against) score += 0.55;
    else if (forGoals < against) score -= 0.55;
    if (minutes > 0 && minutes < 25) score -= 0.2;
    return score >= 1.4 ? 2 : score >= 0.35 ? 1 : score <= -1.2 ? -2 : score <= -0.2 ? -1 : 0;
  }

  var commentPools = {
    positive: [
      "واضح إنك بترد في الملعب قبل الكلام.",
      "كمل يا نجم، المدرج معاك.",
      "اللي بيشتغل بجد بيبان مع الوقت.",
      "مستواك بيتحسن.. استمر بنفس العقلية.",
      "فرصتك جاية، خليك جاهز."
    ],
    neutral: [
      "الموسم لسه طويل، الحكم بدري.",
      "المهم الاستمرارية في المباريات الجاية.",
      "مستنيين نشوف الكلام ده على أرض الملعب.",
      "فيه حاجات إيجابية، ولسه فيه تفاصيل تتحسن.",
      "خلينا نشوف رد الفعل في اللقاء القادم."
    ],
    critical: [
      "الكلام كتير.. عايزين نشوف أداء أكتر.",
      "اللقطة الحلوة مش كفاية، محتاج تثبت نفسك.",
      "بلاش تصريحات قبل ما تحجز مكانك.",
      "الجمهور مستني منك ثبات أكتر.",
      "النهارده مش أفضل يوم ليك، عادي بس اتعلم."
    ]
  };

  var voices = [
    { author: "مشجع من المدرج", role: "مشجع", avatar: "🟢" },
    { author: "محلل كروي", role: "تحليل", avatar: "🎙️" },
    { author: "مراسل رياضي", role: "إعلام", avatar: "📰" },
    { author: "من داخل الفريق", role: "زميل", avatar: "👕" },
    { author: "مشجع منافس", role: "منافس", avatar: "⚽" }
  ];

  function buildComments(state, sourceKey, sentiment) {
    var mood = sentiment > 0 ? "positive" : sentiment < 0 ? "critical" : "neutral";
    var pool = commentPools[mood];
    var count = 3 + seeded(sourceKey + "|count", 3);
    var comments = [];
    for (var i = 0; i < count && i < MAX_COMMENTS; i++) {
      var voice = voices[seeded(sourceKey + "|voice|" + i, voices.length)];
      var line = pool[seeded(sourceKey + "|line|" + i, pool.length)];
      if (voice.role === "زميل" && sentiment > 0) line = "فخورين بيك يا صاحبي، كمل بنفس الروح.";
      if (voice.role === "منافس" && sentiment < 0) line = "لسه بدري على الكلام الكبير.. الملعب هو الحكم.";
      if (voice.role === "تحليل" && sentiment === 0) line = "المؤشرات متوازنة، والأهم تكرار المستوى.";
      comments.push({
        id: "c" + (i + 1),
        author: voice.author,
        role: voice.role,
        avatar: voice.avatar,
        body: line,
        likes: 1 + seeded(sourceKey + "|comment-likes|" + i, 34),
        sentiment: sentiment
      });
    }
    return comments;
  }

  function engagement(state, seed, sentiment) {
    var followers = Math.max(0, Number(state.followers) || 0);
    var rate = sentiment > 0 ? 0.035 : sentiment < 0 ? 0.048 : 0.025;
    var reach = Math.max(1, Math.round(followers * rate));
    return Math.min(999999, reach + seeded(seed + "|reach", Math.max(2, Math.round(reach * 0.7) + 1)));
  }

  function nextId(social) {
    var id = "post-" + social.nextId;
    social.nextId += 1;
    return id;
  }

  function makePost(state, options) {
    var social = ensureState(state);
    var id = nextId(social);
    var sentiment = Number(options.sentiment) || 0;
    var seed = id + "|" + options.body;
    var authorType = options.authorType || "media";
    return {
      id: id,
      kind: options.kind || "news",
      author: String(options.author || "صوت المدرج"),
      authorType: authorType,
      verified: authorType !== "player",
      avatar: String(options.avatar || (authorType === "player" ? "👤" : "📣")),
      body: String(options.body || ""),
      season: Math.max(1, Number(state.season) || 1),
      day: Math.max(1, Number(state.day) || 1),
      likes: engagement(state, seed, sentiment),
      liked: false,
      sentiment: sentiment,
      comments: buildComments(state, seed, sentiment)
    };
  }

  function addPost(state, options) {
    var social = ensureState(state);
    var post = makePost(state, options);
    social.posts.unshift(post);
    social.posts = social.posts.slice(0, MAX_POSTS);
    return post;
  }

  function createPlayerPost(state, text) {
    if (!state || !state.careerStarted || state.retired) return { ok: false, reason: "career-unavailable" };
    var body = String(text || "").trim();
    if (body.length < 3) return { ok: false, reason: "post-too-short" };
    if (body.length > 240) return { ok: false, reason: "post-too-long" };
    var social = ensureState(state);
    var today = dayKey(state);
    var todayPosts = social.posts.filter(function (post) {
      return post.authorType === "player" && String(post.season) + ":" + String(post.day) === today;
    }).length;
    if (todayPosts >= 2) return { ok: false, reason: "daily-post-limit" };

    var sentiment = textSentiment(body);
    var post = addPost(state, {
      kind: "player",
      authorType: "player",
      author: String(state.name || "أنت"),
      avatar: "👤",
      body: body,
      sentiment: sentiment
    });

    if (sentiment > 0) {
      state.mediaReputation = clamp((Number(state.mediaReputation) || 0) + 1, 0, 100);
      state.professionalism = clamp((Number(state.professionalism) || 0) + 1, 0, 100);
      state.followers = Math.max(0, (Number(state.followers) || 0) + 2 + seeded(post.id, 5));
    } else if (sentiment < 0) {
      state.mediaReputation = clamp((Number(state.mediaReputation) || 0) + 1, 0, 100);
      state.coachRelationship = clamp((Number(state.coachRelationship) || 35) - 1, 0, 100);
      state.followers = Math.max(0, (Number(state.followers) || 0) + 4 + seeded(post.id, 9));
    } else {
      state.followers = Math.max(0, (Number(state.followers) || 0) + 1 + seeded(post.id, 3));
    }
    return { ok: true, post: post };
  }

  function createMatchPost(state, match) {
    var name = String(state.name || "اللاعب");
    var opponent = String(match.opponent || "المنافس");
    var minutes = Math.max(0, Number(match.minutes) || 0);
    var rating = Number(match.rating) || 0;
    var goals = Math.max(0, Number(match.goals) || 0);
    var assists = Math.max(0, Number(match.assists) || 0);
    var forGoals = Number(match.teamGoals) || 0;
    var against = Number(match.oppGoals) || 0;
    var result = forGoals > against ? "فوز" : forGoals < against ? "خسارة" : "تعادل";
    var body;
    var sentiment = matchSentiment(match);
    if (!minutes) {
      body = "تساؤلات من الجماهير حول غياب " + name + " عن المشاركة أمام " + opponent + ". هل يحصل على فرصة في اللقاء القادم؟";
    } else if (goals || assists) {
      body = name + " يترك بصمته أمام " + opponent + " في " + result + " " + forGoals + "-" + against
        + (goals ? " بهدف" + (goals > 1 ? "ين" : "") : "")
        + (assists ? " وصناعة " + assists + " فرصة حاسمة" : "")
        + ". التقييم " + rating.toFixed(1) + "/10.";
    } else if (rating >= 7.5) {
      body = name + " يقدم مباراة قوية أمام " + opponent + " بتقييم " + rating.toFixed(1) + "/10، والجمهور يطالب باستمرار الفرصة.";
    } else if (rating > 0 && rating < 6) {
      body = "مباراة صعبة على " + name + " أمام " + opponent + ". الأنظار على رد فعله في التدريب والمواجهة القادمة.";
    } else {
      body = name + " شارك " + minutes + " دقيقة أمام " + opponent + " في " + result + " " + forGoals + "-" + against + ".";
    }
    var post = addPost(state, {
      kind: "match",
      author: "صوت المدرج",
      authorType: "media",
      avatar: "📣",
      body: body,
      sentiment: sentiment
    });
    return post;
  }

  function addEventPost(state, kind, item) {
    var name = String(state.name || "اللاعب");
    var title = String(item && (item.type || item.title || item.name) || "تطور جديد");
    var details = String(item && (item.text || item.outcome || item.choice) || "");
    var body = "";
    var author = "رادار الملاعب";
    var avatar = "📰";
    var sentiment = 0;
    var relationshipConflict = kind === "relationship"
      && /جدل|توتر|خلاف|مشادة|خصام|شكوى|اعتراض|تدهور|مشاكل|أزمة|غضب/.test(title + " " + details);
    if (relationshipConflict) {
      kind = "conflict";
      author = "كواليس غرفة الملابس";
      avatar = "👕";
      body = "حديث داخل النادي عن توتر في غرفة الملابس بعد «" + title + "». " + (details || "الأجواء محتاجة تهدئة قبل المباراة القادمة.");
      sentiment = -2;
    } else if (kind === "press") {
      author = "مراسل الملعب";
      avatar = "🎙️";
      body = name + " ظهر في حديث إعلامي بعنوان «" + title + "». الجمهور يناقش الرسالة اللي وصلت من التصريح.";
      sentiment = textSentiment(title + " " + details);
    } else if (kind === "relationship") {
      author = "من داخل النادي";
      avatar = "👕";
      body = "حديث داخل أروقة النادي بعد " + title + (details ? ": " + details : "") + ".";
      sentiment = 1;
    } else if (kind === "transfer") {
      author = "سوق الكرة اليوم";
      avatar = "🔁";
      body = "اسم " + name + " عاد للظهور في أخبار الانتقالات. " + (details || title) + ".";
      sentiment = 0;
    } else if (kind === "award") {
      author = "رادار المواهب";
      avatar = "🏅";
      body = "إنجاز جديد في مسيرة " + name + ": " + (details || title) + ". هل دي بداية مرحلة أكبر؟";
      sentiment = 2;
    }
    return addPost(state, { kind: kind, author: author, authorType: "media", avatar: avatar, body: body, sentiment: sentiment });
  }

  function createTransferRumorPost(state, offer) {
    var club = String(offer && offer.club || "").trim();
    if (!club || !offer || offer.status !== "pending") return null;
    var country = String(offer.country || "وجهة غير محددة");
    var league = String(offer.league || "الدوري المحلي");
    var role = String(offer.role || "دور لم يُحسم");
    var body = "رادار الانتقالات: " + club + " من " + country + " قدّم عرضًا رسميًا لضم "
      + String(state.name || "اللاعب") + " في " + league + ". الدور المقترح: " + role
      + ". العرض موجود في سوق اللعبة، والقرار لسه ما اتحسمش.";
    return addPost(state, {
      kind: "rumor", author: "رادار الانتقالات", authorType: "media", avatar: "🔁",
      body: body, sentiment: Number(state.lastRating) >= 6.8 ? 1 : 0
    });
  }

  function roleRank(value) {
    var role = String(value || "").trim();
    if (/نجم/.test(role)) return 5;
    if (/بديل أساسي/.test(role)) return 3;
    if (/أساسي/.test(role)) return 4;
    if (/تناوب|rotation/.test(role)) return 2;
    if (/بديل|احتياطي|رديف|ناشئ|صاعد|prospect/.test(role)) return 1;
    return 1;
  }

  function isBenchRole(value) {
    return /بديل|احتياطي|تناوب|رديف|تحت التقييم|ناشئ|صاعد/.test(String(value || ""));
  }

  function createRolePost(state, previousRole, nextRole) {
    var previous = String(previousRole || "دور سابق");
    var next = String(nextRole || "دور جديد");
    var improved = roleRank(next) > roleRank(previous);
    var body = improved
      ? "تطور جديد في مسيرة " + String(state.name || "اللاعب") + ": دور اللاعب داخل الفريق ارتفع من «" + previous + "» إلى «" + next + "». الجماهير مستنية تشوف التغيير ده في دقائق اللعب."
      : roleRank(next) < roleRank(previous)
        ? "تراجع دور " + String(state.name || "اللاعب") + " داخل الفريق من «" + previous + "» إلى «" + next + "». القرار فتح نقاشًا حول فرص المشاركة في الفترة الجاية."
        : "النادي غيّر توصيف دور " + String(state.name || "اللاعب") + " من «" + previous + "» إلى «" + next + "». تأثير القرار هيتحدد بالمشاركة والأداء.";
    return addPost(state, {
      kind: "role", author: "كواليس النادي", authorType: "media", avatar: "👕",
      body: body, sentiment: improved ? 2 : roleRank(next) < roleRank(previous) ? -1 : 0
    });
  }

  function createBenchPost(state, recentMatches, unusedCount) {
    var matchCount = Array.isArray(recentMatches) ? recentMatches.length : 0;
    var body = String(state.name || "اللاعب") + " لم يحصل على دقائق لعب في " + unusedCount
      + " من آخر " + matchCount + " مباريات. تراجع المشاركة يثير تساؤلات حول دوره الحالي «"
      + String(state.role || "بديل") + "» وفرصته في اللقاء القادم.";
    return addPost(state, {
      kind: "bench", author: "كواليس التشكيل", authorType: "media", avatar: "🪑",
      body: body, sentiment: -1
    });
  }

  function createLockerRoomPost(state) {
    var chemistry = clamp(state.teamChemistry, 0, 100);
    var coach = clamp(state.coachRelationship, 0, 100);
    var body = "مؤشر انسجام الفريق وصل إلى " + chemistry + "/100"
      + (coach <= 25 ? "، وعلاقتك بالجهاز الفني متوترة كمان" : "")
      + ". ده فتح نقاشات عن أجواء غرفة الملابس والحاجة لتهدئة الخلافات قبل ما تأثر على الملعب.";
    return addPost(state, {
      kind: "conflict", author: "مصادر من داخل النادي", authorType: "media", avatar: "👕",
      body: body, sentiment: -2
    });
  }

  function seedSeen(social, state) {
    var matches = Array.isArray(state.careerMatchHistory) ? state.careerMatchHistory : [];
    var press = Array.isArray(state.pressHistory) ? state.pressHistory : [];
    var relationships = Array.isArray(state.relationshipHistory) ? state.relationshipHistory : [];
    var transfers = Array.isArray(state.transferHistory) ? state.transferHistory : [];
    var awards = (Array.isArray(state.careerAwards) ? state.careerAwards : []).concat(Array.isArray(state.trophyCabinet) ? state.trophyCabinet : []);
    social.seen.matches = matches.map(matchKey).filter(Boolean).slice(0, MAX_SEEN_ITEMS);
    social.seen.press = press.map(eventKey).filter(Boolean).slice(0, MAX_SEEN_ITEMS);
    social.seen.relationships = relationships.map(eventKey).filter(Boolean).slice(0, MAX_SEEN_ITEMS);
    social.seen.transfers = transfers.map(eventKey).filter(Boolean).slice(0, MAX_SEEN_ITEMS);
    var offers = Array.isArray(state.transferOffers) ? state.transferOffers : [];
    social.seen.awards = awards.map(eventKey).filter(Boolean).slice(0, MAX_SEEN_ITEMS);
    social.seen.offers = offers.map(offerKey).filter(Boolean).slice(0, MAX_SEEN_ITEMS);
    social.observedRole = String(state.role || "");
    social.lockerRoomCrisisActive = Number(state.teamChemistry) <= 28;
    social.lastBenchStoryCalendarDay = Math.max(1, Number(state.calendarDay) || Number(state.day) || 1);
    var domestic = (Array.isArray(state.careerMatchHistory) ? state.careerMatchHistory : [])
      .filter(function (match) { return match && match.scope !== "international"; });
    social.lastBenchStoryMatchId = domestic[0] ? String(domestic[0].id || matchKey(domestic[0])) : "";
    social.initialized = true;
  }

  function collectNew(state, key, items, keyFn, limit) {
    var social = ensureState(state);
    var seen = social.seen[key];
    var pending = [];
    (Array.isArray(items) ? items : []).forEach(function (item) {
      var token = keyFn(item);
      if (!token || seen.indexOf(token) >= 0) return;
      pending.push({ item: item, token: token });
    });
    // Histories are newest-first. Publish a bounded oldest-first batch so a
    // simulation that adds many events cannot silently discard the backlog.
    var ordered = pending.reverse();
    var count = limit === undefined ? ordered.length : Math.max(0, Math.floor(Number(limit) || 0));
    var selected = ordered.slice(0, count);
    selected.forEach(function (entry) { seen.unshift(entry.token); });
    social.seen[key] = seen.slice(0, MAX_SEEN_ITEMS);
    return selected;
  }

  function syncState(state) {
    if (!state || !state.careerStarted) return 0;
    var social = ensureState(state);
    if (!social.initialized) {
      seedSeen(social, state);
      return 0;
    }
    var created = 0;
    var matches = collectNew(state, "matches", state.careerMatchHistory, matchKey, 5);
    matches.forEach(function (entry) {
      createMatchPost(state, entry.item);
      created++;
    });

    var offersLimit = Math.max(0, Math.min(3, 8 - created));
    if (offersLimit > 0) {
      var offers = collectNew(state, "offers", state.transferOffers, offerKey, offersLimit);
      offers.forEach(function (entry) {
        if (entry.item && entry.item.status === "pending" && createTransferRumorPost(state, entry.item)) created++;
      });
    }

    [
      ["press", state.pressHistory, function (item) { return eventKey(item); }],
      ["relationship", state.relationshipHistory, function (item) { return eventKey(item); }],
      ["transfer", state.transferHistory, function (item) { return eventKey(item); }],
      ["award", (Array.isArray(state.careerAwards) ? state.careerAwards : []).concat(Array.isArray(state.trophyCabinet) ? state.trophyCabinet : []), function (item) { return eventKey(item); }]
    ].forEach(function (source) {
      if (created >= 8) return;
      var key = source[0] === "relationship" ? "relationships" : source[0] === "transfer" ? "transfers" : source[0] === "award" ? "awards" : "press";
      var pending = collectNew(state, key, source[1], source[2], 1);
      if (!pending.length) return;
      var item = pending[0].item;
      if (source[0] === "transfer" && /وصلت عروض انتقال رسمية/.test(String(item && item.text || ""))) return;
      addEventPost(state, source[0], item);
      created++;
    });

    var currentRole = String(state.role || "بديل");
    var previousRole = String(social.observedRole || currentRole);
    if (currentRole !== previousRole && created < 8) {
      createRolePost(state, previousRole, currentRole);
      social.observedRole = currentRole;
      created++;
    }

    var chemistry = clamp(state.teamChemistry, 0, 100);
    if (chemistry >= 40) social.lockerRoomCrisisActive = false;
    else if (chemistry <= 28 && !social.lockerRoomCrisisActive && created < 8) {
      createLockerRoomPost(state);
      social.lockerRoomCrisisActive = true;
      created++;
    }

    var careerMatches = Array.isArray(state.careerMatchHistory) ? state.careerMatchHistory : [];
    var recentDomestic = careerMatches.filter(function (match) { return match && match.scope !== "international"; }).slice(0, 3);
    var unusedCount = recentDomestic.filter(function (match) {
      return Math.max(0, Number(match.minutes) || 0) === 0 || match.playerAvailable === false;
    }).length;
    var calendarDay = Math.max(1, Number(state.calendarDay) || Number(state.day) || 1);
    var lastBenchDay = Math.max(0, Number(social.lastBenchStoryCalendarDay) || 0);
    var latestMatchId = recentDomestic[0] ? String(recentDomestic[0].id || matchKey(recentDomestic[0])) : "";
    if (created < 8 && recentDomestic.length === 3 && unusedCount >= 2 && isBenchRole(currentRole)
      && latestMatchId && latestMatchId !== social.lastBenchStoryMatchId
      && (!lastBenchDay || calendarDay - lastBenchDay >= 14)) {
      createBenchPost(state, recentDomestic, unusedCount);
      social.lastBenchStoryCalendarDay = calendarDay;
      social.lastBenchStoryMatchId = latestMatchId;
      created++;
    }

    if (created) {
      social.posts = social.posts.slice(0, MAX_POSTS);
      return created;
    }
    return 0;
  }

  function respond(state, postId, action) {
    var social = ensureState(state);
    var post = social.posts.find(function (item) { return item.id === postId; });
    if (!post) return { ok: false, reason: "post-not-found" };
    if (action === "like") {
      post.liked = !post.liked;
      post.likes = Math.max(0, (Number(post.likes) || 0) + (post.liked ? 1 : -1));
      return { ok: true, liked: post.liked };
    }
    if (post.playerResponse) return { ok: false, reason: "post-already-answered" };
    var rumorPost = post.kind === "rumor" || post.kind === "transfer";
    var lockerPost = post.kind === "conflict" || post.kind === "role" || post.kind === "bench";
    if ((action === "deny-rumor" || action === "fuel-rumor") && !rumorPost) return { ok: false, reason: "invalid-social-action" };
    if ((action === "support-team" || action === "fuel-conflict") && !lockerPost) return { ok: false, reason: "invalid-social-action" };
    if (["respect", "bold", "deny-rumor", "fuel-rumor", "support-team", "fuel-conflict"].indexOf(action) < 0) {
      return { ok: false, reason: "invalid-social-action" };
    }
    var today = dayKey(state);
    if (social.lastReplyDay === today) return { ok: false, reason: "daily-reply-limit" };
    social.lastReplyDay = today;
    post.playerResponse = action;
    post.playerResponseDay = today;

    if (action === "respect") {
      state.professionalism = clamp((Number(state.professionalism) || 0) + 1, 0, 100);
      state.mediaReputation = clamp((Number(state.mediaReputation) || 0) + 1, 0, 100);
      state.morale = clamp((Number(state.morale) || 0) + 1, 0, 100);
      return { ok: true, message: "رديت بهدوء؛ صورتك المهنية اتحسنت." };
    }
    if (action === "bold") {
      state.followers = Math.max(0, (Number(state.followers) || 0) + 10);
      state.mediaReputation = clamp((Number(state.mediaReputation) || 0) + 2, 0, 100);
      state.coachRelationship = clamp((Number(state.coachRelationship) || 35) - 3, 0, 100);
      state.trust = clamp((Number(state.trust) || 0) - 1, 0, 100);
      state.professionalism = clamp((Number(state.professionalism) || 0) - 2, 0, 100);
      return { ok: true, message: "ردك عمل ضجة، لكن المدرب مش بالضرورة يعجبه الأسلوب." };
    }
    if (action === "deny-rumor") {
      state.professionalism = clamp((Number(state.professionalism) || 0) + 2, 0, 100);
      state.mediaReputation = clamp((Number(state.mediaReputation) || 0) + 1, 0, 100);
      state.coachRelationship = clamp((Number(state.coachRelationship) || 35) + 2, 0, 100);
      state.teamChemistry = clamp((Number(state.teamChemistry) || 0) + 1, 0, 100);
      return { ok: true, message: "نفيت الشائعة بهدوء؛ صورتك المهنية وعلاقتك بالنادي اتحسنت." };
    }
    if (action === "fuel-rumor") {
      state.followers = Math.max(0, (Number(state.followers) || 0) + 18);
      state.mediaReputation = clamp((Number(state.mediaReputation) || 0) + 2, 0, 100);
      state.coachRelationship = clamp((Number(state.coachRelationship) || 35) - 4, 0, 100);
      state.trust = clamp((Number(state.trust) || 0) - 2, 0, 100);
      state.professionalism = clamp((Number(state.professionalism) || 0) - 2, 0, 100);
      return { ok: true, message: "لمّحت إنك منفتح على الرحيل؛ التفاعل زاد لكن النادي مش هيحب الضغط العلني." };
    }
    if (action === "support-team") {
      state.professionalism = clamp((Number(state.professionalism) || 0) + 1, 0, 100);
      state.teamChemistry = clamp((Number(state.teamChemistry) || 0) + 5, 0, 100);
      state.coachRelationship = clamp((Number(state.coachRelationship) || 35) + 1, 0, 100);
      if (state.teamChemistry >= 40) social.lockerRoomCrisisActive = false;
      return { ok: true, message: "اخترت تهدئة الأجواء ودعم الفريق؛ الانسجام اتحسن." };
    }
    if (action === "fuel-conflict") {
      state.followers = Math.max(0, (Number(state.followers) || 0) + 12);
      state.mediaReputation = clamp((Number(state.mediaReputation) || 0) + 2, 0, 100);
      state.teamChemistry = clamp((Number(state.teamChemistry) || 0) - 5, 0, 100);
      state.coachRelationship = clamp((Number(state.coachRelationship) || 35) - 2, 0, 100);
      state.morale = clamp((Number(state.morale) || 0) - 2, 0, 100);
      return { ok: true, message: "صعّدت الخلاف؛ التفاعل زاد لكن غرفة الملابس اتأثرت." };
    }
    return { ok: false, reason: "invalid-social-action" };
  }

  function visiblePosts(state) {
    var social = ensureState(state);
    if (activeFilter === "fans") return social.posts.filter(function (post) {
      return ["match", "relationship", "role", "bench", "conflict"].indexOf(post.kind) >= 0;
    });
    if (activeFilter === "transfers") return social.posts.filter(function (post) {
      return post.kind === "rumor" || post.kind === "transfer";
    });
    if (activeFilter === "media") return social.posts.filter(function (post) { return post.authorType === "media"; });
    if (activeFilter === "mine") return social.posts.filter(function (post) { return post.authorType === "player"; });
    return social.posts;
  }

  function render(state) {
    if (typeof document === "undefined") return;
    var feed = document.getElementById("lw-social-feed");
    if (!feed || !state) return;
    var social = ensureState(state);
    var rows = visiblePosts(state);
    var signature = [social.posts.length, social.posts[0] && social.posts[0].id, activeFilter, state.followers, state.mediaReputation, state.teamChemistry, state.coachRelationship, state.role, social.lastReplyDay, draft].join("|");
    if (signature === lastRenderedSignature && feed.dataset.ready === "true") return;
    lastRenderedSignature = signature;
    feed.dataset.ready = "true";
    var filters = document.getElementById("lw-social-filters");
    if (filters) {
      Array.prototype.forEach.call(filters.querySelectorAll("[data-sm-filter]"), function (button) {
        button.classList.toggle("active", button.getAttribute("data-sm-filter") === activeFilter);
      });
    }
    var followerNode = document.getElementById("lw-social-followers");
    var reputationNode = document.getElementById("lw-social-reputation");
    var postsNode = document.getElementById("lw-social-count");
    if (followerNode) followerNode.textContent = String(Math.max(0, Number(state.followers) || 0));
    if (reputationNode) reputationNode.textContent = String(clamp(state.mediaReputation, 0, 100)) + "/100";
    if (postsNode) postsNode.textContent = String(social.posts.filter(function (post) { return post.authorType === "player"; }).length);
    var composer = document.getElementById("lw-social-composer");
    if (composer && composer.value !== draft) composer.value = draft;
    var canPost = !!state.careerStarted && !state.retired;
    var postButton = document.getElementById("lw-social-submit");
    if (postButton) postButton.disabled = !canPost || !draft.trim() || draft.trim().length > 240;
    var status = document.getElementById("lw-social-status");
    if (status) status.textContent = canPost ? "الأخبار مبنية على أدائك ودورك وعروض السوق الفعلية — وردك ممكن يغيّر علاقتك بالنادي." : "ابدأ مسيرتك عشان تفتح حسابك على دوشة الملاعب.";
    if (!rows.length) {
      feed.innerHTML = '<div class="lwsocial-empty"><span>📱</span><strong>لسه مفيش دوشة هنا</strong><p>انشر أول بوست، أو العب مباراة عشان تشوف الجمهور والإعلام بيتكلموا عنك.</p></div>';
      return;
    }
    feed.innerHTML = rows.map(function (post) {
      var comments = (Array.isArray(post.comments) ? post.comments : []).slice(0, MAX_COMMENTS).map(function (comment) {
        return '<div class="lwsocial-comment"><span class="lwsocial-comment-avatar">' + esc(comment.avatar || "💬") + '</span><div><strong>' + esc(comment.author || "متابع") + ' <small>' + esc(comment.role || "متابع") + '</small></strong><p>' + esc(comment.body || "") + '</p><span class="lwsocial-comment-likes">♥ ' + clamp(comment.likes, 0, 999999) + '</span></div></div>';
      }).join("");
      var authorType = post.authorType === "player" ? "حساب اللاعب" : "حساب كروي";
      var badge = post.verified ? '<span class="lwsocial-verified">✓</span>' : "";
      var kindLabels = { match: "بعد المباراة", player: "بوست جديد", press: "تصريح", transfer: "انتقالات", rumor: "شائعة انتقال", role: "دورك في الفريق", bench: "دقائق اللعب", conflict: "غرفة الملابس", relationship: "داخل النادي", award: "إنجاز" };
      var kindClass = "lwsocial-kind-" + String(post.kind || "news").replace(/[^a-z0-9-]/gi, "");
      var actionHtml = '<div class="lwsocial-actions"><button type="button" data-sm-like="' + esc(post.id) + '">' + (post.liked ? "♥ أعجبني" : "♡ إعجاب") + '</button>';
      if (!post.playerResponse) {
        if (post.kind === "rumor" || post.kind === "transfer") {
          actionHtml += '<button type="button" data-sm-reply="deny-rumor" data-sm-post="' + esc(post.id) + '">أنفي الشائعة</button><button type="button" data-sm-reply="fuel-rumor" data-sm-post="' + esc(post.id) + '">ألمّح للرحيل</button>';
        } else if (post.kind === "conflict") {
          actionHtml += '<button type="button" data-sm-reply="support-team" data-sm-post="' + esc(post.id) + '">أهدي الأجواء</button><button type="button" data-sm-reply="fuel-conflict" data-sm-post="' + esc(post.id) + '">أصعّد الخلاف</button>';
        } else if (post.kind === "role" || post.kind === "bench") {
          actionHtml += '<button type="button" data-sm-reply="support-team" data-sm-post="' + esc(post.id) + '">أركز في الملعب</button><button type="button" data-sm-reply="fuel-conflict" data-sm-post="' + esc(post.id) + '">أرد بعصبية</button>';
        } else {
          actionHtml += '<button type="button" data-sm-reply="respect" data-sm-post="' + esc(post.id) + '">رد باحترام</button><button type="button" data-sm-reply="bold" data-sm-post="' + esc(post.id) + '">رد بثقة</button>';
        }
      } else {
        var responseLabels = { respect: "رددت باحترام", bold: "رديت بثقة", "deny-rumor": "نفيت الشائعة", "fuel-rumor": "لمّحت للرحيل", "support-team": "اخترت تهدئة الأجواء", "fuel-conflict": "صعّدت الخلاف" };
        actionHtml += '<span class="lwsocial-response">' + esc(responseLabels[post.playerResponse] || "تم تسجيل ردك") + '</span>';
      }
      actionHtml += '</div>';
      return '<article class="lwsocial-post">' +
        '<div class="lwsocial-post-head"><span class="lwsocial-avatar">' + esc(post.avatar || "📣") + '</span><div class="lwsocial-author"><strong>' + esc(post.author || "صوت المدرج") + badge + '</strong><small>' + authorType + ' · الموسم ' + clamp(post.season, 1, 999) + ' / اليوم ' + clamp(post.day, 1, 99999) + '</small></div><span class="lwsocial-kind ' + kindClass + '">' + esc(kindLabels[post.kind] || "تفاعل") + '</span></div>' +
        '<p class="lwsocial-post-body">' + esc(post.body) + '</p>' +
        '<div class="lwsocial-engagement"><span>♥ ' + clamp(post.likes, 0, 999999) + ' إعجاب</span><span>💬 ' + (post.comments || []).length + ' تعليق</span></div>' +
        '<div class="lwsocial-comments">' + comments + '</div>' +
        actionHtml +
      '</article>';
    }).join("");
  }

  function notify(message) {
    var runtime = api();
    if (runtime && typeof runtime.toast === "function") runtime.toast(message);
  }

  function save() {
    var runtime = api();
    if (runtime && typeof runtime.save === "function") runtime.save();
  }

  function refresh() {
    var runtime = api();
    if (!runtime || typeof runtime.getState !== "function") return;
    var state = runtime.getState();
    if (!state) return;
    var created = syncState(state);
    if (created) save();
    render(state);
  }

  function boot() {
    refresh();
    var store = window.LWStateStore;
    if (store && typeof store.subscribe === "function") store.subscribe(refresh);
    if (!refreshTimer) refreshTimer = window.setInterval(refresh, 2500);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    document.addEventListener("input", function (event) {
      if (event.target && event.target.id === "lw-social-composer") {
        draft = String(event.target.value || "").slice(0, 240);
        var counter = document.getElementById("lw-social-counter");
        if (counter) counter.textContent = String(draft.length) + "/240";
        var submit = document.getElementById("lw-social-submit");
        if (submit) submit.disabled = !draft.trim();
      }
    });
    document.addEventListener("click", function (event) {
      var target = event.target && event.target.closest ? event.target.closest("[data-sm-filter], [data-sm-quick], [data-sm-like], [data-sm-reply], #lw-social-submit") : null;
      if (!target) return;
      var runtime = api();
      var state = runtime && runtime.getState ? runtime.getState() : null;
      if (!state) return;
      if (target.hasAttribute("data-sm-filter")) {
        activeFilter = target.getAttribute("data-sm-filter") || "all";
        lastRenderedSignature = "";
        render(state);
      } else if (target.hasAttribute("data-sm-quick")) {
        draft = target.getAttribute("data-sm-quick") || "";
        var composer = document.getElementById("lw-social-composer");
        if (composer) { composer.value = draft; composer.focus(); }
        var counter = document.getElementById("lw-social-counter");
        if (counter) counter.textContent = String(draft.length) + "/240";
        render(state);
      } else if (target.hasAttribute("data-sm-like")) {
        var likeResult = respond(state, target.getAttribute("data-sm-like"), "like");
        if (likeResult.ok) { save(); lastRenderedSignature = ""; render(state); }
      } else if (target.hasAttribute("data-sm-reply")) {
        var replyResult = respond(state, target.getAttribute("data-sm-post"), target.getAttribute("data-sm-reply"));
        notify(replyResult.ok ? replyResult.message : "استخدمت ردك اليوم؛ خليك ذكي واختار كلامك.");
        if (replyResult.ok) { save(); lastRenderedSignature = ""; render(state); }
      } else if (target.id === "lw-social-submit") {
        var result = createPlayerPost(state, draft);
        if (!result.ok) {
          notify(result.reason === "daily-post-limit" ? "بوستين كفاية النهارده؛ خليك مستني تفاعل الناس." : "اكتب بوست من 3 إلى 240 حرف.");
          return;
        }
        draft = "";
        save();
        notify("البوست نزل — شوف رد فعل الجمهور والإعلام.");
        lastRenderedSignature = "";
        render(state);
      }
    });
  }

  window.LWSocialMedia = Object.freeze({
    ensureState: ensureState,
    matchKey: matchKey,
    textSentiment: textSentiment,
    matchSentiment: matchSentiment,
    buildComments: buildComments,
    createPlayerPost: createPlayerPost,
    createMatchPost: createMatchPost,
    syncState: syncState,
    respond: respond,
    visiblePosts: visiblePosts,
    render: render,
    refresh: refresh
  });

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(window);
