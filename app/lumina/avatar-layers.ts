import { EQUIPMENT_BY_ID, EQUIPMENT_SLOTS, equipmentSpriteFor, STARTER_EQUIPPED, type EquipmentItem, type EquipmentSlot, type EquipmentSprite } from "./equipment.ts";
import type { EquipmentLoadout } from "./minute-engine.ts";

export const AVATAR_CANVAS = { width: 1024, height: 1536, headCount: 4 } as const;
export const AVATAR_PIXEL_SIZE = { width: 128, height: 192 } as const;
export type AvatarLayerAnchor = { left: number; top: number; width: number; height: number; z: number; rotate?: number };
export type AvatarEquipmentLayer = { slot: EquipmentSlot; item: EquipmentItem; sprite: EquipmentSprite; anchor: AvatarLayerAnchor; fragment?: "screen-left" | "screen-right" };

// The full-body, transparent pixel-art base is 2:3. These anchors follow its
// shoulders, waist, open hands and boots rather than the old SVG mannequin.
const ANCHORS: Record<EquipmentSlot, AvatarLayerAnchor> = {
  cape: { left: 16, top: 29, width: 68, height: 47, z: 1 },
  legs: { left: 26, top: 51, width: 48, height: 44, z: 3 },
  body: { left: 27, top: 29, width: 46, height: 28, z: 5 },
  arms: { left: 20, top: 53, width: 14, height: 12, z: 6 },
  head: { left: 29, top: 3, width: 42, height: 15, z: 14 },
  shield: { left: 8, top: 50, width: 27, height: 24, z: 9 },
  weapon: { left: 74, top: 30, width: 22, height: 33, z: 10 },
};

const WEAPON_ANCHORS = {
  sword: { left: 72, top: 24, width: 25, height: 38, z: 10, rotate: 0 },
  staff: { left: 74, top: 20, width: 20, height: 42, z: 10, rotate: 0 },
  club: { left: 74, top: 30, width: 22, height: 33, z: 10, rotate: 0 },
} as const;

const HAND_ANCHORS = [
  { fragment: "screen-left" as const, anchor: { left: 20, top: 53, width: 14, height: 12, z: 6 } },
  { fragment: "screen-right" as const, anchor: { left: 68, top: 53, width: 14, height: 12, z: 6 } },
];

export function avatarEquipmentLayers(loadout: EquipmentLoadout): AvatarEquipmentLayer[] {
  const layers: AvatarEquipmentLayer[] = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const item = EQUIPMENT_BY_ID.get(loadout[slot]) ?? EQUIPMENT_BY_ID.get(STARTER_EQUIPPED[slot])!;
    const sprite = equipmentSpriteFor(item);
    if (slot === "arms") {
      for (const { fragment, anchor } of HAND_ANCHORS) layers.push({ slot, item, sprite, anchor, fragment });
      continue;
    }
    if (slot === "weapon" && item.weaponStyle === "unarmed") {
      for (const { fragment, anchor } of HAND_ANCHORS) {
        layers.push({ slot, item, sprite, anchor: { ...anchor, z: 10 }, fragment });
      }
      continue;
    }
    layers.push({
      slot,
      item,
      sprite,
      anchor: slot === "legs"
        ? sprite.atlas === "legacyAscended" || (sprite.atlas === "armor" && sprite.cell === 14) || (sprite.atlas === "costumes" && sprite.cell === 3)
          ? { left: 26, top: 72, width: 48, height: 23, z: 3 }
          : ANCHORS.legs
      : slot === "weapon"
        ? item.weaponStyle === "unarmed" ? ANCHORS.weapon : WEAPON_ANCHORS[item.weaponStyle ?? "club"]
        : slot === "head" && item.id === "head_common_04"
          ? { left: 29, top: 5, width: 42, height: 11, z: 14 }
        : slot === "head" && sprite.atlas === "armor" && sprite.cell === 1
          ? { left: 27, top: 3, width: 46, height: 27, z: 14 }
        : ANCHORS[slot],
    });
  }
  return layers.sort((a, b) => a.anchor.z - b.anchor.z);
}
