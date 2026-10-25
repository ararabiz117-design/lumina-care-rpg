import { CLEAR_REWARD_IDS, COSMETICS, EQUIPMENT, EQUIPMENT_BY_ID, EQUIPMENT_SLOTS, LEGACY_COSMETIC_ITEM, STARTER_EQUIPPED, STARTER_ITEM_IDS, type CosmeticId, type EquipmentItem, type EquipmentSlot } from "./equipment.ts";

export type Question = {
  id: string;
  prompt: string;
  options: { text: string; feedback: string }[];
  correctIndex: number;
  rationale: string;
  examArea: string;
};
export type Lesson = {
  id: string;
  title: string;
  shortTitle: string;
  place: string;
  card: string;
  skill: string;
  questions: Question[];
};
export type EquipmentLoadout = Record<EquipmentSlot, string>;
export type JourneySave = {
  version: 4;
  completed: string[];
  activeDays: string[];
  mistakes: string[];
  coins: number;
  claimedDayMilestones: number[];
  ownedEquipmentIds: string[];
  equippedBySlot: EquipmentLoadout;
  // Kept only as a migration bridge for v2/v3 wardrobe saves and old local tooling.
  ownedCosmetics: CosmeticId[];
  equippedCosmetic: CosmeticId;
  session: { lessonId: string; questionIndex: number; selected: number | null; checked: boolean; hadMistake?: boolean } | null;
};

export type JourneyStats = {
  version: 1;
  launches: number;
  learningSessions: number;
  lessonCompletions: number;
  questionsCleared: number;
  appForegroundMs: number;
  lessonForegroundMs: number;
};

export const SAVE_KEY = "arablo-lumina-minute-v2";
export const STATS_KEY = "arablo-lumina-stats-v1";
export const XP_PER_LESSON = 30;
export const COINS_PER_LESSON = 15;
export const DAILY_COINS = 5;
export const DAY_MILESTONES = [
  { days: 3, coins: 25 },
  { days: 7, coins: 50 },
] as const;
export { COSMETICS };
export type { CosmeticId };

export const emptyLoadout = (): EquipmentLoadout => ({ ...STARTER_EQUIPPED });
export const emptySave = (): JourneySave => ({
  version: 4,
  completed: [],
  activeDays: [],
  mistakes: [],
  coins: 0,
  claimedDayMilestones: [],
  ownedEquipmentIds: [...STARTER_ITEM_IDS],
  equippedBySlot: emptyLoadout(),
  ownedCosmetics: ["starter"],
  equippedCosmetic: "starter",
  session: null,
});

export const emptyJourneyStats = (): JourneyStats => ({
  version: 1,
  launches: 0,
  learningSessions: 0,
  lessonCompletions: 0,
  questionsCleared: 0,
  appForegroundMs: 0,
  lessonForegroundMs: 0,
});

function safeStatCount(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000_000 ? value as number : 0;
}
function safeStatTime(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 315_576_000_000 ? value as number : 0;
}
export function readJourneyStats(raw: string | null): JourneyStats {
  if (!raw) return emptyJourneyStats();
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1) return emptyJourneyStats();
    return {
      version: 1,
      launches: safeStatCount(value.launches),
      learningSessions: safeStatCount(value.learningSessions),
      lessonCompletions: safeStatCount(value.lessonCompletions),
      questionsCleared: safeStatCount(value.questionsCleared),
      appForegroundMs: safeStatTime(value.appForegroundMs),
      lessonForegroundMs: safeStatTime(value.lessonForegroundMs),
    };
  } catch { return emptyJourneyStats(); }
}

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return localDay(new Date(y, m - 1, d, 12)) === value;
}
function validCoinAmount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000_000;
}
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / XP_PER_LESSON) + 1);
}
export function playerLevel(state: JourneySave): number {
  return levelForXp(state.completed.length * XP_PER_LESSON);
}
export function isEquipmentUnlocked(item: EquipmentItem, state: JourneySave): boolean {
  return item.requiredLevel <= playerLevel(state);
}

export function currentStreak(activeDays: string[], today = localDay()): number {
  const days = new Set(activeDays);
  const cursor = new Date(`${today}T12:00:00`);
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
export function weekDays(date = new Date()): string[] {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return localDay(day);
  });
}

