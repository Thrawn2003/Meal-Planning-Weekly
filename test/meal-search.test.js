"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const MealSearch = require("../js/meal-search.js");
const SlideMeals = require("../js/slide-meals.js");

const SLOTS = ["kids-breakfast", "namath-lunch", "kids-dinner", "parents-breakfast", "parents-lunch", "parents-dinner"].map((key) => ({ key }));
const mk = (id, name, slots) => ({ id, name, slots });
const names = (list) => list.map((m) => m.name);

test("dinner boxes only offer dinner meals, other boxes offer everything with their own first", () => {
  const meals = [mk("1", "Avocado Toast", ["kids-breakfast"]), mk("2", "Burgers", ["kids-dinner", "parents-dinner"]), mk("3", "Date Night", ["parents-dinner"]), mk("4", "Soup", []), mk("5", "Samosa", ["namath-lunch"])];
  assert.deepEqual(names(MealSearch.optionsFor(meals, "kids-dinner")), ["Burgers", "Soup", "Date Night"]); // Date Night is a Parents Dinner
  assert.deepEqual(names(MealSearch.optionsFor(meals, "parents-dinner")), ["Burgers", "Date Night", "Soup"]);
  // lunch: every meal, the ones ticked for lunch (or ticked for nothing) first
  assert.deepEqual(names(MealSearch.optionsFor(meals, "namath-lunch")), ["Samosa", "Soup", "Avocado Toast", "Burgers", "Date Night"]);
  assert.equal(MealSearch.optionsFor(meals, "kids-breakfast").length, 5);
});

test("with the family's slide meals, dinner boxes list dinners and no breakfasts or lunches", () => {
  const meals = SlideMeals.list.map((m) => ({ id: m.id, name: m.name, slots: m.slots }));
  const dinner = names(MealSearch.optionsFor(meals, "kids-dinner"));
  ["Burgers", "Chicken Ka Salan", "Pasta", "Chipotle", "Date Night", "Chinese Takeout", "Chimichurri Chicken"].forEach((n) => assert.ok(dinner.includes(n), n));
  ["Avocado Toast", "Upma", "Boiled Eggs", "Salad", "Samosa", "School Lunch", "Cereal & Milk"].forEach((n) => assert.ok(!dinner.includes(n), n + " should not be a dinner option"));
  assert.ok(dinner.length >= 18);
});

test("typing finds meals by prefix, by any word, and by a few letters inside a word", () => {
  const meals = [mk("1", "Chicken Ka Salan", []), mk("2", "Chicken Tacos", []), mk("3", "Tomato Salan with Beef", []), mk("4", "Pasta & Meatballs", []), mk("5", "Burgers", [])];
  assert.deepEqual(names(MealSearch.suggest(meals, "chi", "kids-breakfast")), ["Chicken Ka Salan", "Chicken Tacos"]);
  assert.deepEqual(names(MealSearch.suggest(meals, "salan", "kids-breakfast")).sort(), ["Chicken Ka Salan", "Tomato Salan with Beef"]);
  assert.deepEqual(names(MealSearch.suggest(meals, "meat", "kids-breakfast")), ["Pasta & Meatballs"]);
  assert.deepEqual(names(MealSearch.suggest(meals, "urger", "kids-breakfast")), ["Burgers"]);
  assert.deepEqual(names(MealSearch.suggest(meals, "ch ta", "kids-breakfast")), ["Chicken Tacos"]);
  assert.deepEqual(names(MealSearch.suggest(meals, "zzz", "kids-breakfast")), []);
  assert.deepEqual(names(MealSearch.suggest(meals, "  ", "kids-breakfast", 2)).length, 2);
});

test("an exact name ranks first, then names that start with it, then the rest", () => {
  const meals = [mk("1", "Pasta & Meatballs", []), mk("2", "Chicken Pasta", []), mk("3", "Pasta", []), mk("4", "Pasta & Shrimp", [])];
  const out = names(MealSearch.suggest(meals, "pasta", "kids-breakfast"));
  assert.equal(out[0], "Pasta");
  assert.deepEqual(out.slice(1, 3).sort(), ["Pasta & Meatballs", "Pasta & Shrimp"]);
  assert.equal(out[3], "Chicken Pasta");
});

test("typing in a dinner box never suggests a breakfast", () => {
  const meals = [mk("1", "Avocado Toast", ["kids-breakfast"]), mk("2", "Avocado Chicken", ["kids-dinner"])];
  assert.deepEqual(names(MealSearch.suggest(meals, "avo", "kids-dinner")), ["Avocado Chicken"]);
  assert.deepEqual(names(MealSearch.suggest(meals, "avo", "kids-breakfast")).sort(), ["Avocado Chicken", "Avocado Toast"]);
});

