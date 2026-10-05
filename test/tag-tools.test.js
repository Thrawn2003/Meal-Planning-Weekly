"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const TagTools = require("../js/tag-tools.js");

test("the tag set is grouped, unique, and free of retired tags", () => {
  assert.equal(new Set(TagTools.ALL).size, TagTools.ALL.length);
  TagTools.DROPPED.concat(Object.keys(TagTools.RENAMES)).forEach((old) => assert.ok(!TagTools.ALL.includes(old), old));
  assert.deepEqual(TagTools.GROUPS.map((g) => g.name), ["Cuisine", "Main protein", "Effort", "Diet", "Occasion & family"]);
});

test("suggests accurate cuisine and protein tags from names", () => {
  const s = (n) => TagTools.suggestTags(n);
  assert.deepEqual(s("Special Anda"), ["Indian", "Eggs"]);
  assert.deepEqual(s("Avocado Toast"), ["American"]);
  assert.deepEqual(s("Chicken Ka Salan"), ["Indian", "Chicken"]);
  assert.deepEqual(s("Mash Ki Daal"), ["Indian", "Vegetarian"]);
  assert.deepEqual(s("Pasta & Meatballs"), ["Italian", "Beef"]);
  assert.deepEqual(s("Chicken Tacos"), ["Mexican", "Chicken"]);
  assert.deepEqual(s("Chinese Takeout"), ["Chinese", "Takeout / Restaurant Night"]);
  assert.deepEqual(s("Gosht"), ["Indian", "Lamb / Goat"]);
  assert.deepEqual(s("Garlic Lemon Shrimp"), ["Seafood"]);
  assert.deepEqual(s("Boiled Eggs"), ["Eggs"]);
  assert.deepEqual(s("Salad"), []);
  assert.deepEqual(s(""), []);
  assert.deepEqual(s(null), []);
});

test("never calls a non-vegetarian dish vegetarian", () => {
  assert.ok(!TagTools.suggestTags("Chicken Daal").includes("Vegetarian"));
  assert.ok(!TagTools.suggestTags("Egg Bhurji with Aloo").includes("Vegetarian"));
});

test("migrates old tags, keeps user tags, and fills only gaps", () => {
  const meals = [
    { name: "Upma", tags: ["South Asian", "Healthy", "Meal-Prep Friendly"] },
    { name: "Pizza", tags: ["Carby", "Seasonal"] },
    { name: "Burgers", tags: ["Chicken", "Picky-Eater-Safe"] },
    { name: "Mystery Dish", tags: ["Meatless", "Vegan", "One-Pot"] },
  ];
  const out = TagTools.migrateLibrary({
    meals,
    customTags: ["Zesty", "Seasonal", "Indian", "South Asian"],
    excludedTags: ["South Asian", "Low-Carb", "Quick"],
  });
  assert.deepEqual(meals[0].tags, ["Indian", "Healthy", "Vegetarian"]);
  assert.deepEqual(meals[1].tags, ["Carby", "Italian"]);
  assert.deepEqual(meals[2].tags, ["Chicken", "Kid-Favorite", "American"], "an existing protein tag is not overridden");
  assert.deepEqual(meals[3].tags, ["Vegetarian", "Low Effort"]);
  assert.deepEqual(out.customTags, ["Zesty"]);
  assert.deepEqual(out.excludedTags, ["Indian", "Quick"]);
});

test("the planner's view of a meal fills missing tags without touching the stored meal", () => {
  const stored = { id: "a", name: "Special Anda", tags: ["Quick"] };
  const view = TagTools.withInferredTags(stored);
  assert.deepEqual(view.tags, ["Quick", "Indian", "Eggs"]);
  assert.deepEqual(stored.tags, ["Quick"]);
  assert.equal(view.id, "a");
});

test("breakfast balance works even when Indian breakfasts have no Indian tag", () => {
  const PE = require("../js/planner-engine.js");
  const KB = "kids-breakfast";
  const stored = [
    ...["Upma", "Roti", "Paratha", "Daal"].map((n) => ({ id: "id-" + n, name: n, slots: [KB], tags: [] })),
    ...["Toast", "Cereal", "Bagel", "Pancakes", "Waffles", "Oatmeal", "Muffin", "Yogurt", "Smoothie", "Croissant"].map((n) => ({ id: "id-" + n, name: n, slots: [KB], tags: ["American"] })),
  ];
  const last = {};
  ["Upma", "Roti", "Paratha", "Daal", "Upma", "Roti", "Paratha"].forEach((n, i) => {
    last[new Date(Date.UTC(2026, 8, 27 + i)).toISOString().slice(0, 10) + "_" + KB] = { mealId: "id-" + n, text: n };
  });
  const plans = { "2026-09-27": { weekStart: "2026-09-27", cells: last } };
  const indianCount = (meals) => {
    const r = PE.planWeek({ meals, plans, plan: { weekStart: "2026-10-04", cells: {} }, slots: [{ key: KB, label: KB }], isEligible: () => true, seed: "x" });
    return r.assignments.filter((a) => /^(Upma|Roti|Paratha|Daal)$/.test(a.text)).length;
  };
  const blind = indianCount(stored);
  const aware = indianCount(stored.map(TagTools.withInferredTags));
  assert.ok(blind <= 1, "untagged Indian breakfasts are invisible to the planner: " + blind);
  assert.ok(aware >= 2 && aware <= 4, "with inferred tags the week is balanced: " + aware);
});

test("migration is safe on empty and messy input", () => {
  assert.doesNotThrow(() => TagTools.migrateLibrary({}));
  assert.doesNotThrow(() => TagTools.migrateLibrary({ meals: [{ name: null }, { name: "X", tags: null }] }));
});
