import { EQUIPMENT_BY_ID, EQUIPMENT_SLOTS, STARTER_EQUIPPED, type EquipmentItem, type EquipmentSlot } from "./equipment.ts";
import { equipEquipment, type EquipmentLoadout, type JourneySave } from "./minute-engine.ts";

export type PreviewBySlot = Partial<EquipmentLoadout>;

function validForSlot(id: unknown, slot: EquipmentSlot): id is string {
  return typeof id === "string" && EQUIPMENT_BY_ID.get(id)?.slot === slot;
}

/** Invalid preview selections fall back to the current equipment, then starters. */
export function resolveFitting(base: EquipmentLoadout, preview: PreviewBySlot): EquipmentLoadout {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot,
    validForSlot(preview[slot], slot) ? preview[slot]
      : validForSlot(base[slot], slot) ? base[slot] : STARTER_EQUIPPED[slot],
  ])) as EquipmentLoadout;
}

/** Each slot is independent; choosing its current preview clears only that slot. */
export function toggleFitting(preview: PreviewBySlot, item: EquipmentItem): PreviewBySlot {
  if (!validForSlot(item.id, item.slot)) return preview;
  const next = { ...preview };
  if (next[item.slot] === item.id) delete next[item.slot];
  else next[item.slot] = item.id;
  return next;
}

/** An outfit is applied atomically, without buying or granting any equipment. */
export function applyOwnedFitting(save: JourneySave, preview: PreviewBySlot): JourneySave {
  const selections = Object.entries(preview);
  if (selections.some(([slot, id]) => !EQUIPMENT_SLOTS.includes(slot as EquipmentSlot)
    || !validForSlot(id, slot as EquipmentSlot) || !save.ownedEquipmentIds.includes(id))) return save;
  return selections.reduce((current, [, id]) => equipEquipment(current, id), save);
}
