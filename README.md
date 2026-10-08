# Meal Planning Weekly

A simple, static weekly meal planner. No build step, no server, no dependencies — just open `index.html` (or host it anywhere, e.g. GitHub Pages) and go. All data (meals, weekly plans, PDF history) is stored locally in your browser's `localStorage`.

## Navbar

- **Meal Planning** — Pick a week on a year-long calendar, then fill in a 7-day (Sunday–Saturday) table with 6 meal rows: Kids Breakfast, Namath Lunch, Kids Dinner, Parents Breakfast, Parents Lunch, Parents Dinner.
- **Add New Meal** — Build your meal library: name, which meal slot(s) it fits, and tags (effort/time, diet, main protein, practicality, cost/occasion, and more — see Categories below — or your own custom tags).
- **All PDFs** — Every week you've saved & printed shows up here so you can reopen and print it again.

## How the week picker works

Click any date on the calendar to set a start point, then click a second date. The app builds the full Sunday–Saturday week around the earlier of the two dates you clicked, and titles the planner "Week of [date] - [date]".

## Filling in a week

Each of the 42 boxes (7 days × 6 meal rows) has:

- A dropdown of meals from your library that fit that row (a meal with no slots assigned shows up everywhere).
- A text box you can type into directly to override or write a custom meal, no library entry required.

## Filters

Open the "Filters" panel above the table to:

- Hide meals with certain tags (e.g. hide anything tagged "Carby" or "High Effort").
- Hide meals used within the last 1–4 weeks, so you don't repeat something you just had.

Filters apply to both the dropdown choices and the Auto-Populate button below.

## Auto-Populate

Click **✨ Auto-Populate Week** to fill every *empty* box with the best-fitting meal. It never touches boxes you've already filled in, respects your active Filters, and shows a short ✨ note under each pick explaining why it was chosen (hover it for more).

It's a free, offline, rule-based planner (`js/planner-engine.js`) — **no AI, no API, no accounts, no cost**; everything is calculated in your browser from your own saved weeks. For each box it scores every eligible meal on:

- **How long since you last had it**, judged against how often that meal normally comes around (a weekly meal is "due" sooner than a once-a-month one). Meals you've never tried get a small exploration boost.
- **Popularity and habits**: what your family eats most in that slot, a gentle nudge toward favorites, never a takeover: no meal fills more than its fair share of a row (once a week when you have 7 or more meals for that slot). Only the Parents routine below repeats on purpose.
- **Weekday and slot patterns**: a meal that's always eaten on Saturdays stays on Saturdays.
- **Trends and seasonality**: meals you've been eating more lately, and what you ate around this time last year.
- **A balanced week**: quick meals on busy weeknights, big cooking and takeout on relaxed days, at most two takeout nights, no back-to-back heavy-cooking days, a mix of proteins and cuisines, and no unwanted repeats.
- **Alternating, balanced breakfasts**: Indian and non-Indian breakfasts are alternated and spaced out day to day (including from the end of last week and around boxes you filled by hand), and each week keeps the family's usual mix, so "haven't had it in a while" can't tip it to all one kind. Weekly rituals (like a Saturday special) are exempt, and it only applies when both kinds are available for that slot. Cuisine and protein are recognized from the meal's name when a meal has no tag for them.

**Parents Breakfast and Parents Lunch** repeat your usual for each weekday (what you had on that weekday in the same way across at least 3 of your recent hand-filled weeks, or the routine you saved with **📌 Save this week as my routine**). A slot where you've only ever had one or two meals is treated as a small library, not a routine. Auto-Populate tells you exactly what it repeated, and the **Repeat my usual** checkbox under *Parents' usual routine* turns this off so those rows vary like all the others. **Parents Dinner** boxes you've already filled are never touched, and count toward the week's variety.

It tries many arrangements and keeps the best one. Click Auto-Populate again after **Clear Week** and it steers away from its last suggestion, so you get a different option. Suggestions get smarter as you save more weeks.

To run the tests: `node --test test/planner-engine.test.js test/tag-tools.test.js test/dish-knowledge.test.js test/slide-meals.test.js` (Node 18+, no dependencies).

## Saving as a PDF

Click **🖨️ Save & Print PDF** on a filled-in week. This adds the week to **All PDFs** and opens your browser's print dialog — choose "Save as PDF" as the destination to get an actual PDF file, or print it directly.

## Categories (tags)

Tags are grouped. Cuisine and main protein can be checked against the meal itself; the rest are your call.

- **Cuisine**: Indian, American, Italian, Mexican, Chinese, Other Cuisine
- **Main protein**: Chicken, Beef, Lamb / Goat, Pork, Seafood, Eggs, Vegetarian
- **Effort & prep**: Quick, Low Effort, High Effort, One-Pot, Make-Ahead, Needs Planning Ahead
- **Diet**: Carby, Low-Carb, Healthy, Gluten-Free, Dairy-Free
- **Family**: Kid-Favorite, Spicy, Packable (school lunch)
- **Practical**: Good for Leftovers, Freezer-Friendly, Budget-Friendly
- **Occasion**: Takeout / Restaurant Night, Weekend / Special, New Recipe

