"use strict";

// The planner file: a copy of everything the site keeps in the browser (weeks, meals, saved weeks, settings),
// so it survives browsers that clear a site's data when they close. Pure functions over a localStorage-like
// object, so they can be tested without a browser.
const Backup = (() => {
  const APP = "meal-planning-weekly";

  // Every stored value is kept as the exact text the site wrote, so restoring is lossless.
  function snapshot(storage, keys) {
    const data = {};
    keys.forEach((k) => {
      const v = storage.getItem(k);
      if (v != null) data[k] = v;
    });
    return { app: APP, version: 1, savedAt: new Date().toISOString(), data };
  }

  function isPlannerFile(obj) {
    return !!obj && typeof obj === "object" && obj.app === APP && !!obj.data && typeof obj.data === "object" && !Array.isArray(obj.data);
  }

  function parse(text) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      throw new Error("That file isn't a planner file (it isn't readable).");
    }
    if (!isPlannerFile(obj)) throw new Error("That file isn't a planner file from this site.");
    return obj;
  }

  const parseValue = (raw) => {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return undefined;
    }
  };

  // What is in a planner file, for confirming before it replaces what the browser has.
  function summarize(obj) {
    const d = (obj && obj.data) || {};
    const plans = parseValue(d.mpw_plans) || {};
    const meals = parseValue(d.mpw_meals) || [];
    const weeks = Object.values(plans).filter((p) => p && Object.values(p.cells || {}).some((c) => c && String(c.text || "").trim())).length;
    return { savedAt: obj.savedAt || null, weeks, meals: Array.isArray(meals) ? meals.length : 0 };
  }

  // Writes the file's values back, only for keys the site owns and only values that are valid JSON.
  function restore(obj, storage, keys) {
    if (!isPlannerFile(obj)) throw new Error("That file isn't a planner file from this site.");
    const allowed = new Set(keys);
    const toWrite = [];
    Object.entries(obj.data).forEach(([k, v]) => {
      if (!allowed.has(k) || typeof v !== "string" || parseValue(v) === undefined) return;
      toWrite.push([k, v]);
    });
    toWrite.forEach(([k, v]) => storage.setItem(k, v));
    return toWrite.length;
  }

  return { APP, snapshot, isPlannerFile, parse, summarize, restore };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Backup;
