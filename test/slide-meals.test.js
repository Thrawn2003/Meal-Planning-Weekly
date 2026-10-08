"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const SlideMeals = require("../js/slide-meals.js");
const DishKnowledge = require("../js/dish-knowledge.js");
const TagTools = require("../js/tag-tools.js");

const SLOT_KEYS = ["kids-breakfast", "namath-lunch", "kids-dinner", "parents-breakfast", "parents-lunch", "parents-dinner"];
const tagsFor = (name) => DishKnowledge.applyToTags(name, TagTools.withInferredTags({ name, tags: [] }).tags);
const norm = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "");

test("slide meals are unique, named, and only use real slots", () => {
  const list = SlideMeals.list;
  assert.ok(list.length >= 50);
  assert.equal(new Set(list.map((m) => m.id)).size, list.length);
  assert.equal(new Set(list.map((m) => norm(m.name))).size, list.length);
  list.forEach((m) => {
    assert.ok(m.name.trim());
    assert.ok(m.slots.length >= 1);
    m.slots.forEach((s) => assert.ok(SLOT_KEYS.includes(s), m.name + " has unknown slot " + s));
    assert.ok(!m.id.startsWith("seed_"), "ids must not look like the old placeholder import");
  });
});

test("every slot has enough meals to fill a week without repeating", () => {
  SLOT_KEYS.filter((k) => k !== "parents-dinner" && k !== "parents-lunch").forEach((k) => {
    assert.ok(SlideMeals.list.filter((m) => m.slots.includes(k)).length >= 7, k + " has fewer than 7 meals");
  });
  assert.ok(SlideMeals.list.filter((m) => m.slots.includes("parents-dinner")).length >= 7);
});

test("tags on the slide meals are all real tags and come only from the name or the research", () => {
  SlideMeals.list.forEach((m) => {
    tagsFor(m.name).forEach((t) => assert.ok(TagTools.ALL.includes(t), m.name + ": unknown tag " + t));
  });
  const researched = SlideMeals.list.filter((m) => DishKnowledge.lookup(m.name));
  assert.ok(researched.length >= 35, "only " + researched.length + " slide meals are researched");
  researched.forEach((m) => {
    const r = DishKnowledge.lookup(m.name);
    r.sources.forEach((s) => assert.match(s.url, /^https:\/\//, m.name + " has a bad source link"));
  });
});

test("researched effort follows the time rubric for the newly researched dishes", () => {
  const effort = (name) => tagsFor(name).filter((t) => ["Quick", "Low Effort", "High Effort"].includes(t));
  assert.deepEqual(effort("Homemade Pizza"), ["High Effort"]);
  assert.deepEqual(effort("Burgers"), ["Low Effort"]);
  assert.deepEqual(effort("Simone's Chimichurri Chicken"), ["Low Effort"]);
  assert.deepEqual(effort("Fish"), ["Low Effort"]);
  assert.deepEqual(effort("Hot Dogs"), ["Quick", "Low Effort"]);
  assert.deepEqual(effort("Egg & Croissant"), ["Quick", "Low Effort"]);
  // Family-specific or unknowable dishes are not given an effort level
  ["Chicken Nuggets", "Special Anda", "Green Egg Monster", "Smokey Eggs", "Pizza", "Kebab", "Bagel & Cream Cheese", "Cereal & Milk"].forEach((n) => assert.deepEqual(effort(n), [], n));
});

test("importing adds missing meals, keeps existing tags, widens slots and removes nothing", () => {
  const mine = [
    { id: "a", name: "Avocado Toast", slots: ["kids-breakfast"], tags: ["Spicy"], tagsReviewed: true },
    { id: "n", name: "chicken nuggets", slots: ["kids-dinner"], tags: ["Kid-Favorite"], tagsReviewed: true },
    { id: "x", name: "Grandma's Stew", slots: [], tags: [], tagsReviewed: true },
    { id: "u", name: "upma", slots: ["kids-breakfast"], tags: [], tagsReviewed: true },
  ];
  const out = SlideMeals.mergeInto(mine, tagsFor);
  assert.equal(out.added, SlideMeals.list.length - 3);
  assert.equal(out.widened, 2);
  assert.equal(out.tagged, 1); // only Upma had no tags and a researched answer to give
  const byName = (n) => mine.filter((m) => norm(m.name) === norm(n));
  assert.equal(byName("Avocado Toast").length, 1);
  assert.deepEqual(byName("Avocado Toast")[0].tags, ["Spicy"]);
  assert.deepEqual(byName("Upma")[0].tags, ["Indian", "Vegetarian", "Low Effort"]);
  assert.deepEqual(byName("Avocado Toast")[0].slots.sort(), ["kids-breakfast", "parents-breakfast"]);
  assert.deepEqual(byName("Chicken Nuggets")[0].slots.sort(), ["kids-dinner", "namath-lunch"]);
  assert.ok(mine.some((m) => m.id === "x"));
  const added = mine.find((m) => m.id === "slide_homemade-pizza");
  assert.deepEqual(added.tags, ["Italian", "Carby", "High Effort"]);
  assert.equal(added.tagsReviewed, false);
  // a second import changes nothing
  const again = SlideMeals.mergeInto(mine, tagsFor);
  assert.deepEqual(again, { added: 0, widened: 0, tagged: 0 });
});
