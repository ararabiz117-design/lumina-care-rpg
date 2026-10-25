import { AVATAR_BACKGROUNDS, AVATAR_INTERIORS, isBackgroundUnlocked, isInteriorUnlocked, type AvatarBackgroundId, type AvatarInteriorId, unlockedBackgrounds, unlockedInteriors } from "./avatar-scenery";
import { EQUIPMENT_BY_ID, EQUIPMENT_SLOTS, SLOT_LABEL, type EquipmentSlot } from "./equipment";
import { playerLevel, type JourneySave, XP_PER_LESSON } from "./minute-engine";
import { EquipmentAvatar, EquipmentGlyph } from "./EquipmentAvatar";
import s from "./minute.module.css";

const LESSON_TITLES: Record<string, string> = {
  wishes: "願いを聞こう",
  notice: "気づきを届けよう",
  safety: "通り道を見てみよう",
  privacy: "仲間と守る情報",
  listen: "話しやすさをつくろう",
  connect: "次の人につなごう",
};

function unlockCaption(requiredLevel: number, requiredLessonId: string | null): string {
  if (!requiredLessonId) return `Lv.${requiredLevel}で解放`;
  return `Lv.${requiredLevel} ＋「${LESSON_TITLES[requiredLessonId] ?? "物語の一歩"}」クリア`;
}

