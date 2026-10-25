"use strict";

/* =====================================================================
   Meal Planning Weekly — vanilla JS, no build step, localStorage only.
   ===================================================================== */

/* ---------------------- Constants ---------------------- */

const SLOTS = [
  { key: "kids-breakfast", label: "Kids Breakfast" },
  { key: "namath-lunch", label: "Namath Lunch" },
  { key: "kids-dinner", label: "Kids Dinner" },
  { key: "parents-breakfast", label: "Parents Breakfast" },
  { key: "parents-lunch", label: "Parents Lunch" },
  { key: "parents-dinner", label: "Parents Dinner" },
];

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STORAGE_KEYS = {
  meals: "mpw_meals",
  plans: "mpw_plans",
  pdfHistory: "mpw_pdf_history",
  filters: "mpw_filters",
  customTags: "mpw_custom_tags",
  currentWeekKey: "mpw_current_week_key",
  phantomCleanup: "mpw_phantom_cleanup_v2",
  tagsV2: "mpw_tags_v2",
  tagsV3: "mpw_tags_v3",
  tagsV4: "mpw_tags_v4",
  tagsBackupV3: "mpw_tags_backup_v3",
  routine: "mpw_routine",
  useRoutine: "mpw_use_routine",
  slideMealsV1: "mpw_slide_meals_v1",
  slideMealsV2: "mpw_slide_meals_v2",
  visited: "mpw_visited",
};

const DEFAULT_TAGS = TagTools.ALL;

/* ---------------------- One-time cleanups for older data ---------------------- */

// Meals that were never the user's: the early "Load Example Meals" demo, matched by exact
// name + slots + tags so a real meal that merely shares a name is left alone.
const OLD_DEMO_MEALS = [
  ["Scrambled Eggs & Toast", ["kids-breakfast", "parents-breakfast"], ["Quick", "Kid-Favorite"]],
  ["Oatmeal with Berries", ["kids-breakfast", "parents-breakfast"], ["Healthy", "Quick"]],
  ["Pancakes", ["kids-breakfast", "parents-breakfast"], ["Carby", "Kid-Favorite"]],
  ["Yogurt & Granola", ["kids-breakfast", "parents-breakfast"], ["Quick", "Healthy"]],
  ["Grilled Cheese & Soup", ["namath-lunch"], ["Carby", "Kid-Favorite", "Quick"]],
  ["Turkey Sandwich", ["namath-lunch"], ["Quick", "Low Effort"]],
  ["Chicken Caesar Salad", ["namath-lunch"], ["Healthy"]],
  ["Leftover Night", ["namath-lunch", "parents-lunch", "parents-dinner"], ["Low Effort", "Quick"]],
  ["Chicken Nuggets & Veggies", ["kids-dinner"], ["Kid-Favorite", "Quick"]],
  ["Mac and Cheese", ["kids-dinner"], ["Carby", "Kid-Favorite", "High Effort"]],
  ["Spaghetti and Meatballs", ["kids-dinner", "parents-dinner"], ["Carby", "High Effort", "Kid-Favorite"]],
  ["Tacos", ["kids-dinner", "parents-dinner"], ["Kid-Favorite", "Quick"]],
  ["Grilled Salmon & Rice", ["parents-dinner"], ["Healthy", "High Effort"]],
  ["Stir Fry Veggies & Tofu", ["parents-lunch", "parents-dinner"], ["Healthy"]],
  ["Roast Chicken & Potatoes", ["parents-dinner"], ["High Effort"]],
  ["Avocado Toast", ["parents-breakfast"], ["Healthy", "Quick"]],
  ["Breakfast Burritos", ["kids-breakfast", "parents-breakfast"], ["Carby", "High Effort"]],
  ["Homemade Pizza Night", ["kids-dinner", "parents-dinner"], ["Carby", "High Effort", "Kid-Favorite"]],
];

const sameItems = (a, b) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

// Removes the placeholder import (ids start with "seed_") and the demo meals above, wherever they
// are in the library and whether or not they were used, plus any box that was filled from them.
function removePhantomMeals() {
  if (loadJSON(STORAGE_KEYS.phantomCleanup, false)) return;
  saveJSON(STORAGE_KEYS.phantomCleanup, true);
  const isPhantom = (m) =>
    (typeof m.id === "string" && m.id.startsWith("seed_")) ||
    OLD_DEMO_MEALS.some(([n, s, t]) => m.name === n && sameItems(m.slots || [], s) && sameItems(m.tags || [], t));
  const removed = new Set(state.meals.filter(isPhantom).map((m) => m.id));
  if (!removed.size) return;
  state.meals = state.meals.filter((m) => !removed.has(m.id));
  Object.values(state.plans).forEach((p) => {
    Object.keys((p && p.cells) || {}).forEach((k) => {
      if (p.cells[k] && removed.has(p.cells[k].mealId)) delete p.cells[k];
    });
  });
  persistMeals();
  persistPlans();
}

// Renames/drops the older, vaguer tags and fills in a missing cuisine/protein from the meal's name.
function migrateTagsV2() {
  if (loadJSON(STORAGE_KEYS.tagsV2, false)) return;
  saveJSON(STORAGE_KEYS.tagsV2, true);
  const out = TagTools.migrateLibrary({
    meals: state.meals,
    customTags: state.customTags,
    excludedTags: state.filters.excludedTags,
  });
  state.customTags = out.customTags;
  state.filters.excludedTags = out.excludedTags;
  persistMeals();
  persistCustomTags();
  persistFilters();
}

// Most effort/diet/kid/special tags were guesses that can't be known from a name. Clears them from every
// meal (keeping a backup), applies only the obvious ones, and queues each meal for a quick tag review.
function migrateTagsV3(originalTags) {
  if (loadJSON(STORAGE_KEYS.tagsV3, false)) return;
  saveJSON(STORAGE_KEYS.tagsV3, true);
  const backup = TagTools.resetGuessedTags(state.meals);
  saveJSON(STORAGE_KEYS.tagsBackupV3, { ...backup, ...(originalTags || {}) });
  persistMeals();
}

// For meals you haven't confirmed yet: drops protein guesses the name doesn't support (e.g. "gosht" does
// not mean lamb), then adds the tags that research on the dish backs up (typical time, ingredients).
// Meals you've reviewed or edited yourself are never touched.
function migrateTagsV4() {
  if (loadJSON(STORAGE_KEYS.tagsV4, false)) return;
  saveJSON(STORAGE_KEYS.tagsV4, true);
  state.meals.forEach((m) => {
    if (m.tagsReviewed !== false) return;
    const cleaned = TagTools.removeAssumedProteins(m.name, m.tags);
    const filled = TagTools.withInferredTags({ name: m.name, tags: cleaned }).tags;
    m.tags = DishKnowledge.applyToTags(m.name, filled);
  });
  persistMeals();
}

// One time: adds the meals from the family's slideshow of previous weeks (names and slots straight from the
// slides, only obvious tags). Meals you already have keep their tags and just gain the slots they were served
// in; nothing is removed, and meals you delete later are not brought back.
function importSlideMeals() {
  if (loadJSON(STORAGE_KEYS.slideMealsV1, false)) return;
  saveJSON(STORAGE_KEYS.slideMealsV1, true);
  const out = SlideMeals.mergeInto(state.meals, (name) =>
    DishKnowledge.applyToTags(name, TagTools.withInferredTags({ name, tags: [] }).tags)
  );
  if (out.added || out.widened || out.tagged) persistMeals();
}

// One time, after the first import: applies what the family told us (store-bought vs homemade, quick dishes),
// fixes the old "Simone's Chimichurri Chicken" name, and saves the slideshow's four dated weeks as history so
// Auto-Populate can learn the usual Parents Breakfast and Lunch. Boxes you filled yourself are never touched.
function importSlideMealsV2() {
  if (loadJSON(STORAGE_KEYS.slideMealsV2, false)) return;
  saveJSON(STORAGE_KEYS.slideMealsV2, true);
  const tagsFor = (name) => DishKnowledge.applyToTags(name, TagTools.withInferredTags({ name, tags: [] }).tags);
  SlideMeals.fixOldNames(state.meals);
  SlideMeals.mergeInto(state.meals, tagsFor);
  SlideMeals.applyFamilyAnswers(state.meals);
  SlideMeals.mergeHistory(state.plans, state.meals);
  persistMeals();
  persistPlans();
}

/* ---------------------- Storage helpers ---------------------- */

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("Failed to read", key, e);
    return fallback;
  }
}

// Whether the last write to this browser's storage worked, and when. Shown next to the week title.
const saveStatus = { ok: true, at: null };

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    saveStatus.ok = true;
    saveStatus.at = new Date();
  } catch (e) {
    console.warn("Failed to save", key, e);
    saveStatus.ok = false;
  }
  updateSaveIndicator();
  return saveStatus.ok;
}

function updateSaveIndicator() {
  const el = document.getElementById("save-indicator");
  if (!el) return;
  el.classList.toggle("save-indicator-bad", !saveStatus.ok);
  if (!saveStatus.ok) {
    el.textContent = "⚠ This browser is not letting the site save";
    el.title = "Your changes will be lost when you close this tab. Open the site in a normal (not private) window and allow site data.";
  } else if (saveStatus.at) {
    el.textContent = "✓ Saved " + saveStatus.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    el.title = "Everything you type is saved in this browser as you go. Press Ctrl+S to also add the week to All PDFs and your meal library.";
  } else {
    el.textContent = "";
  }
}

