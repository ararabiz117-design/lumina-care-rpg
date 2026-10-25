"use client";

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Share } from "@capacitor/share";
import { useCallback, useEffect, useRef, useState } from "react";
import { appStorage } from "../../src/cloud-storage";
import content from "../../data/lumina-minute-lessons.json";
import { advanceLesson, beginLesson, buyEquipment, checkAnswer, currentStreak, emptyJourneyStats, emptySave, equipEquipment, isEquipmentUnlocked, localDay, parseSharedLoadout, playerLevel, readJourneyStats, readSave, rewardPreview, SAVE_KEY, selectAnswer, shareLoadoutCode, STATS_KEY, weekDays, XP_PER_LESSON, type EquipmentLoadout, type JourneySave, type JourneyStats, type Lesson, type RewardPreview } from "./minute-engine";
import { EQUIPMENT, EQUIPMENT_BY_ID, EQUIPMENT_SLOTS, RARITY_LABEL, SLOT_LABEL, WEAPON_STYLE_LABEL, type EquipmentItem, type EquipmentSlot, type WeaponStyle } from "./equipment";
import { AvatarAppearanceEditor } from "./AvatarAppearanceEditor";
import { EquipmentAvatar, EquipmentGlyph } from "./EquipmentAvatar";
import { resolveFitting, toggleFitting, applyOwnedFitting, type PreviewBySlot } from "./fitting-engine";
import { dailyLesson } from "./daily-lesson";
import { CharacterStatus } from "./CharacterStatus";
import { AVATAR_SCENERY_KEY, DEFAULT_AVATAR_SCENERY, readAvatarScenery, serializeAvatarScenery, type AvatarScenerySelection } from "./avatar-scenery";
import s from "./minute.module.css";

const lessons: Lesson[] = content.lessons;
type Tab = "journey" | "review" | "cards" | "wardrobe" | "record" | "status";
type IconName = "path" | "book" | "spark" | "flag" | "check" | "arrow" | "close" | "lock" | "clock" | "leaf" | "wear";
type ThemeId = "grove" | "bloom" | "starlight";
const THEME_STORAGE_KEY = "arablo-lumina-theme-v1";
const THEMES: { id: ThemeId; name: string; note: string }[] = [
  { id: "grove", name: "木漏れ日", note: "若葉と琥珀" },
  { id: "bloom", name: "花あかり", note: "珊瑚と藤色" },
  { id: "starlight", name: "星の水辺", note: "夜空と水色" },
];
function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    path: <><path d="M5 20V5l6-2 8 3v14l-8-3-6 3Z M11 3v14"/><path d="m14 8 2 1-2 2"/></>,
    book: <><path d="M12 5C8 2 4 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-2-6-1-9 1Z M12 5v15"/></>,
    spark: <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/></>,
    flag: <><path d="M5 22V3h14l-3 5 3 5H5"/></>,
    check: <path d="m5 12 5 5L20 6"/>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    leaf: <><path d="M19 3c-8 0-15 1-15 9a7 7 0 0 0 7 7c8 0 8-9 8-16Z M4 21 15 9"/></>,
    wear: <><path d="m16 3 5 3-3 6-3-2v11H9V10L6 12 3 6l5-3c1 2 2 3 4 3s3-1 4-3Z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Lantern({ small = false }: { small?: boolean }) { return <span aria-hidden="true" className={`${s.lantern} ${small ? s.smallLantern : ""}`}><i/><b/><em/></span>; }

function ScreenSkeleton() {
  return <div className={s.screenSkeleton} role="status" aria-label="画面を読み込み中"><span className={s.skeletonTitle}/><span className={s.skeletonLine}/><div className={s.skeletonHero}/><div className={s.skeletonRow}><span/><span/><span/></div><span className={s.skeletonLine}/><span className={s.skeletonLine}/></div>;
}

