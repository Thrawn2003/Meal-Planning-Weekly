"use strict";

/* Free, offline, rule-based week planner behind Auto-Populate: no AI, no API, no network. */
const PlannerEngine = (() => {
  const DAY_MS = 86400000;
  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const PROTEINS = ["Chicken", "Beef", "Lamb / Goat", "Pork", "Seafood", "Eggs", "Vegetarian"];
  const INDIAN = "Indian";
  const CUISINES = [INDIAN, "American", "Italian", "Mexican", "Chinese", "Other Cuisine"];
  const QUICK = ["Quick", "Low Effort", "One-Pot", "Make-Ahead"];
  // Slots the family eats the same way almost every week; Auto-Populate repeats the usual instead of varying.
  const ROUTINE_SLOTS = ["parents-breakfast", "parents-lunch"];
  const TAKEOUT = "Takeout / Restaurant Night";
  const KIDS_SLOTS = ["kids-breakfast", "namath-lunch", "kids-dinner"];
  const FILL_ORDER = ["kids-dinner", "parents-dinner", "namath-lunch", "parents-lunch", "kids-breakfast", "parents-breakfast"];
  const DEFAULT_VARIETY = 0.85;
  const W = { rest: 2.4, explore: 0.5, pop: 0.9, habit: 4, rhythm: 0.8, trend: 0.5, season: 0.6, weekday: 0.9, slot: 0.9, generic: 0.5 };

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const hasTag = (m, t) => Array.isArray(m.tags) && m.tags.includes(t);
  const hasAny = (m, list) => list.some((t) => hasTag(m, t));
  const mealTime = (slotKey) => slotKey.slice(slotKey.lastIndexOf("-") + 1);
  const normName = (s) => String(s == null ? "" : s).trim().toLowerCase();
  const isoToDay = (iso) => {
    const [y, m, d] = String(iso).split("-").map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
  };
  const dayToISO = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);
  const weekdayOf = (day) => new Date(day * DAY_MS).getUTCDay();
  const median = (arr) => {
    const a = arr.slice().sort((x, y) => x - y);
    const n = a.length;
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  };

  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- History: what was eaten in every OTHER saved week ---------- */

  function indexMeals(meals) {
    const byId = new Map();
    const byName = new Map();
    meals.forEach((m) => {
      byId.set(m.id, m);
      const n = normName(m.name);
      if (n && !byName.has(n)) byName.set(n, m);
    });
    return { byId, byName };
  }

  function matchMeal(idx, cell) {
    return (cell.mealId && idx.byId.get(cell.mealId)) || idx.byName.get(normName(cell.text)) || null;
  }

  function buildHistory(meals, plans, targetWeekStart, targetStartDay, routineSlots) {
    const idx = indexMeals(meals);
    const byMeal = new Map();
    const cellMeal = new Map();
    const slotTotals = {};
    const slotIndian = {};
    const routineCells = [];
    const varietyAgg = {};
    let earliestPast = Infinity;
    let cells = 0;
    let weeks = 0;

    Object.values(plans || {}).forEach((p) => {
      if (!p || p.weekStart === targetWeekStart || !p.cells) return;
      const perSlot = {};
      let weekCells = 0;
      Object.entries(p.cells).forEach(([key, cell]) => {
        const text = String((cell && cell.text) || "").trim();
        const cut = key.indexOf("_");
        if (!text || cut < 0) return;
        const day = isoToDay(key.slice(0, cut));
        if (!Number.isFinite(day)) return;
        const slotKey = key.slice(cut + 1);
        // A box Auto-Populate filled (it carries a "why" note) says what was planned, not what the family
        // prefers: it counts for how recently a meal came up, but never as a habit, favorite or routine.
        // Otherwise a few early weeks of repeats would teach the planner to keep repeating.
        const auto = Array.isArray(cell.why) && cell.why.length > 0;
        weekCells++;
        if (!auto) {
          slotTotals[slotKey] = (slotTotals[slotKey] || 0) + 1;
          const agg = perSlot[slotKey] || (perSlot[slotKey] = { filled: 0, names: new Set() });
          agg.filled++;
          agg.names.add(normName(text));
        }
        const meal = matchMeal(idx, cell);
        if (!auto && routineSlots.includes(slotKey)) {
          routineCells.push({ slotKey, wd: weekdayOf(day), norm: normName(text), text, meal, weeksAgo: Math.abs(day - targetStartDay) / 7 });
        }
        if (!meal) return;
        if (!auto) {
          const si = slotIndian[slotKey] || (slotIndian[slotKey] = { indian: 0, total: 0 });
          si.total++;
          if (hasTag(meal, INDIAN)) si.indian++;
        }
        let rec = byMeal.get(meal.id);
        if (!rec) byMeal.set(meal.id, (rec = []));
        rec.push({ day, slotKey, auto });
        cellMeal.set(day + "|" + slotKey, meal);
        cells++;
        if (day < targetStartDay && day < earliestPast) earliestPast = day;
      });
      if (weekCells) weeks++;
      Object.entries(perSlot).forEach(([slotKey, a]) => {
        if (a.filled < 3) return;
        const v = varietyAgg[slotKey] || (varietyAgg[slotKey] = { filled: 0, distinct: 0 });
        v.filled += a.filled;
        v.distinct += a.names.size;
      });
    });

    const variety = {};
    Object.entries(varietyAgg).forEach(([slotKey, v]) => {
      variety[slotKey] = clamp((v.distinct + DEFAULT_VARIETY * 6) / (v.filled + 6), 0.25, 1);
    });

    return {
      byMeal,
      cellMeal,
      slotTotals,
      slotIndian,
      routineCells,
      variety,
      cells,
      weeks,
      spanPast: Number.isFinite(earliestPast) ? Math.max(0, targetStartDay - earliestPast) : 0,
    };
  }

  /* ---------- The scorer ---------- */

  function makeCtx() {
    return {
      assign: new Map(),
      mealDays: new Map(),
      highDays: new Set(),
      takeoutNights: new Set(),
      newRecipeNights: new Set(),
      proteinDays: new Map(),
      slotStats: new Map(),
    };
  }

  function addToCtx(ctx, dayIdx, slotKey, meal) {
    ctx.assign.set(dayIdx + "|" + slotKey, meal || null);
    const ss = ctx.slotStats.get(slotKey) || { filled: 0, indian: 0 };
    ss.filled++;
    if (meal && hasTag(meal, INDIAN)) ss.indian++;
    ctx.slotStats.set(slotKey, ss);
    if (!meal) return;
    const time = mealTime(slotKey);
    let byTime = ctx.mealDays.get(meal.id);
    if (!byTime) ctx.mealDays.set(meal.id, (byTime = new Map()));
    let days = byTime.get(time);
    if (!days) byTime.set(time, (days = new Set()));
    days.add(dayIdx);
    if (time === "dinner" && hasTag(meal, "High Effort")) ctx.highDays.add(dayIdx);
    if (hasTag(meal, TAKEOUT)) ctx.takeoutNights.add(dayIdx + "|" + time);
    if (hasTag(meal, "New Recipe")) ctx.newRecipeNights.add(dayIdx + "|" + time);
    if (time === "dinner") {
      PROTEINS.forEach((p) => {
        if (!hasTag(meal, p)) return;
        let set = ctx.proteinDays.get(p);
        if (!set) ctx.proteinDays.set(p, (set = new Set()));
        set.add(dayIdx);
      });
    }
  }

  function sharesCuisine(a, b, skip) {
    return !!a && !!b && CUISINES.some((c) => c !== skip && hasTag(a, c) && hasTag(b, c));
  }

  function scoreCandidate(meal, dayIdx, slotKey, ctx, S) {
    const st = S.stats(meal);
    const day = S.weekStartDay + dayIdx;
    const wd = weekdayOf(day);
    const time = mealTime(slotKey);
    const dinner = time === "dinner";
    const scale = dinner ? 1 : 0.6;
    const busy = wd >= 1 && wd <= 4;
    const variety = S.variety(slotKey);
    const hard = hasTag(meal, "High Effort");
    const parts = {};
    const info = { neverUsed: st.count === 0, pastGap: null, gap: null };
    // A meal that dominates a habit slot (like the daily breakfast) is expected to repeat.
    const habit = Math.min(1, S.popScore(meal, slotKey) * (1 - variety) * 2.2);
    // The meal in the same slot on a neighboring day, reaching into adjacent saved weeks.
    const neighborOf = (n) =>
      (n >= 0 && n <= 6 ? ctx.assign.get(n + "|" + slotKey) : S.cellMeal.get(S.weekStartDay + n + "|" + slotKey)) || null;

    // How rested is it, relative to how often this meal normally comes around?
    // Earlier picks in this same week count as occurrences too.
    const byTime = ctx.mealDays.get(meal.id);
    let gap = Infinity;
    let pastGap = Infinity;
    st.days.forEach((d) => {
      gap = Math.min(gap, Math.abs(day - d));
      if (d < day) pastGap = Math.min(pastGap, day - d);
    });
    if (byTime) {
      byTime.forEach((days) => days.forEach((d) => {
        if (d !== dayIdx) gap = Math.min(gap, Math.abs(d - dayIdx));
      }));
    }
    info.gap = Number.isFinite(gap) ? gap : null;
    info.pastGap = Number.isFinite(pastGap) ? pastGap : null;
    const r = Number.isFinite(gap) ? gap / S.typical(meal, slotKey) : 1.2;
    // Novelty matters less in slots where this family naturally repeats (low learned variety).
    parts.rest = W.rest * (0.4 + 0.6 * variety) * Math.tanh(1.6 * (r - 0.55));
    parts.explore = byTime ? 0 : variety * (st.count === 0 ? W.explore : st.count === 1 ? W.explore * 0.4 : 0);

    // Family favorites for this slot (strongest in slots where the family repeats a lot).
    parts.pop = W.pop * (1 + W.habit * (1 - variety)) * S.popScore(meal, slotKey);

    parts.trend = W.trend * st.trend * S.trendConf;

    let seasonal = 0;
    st.days.forEach((d) => {
      const diff = Math.abs(day - d);
      if (diff < 330) return;
      const years = Math.round(diff / 365.25);
      if (Math.abs(diff - years * 365.25) <= 21) seasonal++;
    });
    parts.season = W.season * Math.min(1, seasonal / 2);

    // Weekly/regular rituals: reward landing right on the meal's own usual rhythm.
    parts.rhythm = 0;
    if (st.gapCount >= 2 && info.pastGap != null) {
      const z = (info.pastGap - st.medGap) / (0.3 * st.medGap + 0.5);
      parts.rhythm = W.rhythm * (1 / (1 + st.gapCv)) * Math.exp(-z * z);
    }

    // Which weekday / slot does this meal usually land on?
    let wdPart = 0;
    if (st.humanCount >= 2) {
      const conf = Math.min(1, st.humanCount / 4);
      wdPart = conf * (st.weekdayCounts[wd] / st.humanCount - 1 / 7) * 1.4;
      if (st.weekdayCounts[wd] === 0) {
        const topShare = Math.max(...st.weekdayCounts) / st.humanCount;
        const neverHere = Math.min(1, st.humanCount / 7 / 2);
        const dayBound = st.humanCount >= 3 && topShare >= 0.75 ? 0.8 * conf : 0;
        wdPart -= Math.max(neverHere, dayBound);
      }
    }
    parts.weekday = W.weekday * wdPart;

    let slotPart = 0;
    if (st.humanCount >= 3) {
      const total = Object.values(st.slotCounts).reduce((a, b) => a + b, 0);
      const fit = meal.slots && meal.slots.length ? meal.slots.length : 6;
      slotPart = Math.min(1, st.humanCount / 5) * ((st.slotCounts[slotKey] || 0) / total - 1 / fit);
    }
    parts.slot = W.slot * slotPart;

    parts.generic = meal.slots && meal.slots.length ? 0 : -W.generic;

    parts.kid = 0;
    if (KIDS_SLOTS.includes(slotKey)) {
      if (hasTag(meal, "Kid-Favorite")) parts.kid += 0.35;
      if (hasTag(meal, "Picky-Eater-Safe")) parts.kid += 0.2;
    }

    // Right meal for the kind of day: quick on busy nights, big/special/takeout when relaxed.
    let effort = 0;
    if (busy) {
      if (hasAny(meal, QUICK)) effort += 0.45 * scale;
      if (hard) effort -= 0.7 * scale;
    } else if (hard) {
      effort += 0.1 * scale;
    }
    if (hasTag(meal, "Weekend / Special")) effort += (busy ? -0.5 : 0.4) * (dinner ? 1 : 0.5);
    if (hasTag(meal, TAKEOUT)) {
      if (dinner) effort += wd === 5 || wd === 6 ? 0.4 : busy ? -0.8 : 0;
      else effort -= 0.3;
    }
    if (hasTag(meal, "New Recipe")) effort += busy ? -0.4 : 0.3;
    parts.effort = effort;

    // Weekly limits: takeout nights, back-to-back big cooking days, new recipes.
    let caps = 0;
    const night = dayIdx + "|" + time;
    if (hasTag(meal, TAKEOUT) && !ctx.takeoutNights.has(night)) {
      if (ctx.takeoutNights.size >= 2) caps -= 2;
      else if (ctx.takeoutNights.size === 1) caps -= 0.3;
    }
    if (hard && dinner && !ctx.highDays.has(dayIdx)) {
      if (ctx.highDays.size >= 3) caps -= 1.2;
      if (ctx.highDays.has(dayIdx - 1) || ctx.highDays.has(dayIdx + 1)) caps -= 0.7;
    }
    if (hasTag(meal, "New Recipe") && !ctx.newRecipeNights.has(night) && ctx.newRecipeNights.size >= 1) caps -= 1;
    parts.caps = caps;

    // Variety of proteins and cuisines across the week.
    let mix = 0;
    if (dinner) {
      PROTEINS.forEach((p) => {
        if (!hasTag(meal, p)) return;
        const days = ctx.proteinDays.get(p);
        if (!days) return;
        const others = [...days].filter((d) => d !== dayIdx).length;
        mix -= 0.25 * others;
        if (days.has(dayIdx - 1) || days.has(dayIdx + 1)) mix -= 0.5;
      });
    }
    [dayIdx - 1, dayIdx + 1].forEach((n) => {
      // Breakfasts handle Indian vs. not in their own alternation rule below.
      if (sharesCuisine(meal, neighborOf(n), time === "breakfast" ? INDIAN : null)) mix -= dinner ? 0.3 : 0.15;
    });
    parts.mix = Math.max(mix, -1.6);

    // Breakfasts: alternate and space out Indian and non-Indian days, and keep the week's overall
    // mix near the family's usual share, so "haven't had it in a while" can't tip it to one kind.
    // Only when both kinds are available, and softened for habit meals and weekly rituals.
    let alternate = 0;
    let balance = 0;
    if (time === "breakfast" && S.hasBothKinds(slotKey)) {
      const indian = hasTag(meal, INDIAN);
      const protectedBy = Math.max(habit, clamp((parts.weekday + parts.rhythm) / 1.6, 0, 1));
      [dayIdx - 1, dayIdx + 1].forEach((n) => {
        const nb = neighborOf(n);
        if (!nb) return;
        alternate += (hasTag(nb, INDIAN) === indian ? -1.0 : 0.4) * (1 - 0.85 * protectedBy);
      });
      if (!S.routineSlots.has(slotKey)) {
        const ss = ctx.slotStats.get(slotKey) || { filled: 0, indian: 0 };
        const range = S.indianRange(slotKey);
        const after = ss.indian + (indian ? 1 : 0);
        const left = 7 - ss.filled - 1;
        if (after > range.hi) balance -= 2.5 * (after - range.hi);
        if (after + left < range.lo) balance -= 2.5 * (range.lo - (after + left));
      }
    }
    parts.alternate = alternate;
    parts.balance = balance;

    // Repeats within the week - tolerated in slots where this family repeats a lot.
    let repeat = 0;
    if (byTime) {
      const dampen = 1 - 0.85 * habit;
      const sameTime = [...(byTime.get(time) || [])].filter((d) => d !== dayIdx);
      if (sameTime.length) {
        let same = variety * (0.9 + 0.5 * (sameTime.length - 1));
        if (sameTime.some((d) => Math.abs(d - dayIdx) === 1)) same += variety * 0.9;
        repeat += dampen * same;
      }
      byTime.forEach((days, t) => {
        if (t === time) return;
        if (days.has(dayIdx)) repeat += 1.6;
        repeat += 0.25 * variety * [...days].filter((d) => d !== dayIdx).length;
      });
    }
    parts.repeat = -repeat;

    // "Show me something different": steer away from the previous suggestion for this exact box.
    parts.avoid = S.avoid[dayToISO(S.weekStartDay + dayIdx) + "_" + slotKey] === meal.id ? -0.7 : 0;

    let total = 0;
    Object.values(parts).forEach((v) => (total += v));
    return { total, parts, info, st, wd, popScore: S.popScore(meal, slotKey) };
  }

  function explain(meal, scored) {
    const { parts, info, st, wd } = scored;
    const found = [];
    if (info.neverUsed) {
      found.push([parts.rest + parts.explore, "Haven't had this one yet"]);
    } else if (info.pastGap != null && info.pastGap >= 14 && parts.rest > 1) {
      const weeks = Math.max(1, Math.round(info.pastGap / 7));
      found.push([parts.rest, `Last had ${weeks} week${weeks === 1 ? "" : "s"} ago`]);
    }
    if (scored.popScore >= 0.6 && st.humanCount >= 3) found.push([parts.pop, `A family favorite (eaten ${st.humanCount}×)`]);
    if (parts.weekday > 0.45) found.push([parts.weekday, `Usually a ${DOW[wd]} meal`]);
    if (parts.rhythm > 0.5) found.push([parts.rhythm, "Right on its usual schedule"]);
    if (parts.trend > 0.2) found.push([parts.trend * 2, "Trending up lately"]);
    if (parts.season > 0.3) found.push([parts.season, "You had it around this time last year"]);
    if (parts.effort >= 0.4) {
      if (hasTag(meal, TAKEOUT)) found.push([parts.effort, "Takeout night"]);
      else if (hasAny(meal, QUICK) && wd >= 1 && wd <= 4) found.push([parts.effort, "Quick pick for a busy day"]);
      else found.push([parts.effort, "Nice for the weekend"]);
    }
    if (parts.kid >= 0.35) found.push([parts.kid, "Kid-friendly"]);
    if (parts.alternate >= 0.35) found.push([parts.alternate, "Alternates Indian and non-Indian breakfasts"]);
    found.sort((a, b) => b[0] - a[0]);
    const reasons = found.slice(0, 3).map((f) => f[1]);
    if (!reasons.length) reasons.push("A good fit for this meal slot");
    return reasons;
  }

  /* ---------- Planning a week ---------- */

  function planWeek(opts) {
    const { meals, plans, plan, slots, isEligible } = opts;
    const restarts = opts.restarts || 40;
    const rng = mulberry32(hashSeed(opts.seed != null ? opts.seed : plan.weekStart));
    const weekStartDay = isoToDay(plan.weekStart);
    const slotKeys = [
      ...FILL_ORDER.filter((k) => slots.some((s) => s.key === k)),
      ...slots.map((s) => s.key).filter((k) => !FILL_ORDER.includes(k)),
    ];

    const eligible = {};
    slotKeys.forEach((k) => (eligible[k] = meals.filter((m) => isEligible(m, k))));

    const routineSlotList = (opts.routineSlots || ROUTINE_SLOTS).filter((k) => slotKeys.includes(k));
    const H = buildHistory(meals, plans, plan.weekStart, weekStartDay, routineSlotList);
    const idx = indexMeals(meals);

    const statsCache = new Map();
    const stats = (meal) => {
      let s = statsCache.get(meal.id);
      if (s) return s;
      const occ = H.byMeal.get(meal.id) || [];
      const unique = (list) => [...new Set(list.map((o) => o.day))].sort((a, b) => a - b);
      const days = unique(occ); // every time it was planned: used for "how recently"
      const humanOcc = occ.filter((o) => !o.auto);
      const humanDays = unique(humanOcc); // what you chose yourself: used for habits and favorites
      const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
      humanDays.forEach((d) => weekdayCounts[weekdayOf(d)]++);
      const slotCounts = {};
      humanOcc.forEach((o) => (slotCounts[o.slotKey] = (slotCounts[o.slotKey] || 0) + 1));
      const gaps = [];
      for (let i = 1; i < humanDays.length; i++) gaps.push(humanDays[i] - humanDays[i - 1]);
      const medGap = gaps.length ? median(gaps) : 0;
      const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
      const gapSd = gaps.length ? Math.sqrt(gaps.reduce((a, g) => a + (g - meanGap) * (g - meanGap), 0) / gaps.length) : 0;
      const gapCv = meanGap ? gapSd / meanGap : 0;
      const recent = humanDays.filter((d) => d < weekStartDay && d >= weekStartDay - 42).length;
      const older = humanDays.filter((d) => d < weekStartDay - 42 && d >= weekStartDay - 168).length;
      const olderSpan = clamp(H.spanPast - 42, 0, 126);
      let trend = 0;
      if (olderSpan >= 14) {
        const rateR = recent / 42;
        const rateO = older / olderSpan;
        if (rateR + rateO > 0) trend = ((rateR - rateO) / (rateR + rateO)) * Math.min(1, (recent + older) / 3);
      }
      s = { days, count: days.length, humanCount: humanDays.length, weekdayCounts, slotCounts, trend, gaps, gapCount: gaps.length, medGap, gapCv };
      statsCache.set(meal.id, s);
      return s;
    };

    const typicalCache = new Map();
    const typical = (meal, slotKey) => {
      const ck = meal.id + "|" + slotKey;
      if (typicalCache.has(ck)) return typicalCache.get(ck);
      const base = clamp(eligible[slotKey] ? eligible[slotKey].length : 14, 7, 42);
      const st = stats(meal);
      const n = st.gapCount;
      const val = clamp(((n ? n * st.medGap : 0) + 2 * base) / (n + 2), 1, 90);
      typicalCache.set(ck, val);
      return val;
    };

    const popMaxCache = {};
    const popRaw = (meal, slotKey) => (stats(meal).slotCounts[slotKey] || 0) / ((H.slotTotals[slotKey] || 0) + 6);
    const popScore = (meal, slotKey) => {
      if (popMaxCache[slotKey] == null) popMaxCache[slotKey] = Math.max(0, ...(eligible[slotKey] || []).map((m) => popRaw(m, slotKey)));
      const max = popMaxCache[slotKey];
      if (!max) return 0;
      return (popRaw(meal, slotKey) / max) * Math.min(1, max * 5) * Math.min(1, (H.slotTotals[slotKey] || 0) / 12);
    };

    // The week's acceptable number of Indian breakfasts, from the family's own usual share.
    const indianRange = (slotKey) => {
      const si = H.slotIndian[slotKey];
      const share = si && si.total >= 8 ? clamp(si.indian / si.total, 0.25, 0.6) : 0.4;
      const target = clamp(Math.round(share * 7), 2, 4);
      return { lo: Math.max(1, target - 1), hi: target + 1 };
    };

    const S = {
      weekStartDay,
      routineSlots: new Set(routineSlotList),
      indianRange,
      cellMeal: H.cellMeal,
      hasBothKinds: (slotKey) => {
        const list = eligible[slotKey] || [];
        return list.some((m) => hasTag(m, INDIAN)) && list.some((m) => !hasTag(m, INDIAN));
      },
      avoid: opts.avoid || {},
      stats,
      typical,
      popScore,
      variety: (slotKey) => (H.variety[slotKey] != null ? H.variety[slotKey] : DEFAULT_VARIETY),
      trendConf: clamp((H.spanPast - 28) / 56, 0, 1),
    };

    // Cells already filled stay as they are, and count toward this week's balance.
    const baseFilled = [];
    let toFill = [];
    for (let d = 0; d < 7; d++) {
      slotKeys.forEach((slotKey) => {
        const cell = plan.cells && plan.cells[dayToISO(weekStartDay + d) + "_" + slotKey];
        if (cell && String(cell.text || "").trim()) baseFilled.push({ d, slotKey, meal: matchMeal(idx, cell) });
        else toFill.push({ d, slotKey });
      });
    }

    // Routine slots repeat the family's usual for each weekday (a saved routine first, else what they
    // ate on that weekday in most recent weeks) instead of being varied.
    const explicit = opts.routine || {};
    const routineOk = opts.routineOk || (() => true);
    const learn = (slotKey, wd) => {
      const rows = H.routineCells.filter((c) => c.slotKey === slotKey && c.wd === wd && c.weeksAgo <= 12);
      if (rows.length < 2) return null;
      const agg = new Map();
      let total = 0;
      rows.forEach((r) => {
        const w = 1 / (1 + 0.25 * r.weeksAgo);
        total += w;
        const a = agg.get(r.norm) || { w: 0, n: 0, r };
        a.w += w;
        a.n++;
        agg.set(r.norm, a);
      });
      const top = [...agg.values()].sort((a, b) => b.w - a.w)[0];
      return top.n >= 2 && top.w / total >= 0.6 ? top.r : null;
    };
    const routineAssignments = [];
    const stillToFill = [];
    toFill.forEach((t) => {
      if (!S.routineSlots.has(t.slotKey)) return stillToFill.push(t);
      const saved = explicit[t.slotKey] && explicit[t.slotKey][t.d];
      let entry = null;
      if (saved && (saved.mealId || saved.text)) {
        const meal = (saved.mealId && idx.byId.get(saved.mealId)) || idx.byName.get(normName(saved.text)) || null;
        entry = { meal, text: meal ? meal.name : String(saved.text || "").trim() };
      } else {
        const l = learn(t.slotKey, t.d);
        if (l) entry = { meal: l.meal, text: l.meal ? l.meal.name : l.text };
      }
      if (!entry || !entry.text || (entry.meal && !routineOk(entry.meal))) return stillToFill.push(t);
      routineAssignments.push({ d: t.d, slotKey: t.slotKey, meal: entry.meal, text: entry.text });
      baseFilled.push({ d: t.d, slotKey: t.slotKey, meal: entry.meal });
    });
    toFill = stillToFill;

    function runOnce(jitter, shuffle) {
      const ctx = makeCtx();
      baseFilled.forEach((b) => addToCtx(ctx, b.d, b.slotKey, b.meal));
      let order = toFill.slice();
      if (shuffle) {
        order = [];
        slotKeys.forEach((slotKey) => {
          const days = toFill.filter((t) => t.slotKey === slotKey);
          for (let i = days.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [days[i], days[j]] = [days[j], days[i]];
          }
          order.push(...days);
        });
      }
      const picks = [];
      const skipped = [];
      let total = 0;
      order.forEach(({ d, slotKey }) => {
        const cands = eligible[slotKey];
        if (!cands.length) {
          skipped.push({ d, slotKey });
          return;
        }
        let best = null;
        cands.forEach((m) => {
          const scored = scoreCandidate(m, d, slotKey, ctx, S);
          const val = scored.total + (jitter ? (rng() - 0.5) * jitter : 0);
          if (!best || val > best.val) best = { val, meal: m, scored };
        });
        addToCtx(ctx, d, slotKey, best.meal);
        total += best.scored.total;
        picks.push({ d, slotKey, meal: best.meal, scored: best.scored });
      });
      return { picks, skipped, total };
    }

    // Try many orderings and keep the best; exact ties (e.g. a library with no history yet) break randomly.
    const runs = [runOnce(0, false)];
    for (let i = 1; i < restarts; i++) runs.push(runOnce(i % 3 === 0 ? 0.15 : 0.4, true));
    const top = Math.max(...runs.map((r) => r.total));
    const tied = runs.filter((r) => r.total >= top - 0.05);
    const best = tied[Math.floor(rng() * tied.length)];

    const scoredOut = best.picks.map((p) => ({
      key: dayToISO(weekStartDay + p.d) + "_" + p.slotKey,
      dayIdx: p.d,
      slotKey: p.slotKey,
      mealId: p.meal.id,
      text: p.meal.name,
      reasons: explain(p.meal, p.scored),
      score: p.scored.total,
    }));
    const routineOut = routineAssignments.map((r) => ({
      key: dayToISO(weekStartDay + r.d) + "_" + r.slotKey,
      dayIdx: r.d,
      slotKey: r.slotKey,
      mealId: r.meal ? r.meal.id : null,
      text: r.text,
      reasons: [`Your usual ${DOW[r.d]} ${mealTime(r.slotKey)}`],
      score: 0,
      routine: true,
    }));
    const assignments = [...routineOut, ...scoredOut].sort((a, b) => a.dayIdx - b.dayIdx);

    return {
      assignments,
      skipped: best.skipped.map((s) => dayToISO(weekStartDay + s.d) + "_" + s.slotKey),
      stats: { filled: assignments.length, routine: routineOut.length, historyCells: H.cells, historyWeeks: H.weeks },
    };
  }

  return { planWeek };
})();

if (typeof module !== "undefined" && module.exports) module.exports = PlannerEngine;
