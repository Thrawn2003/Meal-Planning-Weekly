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
- **Popularity and habits**: what your family eats most in that slot, learned per slot — so a daily breakfast can repeat all week while dinners stay varied.
- **Weekday and slot patterns**: a meal that's always eaten on Saturdays stays on Saturdays.
- **Trends and seasonality**: meals you've been eating more lately, and what you ate around this time last year.
- **A balanced week**: quick meals on busy weeknights, big cooking and takeout on relaxed days, at most two takeout nights, no back-to-back heavy-cooking days, a mix of proteins and cuisines, and no unwanted repeats.

It tries many arrangements and keeps the best one. Click Auto-Populate again after **Clear Week** and it steers away from its last suggestion, so you get a different option. Suggestions get smarter as you save more weeks.

To run the engine's tests: `node --test test/planner-engine.test.js` (Node 18+, no dependencies).

## Saving as a PDF

Click **🖨️ Save & Print PDF** on a filled-in week. This adds the week to **All PDFs** and opens your browser's print dialog — choose "Save as PDF" as the destination to get an actual PDF file, or print it directly.

## Categories (tags)

Default tags cover common ways to filter a weekly plan:

- **Effort / time**: Quick, Low Effort, High Effort, Meal-Prep Friendly, One-Pot
- **Nutrition / diet**: Healthy, Carby, Low-Carb, Vegetarian, Vegan, Gluten-Free, Dairy-Free
- **Main protein**: Chicken, Beef, Pork, Seafood, Meatless
- **Practicality**: Leftover-Friendly, Freezer-Friendly, Kid-Favorite, Picky-Eater-Safe
- **Cost / occasion**: Budget-Friendly, Takeout / Restaurant Night, Weekend / Special
- **Cuisine**: South Asian, American, Italian, Mexican, Chinese, Other Cuisine
- **Other**: Spicy, Seasonal, New Recipe

Add your own custom tags from the "+ Add Tag" box on the Add New Meal page. Custom tags (not the defaults above) can be removed with the "×" next to them — removing one strips it from any meals that had it.

## Meals

The meal library starts empty — add your own real meals and their info on the Add New Meal page. Add, edit (delete + re-add), or clear meals anytime; clicking "Clear All Meals" is permanent.
