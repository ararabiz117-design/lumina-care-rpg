import s from "./minute.module.css";

/** Keep this preview consistent with the actual pixel-art base. */
export function AvatarAppearanceEditor() {
  return <section className={s.appearanceEditor} aria-labelledby="appearance-heading">
    <div className={s.appearanceHeading}>
      <div><h2 id="appearance-heading">キャラクター</h2></div>
    </div>
    <div className={s.avatarPresetCard} role="status" aria-label="ドット絵の旅人を適用中">
      <img src="/assets/lumina/adventurer-pixel-cute-v2.png" alt="栗色の髪と茶色の瞳の、かわいいドット絵の旅人" style={{ imageRendering: "pixelated", objectFit: "contain" }}/>
      <div><strong>ドット絵の旅人 <span>適用中</span></strong><p>装備を変えると見た目も変わります。顔・髪の変更は未対応です。</p></div>
    </div>
  </section>;
}
