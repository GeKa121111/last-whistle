"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.equal(rootHtml, html, "root and deployed app shells must remain identical");

function extractFunction(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start >= 0, "missing function " + name);
  const next = html.indexOf("\nfunction ", start + 1);
  return html.slice(start, next < 0 ? html.length : next);
}

const nodes = {
  performanceInsights: { innerHTML: "" },
  formTrendBadge: { textContent: "" }
};
const sandbox = {
  state: {
    pos: "وسط",
    energy: 88,
    fatigue: 12,
    careerMatchHistory: [{
      opponent: "المنافس",
      club: "Test FC",
      teamGoals: 2,
      oppGoals: 1,
      minutes: 90,
      rating: 7.1,
      goals: 0,
      assists: 1,
      keyPasses: 3,
      tackles: 2,
      interceptions: 1,
      ballRecoveries: 4
    }]
  },
  $(id) { return nodes[id] || null; },
  safeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[char]));
  },
  club() { return { name: "Test FC" }; }
};
vm.createContext(sandbox);
vm.runInContext(
  extractFunction("performanceAdviceForRole") + "\n" +
  extractFunction("renderPerformanceInsights") +
  "\nthis.performanceAdviceForRole=performanceAdviceForRole;this.renderPerformanceInsights=renderPerformanceInsights;",
  sandbox,
  { filename: "central-midfield-performance-insights" }
);

const lowRatingAdvice = sandbox.performanceAdviceForRole("وسط", {
  goals: 0, assists: 0, tackles: 0, interceptions: 0, keyPasses: 0, recoveries: 0
}, 6.1, 90, 10);
assert.match(lowRatingAdvice, /ربط الخطوط/, "central midfield advice must focus on linking play and counter-pressing");
const quietMatchAdvice = sandbox.performanceAdviceForRole("وسط", {
  goals: 0, assists: 0, tackles: 0, interceptions: 0, keyPasses: 0, recoveries: 0
}, 7.0, 90, 10);
assert.match(quietMatchAdvice, /بناء اللعب/, "a quiet central-midfield performance must not receive generic striker advice");

sandbox.renderPerformanceInsights();
const markup = nodes.performanceInsights.innerHTML;
assert.match(markup, /تمريرات مفتاحية/, "central midfield KPIs must include key passes");
assert.match(markup, /صناعات/, "central midfield KPIs must include assists");
assert.match(markup, /افتكاكات واسترجاعات/, "central midfield KPIs must include defensive recoveries");
assert.doesNotMatch(markup, /مساهمات تهديفية/, "central midfield must not be displayed with the generic attacker KPI");

console.log("PASS: central-midfield performance advice and role-specific KPI cards.");