export type RewardPreview = {
  lessonXp: number;
  lessonCoins: number;
  dailyCoins: number;
  milestoneCoins: number;
  newMilestone: number | null;
  gearReward: EquipmentItem | null;
  previousLevel: number;
  newLevel: number;
  legendUnlocked: boolean;
};

export function rewardPreview(state: JourneySave, lessonId: string, day: string, lessons: Lesson[]): RewardPreview {
  const newLesson = !state.completed.includes(lessonId);
  const newDay = !state.activeDays.includes(day);
  const resultingDayCount = state.activeDays.length + Number(newDay);
  const milestone = DAY_MILESTONES.find(({ days }) => resultingDayCount >= days && !state.claimedDayMilestones.includes(days));
  const completedCount = state.completed.length + Number(newLesson);
  const previousLevel = playerLevel(state);
  const newLevel = levelForXp(completedCount * XP_PER_LESSON);
  const dropId = newLesson ? CLEAR_REWARD_IDS[completedCount - 1] : undefined;
  const drop = dropId && !state.ownedEquipmentIds.includes(dropId) ? EQUIPMENT_BY_ID.get(dropId) ?? null : null;
  return {
    lessonXp: newLesson ? XP_PER_LESSON : 0,
    lessonCoins: newLesson ? COINS_PER_LESSON : 0,
    dailyCoins: newDay ? DAILY_COINS : 0,
    milestoneCoins: milestone?.coins ?? 0,
    newMilestone: milestone?.days ?? null,
    gearReward: drop,
    previousLevel,
    newLevel,
    legendUnlocked: completedCount === lessons.length && !state.ownedCosmetics.includes("legend"),
  };
}

const validCosmetics = (value: unknown): CosmeticId[] => {
  if (!Array.isArray(value)) return ["starter"];
  const ids = new Set(COSMETICS.map(({ id }) => id));
  return [...new Set<CosmeticId>(["starter", ...value.filter((id: unknown): id is CosmeticId => typeof id === "string" && ids.has(id as CosmeticId))])];
};
function cosmeticForLoadout(loadout: EquipmentLoadout): CosmeticId {
  if (loadout.weapon === LEGACY_COSMETIC_ITEM.legend) return "legend";
  if (loadout.cape === LEGACY_COSMETIC_ITEM.coral) return "coral";
  if (loadout.body === LEGACY_COSMETIC_ITEM.sky) return "sky";
  return "starter";
}
function oldCosmeticItemIds(cosmetics: CosmeticId[]): string[] {
  return cosmetics.flatMap((id) => LEGACY_COSMETIC_ITEM[id] ? [LEGACY_COSMETIC_ITEM[id]] : []);
}

