import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EQUIPMENT, equipmentSpriteFor, STARTER_EQUIPPED } from "../app/lumina/equipment.ts";
import { avatarEquipmentLayers, AVATAR_CANVAS, AVATAR_PIXEL_SIZE } from "../app/lumina/avatar-layers.ts";
import { AVATAR_APPEARANCE_KEY, DEFAULT_AVATAR_APPEARANCE, readAvatarAppearance, sanitizeAvatarAppearance } from "../app/lumina/avatar-appearance.ts";
import { AVATAR_SCENERY_KEY, AVATAR_BACKGROUNDS, AVATAR_INTERIORS, defaultAvatarScenery, isBackgroundUnlocked, isInteriorUnlocked, readAvatarScenery, serializeAvatarScenery, unlockedBackgrounds, unlockedInteriors } from "../app/lumina/avatar-scenery.ts";
import { advanceLesson, beginLesson, buyEquipment, checkAnswer, emptySave, equipEquipment, localDay, readSave, selectAnswer, weekDays } from "../app/lumina/minute-engine.ts";
const content = JSON.parse(await readFile(new URL("../data/lumina-minute-lessons.json", import.meta.url), "utf8"));
const { lessons } = content;
const day = "2026-09-28";
function finish(state, lesson, date = day) {
  let result = beginLesson(state, lesson.id, lessons);
  for (const question of lesson.questions) {
    result = selectAnswer(result, question.correctIndex, lessons);
    result = checkAnswer(result, lessons);
    result = advanceLesson(result, lessons, date);
  }
  return result;
}
test("six short lessons use three questions, five choices, and a consolidated source list", () => {
  assert.equal(lessons.length, 6);
  assert.equal(content.referenceSources.length, 7);
  const ids = new Set();
  for (const lesson of lessons) {
    assert.equal(lesson.questions.length, 3);
    assert.ok(lesson.card && lesson.skill);
    for (const q of lesson.questions) {
      assert.ok(!ids.has(q.id)); ids.add(q.id);
      assert.equal(q.options.length, 5);
      assert.ok(q.options[q.correctIndex] && q.rationale && q.examArea);
      assert.ok(q.options.every((o) => o.text && o.feedback));
    }
  }
  for (const source of content.referenceSources) assert.match(source.url, /^https:\/\//);
});
test("the expanded equipment catalog preserves legacy IDs and gives gear tiered original art", () => {
  assert.equal(EQUIPMENT.length, 120);
  assert.equal(new Set(EQUIPMENT.map((item) => item.id)).size, 120);
  assert.equal(EQUIPMENT.filter((item) => item.slot === "weapon").length, 20);
  assert.deepEqual(
    Object.fromEntries(["sword", "staff", "unarmed", "club"].map((style) => [style, EQUIPMENT.filter((item) => item.weaponStyle === style).length])),
    { sword: 6, staff: 6, unarmed: 5, club: 3 },
  );
  assert.equal(EQUIPMENT.find((item) => item.id === "body_common_01")?.name, "布の旅服");
  assert.equal(EQUIPMENT.find((item) => item.id === "body_common_01")?.primary, "#8b745b", "starter cloth should read as humble, undyed fabric on the avatar");
  assert.equal(EQUIPMENT.find((item) => item.id === "weapon_legendary_01")?.name, "灯都の継灯剣");
  const commonBodyArt = EQUIPMENT.filter((item) => item.slot === "body" && item.rarity === "common").map((item) => equipmentSpriteFor(item));
  assert.deepEqual(commonBodyArt.map((sprite) => sprite.cell), [0, 1, 2, 3, 4]);
  assert.ok(commonBodyArt.every((sprite) => sprite.atlas === "body" && sprite.rows === 5));
  const legendarySword = equipmentSpriteFor(EQUIPMENT.find((item) => item.id === "weapon_legendary_01"));
  const starterClub = equipmentSpriteFor(EQUIPMENT.find((item) => item.name === "木の棍棒"));
  assert.equal(legendarySword.atlas, "weapons");
  assert.equal(legendarySword.cell, 6);
  assert.equal(starterClub.atlas, "clubs");
  assert.equal(starterClub.cell, 0);
  const moonHare = EQUIPMENT.find((item) => item.name === "月兎の舞台服");
  assert.equal(moonHare?.art?.atlas, "costumes");
  assert.equal(moonHare?.art?.cell, 1);
  const travelBandana = EQUIPMENT.find((item) => item.name === "旅支度のバンダナ");
  assert.equal(travelBandana?.id, "head_common_04");
  assert.deepEqual(equipmentSpriteFor(travelBandana), { atlas: "bandana", asset: "gear-bandana-v1.png", cell: 0, columns: 1, rows: 1 });
  const starterLegwear = EQUIPMENT.find((item) => item.name === "布のズボン");
  assert.deepEqual(equipmentSpriteFor(starterLegwear), { atlas: "legwear", asset: "gear-legwear-traveler-v2.png", cell: 0, columns: 1, rows: 1 });
});
test("the avatar uses the exact same sprite atlas cell as its equipped collection item", () => {
  assert.equal(AVATAR_CANVAS.width / AVATAR_CANVAS.height, 2 / 3, "the original full-body sprite keeps its 2:3 portrait composition");
  assert.equal(AVATAR_PIXEL_SIZE.width / AVATAR_PIXEL_SIZE.height, 2 / 3, "the compositing canvas preserves the base sprite proportions");
  assert.equal(AVATAR_CANVAS.headCount, 4, "the base is a cute compact pixel character");
  for (const item of EQUIPMENT) {
    const layers = avatarEquipmentLayers({ ...STARTER_EQUIPPED, [item.slot]: item.id });
    const layer = layers.find((entry) => entry.slot === item.slot);
    assert.equal(layer.item.id, item.id);
    assert.deepEqual(layer.sprite, equipmentSpriteFor(item));
    assert.equal(layer.item.id, item.id, `${item.name} must be the rendered item, not just a color approximation`);
    for (const positioned of layers) {
      assert.ok(positioned.anchor.left >= 0 && positioned.anchor.left + positioned.anchor.width <= 100, `${item.name}: ${positioned.slot} layer fits the pixel sprite width`);
      assert.ok(positioned.anchor.top >= 0 && positioned.anchor.top + positioned.anchor.height <= 100, `${item.name}: ${positioned.slot} layer fits the pixel sprite height`);
    }
  }
  const club = EQUIPMENT.find((item) => item.name === "木の棍棒");
  const clubLayer = avatarEquipmentLayers({ ...STARTER_EQUIPPED, weapon: club.id }).find((entry) => entry.slot === "weapon");
  assert.equal(clubLayer.sprite.asset, equipmentSpriteFor(club).asset);
  assert.equal(clubLayer.sprite.cell, equipmentSpriteFor(club).cell);
  assert.ok(clubLayer.anchor.left > 50, "front-facing character's anatomical left hand is on screen-right");
  assert.ok(clubLayer.anchor.top >= 20 && clubLayer.anchor.top < 35, "the club is placed alongside the hand on the pixel character");
  const hands = avatarEquipmentLayers(STARTER_EQUIPPED).filter((entry) => entry.slot === "arms");
  assert.deepEqual(hands.map((entry) => entry.fragment), ["screen-left", "screen-right"]);
  assert.ok(hands[0].anchor.left < 30 && hands[1].anchor.left > 60, "paired hand gear is split onto both open hands");
  assert.ok(hands.every((entry) => entry.anchor.top >= 40 && entry.anchor.top < 55 && entry.anchor.height <= 15), "hand gear stays around the visible hands instead of spreading across the portrait");
  const bandana = EQUIPMENT.find((item) => item.name === "旅支度のバンダナ");
  const bandanaLayer = avatarEquipmentLayers({ ...STARTER_EQUIPPED, head: bandana.id }).find((entry) => entry.slot === "head");
  assert.deepEqual(bandanaLayer.sprite, equipmentSpriteFor(bandana), "the same dedicated bandana art is shared by the collection and avatar");
  assert.equal(bandanaLayer.anchor.z, 14, "headwear is rendered as the top pixel layer over the base character");
  assert.deepEqual(bandanaLayer.anchor, { left: 29, top: 5, width: 42, height: 11, z: 14 }, "the bandana sits along the pixel character's hairline without hiding the face");
  const starterLegwear = EQUIPMENT.find((item) => item.name === "布のズボン");
  const starterLegLayer = avatarEquipmentLayers(STARTER_EQUIPPED).find((entry) => entry.slot === "legs");
  assert.equal(starterLegLayer.item.id, starterLegwear.id);
  assert.deepEqual(starterLegLayer.anchor, { left: 26, top: 51, width: 48, height: 44, z: 3 }, "the same trouser-and-boot art is fit to the pixel character's lower silhouette");
  const metalBoots = EQUIPMENT.find((item) => item.name === "青銅縁のブーツ");
  const bootsLayer = avatarEquipmentLayers({ ...STARTER_EQUIPPED, legs: metalBoots.id }).find((entry) => entry.slot === "legs");
  assert.deepEqual(bootsLayer.anchor, { left: 26, top: 72, width: 48, height: 23, z: 3 }, "boots replace footwear only; they are not stretched from waist to soles");
  const fistWeapon = EQUIPMENT.find((item) => item.weaponStyle === "unarmed");
  assert.ok(fistWeapon);
  const fists = avatarEquipmentLayers({ ...STARTER_EQUIPPED, weapon: fistWeapon.id }).filter((entry) => entry.slot === "weapon");
  assert.deepEqual(fists.map((entry) => entry.fragment), ["screen-left", "screen-right"], "unarmed art belongs on both hands");
});
test("avatar-only art is pixel-composited while collection art and rarity data remain unchanged", async () => {
  const base = await readFile(new URL("../public/assets/lumina/adventurer-pixel-cute-v2.png", import.meta.url));
  assert.equal(base.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(base.readUInt32BE(16), 1024);
  assert.equal(base.readUInt32BE(20), 1536);
  assert.equal(base.readUInt8(25), 6, "the PNG keeps RGBA transparency for clean compositing");

  const [avatar, styles] = await Promise.all([
    readFile(new URL("../app/lumina/EquipmentAvatar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lumina/minute.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(avatar, /getContext\("2d"\)/);
  assert.match(avatar, /imageSmoothingEnabled = true/);
  assert.match(avatar, /drawBaseParts\(context, base/);
  assert.match(avatar, /getImageData\(0, 0, sample.width, sample.height\)/);
  assert.doesNotMatch(avatar, /layer.slot === "head" \? 0\.56/);
  assert.match(styles, /:has\(\.equipmentAvatarCanvas\[data-ready="true"\]\) \.avatarPixelBase \{ visibility: hidden/);
  assert.match(avatar, /data-weapon-rarity=\{weapon\.rarity\}/);
  assert.match(styles, /\.equipmentAvatarCanvas[^\n]*image-rendering: pixelated/);
  assert.match(styles, /\.avatarWeaponSparkles\[data-rarity="legendary"\]/);
  assert.match(styles, /prefers-reduced-motion: reduce[^\n]*avatarWeaponSparkles/);
});
test("backgrounds and interiors unlock from both level and completed story IDs without changing the v4 save", () => {
  const fresh = emptySave();
  assert.equal(fresh.version, 4);
  assert.equal(unlockedBackgrounds(fresh).length, 1);
  assert.equal(unlockedInteriors(fresh).length, 1);
  assert.equal(AVATAR_SCENERY_KEY, "arablo-lumina-scenery-v1");

  const firstChapterStep = finish(fresh, lessons[0]);
  assert.ok(isBackgroundUnlocked("lantern-city", firstChapterStep));
  assert.ok(isInteriorUnlocked("green-workshop", firstChapterStep));
  assert.ok(!isBackgroundUnlocked("violet-city", firstChapterStep));

  const levelFourWithoutSafetyStory = { ...firstChapterStep, completed: ["wishes", "notice", "privacy"] };
  assert.ok(!isInteriorUnlocked("glasshouse", levelFourWithoutSafetyStory), "level alone cannot unlock a room without its story step");

  const complete = lessons.reduce((state, lesson) => finish(state, lesson), fresh);
  assert.equal(complete.version, 4, "the established save version must remain unchanged");
  assert.equal(unlockedBackgrounds(complete).length, AVATAR_BACKGROUNDS.length);
  assert.equal(unlockedInteriors(complete).length, AVATAR_INTERIORS.length);

  const selected = { backgroundId: "beacon-city", interiorId: "beacon-sanctum" };
  const serialized = serializeAvatarScenery(selected, complete);
  assert.deepEqual(readAvatarScenery(serialized, complete), selected);
  assert.deepEqual(readAvatarScenery("{broken", firstChapterStep), defaultAvatarScenery(firstChapterStep));
  assert.deepEqual(readAvatarScenery(JSON.stringify({ version: 1, backgroundId: "beacon-city", interiorId: "beacon-sanctum" }), firstChapterStep), defaultAvatarScenery(firstChapterStep), "locked selections fall back instead of bypassing progression");
  assert.deepEqual(readSave(JSON.stringify(complete), lessons), complete, "scenery is isolated from saved lessons, equipment, coins, and streak days");
});
test("appearance settings are allowlisted and stored separately from learning progress", () => {
  assert.notEqual(AVATAR_APPEARANCE_KEY, "arablo-lumina-minute-v2");
  assert.deepEqual(readAvatarAppearance(null), DEFAULT_AVATAR_APPEARANCE);
  assert.deepEqual(readAvatarAppearance("not-json"), DEFAULT_AVATAR_APPEARANCE);
  const restored = readAvatarAppearance(JSON.stringify({ ...DEFAULT_AVATAR_APPEARANCE, presentation: "feminine", skinTone: "deep", hair: "curly" }));
  assert.equal(restored.presentation, "feminine");
  assert.equal(restored.skinTone, "deep");
  assert.equal(restored.hair, "curly");
  assert.equal(restored.eyeColor, DEFAULT_AVATAR_APPEARANCE.eyeColor);
  assert.equal(restored.faceShape, DEFAULT_AVATAR_APPEARANCE.faceShape);
  assert.equal(restored.mouth, DEFAULT_AVATAR_APPEARANCE.mouth);
  assert.deepEqual(sanitizeAvatarAppearance({ skinTone: "red; background:url(javascript:alert(1))", hair: "<script>" }), DEFAULT_AVATAR_APPEARANCE);
  const progress = { ...emptySave(), coins: 25, activeDays: [day], mistakes: [lessons[0].questions[1].id], session: { lessonId: lessons[0].id, questionIndex: 1, selected: 2, checked: false } };
  const restoredSave = readSave(JSON.stringify(progress), lessons);
  assert.equal(restoredSave.version, 4);
  assert.equal(restoredSave.coins, 25);
  assert.deepEqual(restoredSave.activeDays, [day]);
  assert.deepEqual(restoredSave.mistakes, progress.mistakes);
  assert.deepEqual(restoredSave.session, progress.session, "appearance changes must not migrate or rewrite the current v4 learning save");
});
test("corrupt and old saves fail safely without trusting stored XP or unlocking ahead", () => {
  for (const raw of [null, "{broken", "null", "42", '{"version":1}']) assert.deepEqual(readSave(raw, lessons), emptySave());
  const restored = readSave(JSON.stringify({version:2,completed:["notice","unknown"],xp:9999,activeDays:["2026-02-30",day,day,42],mistakes:["unknown"],session:{lessonId:"notice",questionIndex:0}}), lessons);
  assert.deepEqual(restored.completed, []);
  assert.deepEqual(restored.activeDays, [day]);
  assert.equal(restored.session, null);
});
test("future lesson and invalid answer cannot be selected", () => {
  const state = emptySave();
  assert.equal(beginLesson(state, lessons[1].id, lessons), state);
  const active = beginLesson(state, lessons[0].id, lessons);
  assert.equal(selectAnswer(active, -1, lessons), active);
  assert.equal(selectAnswer(active, 99, lessons), active);
  assert.equal(advanceLesson(active, lessons, day), active);
});
test("wrong choice requires feedback and retry, with no XP or progress", () => {
  let state = beginLesson(emptySave(), lessons[0].id, lessons);
  const wrong = (lessons[0].questions[0].correctIndex + 1) % 3;
  state = checkAnswer(selectAnswer(state, wrong, lessons), lessons);
  assert.deepEqual(state.mistakes, [lessons[0].questions[0].id]);
  assert.equal(state.session.checked, true);
  const retry = advanceLesson(state, lessons, day);
  assert.equal(retry.session.questionIndex, 0);
  assert.equal(retry.session.selected, null);
  assert.deepEqual(retry.completed, []);
  assert.deepEqual(retry.activeDays, []);
});
test("buying and equipping a different body item updates only the selected slot immediately", () => {
  const original = { ...emptySave(), coins: 10 };
  const purchased = buyEquipment(original, "body_common_02");
  assert.equal(purchased.coins, 0);
  assert.ok(purchased.ownedEquipmentIds.includes("body_common_02"));
  assert.equal(original.equippedBySlot.body, "body_common_01");
  const equipped = equipEquipment(purchased, "body_common_02");
  assert.equal(equipped.equippedBySlot.body, "body_common_02");
  assert.equal(equipped.equippedBySlot.weapon, original.equippedBySlot.weapon);
  assert.equal(equipmentSpriteFor(EQUIPMENT.find((item) => item.id === equipped.equippedBySlot.body)).cell, 1);
});
test("all three correct answers and feedback acknowledgements are required", () => {
  let state = beginLesson(emptySave(), lessons[0].id, lessons);
  for (let i = 0; i < 3; i++) {
    const q = lessons[0].questions[i];
    state = selectAnswer(state, q.correctIndex, lessons);
    assert.deepEqual(state.completed, []);
    assert.equal(advanceLesson(state, lessons, day), state);
    state = checkAnswer(state, lessons);
    assert.deepEqual(state.completed, []);
    state = advanceLesson(state, lessons, day);
  }
  assert.deepEqual(state.completed, [lessons[0].id]);
  assert.deepEqual(state.activeDays, [day]);
  assert.equal(state.session, null);
});
test("review cannot farm XP or duplicate dates; resting never removes progress", () => {
  const first = finish(emptySave(), lessons[0]);
  assert.equal(first.coins, 20);
  const replay = finish(first, lessons[0]);
  assert.deepEqual(replay, first);
  const later = finish(replay, lessons[0], "2026-10-04");
  assert.equal(later.completed.length * 30, 30);
  assert.deepEqual(later.activeDays, [day, "2026-10-04"]);
  assert.equal(later.coins, 25);
});
test("every answer and feedback stage survives reload without skipping a question", () => {
  let state = beginLesson(emptySave(), lessons[0].id, lessons);
  for (const question of lessons[0].questions) {
    state = selectAnswer(state, question.correctIndex, lessons);
    assert.deepEqual(readSave(JSON.stringify(state), lessons), state);
    state = checkAnswer(state, lessons);
    assert.deepEqual(readSave(JSON.stringify(state), lessons), state);
    state = advanceLesson(readSave(JSON.stringify(state), lessons), lessons, day);
  }
  assert.equal(state.session, null);
  assert.deepEqual(state.completed, [lessons[0].id]);
});
test("full chapter unlocks sequentially and remains reviewable", () => {
  let state = emptySave();
  for (const lesson of lessons) state = finish(state, lesson);
  assert.equal(state.completed.length, 6);
  assert.equal(state.completed.length * 30, 180);
  assert.ok(state.ownedCosmetics.includes("legend"));
  assert.deepEqual(finish(state, lessons[5]), state);
});
test("local calendar spans month and year boundaries without UTC conversion", () => {
  assert.equal(localDay(new Date(2026,8,28,0,1)), day);
  assert.deepEqual(weekDays(new Date(2026,0,1,0,1)), ["2025-12-29","2025-12-30","2025-12-31","2026-01-01","2026-01-02","2026-01-03","2026-01-04"]);
});