test("suggestions respect the limit", () => {
  const meals = Array.from({ length: 30 }, (_, i) => mk("m" + i, "Pasta " + i, []));
  assert.equal(MealSearch.suggest(meals, "pasta", "kids-dinner", 8).length, 8);
});

test("Ctrl+S adds typed meals to the library in the row they were typed in", () => {
  const meals = [mk("a", "Burgers", ["kids-dinner"])];
  const plan = {
    weekStart: "2026-10-04",
    cells: {
      "2026-10-05_kids-dinner": { mealId: "a", text: "Burgers" },
      "2026-10-06_kids-dinner": { mealId: null, text: "  Grandma's   Stew " },
      "2026-10-07_parents-dinner": { mealId: null, text: "grandma's stew" },
      "2026-10-08_namath-lunch": { mealId: null, text: "" },
    },
  };
  const out = MealSearch.collectNewMeals(plan, meals, SLOTS, { makeId: (i) => "new" + i, tagsFor: () => ["Quick"] });
  assert.deepEqual(names(out.created), ["Grandma's Stew"]);
  const stew = meals.find((m) => m.name === "Grandma's Stew");
  assert.deepEqual(stew.slots, ["kids-dinner", "parents-dinner"]);
  assert.deepEqual(stew.tags, ["Quick"]);
  assert.equal(stew.tagsReviewed, false);
  assert.equal(plan.cells["2026-10-06_kids-dinner"].mealId, stew.id);
  assert.equal(plan.cells["2026-10-07_parents-dinner"].mealId, stew.id);
  assert.equal(plan.cells["2026-10-08_namath-lunch"].mealId, null); // empty boxes stay empty
  assert.equal(stew.lastUsed, "2026-10-04");
  // Burgers was not changed
  assert.deepEqual(meals[0].slots, ["kids-dinner"]);
  assert.equal(meals.length, 2);
});

test("Ctrl+S links to existing meals and widens their slots, and never duplicates", () => {
  const meals = [mk("a", "Samosa", ["namath-lunch"]), mk("b", "Anything", [])];
  const plan = {
    weekStart: "2026-10-04",
    cells: { "2026-10-05_kids-dinner": { mealId: null, text: "samosa" }, "2026-10-06_kids-dinner": { mealId: null, text: "ANYTHING" } },
  };
  const out = MealSearch.collectNewMeals(plan, meals, SLOTS);
  assert.equal(out.created.length, 0);
  assert.equal(meals.length, 2);
  assert.deepEqual(meals[0].slots, ["namath-lunch", "kids-dinner"]);
  assert.deepEqual(meals[1].slots, []); // a meal that fits everywhere is left alone
  assert.equal(plan.cells["2026-10-05_kids-dinner"].mealId, "a");
  assert.equal(plan.cells["2026-10-06_kids-dinner"].mealId, "b");
  // saving again changes nothing
  const again = MealSearch.collectNewMeals(plan, meals, SLOTS);
  assert.equal(again.created.length, 0);
  assert.equal(again.widened.length, 0);
});

test("Ctrl+S saves each meal in a box that lists several, not the combination", () => {
  const meals = [mk("a", "Kebab", ["namath-lunch"])];
  const plan = { weekStart: "2026-10-04", cells: { "2026-10-05_namath-lunch": { mealId: "a", text: "Kebab / Samosa" } } };
  const out = MealSearch.collectNewMeals(plan, meals, SLOTS, { makeId: (i) => "n" + i });
  assert.deepEqual(names(out.created), ["Samosa"]);
  assert.equal(plan.cells["2026-10-05_namath-lunch"].text, "Kebab / Samosa");
  assert.equal(plan.cells["2026-10-05_namath-lunch"].mealId, "a");
  assert.ok(!meals.some((m) => m.name.includes("/")));
});

test("Ctrl+S ignores empty, oversized and unknown-row boxes", () => {
  const meals = [];
  const plan = {
    weekStart: "2026-10-04",
    cells: { "2026-10-05_kids-dinner": { text: "   " }, "2026-10-06_kids-dinner": { text: "x".repeat(200) }, "2026-10-07_mystery-row": { text: "Mystery" } },
  };
  const out = MealSearch.collectNewMeals(plan, meals, SLOTS);
  assert.equal(out.created.length, 0);
  assert.equal(meals.length, 0);
});
