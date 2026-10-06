"use strict";

/* The tag set, migrations from older tags, and keyword-based tag suggestions (free, offline). */
const TagTools = (() => {
  const GROUPS = [
    { name: "Cuisine", tags: ["Indian", "American", "Italian", "Mexican", "Chinese", "Other Cuisine"] },
    { name: "Main protein", tags: ["Chicken", "Beef", "Lamb / Goat", "Pork", "Seafood", "Eggs", "Vegetarian"] },
    { name: "Effort & prep", tags: ["Quick", "Low Effort", "High Effort", "One-Pot", "Make-Ahead", "Needs Planning Ahead"] },
    { name: "Diet", tags: ["Carby", "Low-Carb", "Healthy", "Gluten-Free", "Dairy-Free"] },
    { name: "Family", tags: ["Kid-Favorite", "Spicy", "Packable (school lunch)"] },
    { name: "Practical", tags: ["Good for Leftovers", "Freezer-Friendly", "Budget-Friendly"] },
    { name: "Occasion", tags: ["Takeout / Restaurant Night", "Weekend / Special", "New Recipe"] },
  ];
  const ALL = GROUPS.flatMap((g) => g.tags);

  // Older tag names, converted automatically.
  const RENAMES = {
    "South Asian": "Indian",
    Meatless: "Vegetarian",
    Vegan: "Vegetarian",
    "Meal-Prep Friendly": "Make-Ahead",
    "Leftover-Friendly": "Good for Leftovers",
    "Picky-Eater-Safe": "Kid-Favorite",
  };
  const DROPPED = ["Seasonal"];

  // Tags that can be checked against the meal itself. Everything else (effort, diet, kid, practical,
  // special) can't be known from a name, so it's cleared and then asked about - never assumed.
  const KEPT_WHEN_RESETTING = new Set([...GROUPS[0].tags, ...GROUPS[1].tags, "Takeout / Restaurant Night", "New Recipe"]);

  const CUISINE_RULES = [
    ["Indian", /\b(indian|daal|dal|dhal|salan|gosht|ghost|paratha|roti|chapati|naan|samosas?|upma|anda|bhendi|bhindi|tarkari|khatti|chutney|biryani|pulao|curry|masala|tikka|korma|karahi|chana|paneer|keema|nihari|haleem|talawa|talwa|aloo|chaat|idli|dosa|poha|handi|vindaloo|saag|bhaji|pakora|halwa|kheer)\b/i],
    ["Mexican", /\b(mexican|tacos?|burritos?|quesadillas?|enchiladas?|chipotle|fajitas?|nachos?|guacamole|tamales?)\b/i],
    ["Chinese", /\b(chinese|fried rice|lo mein|chow mein|stir[- ]?fry|dumplings?|wontons?|general tso|kung pao|egg rolls?|sweet and sour|orange chicken)\b/i],
    ["Italian", /\b(italian|pizza|pasta|spaghetti|lasagn[ae]|meatballs?|ravioli|risotto|alfredo|penne|fettuccine|gnocchi|parmesan|carbonara|bolognese)\b/i],
    ["American", /\b(american|burgers?|hot ?dogs?|sandwich(es)?|bagels?|pancakes?|waffles?|french toast|toast|cereal|croissants?|nuggets?|mac (and|&|n) cheese|grilled cheese|tuna melt|blt|bbq|barbecue|diner|meatloaf|fries)\b/i],
  ];
  // Only words that name the meat itself. "Gosht" just means meat (beef, mutton or goat), and meatballs,
  // burgers, nuggets and meatloaf can each be made from several meats, so those are asked, never assumed.
  const MEAT_RULES = [
    ["Chicken", /\bchicken\b/i],
    ["Beef", /\b(beef|steak|brisket)\b/i],
    ["Lamb / Goat", /\b(lamb|goat|mutton|rogan)\b/i],
    ["Pork", /\b(pork|bacon|ham|sausages?|ribs|carnitas)\b/i],
    ["Seafood", /\b(shrimp|prawns?|fish|salmon|tuna|crab|lobster|cod|tilapia|seafood|scallops?|haddock|kedgeree|saltfish)\b/i],
  ];
  const EGG_RULE = /\b(eggs?|omelet+e?|anda|frittata|shakshuka|benedict|quiche)\b/i;
  const VEG_RULE = /\b(daal|dal|dhal|paneer|tofu|veggies?|vegetables?|vegetarian|bhendi|bhindi|okra|tarkari|chana|aloo|khatti|upma|idli|dosa|poha)\b/i;
  const TAKEOUT_RULE = /\(out\)|\btake[- ]?out\b|\brestaurant\b|\bgo out\b|\beating out\b|\bwendy'?s\b|\bmcdonald'?s\b|\bchipotle\b|\bwhole foods\b|\bdate night\b|\bdiner\b|\bdelivery\b/i;

  // Only things a name settles outright. Anything debatable (healthy? kid-favorite? how hard?) is asked, not guessed.
  const CARBY_RULE = /\b(pasta|spaghetti|pizza|bagels?|parathas?|rotis?|naan|pancakes?|waffles?|french toast|noodles?|mac (and|&|n) cheese|biryani|pulao|fried rice|lasagn[ae])\b/i;
  const NO_COOK_RULE = /\b(cereal|bagels?|sandwich(es)?|boiled eggs?|yogurt|hot ?dogs?|school lunch)\b|\b(?<!french )toast\b/i;
  const SPECIAL_RULE = /\bdate night\b/i;

  // Cuisine, main protein and takeout: things you can check against the meal itself.
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

  // suggestTags plus the few effort/diet/occasion tags a name makes beyond doubt.
  function obviousTags(name) {
    const n = String(name == null ? "" : name);
    const out = suggestTags(n);
    const add = (t) => !out.includes(t) && out.push(t);
    if (CARBY_RULE.test(n)) add("Carby");
    if (NO_COOK_RULE.test(n) || TAKEOUT_RULE.test(n)) {
      add("Quick");
      add("Low Effort");
    }
    if (SPECIAL_RULE.test(n)) add("Weekend / Special");
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

  // Adds the given tags to a list without ever overriding an existing cuisine or protein tag.
  function addWithoutOverriding(tags, additions) {
    additions.forEach((t) => {
      if (GROUPS[0].tags.includes(t) && inGroup("Cuisine", tags)) return;
      if (GROUPS[1].tags.includes(t) && inGroup("Main protein", tags)) return;
      if (!tags.includes(t)) tags.push(t);
    });
    return tags;
  }

  // The planner's view of a meal: a missing cuisine / protein / takeout tag is inferred from the name.
  // Never saved onto the meal, and never overrides a tag that is there.
  const withInferredTags = (meal) => ({ ...meal, tags: addWithoutOverriding(mapTags(meal.tags), suggestTags(meal.name)) });

  // Renames old tags and drops retired ones (used by the first tag migration).
  function migrateLibrary({ meals, customTags, excludedTags }) {
    (meals || []).forEach((m) => {
      m.tags = addWithoutOverriding(mapTags(m.tags), suggestTags(m.name));
    });
    const retired = new Set([...Object.keys(RENAMES), ...DROPPED, ...ALL]);
    return {
      customTags: (customTags || []).filter((t) => !retired.has(t)),
      excludedTags: mapTags(excludedTags),
    };
  }


  // Protein tags that earlier name rules guessed (gosht -> lamb/goat, meatballs/burgers -> beef,
  // nuggets/wings -> chicken) but the name doesn't actually say. Removed from unconfirmed meals.
  function removeAssumedProteins(name, tags) {
    const n = String(name == null ? "" : name);
    const supported = new Set(MEAT_RULES.filter(([, re]) => re.test(n)).map(([t]) => t));
    const guessed = {
      "Lamb / Goat": /\b(gosht|ghost|nihari|haleem)\b/i,
      Beef: /\b(meatballs?|burgers?|meatloaf|kebabs?|kababs?)\b/i,
      Chicken: /\b(nuggets?|wings?)\b/i,
    };
    return (tags || []).filter((t) => !(guessed[t] && guessed[t].test(n) && !supported.has(t)));
  }

  // Clears every tag that can't be checked against the meal, applies the obvious ones, and marks the meal
  // as needing a quick review. Returns the old tags so nothing is lost for good.
  function resetGuessedTags(meals) {
    const backup = {};
    (meals || []).forEach((m) => {
      const old = Array.isArray(m.tags) ? m.tags.slice() : [];
      backup[m.id] = old;
      const kept = mapTags(old).filter((t) => KEPT_WHEN_RESETTING.has(t) || !ALL.includes(t));
      m.tags = addWithoutOverriding(kept, obviousTags(m.name));
      m.tagsReviewed = false;
    });
    return backup;
  }

  return { GROUPS, ALL, RENAMES, DROPPED, KEPT_WHEN_RESETTING, suggestTags, obviousTags, mapTags, withInferredTags, migrateLibrary, resetGuessedTags, removeAssumedProteins };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TagTools;
