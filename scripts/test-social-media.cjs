"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "social-media.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "social-media.js"), "utf8");
assert.equal(source, deployed, "root and public social media modules must stay synchronized");
const sandbox = { window: {}, Math, console };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "social-media.js" });
const social = sandbox.window.LWSocialMedia;
assert.ok(social, "social media runtime must expose its public API");

const state = {
  name: "Test Player",
  careerStarted: true,
  retired: false,
  season: 2,
  day: 7,
  calendarDay: 7,
  role: "بديل",
  teamChemistry: 60,
  followers: 1200,
  mediaReputation: 45,
  professionalism: 65,
  coachRelationship: 60,
  trust: 55,
  morale: 60,
  careerMatchHistory: [],
  pressHistory: [],
  relationshipHistory: [],
  transferHistory: [],
  careerAwards: [],
  trophyCabinet: []
};

const store = social.ensureState(state);
assert.equal(store.version, 3);
assert.deepEqual(Array.from(store.posts), []);
assert.equal(social.syncState(state), 0, "initial sync must not publish old career history");

// Version 1 saves kept only 120 seen match keys. Migration must seed the complete
// existing history so the first refresh does not publish hundreds of old matches.
const oldRows = Array.from({ length: 160 }, (_, index) => ({
  id: "old-" + index, season: 1, day: index + 1, opponent: "Old opponent " + index,
  minutes: 10, rating: 6, goals: 0, assists: 0
}));
const migrated = {
  careerStarted: true,
  careerMatchHistory: oldRows,
  pressHistory: [], relationshipHistory: [], transferHistory: [], careerAwards: [], trophyCabinet: [],
  socialMedia: {
    version: 1, nextId: 1, initialized: true, posts: [],
    seen: { matches: oldRows.slice(0, 120).map(social.matchKey), press: [], relationships: [], transfers: [], awards: [] },
    lastReplyDay: ""
  }
};
social.ensureState(migrated);
assert.equal(migrated.socialMedia.version, 3);
assert.equal(social.syncState(migrated), 0, "migration must not replay historical matches");
assert.equal(social.syncState(migrated), 0, "old matches must remain seen on later refreshes");
assert.equal(migrated.socialMedia.lockerRoomCrisisActive, false,
  "legacy saves without a team-chemistry field must not be treated as an active crisis");

assert.equal(migrated.socialMedia.seen.matches.length, 160);

// Backlogs are published in bounded chronological batches and are never marked
// as seen before a post is actually created.
const backlog = {
  name: "Batch Player", careerStarted: true, season: 3, day: 1,
  careerMatchHistory: [], pressHistory: [], relationshipHistory: [], transferHistory: [],
  careerAwards: [], trophyCabinet: []
};
const backlogStore = social.ensureState(backlog);
social.syncState(backlog);
for (let index = 0; index < 12; index++) {
  backlog.careerMatchHistory.unshift({
    id: "batch-" + index, season: 3, day: index + 2, opponent: "Batch Opponent " + index,
    teamGoals: 1, oppGoals: 0, minutes: 90, rating: 6.5, goals: 0, assists: 0
  });
}
assert.equal(social.syncState(backlog), 5);
assert.equal(social.syncState(backlog), 5);
assert.equal(social.syncState(backlog), 2);
assert.equal(social.syncState(backlog), 0);
assert.equal(backlogStore.posts.filter(post => post.kind === "match").length, 12);
assert.equal(backlogStore.seen.matches.length, 12);

// Multiple events of each type must drain over successive refreshes instead of
// being marked seen after only the first event was posted.
const eventBatch = {
  name: "Event Player", careerStarted: true, season: 4, day: 1,
  careerMatchHistory: [], pressHistory: [], relationshipHistory: [], transferHistory: [],
  careerAwards: [], trophyCabinet: []
};
const eventBatchStore = social.ensureState(eventBatch);
social.syncState(eventBatch);
for (const [target, prefix, type] of [
  [eventBatch.pressHistory, "press", "تصريح"],
  [eventBatch.relationshipHistory, "relationship", "جلسة زملاء"],
  [eventBatch.transferHistory, "transfer", "عرض انتقال"],
  [eventBatch.careerAwards, "award", "جائزة"]
]) {
  for (let index = 0; index < 2; index++) {
    target.unshift({
      id: prefix + "-" + index, season: 4, day: index + 2,
      type, text: prefix + " event " + index
    });
  }
}
assert.equal(social.syncState(eventBatch), 4);
assert.equal(social.syncState(eventBatch), 4);
assert.equal(social.syncState(eventBatch), 0);
assert.equal(eventBatchStore.posts.length, 8);
for (const kind of ["press", "relationship", "transfer", "award"]) {
  assert.equal(eventBatchStore.posts.filter(post => post.kind === kind).length, 2);
}

const weakMatch = {
  id: "m-1", season: 2, day: 8, competition: "الدوري", club: "نادي اللاعب",
  opponent: "المنافس", teamGoals: 0, oppGoals: 2, minutes: 18, rating: 5.4,
  goals: 0, assists: 0
};
state.careerMatchHistory.unshift(weakMatch);
assert.equal(social.syncState(state), 1, "a new match should generate a media post");
assert.equal(store.posts.length, 1);
assert.equal(store.posts[0].kind, "match");
assert.match(store.posts[0].body, /غياب|صعبة|شارك/);
assert.ok(store.posts[0].comments.length >= 3 && store.posts[0].comments.length <= 5);
assert.ok(store.posts[0].comments.every(comment => typeof comment.body === "string"));

