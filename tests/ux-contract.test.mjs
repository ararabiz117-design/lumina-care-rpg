import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../app/lumina/MinuteJourney.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/lumina/minute.module.css', import.meta.url), 'utf8');
const status = readFileSync(new URL('../app/lumina/CharacterStatus.tsx', import.meta.url), 'utf8');
const appearance = readFileSync(new URL('../app/lumina/AvatarAppearanceEditor.tsx', import.meta.url), 'utf8');

test('game storage uses account-scoped storage rather than the raw browser store', () => {
  assert.match(game, /import \{ appStorage \} from "\.\.\/\.\.\/src\/cloud-storage"/);
  assert.doesNotMatch(game, /\blocalStorage\./);
  for (const key of ['SAVE_KEY', 'STATS_KEY', 'AVATAR_SCENERY_KEY', 'THEME_STORAGE_KEY']) {
    assert.match(game, new RegExp(`appStorage\\.getItem\\(${key}\\)`));
    assert.match(game, new RegExp(`appStorage\\.setItem\\(${key},`));
  }
});

test('each screen boundary is keyed to its view and uses actual image completion', () => {
  assert.match(game, /<ScreenSurface key=\{tab\} view=\{tab\}>/);
  assert.match(game, /key="showcase" view="showcase"/);
  assert.match(game, /key="reward" view="reward"/);
  assert.match(game, /key=\{`lesson:\$\{question\.id\}`\}/);
  assert.match(game, /image\.complete \? Promise\.resolve\(\)/);
  assert.match(game, /image\.addEventListener\("load", finish/);
  assert.match(game, /image\.addEventListener\("error", finish/);
  const boundary = game.slice(game.indexOf('function ScreenSurface'), game.indexOf('const tabs:'));
  assert.doesNotMatch(boundary, /setTimeout/);
  assert.match(boundary, /cancelled = true/);
  assert.match(boundary, /inert=\{loading\}/);
});

test('functional labels replace marketing copy and blog links while safety references remain', () => {
  const text = game + status + appearance;
  for (const copy of ['SMALL STEPS', 'CARE LEARNING ADVENTURE', 'YOUR ADVENTURER', 'YOUR JOURNEY', 'ONE SMALL STEP', 'あらブログへ', '登録なし', 'ログイン、広告']) {
    assert.equal(text.includes(copy), false, copy);
  }
  assert.match(game, /参考資料一覧/);
  assert.match(game, /実技や医療・介護判断の代わりにはなりません/);
  assert.match(game, /国家試験と同等の難易度や全範囲を保証するものではありません/);
});

test('motion is purposeful, keyboard focus is restored, and reduced motion is respected', () => {
  assert.match(game, /requestAnimationFrame/);
  assert.match(game, /querySelector<HTMLElement>\("h1\[tabindex='-1'\]"\)\?\.focus/);
  for (const animation of ['skeletonSweep', 'navSelect', 'answerSelect', 'feedbackArrive', 'rewardReveal', 'rewardCardReveal']) {
    assert.match(css, new RegExp(`@keyframes ${animation}`));
  }
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important; transition: none !important/);
});
