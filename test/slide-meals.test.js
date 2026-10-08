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
  assert.deepEqual(effort("Chimichurri Chicken"), ["Low Effort"]);
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

test("the family's answers set the effort of store-bought and quick dishes, and nothing else", () => {
  const t = (name) => SlideMeals.withFamily(name, tagsFor(name));
  ["Chicken Nuggets", "Samosa", "Kebab", "Green Egg Monster"].forEach((n) => {
    const tags = t(n);
    assert.ok(tags.includes("Quick") && tags.includes("Low Effort"), n);
  });
  assert.deepEqual(t("Pizza"), ["Italian", "Carby", "High Effort"]);
  assert.ok(t("Samosa").includes("Freezer-Friendly")); // researched tags stay
  assert.deepEqual(t("Special Anda"), tagsFor("Special Anda")); // not answered, not touched
  assert.deepEqual(t("Smokey Eggs"), tagsFor("Smokey Eggs"));
});

test("meals imported by an older copy are fixed and given the family's answers", () => {
  const meals = [
    { id: "slide_simone-s-chimichurri-chicken", name: "Simone's Chimichurri Chicken", slots: ["parents-dinner"], tags: ["Chicken"], tagsReviewed: false },
    { id: "n", name: "Chicken Nuggets", slots: ["kids-dinner"], tags: ["American", "Chicken"], tagsReviewed: true },
    { id: "p", name: "Pizza", slots: ["namath-lunch"], tags: ["Italian", "Quick"], tagsReviewed: true },
  ];
  assert.equal(SlideMeals.fixOldNames(meals), 1);
  assert.equal(meals[0].name, "Chimichurri Chicken");
  assert.equal(SlideMeals.applyFamilyAnswers(meals), 1); // the nuggets; Pizza was confirmed with an effort tag
  assert.deepEqual(meals[1].tags, ["American", "Chicken", "Quick", "Low Effort"]);
  assert.deepEqual(meals[2].tags, ["Italian", "Quick"]);
});

test("the slideshow weeks go into saved weeks on the right days", () => {
  const meals = [];
  SlideMeals.mergeInto(meals, tagsFor);
  const plans = {};
  const out = SlideMeals.mergeHistory(plans, meals);
  assert.equal(out.weeks, 4);
  assert.deepEqual(Object.keys(plans).sort(), ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
  const text = (week, day, slot) => (plans[week].cells[day + "_" + slot] || {}).text;
  // Monday Sept 7 starts the first week; its Sunday is empty
  assert.equal(text("2026-09-06", "2026-09-07", "kids-breakfast"), "Smokey Eggs");
  assert.equal(text("2026-09-06", "2026-09-06", "kids-breakfast"), undefined);
  assert.equal(text("2026-09-06", "2026-09-12", "parents-dinner"), "Date Night");
  assert.equal(text("2026-09-06", "2026-09-09", "namath-lunch"), "School Lunch / Kebab");
  // Wednesday Simones, Thursday Chimichurri Chicken
  assert.equal(text("2026-09-13", "2026-09-16", "parents-dinner"), "Simone's Takeout");
  assert.equal(text("2026-09-20", "2026-09-24", "parents-dinner"), "Chimichurri Chicken");
  // boxes that were not meals stay empty
  assert.equal(text("2026-09-20", "2026-09-20", "kids-breakfast"), undefined);
  assert.equal(text("2026-09-27", "2026-10-03", "parents-lunch"), undefined);
  // every box links to its meal, the unknown "Shrimp" keeps its own words
  Object.values(plans).forEach((p) =>
    Object.values(p.cells).forEach((c) => {
      if (c.text === "Shrimp") return assert.equal(c.mealId, null);
      assert.ok(meals.some((m) => m.id === c.mealId), "no meal for " + c.text);
    })
  );
  const eggs = meals.find((m) => m.name === "Boiled Eggs");
  assert.equal(eggs.lastUsed, "2026-09-27");
  assert.equal(eggs.usageHistory.length, 3);
});

test("saving the past weeks never overwrites your own boxes, but replaces Auto-Populate's guesses", () => {
  const meals = [];
  SlideMeals.mergeInto(meals, tagsFor);
  const plans = {
    "2026-09-13": {
      weekStart: "2026-09-13",
      weekEnd: "2026-09-19",
      title: "mine",
      cells: {
        "2026-09-14_kids-breakfast": { mealId: null, text: "My own pancakes" },
        "2026-09-14_kids-dinner": { mealId: "x", text: "Guess", why: ["Haven't had this one yet"] },
      },
    },
  };
  SlideMeals.mergeHistory(plans, meals);
  assert.equal(plans["2026-09-13"].title, "mine");
  assert.equal(plans["2026-09-13"].cells["2026-09-14_kids-breakfast"].text, "My own pancakes");
  assert.equal(plans["2026-09-13"].cells["2026-09-14_kids-dinner"].text, "Burgers");
  assert.equal(plans["2026-09-13"].cells["2026-09-14_kids-dinner"].why, undefined);
});

test("with the past weeks saved, Auto-Populate learns the usual Parents Breakfast and Lunch", () => {
  const PlannerEngine = require("../js/planner-engine.js");
  const meals = [];
  SlideMeals.mergeInto(meals, tagsFor);
  const plans = {};
  SlideMeals.mergeHistory(plans, meals);
  const slots = SLOT_KEYS.map((key) => ({ key, label: key }));
  const res = PlannerEngine.planWeek({
    meals: meals.map(TagTools.withInferredTags),
    plans,
    plan: { weekStart: "2026-10-04", cells: {} },
    slots,
    isEligible: (m, k) => !m.slots || !m.slots.length || m.slots.includes(k),
    seed: "slides",
  });
  const row = (k) => res.assignments.filter((a) => a.slotKey === k).map((a) => a.text);
  assert.equal(res.assignments.length, 42);
  // Mon to Thu breakfast is Boiled Eggs and Tue to Fri lunch is Salad in nearly every week
  assert.deepEqual(row("parents-breakfast").slice(1, 5), ["Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs"]);
  assert.deepEqual(row("parents-lunch").slice(2, 5), ["Salad", "Salad", "Salad"]);
  // the other rows still vary
  ["kids-breakfast", "namath-lunch", "kids-dinner"].forEach((k) => assert.ok(new Set(row(k)).size >= 6, k + ": " + row(k).join(",")));
});
