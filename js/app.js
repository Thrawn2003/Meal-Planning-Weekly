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

const DEFAULT_TAGS = [
  // Effort / time
  "Quick", "Low Effort", "High Effort", "Meal-Prep Friendly", "One-Pot",
  // Nutrition / diet
  "Healthy", "Carby", "Low-Carb", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free",
  // Main protein
  "Chicken", "Beef", "Pork", "Seafood", "Meatless",
  // Practicality
  "Leftover-Friendly", "Freezer-Friendly", "Kid-Favorite", "Picky-Eater-Safe",
  // Cost / occasion
  "Budget-Friendly", "Takeout / Restaurant Night", "Weekend / Special",
  // Cuisine
  "South Asian", "American", "Italian", "Mexican", "Chinese", "Other Cuisine",
  // Other
  "Spicy", "Seasonal", "New Recipe",
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
};

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

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Failed to save", key, e);
  }
}

/* ---------------------- App state ---------------------- */

const state = {
  meals: loadJSON(STORAGE_KEYS.meals, []),
  plans: loadJSON(STORAGE_KEYS.plans, {}), // keyed by weekStart ISO date
  pdfHistory: loadJSON(STORAGE_KEYS.pdfHistory, []), // [{weekKey, title, savedAt}]
  filters: loadJSON(STORAGE_KEYS.filters, { excludedTags: [], recencyWeeks: 0 }),
  customTags: loadJSON(STORAGE_KEYS.customTags, []),
  calendarYear: new Date().getFullYear(),
  calendarFirstClick: null, // ISO date string
  currentWeekKey: loadJSON(STORAGE_KEYS.currentWeekKey, null),
};

function persistMeals() { saveJSON(STORAGE_KEYS.meals, state.meals); }
function persistPlans() { saveJSON(STORAGE_KEYS.plans, state.plans); }
function persistPdfHistory() { saveJSON(STORAGE_KEYS.pdfHistory, state.pdfHistory); }
function persistFilters() { saveJSON(STORAGE_KEYS.filters, state.filters); }
function persistCustomTags() { saveJSON(STORAGE_KEYS.customTags, state.customTags); }
function persistCurrentWeekKey() { saveJSON(STORAGE_KEYS.currentWeekKey, state.currentWeekKey); }

function allTags() {
  const fromMeals = new Set();
  state.meals.forEach((m) => (m.tags || []).forEach((t) => fromMeals.add(t)));
  const merged = new Set([...DEFAULT_TAGS, ...state.customTags, ...fromMeals]);
  return Array.from(merged).sort();
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
    calSelectionStatusEl.textContent = "Click a date to start choosing your week.";
  } else {
    calSelectionStatusEl.textContent = `Start date selected: ${formatPretty(fromISODate(state.calendarFirstClick))}. Now click an end date (can be in the same week, or click the same date again to just use that week).`;
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
  allTags().forEach((tag) => {
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
    tagFilterListEl.appendChild(label);
  });

  recencyFilterEl.value = String(state.filters.recencyWeeks || 0);
}

recencyFilterEl.addEventListener("change", () => {
  state.filters.recencyWeeks = Number(recencyFilterEl.value);
  persistFilters();
  renderWeekTable();
});

