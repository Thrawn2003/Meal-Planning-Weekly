"use strict";

/* =====================================================================
   Real meal library, transcribed and categorized from the Jabbar family's
   "Jabbar-Weekly-Meals" planning slideshow (5 weeks, Sept 7 - Oct 3).
   Loaded once into a fresh meal library (see seedMealsIfNeeded in app.js).
   Where the same dish appeared in multiple slots across weeks, it's
   listed once with multiple slots rather than duplicated.
   ===================================================================== */

const DEFAULT_MEAL_SEED = [
  // ---- Breakfast ----
  ["Breakfast Tacos", ["kids-breakfast"], ["Mexican", "Quick"]],
  ["Bagel & Cream Cheese", ["kids-breakfast"], ["American", "Quick"]],
  ["Egg & Croissant", ["kids-breakfast"], ["American", "Quick"]],
  ["Upma", ["kids-breakfast"], ["South Asian", "Healthy"]],
  ["Avocado Toast", ["kids-breakfast", "parents-breakfast"], ["American", "Healthy", "Quick"]],
  ["Green Egg Monster", ["kids-breakfast"], ["American", "Kid-Favorite"]],
  ["Indian Oatmeal", ["kids-breakfast", "parents-breakfast"], ["South Asian", "Healthy", "Quick"]],
  ["Regular Oatmeal", ["kids-breakfast", "parents-breakfast"], ["American", "Healthy", "Quick"]],
  ["Special Anda", ["kids-breakfast", "parents-breakfast"], ["South Asian"]],
  ["Smokey Eggs", ["kids-breakfast", "parents-breakfast"], ["Quick"]],
  ["Bhendi Roti", ["kids-breakfast"], ["South Asian"]],
  ["Mash Ki Daal", ["kids-breakfast", "namath-lunch", "kids-dinner"], ["South Asian", "Vegetarian", "Meatless"]],
  ["Diner Breakfast (Out)", ["kids-breakfast"], ["American", "Takeout / Restaurant Night"]],
  ["Cereal & Milk", ["kids-breakfast"], ["American", "Quick", "Kid-Favorite"]],
  ["Boiled Eggs", ["parents-breakfast"], ["Quick", "Healthy"]],
  ["Eggs & Avocado", ["parents-breakfast"], ["Healthy", "Quick"]],

  // ---- Namath Lunch ----
  ["Pizza", ["namath-lunch", "kids-dinner"], ["Italian", "Carby", "Kid-Favorite"]],
  ["Kebab", ["namath-lunch"], ["South Asian"]],
  ["Samosa", ["namath-lunch"], ["South Asian", "Carby"]],
  ["Hot Dogs", ["namath-lunch"], ["American", "Quick", "Kid-Favorite"]],
  ["Wendy's (Takeout)", ["namath-lunch"], ["American", "Takeout / Restaurant Night"]],
  ["Aloo Paratha", ["namath-lunch"], ["South Asian", "Carby"]],
  ["Sandwich", ["namath-lunch", "parents-lunch"], ["American", "Quick"]],
  ["Chicken Nuggets", ["namath-lunch"], ["American", "Chicken", "Kid-Favorite", "Quick"]],
  ["School Lunch", ["namath-lunch"], ["Low Effort", "Quick"]],
  ["French Toast", ["namath-lunch"], ["American", "Carby"]],
  ["Bhendi Roll-Up", ["namath-lunch"], ["South Asian"]],

  // ---- Kids Dinner ----
  ["Burgers", ["kids-dinner", "parents-dinner"], ["American", "Beef", "Kid-Favorite"]],
  ["Talawa Gosht", ["kids-dinner"], ["South Asian", "High Effort"]],
  ["Pasta & Meatballs", ["kids-dinner"], ["Italian", "Carby", "Kid-Favorite"]],
  ["Chicken Ka Salan", ["kids-dinner"], ["South Asian", "Chicken", "High Effort"]],
  ["Indian Omelette & Roti", ["kids-dinner"], ["South Asian", "Quick"]],
  ["Takeout (General)", ["kids-dinner", "parents-dinner"], ["Takeout / Restaurant Night"]],
  ["Chinese Garlic Beef", ["kids-dinner"], ["Chinese", "Beef", "High Effort"]],
  ["Tomato Salan with Beef", ["kids-dinner"], ["South Asian", "Beef", "High Effort"]],
  ["Garlic Lemon Shrimp", ["kids-dinner", "parents-dinner"], ["Seafood", "Quick"]],
  ["Chipotle (Takeout)", ["kids-dinner"], ["Mexican", "Takeout / Restaurant Night", "Quick"]],
  ["Tarkari Ka Salan", ["kids-dinner"], ["South Asian", "Vegetarian", "Meatless", "High Effort"]],
  ["Chicken Tacos", ["kids-dinner", "parents-dinner"], ["Mexican", "Chicken", "Kid-Favorite"]],
  ["Shrimp Pasta", ["kids-dinner"], ["Italian", "Seafood"]],
  ["Whole Foods (Takeout)", ["kids-dinner", "parents-dinner"], ["Takeout / Restaurant Night"]],
  ["Khatti Daal", ["kids-dinner", "parents-dinner"], ["South Asian", "Vegetarian", "Meatless"]],
  ["Gosht", ["kids-dinner", "parents-dinner"], ["South Asian", "High Effort"]],
  ["Go Out / Restaurant", ["kids-dinner"], ["Takeout / Restaurant Night", "Weekend / Special"]],

  // ---- Parents Lunch ----
  ["Salad", ["parents-lunch"], ["Healthy", "Quick"]],
  ["Tuna Melt", ["parents-lunch"], ["American", "Seafood", "Quick"]],
  ["Chef's Choice (Whatever's Available)", ["parents-lunch"], ["Low Effort"]],

  // ---- Parents Dinner ----
  ["Chinese Takeout", ["parents-dinner"], ["Chinese", "Takeout / Restaurant Night"]],
  ["Chicken Thighs", ["parents-dinner"], ["Chicken", "High Effort"]],
  ["Simone's Chimichurri", ["parents-dinner"], ["Other Cuisine", "High Effort"]],
  ["Fish", ["parents-dinner"], ["Seafood", "Healthy"]],
  ["Date Night (Out)", ["parents-dinner"], ["Takeout / Restaurant Night", "Weekend / Special"]],
];
