import assert from "node:assert/strict";
import test from "node:test";
import { EQUIPMENT, EQUIPMENT_SLOTS, STARTER_EQUIPPED } from "../app/lumina/equipment.ts";
import { emptySave, playerLevel } from "../app/lumina/minute-engine.ts";
import { applyOwnedFitting, resolveFitting, toggleFitting } from "../app/lumina/fitting-engine.ts";

const choices = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot,
  EQUIPMENT.find((item) => item.slot === slot && item.id !== STARTER_EQUIPPED[slot]),
]));
const completePreview = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, choices[slot].id]));

test("seven slot previews accumulate independently without changing the base", () => {
  const base = { ...STARTER_EQUIPPED };
  let preview = {};
  for (const slot of EQUIPMENT_SLOTS) preview = toggleFitting(preview, choices[slot]);
  assert.deepEqual(preview, completePreview);
  assert.deepEqual(resolveFitting(base, preview), completePreview);
  assert.deepEqual(base, STARTER_EQUIPPED);
});

test("toggling one slot restores its base and preserves the other six previews", () => {
  const original = { ...completePreview };
  const next = toggleFitting(original, choices.body);
  assert.equal(next.body, undefined);
  assert.equal(resolveFitting(STARTER_EQUIPPED, next).body, STARTER_EQUIPPED.body);
  for (const slot of EQUIPMENT_SLOTS.filter((slot) => slot !== "body")) assert.equal(next[slot], original[slot]);
  assert.deepEqual(original, completePreview);
});

test("invalid IDs and cross-slot selections fall back safely and cannot be applied", () => {
  const save = emptySave();
  const invalid = { head: "missing", body: STARTER_EQUIPPED.head };
  assert.deepEqual(resolveFitting(save.equippedBySlot, invalid), STARTER_EQUIPPED);
  assert.equal(applyOwnedFitting(save, invalid), save);
  assert.equal(applyOwnedFitting(save, { unexpected: STARTER_EQUIPPED.head }), save);
  assert.deepEqual(resolveFitting({ ...save.equippedBySlot, head: "missing" }, {}), STARTER_EQUIPPED);
  assert.equal(toggleFitting(invalid, { ...choices.head, id: "missing" }), invalid);
});

test("one unowned selection prevents the entire outfit from being applied", () => {
  const save = emptySave();
  save.ownedEquipmentIds.push(choices.head.id);
  const snapshot = structuredClone(save);
  assert.equal(applyOwnedFitting(save, { head: choices.head.id, body: choices.body.id }), save);
  assert.deepEqual(save, snapshot);
});

test("owned outfits apply all seven slots without purchases, XP, or learning changes", () => {
  const save = { ...emptySave(), coins: 91, completed: ["wishes"], activeDays: ["2026-10-11"],
    mistakes: ["wishes-1"], session: { lessonId: "wishes", questionIndex: 1, selected: null, checked: false } };
  save.ownedEquipmentIds.push(...Object.values(completePreview));
  const snapshot = structuredClone(save);
  const result = applyOwnedFitting(save, completePreview);
  assert.deepEqual(result.equippedBySlot, completePreview);
  for (const key of ["coins", "completed", "activeDays", "mistakes", "session", "ownedEquipmentIds", "claimedDayMilestones"])
    assert.deepEqual(result[key], snapshot[key]);
  assert.equal(playerLevel(result), playerLevel(save));
  assert.deepEqual(save, snapshot);
  assert.equal(applyOwnedFitting(save, {}), save);
});
