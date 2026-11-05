
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "social-media.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "social-media.js"), "utf8");
assert.equal(source, deployed, "root and public social media runtimes must stay synchronized");

function makeHarness(state, flush, clone) {
  let saves = 0;
  let flushes = 0;
  const notices = [];
  const window = {
    LWStoryRuntime: {
      getState: () => state,
      save() { saves += 1; return Promise.resolve(true); },
      toast(message) { notices.push(String(message)); }
    },
    flushQueuedSave() {
      flushes += 1;
      if (typeof flush === "function") return flush(flushes, state);
      return Promise.resolve(Array.isArray(flush) ? flush.shift() !== false : true);
    },
    console
  };
  if (typeof clone === "function") window.structuredClone = clone;
  const sandbox = { window, Math, Promise, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "social-media.js" });
  return { social: window.LWSocialMedia, state, notices, counts: () => ({ saves, flushes }) };
}

function careerState() {
  return {
    name: "Test Player", careerStarted: true, retired: false, season: 2, day: 7, calendarDay: 7,
    followers: 1200, mediaReputation: 45, professionalism: 65, coachRelationship: 60,
    trust: 55, morale: 60, teamChemistry: 60, role: "بديل",
    careerMatchHistory: [], pressHistory: [], relationshipHistory: [], transferHistory: [],
    careerAwards: [], trophyCabinet: [],
    socialMedia: {
      version: 3, nextId: 1, initialized: true, posts: [],
      seen: { matches: [], press: [], relationships: [], transfers: [], awards: [], offers: [] },
      observedRole: "بديل", lockerRoomCrisisActive: false,
      lastBenchStoryCalendarDay: 7, lastBenchStoryMatchId: "", lastReplyDay: ""
    }
  };
}