// True when this browser lets the site keep data between visits (private windows and blocked site data do not).
function storageWorks() {
  try {
    const k = "mpw_storage_test";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------------------- App state ---------------------- */

const state = {
  meals: loadJSON(STORAGE_KEYS.meals, []),
  plans: loadJSON(STORAGE_KEYS.plans, {}), // keyed by weekStart ISO date
  pdfHistory: loadJSON(STORAGE_KEYS.pdfHistory, []), // [{weekKey, title, savedAt}]
  filters: loadJSON(STORAGE_KEYS.filters, { excludedTags: [], recencyWeeks: 0 }),
  customTags: loadJSON(STORAGE_KEYS.customTags, []),
  routine: loadJSON(STORAGE_KEYS.routine, {}), // { slotKey: [7 x {mealId, text} | null], by weekday Sun..Sat }
  useRoutine: loadJSON(STORAGE_KEYS.useRoutine, true),
  calendarYear: new Date().getFullYear(),
  calendarFirstClick: null, // ISO date string
  currentWeekKey: loadJSON(STORAGE_KEYS.currentWeekKey, null),
};

function persistMeals() { saveJSON(STORAGE_KEYS.meals, state.meals); }
function persistPlans() { saveJSON(STORAGE_KEYS.plans, state.plans); }
function persistPdfHistory() { saveJSON(STORAGE_KEYS.pdfHistory, state.pdfHistory); }
function persistFilters() { saveJSON(STORAGE_KEYS.filters, state.filters); }
function persistCustomTags() { saveJSON(STORAGE_KEYS.customTags, state.customTags); }
function persistRoutine() { saveJSON(STORAGE_KEYS.routine, state.routine); }
function persistCurrentWeekKey() { saveJSON(STORAGE_KEYS.currentWeekKey, state.currentWeekKey); }

// The built-in tag groups, plus a group for any tag the user (or an imported recipe) added.
function tagGroups() {
  const known = new Set(DEFAULT_TAGS);
  const extra = new Set(state.customTags);
  state.meals.forEach((m) => (m.tags || []).forEach((t) => !known.has(t) && extra.add(t)));
  const groups = TagTools.GROUPS.map((g) => ({ name: g.name, tags: g.tags.slice() }));
  if (extra.size) groups.push({ name: "Your own tags", tags: [...extra].sort() });
  return groups;
}

function allTags() {
  return tagGroups().flatMap((g) => g.tags);
}

// Meals as the planner should see them: a missing cuisine/protein tag is filled from the name.
function plannerMeals() {
  return state.meals.map(TagTools.withInferredTags);
}

/* ---------------------- Date helpers ---------------------- */

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function startOfWeekSunday(d) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function formatPretty(d) {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/* ---------------------- Navigation ---------------------- */

const views = {
  plan: document.getElementById("view-plan"),
  "add-meal": document.getElementById("view-add-meal"),
  pdfs: document.getElementById("view-pdfs"),
};

function showView(name) {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
  if (name === "add-meal") renderAddMealView();
  if (name === "pdfs") renderPdfHistoryView();
  if (name === "plan") renderPlanView();
  syncFitMode();
}

document.querySelectorAll(".nav-link").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

/* =====================================================================
   MEAL PLANNING VIEW: Calendar picker
   ===================================================================== */

const calendarPickerEl = document.getElementById("calendar-picker");
const weekTableWrapEl = document.getElementById("week-table-wrap");
const yearCalendarEl = document.getElementById("year-calendar");
const calYearLabelEl = document.getElementById("cal-year-label");
const calSelectionStatusEl = document.getElementById("cal-selection-status");

// While the week table is showing, the page is exactly one screen: the grid fills the window.
function syncFitMode() {
  const planning = !views.plan.classList.contains("hidden") && !weekTableWrapEl.classList.contains("hidden");
  document.body.classList.toggle("plan-fit", planning);
}

function renderPlanView() {
  if (state.currentWeekKey && state.plans[state.currentWeekKey]) {
    calendarPickerEl.classList.add("hidden");
    weekTableWrapEl.classList.remove("hidden");
    renderWeekTable();
  } else {
    calendarPickerEl.classList.remove("hidden");
    weekTableWrapEl.classList.add("hidden");
    renderYearCalendar();
  }
  syncFitMode();
}

function renderYearCalendar() {
  calYearLabelEl.textContent = state.calendarYear;
  yearCalendarEl.innerHTML = "";
  const today = new Date();

  for (let month = 0; month < 12; month++) {
    const monthEl = document.createElement("div");
    monthEl.className = "mini-month";

    const title = document.createElement("div");
    title.className = "mini-month-title";
    title.textContent = MONTH_NAMES[month];
    monthEl.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "mini-month-grid";

    ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach((d) => {
      const dow = document.createElement("div");
      dow.className = "dow";
      dow.textContent = d;
      grid.appendChild(dow);
    });

    const firstOfMonth = new Date(state.calendarYear, month, 1);
    const startPad = firstOfMonth.getDay();
    const daysInMonth = new Date(state.calendarYear, month + 1, 0).getDate();

    for (let i = 0; i < startPad; i++) {
      const empty = document.createElement("div");
      empty.className = "mini-day empty";
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(state.calendarYear, month, day);
      const iso = toISODate(dateObj);
      const dayEl = document.createElement("div");
      dayEl.className = "mini-day";
      dayEl.textContent = day;
      dayEl.dataset.date = iso;

      if (isSameDate(dateObj, today)) dayEl.classList.add("today");

      applySelectionHighlight(dayEl, dateObj);

      dayEl.addEventListener("click", () => handleCalendarDayClick(iso));
      grid.appendChild(dayEl);
    }

    monthEl.appendChild(grid);
    yearCalendarEl.appendChild(monthEl);
  }

  renderCalendarStatus();
}

function applySelectionHighlight(dayEl, dateObj) {
  if (!state.calendarFirstClick) return;
  const firstDate = fromISODate(state.calendarFirstClick);
  if (isSameDate(dateObj, firstDate)) {
    dayEl.classList.add("selected-endpoint");
  }
}

function renderCalendarStatus() {
  if (!state.calendarFirstClick) {
    calSelectionStatusEl.textContent = "👉 Click a date below to start choosing your week.";
  } else {
    calSelectionStatusEl.textContent = `Great, starting ${formatPretty(fromISODate(state.calendarFirstClick))} 🎉 Now click an end date (or click that same date again to just use that week).`;
  }
}

function handleCalendarDayClick(iso) {
  if (!state.calendarFirstClick) {
    state.calendarFirstClick = iso;
    renderYearCalendar();
    return;
  }

  const d1 = fromISODate(state.calendarFirstClick);
  const d2 = fromISODate(iso);
  const earlier = d1 <= d2 ? d1 : d2;

  const weekStart = startOfWeekSunday(earlier);
  const weekEnd = addDays(weekStart, 6);
  const weekKey = toISODate(weekStart);

  if (!state.plans[weekKey]) {
    state.plans[weekKey] = {
      weekStart: weekKey,
      weekEnd: toISODate(weekEnd),
      title: `Week of ${formatPretty(weekStart)} - ${formatPretty(weekEnd)}`,
      cells: {},
    };
    persistPlans();
  }

  hideAutoPopStatus();
  state.currentWeekKey = weekKey;
  persistCurrentWeekKey();
  state.calendarFirstClick = null;

  showView("plan");
}

document.getElementById("cal-prev-year").addEventListener("click", () => {
  state.calendarYear -= 1;
  renderYearCalendar();
});
document.getElementById("cal-next-year").addEventListener("click", () => {
  state.calendarYear += 1;
  renderYearCalendar();
});
document.getElementById("cal-today").addEventListener("click", () => {
  state.calendarYear = new Date().getFullYear();
  renderYearCalendar();
});

document.getElementById("change-week-btn").addEventListener("click", () => {
  hideAutoPopStatus();
  state.currentWeekKey = null;
  persistCurrentWeekKey();
  state.calendarFirstClick = null;
  renderPlanView();
});

/* =====================================================================
   MEAL PLANNING VIEW: Filters
   ===================================================================== */

const tagFilterListEl = document.getElementById("tag-filter-list");
const recencyFilterEl = document.getElementById("recency-filter");

function renderFilters() {
  tagFilterListEl.innerHTML = "";
  tagGroups().forEach((group) => {
    const wrap = document.createElement("div");
    wrap.className = "tag-group";
    const title = document.createElement("div");
    title.className = "tag-group-title";
    title.textContent = group.name;
    const row = document.createElement("div");
    row.className = "tag-chip-row";
    group.tags.forEach((tag) => {
      const label = document.createElement("label");
      label.className = "tag-chip-checkbox";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.filters.excludedTags.includes(tag);
      cb.addEventListener("change", () => {
        if (cb.checked) {
          if (!state.filters.excludedTags.includes(tag)) state.filters.excludedTags.push(tag);
        } else {
          state.filters.excludedTags = state.filters.excludedTags.filter((t) => t !== tag);
        }
        persistFilters();
        renderWeekTable();
      });
      label.appendChild(cb);
      const span = document.createElement("span");
      span.textContent = tag;
      label.appendChild(span);
      row.appendChild(label);
    });
    wrap.appendChild(title);
    wrap.appendChild(row);
    tagFilterListEl.appendChild(wrap);
  });

  recencyFilterEl.value = String(state.filters.recencyWeeks || 0);
}

recencyFilterEl.addEventListener("change", () => {
  state.filters.recencyWeeks = Number(recencyFilterEl.value);
  persistFilters();
  renderWeekTable();
});

function mealPassesTagFilters(meal) {
  return !(meal.tags || []).some((t) => state.filters.excludedTags.includes(t));
}

function mealPassesFilters(meal, weekStartISO) {
  if (!mealPassesTagFilters(meal)) return false;

  if (state.filters.recencyWeeks > 0 && meal.lastUsed) {
    const weekStart = fromISODate(weekStartISO);
    const lastUsedDate = fromISODate(meal.lastUsed);
    const diffDays = Math.round((weekStart - lastUsedDate) / (1000 * 60 * 60 * 24));
    // meal.lastUsed is always a week-start (Sunday), so diffDays is a multiple of 7.
    // recencyWeeks=1 should hide meals used THIS week or the immediately preceding week.
    if (diffDays >= 0 && diffDays <= state.filters.recencyWeeks * 7) return false;
  }
  return true;
}

function mealFitsSlot(meal, slotKey) {
  return !meal.slots || meal.slots.length === 0 || meal.slots.includes(slotKey);
}

/* =====================================================================
   MEAL PLANNING VIEW: Week table
   ===================================================================== */

const weekTitleEl = document.getElementById("week-title");
const weekTableHeadRowEl = document.getElementById("week-table-head-row");
const weekTableBodyEl = document.getElementById("week-table-body");

function currentPlan() {
  return state.plans[state.currentWeekKey];
}

function cellKey(dateISO, slotKey) {
  return `${dateISO}_${slotKey}`;
}

function weekDates(plan) {
  const start = fromISODate(plan.weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/* ---------------------- Meal panel (shared floating list) ----------------------
   One panel reused for every box. It is used two ways: as the suggestions that appear while you type in a
   box (the main way), and as the full "browse" list behind the small arrow button. It is positioned with
   the viewport, not an ancestor's scroll box, so it is always fully on-screen and scrollable in place. */

const mealPickerPanelEl = document.createElement("div");
mealPickerPanelEl.className = "meal-picker-panel hidden";
mealPickerPanelEl.setAttribute("role", "listbox");
document.body.appendChild(mealPickerPanelEl);

let activeMealPicker = null; // { anchorEl, items, index, onPick }

function closeMealPicker() {
  mealPickerPanelEl.classList.add("hidden");
  activeMealPicker = null;
}

function positionMealPicker(anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const margin = 6;
  const width = Math.max(rect.width, 280);

  mealPickerPanelEl.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  mealPickerPanelEl.style.width = `${width}px`;

  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;

  if (spaceBelow >= 180 || spaceBelow >= spaceAbove) {
    mealPickerPanelEl.style.top = `${rect.bottom + margin}px`;
    mealPickerPanelEl.style.bottom = "auto";
    mealPickerPanelEl.style.maxHeight = `${Math.max(120, Math.min(340, spaceBelow))}px`;
  } else {
    mealPickerPanelEl.style.bottom = `${window.innerHeight - rect.top + margin}px`;
    mealPickerPanelEl.style.top = "auto";
    mealPickerPanelEl.style.maxHeight = `${Math.max(120, Math.min(340, spaceAbove))}px`;
  }
}

function setPanelIndex(index) {
  if (!activeMealPicker) return;
  const buttons = mealPickerPanelEl.querySelectorAll(".meal-picker-item");
  if (!buttons.length) return;
  const next = (index + buttons.length) % buttons.length;
  activeMealPicker.index = next;
  buttons.forEach((btn, i) => {
    btn.classList.toggle("active", i === next);
    btn.setAttribute("aria-selected", i === next ? "true" : "false");
  });
  buttons[next].scrollIntoView({ block: "nearest" });
}

// Appends `text` with the part that matches `query` in bold.
function appendHighlighted(el, text, query) {
  const q = String(query || "").trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) {
    el.textContent = text;
    return;
  }
  el.appendChild(document.createTextNode(text.slice(0, at)));
  const strong = document.createElement("strong");
  strong.textContent = text.slice(at, at + q.length);
  el.appendChild(strong);
  el.appendChild(document.createTextNode(text.slice(at + q.length)));
}

function showMealPanel({ anchorEl, openerEl, items, query, onPick, heading, emptyText, activeFirst }) {
  mealPickerPanelEl.innerHTML = "";

  if (heading) {
    const head = document.createElement("div");
    head.className = "meal-picker-heading";
    head.textContent = heading;
    mealPickerPanelEl.appendChild(head);
  }

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "meal-picker-empty";
    empty.textContent = emptyText;
    mealPickerPanelEl.appendChild(empty);
  } else {
    items.forEach((m, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "meal-picker-item";
      item.setAttribute("role", "option");
      appendHighlighted(item, m.name, query);
      // mousedown fires before the box's own blur, so the choice registers before anything closes the panel.
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        onPick(m);
      });
      item.addEventListener("mousemove", () => {
        if (activeMealPicker && activeMealPicker.index !== i) setPanelIndex(i);
      });
      mealPickerPanelEl.appendChild(item);
    });
  }

  activeMealPicker = { anchorEl, openerEl: openerEl || null, items, index: -1, onPick };
  positionMealPicker(anchorEl);
  mealPickerPanelEl.classList.remove("hidden");
  mealPickerPanelEl.scrollTop = 0;
  if (activeFirst && items.length) setPanelIndex(0);
}

// The full list behind the small arrow button. Dinner boxes only list dinner meals.
function openMealPicker({ anchorEl, openerEl, weekStart, slotKey, onPick }) {
  const pool = state.meals.filter((m) => mealPassesFilters(m, weekStart));
  const items = MealSearch.optionsFor(pool, slotKey);
  const dinner = MealSearch.isDinnerSlot(slotKey);
  showMealPanel({
    anchorEl,
    openerEl,
    items,
    query: "",
    onPick,
    heading: dinner ? "Dinner meals" : "All meals (the ones for this box come first)",
    emptyText: dinner
      ? "No dinner meals yet. Add one on the Add New Meal tab, or check your filters. 🙂"
      : "Nothing to show here yet. Check your filters, or add a meal on the Add New Meal tab. 🙂",
  });
}

// Suggestions while typing: best matches first, dinner boxes only ever suggest dinner meals.
function openMealSuggestions({ anchorEl, slotKey, text, onPick }) {
  const query = String(text || "").trim();
  if (!query) return closeMealPicker();
  const pool = state.meals.filter(mealPassesTagFilters);
  const items = MealSearch.suggest(pool, query, slotKey, 8);
  if (!items.length) return closeMealPicker();
  showMealPanel({ anchorEl, items, query, onPick, activeFirst: true });
}

document.addEventListener("click", (e) => {
  if (!activeMealPicker) return;
  if (mealPickerPanelEl.contains(e.target) || e.target === activeMealPicker.anchorEl || e.target === activeMealPicker.openerEl) return;
  closeMealPicker();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && activeMealPicker) closeMealPicker();
});