export function readSave(raw: string | null, lessons: Lesson[]): JourneySave {
  const safe = emptySave();
  if (!raw) return safe;
  try {
    const value = JSON.parse(raw);
    if (!value || (value.version !== 2 && value.version !== 3 && value.version !== 4)) return safe;
    // Only a sequential completed prefix is retained; XP and levels are derived, never trusted from storage.
    for (const lesson of lessons) {
      if (!Array.isArray(value.completed) || !value.completed.includes(lesson.id)) break;
      safe.completed.push(lesson.id);
    }
    if (Array.isArray(value.activeDays)) safe.activeDays = [...new Set<string>(value.activeDays.filter(validDay))].sort();
    const questionIds = new Set(lessons.flatMap((l) => l.questions.map((q) => q.id)));
    if (Array.isArray(value.mistakes)) safe.mistakes = [...new Set<string>(value.mistakes.filter((id: unknown) => typeof id === "string" && questionIds.has(id)))];

    const oldOwned: CosmeticId[] = value.version >= 3 ? validCosmetics(value.ownedCosmetics) : ["starter"];
    safe.ownedCosmetics = oldOwned;
    if (value.version >= 3 && oldOwned.includes(value.equippedCosmetic)) safe.equippedCosmetic = value.equippedCosmetic;
    if (value.version === 4) {
      safe.coins = validCoinAmount(value.coins) ? value.coins : 0;
      safe.claimedDayMilestones = DAY_MILESTONES.map(({ days }) => days).filter((days) => Array.isArray(value.claimedDayMilestones) && value.claimedDayMilestones.includes(days));
      if (Array.isArray(value.ownedEquipmentIds)) {
        safe.ownedEquipmentIds = [...new Set<string>([
          ...STARTER_ITEM_IDS,
          ...value.ownedEquipmentIds.filter((id: unknown): id is string => typeof id === "string" && EQUIPMENT_BY_ID.has(id)),
        ])];
      }
      if (value.equippedBySlot && typeof value.equippedBySlot === "object") {
        for (const slot of EQUIPMENT_SLOTS) {
          const id = value.equippedBySlot[slot];
          const item = typeof id === "string" ? EQUIPMENT_BY_ID.get(id) : undefined;
          if (item?.slot === slot && safe.ownedEquipmentIds.includes(item.id)) safe.equippedBySlot[slot] = item.id;
        }
      }
    } else if (value.version === 3) {
      // V3 already stored currency, purchases, and claimed milestones. Preserve those exactly.
      safe.coins = validCoinAmount(value.coins) ? value.coins : 0;
      safe.claimedDayMilestones = DAY_MILESTONES.map(({ days }) => days).filter((days) => Array.isArray(value.claimedDayMilestones) && value.claimedDayMilestones.includes(days));
      safe.ownedEquipmentIds.push(...oldCosmeticItemIds(oldOwned));
      const equippedId = LEGACY_COSMETIC_ITEM[safe.equippedCosmetic];
      const equippedItem = equippedId ? EQUIPMENT_BY_ID.get(equippedId) : undefined;
      if (equippedItem) safe.equippedBySlot[equippedItem.slot] = equippedItem.id;
    } else {
      // V2 did not store currency. Infer its earned balance without trusting client XP.
      const attained = DAY_MILESTONES.filter(({ days }) => safe.activeDays.length >= days);
      safe.coins = safe.completed.length * COINS_PER_LESSON + safe.activeDays.length * DAILY_COINS + attained.reduce((sum, reward) => sum + reward.coins, 0);
      safe.claimedDayMilestones = attained.map(({ days }) => days);
      safe.ownedEquipmentIds.push(...oldCosmeticItemIds(oldOwned));
    }

    // Every completed unique lesson has already earned its one-time, deterministic gear drop.
    safe.ownedEquipmentIds = [...new Set([
      ...safe.ownedEquipmentIds,
      ...CLEAR_REWARD_IDS.slice(0, safe.completed.length),
    ])];
    if (safe.completed.length === lessons.length && !safe.ownedCosmetics.includes("legend")) safe.ownedCosmetics.push("legend");
    if (safe.completed.length === lessons.length) safe.ownedEquipmentIds.push(CLEAR_REWARD_IDS[5]);
    safe.ownedEquipmentIds = [...new Set(safe.ownedEquipmentIds)];
    safe.equippedCosmetic = cosmeticForLoadout(safe.equippedBySlot);

    const session = value.session;
    const lesson = lessons.find((l, i) => l.id === session?.lessonId && i <= safe.completed.length);
    if (lesson && Number.isInteger(session.questionIndex) && lesson.questions[session.questionIndex]) {
      const q = lesson.questions[session.questionIndex];
      const selected = Number.isInteger(session.selected) && q.options[session.selected] ? session.selected as number : null;
      safe.session = { lessonId: lesson.id, questionIndex: session.questionIndex, selected, checked: selected !== null && session.checked === true, ...(session.hadMistake === true ? { hadMistake: true } : {}) };
    }
    return safe;
  } catch { return safe; }
}

