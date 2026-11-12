"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const stateStoreSource = fs.readFileSync(path.join(root, "career-state-store.js"), "utf8");
const agentSource = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");

function createIndexedDb() {
  const records = new Map();
  const stores = new Set();
  let opened = false;
  let failNextWrite = false;

  const database = {
    objectStoreNames: { contains(name) { return stores.has(name); } },
    createObjectStore(name) {
      stores.add(name);
      return { createIndex() {} };
    },
    close() {},
    transaction(storeName, mode) {
      assert.equal(storeName, "saves");
      assert.ok(mode === "readonly" || mode === "readwrite");
      const tx = {
        error: null,
        aborted: false,
        oncomplete: null,
        onerror: null,
        onabort: null,
        abort() {
          if (this.aborted) return;
          this.aborted = true;
          queueMicrotask(() => {
            if (typeof this.onabort === "function") this.onabort();
          });
        },
        objectStore(name) {
          assert.equal(name, "saves");
          return {
            put(record) {
              assert.equal(mode, "readwrite");
              queueMicrotask(() => {
                if (failNextWrite) {
                  failNextWrite = false;
                  tx.error = new Error("simulated IndexedDB write failure");
                  tx.aborted = true;
                  if (typeof tx.onabort === "function") tx.onabort();
                  return;
                }
                records.set(record.id, structuredClone(record));
                if (typeof tx.oncomplete === "function") tx.oncomplete();
              });
              return {};
            },
            get(id) {
              assert.equal(mode, "readonly");
              const request = {};
              queueMicrotask(() => {
                request.result = records.has(id) ? structuredClone(records.get(id)) : undefined;
                if (typeof request.onsuccess === "function") request.onsuccess();
              });
              return request;
            },
            getAll() {
              assert.equal(mode, "readonly");
              const request = {};
              queueMicrotask(() => {
                request.result = Array.from(records.values()).map(value => structuredClone(value));
                if (typeof request.onsuccess === "function") request.onsuccess();
              });
              return request;
            },
            delete(id) {
              assert.equal(mode, "readwrite");
              queueMicrotask(() => {
                records.delete(id);
                if (typeof tx.oncomplete === "function") tx.oncomplete();
              });
              return {};
            }
          };
        }
      };
      return tx;
    }
  };

  const indexedDB = {
    open(name, version) {
      assert.equal(name, "last-whistle-state");
      assert.equal(version, 1);
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        if (!opened) {
          opened = true;
          if (typeof request.onupgradeneeded === "function") request.onupgradeneeded();
        }
        if (typeof request.onsuccess === "function") request.onsuccess();
      });
      return request;
    }
  };

  return {
    indexedDB,
    failNextWrite() { failNextWrite = true; },
    record(id = "career:default") { return records.get(id) || null; }
  };
}

function createStore(indexedDB) {
  const window = { indexedDB, structuredClone, console };
  const sandbox = { window, Promise, Date, structuredClone, console };
  vm.createContext(sandbox);
  vm.runInContext(stateStoreSource, sandbox, { filename: "career-state-store.js" });
  return window.LWStateStore;
}

function extractFunction(source, name) {
  const marker = "function " + name + "(";
  const index = source.indexOf(marker);
  assert.ok(index >= 0, "missing source function " + name);
  const start = source.slice(0, index).endsWith("async ") ? index - 6 : index;
  const brace = source.indexOf("{", index);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === "\`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated source function " + name);
}

