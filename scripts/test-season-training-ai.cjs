"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const start = html.indexOf("function seasonTrainingPerformanceFocus()");
const end = html.indexOf("\nfunction simulateSeasonBlock(targetApps)", start);
assert.ok(start >= 0 && end > start, "season training AI functions must exist in the app");
const source = html.slice(start, end);

function createSandbox(position, rows, attributes, plan) {
  const sandbox = {
    state: {
      pos: position, age: 20, season: 1, seasonApps: 0, seasonMatchCount: 22,
      careerMatchHistory: rows, playerPotential: 85, trainingSessions: 0,
      energy: 70, fatigue: 20, injuryDays: 0, injuryName: "", playedToday: false,
      trainedToday: false, trainingIntensity: "normal", seasonDevelopmentSnapshot: null,
      seasonTrainingReport: null,
      shooting: 75, composure: 70, defending: 74, physical: 70,
      speed: 72, fitness: 72, dribbling: 72, passing: 72, vision: 72,
      goalkeeping: 72, ...attributes
    },
    window: {
      LWCareer: {
        positionDevelopmentPlan: () => plan,
        train: (state, focus) => {
          state[focus] = Math.min(99, (Number(state[focus]) || 0) + 1);
          state.trainingSessions = (Number(state.trainingSessions) || 0) + 1;
          state.energy = Math.max(0, state.energy - 15);
          state.fatigue = Math.min(100, state.fatigue + 15);
          state.trainedToday = true;
          return { ok: true, xp: 30, injured: false };
        }
      },
      LWCareerAI: { coachAdvice: () => ({ focus: plan.primary[0] }) }
    },
    clamp: (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(Number(value) || 0))),
    seasonMatchTotal: () => 22,
    overall: () => {
      const current = sandbox.state;
      const weights = position === "مهاجم"
        ? { shooting: 0.26, dribbling: 0.10, speed: 0.13, composure: 0.12, fitness: 0.10, vision: 0.10, passing: 0.08, physical: 0.05, defending: 0.04, goalkeeping: 0.02 }
        : { shooting: 0.10, dribbling: 0.10, speed: 0.10, composure: 0.10, fitness: 0.10, vision: 0.10, passing: 0.10, physical: 0.10, defending: 0.10, goalkeeping: 0.10 };
      return Math.round(Object.entries(weights).reduce((sum, [key, weight]) => sum + (Number(current[key]) || 0) * weight, 0));
    }
  };
  vm.createContext(sandbox);
  new vm.Script(source, { filename: "season-training-ai-extract.js" }).runInContext(sandbox);
  return sandbox;
}

const poorFinishingRows = [0, 1, 2].map(() => ({
  minutes: 90, oppGoals: 1,
  stats: { shots: 4, shotsOnTarget: 1, keyPasses: 0, chances: 1, tackles: 0, interceptions: 0, saves: 0 }
}));
const striker = createSandbox("مهاجم", poorFinishingRows, { shooting: 75, composure: 70 }, {
  primary: ["shooting"], secondary: ["composure"]
});
assert.equal(striker.seasonTrainingPerformanceFocus(), "shooting",
  "a striker with repeated low shot accuracy should focus on shooting");
assert.equal(striker.chooseSeasonTrainingFocus(), "shooting",
  "recent match evidence should be able to prioritize shooting over a larger secondary-skill gap");

const defenderRows = [0, 1].map(() => ({
  minutes: 90, oppGoals: 1,
  stats: { shots: 0, shotsOnTarget: 0, keyPasses: 1, chances: 1, tackles: 0, interceptions: 1, saves: 0 }
}));
const defender = createSandbox("قلب دفاع", defenderRows, { defending: 74, physical: 70 }, {
  primary: ["defending"], secondary: ["physical"]
});
assert.equal(defender.seasonTrainingPerformanceFocus(), "defending",
  "a centre-back with low tackle/interception output should focus on defending");

const newPlayer = createSandbox("مهاجم", [], {}, {
  primary: ["shooting"], secondary: ["composure"]
});
assert.equal(newPlayer.seasonTrainingPerformanceFocus(), "",
  "insufficient match history should preserve the normal position/potential training plan");