export function CharacterStatus({
  save, xp, streak, backgroundId, interiorId,
  onBackground, onInterior, onOpenSlot, onShare, sceneryStorageProblem,
}: {
  save: JourneySave;
  xp: number;
  streak: number;
  backgroundId: AvatarBackgroundId;
  interiorId: AvatarInteriorId;
  onBackground: (id: AvatarBackgroundId) => void;
  onInterior: (id: AvatarInteriorId) => void;
  onOpenSlot: (slot: EquipmentSlot) => void;
  onShare: () => void;
  sceneryStorageProblem: boolean;
}) {
  const level = playerLevel(save);
  const currentBackground = AVATAR_BACKGROUNDS.find((item) => item.id === backgroundId) ?? AVATAR_BACKGROUNDS[0];
  const currentInterior = AVATAR_INTERIORS.find((item) => item.id === interiorId) ?? AVATAR_INTERIORS[0];
  const backgroundCount = unlockedBackgrounds(save).length;
  const interiorCount = unlockedInteriors(save).length;
  const nextLevelXp = XP_PER_LESSON - (xp % XP_PER_LESSON);
  const progressPercent = (xp % XP_PER_LESSON) / XP_PER_LESSON * 100;

  return <section className={`${s.tabContent} ${s.characterStatus}`} aria-labelledby="status-heading">
    <header className={s.statusHeader}>
      <div><h1 id="status-heading">ステータス</h1></div>
      <span className={s.statusLevelBadge}>Lv. <strong>{level}</strong></span>
    </header>

    <section className={s.characterStage} data-background={backgroundId} data-interior={interiorId} aria-label={`現在の旅人。背景は${currentBackground.name}、部屋は${currentInterior.name}`}>
      <div className={s.characterBackdrop} aria-hidden="true"><img key={currentBackground.asset} src={`/assets/lumina/${currentBackground.asset}`} alt=""/></div>
      <div className={s.characterInterior} aria-hidden="true">
        <span className={s.roomArch}/>
        <span className={s.roomWindow}><i/><i/></span>
        <span className={s.roomShelf}><i/><i/><i/></span>
        <span className={s.roomLamp}><i/></span>
        <span className={s.roomFloor}/>
      </div>
      <div className={s.characterStageLabel}><small>いまの居場所</small><strong>{currentInterior.name}</strong></div>
      <span className={s.characterStageLevel}>Lv.{level} <i>·</i> {xp} XP</span>
      <div className={s.characterPortrait}>
        <EquipmentAvatar loadout={save.equippedBySlot} large label={`現在の装備：${EQUIPMENT_SLOTS.map((slot) => EQUIPMENT_BY_ID.get(save.equippedBySlot[slot])?.name).filter(Boolean).join("・")}`}/>
      </div>
      <div className={s.characterStageFoot}><span>{currentBackground.name}</span><span>{save.completed.length} / 6 の物語</span></div>
    </section>

    <section className={s.statusProgress} aria-label="成長の記録">
      <div className={s.statusProgressTop}><div><small>次のレベルまで</small><strong>{nextLevelXp} XP</strong></div><span>累計 {xp} XP</span></div>
      <div className={s.statusXpTrack}><i style={{ width: `${progressPercent}%` }}/></div>
      <div className={s.statusMetricGrid}>
        <div><small>物語クリア</small><strong>{save.completed.length}<span> / 6</span></strong></div>
        <div><small>連続学習</small><strong>{streak}<span> 日</span></strong></div>
        <div><small>集めた装備</small><strong>{save.ownedEquipmentIds.length}<span> 種</span></strong></div>
      </div>
    </section>

    <section className={s.statusGearSection} aria-labelledby="equipped-heading">
      <div className={s.statusSectionHeading}><div><h2 id="equipped-heading">装着中の装備</h2></div><a className={s.statusTextButton} href="?view=equipment">着替える</a></div>
      <p>部位を選ぶと、その装備のコレクションを開けます。</p>
      <div className={s.statusGearGrid}>{EQUIPMENT_SLOTS.map((slot) => {
        const item = EQUIPMENT_BY_ID.get(save.equippedBySlot[slot]);
        if (!item) return null;
        return <button key={slot} type="button" className={s.statusGearSlot} data-rarity={item.rarity} onClick={() => onOpenSlot(slot)} aria-label={`${SLOT_LABEL[slot]}：${item.name}。タップして装備を変更`}>
          <EquipmentGlyph item={item}/><span><small>{SLOT_LABEL[slot]}</small><strong>{item.name}</strong></span><span className={s.statusGearArrow} aria-hidden="true">›</span>
        </button>;
      })}</div>
      <a className={s.primary} href="?view=equipment">装備をカスタマイズする</a>
      <button className={s.statusShareButton} type="button" onClick={onShare}>この旅装を共有する</button>
      <p className={s.statusShareNote}>共通の旅人に装備を表示します。レベル・学習記録・背景など、個人の保存データは共有されません。</p>
    </section>

    <section className={s.statusScenerySection} aria-labelledby="background-heading">
      <div className={s.statusSectionHeading}><div><h2 id="background-heading">背景</h2><small>{backgroundCount}/{AVATAR_BACKGROUNDS.length} 解放</small></div></div>
      <p>レベル・レッスン進行で解放します。</p>
      <div className={s.sceneryRail} role="group" aria-label="背景の選択">{AVATAR_BACKGROUNDS.map((background) => {
        const unlocked = isBackgroundUnlocked(background.id, save);
        const selected = background.id === backgroundId;
        return <button key={background.id} type="button" className={selected ? s.sceneryChoiceActive : s.sceneryChoice} data-background={background.id} aria-pressed={selected} disabled={!unlocked} onClick={() => onBackground(background.id)}>
          <span className={s.sceneryThumbnail} aria-hidden="true"><img src={`/assets/lumina/${background.asset}`} alt=""/></span>
          <strong>{background.name}</strong><small>{unlocked ? selected ? "選択中" : "タップして選ぶ" : unlockCaption(background.unlock.requiredLevel, background.unlock.requiredLessonId)}</small>
        </button>;
      })}</div>
    </section>

    <section className={s.statusScenerySection} aria-labelledby="interior-heading">
      <div className={s.statusSectionHeading}><div><h2 id="interior-heading">インテリア</h2><small>{interiorCount}/{AVATAR_INTERIORS.length} 解放</small></div></div>
      <div className={s.sceneryRail} role="group" aria-label="インテリアの選択">{AVATAR_INTERIORS.map((interior) => {
        const unlocked = isInteriorUnlocked(interior.id, save);
        const selected = interior.id === interiorId;
        return <button key={interior.id} type="button" className={selected ? s.interiorChoiceActive : s.interiorChoice} data-interior={interior.id} aria-pressed={selected} disabled={!unlocked} onClick={() => onInterior(interior.id)}>
          <span className={s.interiorThumbnail} aria-hidden="true"><i/><b/><em/></span>
          <strong>{interior.name}</strong><small>{unlocked ? selected ? "選択中" : "タップして選ぶ" : unlockCaption(interior.unlock.requiredLevel, interior.unlock.requiredLessonId)}</small>
        </button>;
      })}</div>
      <p className={s.statusLocalSaveNote}>{sceneryStorageProblem ? "背景とインテリアを保存できませんでした。画面を閉じると選択が戻る場合があります。" : "背景・インテリアの選択はアカウントに保存します。装備の共有リンクには含めません。"}</p>
    </section>
  </section>;
}