window.addEventListener(
  "scroll",
  (e) => {
    // Keep the panel anchored through any scroll, including the browser's own focus-scroll when a
    // box near the edge of the table is opened. Closing here would make it vanish before it is seen.
    if (!activeMealPicker) return;
    if (mealPickerPanelEl.contains(e.target)) return;
    positionMealPicker(activeMealPicker.anchorEl);
  },
  true
);
window.addEventListener("resize", () => {
  if (activeMealPicker) positionMealPicker(activeMealPicker.anchorEl);
});

/* ---------------------- Special days ---------------------- */

function specialLabel(plan, dateISO) {
  return plan.special && Object.prototype.hasOwnProperty.call(plan.special, dateISO) ? plan.special[dateISO] : null;
}

function setSpecial(plan, dateISO, label) {
  plan.special = plan.special || {};
  if (label === null) delete plan.special[dateISO];
  else plan.special[dateISO] = label;
  persistPlans();
}

function renderWeekTable() {
  const plan = currentPlan();
  if (!plan) return;

  renderFilters();

  weekTitleEl.textContent = plan.title;
  updateSaveIndicator();

  const dates = weekDates(plan);

  // Header row
  weekTableHeadRowEl.innerHTML = "<th>Meal</th>";
  dates.forEach((d) => {
    const dateISO = toISODate(d);
    const special = specialLabel(plan, dateISO);
    const th = document.createElement("th");
    th.className = special !== null ? "special-day-head" : "";
    const nameSpan = document.createElement("span");
    nameSpan.className = "day-name";
    nameSpan.textContent = DOW_NAMES[d.getDay()];
    const dateSpan = document.createElement("span");
    dateSpan.className = "day-date";
    dateSpan.textContent = formatPretty(d);
    th.appendChild(nameSpan);
    th.appendChild(dateSpan);

    if (special === null) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "special-add-btn";
      add.textContent = "☆ Mark special";
      add.title = "Mark this day as a special day, like a birthday or a trip";
      add.addEventListener("click", () => {
        setSpecial(plan, dateISO, "");
        renderWeekTable();
        const input = weekTableHeadRowEl.querySelector(`input[data-date="${dateISO}"]`);
        if (input) input.focus();
      });
      th.appendChild(add);
    } else {
      const tag = document.createElement("div");
      tag.className = "special-tag";
      const star = document.createElement("span");
      star.textContent = "★";
      star.setAttribute("aria-hidden", "true");
      const input = document.createElement("input");
      input.type = "text";
      input.value = special;
      input.maxLength = 40;
      input.placeholder = "What's special?";
      input.dataset.date = dateISO;
      input.setAttribute("aria-label", `What is special about ${DOW_NAMES[d.getDay()]}?`);
      input.addEventListener("input", () => setSpecial(plan, dateISO, input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
      });
      input.title = special;
      input.addEventListener("blur", () => {
        input.scrollLeft = 0;
        input.title = input.value;
        if (!input.value.trim()) {
          input.value = "Special day";
          setSpecial(plan, dateISO, "Special day");
        }
      });
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "special-clear-btn";
      clear.textContent = "✕";
      clear.title = "Unmark this day";
      clear.setAttribute("aria-label", "Unmark this day as special");
      clear.addEventListener("click", () => {
        setSpecial(plan, dateISO, null);
        renderWeekTable();
      });
      tag.append(star, input, clear);
      th.appendChild(tag);
    }
    weekTableHeadRowEl.appendChild(th);
  });

  // Body rows
  weekTableBodyEl.innerHTML = "";
  SLOTS.forEach((slot) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = slot.label;
    // How many saved meals this row can use: the cause of most "it keeps repeating" problems.
    const usable = state.meals.filter((m) => mealFitsSlot(m, slot.key) && mealPassesFilters(m, plan.weekStart)).length;
    const countEl = document.createElement("span");
    countEl.className = "row-meal-count" + (usable < 7 ? " row-meal-count-low" : "");
    countEl.textContent = usable === 0 ? "no meals ticked" : `${usable} meal${usable === 1 ? "" : "s"}`;
    th.appendChild(countEl);
    tr.appendChild(th);

    dates.forEach((d) => {
      const dateISO = toISODate(d);
      const key = cellKey(dateISO, slot.key);
      const cellData = plan.cells[key] || { mealId: null, text: "" };

      const td = document.createElement("td");
      if (specialLabel(plan, dateISO) !== null) td.className = "special-day";
      const wrap = document.createElement("div");
      wrap.className = "cell-editor";

      const textarea = document.createElement("textarea");
      textarea.placeholder = "Type a meal…";
      textarea.value = cellData.text || "";
      textarea.rows = 2;
      textarea.setAttribute("aria-label", `${slot.label}, ${DOW_NAMES[d.getDay()]}`);
      textarea.setAttribute("autocomplete", "off");
      textarea.setAttribute("spellcheck", "false");

      const browseBtn = document.createElement("button");
      browseBtn.type = "button";
      browseBtn.className = "cell-browse-btn";
      browseBtn.textContent = "▾";
      browseBtn.title = MealSearch.isDinnerSlot(slot.key) ? "Browse dinner meals" : "Browse all meals";
      browseBtn.setAttribute("aria-label", "Browse meals for this box");

      const reasonEl = document.createElement("div");
      reasonEl.className = "cell-reason";
      if (cellData.why && cellData.why.length && cellData.text) {
        reasonEl.textContent = "✨ " + cellData.why[0];
        reasonEl.title = "Why this meal: " + cellData.why.join(" · ");
      } else {
        reasonEl.classList.add("hidden");
      }

      const pick = (meal) => {
        setCell(plan, key, { mealId: meal.id, text: meal.name });
        markMealUsed(meal, plan.weekStart);
        textarea.value = meal.name;
        reasonEl.classList.add("hidden");
        closeMealPicker();
      };

      browseBtn.addEventListener("click", () => {
        openMealPicker({ anchorEl: textarea, openerEl: browseBtn, weekStart: plan.weekStart, slotKey: slot.key, onPick: pick });
      });

      textarea.addEventListener("input", () => {
        setCell(plan, key, { mealId: null, text: textarea.value });
        reasonEl.classList.add("hidden");
        openMealSuggestions({ anchorEl: textarea, slotKey: slot.key, text: textarea.value, onPick: pick });
      });

      textarea.addEventListener("keydown", (e) => {
        const open = activeMealPicker && activeMealPicker.anchorEl === textarea && !mealPickerPanelEl.classList.contains("hidden");
        if (open && e.key === "ArrowDown") {
          e.preventDefault();
          setPanelIndex(activeMealPicker.index + 1);
        } else if (open && e.key === "ArrowUp") {
          e.preventDefault();
          setPanelIndex(activeMealPicker.index - 1);
        } else if (open && activeMealPicker.index >= 0 && (e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
          // Enter or Tab takes the highlighted suggestion, like filling a spreadsheet cell.
          const meal = activeMealPicker.items[activeMealPicker.index];
          if (e.key === "Enter") e.preventDefault();
          if (meal) pick(meal);
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          textarea.blur();
        }
      });

      // Typing a name that is exactly a library meal links the box to it, so recency and tags still apply.
      textarea.addEventListener("blur", () => {
        const text = textarea.value.trim();
        const current = plan.cells[key];
        if (!text || (current && current.mealId)) return;
        const hit = state.meals.find((m) => m.name.trim().toLowerCase() === text.toLowerCase());
        if (hit) setCell(plan, key, { mealId: hit.id, text: hit.name });
      });

      wrap.appendChild(textarea);
      wrap.appendChild(browseBtn);
      wrap.appendChild(reasonEl);
      td.appendChild(wrap);
      tr.appendChild(td);
    });

    weekTableBodyEl.appendChild(tr);
  });
  renderRoutinePanel();
}

