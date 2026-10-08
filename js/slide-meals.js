"use strict";

// Every meal that appears in the family's "previous weeks" slideshow, with the slots it was actually
// served in there. Only names and slots come from the slides: tags are never guessed here (the app adds
// only the obvious ones and lets you confirm the rest in the guided tag review).
//
// Spelling follows the slides, with the repeats merged: "Garlic Shrimp" and "Garlic Lemon Shrimp" are one
// meal, "Talwa Ghost" is Talawa Gosht, and "Simones / Chimichurri Chicken" is Simone's Chimichurri Chicken.
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
    ["Simone's Chimichurri Chicken", [PD]],
    ["Fish", [PD]],
    ["Date Night", [PD]],
  ];

  const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const norm = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

  const list = MEALS.map(([name, slots]) => ({ id: "slide_" + slug(name), name, slots: slots.slice() }));

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
        tags: tagsFor ? tagsFor(s.name) : [],
        tagsReviewed: false,
        lastUsed: null,
        usageHistory: [],
      });
      result.added++;
    });
    return result;
  }

  return { list, mergeInto };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SlideMeals;
