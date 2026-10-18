"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Backup = require("../js/backup.js");

const KEYS = ["mpw_meals", "mpw_plans", "mpw_current_week_key", "mpw_slide_meals_v1"];
const fakeStorage = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};

const sample = () =>
  fakeStorage({
    mpw_meals: JSON.stringify([{ id: "a", name: "Burgers" }, { id: "b", name: "Soup" }]),
    mpw_plans: JSON.stringify({ "2026-10-18": { weekStart: "2026-10-18", cells: { "2026-10-19_kids-dinner": { text: "Burgers" } }, special: { "2026-10-22": "Birthday" } } }),
    mpw_current_week_key: JSON.stringify("2026-10-18"),
    mpw_slide_meals_v1: "true",
    unrelated: "keep out",
  });

test("a snapshot holds exactly the site's keys and nothing else", () => {
  const snap = Backup.snapshot(sample(), KEYS);
  assert.equal(snap.app, "meal-planning-weekly");
  assert.deepEqual(Object.keys(snap.data).sort(), [...KEYS].sort());
  assert.ok(!("unrelated" in snap.data));
  assert.ok(Date.parse(snap.savedAt));
});

test("saving to a file and restoring into an empty browser brings back the latest week", () => {
  const file = JSON.stringify(Backup.snapshot(sample(), KEYS));
  const wiped = fakeStorage();
  const n = Backup.restore(Backup.parse(file), wiped, KEYS);
  assert.equal(n, 4);
  assert.deepEqual(JSON.parse(wiped.getItem("mpw_plans"))["2026-10-18"].cells["2026-10-19_kids-dinner"], { text: "Burgers" });
  assert.equal(JSON.parse(wiped.getItem("mpw_plans"))["2026-10-18"].special["2026-10-22"], "Birthday");
  assert.equal(JSON.parse(wiped.getItem("mpw_current_week_key")), "2026-10-18");
  assert.equal(wiped.getItem("mpw_slide_meals_v1"), "true"); // so the one-time imports do not run twice
});

test("restore replaces what is there with the saved version", () => {
  const file = Backup.snapshot(sample(), KEYS);
  const other = fakeStorage({ mpw_plans: JSON.stringify({ old: { cells: {} } }) });
  Backup.restore(file, other, KEYS);
  assert.deepEqual(Object.keys(JSON.parse(other.getItem("mpw_plans"))), ["2026-10-18"]);
});

test("restore ignores keys the site does not own and values that are not valid JSON", () => {
  const file = { app: Backup.APP, version: 1, data: { mpw_meals: "[1,2]", evil: "x", mpw_plans: "{not json", mpw_current_week_key: 5 } };
  const s = fakeStorage();
  assert.equal(Backup.restore(file, s, KEYS), 1);
  assert.equal(s.getItem("mpw_meals"), "[1,2]");
  assert.equal(s.getItem("evil"), null);
  assert.equal(s.getItem("mpw_plans"), null);
});

test("files that are not planner files are refused", () => {
  assert.throws(() => Backup.parse("not json at all"), /isn't a planner file/);
  assert.throws(() => Backup.parse(JSON.stringify({ hello: "world" })), /isn't a planner file/);
  assert.throws(() => Backup.parse(JSON.stringify({ app: "something-else", data: {} })), /isn't a planner file/);
  assert.throws(() => Backup.restore({ app: "meal-planning-weekly", data: [] }, fakeStorage(), KEYS), /isn't a planner file/);
  assert.equal(Backup.isPlannerFile(null), false);
});

test("a summary says how many weeks with meals and how many meals a file holds", () => {
  const snap = Backup.snapshot(sample(), KEYS);
  const sum = Backup.summarize(snap);
  assert.equal(sum.weeks, 1);
  assert.equal(sum.meals, 2);
  assert.equal(sum.savedAt, snap.savedAt);
  assert.deepEqual(Backup.summarize({ app: Backup.APP, data: {} }), { savedAt: null, weeks: 0, meals: 0 });
});
