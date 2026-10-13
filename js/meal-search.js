"use strict";

// What a box offers while you type or browse, and what Ctrl+S saves into the library. Pure functions, no DOM.
const MealSearch = (() => {
  const DINNER_SLOTS = ["kids-dinner", "parents-dinner"];

  const isDinnerSlot = (slotKey) => DINNER_SLOTS.includes(slotKey);
  const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const flat = (s) => norm(s).replace(/ /g, "");
  const fitsSlot = (meal, slotKey) => !meal.slots || meal.slots.length === 0 || meal.slots.includes(slotKey);
  const isDinnerOption = (meal) => !meal.slots || meal.slots.length === 0 || meal.slots.some(isDinnerSlot);

  // Dinner boxes only offer dinner meals (the ones served at dinner on the family's slides, or with no slot
  // set). Every other box offers everything, with the meals that fit that box first.
  function optionsFor(meals, slotKey) {
    const pool = isDinnerSlot(slotKey) ? meals.filter(isDinnerOption) : meals.slice();
    return pool.sort((a, b) => fitsSlot(b, slotKey) - fitsSlot(a, slotKey) || a.name.localeCompare(b.name));
  }

  // How well a name matches what was typed; 0 means no match.
  function score(name, query) {
    const n = norm(name);
    const q = norm(query);
    if (!q) return 1;
    if (n === q) return 100;
    if (n.startsWith(q)) return 80;
    const words = n.split(" ");
    if (words.some((w) => w.startsWith(q))) return 60;
    const tokens = q.split(" ");
    if (tokens.every((t) => words.some((w) => w.startsWith(t)))) return 50;
    if (n.includes(q) || flat(name).includes(flat(query))) return 30;
    if (tokens.every((t) => n.includes(t))) return 20;
    return 0;
  }

  // Meals matching the typed text, best first, from the same pool a box would browse.
  function suggest(meals, query, slotKey, limit) {
    const pool = optionsFor(meals, slotKey);
    const q = String(query == null ? "" : query);
    if (!norm(q)) return limit ? pool.slice(0, limit) : pool;
    const scored = pool
      .map((m, i) => ({ m, s: score(m.name, q), i }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.m);
    return limit ? scored.slice(0, limit) : scored;
  }

  // Ctrl+S: puts the meals typed into a week into the library. A box whose text is not a library meal adds a
  // new meal (in that box's slot), a box that matches a library meal links to it, and a meal placed in a slot
  // it was not ticked for gains that slot. Nothing is ever removed or retagged.
  function collectNewMeals(plan, meals, slots, opts) {
    const o = opts || {};
    const byName = new Map(meals.map((m) => [norm(m.name), m]));
    const byId = new Map(meals.map((m) => [m.id, m]));
    const slotOrder = slots.map((s) => s.key);
    const out = { created: [], widened: [], linked: 0 };
    let n = 0;
    const widen = (meal, slotKey) => {
      if (!meal.slots || !meal.slots.length || meal.slots.includes(slotKey)) return;
      meal.slots = slotOrder.filter((k) => meal.slots.includes(k) || k === slotKey);
      if (!out.widened.includes(meal)) out.widened.push(meal);
    };

    const place = (partText, slotKey, preferred) => {
      let meal = preferred && norm(preferred.name) === norm(partText) ? preferred : byName.get(norm(partText));
      if (!meal) {
        meal = {
          id: o.makeId ? o.makeId(n++) : `meal_${Date.now()}_${n++}`,
          name: partText,
          slots: [slotKey],
          tags: o.tagsFor ? o.tagsFor(partText) : [],
          tagsReviewed: false,
          lastUsed: null,
          usageHistory: [],
        };
        meals.push(meal);
        byName.set(norm(partText), meal);
        byId.set(meal.id, meal);
        out.created.push(meal);
      } else {
        widen(meal, slotKey);
      }
      return meal;
    };

    Object.keys(plan.cells || {})
      .sort()
      .forEach((key) => {
        const cell = plan.cells[key];
        const slotKey = key.slice(key.indexOf("_") + 1);
        if (!slotOrder.includes(slotKey)) return;
        const text = String((cell && cell.text) || "").replace(/\s+/g, " ").trim();
        if (!text || text.length > 80) return;
        // A box listing several meals ("Kebab / Samosa") saves each one, not the combination.
        const parts = text.split(/\s*\/\s*/).filter(Boolean);
        const linked = cell.mealId && byId.get(cell.mealId);
        const metas = parts.map((p) => place(p, slotKey, parts.length === 1 ? linked : null));
        const first = metas[0];
        if (cell.mealId !== first.id) out.linked++;
        cell.mealId = first.id;
        metas.forEach((meal) => {
          if (plan.weekStart && !(meal.usageHistory || []).includes(plan.weekStart)) {
            meal.usageHistory = (meal.usageHistory || []).concat(plan.weekStart);
            if (!meal.lastUsed || meal.lastUsed < plan.weekStart) meal.lastUsed = plan.weekStart;
          }
        });
      });
    // a meal that was just created in one box and then reused in another box gets both slots
    out.created.forEach((m) => {
      Object.keys(plan.cells).forEach((key) => {
        const cell = plan.cells[key];
        if (cell && cell.mealId === m.id) {
          const slotKey = key.slice(key.indexOf("_") + 1);
          if (!m.slots.includes(slotKey)) m.slots = slotOrder.filter((k) => m.slots.includes(k) || k === slotKey);
        }
      });
    });
    return out;
  }

  return { DINNER_SLOTS, isDinnerSlot, isDinnerOption, fitsSlot, optionsFor, score, suggest, collectNewMeals };
})();

if (typeof module !== "undefined" && module.exports) module.exports = MealSearch;