function setCell(plan, key, data) {
  plan.cells[key] = data;
  persistPlans();
}

function markMealUsed(meal, weekStartISO) {
  meal.lastUsed = weekStartISO;
  meal.usageHistory = meal.usageHistory || [];
  if (!meal.usageHistory.includes(weekStartISO)) meal.usageHistory.push(weekStartISO);
  persistMeals();
}

/* ---------------------- Save to library (Ctrl+S) ---------------------- */

// Adds a week to the list on the All PDFs tab (or refreshes its saved time) without printing anything.
function recordSavedWeek(plan) {
  const record = { weekKey: plan.weekStart, title: plan.title, savedAt: new Date().toISOString() };
  const existingIdx = state.pdfHistory.findIndex((h) => h.weekKey === plan.weekStart);
  if (existingIdx >= 0) state.pdfHistory[existingIdx] = record;
  else state.pdfHistory.push(record);
  state.pdfHistory.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  persistPdfHistory();
}

// Ctrl+S: keeps this week (it is also saved as you type), lists it on All PDFs so it can be viewed or printed
// later, and puts every meal typed into it into the meal library, linking the boxes to those meals.
function saveWeek() {
  const plan = currentPlan();
  if (!plan) return;
  const out = MealSearch.collectNewMeals(plan, state.meals, SLOTS, {
    tagsFor: (name) => DishKnowledge.applyToTags(name, TagTools.withInferredTags({ name, tags: [] }).tags),
    makeId: (i) => `meal_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
  });
  persistMeals();
  persistPlans();
  persistCurrentWeekKey();
  recordSavedWeek(plan);

  const lines = [];
  if (saveStatus.ok) {
    lines.push({ text: `💾 Saved ${plan.title}.` });
    lines.push({ text: "It will be here when you come back to Meal Planning, and you can view or print it any time under All PDFs.", small: true });
  } else {
    lines.push({ text: "⚠ This browser would not save. Open the site in a normal (not private) window, or allow site data, so your week is kept." });
  }
  if (out.created.length) {
    const names = out.created.map((m) => m.name);
    lines.push({
      text: `Added ${names.length} new meal${names.length === 1 ? "" : "s"} to your meal library: ${names.slice(0, 6).join(", ")}${names.length > 6 ? ` and ${names.length - 6} more` : ""}. Each is ticked for the row you typed it in.`,
      small: true,
    });
  }
  const moved = out.widened.filter((m) => !out.created.includes(m));
  if (moved.length) {
    lines.push({ text: `${moved.length} meal${moved.length === 1 ? " was" : "s were"} also ticked for the row you used ${moved.length === 1 ? "it" : "them"} in.`, small: true });
  }
  showAutoPopStatus(lines);
  renderWeekTable();

  // Also keep a copy as a file on this computer, which survives browsers that clear a site's data when they close.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  backupToFile().then((r) => {
    if (r.status === "saved") lines.splice(1, 0, { text: `Also saved to your planner file (${r.name}), so it survives even if this browser clears its data.`, small: true });
    else if (r.status === "cancelled") lines.push({ text: "No planner file chosen, so this week is only kept inside this browser.", small: true });
    else if (r.status === "unsupported") lines.push({ text: "This browser can't keep a file for you. On the All PDFs tab you can download a backup instead.", small: true });
    else if (r.status === "error") lines.push({ text: "Couldn't write your planner file this time. It is still saved in this browser.", small: true });
    else return;
    showAutoPopStatus(lines);
  });
}

document.getElementById("save-week-btn").addEventListener("click", saveWeek);

document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== "s") return;
  const planning = !views.plan.classList.contains("hidden") && !weekTableWrapEl.classList.contains("hidden");
  if (!planning) return;
  e.preventDefault(); // not the browser's "save page" dialog
  closeMealPicker();
  saveWeek();
});

document.getElementById("clear-week-btn").addEventListener("click", () => {
  const plan = currentPlan();
  if (!plan) return;
  if (!confirm("Clear every meal in this week's table? This can't be undone.")) return;
  plan.cells = {};
  persistPlans();
  renderWeekTable();
});

/* =====================================================================
   Auto-Populate
   ===================================================================== */

const autoPopStatusEl = document.getElementById("autopop-status");
const autoPopStatusTextEl = document.getElementById("autopop-status-text");
const autoRollCounts = new Map();
const autoLastPicks = new Map();

let autoPopStatusTimer = null;

function hideAutoPopStatus() {
  autoPopStatusEl.classList.add("hidden");
  clearTimeout(autoPopStatusTimer);
}

function showAutoPopStatus(lines) {
  autoPopStatusTextEl.innerHTML = "";
  lines.forEach(({ text, small }) => {
    const p = document.createElement("p");
    p.textContent = text;
    if (small) p.className = "autopop-small";
    autoPopStatusTextEl.appendChild(p);
  });
  autoPopStatusEl.classList.remove("hidden");
  // Short confirmations (like "Saved") clear themselves; the long Auto-Populate explanation stays until closed.
  clearTimeout(autoPopStatusTimer);
  if (lines.length <= 3) autoPopStatusTimer = setTimeout(hideAutoPopStatus, 7000);
}

document.getElementById("autopop-status-close").addEventListener("click", hideAutoPopStatus);

document.getElementById("auto-populate-btn").addEventListener("click", () => {
  const plan = currentPlan();
  if (!plan) return;

  // Running it again (e.g. after Clear Week) steers away from the last suggestion for the same boxes.
  const roll = (autoRollCounts.get(plan.weekStart) || 0) + 1;
  autoRollCounts.set(plan.weekStart, roll);

  const result = PlannerEngine.planWeek({
    meals: plannerMeals(),
    plans: state.plans,
    plan,
    slots: SLOTS,
    isEligible: (m, slotKey) => mealFitsSlot(m, slotKey) && mealPassesFilters(m, plan.weekStart),
    // Usual parents breakfast/lunch ignore the "recently used" filter (they repeat by design) but not tag filters.
    routine: state.routine,
    useRoutine: state.useRoutine,
    routineOk: mealPassesTagFilters,
    seed: `${plan.weekStart}#${roll}`,
    avoid: autoLastPicks.get(plan.weekStart) || {},
  });
  const picks = {};
  result.assignments.forEach((a) => (picks[a.key] = a.mealId));
  autoLastPicks.set(plan.weekStart, picks);

  const usedIds = new Set();
  result.assignments.forEach((a) => {
    plan.cells[a.key] = { mealId: a.mealId, text: a.text, why: a.reasons };
    usedIds.add(a.mealId);
  });
  state.meals.forEach((m) => {
    if (!usedIds.has(m.id)) return;
    m.lastUsed = plan.weekStart;
    m.usageHistory = m.usageHistory || [];
    if (!m.usageHistory.includes(plan.weekStart)) m.usageHistory.push(plan.weekStart);
  });
  persistPlans();
  persistMeals();
  renderWeekTable();

  const filled = result.assignments.length;
  const skipped = result.skipped.length;
  if (!filled && !skipped) {
    showAutoPopStatus([{ text: "Every box in this week is already filled. Clear some boxes (or the whole week) and try again." }]);
    return;
  }
  const lines = [];
  if (filled) {
    lines.push({ text: `✨ Filled ${filled} empty box${filled === 1 ? "" : "es"}. Boxes you'd already filled (including Parents Dinner) were left alone.` });
    if (result.stats.routine) {
      const what = Object.entries(result.stats.routineMeals || {})
        .map(([k, meals]) => `Parents ${ROUTINE_LABELS[k] || k}: ${Object.entries(meals).map(([name, n]) => `${name} ×${n}`).join(", ")}`)
        .join(" · ");
      lines.push({ text: `📌 Repeating your usual → ${what}. Not what you want? Untick "Repeat my usual" under Parents' usual routine and run it again.`, small: true });
    }
    lines.push({
      text: "The other picks weigh how long it's been since you last had each meal, what your family eats most, which days it usually lands on, never the same meal over and over in one row, a balance of Indian and non-Indian breakfasts, and a balanced mix of effort, takeout and proteins. Look for the ✨ note under each meal to see why it was chosen.",
      small: true,
    });
  }
  if (skipped) {
    lines.push({
      text: `${skipped} box${skipped === 1 ? "" : "es"} had no eligible meal. Add meals for those slots, or loosen your filters.`,
    });
  }
  // Say plainly when a row has few meals ticked for it: that, not the planner, is what limits the variety.
  SLOTS.forEach((s) => {
    const c = (result.stats.slotChoices || {})[s.key];
    if (!c || c.own >= 7) return;
    const hiddenByFilters = state.meals.filter((m) => mealFitsSlot(m, s.key) && !mealPassesFilters(m, plan.weekStart)).length;
    const filterNote = hiddenByFilters ? ` (${hiddenByFilters} more ${hiddenByFilters === 1 ? "is" : "are"} hidden by your filters)` : "";
    let text;
    if (!c.own) {
      text = `${s.label} has no meals ticked for it${filterNote}, so it stayed empty.`;
    } else if (c.borrowedUsed) {
      text = `${s.label} only has ${c.own} meal${c.own === 1 ? "" : "s"} ticked for it${filterNote}, so ${c.borrowedUsed} box${c.borrowedUsed === 1 ? " uses" : "es use"} a meal from the matching ${/breakfast/i.test(s.label) ? "breakfast" : /lunch/i.test(s.label) ? "lunch" : "dinner"} slot instead of repeating.`;
    } else {
      text = `${s.label} only has ${c.own} meal${c.own === 1 ? "" : "s"} ticked for it${filterNote}, so it repeats.`;
    }
    lines.push({ text: `${text} Tick ${s.label} on more meals (Add New Meal → edit a meal) for more variety.` });
  });
  if (filled && result.stats.historyCells < 20) {
    lines.push({ text: "Tip: suggestions get smarter as you save more weeks of your own meals.", small: true });
  }
  lines.push({ text: "Calculated right here in your browser: free, private, and no AI.", small: true });
  showAutoPopStatus(lines);
});

