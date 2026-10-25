import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dailyLesson } from "../app/lumina/daily-lesson.ts";
import { emptySave, beginLesson, selectAnswer, checkAnswer, advanceLesson, readSave } from "../app/lumina/minute-engine.ts";
const { lessons } = JSON.parse(await readFile(new URL("../data/lumina-minute-lessons.json", import.meta.url)));
test("graduated practice varies across days and prioritizes weak areas", () => {
  const save = { ...emptySave(), completed: lessons.map((lesson) => lesson.id) };
  assert.notEqual(dailyLesson(save, lessons, "2026-10-11").id, dailyLesson(save, lessons, "2026-10-12").id);
  save.mistakes = [lessons[2].questions[0].id];
  assert.equal(dailyLesson(save, lessons, "2026-10-11").id, lessons[2].id);
  assert.equal(dailyLesson(emptySave(), lessons, "2026-10-11").id, lessons[0].id);
});
test("immediate retry does not erase weakness; a fresh correct review does", () => {
  const lesson = lessons[0], q = lesson.questions[0];
  let save = beginLesson(emptySave(), lesson.id, lessons);
  save = checkAnswer(selectAnswer(save, (q.correctIndex + 1) % q.options.length, lessons), lessons);
  save = readSave(JSON.stringify(save), lessons);
  save = advanceLesson(save, lessons, "2026-10-11");
  save = checkAnswer(selectAnswer(save, q.correctIndex, lessons), lessons);
  assert.ok(save.mistakes.includes(q.id));
  save = advanceLesson(save, lessons, "2026-10-11");
  assert.equal(save.session.hadMistake, undefined);
  save = beginLesson({ ...save, session: null }, lesson.id, lessons);
  save = checkAnswer(selectAnswer(save, q.correctIndex, lessons), lessons);
  assert.ok(!save.mistakes.includes(q.id));
});
