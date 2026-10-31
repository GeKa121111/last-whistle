/* LAST WHISTLE — unified state bus + IndexedDB save repository.
 * IndexedDB is primary storage. localStorage remains a migration/failure fallback.
 */
(function (global) {
  "use strict";
  if (global.LWStateStore) return;
  const DB_NAME = "last-whistle-state";
  const DB_VERSION = 1;
  const DEFAULT_SLOT = "career:default";
  const POSITION_ALIASES = Object.freeze({
    gk: "حارس مرمى", goalkeeper: "حارس مرمى", keeper: "حارس مرمى", goalie: "حارس مرمى",
    cb: "قلب دفاع", lcb: "قلب دفاع", rcb: "قلب دفاع", centerback: "قلب دفاع", "center back": "قلب دفاع",
    centreback: "قلب دفاع", "centre back": "قلب دفاع", centraldefender: "قلب دفاع", "central defender": "قلب دفاع",
    lb: "ظهير", rb: "ظهير", lwb: "ظهير", rwb: "ظهير", wb: "ظهير", fb: "ظهير",
    leftback: "ظهير", "left back": "ظهير", rightback: "ظهير", "right back": "ظهير",
    fullback: "ظهير", "full back": "ظهير", wingback: "ظهير", "wing back": "ظهير",
    cdm: "وسط دفاعي", dm: "وسط دفاعي", "defensive midfielder": "وسط دفاعي", "defensive mid": "وسط دفاعي",
    holdingmidfielder: "وسط دفاعي", "holding midfielder": "وسط دفاعي",
    cam: "وسط مهاجم", am: "وسط مهاجم", "attacking midfielder": "وسط مهاجم", "attacking mid": "وسط مهاجم",
    cm: "وسط", rcm: "وسط", lcm: "وسط", mf: "وسط", midfield: "وسط",
    "central midfielder": "وسط", "central midfield": "وسط", midfielder: "وسط",
    lw: "جناح", rw: "جناح", lm: "جناح", rm: "جناح", lwf: "جناح", rwf: "جناح",
    "left wing": "جناح", "right wing": "جناح", winger: "جناح", "wide midfielder": "جناح",
    cf: "مهاجم", ss: "مهاجم", "second striker": "مهاجم", "mobile forward": "مهاجم",
    st: "رأس حربة", fw: "رأس حربة", fwd: "رأس حربة", striker: "رأس حربة", forward: "رأس حربة",
    "centre forward": "رأس حربة", "center forward": "رأس حربة"
  });
  function normalizePosition(position) {
    const raw = String(position == null ? "" : position).normalize("NFKC").trim();
    if (!raw) return "";
    const key = raw.toLocaleLowerCase("en")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
      .replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return POSITION_ALIASES[key] || raw;
  }
  const listeners = new Set();
  let database = null, opening = null, currentState = null, startupSave = null, revision = 0, lastWrite = Promise.resolve();
  function safeClone(value) {
    if (!value || typeof value !== "object") return value;
    try { if (typeof global.structuredClone === "function") return global.structuredClone(value); } catch (_) {}
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  }
  function openDatabase() {
    if (database) return Promise.resolve(database);
    if (opening) return opening;
    if (!global.indexedDB) return Promise.resolve(null);
    opening = new Promise(function (resolve, reject) {
      let request;
      try { request = global.indexedDB.open(DB_NAME, DB_VERSION); } catch (error) { reject(error); return; }
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains("saves")) {
          const store = db.createObjectStore("saves", { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = function () {
        database = request.result;
        database.onversionchange = function () { database.close(); database = null; opening = null; };
        resolve(database);
      };
      request.onerror = function () { reject(request.error || new Error("IndexedDB open failed")); };
      request.onblocked = function () { reject(new Error("IndexedDB open blocked by another tab")); };
    }).catch(function (error) { opening = null; throw error; });
    return opening;
  }
  function transact(storeName, mode, callback) {
    return openDatabase().then(function (db) {
      if (!db) throw new Error("IndexedDB is not available");
      return new Promise(function (resolve, reject) {
        let tx;
        try { tx = db.transaction(storeName, mode); } catch (error) { reject(error); return; }
        let result;
        try { result = callback(tx.objectStore(storeName), tx); }
        catch (error) { try { tx.abort(); } catch (_) {} reject(error); return; }
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || new Error("IndexedDB transaction failed")); };
        tx.onabort = function () { reject(tx.error || new Error("IndexedDB transaction aborted")); };
      });
    });
  }
  function readRecord(id) {
    return openDatabase().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve, reject) {
        const request = db.transaction("saves", "readonly").objectStore("saves").get(id);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error || new Error("IndexedDB read failed")); };
      });
    });
  }
  const ready = !global.document
    ? Promise.resolve({ available: false, hasSave: false, worker: true, slotId: DEFAULT_SLOT })
    : (async function () {
      try {
        const record = await readRecord(DEFAULT_SLOT);
        if (record && record.state && typeof record.state === "object") {
          startupSave = record.state;
          currentState = record.state;
        }
        return { available: !!database, hasSave: !!startupSave, slotId: DEFAULT_SLOT };
      } catch (error) {
        return { available: false, hasSave: false, error: String(error && error.message || error) };
      }
    })();
  function notify(meta) {
    const event = Object.freeze({ revision, state: currentState, meta: meta || {}, timestamp: Date.now() });
    listeners.forEach(function (listener) {
      try { listener(event); } catch (error) { if (global.console) global.console.warn("LWStateStore listener failed", error); }
    });
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function")
        global.dispatchEvent(new global.CustomEvent("lw:state-change", { detail: event }));
    } catch (_) {}
  }
  function publish(state, meta) {
    if (!state || typeof state !== "object") return revision;
    currentState = state;
    const source = meta && meta.source;
    if (source === "load" || source === "import" || source === "migration") startupSave = state;
    revision += 1; notify(meta); return revision;
  }
  function save(state, options) {
    options = typeof options === "string" ? { slotId: options } : (options || {});
    const id = String(options.slotId || DEFAULT_SLOT);
    const snapshot = safeClone(state);
    if (!snapshot || typeof snapshot !== "object") return Promise.reject(new Error("Invalid career save"));
    if (id === DEFAULT_SLOT) publish(state, { source: "save", slotId: id });
    const record = {
      id, label: String(options.label || snapshot.name || (id === DEFAULT_SLOT ? "المسيرة الرئيسية" : id)),
      updatedAt: new Date().toISOString(), game: "LAST WHISTLE",
      schemaVersion: Number(snapshot.schemaVersion) || 10, season: Math.max(1, Number(snapshot.season) || 1),
      playerName: String(snapshot.name || "لاعب"), state: snapshot
    };
    lastWrite = transact("saves", "readwrite", store => store.put(record)).then(function () {
      if (id === DEFAULT_SLOT) startupSave = snapshot;
      return { id, updatedAt: record.updatedAt, revision };
    });
    return lastWrite;
  }
  async function load(slotId) {
    const id = String(slotId || DEFAULT_SLOT), record = await readRecord(id);
    if (!record || !record.state) return null;
    const result = safeClone(record.state);
    if (id === DEFAULT_SLOT) { startupSave = result; publish(result, { source: "load", slotId: id }); }
    return result;
  }
  async function listSaves() {
    const db = await openDatabase();
    if (!db) return [];
    return new Promise(function (resolve, reject) {
      const request = db.transaction("saves", "readonly").objectStore("saves").getAll();
      request.onsuccess = function () {
        resolve((request.result || []).map(row => ({
          id: row.id, label: row.label, updatedAt: row.updatedAt,
          season: row.season, playerName: row.playerName, schemaVersion: row.schemaVersion
        })).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
      };
      request.onerror = function () { reject(request.error || new Error("IndexedDB slot listing failed")); };
    });
  }
  async function deleteSave(slotId) {
    const id = String(slotId || "");
    if (!id) throw new Error("A save-slot id is required");
    if (id === DEFAULT_SLOT) throw new Error("The default career slot cannot be deleted");
    await transact("saves", "readwrite", store => store.delete(id)); return true;
  }
  async function flush(state) { if (state && typeof state === "object") await save(state, {slotId:DEFAULT_SLOT}); await lastWrite; return true; }
  function selectorSignature(value) {
    if (value === undefined) return "undefined";
    if (value === null || typeof value !== "object") return typeof value + ":" + String(value);
    try {
      const encoded = JSON.stringify(value);
      return typeof encoded === "string" ? encoded : String(encoded);
    } catch (_) {
      return Object.prototype.toString.call(value);
    }
  }
  function subscribeSelector(selector, listener, equals) {
    if (typeof selector !== "function" || typeof listener !== "function") return function () {};
    let selected;
    try { selected = safeClone(selector(currentState)); } catch (_) { selected = undefined; }
    let signature = selectorSignature(selected);
    const wrapped = function (event) {
      let next;
      try { next = selector(event && event.state); } catch (_) { return; }
      const nextSignature = selectorSignature(next);
      let unchanged = nextSignature === signature;
      if (typeof equals === "function") {
        try { unchanged = !!equals(selected, next); } catch (_) { unchanged = false; }
      }
      if (unchanged) return;
      const previous = selected;
      selected = safeClone(next);
      signature = nextSignature;
      try { listener(event, next, previous); }
      catch (error) { if (global.console) global.console.warn("LWStateStore selector listener failed", error); }
    };
    listeners.add(wrapped);
    return function () { listeners.delete(wrapped); };
  }
  global.LWStateStore = Object.freeze({
    version: 2, defaultSlot: DEFAULT_SLOT, ready: () => ready, publish, normalizePosition,
    getState: () => currentState, getStartupSave: () => startupSave, getRevision: () => revision,
    subscribe: function (listener) { if (typeof listener !== "function") return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
    subscribeSelector, save, load, listSaves, deleteSave, flush, openDatabase
  });
})(window);
