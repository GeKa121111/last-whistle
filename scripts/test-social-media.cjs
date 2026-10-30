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
assert.equal(store.version, 1);
assert.deepEqual(Array.from(store.posts), []);
assert.equal(social.syncState(state), 0, "initial sync must not publish old career history");

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
const injectionState = { careerStarted: true, followers: 1, season: 1, day: 1 };
const injection = social.createPlayerPost(injectionState, "<img src=x onerror=alert(1)>");
assert.equal(injection.ok, true);
assert.equal(injection.post.body, "<img src=x onerror=alert(1)>", "user text must be preserved as data; the renderer escapes it");

console.log("PASS: social posts, match/press reactions, legacy initialization, daily limits, and reply consequences.");