/* ---------------------- Parents' usual routine ---------------------- */

const ROUTINE_LABELS = { "parents-breakfast": "Breakfast", "parents-lunch": "Lunch" };
const routineSummaryEl = document.getElementById("routine-summary");
const routineForgetBtn = document.getElementById("routine-forget-btn");

function renderRoutinePanel() {
  const saved = Object.keys(ROUTINE_LABELS).filter((k) => state.routine[k] && state.routine[k].some(Boolean));
  routineSummaryEl.innerHTML = "";
  if (!saved.length) {
    const p = document.createElement("p");
    p.className = "routine-none";
    p.textContent = "No saved routine yet: Auto-Populate uses what you usually have on each weekday in your saved weeks.";
    routineSummaryEl.appendChild(p);
  }
  saved.forEach((k) => {
    const p = document.createElement("p");
    const label = document.createElement("strong");
    label.textContent = ROUTINE_LABELS[k] + ": ";
    const days = state.routine[k]
      .map((entry, d) => (entry ? `${DOW_NAMES[d].slice(0, 3)} ${entry.text}` : null))
      .filter(Boolean)
      .join(" · ");
    p.appendChild(label);
    p.appendChild(document.createTextNode(days));
    routineSummaryEl.appendChild(p);
  });
  routineForgetBtn.classList.toggle("hidden", !saved.length);
  routineUseEl.checked = state.useRoutine !== false;
  routineOffNoteEl.classList.toggle("hidden", state.useRoutine !== false);
}

const routineUseEl = document.getElementById("routine-use");
const routineOffNoteEl = document.getElementById("routine-off-note");
routineUseEl.addEventListener("change", () => {
  state.useRoutine = routineUseEl.checked;
  saveJSON(STORAGE_KEYS.useRoutine, state.useRoutine);
  renderRoutinePanel();
});

document.getElementById("routine-save-btn").addEventListener("click", () => {
  const plan = currentPlan();
  if (!plan) return;
  const dates = weekDates(plan);
  const next = {};
  Object.keys(ROUTINE_LABELS).forEach((k) => {
    const entries = dates.map((d) => {
      const c = plan.cells[cellKey(toISODate(d), k)];
      const text = c && c.text ? c.text.trim() : "";
      return text ? { mealId: c.mealId || null, text } : null;
    });
    if (entries.some(Boolean)) next[k] = entries;
  });
  if (!Object.keys(next).length) {
    showAutoPopStatus([{ text: "Fill in some Parents Breakfast or Parents Lunch boxes first, then save them as your routine." }]);
    return;
  }
  state.routine = { ...state.routine, ...next };
  persistRoutine();
  renderRoutinePanel();
  showAutoPopStatus([{ text: "📌 Saved. From now on Auto-Populate repeats these Parents Breakfast/Lunch boxes for each weekday." }]);
});

routineForgetBtn.addEventListener("click", () => {
  state.routine = {};
  persistRoutine();
  renderRoutinePanel();
  showAutoPopStatus([{ text: "Saved routine cleared. Auto-Populate goes back to learning it from your saved weeks." }]);
});

/* =====================================================================
   PDF / Print
   ===================================================================== */

const printAreaEl = document.getElementById("print-area");

