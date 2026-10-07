"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const PlannerEngine = require("../js/planner-engine.js");

const KB = "kids-breakfast", NL = "namath-lunch", KD = "kids-dinner", PB = "parents-breakfast", PL = "parents-lunch", PD = "parents-dinner";
const SLOTS = [KB, NL, KD, PB, PL, PD].map((key) => ({ key, label: key }));
const TARGET = "2026-10-04"; // a Sunday
const TAKEOUT = "Takeout / Restaurant Night";

const mk = (name, slots, tags = []) => ({ id: "id-" + name, name, slots, tags });
const eligible = (m, slotKey) => !m.slots || m.slots.length === 0 || m.slots.includes(slotKey);
const isoPlus = (startISO, n) => new Date(Date.parse(startISO + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

// spec: { slotKey: [Sun..Sat names or null] }; textOnly drops mealId links.
function week(weekStart, spec, meals, textOnly = false) {
  const cells = {};
  Object.entries(spec).forEach(([slotKey, names]) => {
    names.forEach((name, i) => {
      if (!name) return;
      const meal = meals.find((m) => m.name === name);
      cells[isoPlus(weekStart, i) + "_" + slotKey] = { mealId: textOnly || !meal ? null : meal.id, text: name };
    });
  });
  return { weekStart, cells };
}

function plan(cells = {}) {
  return { weekStart: TARGET, cells };
}

function run(meals, plans, targetPlan, extra = {}) {
  return PlannerEngine.planWeek({ meals, plans, plan: targetPlan, slots: SLOTS, isEligible: eligible, seed: "t", ...extra });
}

const names = (result, slotKey) => result.assignments.filter((a) => a.slotKey === slotKey).map((a) => a.text);
const dinners = (n) => Array.from({ length: n }, (_, i) => mk("Dinner" + String.fromCharCode(65 + i), [KD]));

test("fills empty boxes, leaves filled ones alone, and skips slots with no eligible meal", () => {
  const meals = dinners(8);
  const existing = isoPlus(TARGET, 1) + "_" + KD;
  const res = run(meals, {}, plan({ [existing]: { mealId: null, text: "My own thing" } }));
  assert.equal(res.assignments.length, 6);
  assert.ok(!res.assignments.some((a) => a.key === existing));
  assert.equal(res.skipped.length, 35);
  assert.ok(res.assignments.every((a) => a.reasons.length >= 1));
});

test("is deterministic for a seed and varies across seeds", () => {
  const meals = dinners(12);
  const a = run(meals, {}, plan(), { seed: "same" });
  const b = run(meals, {}, plan(), { seed: "same" });
  assert.deepEqual(a.assignments.map((x) => x.text), b.assignments.map((x) => x.text));
  const outputs = new Set();
  for (let i = 0; i < 6; i++) outputs.add(run(meals, {}, plan(), { seed: "s" + i }).assignments.map((x) => x.text).join("|"));
  assert.ok(outputs.size > 1);
});

test("never picks a meal the caller marks ineligible", () => {
  const meals = dinners(8);
  const res = PlannerEngine.planWeek({
    meals, plans: {}, plan: plan(), slots: SLOTS, seed: "t",
    isEligible: (m, k) => eligible(m, k) && m.name !== "DinnerA",
  });
  assert.ok(!names(res, KD).includes("DinnerA"));
});

test("favors meals that have rested over ones eaten last week", () => {
  const meals = dinners(12);
  const last = week("2026-09-27", { [KD]: meals.slice(0, 7).map((m) => m.name) }, meals);
  const picked = names(run(meals, { "2026-09-27": last }, plan()), KD);
  const overlap = picked.filter((n) => meals.slice(0, 7).some((m) => m.name === n));
  assert.ok(overlap.length <= 2, "picked " + picked.join(","));
});

test("counts typed-in text as history even without a meal link", () => {
  const meals = dinners(12);
  const last = week("2026-09-27", { [KD]: meals.slice(0, 7).map((m) => m.name) }, meals, true);
  const picked = names(run(meals, { "2026-09-27": last }, plan()), KD);
  const overlap = picked.filter((n) => meals.slice(0, 7).some((m) => m.name === n));
  assert.ok(overlap.length <= 2, "picked " + picked.join(","));
});

test("avoids repeats in a slot where the family always varies", () => {
  const meals = dinners(14);
  const plans = {
    "2026-09-27": week("2026-09-27", { [KD]: meals.slice(0, 7).map((m) => m.name) }, meals),
    "2026-09-20": week("2026-09-20", { [KD]: meals.slice(7, 14).map((m) => m.name) }, meals),
  };
  const picked = names(run(meals, plans, plan()), KD);
  assert.equal(new Set(picked).size, picked.length);
});

test("running again with the previous picks gives a different (still sensible) option", () => {
  const meals = dinners(14);
  const plans = {
    "2026-09-27": week("2026-09-27", { [KD]: meals.slice(0, 7).map((m) => m.name) }, meals),
    "2026-09-20": week("2026-09-20", { [KD]: meals.slice(7, 14).map((m) => m.name) }, meals),
  };
  const first = run(meals, plans, plan());
  const avoid = {};
  first.assignments.forEach((a) => (avoid[a.key] = a.mealId));
  const second = run(meals, plans, plan(), { avoid });
  const changed = second.assignments.filter((a) => avoid[a.key] !== a.mealId).length;
  assert.ok(changed >= 4, "only " + changed + " boxes changed");
  const picked = names(second, KD);
  assert.equal(new Set(picked).size, picked.length);
});

test("repeats a family habit slot and keeps a weekly ritual on its day", () => {
  const meals = ["Oatmeal", "Toast", "Cereal", "Pancakes", "Yogurt"].map((n) => mk(n, [PB]));
  const habit = ["Oatmeal", "Oatmeal", "Oatmeal", "Oatmeal", "Oatmeal", "Oatmeal", "Pancakes"];
  const plans = {
    "2026-09-27": week("2026-09-27", { [PB]: habit }, meals),
    "2026-09-20": week("2026-09-20", { [PB]: habit }, meals),
    "2026-09-13": week("2026-09-13", { [PB]: habit }, meals),
  };
  const picked = names(run(meals, plans, plan(), { routineSlots: [] }), PB);
  assert.equal(picked[6], "Pancakes");
  assert.ok(picked.slice(0, 6).filter((n) => n === "Oatmeal").length >= 4, picked.join(","));
});

const INDIAN = "Indian";
const breakfasts = () => [
  ...["Upma", "Paratha", "Anda", "Roti", "Daal"].map((n) => mk(n, [KB], [INDIAN])),
  ...["Toast", "Cereal", "Bagel", "Pancakes", "Waffles"].map((n) => mk(n, [KB], ["American"])),
];
const isIndian = (meals, name) => meals.find((m) => m.name === name).tags.includes(INDIAN);

test("alternates and spaces out Indian and non-Indian breakfasts", () => {
  const meals = breakfasts();
  for (let i = 0; i < 6; i++) {
    const picked = names(run(meals, {}, plan(), { seed: "alt" + i }), KB);
    assert.equal(picked.length, 7);
    for (let d = 1; d < 7; d++) {
      assert.notEqual(isIndian(meals, picked[d]), isIndian(meals, picked[d - 1]), "back-to-back same type: " + picked.join(","));
    }
  }
});

test("breakfast alternation works around boxes you filled by hand", () => {
  const meals = breakfasts();
  const manual = { [isoPlus(TARGET, 3) + "_" + KB]: { mealId: null, text: "Paratha" } };
  const picked = run(meals, {}, plan(manual)).assignments.filter((a) => a.slotKey === KB);
  const byDay = Object.fromEntries(picked.map((a) => [a.dayIdx, a.text]));
  assert.ok(!isIndian(meals, byDay[2]) && !isIndian(meals, byDay[4]), JSON.stringify(byDay));
});

test("breakfast alternation continues from last week's Saturday", () => {
  const meals = breakfasts();
  const lastWeek = week("2026-09-27", { [KB]: [null, null, null, null, null, null, "Anda"] }, meals);
  const picked = names(run(meals, { "2026-09-27": lastWeek }, plan()), KB);
  assert.ok(!isIndian(meals, picked[0]), "Sunday after an Indian Saturday: " + picked.join(","));
});

test("alternation does not break a daily habit breakfast", () => {
  const meals = [mk("Boiled Eggs", [PB]), mk("Special Anda", [PB], [INDIAN]), mk("Indian Oatmeal", [PB], [INDIAN]), mk("Toast", [PB])];
  const habit = ["Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Indian Oatmeal", "Special Anda"];
  const plans = {};
  ["2026-09-27", "2026-09-20", "2026-09-13"].forEach((w) => (plans[w] = week(w, { [PB]: habit }, meals)));
  const picked = names(run(meals, plans, plan(), { routineSlots: [] }), PB);
  assert.ok(picked.slice(0, 5).filter((n) => n === "Boiled Eggs").length >= 3, picked.join(","));
  assert.equal(picked[6], "Special Anda");
});

test("parents breakfast and lunch repeat the usual week, even when other meals are fresher", () => {
  const meals = [
    mk("Boiled Eggs", [PB]), mk("Special Anda", [PB], [INDIAN]), mk("Oatmeal", [PB]), mk("Brand New Toast", [PB]),
    mk("Salad", [PL]), mk("Chef's Choice", [PL]), mk("Never Tried Wrap", [PL]),
  ];
  const pbWeek = ["Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Oatmeal", "Special Anda"];
  const plWeek = ["Chef's Choice", "Salad", "Salad", "Salad", "Salad", "Salad", "Chef's Choice"];
  const plans = {};
  ["2026-09-27", "2026-09-20", "2026-09-13"].forEach((w) => (plans[w] = week(w, { [PB]: pbWeek, [PL]: plWeek }, meals)));
  for (let i = 0; i < 4; i++) {
    const res = run(meals, plans, plan(), { seed: "r" + i });
    assert.deepEqual(names(res, PB), pbWeek);
    assert.deepEqual(names(res, PL), plWeek);
    assert.ok(res.assignments.filter((a) => a.slotKey === PB).every((a) => a.routine && /^Your usual/.test(a.reasons[0])));
  }
});

test("a routine only needs to be mostly consistent", () => {
  const meals = ["Eggs", "Toast", "Cereal", "Oatmeal", "Yogurt"].map((n) => mk(n, [PB]));
  const w = (a) => ({ [PB]: a });
  const plans = {
    "2026-09-27": week("2026-09-27", w(["Eggs", "Eggs", "Eggs", "Eggs", "Eggs", "Toast", "Cereal"]), meals),
    "2026-09-20": week("2026-09-20", w(["Eggs", "Eggs", "Eggs", "Eggs", "Eggs", "Oatmeal", "Yogurt"]), meals),
    "2026-09-13": week("2026-09-13", w(["Eggs", "Eggs", "Eggs", "Toast", "Eggs", "Cereal", "Toast"]), meals),
  };
  const picked = names(run(meals, plans, plan()), PB);
  assert.deepEqual(picked.slice(0, 5), ["Eggs", "Eggs", "Eggs", "Eggs", "Eggs"]);
  assert.equal(picked.length, 7);
});

test("a saved routine wins over history, and unavailable routine meals fall back gracefully", () => {
  const meals = [mk("Eggs", [PB]), mk("Toast", [PB]), mk("Cereal", [PB])];
  const plans = { "2026-09-27": week("2026-09-27", { [PB]: Array(7).fill("Eggs") }, meals), "2026-09-20": week("2026-09-20", { [PB]: Array(7).fill("Eggs") }, meals) };
  const routine = { [PB]: Array(7).fill({ mealId: "id-Toast", text: "Toast" }) };
  assert.deepEqual(names(run(meals, plans, plan(), { routine }), PB), Array(7).fill("Toast"));
  const noToast = run(meals, plans, plan(), { routine, routineOk: (m) => m.name !== "Toast" });
  assert.ok(!names(noToast, PB).includes("Toast"));
  assert.equal(names(noToast, PB).length, 7);
  const typed = run(meals, {}, plan(), { routine: { [PB]: Array(7).fill({ mealId: null, text: "Grandma's porridge" }) } });
  assert.deepEqual(names(typed, PB), Array(7).fill("Grandma's porridge"));
  assert.ok(typed.assignments.filter((a) => a.slotKey === PB).every((a) => a.mealId === null));
});

test("never changes parents dinner boxes that are already filled", () => {
  const meals = [...dinners(8).map((m) => ({ ...m, slots: [PD] })), mk("Chicken Thighs", [PD], ["High Effort"])];
  const cells = {};
  [0, 2, 4].forEach((d) => (cells[isoPlus(TARGET, d) + "_" + PD] = { mealId: "id-Chicken Thighs", text: "Chicken Thighs" }));
  cells[isoPlus(TARGET, 5) + "_" + PD] = { mealId: null, text: "Dad's special" };
  const res = run(meals, {}, plan(cells));
  const pd = res.assignments.filter((a) => a.slotKey === PD);
  assert.equal(pd.length, 3);
  [0, 2, 4, 5].forEach((d) => assert.ok(!pd.some((a) => a.dayIdx === d)));
  assert.ok(!pd.some((a) => a.text === "Chicken Thighs"), "the manual dinners count as already used this week");
});

test("keeps a weekly balance of Indian and non-Indian breakfasts even when one kind is far fresher", () => {
  const meals = breakfasts();
  const tried = week("2026-09-27", { [KB]: ["Upma", "Paratha", "Anda", "Roti", "Daal", "Upma", "Paratha"] }, meals);
  for (let i = 0; i < 8; i++) {
    const picked = names(run(meals, { "2026-09-27": tried }, plan(), { seed: "bal" + i }), KB);
    const indian = picked.filter((n) => isIndian(meals, n)).length;
    assert.ok(indian >= 2 && indian <= 4, "Indian breakfasts: " + indian + " in " + picked.join(","));
  }
});

test("the family's own Indian share sets the weekly balance", () => {
  const meals = breakfasts();
  const mostlyIndian = ["Upma", "Paratha", "Anda", "Roti", "Daal", "Upma", "Paratha"];
  const plans = {
    "2026-09-27": week("2026-09-27", { [KB]: mostlyIndian }, meals),
    "2026-09-20": week("2026-09-20", { [KB]: mostlyIndian }, meals),
  };
  const picked = names(run(meals, plans, plan()), KB);
  assert.ok(picked.filter((n) => isIndian(meals, n)).length >= 3, picked.join(","));
});

test("weeks Auto-Populate filled never teach the planner a habit (no self-reinforcing repeats)", () => {
  // Early on the library was tiny, so whole weeks were filled with one meal per slot. That's what was
  // planned, not what the family prefers, so a full library afterwards must not keep repeating it.
  const lunches = ["Sandwich", "Wrap", "Soup", "Salad", "Pizza", "Noodles", "Burrito", "Quesadilla"].map((n) => mk(n, [NL]));
  const breakfasts = ["Eggs", "Toast", "Cereal", "Oatmeal", "Yogurt", "Pancakes", "Bagel", "Smoothie"].map((n) => mk(n, [PB]));
  const meals = [...lunches, ...breakfasts];
  const autoWeek = (ws) => {
    const cells = {};
    for (let i = 0; i < 7; i++) {
      cells[isoPlus(ws, i) + "_" + NL] = { mealId: "id-Sandwich", text: "Sandwich", why: ["Haven't had this one yet"] };
      cells[isoPlus(ws, i) + "_" + PB] = { mealId: "id-Eggs", text: "Eggs", why: ["Haven't had this one yet"] };
    }
    return { weekStart: ws, cells };
  };
  const plans = {};
  ["2026-09-27", "2026-09-20", "2026-09-13"].forEach((w) => (plans[w] = autoWeek(w)));
  const res = run(meals, plans, plan());
  assert.ok(new Set(names(res, NL)).size >= 6, "lunch locked on: " + names(res, NL).join(","));
  assert.ok(new Set(names(res, PB)).size >= 4, "breakfast locked on: " + names(res, PB).join(","));
  assert.ok(!res.assignments.some((a) => a.routine), "an auto-filled week must not become the routine");

  // The same weeks chosen by hand (no auto note) are a genuine habit and are respected.
  const chosen = JSON.parse(JSON.stringify(plans));
  Object.values(chosen).forEach((p) => Object.values(p.cells).forEach((c) => delete c.why));
  const habit = run(meals, chosen, plan());
  assert.deepEqual(names(habit, PB), Array(7).fill("Eggs"));
});

test("auto-filled weeks still count for how recently a meal was planned", () => {
  const meals = dinners(10);
  const cells = {};
  for (let i = 0; i < 7; i++) cells[isoPlus("2026-09-27", i) + "_" + KD] = { mealId: meals[i].id, text: meals[i].name, why: ["x"] };
  const picked = names(run(meals, { "2026-09-27": { weekStart: "2026-09-27", cells } }, plan()), KD);
  ["DinnerH", "DinnerI", "DinnerJ"].forEach((fresh) => assert.ok(picked.includes(fresh), "the never-planned " + fresh + " should be used first: " + picked.join(",")));
});

test("limits takeout nights in a week", () => {
  const meals = [...dinners(6), ...["T1", "T2", "T3", "T4", "T5", "T6"].map((n) => mk(n, [KD], [TAKEOUT]))];
  for (let i = 0; i < 5; i++) {
    const res = run(meals, {}, plan(), { seed: "k" + i });
    assert.ok(res.assignments.filter((a) => /^T\d$/.test(a.text)).length <= 2);
  }
});

test("keeps quick meals on busy weeknights and big cooking off back-to-back days", () => {
  const hard = ["H1", "H2", "H3", "H4"].map((n) => mk(n, [KD], ["High Effort"]));
  const quick = ["Q1", "Q2", "Q3", "Q4", "Q5"].map((n) => mk(n, [KD], ["Quick"]));
  const res = run([...hard, ...quick], {}, plan());
  const picked = names(res, KD);
  const hardDays = picked.map((n, i) => (n.startsWith("H") ? i : -1)).filter((i) => i >= 0);
  hardDays.forEach((d) => assert.ok(!hardDays.includes(d + 1), "back-to-back high effort: " + picked.join(",")));
  const weeknight = picked.slice(1, 5);
  assert.ok(weeknight.filter((n) => n.startsWith("Q")).length >= 3, picked.join(","));
});

test("existing manual picks count toward the week's variety", () => {
  const meals = dinners(12);
  const res = run(meals, {}, plan({ [isoPlus(TARGET, 1) + "_" + KD]: { mealId: null, text: "DinnerA" } }));
  assert.ok(!names(res, KD).includes("DinnerA"));
});

test("brings back something from this time last year", () => {
  const meals = [mk("Soup", [KD]), mk("Salad", [KD]), ...dinners(5)];
  const plans = {
    "2025-10-05": week("2025-10-05", { [KD]: [null, null, "Soup", null, null, null, null] }, meals),
    "2025-04-06": week("2025-04-06", { [KD]: [null, null, "Salad", null, null, null, null] }, meals),
  };
  const filler = {};
  for (let i = 0; i < 7; i++) if (i !== 2) filler[isoPlus(TARGET, i) + "_" + KD] = { mealId: null, text: "Filled" + i };
  const res = run(meals, plans, plan(filler));
  assert.deepEqual(names(res, KD), ["Soup"]);
});

test("survives messy saved data and empty libraries", () => {
  const meals = dinners(4);
  const messy = {
    a: null,
    b: { weekStart: "2026-09-27" },
    c: { weekStart: "2026-09-20", cells: { "bad-key": { text: "x" }, "2026-09-21_kids-dinner": { text: 42 }, "nonsense_kids-dinner": { text: "DinnerA" } } },
  };
  assert.doesNotThrow(() => run(meals, messy, plan()));
  const empty = run([], {}, plan());
  assert.equal(empty.assignments.length, 0);
  assert.equal(empty.skipped.length, 42);
});

test("stays fast with a big library and a long history", () => {
  const meals = Array.from({ length: 80 }, (_, i) => mk("Meal" + i, i % 3 === 0 ? [KD, PD] : [KD], i % 5 === 0 ? ["High Effort"] : ["Quick"]));
  const plans = {};
  for (let w = 1; w <= 26; w++) {
    const start = isoPlus(TARGET, -7 * w);
    plans[start] = week(start, { [KD]: Array.from({ length: 7 }, (_, i) => "Meal" + ((w * 7 + i) % 80)) }, meals);
  }
  const t0 = Date.now();
  const res = run(meals, plans, plan());
  assert.ok(Date.now() - t0 < 2500);
  assert.equal(names(res, KD).length, 7);
});
