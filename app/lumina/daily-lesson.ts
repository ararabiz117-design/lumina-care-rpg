import type { JourneySave, Lesson } from "./minute-engine.ts";

/** Unfinished chapters first; after graduation vary the daily practice deterministically. */
export function dailyLesson(save: JourneySave, lessons: Lesson[], day: string): Lesson {
  if (!lessons.length) throw new Error("LUMINA needs at least one lesson");
  const unfinished = lessons.find((lesson) => !save.completed.includes(lesson.id));
  if (unfinished) return unfinished;
  const weak = lessons.filter((lesson) => lesson.questions.some((q) => save.mistakes.includes(q.id)));
  const pool = weak.length ? weak : lessons;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(`${day}T00:00:00Z`) : 0;
  const index = Number.isFinite(date) ? Math.abs(Math.floor(date / 86400000)) % pool.length : 0;
  return pool[index];
}
