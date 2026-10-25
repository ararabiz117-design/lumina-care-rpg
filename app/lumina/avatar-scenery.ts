import { playerLevel, type JourneySave } from "./minute-engine.ts";

export const AVATAR_SCENERY_KEY = "arablo-lumina-scenery-v1";

type UnlockRule = {
  requiredLevel: number;
  requiredLessonId: string | null;
};

export const AVATAR_BACKGROUNDS = [
  {
    id: "first-garden",
    name: "旅立ちの庭",
    description: "若葉の街から、最初の一歩へ。",
    asset: "minute-garden.webp",
    unlock: { requiredLevel: 1, requiredLessonId: null },
  },
  {
    id: "lantern-city",
    name: "灯都の夕景",
    description: "街に灯りがともる、旅のはじまり。",
    asset: "lumina-city-dusk.png",
    unlock: { requiredLevel: 2, requiredLessonId: "wishes" },
  },
  {
    id: "violet-city",
    name: "宵影の街",
    description: "夕闇のなかに、青紫の光が浮かぶ。",
    asset: "lumina-city-dusk.png",
    unlock: { requiredLevel: 3, requiredLessonId: "notice" },
  },
  {
    id: "moonlit-city",
    name: "星影の水都",
    description: "深い夜の水辺に、星の道がひらく。",
    asset: "lumina-city-dusk.png",
    unlock: { requiredLevel: 5, requiredLessonId: "privacy" },
  },
  {
    id: "beacon-city",
    name: "継灯の夜明け",
    description: "積み重ねた学びが、街の灯りになる。",
    asset: "lumina-city-dusk.png",
    unlock: { requiredLevel: 7, requiredLessonId: "connect" },
  },
] as const satisfies readonly { id: string; name: string; description: string; asset: string; unlock: UnlockRule }[];

export const AVATAR_INTERIORS = [
  {
    id: "traveler-room",
    name: "旅立ちの部屋",
    description: "木の机とランタン。道具を整える小さな部屋。",
    unlock: { requiredLevel: 1, requiredLessonId: null },
  },
  {
    id: "green-workshop",
    name: "芽吹きの工房",
    description: "草花と木漏れ日に包まれた支度部屋。",
    unlock: { requiredLevel: 2, requiredLessonId: "wishes" },
  },
  {
    id: "twilight-gallery",
    name: "黄昏の回廊",
    description: "夕映えが差し込む、静かな石造りの回廊。",
    unlock: { requiredLevel: 3, requiredLessonId: "notice" },
  },
  {
    id: "glasshouse",
    name: "青緑の温室",
    description: "水晶の窓から、深い青緑の光が満ちる。",
    unlock: { requiredLevel: 4, requiredLessonId: "safety" },
  },
  {
    id: "mist-library",
    name: "星霧の書庫",
    description: "静けさの奥で、星図がゆっくり輝く。",
    unlock: { requiredLevel: 5, requiredLessonId: "privacy" },
  },
  {
    id: "moon-observatory",
    name: "月環の天文室",
    description: "月の軌道を映す、夜の観測室。",
    unlock: { requiredLevel: 6, requiredLessonId: "listen" },
  },
  {
    id: "beacon-sanctum",
    name: "灯脈の聖域",
    description: "旅の記憶を結ぶ、光の最奥。",
    unlock: { requiredLevel: 7, requiredLessonId: "connect" },
  },
] as const satisfies readonly { id: string; name: string; description: string; unlock: UnlockRule }[];

export type AvatarBackgroundId = typeof AVATAR_BACKGROUNDS[number]["id"];
export type AvatarInteriorId = typeof AVATAR_INTERIORS[number]["id"];
export type AvatarScenerySelection = {
  backgroundId: AvatarBackgroundId;
  interiorId: AvatarInteriorId;
};

export const DEFAULT_AVATAR_SCENERY: AvatarScenerySelection = {
  backgroundId: AVATAR_BACKGROUNDS[0].id,
  interiorId: AVATAR_INTERIORS[0].id,
};

function isUnlocked(rule: UnlockRule, save: JourneySave): boolean {
  return playerLevel(save) >= rule.requiredLevel
    && (rule.requiredLessonId === null || save.completed.includes(rule.requiredLessonId));
}

export function isBackgroundUnlocked(id: string, save: JourneySave): boolean {
  const background = AVATAR_BACKGROUNDS.find((item) => item.id === id);
  return !!background && isUnlocked(background.unlock, save);
}

export function isInteriorUnlocked(id: string, save: JourneySave): boolean {
  const interior = AVATAR_INTERIORS.find((item) => item.id === id);
  return !!interior && isUnlocked(interior.unlock, save);
}

export function unlockedBackgrounds(save: JourneySave) {
  return AVATAR_BACKGROUNDS.filter((item) => isUnlocked(item.unlock, save));
}

export function unlockedInteriors(save: JourneySave) {
  return AVATAR_INTERIORS.filter((item) => isUnlocked(item.unlock, save));
}

function newestUnlockedId<T extends { id: string; unlock: UnlockRule }>(items: readonly T[], save: JourneySave): string {
  return [...items].reverse().find((item) => isUnlocked(item.unlock, save))?.id ?? items[0].id;
}

export function defaultAvatarScenery(save: JourneySave): AvatarScenerySelection {
  return {
    backgroundId: newestUnlockedId(AVATAR_BACKGROUNDS, save) as AvatarBackgroundId,
    interiorId: newestUnlockedId(AVATAR_INTERIORS, save) as AvatarInteriorId,
  };
}

export function readAvatarScenery(raw: string | null, save: JourneySave): AvatarScenerySelection {
  const fallback = defaultAvatarScenery(save);
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as { version?: unknown; backgroundId?: unknown; interiorId?: unknown };
    if (!value || value.version !== 1) return fallback;
    return {
      backgroundId: typeof value.backgroundId === "string" && isBackgroundUnlocked(value.backgroundId, save)
        ? value.backgroundId as AvatarBackgroundId
        : fallback.backgroundId,
      interiorId: typeof value.interiorId === "string" && isInteriorUnlocked(value.interiorId, save)
        ? value.interiorId as AvatarInteriorId
        : fallback.interiorId,
    };
  } catch {
    return fallback;
  }
}

export function serializeAvatarScenery(selection: AvatarScenerySelection, save: JourneySave): string {
  const fallback = defaultAvatarScenery(save);
  const safeSelection = {
    backgroundId: isBackgroundUnlocked(selection.backgroundId, save) ? selection.backgroundId : fallback.backgroundId,
    interiorId: isInteriorUnlocked(selection.interiorId, save) ? selection.interiorId : fallback.interiorId,
  };
  return JSON.stringify({ version: 1, ...safeSelection });
}
