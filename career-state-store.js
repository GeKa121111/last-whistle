/* LAST WHISTLE — unified state bus + IndexedDB save repository.
 * IndexedDB is primary storage. localStorage remains a migration/failure fallback.
 */
(function (global) {
  "use strict";
  if (global.LWStateStore) return;
  const DB_NAME = "last-whistle-state";
  const DB_VERSION = 1;
  const DEFAULT_SLOT = "career:default";
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
  const ready = (async function () {
    try {
      const record = await readRecord(DEFAULT_SLOT);
      if (record && record.state && typeof record.state === "object") { startupSave = record.state; currentState = record.state; }
      return { available: !!database, hasSave: !!startupSave, slotId: DEFAULT_SLOT };
    } catch (error) { return { available: false, hasSave: false, error: String(error && error.message || error) }; }
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
  global.LWStateStore = Object.freeze({
    version: 1, defaultSlot: DEFAULT_SLOT, ready: () => ready, publish,
    getState: () => currentState, getStartupSave: () => startupSave, getRevision: () => revision,
    subscribe: function (listener) { if (typeof listener !== "function") return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
    save, load, listSaves, deleteSave, flush, openDatabase
  });
})(window);
