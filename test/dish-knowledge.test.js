"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const DishKnowledge = require("../js/dish-knowledge.js");
const TagTools = require("../js/tag-tools.js");

const EFFORT = ["Quick", "Low Effort", "High Effort"];
const FAMILY_SPECIFIC = ["Kid-Favorite", "Spicy", "Healthy", "Weekend / Special", "Packable (school lunch)", "Budget-Friendly", "New Recipe"];
const sorted = (a) => a.slice().sort();

test("every researched entry is well formed and sourced", () => {
  const ids = new Set();
  DishKnowledge.DISHES.forEach((d) => {
    assert.ok(d.id && !ids.has(d.id), "unique id: " + d.id);
    ids.add(d.id);
    assert.ok(d.match instanceof RegExp);
    assert.ok(d.note && d.note.length > 20, d.id + " needs a note");
    assert.ok(d.sources.length >= 1, d.id + " needs a source");
    d.sources.forEach((s) => assert.ok(s.label && /^https:\/\/[^ ]+$/.test(s.url), d.id + " source url"));
    assert.equal(new Set(d.tags).size, d.tags.length, d.id + " has duplicate tags");
    d.tags.forEach((t) => assert.ok(TagTools.ALL.includes(t), d.id + " uses unknown tag " + t));
  });
});

test("entries never assert anything that depends on the family", () => {
  DishKnowledge.DISHES.forEach((d) => FAMILY_SPECIFIC.forEach((t) => assert.ok(!d.tags.includes(t), d.id + " should not assume " + t)));
});

test("effort tags follow the stated rubric and never contradict each other", () => {
  DishKnowledge.DISHES.forEach((d) => {
    const effort = d.tags.filter((t) => EFFORT.includes(t));
    assert.ok(effort.length <= 2, d.id);
    if (effort.includes("Quick")) assert.ok(effort.includes("Low Effort"), d.id + ": Quick implies Low Effort");
    assert.ok(!(effort.includes("High Effort") && effort.includes("Low Effort")), d.id);
  });
  assert.ok(DishKnowledge.RUBRIC.quick && DishKnowledge.RUBRIC.low && DishKnowledge.RUBRIC.high && DishKnowledge.RUBRIC.none);
});

test("recognizes the dishes by name, with the researched tags", () => {
  const t = (n) => sorted(DishKnowledge.lookup(n).tags);
  assert.deepEqual(t("Upma"), sorted(["Indian", "Vegetarian", "Low Effort"]));
  assert.deepEqual(t("Aloo Paratha"), sorted(["Indian", "Vegetarian", "Carby", "Low Effort"]));
  assert.deepEqual(t("Mash Ki Daal"), sorted(["Indian", "Vegetarian", "Needs Planning Ahead"]));
  assert.deepEqual(t("Khatti Daal"), sorted(["Indian", "Vegetarian"]));
  assert.deepEqual(t("Tomato Salan with Beef"), sorted(["Indian", "Beef", "High Effort"]));
  assert.deepEqual(t("Chicken Ka Salan"), sorted(["Indian", "Chicken"]));
  assert.deepEqual(t("Tarkari Ka Salan"), sorted(["Indian", "Vegetarian", "Low Effort"]));
  assert.deepEqual(t("Talawa Gosht"), ["Indian"]);
  assert.deepEqual(t("Indian Omelette & Roti"), sorted(["Indian", "Eggs", "Quick", "Low Effort"]));
  assert.deepEqual(t("Garlic Lemon Shrimp"), sorted(["Seafood", "Quick", "Low Effort"]));
  assert.deepEqual(t("Shrimp Pasta"), sorted(["Italian", "Seafood", "Carby", "Low Effort"]));
  assert.deepEqual(t("Chicken Tacos"), sorted(["Mexican", "Chicken", "Low Effort"]));
  assert.deepEqual(t("Chinese Garlic Beef"), sorted(["Chinese", "Beef", "Low Effort"]));
  assert.deepEqual(t("Chicken Thighs"), sorted(["Chicken", "Low Effort"]));
  assert.deepEqual(t("Tuna Melt"), sorted(["American", "Seafood", "Quick", "Low Effort"]));
  assert.deepEqual(t("Boiled Eggs"), sorted(["Eggs", "Low Effort", "Make-Ahead", "Gluten-Free", "Dairy-Free"]));
  assert.deepEqual(t("Regular Oatmeal"), sorted(["Vegetarian", "Quick", "Low Effort"]));
  assert.deepEqual(t("Samosa"), sorted(["Indian", "Make-Ahead", "Freezer-Friendly"]));
});

test("the most specific entry wins when a name could match several", () => {
  const id = (n) => DishKnowledge.lookup(n).id;
  assert.equal(id("Bhendi Roti"), "bhendi-roti-roll");
  assert.equal(id("Bhendi Roll-Up"), "bhendi-roti-roll");
  assert.equal(id("Bhendi Masala"), "bhindi");
  assert.equal(id("Shrimp Pasta"), "shrimp-pasta");
  assert.equal(id("Garlic Lemon Shrimp Pasta"), "shrimp-pasta");
  assert.equal(id("Tomato Salan with Beef"), "beef-salan");
  assert.equal(id("Pasta & Meatballs"), "spaghetti-meatballs");
  assert.equal(id("Seekh Kebab"), "seekh-shami-kebab");
});

test("dishes that depend on the family are left alone, not guessed", () => {
  ["Special Anda", "Green Egg Monster", "Smokey Eggs", "Cereal & Milk", "Bagel & Cream Cheese", "Pizza", "Kebab", "Chef's Choice", "School Lunch", "Be Creative", "Date Night (Out)", "Chicken Nuggets"].forEach((n) => {
    assert.equal(DishKnowledge.lookup(n), null, n + " should not be researched");
  });
  assert.equal(DishKnowledge.lookup(null), null);
  assert.equal(DishKnowledge.lookup(""), null);
});

test("applying researched tags keeps what's there, and a researched effort replaces a guessed one", () => {
  assert.deepEqual(DishKnowledge.applyToTags("Boiled Eggs", ["Eggs", "Quick", "Low Effort"]), ["Eggs", "Low Effort", "Make-Ahead", "Gluten-Free", "Dairy-Free"]);
  assert.deepEqual(DishKnowledge.applyToTags("Tomato Salan with Beef", ["Indian", "Zesty", "Low Effort"]), ["Indian", "Zesty", "Beef", "High Effort"]);
  assert.deepEqual(DishKnowledge.applyToTags("Khatti Daal", ["Indian", "Quick"]), ["Indian", "Quick", "Vegetarian"], "no researched effort, so the existing one stays");
  assert.deepEqual(DishKnowledge.applyToTags("Special Anda", ["Indian", "Eggs"]), ["Indian", "Eggs"]);
  assert.deepEqual(DishKnowledge.applyToTags("Upma", null), ["Indian", "Vegetarian", "Low Effort"]);
});
