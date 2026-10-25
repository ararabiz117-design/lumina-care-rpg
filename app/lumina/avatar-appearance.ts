export const AVATAR_APPEARANCE_KEY = "arablo-lumina-avatar-v1";
const AVATAR_APPEARANCE_CHANGED = "lumina-avatar-appearance-changed";

export const DEFAULT_AVATAR_APPEARANCE = {
  presentation: "neutral",
  skinTone: "warm",
  eyes: "soft",
  eyeColor: "hazel",
  nose: "defined",
  faceShape: "angular",
  mouth: "neutral",
  hair: "layered",
  hairColor: "chestnut",
} as const;
const DEFAULT_APPEARANCE_RAW = JSON.stringify(DEFAULT_AVATAR_APPEARANCE);

export type AvatarAppearance = {
  presentation: "neutral" | "masculine" | "feminine";
  skinTone: "fair" | "warm" | "olive" | "brown" | "deep";
  eyes: "round" | "soft" | "narrow";
  eyeColor: "slate" | "hazel" | "moss" | "amber" | "violet";
  nose: "subtle" | "soft" | "defined";
  faceShape: "oval" | "soft" | "angular";
  mouth: "neutral" | "gentle" | "determined";
  hair: "short" | "bob" | "long" | "curly" | "tied" | "layered";
  hairColor: "black" | "chestnut" | "ash" | "silver" | "teal" | "rose";
};

export const AVATAR_OPTIONS = {
  presentation: [
    { value: "neutral", label: "中性的" },
    { value: "masculine", label: "男性的" },
    { value: "feminine", label: "女性的" },
  ],
  skinTone: [
    { value: "fair", label: "明るめ", color: "#f3d8c5" },
    { value: "warm", label: "あたたか", color: "#e9b98f" },
    { value: "olive", label: "オリーブ", color: "#c9966c" },
    { value: "brown", label: "ブラウン", color: "#966447" },
    { value: "deep", label: "深み", color: "#603c32" },
  ],
  eyes: [
    { value: "round", label: "まるい" },
    { value: "soft", label: "やさしい" },
    { value: "narrow", label: "すっきり" },
  ],
  eyeColor: [
    { value: "slate", label: "青灰" , color: "#596f78" },
    { value: "hazel", label: "ヘーゼル", color: "#91683b" },
    { value: "moss", label: "苔色", color: "#547b58" },
    { value: "amber", label: "琥珀", color: "#bd8241" },
    { value: "violet", label: "菫色", color: "#786287" },
  ],
  nose: [
    { value: "subtle", label: "控えめ" },
    { value: "soft", label: "やわらか" },
    { value: "defined", label: "くっきり" },
  ],
  faceShape: [
    { value: "oval", label: "卵型" },
    { value: "soft", label: "やわらか" },
    { value: "angular", label: "シャープ" },
  ],
  mouth: [
    { value: "neutral", label: "自然" },
    { value: "gentle", label: "穏やか" },
    { value: "determined", label: "意志的" },
  ],
  hair: [
    { value: "short", label: "ショート" },
    { value: "bob", label: "ボブ" },
    { value: "long", label: "ロング" },
    { value: "curly", label: "くせ毛" },
    { value: "tied", label: "まとめ髪" },
    { value: "layered", label: "レイヤー" },
  ],
  hairColor: [
    { value: "black", label: "黒髪", color: "#332d32" },
    { value: "chestnut", label: "栗色", color: "#60483b" },
    { value: "ash", label: "アッシュ", color: "#b8aa91" },
    { value: "silver", label: "銀色", color: "#aeb6c0" },
    { value: "teal", label: "青緑", color: "#347d78" },
    { value: "rose", label: "紅茶色", color: "#a95670" },
  ],
} as const;

const allowed = {
  presentation: new Set(["neutral", "masculine", "feminine"]),
  skinTone: new Set(["fair", "warm", "olive", "brown", "deep"]),
  eyes: new Set(["round", "soft", "narrow"]),
  eyeColor: new Set(["slate", "hazel", "moss", "amber", "violet"]),
  nose: new Set(["subtle", "soft", "defined"]),
  faceShape: new Set(["oval", "soft", "angular"]),
  mouth: new Set(["neutral", "gentle", "determined"]),
  hair: new Set(["short", "bob", "long", "curly", "tied", "layered"]),
  hairColor: new Set(["black", "chestnut", "ash", "silver", "teal", "rose"]),
} as const;

function pick<K extends keyof AvatarAppearance>(value: unknown, key: K): AvatarAppearance[K] {
  return (typeof value === "string" && allowed[key].has(value)
    ? value
    : DEFAULT_AVATAR_APPEARANCE[key]) as AvatarAppearance[K];
}

/** Strict allowlist parsing: stored values can never become CSS, SVG, or HTML. */
export function sanitizeAvatarAppearance(value: unknown): AvatarAppearance {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    presentation: pick(source.presentation, "presentation"),
    skinTone: pick(source.skinTone, "skinTone"),
    eyes: pick(source.eyes, "eyes"),
    eyeColor: pick(source.eyeColor, "eyeColor"),
    nose: pick(source.nose, "nose"),
    faceShape: pick(source.faceShape, "faceShape"),
    mouth: pick(source.mouth, "mouth"),
    hair: pick(source.hair, "hair"),
    hairColor: pick(source.hairColor, "hairColor"),
  };
}

export function readAvatarAppearance(raw: string | null): AvatarAppearance {
  if (!raw) return { ...DEFAULT_AVATAR_APPEARANCE };
  try {
    return sanitizeAvatarAppearance(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AVATAR_APPEARANCE };
  }
}

export function subscribeAvatarAppearance(onChange: () => void): () => void {
  const notify = () => onChange();
  window.addEventListener(AVATAR_APPEARANCE_CHANGED, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(AVATAR_APPEARANCE_CHANGED, notify);
    window.removeEventListener("storage", notify);
  };
}

export function getAvatarAppearanceSnapshot(): string {
  try { return window.localStorage.getItem(AVATAR_APPEARANCE_KEY) ?? DEFAULT_APPEARANCE_RAW; }
  catch { return DEFAULT_APPEARANCE_RAW; }
}

export function getServerAvatarAppearanceSnapshot(): string {
  return DEFAULT_APPEARANCE_RAW;
}

export function persistAvatarAppearance(value: AvatarAppearance): void {
  const normalized = sanitizeAvatarAppearance(value);
  window.localStorage.setItem(AVATAR_APPEARANCE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(AVATAR_APPEARANCE_CHANGED));
}
