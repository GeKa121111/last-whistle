"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
function extractFunction(name) {
  const start = html.indexOf("function " + name + "(");
  if (start < 0) throw new Error("Missing academy career function: " + name);
  const next = html.indexOf("\nfunction ", start + 1);
  return html.slice(start, next < 0 ? html.length : next);
}
const source = [
  "function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,Math.round(Number(v)||0)));}",
  extractFunction("academyAgeGroup"),
  extractFunction("academyCompetition"),
  extractFunction("seniorLeagueCompetition"),
  extractFunction("scaleAcademyStartingStats"),
  extractFunction("syncAcademyCareerState")
].join("\n");
const sandbox = { catalogLeague: () => null, europeanLeagueRow: () => null, overall: () => 70 };
vm.createContext(sandbox);
new vm.Script(source, { filename: "academy-career-functions" }).runInContext(sandbox);
for (let age = 12; age <= 17; age++) {
  const player = { age, academyCareer: true, academyGraduated: false, academyGraduationPending: false, academyReserve: false, contractSeasons: 6, leagueCountry: "مصر", leagueDivision: 1, clubName: "نادي الاختبار" };
  const result = sandbox.syncAcademyCareerState(player);
  assert.equal(result.active, true, "ages 12-17 should remain in youth academy");
  assert.equal(result.graduated, false, "players under 18 must not graduate early");
  assert.equal(player.academyCareer, true);
  assert.equal(player.academyGraduationPending, false);
  assert.equal(player.weeklyWage, 0, "academy players must not receive a professional weekly wage");
  assert.equal(player.freeAgent, false, "academy players are not adult free agents");
  assert.equal(player.contractType, "academy");
  assert.equal(player.role, "ناشئ " + sandbox.academyAgeGroup(age));
  assert.equal(player.leagueCompetition, sandbox.academyCompetition(age));
  assert.equal(result.group, sandbox.academyAgeGroup(age));
}
const graduate = { age: 18, academyCareer: true, academyGraduated: false, academyGraduationPending: false, academyReserve: false, contractSeasons: 6, leagueCountry: "مصر", leagueDivision: 1, clubName: "نادي الاختبار" };
const graduation = sandbox.syncAcademyCareerState(graduate);
assert.equal(graduation.active, false, "age 18 should leave academy mode");
assert.equal(graduation.graduated, true, "age 18 should trigger graduation");
assert.equal(graduate.academyCareer, false);
assert.equal(graduate.academyGraduated, true);
assert.equal(graduate.academyGraduationPending, true, "age 18 must require a first-team/reserve decision");
assert.equal(graduate.contractType, "academy-graduation-pending");
assert.equal(graduate.freeAgent, true);
assert.equal(graduate.weeklyWage, 0);
assert.equal(graduate.leagueCompetition, "الدوري المصري — محاكاة محلية");
const stats12 = sandbox.scaleAcademyStartingStats({ shooting: 80, passing: 70, speed: 65 }, 12);
const stats15 = sandbox.scaleAcademyStartingStats({ shooting: 80, passing: 70, speed: 65 }, 15);
assert.ok(stats12.shooting < stats15.shooting, "a 12-year-old should start with lower development ratings than a 15-year-old");
assert.ok(Object.values(stats12).every(value => value <= 65), "academy starting ratings must remain youth-scaled");
for (const age of [12, 13, 14, 15]) assert.ok(new RegExp('<option value="' + age + '"').test(html), "setup must offer age " + age);
assert.ok(html.includes('const age=clamp(Number($("startAge").value)||17,12,20),academy=age<=15'), "career creation must accept academy start ages");
assert.ok(html.includes("if(academyBeforeSeason){state.academyYearsCompleted"), "season advance must progress the youth academy age group");
assert.ok(html.includes("openAcademyGraduationDecision()"), "graduation decision must be available at age 18");
assert.ok(html.includes("أقبل عقد الفريق الأول") && html.includes("أبدأ مع فريق الرديف"), "age 18 must offer first-team or reserve choices");
assert.ok(html.includes("const youthNoPay=isYouthAcademyPlayer(state)||state.academyReserve"), "academy and reserve matches must not pay adult appearance wages");
assert.ok(html.includes("if(isYouthAcademyPlayer())return") && html.includes("if(state.academyGraduationPending)"), "youth and graduation states must block first-team market access");
console.log("Youth academy test passed: ages 12-17 progress through age groups, age 18 triggers graduation, youth ratings are scaled, and first-team-only systems are gated.");
