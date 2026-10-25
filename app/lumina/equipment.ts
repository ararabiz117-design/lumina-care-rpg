export const EQUIPMENT_SLOTS = ["head", "body", "arms", "legs", "shield", "cape", "weapon"] as const;
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];
export type WeaponStyle = "sword" | "staff" | "unarmed" | "club";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type EquipmentArtAtlas = "armor" | "body" | "weapons" | "clubs" | "costumes" | "bandana" | "legwear" | "legacyBase" | "legacyAscended";
export type EquipmentArt = { atlas: EquipmentArtAtlas; cell: number };

export const SLOT_LABEL: Record<EquipmentSlot, string> = {
  head: "頭", body: "胴", arms: "腕", legs: "脚", shield: "盾", cape: "マント", weapon: "武器",
};
export const WEAPON_STYLE_LABEL: Record<WeaponStyle, string> = {
  sword: "剣", staff: "杖", unarmed: "素手・ナックル", club: "棍棒",
};
export const RARITY_LABEL: Record<Rarity, string> = {
  common: "コモン", uncommon: "アンコモン", rare: "レア", epic: "エピック", legendary: "レジェンダリー",
};
export const RARITY_LEVEL: Record<Rarity, number> = {
  common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 7,
};
export const RARITY_PRICE: Record<Rarity, number> = {
  common: 10, uncommon: 20, rare: 35, epic: 55, legendary: 80,
};

export type EquipmentItem = {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  requiredLevel: number;
  price: number;
  primary: string;
  accent: string;
  variant: number;
  weaponStyle?: WeaponStyle;
  art?: EquipmentArt;
  outfitSet?: "moon-hare" | "formal";
  clearReward: boolean;
};

type ItemName = string | { name: string; weaponStyle?: WeaponStyle; art?: EquipmentArt; outfitSet?: EquipmentItem["outfitSet"]; description?: string };
type Batch = { slot: EquipmentSlot; rarity: Rarity; names: ItemName[] };

