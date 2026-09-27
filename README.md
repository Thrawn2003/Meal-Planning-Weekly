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

Click **✨ Auto-Populate Week** to fill every *empty* box with a meal suitable for that row, preferring meals you (or auto-populate) haven't used recently — never-used meals are picked first, then the least-recently-used ones. It won't touch boxes you've already filled in. It also respects your active filters and tries not to repeat the same meal twice in one week when an alternative exists.

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

The meal library starts empty — add your own real meals and their info on the Add New Meal page.