function createAgentHarness(window) {
  const extracted = [
    "safeAgentText",
    "acquireSharedMutationLock",
    "releaseSharedMutationLock",
    "restorePostRetirementMutationState",
    "flushPostRetirementMutation",
    "runAgentContractMutation"
  ].map(name => extractFunction(agentSource, name)).join("\n");

  const sandbox = {
    window,
    Promise,
    Error,
    Object,
    console,
    API: () => window.LWStoryRuntime,
    cloneAgentContractMutationSnapshot: state => structuredClone(state),
    renderPanel() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(
    "var agentContractMutationPending = false;\n" +
    "var postRetirementMutationPending = false;\n" +
    extracted +
    "\nglobalThis.runAgentContractMutation = runAgentContractMutation;",
    sandbox,
    { filename: "agent-system-persistence-harness.js" }
  );
  return sandbox.runAgentContractMutation;
}

function makeCareer() {
  return {
    name: "لاعب الاختبار",
    careerStarted: true,
    retired: false,
    season: 2,
    apps: 14,
    money: 4200,
    agent: false,
    agentLead: null,
    agentProfile: null,
    agentHistory: []
  };
}

async function runScenario({ failWrite = false } = {}) {
  const db = createIndexedDb();
  const store = createStore(db.indexedDB);
  const state = makeCareer();
  assert.equal(await store.flush(state), true, "the baseline career must be durably saved");

  const notices = [];
  const window = {
    LWStateStore: store,
    structuredClone,
    console,
    LWStoryRuntime: {
      getState: () => state,
      save: () => true,
      render() {},
      toast(message) { notices.push(String(message)); }
    }
  };
  const mutateAgent = createAgentHarness(window);

  if (failWrite) db.failNextWrite();
  const result = await mutateAgent(state, function () {
    state.agent = true;
    state.agentProfile = {
      id: "hossam",
      agentName: "حسام الجندي",
      customFeeRate: 0.05,
      relationship: 55,
      storyStage: 0
    };
    state.agentHistory.push({
      title: "توقيع اتفاق تمثيل",
      description: "تم توقيع اتفاق الوكالة داخل اللعبة."
    });
    state.money -= 150;
    return { agentId: "hossam", feeRate: 0.05 };
  }, "تم حفظ اتفاق الوكيل.");

  const reloadedStore = createStore(db.indexedDB);
  const persisted = await reloadedStore.load();
  return { db, state, result, persisted, notices, window };
}

(async function main() {
  const success = await runScenario();
  assert.equal(success.result.ok, true, "agent lifecycle mutation should complete");
  assert.equal(success.result.agentId, "hossam");
  assert.equal(success.state.money, 4050);
  assert.equal(success.persisted.agent, true,
    "a fresh state-store instance must reload the active agent flag");
  assert.equal(success.persisted.agentProfile.id, "hossam",
    "the selected agent profile must survive a durable reload");
  assert.equal(success.persisted.agentHistory.length, 1,
    "the signing history must survive a durable reload");
  assert.equal(success.persisted.money, 4050,
    "the agent transaction and balance change must be persisted together");
  assert.equal(success.window.__LW_DURABLE_MUTATION_LOCK__.owner, "",
    "the shared transaction lock must be released after a successful save");

  const failed = await runScenario({ failWrite: true });
  assert.equal(failed.result.ok, false,
    "an IndexedDB failure must reject the agent transaction");
  assert.equal(failed.result.rollbackPersisted, true,
    "the pre-mutation snapshot must be durably restored after a failed write");
  assert.equal(failed.state.agent, false,
    "a failed signing transaction must restore the in-memory agent flag");
  assert.equal(failed.state.agentProfile, null,
    "a failed signing transaction must restore the previous agent profile");
  assert.equal(failed.state.money, 4200,
    "a failed signing transaction must restore the previous balance");
  assert.equal(failed.persisted.agent, false,
    "a fresh state-store instance must reload the pre-mutation agent state");
  assert.equal(failed.persisted.agentProfile, null,
    "the failed agent profile must not leak into the persisted career");
  assert.equal(failed.persisted.money, 4200,
    "the rollback balance must be the durable value after reload");
  assert.equal(failed.window.__LW_DURABLE_MUTATION_LOCK__.owner, "",
    "the shared transaction lock must be released after rollback");

  console.log("PASS: agent lifecycle mutations persist through IndexedDB reload and failed writes restore the previous career snapshot.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