// Growth happens progressively inside a simulated season, not as a sudden end-only
// bonus. Young players receive a larger planned training volume than veterans.
const youthPlan = createSandbox("مهاجم", poorFinishingRows, { age: 15, playerPotential: 98 }, {
  primary: ["shooting"], secondary: ["composure"]
});
youthPlan.ensureSeasonDevelopmentSnapshot();
const youthSessionsPlanned = youthPlan.seasonAITTrainingTargetSessions(youthPlan.state.seasonTrainingReport);
const veteranPlan = createSandbox("مهاجم", poorFinishingRows, { age: 32, playerPotential: 98 }, {
  primary: ["shooting"], secondary: ["composure"]
});
veteranPlan.ensureSeasonDevelopmentSnapshot();
const veteranSessionsPlanned = veteranPlan.seasonAITTrainingTargetSessions(veteranPlan.state.seasonTrainingReport);
assert.ok(youthSessionsPlanned > veteranSessionsPlanned,
  "academy-age players should receive a higher annual training plan than veteran players");
assert.ok(youthSessionsPlanned <= 16 && veteranSessionsPlanned >= 0,
  "age-based annual plans must remain within safe training-session bounds");

const simulatedSeason = createSandbox("مهاجم", poorFinishingRows, {
  age: 16, playerPotential: 95, shooting: 70, composure: 70
}, { primary: ["shooting"], secondary: ["composure"] });
simulatedSeason.state.seasonAppsTarget = 22;
simulatedSeason.state.seasonDevelopmentSnapshot = {
  season: 1, ovr: simulatedSeason.overall(), sessions: 0,
  attributes: { shooting: 70, dribbling: 72, passing: 72, speed: 72, fitness: 72, composure: 70, defending: 74, goalkeeping: 72, vision: 72, physical: 70 }
};
simulatedSeason.state.seasonTrainingReport = {
  sessions: 0, skills: {}, xp: 0, injuries: 0, completed: false, planVersion: 2,
  plannedSessions: 10, manualSessions: 0, simulatedSessions: 0
};
const startingOverall = simulatedSeason.overall();
const firstHalfTrainingTrace = [];
for (let apps = 1; apps <= 11; apps++) {
  simulatedSeason.state.seasonApps = apps;
  firstHalfTrainingTrace.push(simulatedSeason.runSeasonAITTrainingOnSimulationProgress());
}
assert.equal(simulatedSeason.state.seasonTrainingReport.sessions, 5,
  "the first half of a season should deliver its scheduled portion of AI training; trace="
    + JSON.stringify({ trace: firstHalfTrainingTrace, report: simulatedSeason.state.seasonTrainingReport,
      trainingSessions: simulatedSeason.state.trainingSessions, shooting: simulatedSeason.state.shooting,
      composure: simulatedSeason.state.composure, age: simulatedSeason.state.age, energy: simulatedSeason.state.energy,
      fatigue: simulatedSeason.state.fatigue, injuryDays: simulatedSeason.state.injuryDays }));
assert.equal(simulatedSeason.state.seasonTrainingReport.simulatedSessions, 5,
  "progressively simulated training sessions must be tracked separately from manual sessions");
assert.ok(simulatedSeason.overall() > startingOverall,
  "training performed during season simulation must be reflected in the player's overall rating");
assert.equal(simulatedSeason.state.seasonTrainingReport.completed, false,
  "mid-season training must not finalize the season development report");
for (let apps = 12; apps <= 22; apps++) {
  simulatedSeason.state.seasonApps = apps;
  simulatedSeason.runSeasonAITTrainingOnSimulationProgress();
}
assert.equal(simulatedSeason.state.seasonTrainingReport.sessions, 10,
  "the full season must reach its planned automated training volume");
const completedSimulation = simulatedSeason.runSeasonAITtraining();
assert.equal(completedSimulation.ok, true);
assert.equal(completedSimulation.sessions, 10,
  "end-of-season completion must not award the same simulated training sessions twice");