const postResult = social.createPlayerPost(state, "شكراً للجمهور على الدعم، هنشتغل أكتر في التمرين.");
assert.equal(postResult.ok, true);
assert.equal(postResult.post.authorType, "player");
assert.equal(state.professionalism, 66);
assert.equal(state.mediaReputation, 46);
assert.ok(state.followers > 1200);
assert.equal(social.createPlayerPost(state, "بوست تاني عن التمرين").ok, true);
assert.equal(social.createPlayerPost(state, "بوست تالت النهارده").reason, "daily-post-limit");

const beforeCoach = state.coachRelationship;
const beforeProfessionalism = state.professionalism;
const beforeFollowers = state.followers;
const bold = social.respond(state, postResult.post.id, "bold");
assert.equal(bold.ok, true);
assert.ok(state.coachRelationship < beforeCoach);
assert.ok(state.professionalism < beforeProfessionalism);
assert.ok(state.followers > beforeFollowers);
assert.equal(social.respond(state, postResult.post.id, "respect").reason, "daily-reply-limit");

const pressState = { type: "مقابلة صحفية — تصريح واثق", text: "أكدت إني جاهز للمنافسة" };
state.pressHistory.unshift(pressState);
assert.equal(social.syncState(state), 1, "new press activity should enter the social feed");
assert.equal(store.posts[0].kind, "press");

const legacy = { careerStarted: true, followers: 5, careerMatchHistory: [weakMatch] };
social.ensureState(legacy);
assert.equal(social.syncState(legacy), 0, "old saves must be initialized without replaying old matches");
assert.ok(legacy.socialMedia && Array.isArray(legacy.socialMedia.posts));

const tooLong = social.createPlayerPost(state, "x".repeat(241));
assert.equal(tooLong.reason, "post-too-long");
const noCareer = social.createPlayerPost({ careerStarted: false }, "hello world");
assert.equal(noCareer.reason, "career-unavailable");

state.day += 1;
state.calendarDay += 1;
state.transferOffers = [{
  id: "offer-social-real-club", status: "pending", windowId: "summer-0",
  club: "نادي حقيقي", country: "مصر", league: "الدوري المصري", role: "أساسي", power: 62, wage: 1500
}];
assert.equal(social.syncState(state), 1, "a real pending offer should create a transfer-rumour post");
assert.equal(store.posts[0].kind, "rumor");
assert.match(store.posts[0].body, /نادي حقيقي/);
const beforeRumourCoach = state.coachRelationship;
assert.equal(social.respond(state, store.posts[0].id, "deny-rumor").ok, true);
assert.ok(state.coachRelationship >= beforeRumourCoach);
assert.equal(store.posts[0].playerResponse, "deny-rumor");
assert.equal(social.respond(state, store.posts[0].id, "fuel-rumor").reason, "post-already-answered");

state.role = "أساسي";
assert.equal(social.syncState(state), 1, "a squad-role promotion should create a role story");
assert.equal(store.posts[0].kind, "role");

state.teamChemistry = 25;
assert.equal(social.syncState(state), 1, "low team chemistry should create a locker-room story");
assert.equal(store.posts[0].kind, "conflict");
const chemistryBefore = state.teamChemistry;
state.day += 1;
assert.equal(social.respond(state, store.posts[0].id, "support-team").ok, true);
assert.ok(state.teamChemistry > chemistryBefore);

state.role = "بديل";
state.day += 1;
state.calendarDay = 40;
[1, 2, 3].forEach(function (n) {
  state.careerMatchHistory.unshift({
    id: "unused-" + n, season: 2, day: 8 + n, scope: "league",
    club: "نادي اللاعب", opponent: "منافس " + n, teamGoals: 0, oppGoals: 1,
    minutes: 0, playerAvailable: false, rating: 0, goals: 0, assists: 0
  });
});
social.syncState(state);
assert.ok(store.posts.some(function (post) { return post.kind === "bench"; }),
  "repeated non-appearances in a substitute role should create a playing-time story");

const migratedOffers = {
  careerStarted: true, role: "بديل", teamChemistry: 45, calendarDay: 120,
  socialMedia: { version: 2, initialized: true, posts: [],
    seen: { matches: [], press: [], relationships: [], transfers: [], awards: [] } },
  transferOffers: [{ id: "old-offer", status: "pending", club: "نادي قديم", country: "مصر" }]
};
social.ensureState(migratedOffers);
assert.equal(migratedOffers.socialMedia.version, 3);
assert.equal(social.syncState(migratedOffers), 0,
  "v2 saves should mark existing offers as seen instead of replaying old rumours");
const injectionState = { careerStarted: true, followers: 1, season: 1, day: 1 };
const injection = social.createPlayerPost(injectionState, "<img src=x onerror=alert(1)>");
assert.equal(injection.ok, true);
assert.equal(injection.post.body, "<img src=x onerror=alert(1)>", "user text must be preserved as data; the renderer escapes it");

console.log("PASS: social posts, real transfer rumours, squad-role and bench stories, locker-room events, migration and contextual replies.");
