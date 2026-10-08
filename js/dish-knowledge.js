"use strict";

/* Researched facts about common dishes (typical times from recipe sites, storage from USDA), free and offline.
   Only things that hold for the standard dish are tagged; anything that depends on how YOUR family makes it
   (kid-favorite, spicy, homemade vs store-bought) is left for you to answer in the tag review. */
const DishKnowledge = (() => {
  // How effort tags are decided: the median total time across the recipes researched.
  const RUBRIC = {
    quick: "Quick = about 20 minutes or less, start to finish",
    low: "Low Effort = about 21 to 45 minutes, or very little hands-on work",
    high: "High Effort = about 90 minutes or more, or dough / frying / several components",
    none: "Dishes that typically take 46 to 89 minutes get no effort tag",
  };
  const EFFORT = ["Quick", "Low Effort", "High Effort"];

  const src = (label, url) => ({ label, url });

  // Most specific first: the first entry that matches a name wins.
  const DISHES = [
    {
      id: "seekh-shami-kebab",
      match: /\b(seekh|shami)\b/i,
      tags: ["Indian", "Make-Ahead", "Freezer-Friendly"],
      note: "The kebab mixture keeps 1 to 3 days in the fridge, and shaped kebabs freeze before cooking. Total time depends on the type (seekh about 1.5 hours with marinating, shami several hours), so effort is left to you.",
      sources: [src("Tea for Turmeric: shami kebab", "https://www.teaforturmeric.com/shami-kebab/"), src("Show Me the Curry: seekh kebab", "https://showmethecurry.com/appetizers/seekh-kebab.html")],
    },
    {
      id: "samosa",
      match: /\bsamosas?\b/i,
      tags: ["Indian", "Make-Ahead", "Freezer-Friendly"],
      note: "Homemade samosas take about 2 hours 40 minutes, but they can be shaped and frozen uncooked, then fried from frozen. Store-bought ones are quick, so effort is left to you.",
      sources: [src("Cook With Manali: homemade samosa", "https://www.cookwithmanali.com/wprm_print/homemade-samosa-crispy-flaky"), src("Yummy Tummy: samosa", "https://www.yummytummyaarthi.com/wprm_print/samosa-recipe-samosa-samosa-making-in-english")],
    },
    {
      id: "bhendi-roti-roll",
      match: /\b(bhendi|bhindi|okra)\b.*\b(roti|roll|wrap)\b|\b(roti|roll|wrap)\b.*\b(bhendi|bhindi|okra)\b/i,
      tags: ["Indian", "Vegetarian"],
      note: "Okra (bhindi) masala takes 30 to 45 minutes on its own; adding roti or rolls changes the total, so effort is left to you.",
      sources: [src("MasterClass: bhindi masala", "https://www.masterclass.com/articles/bhindi-masala-recipe")],
    },
    {
      id: "bhindi",
      match: /\b(bhendi|bhindi|okra)\b/i,
      tags: ["Indian", "Vegetarian", "Low Effort"],
      note: "Bhindi (okra) masala recipes take 30 to 45 minutes in total (about 10 to 15 minutes prep, 15 to 30 minutes cooking).",
      sources: [src("Saveur: bhindi masala", "https://www.saveur.com/article/recipes/bhindi-masala-north-indian-okra-stir-fry"), src("MasterClass: bhindi masala", "https://www.masterclass.com/articles/bhindi-masala-recipe")],
    },
    {
      id: "tarkari-sabzi",
      match: /\b(tarkari|sabzi|subzi)\b/i,
      tags: ["Indian", "Vegetarian", "Low Effort"],
      note: "Vegetable curries (tarkari / sabzi) come out at 20 to 50 minutes across recipes, with a median of about 30.",
      sources: [src("Tarla Dalal: subzi ka salan", "https://tarladalal.com/Subzi-Ka-Salan-257r"), src("J Cooking Odyssey: Indian vegetable curry", "https://www.jcookingodyssey.com/wprm_print/indian-vegetable-curry"), src("Sailu's Food: mixed vegetable curry", "https://www.sailusfood.com/mixed-vegetable-curry")],
    },
    {
      id: "beef-salan",
      match: /\bsalan\b.*\bbeef\b|\bbeef\b.*\b(salan|curry)\b/i,
      tags: ["Indian", "Beef", "High Effort"],
      note: "Beef curries simmer 1 to 2 hours until the meat is tender (most recipes say 1.25 to 1.5 hours), so about 1 hour 45 minutes in total.",
      sources: [src("Khin's Kitchen: Indian beef curry", "https://khinskitchen.com/wprm_print/indian-beef-curry"), src("Great British Chefs: chaukandar gosht", "https://www.greatbritishchefs.com/recipes/chaukandar-gosht-recipe/amp")],
    },
    {
      id: "chicken-salan",
      match: /\bchicken\b.*\b(salan|curry)\b|\bsalan\b.*\bchicken\b/i,
      tags: ["Indian", "Chicken"],
      note: "Pakistani-style chicken salan takes 45 to 55 minutes in most recipes (up to 1 hour 20 minutes), which falls between Low and High Effort, so no effort tag.",
      sources: [src("Tea for Turmeric: chicken salan", "https://www.teaforturmeric.com/wprm_print/authentic-chicken-curry-easy-chicken-salan"), src("Fatima Cooks: chicken salan", "https://fatimacooks.net/wprm_print/chicken-salan-recipe-pakistani-chicken-shorba-curry")],
    },
    {
      id: "talawa-gosht",
      match: /\b(talawa|talwa|tawa|tala)\s+(gosht|ghost)\b/i,
      tags: ["Indian"],
      note: "Pan-fried meat curry, about 35 to 40 minutes of cooking after prep. 'Gosht' just means meat and is made with beef or mutton, so the protein is left to you.",
      sources: [src("Masala TV: tawa gosht", "https://www.masala.tv/?p=46931"), src("Archana's Kitchen: Pakistani bhuna gosht", "https://www.archanaskitchen.com/recipe/pakistani-bhuna-gosht-recipe")],
    },
    {
      id: "mash-daal",
      match: /\b(mash|maash)\b.*\b(dal|daal)\b/i,
      tags: ["Indian", "Vegetarian", "Needs Planning Ahead"],
      note: "Maash (urad) dal should be soaked from 30 minutes up to overnight, then simmers about 25 minutes; 45 minutes to an hour in all.",
      sources: [src("Tea for Turmeric: maash ki dal", "https://www.teaforturmeric.com/maash-ki-daal-urad-dal"), src("Cook With Manali: sabut urad dal", "https://www.cookwithmanali.com/wprm_print/sabut-urad-dal-recipe")],
    },
    {
      id: "khatti-daal",
      match: /\bkhatti\b.*\b(dal|daal)\b/i,
      tags: ["Indian", "Vegetarian"],
      note: "Khatti (sour, tamarind) dal takes 40 to 60 minutes, which falls between Low and High Effort, so no effort tag.",
      sources: [src("Whisk Affair: Hyderabadi khatti dal", "https://www.whiskaffair.com/hyderabadi-khatti-dal-recipe/")],
    },
    {
      id: "upma",
      match: /\bupma\b/i,
      tags: ["Indian", "Vegetarian", "Low Effort"],
      note: "Rava upma takes 17 to 30 minutes in total across recipes (median about 23).",
      sources: [src("Tarla Dalal: upma", "https://www.tarladalal.com/Upma-video-by-tarla-dalal-406v"), src("Herbivore Cucina: rava upma", "https://herbivorecucina.com/wprm_print/rava-semolina-upma"), src("But First, Chai: rava upma", "https://butfirstchai.com/wprm_print/rava-upma-recipe")],
    },
    {
      id: "aloo-paratha",
      match: /\baloo\b.*\bparatha\b/i,
      tags: ["Indian", "Vegetarian", "Carby", "Low Effort"],
      note: "Aloo paratha recipes run 25 to 60 minutes in total (median about 40) including making the dough and filling.",
      sources: [src("Hebbar's Kitchen: aloo paratha", "https://hebbarskitchen.com/wprm_print/38191"), src("Holy Cow Vegan: aloo paratha", "https://holycowvegan.net/wprm_print/aloo-paratha-recipe")],
    },
    {
      id: "masala-omelette",
      match: /\b(masala|indian)\b.*\bomelet+e?\b/i,
      tags: ["Indian", "Eggs", "Quick", "Low Effort"],
      note: "A masala omelette with roti is about 10 to 15 minutes in total.",
      sources: [src("Caroline's Cooking: masala omelette", "https://www.carolinescooking.com/masala-omelette"), src("Cure.fit: masala omelette with roti", "https://www.cure.fit/live/recipe/masala-omelette-with-roti/RECIPE150")],
    },
    {
      id: "shrimp-pasta",
      match: /\bshrimp\b.*\b(pasta|spaghetti|linguine|scampi)\b|\b(pasta|spaghetti|linguine)\b.*\bshrimp\b/i,
      tags: ["Italian", "Seafood", "Carby", "Low Effort"],
      note: "Weeknight shrimp pasta takes 15 to 30 minutes (median about 25).",
      sources: [src("Food From Portugal: 15-minute shrimp spaghetti", "https://www.foodfromportugal.com/recipes/spaghetti-shrimps-seafood-delights/"), src("ABC News: lemon garlic shrimp pasta", "https://abcnews.go.com/food/story/dinner-easy-lemon-garlic-shrimp-pasta-81896673")],
    },
    {
      id: "garlic-lemon-shrimp",
      match: /\b(garlic\b.*\blemon|lemon\b.*\bgarlic)\b.*\bshrimp\b|\bshrimp\b.*\b(garlic\b.*\blemon|lemon\b.*\bgarlic)\b/i,
      tags: ["Seafood", "Quick", "Low Effort"],
      note: "Garlic lemon shrimp is 10 to 20 minutes in total across recipes.",
      sources: [src("Life Is But a Dish: 15-minute garlic lemon shrimp", "https://www.lifeisbutadish.com/15-minute-garlic-lemon-shrimp/"), src("Taste of Home: garlic lemon shrimp", "https://www.tasteofhome.com/recipes/garlic-lemon-shrimp-for-2/print/")],
    },
    {
      id: "spaghetti-meatballs",
      match: /\bmeatballs?\b/i,
      tags: ["Italian", "Carby"],
      note: "Spaghetti and meatballs ranges from about 35 minutes (easy versions) to 2.5 hours (slow-simmered). Meatballs can be beef, pork, veal or turkey, so the protein and effort are left to you.",
      sources: [src("Taste of Home: best spaghetti and meatballs", "https://www.tasteofhome.com/recipes/best-spaghetti-and-meatballs/print/"), src("DeLallo: traditional spaghetti and meatballs", "https://www.delallo.com/recipe/traditional-spaghetti-and-meatballs")],
    },
    {
      id: "tuna-melt",
      match: /\btuna melts?\b/i,
      tags: ["American", "Seafood", "Quick", "Low Effort"],
      note: "Tuna melts take 10 to 31 minutes (median about 15).",
      sources: [src("Tasty: tuna melt", "https://tasty.co/recipe/tuna-melt"), src("Jo Cooks: tuna melt", "https://www.jocooks.com/wprm_print/tuna-melt")],
    },
    {
      id: "chicken-tacos",
      match: /\bchicken\b.*\btacos?\b|\btacos?\b.*\bchicken\b/i,
      tags: ["Mexican", "Chicken", "Low Effort"],
      note: "Weeknight chicken tacos take about 22 to 30 minutes in total.",
      sources: [src("House of Yumm: 30-minute chicken tacos", "https://houseofyumm.com/wprm_print/30-minute-chicken-tacos"), src("MasterClass: how to make chicken tacos", "https://www.masterclass.com/articles/how-to-make-chicken-tacos")],
    },
    {
      id: "breakfast-tacos",
      match: /\bbreakfast tacos?\b/i,
      tags: ["Mexican", "Eggs", "Quick", "Low Effort"],
      note: "Scrambled-egg breakfast tacos take about 15 minutes in total.",
      sources: [src("Lil' Luna: breakfast tacos", "https://lilluna.com/wprm_print/breakfast-tacos-recipe"), src("xoxoBella: breakfast tacos", "https://xoxobella.com/wprm_print/breakfast-tacos")],
    },
    {
      id: "french-toast",
      match: /\bfrench toast\b/i,
      tags: ["American", "Vegetarian", "Carby", "Quick", "Low Effort"],
      note: "Classic French toast takes 15 to 25 minutes (median about 20); the overnight-soak version is the exception.",
      sources: [src("Reluctant Gourmet: French toast", "https://reluctantgourmet.com/wprm_print/french-toast-recipe"), src("RecipeTin Eats: French toast", "https://www.recipetineats.com/wprm_print/recipe/26450")],
    },
    {
      id: "chinese-garlic-beef",
      match: /\bchinese\b.*\bbeef\b|\bgarlic beef\b|\bbeef\b.*\bstir[- ]?fry\b/i,
      tags: ["Chinese", "Beef", "Low Effort"],
      note: "Beef and garlic stir-fry takes 20 to 25 minutes in most recipes.",
      sources: [src("RecipeTin Eats: Chinese beef stir fry", "https://www.recipetineats.com/wprm_print/22004"), src("The Woks of Life: beef stir fry", "https://thewoksoflife.com/wprm_print/beef-stir-fry-with-vegetables")],
    },
    {
      id: "chicken-thighs",
      match: /\bchicken thighs?\b/i,
      tags: ["Chicken", "Low Effort"],
      note: "Baked bone-in chicken thighs take 40 to 53 minutes in the oven but only 5 to 10 minutes of hands-on work.",
      sources: [src("Jersey Girl Cooks: baked bone-in thighs", "https://www.jerseygirlcooks.com/wprm_print/baked-bone-in-chicken-thighs-with-crispy-skin"), src("Baked by Bree: bone-in thighs", "https://bakedbree.com/wprm_print/bone-in-chicken-thighs")],
    },
    {
      id: "boiled-eggs",
      match: /\b(hard[- ])?boiled eggs?\b/i,
      tags: ["Eggs", "Low Effort", "Make-Ahead", "Gluten-Free", "Dairy-Free"],
      note: "Large eggs hard-boil in 10 to 13 minutes (about 23 minutes with cooling). The USDA says hard-cooked eggs keep in the fridge for 1 week, so they suit making ahead. Plain eggs contain no gluten or dairy.",
      sources: [src("Gimme Some Oven: hard boiled eggs", "https://www.gimmesomeoven.com/hard-boiled-eggs/print/62518/"), src("USDA FSIS: shell eggs from farm to table", "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/eggs/shell-eggs-farm-table")],
    },
    {
      id: "oatmeal",
      match: /\b(oatmeal|oats|porridge)\b/i,
      tags: ["Vegetarian", "Quick", "Low Effort"],
      note: "Stovetop oatmeal takes 6 to 15 minutes in most recipes (median about 10).",
      sources: [src("Eating Bird Food: how to make oatmeal", "https://www.eatingbirdfood.com/wprm_print/38627"), src("Food Hero: stovetop oatmeal", "https://foodhero.org/recipes/stovetop-oatmeal")],
    },
    {
      id: "avocado-toast",
      match: /\bavocado toast\b/i,
      tags: ["American", "Vegetarian", "Quick", "Low Effort"],
      note: "Avocado toast is 2 to 20 minutes in total (most recipes say 5 to 10).",
      sources: [src("What's Gaby Cooking: avocado toast", "https://whatsgabycooking.com/wprm_print/34394"), src("UCLA Health: easy avocado toast", "https://www.uclahealth.org/simms-mann-center/recipes/easy-avocado-toast")],
    },
    // ---- Added for the meals in the family's slideshow of previous weeks ----
    {
      id: "bagel-cream-cheese-egg",
      match: /\bbagels?\b.*\begg|\begg.*\bbagels?\b/i,
      tags: ["American", "Eggs", "Quick", "Low Effort"],
      note: "Bagel breakfast sandwiches with egg list 7 to 25 minutes in total (median about 15), including versions with bacon and extra toppings.",
      sources: [src("The Grateful Girl Cooks: bagel breakfast sandwich (7 min)", "https://www.thegratefulgirlcooks.com/bagel-breakfast-sandwich/"), src("My Everyday Table: bacon egg and cheese bagel (11 min)", "https://myeverydaytable.com/how-to-make-a-bacon-egg-and-cheese-bagel-breakfast-sandwich/print/27022/"), src("The Carefree Kitchen: bagel breakfast sandwich (20 min)", "https://thecarefreekitchen.com/wprm_print/bagel-breakfast-sandwich-recipe"), src("Peas and Crayons: everything bagel breakfast sandwich (25 min)", "https://peasandcrayons.com/wprm_print/grilled-cheese-everything-bagel-breakfast-sandwich")],
    },
    {
      id: "egg-croissant",
      match: /\bcroissants?\b/i,
      tags: ["American", "Eggs", "Quick", "Low Effort"],
      note: "Egg and cheese croissant sandwiches list 10 to 20 minutes for a single sandwich or a couple (median about 16); only batch or freezer versions run to 30 to 45.",
      sources: [src("Emeril: croissant breakfast sandwich (10 min)", "https://www.emerils.com/print/131265"), src("All Things Mamma: croissant breakfast sandwich (15 min)", "https://www.allthingsmamma.com/wprm_print/croissant-breakfast-sandwich"), src("Six Sisters' Stuff: croissant breakfast sandwich (17 min)", "https://www.sixsistersstuff.com/wprm_print/117195"), src("Peas and Crayons: croissant breakfast sandwich (20 min)", "https://peasandcrayons.com/wprm_print/croissant-breakfast-sandwich")],
    },
    {
      id: "eggs-avocado",
      match: /\beggs?\b.*\bavo(cado)?\b|\bavo(cado)?\b.*\beggs?\b/i,
      tags: ["Eggs", "Vegetarian", "Quick", "Low Effort"],
      note: "Egg and avocado breakfasts take 9 to 12 minutes on the stove (median about 10); only baked egg-in-avocado versions run to about 25.",
      sources: [src("AislePrompt: avocado egg breakfast bowl (9 min)", "https://aisleprompt.com/recipes/avocado-egg-breakfast-bowl-44176"), src("Taste of Home: avocado scrambled eggs (10 min)", "https://f-cce-6601.toh.r.tmbi.com/recipes/avocado-scrambled-eggs/print"), src("The Gingham Apron: avocado, egg and toast", "https://theginghamapron.com/easyrecipe-print/15489-0")],
    },
    {
      id: "homemade-pizza",
      match: /\bhome[- ]?made\b.*\bpizza\b|\bpizza\b.*\bhome[- ]?made\b/i,
      tags: ["Italian", "Carby", "High Effort"],
      note: "Pizza from scratch takes 50 minutes to 2.5 hours (median about 80), mostly dough rising, and involves dough plus several toppings, so it counts as High Effort here.",
      sources: [src("Taste of Home: pizza from scratch", "https://www.tasteofhome.com/recipes/pizza-from-scratch/print/"), src("Thursday Night Pizza: easy homemade pizza (1.5 h)", "https://www.thursdaynightpizza.com/wprm_print/easy-homemade-pizza-recipe"), src("The Rustic Foodie: pizza dough (1.25 h)", "https://www.therusticfoodie.com/wprm_print/1216"), src("The Black Peppercorn: pizza dough (1 h 40)", "https://www.theblackpeppercorn.com/wprm_print/recipe/22112")],
    },
    {
      id: "hot-dogs",
      match: /\bhot ?dogs?\b/i,
      tags: ["American", "Quick", "Low Effort"],
      note: "Hot dogs are sold fully cooked and only need heating: about 4 to 5 minutes in simmering water. USDA advises people at higher risk of foodborne illness to heat them until steaming hot (165°F).",
      sources: [src("USDA FSIS: hot dogs and food safety", "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/meat-catfish/hot-dogs-food-safety")],
    },
    {
      id: "sandwich",
      match: /^\s*(a\s+)?sandwich(es)?\s*$/i,
      tags: ["American", "Quick", "Low Effort"],
      note: "A basic cold sandwich is assembled in about 5 minutes with no cooking. Fillings vary, so protein and diet tags are left to you.",
      sources: [src("Momables: turkey and cheese sandwich (5 min)", "https://www.momables.com/wprm_print/healthy-turkey-and-cheese-sandwich"), src("Alphafoodie: 5-minute turkey sandwich", "https://www.alphafoodie.com/turkey-sandwich/")],
    },
    {
      id: "simple-salad",
      match: /^\s*(a\s+)?(green\s+|side\s+)?salads?\s*$/i,
      tags: ["Quick", "Low Effort"],
      note: "A simple green salad lists 5 to 15 minutes in total (median about 10), with no cooking. What goes in it varies, so protein and diet tags are left to you.",
      sources: [src("Budget Bytes: simple side salad (5 min)", "https://www.budgetbytes.com/wprm_print/how-to-make-a-simple-side-salad"), src("Savory Experiments: simple side salad (10 min)", "https://www.savoryexperiments.com/wprm_print/simple-side-salad-recipe"), src("Two Peas and Their Pod: green salad (15 min)", "https://www.twopeasandtheirpod.com/wprm_print/green-salad")],
    },
    {
      id: "burgers",
      match: /^\s*(burgers?|hamburgers?)\s*$/i,
      tags: ["American", "Low Effort"],
      note: "Stovetop burgers take 15 to 25 minutes in total (median about 22). Burgers are usually beef but can be turkey, chicken or veggie, so the protein is left to you.",
      sources: [src("The Cookie Rookie: stovetop burgers (20 min)", "https://thecookierookie.com/stovetop-burgers"), src("Dinner, Then Dessert: stovetop burgers (25 min)", "https://dinnerthendessert.com/stovetop-burgers/"), src("Taste of Home: burgers on the stove (25 min)", "https://tasteofhome.com/?p=2005836")],
    },
    {
      id: "plain-pasta",
      match: /^\s*pasta\s*$/i,
      tags: ["Italian", "Carby", "Low Effort"],
      note: "Spaghetti with a weeknight marinara takes 15 to 30 minutes (median about 27) once the water is boiling.",
      sources: [src("Jernej's Kitchen: spaghetti marinara (15 min)", "https://jernejkitchen.com/printpdf/node/939"), src("SheKnows: one-pot spaghetti al pomodoro (25 min)", "https://www.sheknows.com/food-and-recipes/articles/1094575/one-pot-spaghetti-al-pomodoro/"), src("Delish D'Lites: weeknight spaghetti with meat sauce (30 min)", "https://www.delishdlites.com/occasion/fall-recipes/easy-weeknight-30-minute-weeknight-spaghetti-with-meat-sauce-recipe/")],
    },
    {
      id: "chimichurri-chicken",
      match: /\bchimichurri\b/i,
      tags: ["Chicken", "Other Cuisine", "Low Effort"],
      note: "Chimichurri chicken takes about 35 to 45 minutes (range 20 to 50) including a short marinade; chimichurri is an Argentinian herb sauce, so it is tagged Other Cuisine. A longer or overnight marinade adds time.",
      sources: [src("Serving Dumplings: chimichurri chicken (40 min)", "https://www.servingdumplings.com/recipe/chimichurri-chicken/"), src("The Forked Spoon: chimichurri chicken (45 min)", "https://theforkedspoon.com/wprm_print/chimichurri-chicken-recipe"), src("Springer Mountain Farms: chimichurri chicken tenders (35 min)", "https://springermountainfarms.com/recipes/chimichurri-chicken-tenders")],
    },
    {
      id: "baked-fish",
      match: /^\s*(a\s+)?fish\s*$/i,
      tags: ["Seafood", "Low Effort"],
      note: "Easy baked white fish takes 17 to 30 minutes in total (median about 22). Fried or restaurant fish would differ, so correct this if yours is cooked another way.",
      sources: [src("A Cedar Spoon: easy baked white fish", "https://www.acedarspoon.com/wprm_print/easy-baked-white-fish-recipe"), src("Fed & Fit: lemon butter baked white fish", "https://fedandfit.com/wprm_print/lemon-butter-baked-white-fish"), src("Taste of Home: fast baked fish (25 min)", "https://www.tasteofhome.com/recipes/fast-baked-fish/print/")],
    },
  ];

  function lookup(name) {
    const n = String(name == null ? "" : name);
    const d = DISHES.find((x) => x.match.test(n));
    return d ? { id: d.id, tags: d.tags.slice(), note: d.note, sources: d.sources.slice() } : null;
  }

  // Adds the researched tags to a tag list. A researched effort tag replaces any other effort tag.
  function applyToTags(name, tags) {
    const d = lookup(name);
    let out = (tags || []).slice();
    if (!d) return out;
    if (d.tags.some((t) => EFFORT.includes(t))) out = out.filter((t) => !EFFORT.includes(t));
    d.tags.forEach((t) => !out.includes(t) && out.push(t));
    return out;
  }

  return { RUBRIC, DISHES, lookup, applyToTags };
})();

if (typeof module !== "undefined" && module.exports) module.exports = DishKnowledge;