assert.equal(simulatedSeason.state.seasonTrainingReport.completed, true);
const afterSeasonSimulationSessions = simulatedSeason.state.trainingSessions;
simulatedSeason.runSeasonAITtraining();
assert.equal(simulatedSeason.state.trainingSessions, afterSeasonSimulationSessions,
  "re-entering completed season training must never double-train the player");

// Manual training counts toward the target, so automated sessions fill only the
// remaining plan instead of granting a second full allocation.
const mixedTraining = createSandbox("مهاجم", poorFinishingRows, {
  age: 20, playerPotential: 90
}, { primary: ["shooting"], secondary: ["composure"] });
mixedTraining.state.seasonAppsTarget = 22;
mixedTraining.state.trainingSessions = 3;
mixedTraining.state.seasonDevelopmentSnapshot = {
  season: 1, ovr: mixedTraining.overall(), sessions: 0,
  attributes: { shooting: 75, dribbling: 72, passing: 72, speed: 72, fitness: 72, composure: 70, defending: 74, goalkeeping: 72, vision: 72, physical: 70 }
};
mixedTraining.state.seasonTrainingReport = {
  sessions: 0, skills: {}, xp: 0, injuries: 0, completed: false, planVersion: 2,
  plannedSessions: 10, manualSessions: 0, simulatedSessions: 0
};
mixedTraining.state.seasonApps = 11;
mixedTraining.runSeasonAITTrainingOnSimulationProgress();
assert.equal(mixedTraining.state.seasonTrainingReport.sessions, 2,
  "manual training sessions must reduce the automated first-half quota");
assert.equal(mixedTraining.state.trainingSessions, 5,
  "automatic training must preserve the three existing manual sessions");
assert.equal(mixedTraining.state.seasonTrainingReport.simulatedSessions, 2);

// The whole-season plan runs once at season end, uses age/potential and position,
// and restores match-day condition after applying the accumulated development.
const annual = createSandbox("مهاجم", poorFinishingRows, { shooting: 75, composure: 70 }, {
  primary: ["shooting"], secondary: ["composure"]
});
annual.state.seasonApps = 22;
annual.state.seasonDevelopmentSnapshot = {
  season: 1, ovr: 75, sessions: 0,
  attributes: { shooting: 75, dribbling: 72, passing: 72, speed: 72, fitness: 72, composure: 70, defending: 74, goalkeeping: 72, vision: 72, physical: 70 }
};
annual.state.seasonTrainingReport = { sessions: 0, skills: {}, xp: 0, injuries: 0, completed: false };
const originalCondition = {
  energy: annual.state.energy, fatigue: annual.state.fatigue,
  injuryDays: annual.state.injuryDays, injuryName: annual.state.injuryName,
  playedToday: annual.state.playedToday, trainedToday: annual.state.trainedToday,
  trainingIntensity: annual.state.trainingIntensity
};
const annualResult = annual.runSeasonAITtraining();
assert.equal(annualResult.ok, true, "the annual development batch should complete");
assert.ok(annualResult.sessions > 0, "the annual plan should produce training sessions for a developing young player");
assert.equal(annual.state.seasonTrainingReport.completed, true, "the season report should be marked complete");
assert.equal(annual.state.seasonTrainingReport.completedSeason, 1, "the report should be tied to the season just finished");
for (const key of Object.keys(originalCondition)) assert.equal(annual.state[key], originalCondition[key], "annual training must restore " + key);
const incomplete = createSandbox("مهاجم", [], {}, {
  primary: ["shooting"], secondary: ["composure"]
});
assert.equal(incomplete.runSeasonAITtraining().skipped, "season-incomplete", "the annual batch must not apply before the full season is complete");
assert.equal(incomplete.state.trainingSessions, 0, "an incomplete season must not receive the annual AI training batch");
const completedSessions = annual.state.seasonTrainingReport.sessions;
annual.runSeasonAITtraining();
assert.equal(annual.state.seasonTrainingReport.sessions, completedSessions, "re-entering the annual batch must not double-train the player");
console.log("PASS: match evidence, position-specific focus, potential caps and one-time season-end training all work.");