// All names and designs are original to LUMINA. Tiers reuse a small pixel-art palette,
// while slot glyphs and avatar layers are composed at runtime rather than copied from a franchise.
const batches: Batch[] = [
  { slot: "head", rarity: "common", names: ["粗布の頭巾", "木の葉のフード", "編み紐の帽子", "旅支度のバンダナ"] },
  { slot: "head", rarity: "uncommon", names: ["露玉のフード", "風見の三角帽", "琥珀留めの頭布", "白樺の耳覆い"] },
  { slot: "head", rarity: "rare", names: ["月影の仮面", "翠環の額冠", "雨雲のとんがり帽", "蒼灯の旅兜"] },
  { slot: "head", rarity: "epic", names: ["星紋の冠", "玻璃翼の兜", "深森の儀礼冠"] },
  { slot: "head", rarity: "legendary", names: ["暁光の観測冠"] },

  { slot: "body", rarity: "common", names: ["布の旅服", "継ぎはぎの上着", "草編みのチュニック", "木綿の作業着", "森番の前掛け"] },
  { slot: "body", rarity: "uncommon", names: ["空渡りの青衣", "樹皮織りの胴着", "波紋のベスト", "野営の革上着", "夕焼け染めの服"] },
  { slot: "body", rarity: "rare", names: ["珊瑚光の胴鎧", "霧渡りの外套", "翡翠の守り衣", "星砂の胸当て", "風脈の旅装"] },
  { slot: "body", rarity: "epic", names: ["夜明けの多層衣", "銀河刺繍の胴鎧", "深碧の守護服"] },
  { slot: "body", rarity: "legendary", names: ["灯脈の継承鎧", "七色雲の旅衣"] },

  { slot: "arms", rarity: "common", names: ["布巻きの手袋", "麻糸の手甲", "木こりの籠手", "旅人の手首布"] },
  { slot: "arms", rarity: "uncommon", names: ["若葉の手甲", "琥珀の指ぬき", "波打ち革の籠手", "風切りの腕布"] },
  { slot: "arms", rarity: "rare", names: ["青銅の守り手", "星屑の手甲", "翠玉の籠手", "月白の指守り"] },
  { slot: "arms", rarity: "epic", names: ["暁鐘の腕甲", "玻璃細工の籠手"] },
  { slot: "arms", rarity: "legendary", names: ["灯守の掌甲", "天穹の腕輪"] },

  { slot: "legs", rarity: "common", names: ["布のズボン", "継ぎ当ての脚絆", "麻布の旅袴", "草原歩きの半ズボン"] },
  { slot: "legs", rarity: "uncommon", names: ["木陰の脚絆", "砂浜の歩き靴", "雨よけの長靴", "風車模様の旅袴"] },
  { slot: "legs", rarity: "rare", names: ["青銅縁のブーツ", "星見の脚衣", "霧森の歩み靴", "月影の脛当て"] },
  { slot: "legs", rarity: "epic", names: ["夜渡りの長靴", "銀糸の旅袴"] },
  { slot: "legs", rarity: "legendary", names: ["暁路の踏破靴", "天翔ける脚甲"] },

  { slot: "shield", rarity: "common", names: ["板切れの小盾", "編み枝の盾", "鍋ぶた風の盾"] },
  { slot: "shield", rarity: "uncommon", names: ["木目の丸盾", "葉脈の小盾", "川石飾りの盾"] },
  { slot: "shield", rarity: "rare", names: ["青銅輪の盾", "珊瑚模様の盾", "霧灯の方盾"] },
  { slot: "shield", rarity: "epic", names: ["星環の守護盾", "深碧の大盾"] },
  { slot: "shield", rarity: "legendary", names: ["夜明けを映す盾"] },

  { slot: "cape", rarity: "common", names: ["ほつれ布の肩掛け", "麻の短マント", "旅人の雨よけ"] },
  { slot: "cape", rarity: "uncommon", names: ["珊瑚色の肩マント", "木漏れ日のケープ", "風見の肩布"] },
  { slot: "cape", rarity: "rare", names: ["星砂の外套", "翡翠羽のマント", "薄明の旅ケープ"] },
  { slot: "cape", rarity: "epic", names: ["銀河織りの外套", "群青雲のマント"] },
  { slot: "cape", rarity: "legendary", names: ["灯都の夜空マント"] },

  { slot: "weapon", rarity: "common", names: [
    { name: "木の棍棒", weaponStyle: "club" }, { name: "旅人の短剣", weaponStyle: "sword" },
    { name: "葦穂の杖", weaponStyle: "staff" }, { name: "布巻きの拳", weaponStyle: "unarmed" },
    { name: "枝打ちの木剣", weaponStyle: "sword" }, { name: "野歩きの木杖", weaponStyle: "staff" },
  ] },
  { slot: "weapon", rarity: "uncommon", names: [
    { name: "琥珀刃の小剣", weaponStyle: "sword" }, { name: "風読みの杖", weaponStyle: "staff" },
    { name: "石拳の構え", weaponStyle: "unarmed" }, { name: "翠樹の棍", weaponStyle: "club" },
  ] },
  { slot: "weapon", rarity: "rare", names: [
    { name: "月影の片刃剣", weaponStyle: "sword" }, { name: "透水晶の杖", weaponStyle: "staff" },
    { name: "星屑の拳帯", weaponStyle: "unarmed" }, { name: "青銅継ぎの棍", weaponStyle: "club" },
  ] },
  { slot: "weapon", rarity: "epic", names: [
    { name: "夜明けの長剣", weaponStyle: "sword" }, { name: "星脈の魔杖", weaponStyle: "staff" },
    { name: "夕陽の拳甲", weaponStyle: "unarmed" },
  ] },
  { slot: "weapon", rarity: "legendary", names: [
    { name: "灯都の継灯剣", weaponStyle: "sword" }, { name: "天蓋を指す杖", weaponStyle: "staff" },
    { name: "護り手の掌甲", weaponStyle: "unarmed" },
  ] },

  // Optional, gender-neutral costume pieces. These are original LUMINA art cells.
  // They are appended after the legacy catalog so every existing ID remains stable.
  { slot: "head", rarity: "uncommon", names: [
    { name: "月兎の耳飾り", art: { atlas: "costumes", cell: 0 }, outfitSet: "moon-hare", description: "星灯りの舞台で映える、ふわりとした月兎の耳飾り。" },
    { name: "灯都の案内帽", art: { atlas: "costumes", cell: 4 }, outfitSet: "formal", description: "きちんとした印象に、灯都らしい琥珀の飾りを添えた帽子。" },
  ] },
  { slot: "body", rarity: "rare", names: [
    { name: "月兎の舞台服", art: { atlas: "costumes", cell: 1 }, outfitSet: "moon-hare", description: "長袖と不透明なレギンスを合わせた、動きやすい舞台衣装。" },
    { name: "灯都の仕立てスーツ", art: { atlas: "costumes", cell: 5 }, outfitSet: "formal", description: "深い紺と琥珀色の灯りをあしらった、端正な旅人のスーツ。" },
  ] },
  { slot: "arms", rarity: "uncommon", names: [
    { name: "月兎の白手袋", art: { atlas: "costumes", cell: 2 }, outfitSet: "moon-hare", description: "手元を明るく見せる、金糸の刺繍入り手袋。" },
  ] },
  { slot: "arms", rarity: "rare", names: [
    { name: "灯都の夜会手袋", art: { atlas: "costumes", cell: 6 }, outfitSet: "formal", description: "琥珀色のカフスを添えた、スーツに似合う手袋。" },
  ] },
  { slot: "legs", rarity: "uncommon", names: [
    { name: "月兎のステップブーツ", art: { atlas: "costumes", cell: 3 }, outfitSet: "moon-hare", description: "小さな灯り飾りが揺れる、安定感のある舞台ブーツ。" },
  ] },
  { slot: "legs", rarity: "rare", names: [
    { name: "灯都の仕立て靴", art: { atlas: "costumes", cell: 7 }, outfitSet: "formal", description: "スラックスと一体で見える、磨き上げた旅靴。" },
  ] },
];