export function beginLesson(state: JourneySave, lessonId: string, lessons: Lesson[]): JourneySave {
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index < 0 || index > state.completed.length) return state;
  if (state.session?.lessonId === lessonId) return state;
  return { ...state, session: { lessonId, questionIndex: 0, selected: null, checked: false } };
}
export function selectAnswer(state: JourneySave, selected: number, lessons: Lesson[]): JourneySave {
  const session = state.session;
  const q = lessons.find((l) => l.id === session?.lessonId)?.questions[session?.questionIndex ?? -1];
  if (!session || session.checked || !Number.isInteger(selected) || !q?.options[selected]) return state;
  return { ...state, session: { ...session, selected } };
}
export function checkAnswer(state: JourneySave, lessons: Lesson[]): JourneySave {
  const session = state.session;
  const q = lessons.find((l) => l.id === session?.lessonId)?.questions[session?.questionIndex ?? -1];
  if (!session || !q || session.selected === null || session.checked) return state;
  const correct = session.selected === q.correctIndex;
  const mistakes = correct
    ? session.hadMistake ? state.mistakes : state.mistakes.filter((id) => id !== q.id)
    : [...new Set([...state.mistakes, q.id])];
  return { ...state, mistakes, session: { ...session, checked: true, ...(!correct ? { hadMistake: true } : {}) } };
}
export function advanceLesson(state: JourneySave, lessons: Lesson[], day: string): JourneySave {
  const s = state.session;
  const lesson = lessons.find((l) => l.id === s?.lessonId);
  const q = lesson?.questions[s?.questionIndex ?? -1];
  if (!s || !lesson || !q || !s.checked || !validDay(day)) return state;
  if (s.selected !== q.correctIndex) return { ...state, session: { ...s, selected: null, checked: false } };
  const activeToday = state.activeDays.includes(day);
  const activeDays = activeToday ? state.activeDays : [...new Set([...state.activeDays, day])].sort();
  const milestone = activeToday ? undefined : DAY_MILESTONES.find(({ days }) => activeDays.length >= days && !state.claimedDayMilestones.includes(days));
  const recorded = activeToday ? state : {
    ...state,
    activeDays,
    coins: state.coins + DAILY_COINS + (milestone?.coins ?? 0),
    claimedDayMilestones: milestone ? [...new Set([...state.claimedDayMilestones, milestone.days])].sort((a, b) => a - b) : state.claimedDayMilestones,
  };
  if (s.questionIndex < lesson.questions.length - 1) {
    return { ...recorded, session: { lessonId: s.lessonId, questionIndex: s.questionIndex + 1, selected: null, checked: false } };
  }
  const awards = rewardPreview(state, lesson.id, day, lessons);
  return {
    ...recorded,
    completed: [...new Set([...state.completed, lesson.id])],
    coins: recorded.coins + awards.lessonCoins,
    ownedEquipmentIds: awards.gearReward ? [...new Set([...state.ownedEquipmentIds, awards.gearReward.id])] : state.ownedEquipmentIds,
    ownedCosmetics: awards.legendUnlocked ? [...new Set([...state.ownedCosmetics, "legend" as const])] : state.ownedCosmetics,
    session: null,
  };
}

export function buyEquipment(state: JourneySave, id: string): JourneySave {
  const item = EQUIPMENT_BY_ID.get(id);
  if (!item || item.clearReward || state.ownedEquipmentIds.includes(id)) return state;
  if (!isEquipmentUnlocked(item, state) || state.coins < item.price) return state;
  return { ...state, coins: state.coins - item.price, ownedEquipmentIds: [...state.ownedEquipmentIds, id] };
}
export function equipEquipment(state: JourneySave, id: string): JourneySave {
  const item = EQUIPMENT_BY_ID.get(id);
  if (!item || !state.ownedEquipmentIds.includes(id)) return state;
  const equippedBySlot = { ...state.equippedBySlot, [item.slot]: id };
  return { ...state, equippedBySlot, equippedCosmetic: cosmeticForLoadout(equippedBySlot) };
}

// Compatibility wrappers for the first wardrobe prototype.
export function buyCosmetic(state: JourneySave, id: CosmeticId): JourneySave {
  const itemId = LEGACY_COSMETIC_ITEM[id];
  if (id === "starter" || id === "legend" || !itemId) return state;
  return buyEquipment(state, itemId);
}
export function equipCosmetic(state: JourneySave, id: CosmeticId): JourneySave {
  const itemId = id === "starter" ? STARTER_EQUIPPED.body : LEGACY_COSMETIC_ITEM[id];
  if (!itemId) return state;
  return equipEquipment(state, itemId);
}

export function shareLoadoutCode(loadout: EquipmentLoadout): string {
  return EQUIPMENT_SLOTS.map((slot) => {
    const id = loadout[slot];
    const item = EQUIPMENT_BY_ID.get(id);
    return item?.slot === slot ? id : STARTER_EQUIPPED[slot];
  }).join(".");
}
export function parseSharedLoadout(code: string | null): EquipmentLoadout | null {
  if (!code || code.length > 512) return null;
  const ids = code.split(".");
  if (ids.length !== EQUIPMENT_SLOTS.length) return null;
  const loadout = {} as EquipmentLoadout;
  for (const [index, slot] of EQUIPMENT_SLOTS.entries()) {
    const item = EQUIPMENT_BY_ID.get(ids[index]);
    if (!item || item.slot !== slot) return null;
    loadout[slot] = item.id;
  }
  return loadout;
}