(async function () {
  const success = makeHarness(careerState(), [true]);
  const beforeFollowers = success.state.followers;
  const committed = await success.social.runMutation(success.state, function () {
    return success.social.createPlayerPost(success.state, "شكراً للجمهور على الدعم، هنشتغل أكتر.");
  });
  assert.equal(committed.ok, true);
  assert.equal(committed.changed, true);
  assert.equal(committed.value.ok, true);
  assert.equal(success.state.socialMedia.posts.length, 1);
  assert.ok(success.state.followers > beforeFollowers);
  assert.deepEqual(success.counts(), { saves: 1, flushes: 1 });

  const failedState = careerState();
  const failedBefore = JSON.stringify(failedState);
  const failed = makeHarness(failedState, [false, true]);
  const rejected = await failed.social.runMutation(failed.state, function () {
    return failed.social.createPlayerPost(failed.state, "بوست لازم يرجع لو الحفظ فشل.");
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "social-save-failed");
  assert.equal(rejected.rollbackPersisted, true);
  assert.equal(JSON.stringify(failed.state), failedBefore, "failed post must restore followers, reputation and feed");
  assert.deepEqual(failed.counts(), { saves: 2, flushes: 2 });

  const rollbackFailure = makeHarness(careerState(), [false, false]);
  const rollbackBefore = JSON.stringify(rollbackFailure.state);
  const unconfirmed = await rollbackFailure.social.runMutation(rollbackFailure.state, function () {
    return rollbackFailure.social.createPlayerPost(rollbackFailure.state, "لازم نرجع الحالة حتى لو فشل الحفظ.");
  });
  assert.equal(unconfirmed.ok, false);
  assert.equal(unconfirmed.rollbackPersisted, false);
  assert.equal(JSON.stringify(rollbackFailure.state), rollbackBefore);
  assert.deepEqual(rollbackFailure.counts(), { saves: 2, flushes: 2 });

  const noOp = makeHarness(careerState(), []);
  const unchanged = await noOp.social.runMutation(noOp.state, function () { return 0; });
  assert.equal(unchanged.ok, true);
  assert.equal(unchanged.changed, false);
  assert.deepEqual(noOp.counts(), { saves: 0, flushes: 0 });

  let releaseSave;
  const concurrent = makeHarness(careerState(), () => new Promise(resolve => { releaseSave = resolve; }));
  const first = concurrent.social.runMutation(concurrent.state, function () {
    concurrent.state.followers += 1;
    return { ok: true };
  });
  await Promise.resolve();
  await Promise.resolve();
  const second = await concurrent.social.runMutation(concurrent.state, function () {
    concurrent.state.followers += 100;
    return { ok: true };
  });
  assert.equal(second.reason, "social-mutation-pending");
  assert.equal(concurrent.state.followers, 1201, "a second click must not mutate during an active save");
  releaseSave(true);
  assert.equal((await first).ok, true);
  assert.deepEqual(concurrent.counts(), { saves: 1, flushes: 1 });

  const automatic = careerState();
  automatic.careerMatchHistory.unshift({
    id: "social-match-1", season: 2, day: 8, competition: "الدوري",
    club: "نادي اللاعب", opponent: "المنافس", teamGoals: 2, oppGoals: 1,
    minutes: 90, rating: 7.2, goals: 1, assists: 0
  });
  const autoHarness = makeHarness(automatic, [true]);
  const autoResult = await autoHarness.social.refresh();
  assert.equal(autoResult.ok, true);
  assert.equal(autoResult.changed, true);
  assert.equal(automatic.socialMedia.posts.filter(post => post.kind === "match").length, 1);
  assert.equal(autoHarness.counts().saves, 1);
  const repeated = await autoHarness.social.refresh();
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.equal(automatic.socialMedia.posts.filter(post => post.kind === "match").length, 1);
  assert.equal(autoHarness.counts().saves, 1, "a seen match must not trigger another save or post");

  const migration = {
    careerStarted: true, name: "Legacy Player", season: 1, day: 1,
    careerMatchHistory: [], pressHistory: [], relationshipHistory: [], transferHistory: [],
    careerAwards: [], trophyCabinet: []
  };
  const migrationHarness = makeHarness(migration, [true]);
  const migrationResult = await migrationHarness.social.refresh();
  assert.equal(migrationResult.ok, true);
  assert.equal(migration.socialMedia.initialized, true);
  assert.equal(migrationHarness.counts().saves, 1, "social migration must be durably saved");

  const largeState = careerState();
  largeState.worldSimulation = { players: Object.fromEntries(Array.from({ length: 200 }, (_, index) => ["p" + index, { name: "Player " + index }])) };
  const clonedValues = [];
  const lightweight = makeHarness(largeState, [], value => {
    clonedValues.push(value);
    return structuredClone(value);
  });
  const lightweightResult = await lightweight.social.refresh();
  assert.equal(lightweightResult.ok, true);
  assert.equal(clonedValues.length, 1);
  assert.equal(clonedValues[0], largeState.socialMedia,
    "periodic feed sync must snapshot only social state, not the full world/player database");
  assert.deepEqual(lightweight.counts(), { saves: 0, flushes: 0 });

  // The feed signature must invalidate when an older post changes in a shared save.
  // The newest post and feed length deliberately remain unchanged in this regression.
  const renderFeed = { dataset: {}, innerHTML: "" };
  const renderState = careerState();
  renderState.socialMedia.posts = [
    { id:"post-newest", kind:"news", author:"رادار الملاعب", authorType:"media", avatar:"📣",
      verified:true, body:"أحدث خبر", season:2, day:7, likes:10, liked:false, comments:[] },
    { id:"post-older", kind:"news", author:"صوت المدرج", authorType:"media", avatar:"📣",
      verified:true, body:"خبر أقدم", season:2, day:6, likes:3, liked:false, comments:[] }
  ];
  let renderRevision = 1;
  const renderWindow = { LWStateStore: { getRevision: () => renderRevision } };
  const renderDocument = {
    readyState: "loading",
    getElementById(id) { return id === "lw-social-feed" ? renderFeed : null; },
    addEventListener() {}
  };
  const renderSandbox = { window: renderWindow, document: renderDocument, Math, Promise, console };
  vm.createContext(renderSandbox);
  vm.runInContext(source, renderSandbox, { filename: "social-media-render-revision.cjs" });
  const renderSocial = renderWindow.LWSocialMedia;
  renderSocial.render(renderState);
  assert.ok(renderFeed.innerHTML.includes("♥ 3 إعجاب"),
    "the initial feed must render the older post's saved likes");
  renderState.socialMedia.posts[1].likes = 9;
  renderRevision += 1;
  renderSocial.render(renderState);
  assert.ok(renderFeed.innerHTML.includes("♥ 9 إعجاب"),
    "a newer shared state revision must refresh older post changes without changing feed length or newest post");

  console.log("PASS: social posts, replies, likes, automatic feed sync, migration, and stale older-post render invalidation.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