function mealPassesFilters(meal, weekStartISO) {
  const tags = meal.tags || [];
  if (tags.some((t) => state.filters.excludedTags.includes(t))) return false;

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

function renderWeekTable() {
  const plan = currentPlan();
  if (!plan) return;

  renderFilters();

  weekTitleEl.textContent = plan.title;

  const dates = weekDates(plan);

  // Header row
  weekTableHeadRowEl.innerHTML = "<th>Meal</th>";
  dates.forEach((d) => {
    const th = document.createElement("th");
    const nameSpan = document.createElement("span");
    nameSpan.className = "day-name";
    nameSpan.textContent = DOW_NAMES[d.getDay()];
    const dateSpan = document.createElement("span");
    dateSpan.className = "day-date";
    dateSpan.textContent = formatPretty(d);
    th.appendChild(nameSpan);
    th.appendChild(dateSpan);
    weekTableHeadRowEl.appendChild(th);
  });

  // Body rows
  weekTableBodyEl.innerHTML = "";
  SLOTS.forEach((slot) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = slot.label;
    tr.appendChild(th);

    dates.forEach((d) => {
      const dateISO = toISODate(d);
      const key = cellKey(dateISO, slot.key);
      const cellData = plan.cells[key] || { mealId: null, text: "" };

      const td = document.createElement("td");
      const wrap = document.createElement("div");
      wrap.className = "cell-editor";

      const select = document.createElement("select");
      const blankOption = document.createElement("option");
      blankOption.value = "";
      blankOption.textContent = "— choose a meal —";
      select.appendChild(blankOption);

      const candidates = state.meals.filter(
        (m) => mealFitsSlot(m, slot.key) && mealPassesFilters(m, plan.weekStart)
      );
      candidates.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        if (cellData.mealId === m.id) opt.selected = true;
        select.appendChild(opt);
      });

      // Keep currently selected meal visible even if filtered out now
      if (cellData.mealId && !candidates.some((m) => m.id === cellData.mealId)) {
        const stale = state.meals.find((m) => m.id === cellData.mealId);
        if (stale) {
          const opt = document.createElement("option");
          opt.value = stale.id;
          opt.textContent = `${stale.name} (filtered)`;
          opt.selected = true;
          select.appendChild(opt);
        }
      }

      const textarea = document.createElement("textarea");
      textarea.placeholder = "Type a meal, or pick one above";
      textarea.value = cellData.text || "";

      select.addEventListener("change", () => {
        const mealId = select.value || null;
        const meal = mealId ? state.meals.find((m) => m.id === mealId) : null;
        setCell(plan, key, { mealId, text: meal ? meal.name : "" });
        if (meal) markMealUsed(meal, plan.weekStart);
        textarea.value = meal ? meal.name : "";
      });

      textarea.addEventListener("input", () => {
        setCell(plan, key, { mealId: cellData.mealId, text: textarea.value });
      });
      textarea.addEventListener("blur", () => {
        // typing manually detaches from the specific meal record if it no longer matches
        const current = plan.cells[key];
        const linked = current.mealId ? state.meals.find((m) => m.id === current.mealId) : null;
        if (linked && linked.name !== current.text) {
          setCell(plan, key, { mealId: null, text: current.text });
        }
      });

      wrap.appendChild(select);
      wrap.appendChild(textarea);
      td.appendChild(wrap);
      tr.appendChild(td);
    });

    weekTableBodyEl.appendChild(tr);
  });
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

document.getElementById("auto-populate-btn").addEventListener("click", () => {
  const plan = currentPlan();
  if (!plan) return;

  const usedThisWeek = new Set();
  const dates = weekDates(plan);

  dates.forEach((d) => {
    const dateISO = toISODate(d);
    SLOTS.forEach((slot) => {
      const key = cellKey(dateISO, slot.key);
      const existing = plan.cells[key];
      if (existing && existing.text && existing.text.trim() !== "") return; // don't overwrite filled cells

      let candidates = state.meals.filter(
        (m) => mealFitsSlot(m, slot.key) && mealPassesFilters(m, plan.weekStart)
      );
      if (candidates.length === 0) return;

      let pool = candidates.filter((m) => !usedThisWeek.has(m.id));
      if (pool.length === 0) pool = candidates;

      pool.sort((a, b) => {
        if (!a.lastUsed && !b.lastUsed) return 0;
        if (!a.lastUsed) return -1;
        if (!b.lastUsed) return 1;
        return a.lastUsed.localeCompare(b.lastUsed);
      });

      const chosen = pool[0];
      setCell(plan, key, { mealId: chosen.id, text: chosen.name });
      markMealUsed(chosen, plan.weekStart);
      usedThisWeek.add(chosen.id);
    });
  });

  renderWeekTable();
});

/* =====================================================================
   PDF / Print
   ===================================================================== */

const printAreaEl = document.getElementById("print-area");