const palettes = [
  ["#74895b", "#d4bd79"], ["#698aa0", "#dbe7d2"], ["#bd7968", "#f1d5a2"],
  ["#866fa1", "#d9c5ed"], ["#ae8b4f", "#f3de9b"], ["#567b73", "#b8dbc1"],
  ["#586889", "#c5ccef"], ["#b76676", "#f2c0bd"], ["#8b745b", "#dfc8a4"],
  ["#536c58", "#aecb83"], ["#4e8292", "#9ee0dc"], ["#91634f", "#dfaa74"],
];
const slotIndex: Record<EquipmentSlot, number> = { head: 0, body: 1, arms: 2, legs: 3, shield: 4, cape: 5, weapon: 6 };
const rarityIndex: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const rarityPhrase: Record<Rarity, string> = {
  common: "旅の始まりに似合う", uncommon: "小さな発見を重ねた", rare: "いくつもの学びを越えた",
  epic: "深い知識を結んだ", legendary: "歩みを極めた",
};

let raritySerial: Record<string, number> = {};
export const EQUIPMENT: EquipmentItem[] = batches.flatMap((batch) => batch.names.map((raw, index) => {
  const name = typeof raw === "string" ? raw : raw.name;
  const serialKey = `${batch.slot}_${batch.rarity}`;
  const serial = (raritySerial[serialKey] ?? 0) + 1;
  raritySerial[serialKey] = serial;
  const paletteIndex = (index * 2 + slotIndex[batch.slot] * 3 + rarityIndex[batch.rarity] * 2) % palettes.length;
  // The starter garment should read as inexpensive, unarmored cloth at first glance.
  const palette = batch.slot === "body" && batch.rarity === "common" && index === 0
    ? palettes[8]
    : palettes[paletteIndex];
  return {
    id: `${serialKey}_${String(serial).padStart(2, "0")}`,
    name,
    description: typeof raw === "string" ? `${rarityPhrase[batch.rarity]}${SLOT_LABEL[batch.slot]}の装備。学びを重ねて集めよう。` : raw.description ?? `${rarityPhrase[batch.rarity]}${SLOT_LABEL[batch.slot]}の装備。学びを重ねて集めよう。`,
    slot: batch.slot,
    rarity: batch.rarity,
    requiredLevel: RARITY_LEVEL[batch.rarity],
    price: RARITY_PRICE[batch.rarity],
    primary: palette[0],
    accent: palette[1],
    variant: (index + rarityIndex[batch.rarity]) % 3,
    weaponStyle: typeof raw === "string" ? undefined : raw.weaponStyle,
    art: name === "布のズボン"
      ? { atlas: "legwear", cell: 0 }
      : name === "旅支度のバンダナ"
      ? { atlas: "bandana", cell: 0 }
      : typeof raw === "string" ? undefined : raw.art,
    outfitSet: typeof raw === "string" ? undefined : raw.outfitSet,
    clearReward: false,
  } satisfies EquipmentItem;
}));

// Existing players retain the four original costume rewards when their v3 save is migrated.
export const LEGACY_COSMETIC_ITEM: Record<string, string> = {
  sky: "body_rare_01",
  coral: "cape_uncommon_01",
  legend: "weapon_legendary_01",
};

export const CLEAR_REWARD_IDS = [
  "head_common_02", "body_uncommon_02", "arms_rare_02", "cape_rare_02", "weapon_epic_02", "weapon_legendary_01",
] as const;

