"use strict";

/* The tag set, migrations from older tags, and keyword-based tag suggestions (free, offline). */
const TagTools = (() => {
  const GROUPS = [
    { name: "Cuisine", tags: ["Indian", "American", "Italian", "Mexican", "Chinese", "Other Cuisine"] },
    { name: "Main protein", tags: ["Chicken", "Beef", "Lamb / Goat", "Pork", "Seafood", "Eggs", "Vegetarian"] },
    { name: "Effort", tags: ["Quick", "Low Effort", "High Effort"] },
    { name: "Diet", tags: ["Carby", "Healthy", "Gluten-Free", "Dairy-Free"] },
    { name: "Occasion & family", tags: ["Kid-Favorite", "Spicy", "Takeout / Restaurant Night", "Weekend / Special", "New Recipe"] },
  ];
  const ALL = GROUPS.flatMap((g) => g.tags);

  // Older tags that were vague, overlapping, or never used by the planner.
  const RENAMES = {
    "South Asian": "Indian",
    Meatless: "Vegetarian",
    Vegan: "Vegetarian",
    "One-Pot": "Low Effort",
    "Picky-Eater-Safe": "Kid-Favorite",
  };
  const DROPPED = ["Meal-Prep Friendly", "Low-Carb", "Leftover-Friendly", "Freezer-Friendly", "Budget-Friendly", "Seasonal"];

  const CUISINE_RULES = [
    ["Indian", /\b(indian|daal|dal|dhal|salan|gosht|ghost|paratha|roti|chapati|naan|samosas?|upma|anda|bhendi|bhindi|tarkari|khatti|chutney|biryani|pulao|curry|masala|tikka|korma|karahi|chana|paneer|keema|nihari|haleem|talawa|talwa|aloo|chaat|idli|dosa|poha|handi|vindaloo|saag|bhaji|pakora|halwa|kheer)\b/i],
    ["Mexican", /\b(mexican|tacos?|burritos?|quesadillas?|enchiladas?|chipotle|fajitas?|nachos?|guacamole|tamales?)\b/i],
    ["Chinese", /\b(chinese|fried rice|lo mein|chow mein|stir[- ]?fry|dumplings?|wontons?|general tso|kung pao|egg rolls?|sweet and sour|orange chicken)\b/i],
    ["Italian", /\b(italian|pizza|pasta|spaghetti|lasagn[ae]|meatballs?|ravioli|risotto|alfredo|penne|fettuccine|gnocchi|parmesan|carbonara|bolognese)\b/i],
    ["American", /\b(american|burgers?|hot ?dogs?|sandwich(es)?|bagels?|pancakes?|waffles?|french toast|toast|cereal|croissants?|nuggets?|mac (and|&|n) cheese|grilled cheese|tuna melt|blt|bbq|barbecue|diner|meatloaf|fries)\b/i],
  ];
  const MEAT_RULES = [
    ["Chicken", /\b(chicken|nuggets?|wings?)\b/i],
    ["Beef", /\b(beef|burgers?|steak|brisket|meatballs?|meatloaf)\b/i],
    ["Lamb / Goat", /\b(lamb|goat|mutton|gosht|ghost|rogan|nihari|haleem)\b/i],
    ["Pork", /\b(pork|bacon|ham|sausages?|ribs|carnitas)\b/i],
    ["Seafood", /\b(shrimp|prawns?|fish|salmon|tuna|crab|lobster|cod|tilapia|seafood|scallops?|haddock|kedgeree|saltfish)\b/i],
  ];
  const EGG_RULE = /\b(eggs?|omelet+e?|anda|frittata|shakshuka|benedict|quiche)\b/i;
  const VEG_RULE = /\b(daal|dal|dhal|paneer|tofu|veggies?|vegetables?|vegetarian|bhendi|bhindi|okra|tarkari|chana|aloo|khatti|upma|idli|dosa|poha)\b/i;
  const TAKEOUT_RULE = /\(out\)|\btake[- ]?out\b|\brestaurant\b|\bgo out\b|\beating out\b|\bwendy'?s\b|\bmcdonald'?s\b|\bchipotle\b|\bwhole foods\b|\bdate night\b|\bdiner\b|\bdelivery\b/i;

  function suggestTags(name) {
    const n = String(name == null ? "" : name);
    const out = [];
    const cuisine = CUISINE_RULES.find(([, re]) => re.test(n));
    if (cuisine) out.push(cuisine[0]);
    MEAT_RULES.forEach(([tag, re]) => re.test(n) && out.push(tag));
    const eggs = EGG_RULE.test(n);
    if (eggs) out.push("Eggs");
    if (!out.some((t) => MEAT_RULES.some(([m]) => m === t)) && !eggs && VEG_RULE.test(n)) out.push("Vegetarian");
    if (TAKEOUT_RULE.test(n)) out.push("Takeout / Restaurant Night");
    return out;
  }

  function mapTags(tags) {
    const out = [];
    (tags || []).forEach((t) => {
      if (DROPPED.includes(t)) return;
      const mapped = RENAMES[t] || t;
      if (!out.includes(mapped)) out.push(mapped);
    });
    return out;
  }

  const inGroup = (name, tags) => tags.some((t) => GROUPS.find((g) => g.name === name).tags.includes(t));

  // Current tags plus a missing cuisine / protein / takeout tag inferred from the name.
  // Never overrides a cuisine or protein tag that is already there.
  function fillGaps(name, existing) {
    const tags = mapTags(existing);
    suggestTags(name).forEach((t) => {
      const isCuisine = GROUPS[0].tags.includes(t);
      const isProtein = GROUPS[1].tags.includes(t);
      if (isCuisine && inGroup("Cuisine", tags)) return;
      if (isProtein && inGroup("Main protein", tags)) return;
      if (!tags.includes(t)) tags.push(t);
    });
    return tags;
  }

  // A copy of the meal as the planner should see it, so a meal without cuisine/protein tags still counts.
  const withInferredTags = (meal) => ({ ...meal, tags: fillGaps(meal.name, meal.tags) });

  // Renames/drops old tags, then fills in whatever the meal's name makes obvious.
  function migrateLibrary({ meals, customTags, excludedTags }) {
    (meals || []).forEach((m) => {
      m.tags = fillGaps(m.name, m.tags);
    });
    const retired = new Set([...Object.keys(RENAMES), ...DROPPED, ...ALL]);
    return {
      customTags: (customTags || []).filter((t) => !retired.has(t)),
      excludedTags: mapTags(excludedTags),
    };
  }

  return { GROUPS, ALL, RENAMES, DROPPED, suggestTags, mapTags, withInferredTags, migrateLibrary };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TagTools;