function buildPrintTable(plan) {
  const dates = weekDates(plan);
  let html = `<h1>${escapeHTML(plan.title)}</h1><table class="print-table"><thead><tr><th>Meal</th>`;
  dates.forEach((d) => {
    html += `<th>${DOW_NAMES[d.getDay()]}<br>${formatPretty(d)}</th>`;
  });
  html += "</tr></thead><tbody>";

  SLOTS.forEach((slot) => {
    html += `<tr><th>${escapeHTML(slot.label)}</th>`;
    dates.forEach((d) => {
      const dateISO = toISODate(d);
      const cellData = plan.cells[cellKey(dateISO, slot.key)] || { text: "" };
      html += `<td>${escapeHTML(cellData.text || "")}</td>`;
    });
    html += "</tr>";
  });

  html += "</tbody></table>";
  return html;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function saveAndPrintPlan(plan) {
  printAreaEl.innerHTML = buildPrintTable(plan);

  const existingIdx = state.pdfHistory.findIndex((h) => h.weekKey === plan.weekStart);
  const record = { weekKey: plan.weekStart, title: plan.title, savedAt: new Date().toISOString() };
  if (existingIdx >= 0) {
    state.pdfHistory[existingIdx] = record;
  } else {
    state.pdfHistory.push(record);
  }
  state.pdfHistory.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  persistPdfHistory();

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

function renderPdfHistoryView() {
  pdfHistoryListEl.innerHTML = "";

  if (state.pdfHistory.length === 0) {
    pdfHistoryListEl.innerHTML = `<div class="empty-state">No PDFs saved yet. From the Meal Planning tab, fill in a week and click "Save &amp; Print PDF".</div>`;
    return;
  }

  state.pdfHistory.forEach((record) => {
    const card = document.createElement("div");
    card.className = "pdf-card";

    const info = document.createElement("div");
    info.className = "pdf-card-info";
    info.innerHTML = `<strong>${escapeHTML(record.title)}</strong><br><span class="saved-at">Saved ${new Date(record.savedAt).toLocaleString()}</span>`;

    const actions = document.createElement("div");

    const viewBtn = document.createElement("button");
    viewBtn.className = "btn btn-primary btn-small";
    viewBtn.textContent = "View / Print";
    viewBtn.addEventListener("click", () => {
      const plan = state.plans[record.weekKey];
      if (!plan) {
        alert("That week's data no longer exists.");
        return;
      }
      saveAndPrintPlan(plan);
    });

    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-secondary btn-small";
    openBtn.textContent = "Open in Planner";
    openBtn.addEventListener("click", () => {
      if (!state.plans[record.weekKey]) {
        alert("That week's data no longer exists.");
        return;
      }
      state.currentWeekKey = record.weekKey;
      persistCurrentWeekKey();
      showView("plan");
    });

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
    actions.appendChild(openBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(info);
    card.appendChild(actions);
    pdfHistoryListEl.appendChild(card);
  });
}

/* =====================================================================
   ADD NEW MEAL VIEW
   ===================================================================== */

const mealNameInput = document.getElementById("meal-name");
const mealSlotsCheckboxesEl = document.getElementById("meal-slots-checkboxes");
const mealTagsCheckboxesEl = document.getElementById("meal-tags-checkboxes");
const newTagInput = document.getElementById("new-tag-input");
const mealLibraryListEl = document.getElementById("meal-library-list");

function renderAddMealView() {
  renderSlotCheckboxes();
  renderTagCheckboxes();
  renderMealLibrary();
}

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
  mealTagsCheckboxesEl.innerHTML = "";
  allTags().forEach((tag) => {
    const label = document.createElement("label");
    label.className = "checkbox-chip";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = tag;
    cb.name = "tag";
    label.appendChild(cb);
    const span = document.createElement("span");
    span.textContent = tag;
    label.appendChild(span);

    if (state.customTags.includes(tag)) {
      const removeBtn = document.createElement("span");
      removeBtn.textContent = " ×";
      removeBtn.title = `Remove custom tag "${tag}"`;
      removeBtn.style.cursor = "pointer";
      removeBtn.style.fontWeight = "700";
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeCustomTag(tag);
      });
      label.appendChild(removeBtn);
    }

    mealTagsCheckboxesEl.appendChild(label);
  });
}

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

document.getElementById("add-meal-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = mealNameInput.value.trim();
  if (!name) return;

  const slots = Array.from(mealSlotsCheckboxesEl.querySelectorAll("input:checked")).map((cb) => cb.value);
  const tags = Array.from(mealTagsCheckboxesEl.querySelectorAll("input:checked")).map((cb) => cb.value);

  state.meals.push({
    id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    slots,
    tags,
    lastUsed: null,
    usageHistory: [],
  });
  persistMeals();

  mealNameInput.value = "";
  mealSlotsCheckboxesEl.querySelectorAll("input:checked").forEach((cb) => (cb.checked = false));
  mealTagsCheckboxesEl.querySelectorAll("input:checked").forEach((cb) => (cb.checked = false));

  renderMealLibrary();
});

function renderMealLibrary() {
  mealLibraryListEl.innerHTML = "";

  if (state.meals.length === 0) {
    mealLibraryListEl.innerHTML = `<div class="empty-state">No meals yet. Add one above, or click "Load Example Meals" to try the planner out.</div>`;
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

      const usedInfo = meal.lastUsed
        ? `Last used week of ${formatPretty(fromISODate(meal.lastUsed))} · used ${meal.usageHistory?.length || 0}x`
        : "Never used yet";

      info.innerHTML = `<strong>${escapeHTML(meal.name)}</strong><div class="meal-card-meta">${metaBits.join(" ")}</div><div class="meal-card-meta">${escapeHTML(usedInfo)}</div>`;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger btn-small";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        if (!confirm(`Delete "${meal.name}" from your meal library?`)) return;
        state.meals = state.meals.filter((m) => m.id !== meal.id);
        persistMeals();
        renderMealLibrary();
      });

      card.appendChild(info);
      card.appendChild(deleteBtn);
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

showView("plan");
