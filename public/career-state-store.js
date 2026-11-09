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
    "left wing back": "ظهير", "right wing back": "ظهير",
    cdm: "وسط دفاعي", dm: "وسط دفاعي", "defensive midfielder": "وسط دفاعي", "defensive mid": "وسط دفاعي",
    holdingmidfielder: "وسط دفاعي", "holding midfielder": "وسط دفاعي",
    cam: "وسط مهاجم", am: "وسط مهاجم", "attacking midfielder": "وسط مهاجم", "attacking mid": "وسط مهاجم",
    cm: "وسط", rcm: "وسط", lcm: "وسط", mf: "وسط", midfield: "وسط",
    "central midfielder": "وسط", "central midfield": "وسط", midfielder: "وسط",
    lw: "جناح", rw: "جناح", lm: "جناح", rm: "جناح", lwf: "جناح", rwf: "جناح",
    "left wing": "جناح", "right wing": "جناح", winger: "جناح",
    "left winger": "جناح", "right winger": "جناح",
    "left midfielder": "جناح", "right midfielder": "جناح", "wide midfielder": "جناح",
    cf: "مهاجم", ss: "مهاجم", "second striker": "مهاجم", "mobile forward": "مهاجم",
    st: "رأس حربة", fw: "رأس حربة", fwd: "رأس حربة", striker: "رأس حربة", forward: "رأس حربة",
    "centre forward": "رأس حربة", "center forward": "رأس حربة"
  });
  function normalizePosition(position) {
    // Position fields come from imported/legacy saves. Only coerce safe
    // primitives; JSON objects and arrays can shadow toString/valueOf and throw.
    const raw = typeof position === "string"
      ? position
      : typeof position === "number" && Number.isFinite(position)
        ? String(position)
        : "";
    const normalized = raw.normalize("NFKC").trim();
    if (!normalized) return "";
    const rawPosition = normalized;
    const key = rawPosition.toLocaleLowerCase("en")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
      .replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return Object.prototype.hasOwnProperty.call(POSITION_ALIASES, key)
      ? POSITION_ALIASES[key]
      : rawPosition;
  }
  const listeners = new Set();
  let database = null, opening = null, currentState = null, startupSave = null, revision = 0, lastWrite = Promise.resolve(), pendingDefaultWrite = null, activeDefaultFlush = null, activeDefaultFlushRequested = false;
  function safeClone(value) {
    if (!value || typeof value !== "object") return value;
    try { if (typeof global.structuredClone === "function") return global.structuredClone(value); } catch (_) {}
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  }
  // Career saves and IndexedDB slot records must be plain data records.
  // Date, Map, Set, typed arrays, class instances, and unsafe proxies are not
  // valid career containers, even though JavaScript reports them as objects.
  function isCareerState(value) {
    if (!value || typeof value !== "object") return false;
    try {
      if (Array.isArray(value)) return false;
      const prototype = Object.getPrototypeOf(value);
      if (prototype === null) return true;
      // Accept plain records from another realm (for example, an imported iframe
      // object) without accepting Date/Map/Set or custom class instances.
      return Object.getPrototypeOf(prototype) === null
        && Object.prototype.hasOwnProperty.call(prototype, "constructor")
        && typeof prototype.constructor === "function"
        && prototype.constructor.name === "Object";
    } catch (_) {
      return false;
    }
  }
  // Save-record metadata must never coerce arbitrary values from a legacy career.
  // Keep numeric strings for older saves, but reject arrays/objects/booleans and non-finite numbers.
  function finiteMetadataNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || value.trim() === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  function safeMetadataText(value, fallback) {
    if (typeof value === "string") return value.trim() ? value : fallback;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
  }
  function safeMetadataTimestamp(value) {
    if (typeof value === "string") return value.trim() ? value : "";
    if (typeof value === "number" && Number.isFinite(value)) {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.toISOString() : "";
    }
    if (value instanceof Date) {
      const timestamp = Date.prototype.getTime.call(value);
      return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
    }
    return "";
  }
  // Slot identifiers can come from imported UI state. Never coerce objects or arrays.
  // Preserve the existing default-slot behavior for omitted/empty/falsy legacy values.
  function normalizeSlotId(value, fallback) {
    if (value === undefined || value === null || value === "" || value === 0 || value === false) return fallback;
    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized || fallback;
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
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
      const startupRevision = revision;
      try {
        const record = await readRecord(DEFAULT_SLOT);
        // An import or new career can publish while IndexedDB is still opening.
        // Never let that older startup snapshot replace a newer live state.
        if (isCareerState(record) && isCareerState(record.state) && revision === startupRevision) {
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
  function abortPendingDefaultWrite() {
    const pending = pendingDefaultWrite;
    if (!pending || pending.superseded) return;
    pending.superseded = true;
    try { pending.transaction.abort(); }
    catch (error) {
      if (global.console) global.console.warn("LWStateStore could not abort a superseded default save", error);
    }
  }
  function publish(state, meta) {
    if (!isCareerState(state)) return revision;
    // A load/import/newer publish supersedes any default-slot transaction that has
    // not committed yet. Protecting startupSave alone is insufficient: the stale
    // IndexedDB put itself must not be allowed to overwrite the selected career.
    abortPendingDefaultWrite();
    currentState = state;
    const source = meta && meta.source;
    if (source === "load" || source === "import" || source === "migration") startupSave = state;
    revision += 1; notify(meta); return revision;
  }
  // Invalidate in-flight worker snapshots as soon as an in-memory career mutation
  // is queued, without notifying render subscribers before the durable write.
  function markDirty(state) {
    if (!isCareerState(state)) return revision;
    abortPendingDefaultWrite();
    currentState = state;
    revision += 1;
    return revision;
  }
  function save(state, options) {
    options = typeof options === "string" ? { slotId: options } : (options || {});
    const id = normalizeSlotId(options.slotId, DEFAULT_SLOT);
    if (id === null) return Promise.reject(new Error("Invalid save-slot id"));
    if (!isCareerState(state)) return Promise.reject(new Error("Invalid career save"));
    const snapshot = safeClone(state);
    if (!isCareerState(snapshot)) return Promise.reject(new Error("Invalid career save"));
    if (id === DEFAULT_SLOT) publish(state, { source: "save", slotId: id });
    const saveRevision = revision;
    const schemaVersionValue = finiteMetadataNumber(snapshot.schemaVersion);
    const seasonValue = finiteMetadataNumber(snapshot.season);
    const fallbackLabel = id === DEFAULT_SLOT ? "المسيرة الرئيسية" : id;
    const playerName = safeMetadataText(snapshot.name, "لاعب");
    const record = {
      id, label: safeMetadataText(options.label, safeMetadataText(snapshot.name, fallbackLabel)),
      updatedAt: new Date().toISOString(), game: "LAST WHISTLE",
      schemaVersion: schemaVersionValue === null || schemaVersionValue === 0 ? 10 : schemaVersionValue,
      season: Math.max(1, seasonValue || 1),
      playerName, state: snapshot
    };
    if (id !== DEFAULT_SLOT) {
      lastWrite = transact("saves", "readwrite", store => store.put(record));
      return lastWrite;
    }
    // Check the revision after the asynchronous database open, then keep the
    // transaction abortable until IndexedDB confirms that it has committed.
    lastWrite = openDatabase().then(function (db) {
      if (!db) throw new Error("IndexedDB is not available");
      if (revision !== saveRevision) {
        return { id, updatedAt: record.updatedAt, revision, superseded: true };
      }
      return new Promise(function (resolve, reject) {
        let tx;
        try { tx = db.transaction("saves", "readwrite"); }
        catch (error) { reject(error); return; }
        const pending = { transaction: tx, superseded: false };
        pendingDefaultWrite = pending;
        const clearPending = function () {
          if (pendingDefaultWrite === pending) pendingDefaultWrite = null;
        };
        tx.oncomplete = function () {
          clearPending();
          if (revision === saveRevision && !pending.superseded) startupSave = snapshot;
          const result = { id, updatedAt: record.updatedAt, revision };
          if (pending.superseded) result.superseded = true;
          resolve(result);
        };
        tx.onerror = function () {
          if (pending.superseded) return;
          clearPending();
          reject(tx.error || new Error("IndexedDB transaction failed"));
        };
        tx.onabort = function () {
          clearPending();
          if (pending.superseded) {
            resolve({ id, updatedAt: record.updatedAt, revision, superseded: true });
          } else {
            reject(tx.error || new Error("IndexedDB transaction aborted"));
          }
        };
        if (revision !== saveRevision) {
          pending.superseded = true;
          try { tx.abort(); }
          catch (error) {
            clearPending();
            resolve({ id, updatedAt: record.updatedAt, revision, superseded: true });
          }
          return;
        }
        try { tx.objectStore("saves").put(record); }
        catch (error) {
          clearPending();
          try { tx.abort(); } catch (_) {}
          reject(error);
        }
      });
    });
    return lastWrite;
  }
  async function load(slotId) {
    const id = normalizeSlotId(slotId, DEFAULT_SLOT);
    if (id === null) return null;
    const loadRevision = revision;
    const record = await readRecord(id);
    if (!isCareerState(record) || !isCareerState(record.state)) return null;
    const result = safeClone(record.state);
    if (!isCareerState(result)) return null;
    // A delayed explicit load must not replace a newer import, save, or live publish.
    if (id === DEFAULT_SLOT && revision === loadRevision) {
      startupSave = result;
      publish(result, { source: "load", slotId: id });
    }
    return result;
  }
  async function listSaves() {
    const db = await openDatabase();
    if (!db) return [];
    return new Promise(function (resolve, reject) {
      const request = db.transaction("saves", "readonly").objectStore("saves").getAll();
      request.onsuccess = function () {
        const rows = Array.isArray(request.result) ? request.result : [];
        const entries = rows.map(function (row, index) {
          if (!isCareerState(row)) return null;
          const id = normalizeSlotId(row.id, "");
          if (!id) return null;
          const updatedAt = safeMetadataTimestamp(row.updatedAt);
          const parsedTimestamp = Date.parse(updatedAt);
          return {
            index,
            timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0,
            value: {
              id,
              label: safeMetadataText(row.label, safeMetadataText(row.playerName, "مسيرة محفوظة")),
              updatedAt,
              season: finiteMetadataNumber(row.season),
              playerName: safeMetadataText(row.playerName, "لاعب"),
              schemaVersion: finiteMetadataNumber(row.schemaVersion)
            }
          };
        }).filter(Boolean);
        entries.sort((a, b) => b.timestamp - a.timestamp || a.index - b.index);
        resolve(entries.map(entry => entry.value));
      };
      request.onerror = function () { reject(request.error || new Error("IndexedDB slot listing failed")); };
    });
  }
  async function deleteSave(slotId) {
    const id = normalizeSlotId(slotId, "");
    if (id === null || !id) throw new Error("A valid save-slot id is required");
    if (id === DEFAULT_SLOT) throw new Error("The default career slot cannot be deleted");
    await transact("saves", "readwrite", store => store.delete(id)); return true;
  }
  function flush(state) {
    // A caller arriving while the current writer is completing must not be
    // lost between the final revision check and release of the shared promise.
    if (activeDefaultFlush) {
      activeDefaultFlushRequested = true;
      return activeDefaultFlush;
    }
    activeDefaultFlushRequested = false;
    const requested = isCareerState(state) ? state : null;
    const work = Promise.resolve().then(async function () {
      let target = isCareerState(currentState) ? currentState : requested;
      if (!isCareerState(target)) {
        await lastWrite;
        return true;
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        activeDefaultFlushRequested = false;
        const result = await save(target, { slotId: DEFAULT_SLOT });
        if (!result || result.superseded === true || activeDefaultFlushRequested) {
          target = isCareerState(currentState) ? currentState : null;
          if (!isCareerState(target)) return false;
          continue;
        }
        // A mutation may land just after the IndexedDB transaction completes but
        // before this continuation runs. Compare revisions as well as references.
        if (Number.isFinite(Number(result.revision)) && Number(result.revision) !== revision) {
          target = isCareerState(currentState) ? currentState : null;
          if (!isCareerState(target)) return false;
          continue;
        }
        if (isCareerState(currentState) && currentState !== target) {
          target = isCareerState(currentState) ? currentState : null;
          continue;
        }
        return true;
      }
      return false;
    });
    let active;
    active = work.then(function (result) {
      if (activeDefaultFlush === active) activeDefaultFlush = null;
      if (activeDefaultFlushRequested) {
        activeDefaultFlushRequested = false;
        return flush(isCareerState(currentState) ? currentState : requested);
      }
      return result;
    }, function (error) {
      if (activeDefaultFlush === active) activeDefaultFlush = null;
      activeDefaultFlushRequested = false;
      throw error;
    });
    activeDefaultFlush = active;
    return active;
  }
  let selectorSignatureFallbackSequence = 0;
  function selectorSignature(value) {
    if (value === undefined) return "undefined";
    if (value === null || typeof value !== "object") return typeof value + ":" + String(value);
    try {
      const encoded = JSON.stringify(value);
      return typeof encoded === "string" ? encoded : String(encoded);
    } catch (_) {
      // Circular values, throwing accessors, and revoked proxies cannot be
      // inspected safely. Treat each observation as changed rather than
      // calling Object.prototype.toString, which can itself trigger proxy traps.
      return "unserializable:" + (++selectorSignatureFallbackSequence);
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
    version: 3, defaultSlot: DEFAULT_SLOT, ready: () => ready, publish, markDirty, normalizePosition,
    getState: () => currentState, getStartupSave: () => startupSave, getRevision: () => revision,
    subscribe: function (listener) { if (typeof listener !== "function") return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
    subscribeSelector, save, load, listSaves, deleteSave, flush, openDatabase
  });
})(window);
