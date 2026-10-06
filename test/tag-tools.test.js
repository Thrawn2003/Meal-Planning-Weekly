"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const TagTools = require("../js/tag-tools.js");

test("the tag set is grouped, unique, and free of retired tags", () => {
  assert.equal(new Set(TagTools.ALL).size, TagTools.ALL.length);
  TagTools.DROPPED.concat(Object.keys(TagTools.RENAMES)).forEach((old) => assert.ok(!TagTools.ALL.includes(old), old));
  assert.deepEqual(TagTools.GROUPS.map((g) => g.name), ["Cuisine", "Main protein", "Effort & prep", "Diet", "Family", "Practical", "Occasion"]);
});

test("suggests accurate cuisine and protein tags from names", () => {
  const s = (n) => TagTools.suggestTags(n);
  assert.deepEqual(s("Special Anda"), ["Indian", "Eggs"]);
  assert.deepEqual(s("Avocado Toast"), ["American"]);
  assert.deepEqual(s("Chicken Ka Salan"), ["Indian", "Chicken"]);
  assert.deepEqual(s("Mash Ki Daal"), ["Indian", "Vegetarian"]);
  assert.deepEqual(s("Pasta & Meatballs"), ["Italian"], "meatballs can be beef, pork, veal or turkey");
  assert.deepEqual(s("Chicken Tacos"), ["Mexican", "Chicken"]);
  assert.deepEqual(s("Chinese Takeout"), ["Chinese", "Takeout / Restaurant Night"]);
  assert.deepEqual(s("Gosht"), ["Indian"], "gosht just means meat");
  assert.deepEqual(s("Lamb Rogan Josh"), ["Lamb / Goat"]);
  assert.deepEqual(s("Chicken Nuggets"), ["American", "Chicken"]);
  assert.deepEqual(s("Burgers"), ["American"], "a burger can be beef, chicken or veggie");
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
    { name: "Burgers", tags: ["Chicken", "Picky-Eater-Safe", "Leftover-Friendly"] },
    { name: "Mystery Dish", tags: ["Meatless", "Vegan", "One-Pot"] },
  ];
  const out = TagTools.migrateLibrary({
    meals,
    customTags: ["Zesty", "Seasonal", "Indian", "South Asian", "Make-Ahead"],
    excludedTags: ["South Asian", "Low-Carb", "Quick"],
  });
  assert.deepEqual(meals[0].tags, ["Indian", "Healthy", "Make-Ahead", "Vegetarian"]);
  assert.deepEqual(meals[1].tags, ["Carby", "Italian"]);
  assert.deepEqual(meals[2].tags, ["Chicken", "Kid-Favorite", "Good for Leftovers", "American"], "an existing protein tag is not overridden");
  assert.deepEqual(meals[3].tags, ["Vegetarian", "One-Pot"]);
  assert.deepEqual(out.customTags, ["Zesty"]);
  assert.deepEqual(out.excludedTags, ["Indian", "Low-Carb", "Quick"]);
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

test("only tags a name settles outright are applied without asking", () => {
  const o = (n) => TagTools.obviousTags(n);
  assert.deepEqual(o("Pasta & Meatballs"), ["Italian", "Carby"]);
  assert.deepEqual(o("Cereal & Milk"), ["American", "Quick", "Low Effort"]);
  assert.deepEqual(o("Boiled Eggs"), ["Eggs", "Quick", "Low Effort"]);
  assert.deepEqual(o("Avocado Toast"), ["American", "Quick", "Low Effort"]);
  assert.deepEqual(o("Date Night (Out)"), ["Takeout / Restaurant Night", "Quick", "Low Effort", "Weekend / Special"]);
  assert.ok(!o("French Toast").includes("Quick"), "French toast is cooked");
  ["Chicken Ka Salan", "Burgers", "Salad", "Upma", "Gosht", "Garlic Lemon Shrimp"].forEach((n) => {
    ["Quick", "Low Effort", "High Effort", "Healthy", "Kid-Favorite", "Spicy"].forEach((t) => assert.ok(!o(n).includes(t), n + " should not be assumed " + t));
  });
});

test("resetting clears every guessed tag, keeps checkable ones, applies obvious ones, and remembers the old tags", () => {
  const meals = [
    { id: "a", name: "Pizza", tags: ["Italian", "Carby", "Kid-Favorite", "Quick", "High Effort", "Healthy", "Zesty"] },
    { id: "b", name: "Gosht", tags: ["Indian", "High Effort", "Spicy", "Weekend / Special", "New Recipe"] },
    { id: "c", name: "Upma", tags: [] },
    { id: "d", name: "Chinese Takeout", tags: ["Chinese", "Takeout / Restaurant Night", "Gluten-Free", "Dairy-Free"] },
  ];
  const backup = TagTools.resetGuessedTags(meals);
  assert.deepEqual(meals[0].tags, ["Italian", "Zesty", "Carby"], "own tag kept, guessed ones gone, obvious one applied");
  assert.deepEqual(meals[1].tags, ["Indian", "New Recipe"]);
  assert.deepEqual(meals[2].tags, ["Indian", "Vegetarian"]);
  assert.deepEqual(meals[3].tags, ["Chinese", "Takeout / Restaurant Night", "Quick", "Low Effort"]);
  meals.forEach((m) => assert.equal(m.tagsReviewed, false));
  assert.deepEqual(backup.a, ["Italian", "Carby", "Kid-Favorite", "Quick", "High Effort", "Healthy", "Zesty"]);
  assert.deepEqual(backup.d, ["Chinese", "Takeout / Restaurant Night", "Gluten-Free", "Dairy-Free"]);
});

test("resetting is safe on empty and messy input", () => {
  assert.deepEqual(TagTools.resetGuessedTags([]), {});
  assert.doesNotThrow(() => TagTools.resetGuessedTags([{ id: "x", name: null, tags: null }, { id: "y" }]));
});

test("removes protein tags that only an old name guess supported", () => {
  const r = TagTools.removeAssumedProteins;
  assert.deepEqual(r("Gosht", ["Indian", "Lamb / Goat"]), ["Indian"]);
  assert.deepEqual(r("Talawa Gosht", ["Lamb / Goat"]), []);
  assert.deepEqual(r("Lamb Gosht", ["Lamb / Goat"]), ["Lamb / Goat"], "the name actually says lamb");
  assert.deepEqual(r("Pasta & Meatballs", ["Italian", "Beef"]), ["Italian"]);
  assert.deepEqual(r("Beef Meatballs", ["Beef"]), ["Beef"]);
  assert.deepEqual(r("Burgers", ["Beef"]), []);
  assert.deepEqual(r("Chicken Nuggets", ["Chicken"]), ["Chicken"]);
  assert.deepEqual(r("Nuggets", ["Chicken"]), []);
  assert.deepEqual(r("Salad", ["Beef"]), ["Beef"], "a tag the old rules never guessed is left alone");
  assert.deepEqual(r(null, null), []);
});