for (const item of EQUIPMENT) {
  if (CLEAR_REWARD_IDS.includes(item.id as typeof CLEAR_REWARD_IDS[number])) item.clearReward = true;
}

export const STARTER_EQUIPPED: Record<EquipmentSlot, string> = {
  head: "head_common_01",
  body: "body_common_01",
  arms: "arms_common_01",
  legs: "legs_common_01",
  shield: "shield_common_01",
  cape: "cape_common_01",
  weapon: "weapon_common_01",
};
export const STARTER_ITEM_IDS = [...new Set(Object.values(STARTER_EQUIPPED))];
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((item) => [item.id, item]));
export const EQUIPMENT_BY_SLOT = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [
  slot, EQUIPMENT.filter((item) => item.slot === slot),
])) as Record<EquipmentSlot, EquipmentItem[]>;

// Old API names remain available while existing browser saves and the previous prototype age out.
export type CosmeticId = "starter" | "sky" | "coral" | "legend";
export const COSMETICS: { id: CosmeticId; name: string; description: string; price: number }[] = [
  { id: "starter", name: "森の旅装", description: "冒険のはじまりの服", price: 0 },
  { id: "sky", name: "空色のコート", description: "ひとつ学んだ日の記念に", price: 35 },
  { id: "coral", name: "珊瑚のマント", description: "歩みを重ねた旅人の装い", price: 60 },
  { id: "legend", name: "伝説の剣", description: "この章を踏破した記念。剣は鞘に収めたまま。", price: 0 },
];

if (EQUIPMENT.length !== 120 || new Set(EQUIPMENT.map(({ id }) => id)).size !== EQUIPMENT.length) {
  throw new Error("LUMINA equipment catalog must have 120 unique item IDs.");
}

const SPRITE_ASSETS: Record<EquipmentArtAtlas, string> = {
  armor: "gear-armor-original-v1.png",
  body: "gear-body-tiers-v1.png",
  weapons: "gear-weapons-v1.png",
  clubs: "gear-clubs-v1.png",
  costumes: "gear-costumes-v1.png",
  bandana: "gear-bandana-v1.png",
  legwear: "gear-legwear-traveler-v2.png",
  legacyBase: "gear-sprites-v1.png",
  legacyAscended: "gear-sprites-ascended-v1.png",
};
export type EquipmentSprite = { atlas: EquipmentArtAtlas; asset: string; cell: number; columns: number; rows: number };

/** Resolve art from item identity without adding any presentation state to player saves. */
export function equipmentSpriteFor(item: EquipmentItem): EquipmentSprite {
  const grids = { armor: [5, 4], body: [5, 5], weapons: [3, 3], clubs: [5, 1], costumes: [4, 2], bandana: [1, 1], legwear: [1, 1], legacyBase: [5, 2], legacyAscended: [5, 2] } as const;
  const sprite = (atlas: EquipmentArtAtlas, cell: number): EquipmentSprite => {
    const [columns, rows] = grids[atlas];
    return { atlas, asset: SPRITE_ASSETS[atlas], cell, columns, rows };
  };
  if (item.art) return sprite(item.art.atlas, item.art.cell);
  const serial = Math.max(1, Number(item.id.match(/_(\d+)$/)?.[1] ?? 1)) - 1;
  const rarity = rarityIndex[item.rarity];
  if (item.slot === "body") return sprite("body", rarity * 5 + (serial % 5));
  if (item.slot === "weapon") {
    if (item.weaponStyle === "club") return sprite("clubs", Math.min(4, rarity));
    const column = { sword: 0, staff: 1, unarmed: 2, club: 0 }[item.weaponStyle ?? "club"];
    const row = [0, 1, 1, 2, 2][rarity];
    return sprite("weapons", row * 3 + column);
  }
  if (item.slot === "head") {
    const range = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 4]][rarity];
    const cell = Math.min(range[1], range[0] + (serial % (range[1] - range[0] + 1)));
    return sprite("armor", cell);
  }
  if (item.slot === "arms") return sprite("armor", 10 + Math.min(2, rarity + serial % 2));
  if (item.slot === "legs") {
    if (rarity >= 4) return sprite("legacyAscended", 3);
    return sprite("armor", rarity >= 2 ? 14 : 13);
  }
  if (item.slot === "shield") {
    const baseCell = 15 + Math.min(3, rarity);
    return sprite("armor", Math.min(18, baseCell + Number(serial > 0 && rarity < 2)));
  }
  if (rarity >= 2) return sprite("legacyAscended", 5);
  if (rarity === 1) return sprite("legacyBase", 5);
  return sprite("armor", 19);
}