/** Wait for the actual first-screen artwork, not a decorative artificial delay. */
function ScreenSurface({ view, children }: { view: string; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const cleanups: (() => void)[] = [];
    const waitForImage = (image: HTMLImageElement) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      const finish = () => { image.removeEventListener("load", finish); image.removeEventListener("error", finish); resolve(); };
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
      cleanups.push(finish);
    });
    const images = Array.from(root.current?.querySelectorAll<HTMLImageElement>("img:not([loading='lazy'])") ?? []).filter((image) => image.getBoundingClientRect().top < window.innerHeight + 200);
    const artwork = [...new Set(Array.from(root.current?.querySelectorAll<HTMLElement>("[data-art-asset]") ?? []).slice(0, 14).map((element) => element.dataset.artAsset).filter(Boolean))];
    const preload = artwork.map((asset) => { const image = new Image(); image.src = `/assets/lumina/${asset}`; return image; });
    void Promise.all([...images, ...preload].map(waitForImage)).then(() => {
      if (cancelled) return;
      setLoading(false);
      if (view.startsWith("lesson") || view === "reward") requestAnimationFrame(() => {
        if (!cancelled) root.current?.querySelector<HTMLElement>("h1[tabindex='-1']")?.focus();
      });
    });
    return () => { cancelled = true; cleanups.forEach((cleanup) => cleanup()); };
  }, [view]);
  return <div className={s.screenSurface} aria-busy={loading} data-screen={view} data-loading={loading ? "true" : "false"}>
    {loading && <ScreenSkeleton/>}
    <div ref={root} className={s.screenContent} inert={loading} aria-hidden={loading || undefined}>{children}</div>
  </div>;
}
const tabs: { id: Tab; title: string; icon: IconName }[] = [
  { id: "journey", title: "冒険", icon: "path" }, { id: "review", title: "復習", icon: "leaf" },
  { id: "cards", title: "図鑑", icon: "book" }, { id: "wardrobe", title: "装備", icon: "wear" },
  { id: "record", title: "きろく", icon: "flag" },
];
// Put the most requested collection category first without changing the
// canonical slot order used by saves and shared-loadout URLs.
const COLLECTION_SLOT_ORDER: EquipmentSlot[] = ["body", "head", "cape", "arms", "legs", "shield", "weapon"];
const spots = [{ x: 47, y: 17 }, { x: 68, y: 32 }, { x: 41, y: 47 }, { x: 63, y: 62 }, { x: 37, y: 77 }, { x: 58, y: 91 }];
const rarityClass = (rarity: EquipmentItem["rarity"]) => ({ common: s.rarityCommon, uncommon: s.rarityUncommon, rare: s.rarityRare, epic: s.rarityEpic, legendary: s.rarityLegendary })[rarity];
type ShareStatId = "studyTime" | "appTime" | "launches" | "sessions" | "completions" | "questions" | "days";
const SHARE_STAT_LABELS: { id: ShareStatId; label: string }[] = [
  { id: "studyTime", label: "問題画面の時間" }, { id: "appTime", label: "アプリ表示時間" },
  { id: "launches", label: "起動回数" }, { id: "sessions", label: "学習セッション" },
  { id: "completions", label: "レッスン完了" }, { id: "questions", label: "問題クリア" },
  { id: "days", label: "学習した日数" },
];
function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  if (milliseconds > 0 && minutes === 0) return "1分未満";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}時間${minutes % 60}分` : `${minutes}分`;
}

function EquipmentCollection({
  save, xp, level, slotFilter, setSlotFilter, weaponStyleFilter, setWeaponStyleFilter,
  shownEquipment, onEquipment, onShare, shareStatus, shareUrl, theme, setTheme,
  previewBySlot, onPreview, onResetPreview, onApplyPreview,
}: {
  save: JourneySave;
  xp: number;
  level: number;
  slotFilter: EquipmentSlot;
  setSlotFilter: (slot: EquipmentSlot) => void;
  weaponStyleFilter: WeaponStyle | "all";
  setWeaponStyleFilter: (style: WeaponStyle | "all") => void;
  shownEquipment: EquipmentItem[];
  onEquipment: (item: EquipmentItem) => void;
  onShare: (loadout: EquipmentLoadout) => void;
  shareStatus: string;
  shareUrl: string;
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  previewBySlot: PreviewBySlot;
  onPreview: (item: EquipmentItem) => void;
  onResetPreview: () => void;
  onApplyPreview: () => void;
}) {
  const ownedCount = save.ownedEquipmentIds.length;
  const previewLoadout = resolveFitting(save.equippedBySlot, previewBySlot);
  const previewItems = EQUIPMENT_SLOTS.flatMap((slot) => previewBySlot[slot] && previewLoadout[slot] !== save.equippedBySlot[slot] ? [EQUIPMENT_BY_ID.get(previewLoadout[slot])!] : []);
  const hasPreview = previewItems.length > 0;
  const canApplyPreview = hasPreview && previewItems.every((item) => save.ownedEquipmentIds.includes(item.id));
  return <section className={`${s.tabContent} ${s.wardrobePage}`}>
    <h1>装備</h1>
    <p>7部位を組み合わせて試着できます。未所持の装備も試着無料です。</p>
    <section className={s.themePicker} aria-labelledby="theme-picker-heading">
      <div><h2 id="theme-picker-heading">画面の雰囲気</h2><p>気分に合わせて色を選べます。いつでも変更できます。</p></div>
      <div className={s.themeChoices} role="group" aria-label="画面の雰囲気を選ぶ">
        {THEMES.map((option) => <button key={option.id} type="button" data-theme-choice={option.id} className={theme === option.id ? s.themeChoiceActive : s.themeChoice} aria-pressed={theme === option.id} onClick={() => setTheme(option.id)}>
          <span className={s.themeSwatch} aria-hidden="true"/><span><strong>{option.name}</strong><small>{option.note}</small></span>
        </button>)}
      </div>
    </section>
    <article className={s.fittingRoom} aria-label="全身の試着室">
      <div className={s.fittingStage}>
        <img className={s.fittingBackdrop} src="/assets/lumina/minute-garden.webp" alt="" aria-hidden="true"/>
        <span className={s.fittingBadge}>{hasPreview ? `無料の試着 · ${previewItems.length}部位` : "現在の装備"}</span>
        <EquipmentAvatar loadout={previewLoadout} large/>
      </div>
      <div className={s.fittingInfo}><span>Lv.{level} · {xp} XP</span><h2>{hasPreview ? "試着中" : "現在の装備"}</h2><p>{hasPreview ? "ほかの部位の試着を保持します。灯石・進捗は消費しません。" : `${ownedCount} / ${EQUIPMENT.length} 種を所持 · 次のレベルまで ${XP_PER_LESSON - (xp % XP_PER_LESSON)} XP`}</p>
        <div className={s.fittingActions}><a className={s.primary} href={hasPreview ? `?look=${shareLoadoutCode(previewLoadout)}` : "?view=status"}>{hasPreview ? "この試着を大きく見る" : "ステータスを見る"}<Icon name="arrow" size={18}/></a><button type="button" className={s.statusShareButton} onClick={() => onShare(previewLoadout)}>この見た目を共有する</button>
        {hasPreview && <><button type="button" className={s.primary} disabled={!canApplyPreview} onClick={onApplyPreview}>{canApplyPreview ? "この組み合わせを装備する" : "未所持の装備を含む試着です"}</button><button type="button" className={s.statusShareButton} onClick={onResetPreview}>すべて元の装備に戻す</button></>}</div>
      </div>
    </article>
    <AvatarAppearanceEditor/>
    {hasPreview && <div className={s.tryOnNotice} role="status" aria-live="polite"><span><strong>{previewItems.length}部位を試着中</strong><small>{previewItems.map((item) => item.name).join("・")}</small></span></div>}
    <div className={s.loadoutStrip}>{EQUIPMENT_SLOTS.map((slot) => { const item = EQUIPMENT_BY_ID.get(previewLoadout[slot])!; return <span key={slot} data-rarity={item.rarity}><EquipmentGlyph item={item}/><div><small>{SLOT_LABEL[slot]} · {RARITY_LABEL[item.rarity]}{previewBySlot[slot] ? " · 試着" : ""}</small><strong>{item.name}</strong></div></span>; })}</div>
    <div className={s.walletCard}><span><Icon name="spark" size={20}/>{save.coins} 灯石</span><small>初回クリアで装備を確定入手。灯石でも解放済みの装備を交換できます。</small></div>
    {(shareStatus || shareUrl) && <div className={s.sharePanel} role="status"><strong>{shareStatus || "共有リンク"}</strong>{shareUrl && <input aria-label="装備共有リンク" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()}/>}<small>共通の旅人に選んだ装備を表示します。名前・レベル・進捗・学習記録は含みません。リンクのURLに装備の指定だけを含みます。</small></div>}
    <h2 className={s.outfitHeading}>旅装コレクション · 全{EQUIPMENT.length}種</h2>
    <div className={s.slotTabs} role="group" aria-label="装備部位">{COLLECTION_SLOT_ORDER.map((slot) => { const total = EQUIPMENT.filter((item) => item.slot === slot).length; const owned = save.ownedEquipmentIds.filter((id) => EQUIPMENT_BY_ID.get(id)?.slot === slot).length; return <button key={slot} type="button" className={slotFilter === slot ? s.slotTabActive : s.slotTab} aria-pressed={slotFilter === slot} onClick={() => { setSlotFilter(slot); setWeaponStyleFilter("all"); }}><span>{SLOT_LABEL[slot]}</span><small>{owned}/{total}</small></button>; })}</div>
    {slotFilter === "weapon" && <div className={s.weaponFilters} role="group" aria-label="武器の種類">{(["all", "sword", "staff", "unarmed", "club"] as const).map((style) => { const count = style === "all" ? EQUIPMENT.filter((item) => item.slot === "weapon").length : EQUIPMENT.filter((item) => item.slot === "weapon" && item.weaponStyle === style).length; return <button key={style} type="button" aria-pressed={weaponStyleFilter === style} className={weaponStyleFilter === style ? s.weaponFilterActive : s.weaponFilter} onClick={() => setWeaponStyleFilter(style)}>{style === "all" ? "すべて" : WEAPON_STYLE_LABEL[style]} <small>{count}</small></button>; })}</div>}
    <p className={s.catalogSummary}>{shownEquipment.length}種を表示 · 所持 {shownEquipment.filter((item) => save.ownedEquipmentIds.includes(item.id)).length}種 · レア度と必要レベルを表示</p>
    <div className={s.equipmentGrid}>{shownEquipment.map((item) => {
      const owned = save.ownedEquipmentIds.includes(item.id);
      const equipped = save.equippedBySlot[item.slot] === item.id;
      const unlocked = isEquipmentUnlocked(item, save);
      const canBuy = unlocked && !item.clearReward && save.coins >= item.price;
      const action = equipped ? "装備中" : owned ? "装備する" : item.clearReward ? "初回クリア報酬" : !unlocked ? `Lv.${item.requiredLevel}で解放` : canBuy ? `灯石 ${item.price}で交換` : "灯石が足りません";
      return <article key={item.id} data-rarity={item.rarity} className={`${s.equipmentCard} ${!unlocked && !owned ? s.equipmentLocked : ""}`}>
        <div className={`${s.equipmentArt} ${rarityClass(item.rarity)}`} data-rarity={item.rarity}><EquipmentGlyph item={item} large/><span className={rarityClass(item.rarity)}>{RARITY_LABEL[item.rarity]}</span></div>
        <div className={s.equipmentInfo}><small>{SLOT_LABEL[item.slot]}{item.weaponStyle ? ` · ${WEAPON_STYLE_LABEL[item.weaponStyle]}` : ""} · Lv.{item.requiredLevel}〜</small><h3>{item.name}</h3><p>{item.description}</p><div className={s.equipmentActions}><button type="button" className={previewBySlot[item.slot] === item.id ? s.tryOnButtonActive : s.tryOnButton} aria-pressed={previewBySlot[item.slot] === item.id} disabled={equipped && !previewBySlot[item.slot]} onClick={() => onPreview(item)}>{equipped && !previewBySlot[item.slot] ? "着用中" : previewBySlot[item.slot] === item.id ? "試着中" : "試着"}</button><button type="button" className={equipped ? s.equippedButton : s.outfitButton} disabled={equipped || (!owned && (!unlocked || item.clearReward || !canBuy))} onClick={() => onEquipment(item)}>{action}</button></div></div>
      </article>;
    })}</div>
    <p className={s.hint}>レア度は見た目と収集目標だけに関係します。装備で学習の正誤や介護の判断が有利になることはありません。今日の学習ボーナスは1日1回、最初の正答の解説を確認して進むと受け取れます。休んでも進捗や所持品は失われません。</p>
  </section>;
}

export function MinuteJourney() {
  const nativeApp = Capacitor.isNativePlatform();
  const homeHref = nativeApp ? "/" : "/lumina/";
  const [save, setSave] = useState<JourneySave>(emptySave);
  const [stats, setStats] = useState<JourneyStats>(emptyJourneyStats);
  const [statsReady, setStatsReady] = useState(false);
  const [statsStorageProblem, setStatsStorageProblem] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageProblem, setStorageProblem] = useState(false);
  const [tab, setTab] = useState<Tab>("journey");
  const [theme, setTheme] = useState<ThemeId>("grove");
  const [themeReady, setThemeReady] = useState(false);
  const [scenery, setScenery] = useState<AvatarScenerySelection>({ ...DEFAULT_AVATAR_SCENERY });
  const [sceneryReady, setSceneryReady] = useState(false);
  const [sceneryStorageProblem, setSceneryStorageProblem] = useState(false);
  const [previewBySlot, setPreviewBySlot] = useState<PreviewBySlot>({});
  const [mapArtLoaded, setMapArtLoaded] = useState(false);
  const [screen, setScreen] = useState<"home" | "lesson" | "reward">("home");
  const [reward, setReward] = useState<{ lesson: Lesson; awards: RewardPreview } | null>(null);
  const [today, setToday] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot>("body");
  const [weaponStyleFilter, setWeaponStyleFilter] = useState<WeaponStyle | "all">("all");
  const [sharedLoadout, setSharedLoadout] = useState<EquipmentLoadout | null>(null);
  const [queryReady, setQueryReady] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatsOpen, setShareStatsOpen] = useState(false);
  const [shareStatsStatus, setShareStatsStatus] = useState("");
  const [shareStatIds, setShareStatIds] = useState<ShareStatId[]>(["studyTime", "sessions", "completions", "questions", "days"]);
  const statsRef = useRef<JourneyStats>(emptyJourneyStats());
  const launchCounted = useRef(false);
  const sceneryLoaded = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const currentStop = useRef<HTMLDivElement>(null);
  const revealNextStop = useRef(false);
  const session = save.session;
  const lesson = lessons.find((l) => l.id === session?.lessonId);
  const question = lesson?.questions[session?.questionIndex ?? 0];
  const next = dailyLesson(save, lessons, today);
  const hasFinished = save.completed.length === lessons.length;
  const current = lesson ?? next;
  const doneToday = save.activeDays.includes(today);
  const dayAwardPreview = rewardPreview(save, lesson?.id ?? current.id, today || localDay(), lessons);
  const xp = save.completed.length * XP_PER_LESSON;
  const level = playerLevel(save);
  const equippedItems = EQUIPMENT_SLOTS.map((slot) => EQUIPMENT_BY_ID.get(save.equippedBySlot[slot])!).filter(Boolean);
  const shownEquipment = EQUIPMENT.filter((item) => item.slot === slotFilter && (slotFilter !== "weapon" || weaponStyleFilter === "all" || item.weaponStyle === weaponStyleFilter));
  const streak = currentStreak(save.activeDays, today || localDay());
  const activeThisWeek = days.filter((d) => save.activeDays.includes(d)).length;

  const updateStats = useCallback((updater: (previous: JourneyStats) => JourneyStats) => {
    const nextStats = updater(statsRef.current);
    statsRef.current = nextStats;
    setStats(nextStats);
    try {
      appStorage.setItem(STATS_KEY, JSON.stringify(nextStats));
      setStatsStorageProblem(false);
    } catch { setStatsStorageProblem(true); }
  }, []);

  useEffect(() => {
    try { setSave(readSave(appStorage.getItem(SAVE_KEY), lessons)); } catch { setStorageProblem(true); }
    try {
      const restoredStats = readJourneyStats(appStorage.getItem(STATS_KEY));
      statsRef.current = restoredStats;
      setStats(restoredStats);
    } catch { setStatsStorageProblem(true); }
    const syncDate = () => { setToday(localDay()); setDays(weekDays()); };
    syncDate();
    const timer = window.setInterval(syncDate, 60_000);
    window.addEventListener("focus", syncDate);
    setStatsReady(true);
    setReady(true);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", syncDate); };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSharedLoadout(parseSharedLoadout(params.get("look")));
    if (params.get("view") === "equipment") setTab("wardrobe");
    if (params.get("view") === "status") setTab("status");
    if (params.get("view") === "record") setTab("record");
    setQueryReady(true);
  }, []);
  useEffect(() => {
    try {
      const storedTheme = appStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeId(storedTheme)) setTheme(storedTheme);
    } catch { /* Appearance is optional; the default theme remains usable. */ }
    setThemeReady(true);
  }, []);
  useEffect(() => {
    if (!themeReady) return;
    try { appStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Keep the current choice for this session. */ }
  }, [theme, themeReady]);
  useEffect(() => {
    if (!ready || sceneryLoaded.current) return;
    sceneryLoaded.current = true;
    try { setScenery(readAvatarScenery(appStorage.getItem(AVATAR_SCENERY_KEY), save)); }
    catch { setScenery(readAvatarScenery(null, save)); setSceneryStorageProblem(true); }
    setSceneryReady(true);
  }, [ready, save]);
  useEffect(() => {
    if (!ready || !sceneryReady) return;
    try {
      appStorage.setItem(AVATAR_SCENERY_KEY, serializeAvatarScenery(scenery, save));
      setSceneryStorageProblem(false);
    } catch { setSceneryStorageProblem(true); }
  }, [ready, sceneryReady, scenery, save]);
  useEffect(() => {
    if (!ready) return;
    try { appStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { setStorageProblem(true); }
  }, [save, ready]);
  useEffect(() => {
    if (!ready || !statsReady || !queryReady || sharedLoadout || launchCounted.current) return;
    launchCounted.current = true;
    updateStats((previous) => ({ ...previous, launches: previous.launches + 1 }));
  }, [ready, statsReady, queryReady, sharedLoadout, updateStats]);
  useEffect(() => {
    if (!ready || !statsReady || !queryReady || sharedLoadout) return;
    let lastVisibleAt = document.visibilityState === "visible" ? performance.now() : 0;
    const collectVisibleTime = () => {
      const visible = document.visibilityState === "visible";
      const now = performance.now();
      if (visible && lastVisibleAt > 0) {
        const elapsed = Math.min(Math.max(0, now - lastVisibleAt), 15_000);
        if (elapsed >= 250) {
          updateStats((previous) => ({
            ...previous,
            appForegroundMs: previous.appForegroundMs + elapsed,
            lessonForegroundMs: previous.lessonForegroundMs + (screen === "lesson" ? elapsed : 0),
          }));
        }
      }
      lastVisibleAt = visible ? now : 0;
    };
    const timer = window.setInterval(collectVisibleTime, 5_000);
    document.addEventListener("visibilitychange", collectVisibleTime);
    window.addEventListener("pagehide", collectVisibleTime);
    return () => {
      collectVisibleTime();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", collectVisibleTime);
      window.removeEventListener("pagehide", collectVisibleTime);
    };
  }, [ready, statsReady, queryReady, sharedLoadout, screen, updateStats]);
  useEffect(() => { if (screen !== "home") heading.current?.focus(); }, [screen, session?.questionIndex]);
  useEffect(() => {
    if (screen !== "home" || tab !== "journey" || !revealNextStop.current) return;
    revealNextStop.current = false;
    currentStop.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [screen, tab]);

  function start(id: string) {
    if (!ready) return;
    const lessonIndex = lessons.findIndex((item) => item.id === id);
    if (lessonIndex < 0 || lessonIndex > save.completed.length) return;
    setSave(beginLesson(save, id, lessons));
    updateStats((previous) => ({ ...previous, learningSessions: previous.learningSessions + 1 }));
    setScreen("lesson");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function answerAction(pauseAfterCorrect = false) {
    if (!session || !question || !lesson) return;
    if (!session.checked) { setSave((prev) => checkAnswer(prev, lessons)); return; }
    const correct = session.selected === question.correctIndex;
    const finished = correct && session.questionIndex === lesson.questions.length - 1;
    if (correct) {
      updateStats((previous) => ({
        ...previous,
        questionsCleared: previous.questionsCleared + 1,
        lessonCompletions: previous.lessonCompletions + Number(finished),
      }));
    }
    if (finished) setReward({ lesson, awards: rewardPreview(save, lesson.id, localDay(), lessons) });
    setSave(advanceLesson(save, lessons, localDay()));
    setToday(localDay()); setDays(weekDays());
    if (finished) { setScreen("reward"); window.scrollTo({ top: 0, behavior: "instant" }); }
    else if (correct && pauseAfterCorrect) { setScreen("home"); setTab("journey"); window.scrollTo({ top: 0, behavior: "instant" }); }
  }
  function goHome(nextTab: Tab = "journey") {
    revealNextStop.current = screen === "reward" && nextTab === "journey";
    setScreen("home"); setTab(nextTab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function editEquipment(item: EquipmentItem) {
    setPreviewBySlot((current) => { const next = { ...current }; delete next[item.slot]; return next; });
    setSave((prev) => prev.ownedEquipmentIds.includes(item.id) ? equipEquipment(prev, item.id) : buyEquipment(prev, item.id));
  }

  function previewEquipment(item: EquipmentItem) {
    setPreviewBySlot((current) => toggleFitting(current, item));
    setShareUrl("");
    setShareStatus("");
  }

  async function shareEquipment(loadout: EquipmentLoadout = save.equippedBySlot) {
    const url = new URL(nativeApp ? "https://arara-dx.com/lumina/" : window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("look", shareLoadoutCode(loadout));
    const link = url.toString();
    setShareUrl(link);
    setShareStatus("");
    try {
      if (nativeApp) {
        await Share.share({ title: "LUMINAの旅装", text: "わたしの冒険装備を見てみてね。", url: link, dialogTitle: "旅装を共有" });
        setShareStatus("共有画面を開きました。共有する相手はご自身で選んでください。");
      } else if (navigator.share) {
        await navigator.share({ title: "LUMINAの旅装", text: "わたしの冒険装備を見てみてね。", url: link });
        setShareStatus("共有画面を開きました。共有する相手はご自身で選んでください。");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setShareStatus("共有リンクをコピーしました。");
      } else {
        setShareStatus("リンク欄を長押ししてコピーしてください。装備の見た目だけを共有します。");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareStatus("自動コピーできませんでした。リンク欄からコピーしてください。");
    }
  }

  const shareStatValues: Record<ShareStatId, string> = {
    studyTime: formatDuration(stats.lessonForegroundMs), appTime: formatDuration(stats.appForegroundMs),
    launches: `${stats.launches}回`, sessions: `${stats.learningSessions}回`,
    completions: `${stats.lessonCompletions}回`, questions: `${stats.questionsCleared}問`, days: `${save.activeDays.length}日`,
  };
  const shareStatsText = [
    "📖 LUMINAの学習記録",
    ...SHARE_STAT_LABELS.filter(({ id }) => shareStatIds.includes(id)).map(({ id, label }) => `${label}：${shareStatValues[id]}`),
    "※端末内で集計した自己申告の記録です。資格・能力の証明ではありません。",
  ].join("\n");
  async function shareLearningStats() {
    if (shareStatIds.length === 0) { setShareStatsStatus("共有する項目をひとつ選んでください。"); return; }
    setShareStatsStatus("");
    try {
      if (nativeApp) {
        await Share.share({ title: "LUMINAの学習記録", text: shareStatsText, dialogTitle: "学習記録を共有" });
        setShareStatsStatus("共有画面を終了しました。送信先と内容をご確認ください。");
      } else if (navigator.share) {
        await navigator.share({ title: "LUMINAの学習記録", text: shareStatsText });
        setShareStatsStatus("共有画面を終了しました。送信先と内容をご確認ください。");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareStatsText);
        setShareStatsStatus("共有用テキストをコピーしました。送る相手はご自身で選んでください。");
      } else {
        setShareStatsStatus("自動コピーは使えません。内容を長押ししてコピーしてください。");
      }
    } catch (error) {
      setShareStatsStatus(error instanceof Error && error.name === "AbortError" ? "共有をキャンセルしました。内容は送信されていません。" : "共有を開始できませんでした。内容をコピーしてお試しください。");
    }
  }

  function closeShowcase() {
    const url = new URL(window.location.href);
    url.searchParams.delete("look");
    window.location.assign(url.pathname);
  }

  const nav = <nav className={s.nav} aria-label="学習メニュー">{tabs.map((item) => { const active = tab === item.id || (tab === "status" && item.id === "wardrobe"); return <button key={item.id} type="button" onClick={() => goHome(item.id)} className={active ? s.navActive : ""} aria-current={active ? "page" : undefined}><Icon name={item.icon}/><span>{item.title}</span></button>; })}</nav>;
  const calendar = <div className={s.calendar} aria-label={`今週は${activeThisWeek}日学習しました`}>{days.map((day, i) => <div key={day} className={`${save.activeDays.includes(day) ? s.dayDone : ""} ${day === today ? s.dayToday : ""}`}><small>{["月", "火", "水", "木", "金", "土", "日"][i]}</small><span>{save.activeDays.includes(day) ? <Icon name="check" size={16}/> : new Date(`${day}T12:00:00`).getDate()}</span></div>)}</div>;
  const saving = storageProblem ? "このブラウザに記録を保存できません。画面を閉じる前に接続状態を確認してください。" : "記録はログイン中のアカウントに保存します。同期状態は画面上部で確認できます。";

  if (!queryReady || !ready || !themeReady || !sceneryReady || !statsReady) return <div className={s.app} data-lumina-app="minute" data-theme={theme}><ScreenSkeleton/></div>;
  if (sharedLoadout) return <div className={s.app} data-lumina-app="minute" data-theme={theme}><ScreenSurface key="showcase" view="showcase"><section className={s.showcaseScreen}><a className={s.brand} href={homeHref}><Lantern small/><span>LUMINA</span></a><div className={s.showcaseCard}><EquipmentAvatar loadout={sharedLoadout} large/><h1>旅人の装備</h1><div className={s.showcaseItems}>{EQUIPMENT_SLOTS.map((slot) => { const item = EQUIPMENT_BY_ID.get(sharedLoadout[slot])!; return <div key={slot} data-rarity={item.rarity}><EquipmentGlyph item={item}/><small>{SLOT_LABEL[slot]}</small><strong>{item.name}</strong><span className={rarityClass(item.rarity)}>{RARITY_LABEL[item.rarity]}</span></div>; })}</div><p className={s.shareDisclaimer}>この表示はURLに含まれる装備指定です。本人の獲得状況、学習記録、資格・能力を証明するものではありません。</p><button className={s.primary} onClick={closeShowcase}>LUMINAを開く<Icon name="arrow" size={20}/></button></div></section></ScreenSurface></div>;

  return <div className={s.app} data-lumina-app="minute" data-theme={theme}>
    {screen === "home" ? <div className={s.shell}>
      <aside className={s.sidebar}>
        <a href={homeHref} className={s.brand}><Lantern small/><span>LUMINA</span></a>
        {nav}
      </aside>
      <div className={s.mainColumn}>
        <header className={s.topbar}><a href={homeHref} className={s.mobileBrand}><Lantern small/><strong>LUMINA</strong></a><span className={s.topTitle}>介護学習</span><div className={s.stats}><span title={`連続学習 ${streak} 日`}><Icon name="leaf" size={18}/>{streak}<small>日</small></span><span><Icon name="spark" size={18}/>{xp}<small>XP</small></span><a className={s.walletShortcut} href="?view=status" aria-label={`旅人ステータスを開く。レベル${level}。所持灯石${save.coins}`}><EquipmentAvatar loadout={save.equippedBySlot}/><span><small>旅人 Lv.{level}</small><strong>{save.coins}<small> 灯石</small></strong></span></a></div></header>
        {storageProblem && <p className={s.storageWarning} role="status">{saving}</p>}
        <ScreenSurface key={tab} view={tab}>
        {tab === "journey" && <>
          <section className={s.welcome}><h1>冒険</h1></section>
          <section className={s.dailyCard} aria-label="今日のレッスン"><div className={s.dailyTop}><span className={s.dailyTag}>{session ? doneToday ? "今日の1問クリア · 続きあり" : "続きから" : doneToday ? "今日の1問クリア！" : "今日の1問"}</span><span><Icon name="clock" size={14}/>まず1問 · 3問で1レッスン</span></div><div className={s.dailyTitle}><div><small>{session ? "問題の途中から再開" : hasFinished ? "復習" : `レッスン ${String(save.completed.length + 1).padStart(2, "0")}`}</small><h2>{current.title}</h2></div><span className={s.dailyIcon}><Icon name={doneToday ? "check" : "leaf"} size={29}/></span></div><button className={s.primary} disabled={!ready} onClick={() => start(current.id)}>{!ready ? "準備しています…" : session ? "続きから学ぶ" : hasFinished ? "1問おさらいする" : doneToday ? "もう1問学ぶ" : "今日の1問をはじめる"}<Icon name="arrow" size={21}/></button><button type="button" className={s.tryWardrobeLink} onClick={() => goHome("wardrobe")}>旅装を見てみる・無料で試着<Icon name="arrow" size={16}/></button></section>
          <section className={s.mapSection} aria-labelledby="map-heading"><div className={s.mapHeading}><div><span>第1章</span><h2 id="map-heading">はじまりの庭</h2></div><span className={s.chapterCount}>{save.completed.length} / 6<span>歩</span></span></div>
            <div className={s.map}>
              {/* Original generated art is decorative; every learning action remains an accessible button. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/lumina/minute-garden.webp" alt="" aria-hidden="true" className={`${s.mapArt} ${mapArtLoaded ? s.mapArtLoaded : ""}`} onLoad={() => setMapArtLoaded(true)} onError={() => setMapArtLoaded(false)} width="768" height="1152" fetchPriority="high"/>
              
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={s.route} aria-hidden="true"><path d="M47 17 C47 24 68 25 68 32 S41 40 41 47 S63 55 63 62 S37 70 37 77 S58 84 58 91"/></svg>
              {lessons.map((item, i) => {
                const completed = save.completed.includes(item.id);
                const locked = i > save.completed.length;
                const active = i === save.completed.length;
                return <div ref={active ? currentStop : undefined} className={`${s.mapStop} ${active ? s.currentStop : ""} ${locked ? s.lockedStop : ""}`} style={{ left: `${spots[i].x}%`, top: `${spots[i].y}%` }} key={item.id}>
                  {active && <span className={s.here}>いまここ</span>}
                  <button type="button" className={`${s.node} ${completed ? s.completeNode : ""}`} onClick={() => start(item.id)} disabled={locked || !ready} aria-label={`${i + 1}. ${item.title}${completed ? "・完了、おさらいする" : locked ? "・前のレッスンで解放" : "・はじめる"}`}>
                    {completed ? <Icon name="check" size={28}/> : locked ? <Icon name="lock" size={20}/> : <Lantern/>}
                  </button><span className={s.nodeLabel}>{item.shortTitle}</span>
                </div>;
              })}
            </div>
            <p className={s.mapCaption}>{hasFinished ? "全レッスンクリア" : "1日1問から。3問で1レッスン、いつでも続きから。"}</p>
          </section>
          <p className={s.mobileNote}>知識の入口を学ぶ試作版。実技は指導者と学びます。</p>
        </>}
        {tab === "review" && <section className={s.tabContent}><h1>復習</h1>{save.session && <button className={s.resumeCard} onClick={() => start(save.session!.lessonId)}><Icon name="clock"/><span>途中のレッスンへ戻る<strong>{lesson?.title}</strong></span><Icon name="arrow"/></button>}{lessons.filter((l, i) => i <= save.completed.length && (save.completed.includes(l.id) || l.questions.some((q) => save.mistakes.includes(q.id)))).map((l) => <button key={l.id} className={s.listLesson} onClick={() => start(l.id)}><span className={s.listIcon}><Icon name="leaf"/></span><span><small>{l.questions.some((q) => save.mistakes.includes(q.id)) ? "もう一度確かめよう" : "3問 · おさらい"}</small><strong>{l.title}</strong></span><Icon name="arrow" size={18}/></button>)}{!save.completed.length && !save.mistakes.length && <div className={s.emptyCard}><Icon name="leaf" size={42}/><h2>復習するレッスンはありません</h2><p>学んだレッスンがここに並びます。</p><button className={s.primary} onClick={() => start(current.id)}>最初のレッスンへ<Icon name="arrow"/></button></div>}<p className={s.hint}>おさらいにも時間制限はありません。獲得済みのXPは増えませんが、学習した日として残ります。</p></section>}
        {tab === "cards" && <section className={s.tabContent}><h1>図鑑</h1><p>レッスン完了で解放します。</p><div className={s.collection}>{lessons.map((l, i) => <article key={l.id} className={`${s.collectionCard} ${!save.completed.includes(l.id) ? s.uncollected : ""}`}><small>学習カード {String(i + 1).padStart(2, "0")}</small><Icon name={save.completed.includes(l.id) ? "leaf" : "lock"} size={28}/><h2>{save.completed.includes(l.id) ? l.skill : "まだ見ぬ学び"}</h2><p>{save.completed.includes(l.id) ? l.card : `「${l.title}」で見つけよう。`}</p>{save.completed.includes(l.id) && <button onClick={() => start(l.id)}>おさらいする <Icon name="arrow" size={15}/></button>}</article>)}</div></section>}
        {tab === "wardrobe" && <EquipmentCollection save={save} xp={xp} level={level} slotFilter={slotFilter} setSlotFilter={setSlotFilter} weaponStyleFilter={weaponStyleFilter} setWeaponStyleFilter={setWeaponStyleFilter} shownEquipment={shownEquipment} onEquipment={editEquipment} onShare={shareEquipment} shareStatus={shareStatus} shareUrl={shareUrl} theme={theme} setTheme={setTheme} previewBySlot={previewBySlot} onPreview={previewEquipment} onResetPreview={() => { setPreviewBySlot({}); setShareUrl(""); setShareStatus(""); }} onApplyPreview={() => { setSave((current) => applyOwnedFitting(current, previewBySlot)); setPreviewBySlot({}); }}/> }
        {tab === "status" && <CharacterStatus save={save} xp={xp} streak={streak} backgroundId={scenery.backgroundId} interiorId={scenery.interiorId} onBackground={(backgroundId) => setScenery((currentScenery) => ({ ...currentScenery, backgroundId }))} onInterior={(interiorId) => setScenery((currentScenery) => ({ ...currentScenery, interiorId }))} onOpenSlot={(slot) => { setSlotFilter(slot); setWeaponStyleFilter("all"); goHome("wardrobe"); }} onShare={() => shareEquipment()} sceneryStorageProblem={sceneryStorageProblem}/>}
        {tab === "record" && <section className={s.tabContent}>
          
          <h1>学習記録</h1>
          
          <div className={s.recordStats}>
            <div><strong>{save.completed.length}<small> / 6</small></strong><span>初回クリア</span></div>
            <div><strong>{xp}</strong><span>獲得XP</span></div>
            <div><strong>{streak}</strong><span>連続学習日</span></div>
          </div>
          <article className={s.statsPanel} aria-label="累計学習記録">
            <div className={s.statsPanelHeading}><span><h2>学びの記録</h2></span><Icon name="spark" size={23}/></div>
            <div className={s.metricsGrid}>
              <div className={s.metricFeatured}><span>累計学習時間</span><strong>{formatDuration(stats.lessonForegroundMs)}</strong><small>問題画面を前面に表示した時間</small></div>
              <div><span>アプリ表示時間</span><strong>{formatDuration(stats.appForegroundMs)}</strong><small>画面を開いていた時間の目安</small></div>
              <div><span>起動回数</span><strong>{stats.launches}<small> 回</small></strong><small>再読み込みを含む目安</small></div>
              <div><span>学習セッション</span><strong>{stats.learningSessions}<small> 回</small></strong><small>問題を開始・再開した回数</small></div>
              <div><span>レッスン完了</span><strong>{stats.lessonCompletions}<small> 回</small></strong><small>復習の完了も含む</small></div>
              <div><span>問題クリア</span><strong>{stats.questionsCleared}<small> 問</small></strong><small>正解して次へ進んだ数</small></div>
            </div>
            <p className={s.statsFootnote}>この機能を追加した後から端末内で集計します。時間は画面表示ベースの目安で、集中していた時間そのものではありません。アプリを閉じていた過去の時間は復元できません。</p>
            {statsStorageProblem && <p className={s.storageWarning} role="status">記録を端末に保存できませんでした。学習データとは別管理のため、学習自体は続けられます。</p>}
            <button className={s.statsShareToggle} aria-expanded={shareStatsOpen} onClick={() => { setShareStatsOpen((open) => !open); setShareStatsStatus(""); }}>{shareStatsOpen ? "共有内容を閉じる" : "学びの記録を共有する"}<Icon name="arrow" size={18}/></button>
            {shareStatsOpen && <div className={s.statsShareBox}>
              <p>共有する項目を選び、送信内容を確認してください。名前・学校名・日付は含めません。共有ボタンを押すまでは、選んだ共有先へ送信しません。</p>
              <div className={s.shareStatChoices}>{SHARE_STAT_LABELS.map(({ id, label }) => <label key={id}><input type="checkbox" checked={shareStatIds.includes(id)} onChange={(event) => { setShareStatIds((previous) => event.target.checked ? [...previous, id] : previous.filter((item) => item !== id)); setShareStatsStatus(""); }}/><span>{label}<small>{shareStatValues[id]}</small></span></label>)}</div>
              <pre className={s.shareStatPreview} aria-label="共有する内容のプレビュー">{shareStatsText}</pre>
              <button className={s.primary} disabled={shareStatIds.length === 0} onClick={shareLearningStats}>共有先を選ぶ<Icon name="arrow" size={19}/></button>
              {shareStatsStatus && <p className={s.shareStatStatus} role="status">{shareStatsStatus}</p>}
              <small>共有記録は自己申告です。学習実績・資格・能力の証明ではありません。公開ランキングは未対応です。</small>
            </div>}
          </article>
          <article className={s.whiteCard}><h2>今週のあしあと</h2>{calendar}<p>今週 {activeThisWeek} 日学習</p></article>
          <article className={s.about}>
            <h2>この冒険について</h2>
            <p>介護福祉士国家試験の出題基準を参考にした五択のオリジナル問題を、全18問収録しています。所要時間はまだ測定していません。過去問や対策本の問題文は転載していません。出題基準と公的資料を参考に独自に作成した問題であり、国家試験と同等の難易度や全範囲を保証するものではありません。</p>
            <p>実技や医療・介護判断の代わりにはなりません。実際の支援は本人の意向、現場の手順、指導者への確認を大切にしてください。専門職の問題監修と学習者の試遊はこれからです。</p>
            <h3>保存とプライバシー</h3>
            <p>{saving} Google認証のみ利用します。介護記録・利用者情報は入力しないでください。広告・課金・行動分析SDKはありません。</p>
            <h3>参考資料一覧</h3>
            <p>この体験版のオリジナル問題は、以下の公開資料を確認して作成しています。市販対策本の設問・選択肢は転載していません。試験センターの公開過去問は教育目的等の条件下で利用できますが、文言は変更できず、古い問題は法改正等で成立しない場合があり、独自解説にはセンターと無関係である旨が必要です。</p>
            <div className={s.referenceList}>{content.referenceSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (!nativeApp) return; event.preventDefault(); void Browser.open({ url: source.url }); }}><strong>{source.title}</strong><span>{source.organization} · {source.description}</span><small>資料を開く ↗</small></a>)}</div>
          </article>
        </section>}
        </ScreenSurface>
      </div>
      <aside className={s.rightRail}><article className={s.goalCard}><div className={s.goalIcon}><Icon name={doneToday ? "check" : "flag"} size={24}/></div><h2>{doneToday ? "今日の目標 達成" : "今日の目標"}</h2><div className={s.goalTrack}><i style={{ width: `${doneToday ? 100 : 0}%` }}/></div><small>{doneToday ? "1 / 1 問" : "0 / 1 問"} · 連続 {streak} 日</small></article><article className={s.whiteCard}><h2>今週のあしあと<span>{activeThisWeek}日</span></h2>{calendar}</article><p className={s.railNote}>実技は指導者と学びます。<br/>国家試験の全範囲や合格を保証するものではありません。</p><p className={s.saveNote}>{saving}</p></aside>
      <div className={s.bottomNav}>{nav}</div>
    </div> : screen === "lesson" && session && lesson && question ? <ScreenSurface key={`lesson:${question.id}`} view={`lesson:${question.id}`}><section className={s.lessonScreen} aria-label="レッスン">
      <header className={s.lessonHeader}><button className={s.iconButton} onClick={() => goHome()} aria-label="途中で閉じてマップへ戻る"><Icon name="close"/></button><div className={s.lessonProgress} role="progressbar" aria-label="レッスンの進み具合" aria-valuemin={0} aria-valuemax={lesson.questions.length} aria-valuenow={session.questionIndex + Number(session.checked && session.selected === question.correctIndex)}><i style={{ width: `${(session.questionIndex + Number(session.checked && session.selected === question.correctIndex)) / lesson.questions.length * 100}%` }}/></div><strong>{session.questionIndex + 1}<small> / {lesson.questions.length}</small></strong></header>
      <div className={s.questionBody}><div className={s.lessonLabel}><span>レッスン {String(lessons.indexOf(lesson) + 1).padStart(2, "0")}</span><span>{lesson.skill}</span></div><div className={s.sceneChip}><Icon name="leaf" size={16}/>{lesson.place}</div><p className={s.examArea}>出題領域：{question.examArea} · オリジナル五択</p><h1 ref={heading} tabIndex={-1}>{question.prompt}</h1><p className={s.questionHint}>最も適切だと思うものを、ひとつ選ぼう。</p><div className={s.answers}>{question.options.map((option, i) => <button key={option.text} className={`${s.answer} ${session.selected === i ? s.selectedAnswer : ""} ${session.checked && session.selected === i ? i === question.correctIndex ? s.correctAnswer : s.retryAnswer : ""}`} aria-pressed={session.selected === i} disabled={session.checked} onClick={() => setSave((prev) => selectAnswer(prev, i, lessons))}><span>{session.checked && session.selected === i && i === question.correctIndex ? <Icon name="check" size={18}/> : ["1", "2", "3", "4", "5"][i]}</span><strong>{option.text}</strong></button>)}</div></div>
      <footer className={`${s.lessonFooter} ${session.checked ? session.selected === question.correctIndex ? s.goodFeedback : s.softFeedback : ""}`}>
        <div className={s.feedbackInner}>
          {session.checked && session.selected !== null ? <div className={s.feedback} role="status">
            <span className={s.feedbackMark}><Icon name={session.selected === question.correctIndex ? "check" : "leaf"} size={22}/></span>
            <div><h2>{session.selected === question.correctIndex ? "正解" : "ここがポイント"}</h2><p>{question.options[session.selected].feedback}</p><p>{question.rationale}</p>
              {session.selected === question.correctIndex && !doneToday && <p className={s.dailyCredit}>次へ進むと今日の学びを記録 {dayAwardPreview.dailyCoins + dayAwardPreview.milestoneCoins > 0 ? `· +${dayAwardPreview.dailyCoins + dayAwardPreview.milestoneCoins} 灯石` : ""}</p>}
              {session.selected !== question.correctIndex && <p>正解は「{question.options[question.correctIndex].text}」。もう一度考えてみよう。</p>}
            </div>
          </div> : <p className={s.beforeAnswer}>ひとつ選んで、確かめよう。</p>}
          <button className={s.primary} disabled={session.selected === null} onClick={() => answerAction()}>{!session.checked ? "答えを確かめる" : session.selected !== question.correctIndex ? "もう一度、選んでみる" : session.questionIndex === lesson.questions.length - 1 ? "学びと報酬を受け取る" : "次へ"}<Icon name="arrow" size={20}/></button>
          {session.checked && session.selected === question.correctIndex && session.questionIndex < lesson.questions.length - 1 && <button className={s.pauseLesson} onClick={() => answerAction(true)}>今日はここで一区切り<small>進み具合を保存して戻る</small></button>}
          <p className={s.footerTiny}>時間制限なし · 途中でも保存されます{storageProblem ? "（現在、保存できません）" : ""}</p>
        </div>
      </footer>
    </section></ScreenSurface> : reward ? <ScreenSurface key="reward" view="reward"><section className={s.rewardScreen}><div className={s.rewardEmblem}><Lantern/><i>✦</i><b>✧</b></div><h1 ref={heading} tabIndex={-1}>{reward.awards.lessonXp ? "レッスンクリア" : "復習完了"}</h1><p>{reward.awards.lessonXp ? "新しい学びカードを手に入れました。" : reward.awards.dailyCoins || reward.awards.milestoneCoins ? "今日の学びに、灯石が届きました。" : "おさらい完了。今日のあしあとを残しました。"}</p><article className={s.rewardCard}><span>学習カード {String(lessons.indexOf(reward.lesson) + 1).padStart(2, "0")}</span><Icon name="leaf" size={32}/><h2>{reward.lesson.skill}</h2><p>{reward.lesson.card}</p><small>はじまりの庭 · {reward.lesson.title}</small></article><div className={s.rewardStats}><span><Icon name="spark" size={19}/>{reward.awards.lessonXp ? `+${reward.awards.lessonXp} XP` : "おさらい完了"}</span><span><Icon name="wear" size={19}/>+{reward.awards.lessonCoins + reward.awards.dailyCoins + reward.awards.milestoneCoins} 灯石</span><span><Icon name="path" size={19}/>{save.completed.length} / {lessons.length} 歩</span></div>{reward.awards.milestoneCoins > 0 && <p className={s.rewardMilestone}>学習日数 {reward.awards.newMilestone} 日達成！ ボーナス +{reward.awards.milestoneCoins} 灯石</p>}{reward.awards.gearReward && <article className={s.gearRewardCard}><EquipmentGlyph item={reward.awards.gearReward} large/><span>新しい装備 · {RARITY_LABEL[reward.awards.gearReward.rarity]}</span><strong>{reward.awards.gearReward.name}</strong><small>{SLOT_LABEL[reward.awards.gearReward.slot]}に装備できる · Lv.{reward.awards.gearReward.requiredLevel}</small></article>}{reward.awards.previousLevel < reward.awards.newLevel && <p className={s.rewardMilestone}>レベルアップ Lv.{reward.awards.newLevel}に上がりました。</p>}{reward.awards.legendUnlocked && <p className={s.legendUnlock}>章を踏破！「灯都の継灯剣」が装備コレクションに加わりました。学びの記念アイテムです。</p>}<button className={s.primary} onClick={() => goHome()}>マップへ戻る<Icon name="arrow" size={20}/></button><button className={s.textButton} onClick={() => goHome("wardrobe")}>衣装を見に行く · 灯石 {save.coins}</button><button className={s.textButton} onClick={() => goHome("cards")}>学びの図鑑を見る</button></section></ScreenSurface> : null}
  </div>;
}