function buildPrintTable(plan) {
  const dates = weekDates(plan);
  const special = (d) => specialLabel(plan, toISODate(d));
  let html = `<div class="print-sheet"><h1>${escapeHTML(plan.title)}</h1><table class="print-table"><thead><tr><th class="corner">Meal</th>`;
  dates.forEach((d) => {
    const label = special(d);
    html += `<th class="${label !== null ? "special" : ""}"><span class="pd-name">${DOW_NAMES[d.getDay()]}</span><span class="pd-date">${formatPretty(d)}</span>`;
    if (label !== null) html += `<span class="pd-tag">★ ${escapeHTML(label || "Special day")}</span>`;
    html += "</th>";
  });
  html += "</tr></thead><tbody>";

  SLOTS.forEach((slot) => {
    html += `<tr><th>${escapeHTML(slot.label)}</th>`;
    dates.forEach((d) => {
      const dateISO = toISODate(d);
      const cellData = plan.cells[cellKey(dateISO, slot.key)] || { text: "" };
      html += `<td class="${special(d) !== null ? "special" : ""}"><span>${escapeHTML(cellData.text || "")}</span></td>`;
    });
    html += "</tr>";
  });

  html += "</tbody></table></div>";
  return html;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function saveAndPrintPlan(plan) {
  printAreaEl.innerHTML = buildPrintTable(plan);
  recordSavedWeek(plan);
  backupToFile({ onlyIfLinked: true });
  window.print();
}

document.getElementById("save-pdf-btn").addEventListener("click", () => {
  const plan = currentPlan();
  if (!plan) return;
  saveAndPrintPlan(plan);
});

/* =====================================================================
   ALL PDFS VIEW
   ===================================================================== */

const pdfHistoryListEl = document.getElementById("pdf-history-list");

const pdfPreviewEl = document.getElementById("pdf-preview");
const pdfPreviewStageEl = document.getElementById("pdf-preview-stage");
const pdfPreviewSheetEl = document.getElementById("pdf-preview-sheet");
let pdfPreviewWeekKey = null;

// Shows a saved week exactly as it prints, scaled to fit the window.
function openPdfPreview(weekKey) {
  const plan = state.plans[weekKey];
  if (!plan) {
    alert("That week's data no longer exists.");
    return;
  }
  pdfPreviewWeekKey = weekKey;
  document.getElementById("pdf-preview-title").textContent = plan.title;
  pdfPreviewSheetEl.innerHTML = buildPrintTable(plan);
  pdfPreviewEl.classList.remove("hidden");
  fitPdfPreview();
}

function fitPdfPreview() {
  if (pdfPreviewEl.classList.contains("hidden")) return;
  const sheet = pdfPreviewSheetEl.querySelector(".print-sheet");
  if (!sheet) return;
  const w = sheet.offsetWidth;
  const h = sheet.offsetHeight;
  const scale = Math.min(1, (pdfPreviewStageEl.clientWidth - 32) / w, (pdfPreviewStageEl.clientHeight - 32) / h);
  pdfPreviewSheetEl.style.width = `${w * scale}px`;
  pdfPreviewSheetEl.style.height = `${h * scale}px`;
  sheet.style.transformOrigin = "top left";
  sheet.style.transform = `scale(${scale})`;
}

function closePdfPreview() {
  pdfPreviewEl.classList.add("hidden");
  pdfPreviewSheetEl.innerHTML = "";
  pdfPreviewWeekKey = null;
}

function openWeekInPlanner(weekKey) {
  if (!state.plans[weekKey]) {
    alert("That week's data no longer exists.");
    return;
  }
  closePdfPreview();
  state.currentWeekKey = weekKey;
  persistCurrentWeekKey();
  showView("plan");
}

document.getElementById("pdf-preview-close").addEventListener("click", closePdfPreview);
document.getElementById("pdf-preview-open").addEventListener("click", () => pdfPreviewWeekKey && openWeekInPlanner(pdfPreviewWeekKey));
document.getElementById("pdf-preview-print").addEventListener("click", () => {
  const plan = state.plans[pdfPreviewWeekKey];
  if (plan) saveAndPrintPlan(plan);
});
pdfPreviewEl.addEventListener("click", (e) => {
  if (e.target === pdfPreviewEl) closePdfPreview();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !pdfPreviewEl.classList.contains("hidden")) closePdfPreview();
});
window.addEventListener("resize", fitPdfPreview);

function renderPdfHistoryView() {
  renderPlannerFilePanel();
  pdfHistoryListEl.innerHTML = "";

  if (state.pdfHistory.length === 0) {
    pdfHistoryListEl.innerHTML = `<div class="empty-state">📭 Nothing here yet! On the Meal Planning tab, fill in a week and press Ctrl+S (or click "Save &amp; Print PDF") and it shows up here.</div>`;
    return;
  }

  state.pdfHistory.forEach((record) => {
    const card = document.createElement("div");
    card.className = "pdf-card";

    const info = document.createElement("div");
    info.className = "pdf-card-info";
    const plan = state.plans[record.weekKey];
    const filled = plan ? Object.values(plan.cells || {}).filter((c) => c && String(c.text || "").trim()).length : 0;
    info.innerHTML = `<strong>${escapeHTML(record.title)}</strong><br><span class="saved-at">Saved ${new Date(record.savedAt).toLocaleString()} · ${filled} meal${filled === 1 ? "" : "s"} planned</span>`;

    const actions = document.createElement("div");

    const viewBtn = document.createElement("button");
    viewBtn.className = "btn btn-primary btn-small";
    viewBtn.textContent = "👁 View";
    viewBtn.addEventListener("click", () => openPdfPreview(record.weekKey));

    const printBtn = document.createElement("button");
    printBtn.className = "btn btn-secondary btn-small";
    printBtn.textContent = "🖨️ Print / Save as PDF";
    printBtn.addEventListener("click", () => {
      if (!plan) {
        alert("That week's data no longer exists.");
        return;
      }
      saveAndPrintPlan(plan);
    });

    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-secondary btn-small";
    openBtn.textContent = "Open in Planner";
    openBtn.addEventListener("click", () => openWeekInPlanner(record.weekKey));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger btn-small";
    deleteBtn.textContent = "Remove";
    deleteBtn.addEventListener("click", () => {
      if (!confirm("Remove this from your PDF history? (Doesn't delete the week's meal plan.)")) return;
      state.pdfHistory = state.pdfHistory.filter((r) => r.weekKey !== record.weekKey);
      persistPdfHistory();
      renderPdfHistoryView();
    });

    actions.appendChild(viewBtn);
    actions.appendChild(printBtn);
    actions.appendChild(openBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(info);
    card.appendChild(actions);
    pdfHistoryListEl.appendChild(card);
  });
}

/* =====================================================================
   PLANNER FILE: a copy on this computer that survives browsers clearing site data
   ===================================================================== */

const FILE_KEYS = Object.values(STORAGE_KEYS);
const FILE_PICKER_TYPES = [{ description: "Meal planner data", accept: { "application/json": [".json"] } }];
const fileApiOk = typeof window.showSaveFilePicker === "function" && typeof window.showOpenFilePicker === "function";
const plannerFile = { handle: null, name: "", at: null, declined: false };

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("mpw_files", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function rememberHandle(handle) {
  try {
    const db = await openHandleDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "planner");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    /* remembering the file is a convenience; saving still works without it */
  }
}

async function recallHandle() {
  try {
    const db = await openHandleDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction("handles").objectStore("handles").get("planner");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
}

async function writePlannerFile(handle) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(Backup.snapshot(localStorage, FILE_KEYS), null, 1));
  await writable.close();
  plannerFile.handle = handle;
  plannerFile.name = handle.name;
  plannerFile.at = new Date();
}

// Writes the planner file. The first time it asks where to keep it; after that it just updates it.
// status: saved | cancelled | unsupported | error | skipped
async function backupToFile({ onlyIfLinked = false } = {}) {
  if (!fileApiOk) return { status: "unsupported" };
  try {
    let handle = plannerFile.handle || (await recallHandle());
    if (handle) {
      let perm = await handle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted" && !onlyIfLinked) perm = await handle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") handle = null;
    }
    if (!handle) {
      if (onlyIfLinked || plannerFile.declined) return { status: "skipped" };
      handle = await window.showSaveFilePicker({ suggestedName: "meal-planner.json", types: FILE_PICKER_TYPES });
      await rememberHandle(handle);
    }
    await writePlannerFile(handle);
    renderPlannerFilePanel();
    return { status: "saved", name: handle.name };
  } catch (e) {
    if (e && e.name === "AbortError") {
      plannerFile.declined = true; // do not ask again on every Ctrl+S this visit
      return { status: "cancelled" };
    }
    console.warn("Planner file", e);
    return { status: "error" };
  }
}

// Replaces what this browser holds with the contents of a planner file, then reloads to show it.
function restoreFromText(text) {
  const obj = Backup.parse(text);
  const sum = Backup.summarize(obj);
  const when = sum.savedAt ? new Date(sum.savedAt).toLocaleString() : "an unknown time";
  const ok = confirm(
    `Bring back the planner saved ${when}?\n\nIt has ${sum.weeks} planned week${sum.weeks === 1 ? "" : "s"} and ${sum.meals} meals. This replaces what is in this browser now.`
  );
  if (!ok) return false;
  Backup.restore(obj, localStorage, FILE_KEYS);
  location.reload();
  return true;
}