**Nothing is assumed.** A meal only gets a tag if its name settles it outright (Pasta → Italian + Carby, Cereal → Quick + Low Effort, Date Night → Weekend / Special), if research on that dish backs it up (below), or you ticked it yourself. Whether a meal is healthy, a kid-favorite, spicy in *your* kitchen, or homemade vs. store-bought can't be known from a name, so those are asked about, never guessed. Words that don't pin down a protein don't set one: "gosht" just means meat, and meatballs, burgers and nuggets can each be made from several meats.

**Researched dishes** (`js/dish-knowledge.js`). About 25 common dishes (upma, aloo paratha, maash and khatti daal, bhindi, chicken / beef / vegetable salan, shrimp dishes, tacos, French toast, tuna melt, boiled eggs, oatmeal and more) were checked against recipe sites and USDA food-safety guidance. Each one records only what holds for the standard dish, with a note and links to its sources, shown on the review screen and when you type a matching name on Add New Meal. Effort tags follow the median total time across the recipes found:

- **Quick**: about 20 minutes or less, start to finish
- **Low Effort**: about 21 to 45 minutes, or very little hands-on work (baked chicken thighs: 40+ minutes in the oven, 5 to 10 of work)
- **High Effort**: about 90 minutes or more, or dough / frying / several components (beef curry simmers 1 to 2 hours)
- 46 to 89 minutes (chicken salan, khatti daal): no effort tag, since it's neither

Where a dish varies too much to call (samosa: homemade ≈ 2 h 40 min, store-bought ≈ minutes; spaghetti and meatballs: 35 min to 2.5 h; kebabs; talawa gosht's protein), only the facts that always hold are tagged (e.g. samosas and kebab mixtures freeze) and the rest is left for you. A dish with no research entry gets only the obvious tags.

**Tag review.** The first time you open this version, every effort, diet, family, practical and occasion tag from older versions is cleared (a backup of your old tags is kept in the browser as `mpw_tags_backup_v3`), the obvious and researched ones are applied (and protein guesses the name doesn't support are removed), and Add New Meal shows a **Start tag review** banner. It walks through your meals one at a time with the obvious and researched tags pre-ticked and explained: tick what's true, then Save & next (or Skip). Meals you add or edit yourself count as reviewed.

When you type a meal's name on Add New Meal, it suggests the obvious tags as one-click chips. Add your own tags from the "+ Add Tag" box; tags you added (not the built-in ones) can be removed with the "×" next to them, which also strips them from any meals that had them.

Older tag names are converted automatically: South Asian → Indian, Meatless/Vegan → Vegetarian, Meal-Prep Friendly → Make-Ahead, Leftover-Friendly → Good for Leftovers, Picky-Eater-Safe → Kid-Favorite (Seasonal is retired). Any leftover placeholder or demo meals from earlier versions are also removed, along with boxes that had been filled from them.

The planner itself still recognizes cuisine and protein from a meal's name when a meal has no tag for them, only while planning; it's never saved onto your meals, and a tag you set always wins.

## Meals

The meal library starts empty — add your own real meals and their info on the Add New Meal page. Add, edit (delete + re-add), or clear meals anytime; clicking "Clear All Meals" is permanent.

**Few meals ticked for a slot?** A meal only counts for the slots ticked on it. If a row has fewer than 7 of its own, Auto-Populate borrows meals ticked for the matching slot at the same time of day (Kids Breakfast ↔ Parents Breakfast, Namath/Parents Lunch, Kids/Parents Dinner) rather than repeating one meal, notes it under each borrowed box, and tells you which slots to tick on more meals. A row with nothing ticked stays empty.

## Meals from the family's slideshow

The first time the site loads, it adds the meals that appear in the family's slideshow of previous weeks (`js/slide-meals.js`, 53 meals). Each is placed only in the slots it was actually served in on the slides, and its tags come from the researched knowledge base (`js/dish-knowledge.js`, with sources) or from the name when that settles it. Dishes that depend on how your family makes them (Special Anda, Green Egg Monster, Pizza, Chicken Nuggets and so on) get only what is certain and are queued for the quick tag review. A meal you already have keeps its tags (or gets the researched ones if it had none) and only gains the slots it was served in; nothing is removed and a meal you delete later is not brought back.

The four dated weeks of the slideshow (Sept 7 through Oct 3) are also saved as your past weeks, day by day exactly as laid out in its tables, so Auto-Populate can learn your usual Parents Breakfast (Boiled Eggs) and Parents Lunch (Salad). Boxes you filled yourself are never overwritten; boxes Auto-Populate had guessed are replaced by what was really eaten. The undated first slide is not included. How the family said a few dishes are made (store-bought Chicken Nuggets, Samosa and Kebab; homemade Pizza; quick Green Egg Monster) is applied on top of the research. "Simones" on the slides is takeout from the Simone's restaurant and "Chimichurri Chicken" is its own dish.

