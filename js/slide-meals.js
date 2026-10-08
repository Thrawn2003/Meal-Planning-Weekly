"use strict";

// Every meal that appears in the family's "previous weeks" slideshow, with the slots it was actually
// served in there. Only names and slots come from the slides: tags are never guessed here (the app adds
// only the obvious ones and lets you confirm the rest in the guided tag review).
//
// Spelling follows the slides, with the repeats merged: "Garlic Shrimp" and "Garlic Lemon Shrimp" are one
// meal and "Talwa Ghost" is Talawa Gosht. "Simones" is takeout from the Simone's restaurant (the family's
// answer) and "Chimichurri Chicken" is its own dish.
// Not meals, so left out: "N/A", "Done", "??", "Milk w/ every meal" (a note) and Tomato Chutney (a side).
const SlideMeals = (() => {
  const KB = "kids-breakfast", NL = "namath-lunch", KD = "kids-dinner", PB = "parents-breakfast", PL = "parents-lunch", PD = "parents-dinner";

  const MEALS = [
    // Breakfasts
    ["Breakfast Tacos", [KB]],
    ["Bagel & Cream Cheese", [KB]],
    ["Bagel, Cream Cheese & Egg", [KB]],
    ["Egg & Croissant", [KB]],
    ["Upma", [KB]],
    ["Avocado Toast", [KB, PB]],
    ["Green Egg Monster", [KB]],
    ["Regular Oatmeal", [KB, PB]],
    ["Indian Oatmeal", [KB, PB]],
    ["Special Anda", [KB, PB]],
    ["Smokey Eggs", [KB, PB]],
    ["Bhendi Roti", [KB, NL]],
    ["Mash Ki Daal", [KB, NL]],
    ["Diner Breakfast", [KB]],
    ["Cereal & Milk", [KB]],
    ["Boiled Eggs", [PB]],
    ["Eggs & Avocado", [PB]],
    // Lunches
    ["Pizza", [NL]],
    ["Homemade Pizza", [NL]],
    ["Kebab", [NL]],
    ["Samosa", [NL]],
    ["Hot Dogs", [NL]],
    ["Wendy's", [NL]],
    ["Aloo Paratha", [NL]],
    ["Sandwich", [NL, PL]],
    ["Chicken Nuggets", [NL]],
    ["School Lunch", [NL]],
    ["French Toast", [NL]],
    ["Bhendi Roll-Up", [NL]],
    ["Mash Ki Daal Roll-Up", [NL]],
    ["Salad", [PL]],
    ["Tuna Melt", [PL]],
    ["Be Creative", [PL]],
    // Dinners
    ["Burgers", [KD, PD]],
    ["Talawa Gosht", [KD, PD]],
    ["Khatti Daal", [KD, PD]],
    ["Pasta", [KD]],
    ["Pasta & Meatballs", [KD]],
    ["Pasta & Shrimp", [KD]],
    ["Chicken Ka Salan", [KD]],
    ["Indian Omelette & Roti", [KD]],
    ["Chinese Garlic Beef", [KD]],
    ["Tomato Salan with Beef", [KD]],
    ["Tarkari Ka Salan", [KD]],
    ["Garlic Lemon Shrimp", [KD, PD]],
    ["Chicken Tacos", [KD, PD]],
    ["Chipotle", [KD]],
    ["Take Out", [KD]],
    ["Go Out", [KD]],
    ["Out: Whole Foods", [KD, PD]],
    ["Chinese Takeout", [PD]],
    ["Chicken Thighs", [PD]],
    ["Chimichurri Chicken", [PD]],
    ["Simone's Takeout", [PD]],
    ["Fish", [PD]],
    ["Date Night", [PD]],
  ];

  const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const norm = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

  const list = MEALS.map(([name, slots]) => ({ id: "slide_" + slug(name), name, slots: slots.slice() }));

  // Answers the family gave about how these are made. They are facts about this household, not research,
  // so they live here and not in the researched knowledge base.
  const EFFORT = ["Quick", "Low Effort", "High Effort"];
  const FAMILY = {
    "Chicken Nuggets": ["Quick", "Low Effort"], // frozen or store-bought
    Samosa: ["Quick", "Low Effort"], // store-bought
    Kebab: ["Quick", "Low Effort"], // store-bought
    Pizza: ["Italian", "Carby", "High Effort"], // made at home
    "Green Egg Monster": ["Quick", "Low Effort"],
  };

  // Adds the family's answers to a tag list; an effort answer replaces any other effort tag.
  function withFamily(name, tags) {
    const add = FAMILY[Object.keys(FAMILY).find((k) => norm(k) === norm(name))];
    let out = (tags || []).slice();
    if (!add) return out;
    if (add.some((t) => EFFORT.includes(t))) out = out.filter((t) => !EFFORT.includes(t));
    add.forEach((t) => !out.includes(t) && out.push(t));
    return out;
  }

  // The four dated weeks of the slideshow, exactly as laid out in its tables. Each row lists Sunday to
  // Saturday; null is an empty box, and an array is a box that lists several meals. Boxes that were not
  // meals ("Done", "??", "N/A") are left empty. The undated first slide is not included.
  const HISTORY = [
    {
      weekStart: "2026-09-06", // slide "Week of Sept 7 to Sept 12" (Monday to Saturday)
      rows: {
        [KB]: [null, "Smokey Eggs", "Egg & Croissant", "Bagel, Cream Cheese & Egg", ["Avocado Toast", "Green Egg Monster"], ["Indian Oatmeal", "Regular Oatmeal"], "Special Anda"],
        [NL]: [null, "Sandwich", "School Lunch", ["School Lunch", "Kebab"], ["School Lunch", "Hot Dogs"], "School Lunch", "Homemade Pizza"],
        [KD]: [null, "Chinese Garlic Beef", "Tomato Salan with Beef", "Pasta", "Tomato Salan with Beef", "Garlic Lemon Shrimp", "Chipotle"],
        [PB]: [null, "Smokey Eggs", "Eggs & Avocado", "Eggs & Avocado", "Eggs & Avocado", "Indian Oatmeal", "Special Anda"],
        [PL]: [null, "Sandwich", "Salad", "Salad", "Salad", "Salad", "Be Creative"],
        [PD]: [null, "Chinese Takeout", "Chicken Thighs", "Simone's Takeout", "Chimichurri Chicken", "Garlic Lemon Shrimp", "Date Night"],
      },
    },
    {
      weekStart: "2026-09-13", // slide "Week of Sept 14 to Sept 19" (Monday to Saturday)
      rows: {
        [KB]: [null, "Bhendi Roti", "Breakfast Tacos", "Mash Ki Daal", "Diner Breakfast", "Bagel, Cream Cheese & Egg", "Special Anda"],
        [NL]: [null, "Aloo Paratha", ["School Lunch", "French Toast"], "Samosa", "Pizza", "Bhendi Roll-Up", "Chicken Nuggets"],
        [KD]: [null, "Burgers", "Tarkari Ka Salan", "Pasta", "Tarkari Ka Salan", "Chicken Tacos", "Pasta"],
        [PB]: [null, "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Regular Oatmeal", "Special Anda"],
        [PL]: [null, "Salad", "Salad", "Salad", "Salad", "Salad", "Tuna Melt"],
        [PD]: [null, "Burgers", "Chicken Thighs", "Simone's Takeout", "Fish", "Chicken Tacos", "Date Night"],
      },
    },
    {
      weekStart: "2026-09-20", // slide "Week of Sept 20 to Sept 27" (Sunday to Saturday)
      rows: {
        [KB]: [null, "Smokey Eggs", "Regular Oatmeal", "Egg & Croissant", "Bhendi Roti", "Bagel & Cream Cheese", "Special Anda"],
        [NL]: ["Hot Dogs", "Pizza", "Bhendi Roti", "School Lunch", "Hot Dogs", "School Lunch", "Chicken Nuggets"],
        [KD]: ["Chicken Ka Salan", "Pasta & Shrimp", "Chicken Ka Salan", "Indian Omelette & Roti", "Pasta", "Out: Whole Foods", "Chipotle"],
        [PB]: ["Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Special Anda"],
        [PL]: [null, "Salad", "Salad", "Salad", "Salad", "Salad", "Be Creative"],
        [PD]: [null, { text: "Shrimp" }, "Chicken Thighs", "Simone's Takeout", "Chimichurri Chicken", "Out: Whole Foods", "Date Night"],
      },
    },
    {
      weekStart: "2026-09-27", // slide "Week of Sept 27 to Oct 3rd" (Sunday to Saturday)
      rows: {
        [KB]: ["Cereal & Milk", ["Avocado Toast", "Green Egg Monster"], "Bagel & Cream Cheese", "Egg & Croissant", "Mash Ki Daal", ["Indian Oatmeal", "Regular Oatmeal"], "Special Anda"],
        [NL]: ["Mash Ki Daal", "Hot Dogs", "School Lunch", "School Lunch", "Kebab", "Mash Ki Daal Roll-Up", "Chicken Nuggets"],
        [KD]: ["Burgers", ["Khatti Daal", "Talawa Gosht"], "Pasta", ["Khatti Daal", "Talawa Gosht"], "Garlic Lemon Shrimp", ["Take Out", "Go Out"], "Pasta"],
        [PB]: ["Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Boiled Eggs", "Indian Oatmeal", "Special Anda"],
        [PL]: [null, "Salad", "Salad", "Salad", "Salad", "Salad", null],
        [PD]: ["Burgers", ["Khatti Daal", "Talawa Gosht"], null, null, "Garlic Lemon Shrimp", null, "Date Night"],
      },
    },
  ];

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const isoPlus = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const pretty = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;

  // Saves the slideshow weeks into your saved weeks, as if you had filled them in by hand. Boxes you filled
  // yourself are never touched; boxes Auto-Populate filled (they carry a reason note) are replaced, since
  // they are guesses and the slide is what was really eaten. Each meal's "last used" week is brought up to date.
  function mergeHistory(plans, meals) {
    const byName = new Map(meals.map((m) => [norm(m.name), m]));
    const out = { weeks: 0, boxes: 0 };
    HISTORY.forEach((w) => {
      let plan = plans[w.weekStart];
      if (!plan) {
        const end = isoPlus(w.weekStart, 6);
        plan = plans[w.weekStart] = { weekStart: w.weekStart, weekEnd: end, title: `Week of ${pretty(w.weekStart)} - ${pretty(end)}`, cells: {} };
      }
      plan.cells = plan.cells || {};
      let touched = false;
      Object.entries(w.rows).forEach(([slotKey, days]) => {
        days.forEach((entry, d) => {
          if (entry == null) return;
          const key = isoPlus(w.weekStart, d) + "_" + slotKey;
          const existing = plan.cells[key];
          if (existing && String(existing.text || "").trim() && !(Array.isArray(existing.why) && existing.why.length)) return;
          const parts = Array.isArray(entry) ? entry : [entry];
          const names = parts.map((x) => (typeof x === "string" ? x : x.text));
          const first = byName.get(norm(names[0]));
          plan.cells[key] = { mealId: first ? first.id : null, text: names.join(" / ") };
          out.boxes++;
          touched = true;
          parts.forEach((x) => {
            const m = typeof x === "string" ? byName.get(norm(x)) : null;
            if (!m) return;
            m.usageHistory = m.usageHistory || [];
            if (!m.usageHistory.includes(w.weekStart)) m.usageHistory.push(w.weekStart);
            if (!m.lastUsed || m.lastUsed < w.weekStart) m.lastUsed = w.weekStart;
          });
        });
      });
      if (touched) out.weeks++;
    });
    return out;
  }

  // Older copies of this import called one dish "Simone's Chimichurri Chicken". It was really two things:
  // the Simone's takeout and Chimichurri Chicken. Renames it (only if nobody has edited it).
  function fixOldNames(meals) {
    let fixed = 0;
    meals.forEach((m) => {
      if (m.id === "slide_simone-s-chimichurri-chicken" && m.tagsReviewed === false) {
        m.id = "slide_chimichurri-chicken";
        m.name = "Chimichurri Chicken";
        fixed++;
      }
    });
    return fixed;
  }

  // Applies the family's answers to meals that are already in the library. Tags someone confirmed
  // themselves in the review are never changed.
  function applyFamilyAnswers(meals) {
    let changed = 0;
    meals.forEach((m) => {
      const key = Object.keys(FAMILY).find((k) => norm(k) === norm(m.name));
      if (!key) return;
      const hasEffort = (m.tags || []).some((t) => EFFORT.includes(t));
      if (m.tagsReviewed === true && hasEffort) return;
      const next = withFamily(m.name, m.tags);
      if (next.join("|") !== (m.tags || []).join("|")) {
        m.tags = next;
        changed++;
      }
    });
    return changed;
  }

  // Adds the slide meals to a library without touching what is already there: a meal with the same name
  // keeps any tags it has (or gets the researched ones if it has none) and only gains the slots it was
  // served in, and nothing is ever removed.
  // `tagsFor(name)` supplies the obvious tags for a new meal.
  function mergeInto(meals, tagsFor) {
    const byName = new Map(meals.map((m) => [norm(m.name), m]));
    const result = { added: 0, widened: 0, tagged: 0 };
    list.forEach((s) => {
      const have = byName.get(norm(s.name));
      if (have) {
        // A meal with no tags at all gets the researched ones; tags someone already chose are never changed.
        if (tagsFor && !(have.tags || []).length) {
          const found = tagsFor(have.name);
          if (found.length) {
            have.tags = found;
            result.tagged++;
          }
        }
        const before = (have.slots || []).length;
        // A meal with no slots ticked already fits everywhere, so there is nothing to widen.
        if (before) {
          const union = [...new Set([...(have.slots || []), ...s.slots])];
          if (union.length > before) {
            have.slots = union;
            result.widened++;
          }
        }
        return;
      }
      meals.push({
        id: s.id,
        name: s.name,
        slots: s.slots.slice(),
        tags: withFamily(s.name, tagsFor ? tagsFor(s.name) : []),
        tagsReviewed: false,
        lastUsed: null,
        usageHistory: [],
      });
      result.added++;
    });
    return result;
  }

  return { list, mergeInto, mergeHistory, fixOldNames, applyFamilyAnswers, withFamily, HISTORY };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SlideMeals;