async function restoreFromPickedFile() {
  try {
    const [handle] = await window.showOpenFilePicker({ types: FILE_PICKER_TYPES, multiple: false });
    if (!handle) return;
    const text = await (await handle.getFile()).text();
    if (restoreFromText(text)) await rememberHandle(handle);
  } catch (e) {
    if (e && e.name === "AbortError") return;
    alert(e && e.message ? e.message : "That file couldn't be opened.");
  }
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(Backup.snapshot(localStorage, FILE_KEYS), null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `meal-planner-${toISODate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// If a planner file was chosen on an earlier visit, remember that it is linked.
if (fileApiOk) {
  recallHandle().then((h) => {
    if (!h || plannerFile.handle) return;
    plannerFile.handle = h;
    plannerFile.name = h.name;
    renderPlannerFilePanel();
  });
}

const plannerFileStatusEl = document.getElementById("planner-file-status");
const restoreInputEl = document.getElementById("restore-input");

function renderPlannerFilePanel() {
  if (!plannerFileStatusEl) return;
  if (!fileApiOk) {
    plannerFileStatusEl.textContent = "This browser can't keep a file for you automatically. Download a backup now and then, and restore it here if your weeks ever go missing.";
  } else if (plannerFile.at) {
    plannerFileStatusEl.textContent = `✓ ${plannerFile.name} was updated at ${plannerFile.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Ctrl+S keeps it up to date.`;
  } else if (plannerFile.handle) {
    plannerFileStatusEl.textContent = `Linked to ${plannerFile.name}. Ctrl+S in the planner updates it.`;
  } else {
    plannerFileStatusEl.textContent = "No planner file yet. Press Ctrl+S in the planner (or the button below) and choose where to keep it, for example your Documents folder.";
  }
  document.getElementById("planner-file-save").classList.toggle("hidden", !fileApiOk);
  document.getElementById("planner-file-open").classList.toggle("hidden", !fileApiOk);
}

document.getElementById("planner-file-save").addEventListener("click", async () => {
  plannerFile.declined = false;
  const r = await backupToFile();
  if (r.status === "error") alert("Couldn't write the planner file.");
});
document.getElementById("planner-file-open").addEventListener("click", restoreFromPickedFile);
document.getElementById("planner-file-download").addEventListener("click", downloadBackup);
document.getElementById("planner-file-restore").addEventListener("click", () => restoreInputEl.click());
restoreInputEl.addEventListener("change", async () => {
  const file = restoreInputEl.files && restoreInputEl.files[0];
  restoreInputEl.value = "";
  if (!file) return;
  try {
    restoreFromText(await file.text());
  } catch (e) {
    alert(e && e.message ? e.message : "That file couldn't be opened.");
  }
});

// Shown when a visit starts with nothing saved: either a first visit, or a browser that cleared its data.
function showRestoreBanner() {
  const bar = document.createElement("div");
  bar.className = "restore-banner";
  bar.setAttribute("role", "status");
  const text = document.createElement("span");
  text.textContent = "Welcome! If you saved your planner before and it isn't showing, bring it back from your planner file.";
  const actions = document.createElement("span");
  actions.className = "restore-banner-actions";
  const open = document.createElement("button");
  open.type = "button";
  open.className = "btn btn-primary btn-small";
  open.textContent = fileApiOk ? "Open my planner file…" : "Restore from a file…";
  open.addEventListener("click", () => (fileApiOk ? restoreFromPickedFile() : restoreInputEl.click()));
  const later = document.createElement("button");
  later.type = "button";
  later.className = "btn btn-secondary btn-small";
  later.textContent = "Not now";
  later.addEventListener("click", () => bar.remove());
  actions.append(open, later);
  bar.append(text, actions);
  document.body.appendChild(bar);
}

/* =====================================================================
   ADD NEW MEAL VIEW
   ===================================================================== */

const mealNameInput = document.getElementById("meal-name");
const mealSlotsCheckboxesEl = document.getElementById("meal-slots-checkboxes");
const mealTagsCheckboxesEl = document.getElementById("meal-tags-checkboxes");
const newTagInput = document.getElementById("new-tag-input");
const mealLibraryListEl = document.getElementById("meal-library-list");
const mealFormEl = document.getElementById("add-meal-form");
const mealFormHeadingEl = document.getElementById("meal-form-heading");
const mealFormHeadingNameEl = document.getElementById("meal-form-heading-name");
const mealFormSubmitBtn = document.getElementById("meal-form-submit-btn");
const mealFormCancelBtn = document.getElementById("meal-form-cancel-btn");

let editingMealId = null;

function renderAddMealView() {
  // Leaving and coming back to this tab cancels any in-progress edit,
  // since the checkbox DOM gets rebuilt from scratch below anyway.
  if (editingMealId) stopEditingMeal();
  renderSlotCheckboxes();
  renderTagCheckboxes();
  renderMealLibrary();
  closeTagReview();
  tagReviewDoneEl.classList.add("hidden");
}

function startEditingMeal(meal) {
  editingMealId = meal.id;

  mealNameInput.value = meal.name;
  mealSlotsCheckboxesEl.querySelectorAll("input").forEach((cb) => {
    cb.checked = (meal.slots || []).includes(cb.value);
  });
  mealTagsCheckboxesEl.querySelectorAll("input").forEach((cb) => {
    cb.checked = (meal.tags || []).includes(cb.value);
  });
  renderTagSuggestions();

  mealFormHeadingNameEl.textContent = meal.name;
  mealFormHeadingEl.classList.remove("hidden");
  mealFormSubmitBtn.textContent = "Save Changes";
  mealFormCancelBtn.classList.remove("hidden");

  mealFormEl.scrollIntoView({ behavior: "smooth", block: "start" });
  mealNameInput.focus();
}

function stopEditingMeal() {
  editingMealId = null;
  mealFormEl.reset();
  mealFormHeadingEl.classList.add("hidden");
  mealFormSubmitBtn.textContent = "Add Meal";
  mealFormCancelBtn.classList.add("hidden");
}

mealFormCancelBtn.addEventListener("click", stopEditingMeal);
mealFormEl.addEventListener("reset", () => setTimeout(renderTagSuggestions, 0));

function renderSlotCheckboxes() {
  mealSlotsCheckboxesEl.innerHTML = "";
  SLOTS.forEach((slot) => {
    const label = document.createElement("label");
    label.className = "checkbox-chip";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = slot.key;
    cb.name = "slot";
    label.appendChild(cb);
    const span = document.createElement("span");
    span.textContent = slot.label;
    label.appendChild(span);
    mealSlotsCheckboxesEl.appendChild(label);
  });
}

function renderTagCheckboxes() {
  // Re-rendering (e.g. after adding a tag) must not lose what's already ticked.
  const ticked = new Set(Array.from(mealTagsCheckboxesEl.querySelectorAll("input:checked")).map((cb) => cb.value));
  mealTagsCheckboxesEl.innerHTML = "";
  tagGroups().forEach((group) => {
    const wrap = document.createElement("div");
    wrap.className = "tag-group";
    const title = document.createElement("div");
    title.className = "tag-group-title";
    title.textContent = group.name;
    const row = document.createElement("div");
    row.className = "checkbox-grid";
    group.tags.forEach((tag) => {
      const label = document.createElement("label");
      label.className = "checkbox-chip";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = tag;
      cb.name = "tag";
      cb.checked = ticked.has(tag);
      label.appendChild(cb);
      const span = document.createElement("span");
      span.textContent = tag;
      label.appendChild(span);

      if (!DEFAULT_TAGS.includes(tag)) {
        const removeBtn = document.createElement("span");
        removeBtn.textContent = " ×";
        removeBtn.title = `Remove the tag "${tag}"`;
        removeBtn.style.cursor = "pointer";
        removeBtn.style.fontWeight = "700";
        removeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeCustomTag(tag);
        });
        label.appendChild(removeBtn);
      }
      row.appendChild(label);
    });
    wrap.appendChild(title);
    wrap.appendChild(row);
    mealTagsCheckboxesEl.appendChild(wrap);
  });
  renderTagSuggestions();
}

// Offers tags that the meal's name makes obvious (cuisine, main protein, takeout) as one-click chips.
const tagSuggestEl = document.getElementById("tag-suggest");

// "Researched" note for a dish: what was found, with links to the sources.
function buildResearchNote(research) {
  const box = document.createElement("div");
  box.className = "research-note";
  box.appendChild(document.createTextNode("📚 Researched: " + research.note + (research.sources.length ? " Sources: " : "")));
  research.sources.forEach((s, i) => {
    if (i) box.appendChild(document.createTextNode(", "));
    const a = document.createElement("a");
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = s.label;
    box.appendChild(a);
  });
  return box;
}

function renderTagSuggestions() {
  const ticked = new Set(Array.from(mealTagsCheckboxesEl.querySelectorAll("input:checked")).map((cb) => cb.value));
  const name = mealNameInput.value;
  const researched = DishKnowledge.lookup(name);
  const ideas = DishKnowledge.applyToTags(name, TagTools.obviousTags(name)).filter((t) => !ticked.has(t));
  tagSuggestEl.innerHTML = "";
  tagSuggestEl.classList.toggle("hidden", ideas.length === 0 && !researched);
  if (!ideas.length && !researched) return;
  if (researched) tagSuggestEl.appendChild(buildResearchNote(researched));
  if (!ideas.length) return;
  const label = document.createElement("span");
  label.className = "tag-suggest-label";
  label.textContent = researched ? "Suggested from the research:" : "Suggested from the name:";
  tagSuggestEl.appendChild(label);
  ideas.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-suggest-chip";
    btn.textContent = "+ " + tag;
    btn.addEventListener("click", () => {
      const cb = Array.from(mealTagsCheckboxesEl.querySelectorAll("input")).find((c) => c.value === tag);
      if (cb) cb.checked = true;
      renderTagSuggestions();
    });
    tagSuggestEl.appendChild(btn);
  });
}

mealNameInput.addEventListener("input", renderTagSuggestions);
mealTagsCheckboxesEl.addEventListener("change", renderTagSuggestions);

/* ---------------------- Guided tag review ---------------------- */

const tagReviewBannerEl = document.getElementById("tag-review-banner");
const tagReviewCountEl = document.getElementById("tag-review-count");
const tagReviewEl = document.getElementById("tag-review");
const tagReviewDoneEl = document.getElementById("tag-review-done");
const tagReviewNameEl = document.getElementById("tag-review-name");
const tagReviewProgressEl = document.getElementById("tag-review-progress");
const tagReviewAutoEl = document.getElementById("tag-review-auto");
const tagReviewResearchEl = document.getElementById("tag-review-research");
const tagReviewTagsEl = document.getElementById("tag-review-tags");
const reviewSkipped = new Set();
let reviewingId = null;

const pendingReviewCount = () => state.meals.filter((m) => m.tagsReviewed === false).length;

function renderTagReviewBanner() {
  const n = pendingReviewCount();
  tagReviewBannerEl.classList.toggle("hidden", n === 0 || !tagReviewEl.classList.contains("hidden"));
  tagReviewCountEl.textContent = `🏷️ ${n} meal${n === 1 ? " needs" : "s need"} their tags checked`;
}

function closeTagReview() {
  tagReviewEl.classList.add("hidden");
  reviewingId = null;
  renderTagReviewBanner();
}

function showReviewMeal() {
  const meal = state.meals.find((m) => m.tagsReviewed === false && !reviewSkipped.has(m.id));
  if (!meal) {
    const allDone = pendingReviewCount() === 0;
    closeTagReview();
    renderMealLibrary();
    tagReviewDoneEl.classList.toggle("hidden", !allDone);
    return;
  }
  reviewingId = meal.id;
  tagReviewNameEl.textContent = meal.name;
  tagReviewProgressEl.textContent = `${pendingReviewCount()} left to check`;

  const researched = DishKnowledge.lookup(meal.name);
  tagReviewResearchEl.innerHTML = "";
  tagReviewResearchEl.classList.toggle("hidden", !researched);
  if (researched) tagReviewResearchEl.appendChild(buildResearchNote(researched));

  const shown = DishKnowledge.applyToTags(meal.name, meal.tags || []);
  const fromName = [...new Set([...TagTools.obviousTags(meal.name), ...(researched ? researched.tags : [])])].filter((t) => shown.includes(t));
  tagReviewAutoEl.textContent = fromName.length ? "Already filled in from the " + (researched ? "research and name" : "name") + ": " + fromName.join(", ") + ". Untick any that are wrong for your family." : "";
  tagReviewAutoEl.classList.toggle("hidden", !fromName.length);

  tagReviewTagsEl.innerHTML = "";
  tagGroups().forEach((group) => {
    const wrap = document.createElement("div");
    wrap.className = "tag-group";
    const title = document.createElement("div");
    title.className = "tag-group-title";
    title.textContent = group.name;
    const row = document.createElement("div");
    row.className = "checkbox-grid";
    group.tags.forEach((tag) => {
      const label = document.createElement("label");
      label.className = "checkbox-chip";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = tag;
      cb.checked = shown.includes(tag);
      label.appendChild(cb);
      const span = document.createElement("span");
      span.textContent = tag;
      label.appendChild(span);
      row.appendChild(label);
    });
    wrap.appendChild(title);
    wrap.appendChild(row);
    tagReviewTagsEl.appendChild(wrap);
  });
  tagReviewEl.classList.remove("hidden");
  renderTagReviewBanner();
}

document.getElementById("tag-review-start").addEventListener("click", () => {
  reviewSkipped.clear();
  tagReviewDoneEl.classList.add("hidden");
  showReviewMeal();
  tagReviewEl.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("tag-review-save").addEventListener("click", () => {
  const meal = state.meals.find((m) => m.id === reviewingId);
  if (!meal) return;
  meal.tags = Array.from(tagReviewTagsEl.querySelectorAll("input:checked")).map((cb) => cb.value);
  meal.tagsReviewed = true;
  persistMeals();
  showReviewMeal();
});

document.getElementById("tag-review-skip").addEventListener("click", () => {
  if (reviewingId) reviewSkipped.add(reviewingId);
  showReviewMeal();
});

document.getElementById("tag-review-stop").addEventListener("click", () => {
  closeTagReview();
  renderMealLibrary();
});

function removeCustomTag(tag) {
  if (!confirm(`Remove the custom tag "${tag}"? It will be removed from any meals that have it.`)) return;
  state.customTags = state.customTags.filter((t) => t !== tag);
  persistCustomTags();
  state.meals.forEach((m) => {
    if (m.tags) m.tags = m.tags.filter((t) => t !== tag);
  });
  persistMeals();
  if (state.filters.excludedTags.includes(tag)) {
    state.filters.excludedTags = state.filters.excludedTags.filter((t) => t !== tag);
    persistFilters();
  }
  renderTagCheckboxes();
  renderMealLibrary();
}

document.getElementById("add-tag-btn").addEventListener("click", () => {
  const val = newTagInput.value.trim();
  if (!val) return;
  if (!allTags().includes(val)) {
    state.customTags.push(val);
    persistCustomTags();
  }
  newTagInput.value = "";
  renderTagCheckboxes();
});

newTagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("add-tag-btn").click();
  }
});

mealFormEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = mealNameInput.value.trim();
  if (!name) return;

  const slots = Array.from(mealSlotsCheckboxesEl.querySelectorAll("input:checked")).map((cb) => cb.value);
  const tags = Array.from(mealTagsCheckboxesEl.querySelectorAll("input:checked")).map((cb) => cb.value);

  if (editingMealId) {
    const meal = state.meals.find((m) => m.id === editingMealId);
    if (meal) {
      meal.name = name;
      meal.slots = slots;
      meal.tags = tags;
      meal.tagsReviewed = true; // you just set these yourself
      persistMeals();
    }
    stopEditingMeal();
  } else {
    state.meals.push({
      id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      slots,
      tags,
      tagsReviewed: true,
      lastUsed: null,
      usageHistory: [],
    });
    persistMeals();
    mealFormEl.reset();
  }

  renderMealLibrary();
  renderTagReviewBanner();
});

function renderMealLibrary() {
  mealLibraryListEl.innerHTML = "";

  if (state.meals.length === 0) {
    mealLibraryListEl.innerHTML = `<div class="empty-state">🍽️ No meals yet — add your first one above to get started!</div>`;
    return;
  }

  state.meals
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((meal) => {
      const card = document.createElement("div");
      card.className = "meal-card";

      const info = document.createElement("div");
      info.className = "meal-card-info";

      const slotLabels = (meal.slots || []).map((s) => SLOTS.find((sl) => sl.key === s)?.label).filter(Boolean);
      const metaBits = [];
      if (slotLabels.length) metaBits.push(slotLabels.map((s) => `<span class="tag">${escapeHTML(s)}</span>`).join(""));
      else metaBits.push(`<span class="tag">Any slot</span>`);
      if (meal.tags && meal.tags.length) metaBits.push(meal.tags.map((t) => `<span class="tag">${escapeHTML(t)}</span>`).join(""));
      if (meal.tagsReviewed === false) metaBits.push(`<span class="tag tag-unchecked">🏷️ tags not checked yet</span>`);

      const usedInfo = meal.lastUsed
        ? `Last used week of ${formatPretty(fromISODate(meal.lastUsed))} · used ${meal.usageHistory?.length || 0}x`
        : "Never used yet";

      info.innerHTML = `<strong>${escapeHTML(meal.name)}</strong><div class="meal-card-meta">${metaBits.join(" ")}</div><div class="meal-card-meta">${escapeHTML(usedInfo)}</div>`;

      const actions = document.createElement("div");
      actions.className = "meal-card-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-secondary btn-small";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => startEditingMeal(meal));

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger btn-small";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        if (!confirm(`Delete "${meal.name}" from your meal library?`)) return;
        if (editingMealId === meal.id) stopEditingMeal();
        state.meals = state.meals.filter((m) => m.id !== meal.id);
        persistMeals();
        renderMealLibrary();
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      card.appendChild(info);
      card.appendChild(actions);
      mealLibraryListEl.appendChild(card);
    });
}

document.getElementById("clear-meals-btn").addEventListener("click", () => {
  if (state.meals.length === 0) return;
  if (!confirm("Delete every meal in your library? This can't be undone.")) return;
  state.meals = [];
  persistMeals();
  renderMealLibrary();
});

/* =====================================================================
   Init
   ===================================================================== */

removePhantomMeals();
const tagsBeforeMigrations = Object.fromEntries(state.meals.map((m) => [m.id, (m.tags || []).slice()]));
migrateTagsV2();
migrateTagsV3(tagsBeforeMigrations);
migrateTagsV4();
importSlideMeals();
importSlideMealsV2();

// A visit with no saved visit and no chosen week means nothing was kept: new here, or the browser cleared its data.
const cameBackToSavedData = loadJSON(STORAGE_KEYS.visited, false) || !!state.currentWeekKey;
saveJSON(STORAGE_KEYS.visited, true);
if (!cameBackToSavedData) showRestoreBanner();

if (!storageWorks()) {
  saveStatus.ok = false;
  const warn = document.createElement("div");
  warn.setAttribute("role", "alert");
  warn.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:10px 16px;background:#f8d7cf;color:#6e2a1b;text-align:center;font-weight:700";
  warn.textContent = "This browser is not letting the site save anything, so what you plan will be gone when you close this tab. Open the site in a normal (not private) window and allow site data.";
  document.body.appendChild(warn);
}

showView("plan");

// If the browser kept an older copy of the planner, say so instead of quietly planning badly.
if (PlannerEngine.BUILD !== "2026-10-24a") {
  const warn = document.createElement("div");
  warn.setAttribute("role", "alert");
  warn.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 16px;background:#fff3cd;color:#5a3e1b;text-align:center;font-weight:700";
  warn.textContent = "Your browser is showing an old copy of this site. Press Ctrl+F5 (or Cmd+Shift+R on a Mac) to load the latest.";
  document.body.appendChild(warn);
}
