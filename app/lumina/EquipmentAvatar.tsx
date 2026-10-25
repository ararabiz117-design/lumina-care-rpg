import { useEffect, useRef } from "react";
import { EQUIPMENT_BY_ID, EQUIPMENT_SLOTS, equipmentSpriteFor, STARTER_EQUIPPED, type EquipmentItem, type EquipmentSlot, type EquipmentSprite } from "./equipment";
import { avatarEquipmentLayers, AVATAR_PIXEL_SIZE } from "./avatar-layers";
import type { EquipmentLoadout } from "./minute-engine";
import s from "./minute.module.css";

const PIXEL_BASE_ASSET = "/assets/lumina/adventurer-pixel-cute-v2.png";
const imagePromises = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imagePromises.get(src);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`LUMINA avatar asset failed to load: ${src}`));
    image.src = src;
  });
  imagePromises.set(src, pending);
  pending.catch(() => imagePromises.delete(src));
  return pending;
}

const sourceBounds = new Map<string, { x: number; y: number; width: number; height: number }>();

function spriteSource(sprite: EquipmentSprite, image: HTMLImageElement, fragment?: "screen-left" | "screen-right", visibleHeight = 1) {
  const column = sprite.cell % sprite.columns;
  const row = Math.floor(sprite.cell / sprite.columns);
  const cellX = Math.round(column * image.naturalWidth / sprite.columns);
  const cellY = Math.round(row * image.naturalHeight / sprite.rows);
  const cellWidth = Math.round((column + 1) * image.naturalWidth / sprite.columns) - cellX;
  const cellHeight = Math.round((row + 1) * image.naturalHeight / sprite.rows) - cellY;
  const fragmentWidth = fragment ? cellWidth / 2 : cellWidth;
  const fragmentOffset = fragment === "screen-right" ? fragmentWidth : 0;
  const key = `${sprite.asset}:${sprite.cell}:${fragment ?? "whole"}:${visibleHeight}`;
  const cached = sourceBounds.get(key);
  if (cached) return cached;
  const sample = document.createElement("canvas");
  sample.width = Math.floor(fragmentWidth);
  sample.height = Math.floor(cellHeight * visibleHeight);
  const pixels = sample.getContext("2d", { willReadFrequently: true })!;
  pixels.drawImage(image, cellX + fragmentOffset, cellY, sample.width, sample.height, 0, 0, sample.width, sample.height);
  const rgba = pixels.getImageData(0, 0, sample.width, sample.height).data;
  let left = sample.width, top = sample.height, right = -1, bottom = -1;
  for (let y = 0; y < sample.height; y++) for (let x = 0; x < sample.width; x++) {
    // Ignore the very faint export halo; only actual artwork determines the mount.
    if (rgba[(y * sample.width + x) * 4 + 3] < 96) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  const bounds = right < left
    ? { x: cellX + fragmentOffset, y: cellY, width: sample.width, height: sample.height }
    : { x: cellX + fragmentOffset + left, y: cellY + top, width: right - left + 1, height: bottom - top + 1 };
  sourceBounds.set(key, bounds);
  return bounds;
}

/** Only skin/face belongs to the base. Clothes and footwear belong to slot layers. */
function drawBaseParts(context: CanvasRenderingContext2D, base: HTMLImageElement, head: EquipmentItem, bootOnly: boolean) {
  const w = AVATAR_PIXEL_SIZE.width, h = AVATAR_PIXEL_SIZE.height;
  context.save();
  context.beginPath();
  // Neck and bare forearms; never draw the underlying green shirt or boots.
  context.rect(w * .43, h * .26, w * .14, h * .07);
  context.moveTo(w * .31, h * .43); context.lineTo(w * .37, h * .47); context.lineTo(w * .28, h * .60); context.lineTo(w * .20, h * .59); context.closePath();
  context.moveTo(w * .69, h * .43); context.lineTo(w * .63, h * .47); context.lineTo(w * .72, h * .60); context.lineTo(w * .80, h * .59); context.closePath();
  if (bootOnly) context.rect(w * .29, h * .51, w * .42, h * .26);
  // Open crowns/bandanas show hair. Closed headwear replaces the entire crown.
  const open = head.art?.atlas === "bandana" || equipmentSpriteFor(head).cell === 2 || equipmentSpriteFor(head).cell === 4 || head.art?.atlas === "costumes";
  if (open) context.rect(w * .28, 0, w * .44, h * .29);
  else {
    context.moveTo(w * .37, h * .16); context.lineTo(w * .64, h * .16);
    context.lineTo(w * .66, h * .23); context.lineTo(w * .57, h * .28);
    context.lineTo(w * .44, h * .28); context.lineTo(w * .35, h * .23); context.closePath();
  }
  context.clip();
  context.drawImage(base, 0, 0, w, h);
  context.restore();
}

function drawEquipmentLayer(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  sprite: EquipmentSprite,
  anchor: { left: number; top: number; width: number; height: number; rotate?: number },
  fragment?: "screen-left" | "screen-right",
  visibleHeight = 1,
) {
  const source = spriteSource(sprite, image, fragment, visibleHeight);
  const width = anchor.width / 100 * AVATAR_PIXEL_SIZE.width;
  const height = anchor.height / 100 * AVATAR_PIXEL_SIZE.height;
  const left = anchor.left / 100 * AVATAR_PIXEL_SIZE.width;
  const top = anchor.top / 100 * AVATAR_PIXEL_SIZE.height;

  context.save();
  context.translate(left + width / 2, top + height / 2);
  context.rotate((anchor.rotate ?? 0) * Math.PI / 180);
  context.drawImage(image, source.x, source.y, source.width, source.height, -width / 2, -height / 2, width, height);
  context.restore();
}

function equipped(loadout: EquipmentLoadout, slot: EquipmentSlot): EquipmentItem {
  return EQUIPMENT_BY_ID.get(loadout[slot]) ?? EQUIPMENT_BY_ID.get(STARTER_EQUIPPED[slot])!;
}

/**
 * Inventory cards keep their detailed art. Worn gear replaces its body region:
 * the base contributes face/skin only, never a second shirt or pair of boots.
 */
export function EquipmentAvatar({ loadout, large = false, label }: { loadout: EquipmentLoadout; appearance?: unknown; large?: boolean; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const items = EQUIPMENT_SLOTS.map((slot) => equipped(loadout, slot));
  const description = label ?? items.map((item) => item.name).join("・");
  const weapon = equipped(loadout, "weapon");
  const loadoutKey = EQUIPMENT_SLOTS.map((slot) => loadout[slot]).join("|");

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    if (!canvas.dataset.ready) {
      canvas.width = AVATAR_PIXEL_SIZE.width;
      canvas.height = AVATAR_PIXEL_SIZE.height;
    }
    const layers = avatarEquipmentLayers(loadout);
    const requests = [loadImage(PIXEL_BASE_ASSET), ...layers.map(({ sprite }) => loadImage(`/assets/lumina/${sprite.asset}`))];

    Promise.all(requests).then(([base, ...layerImages]) => {
      if (cancelled) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;

      const imageByAsset = new Map<string, HTMLImageElement>();
      layers.forEach((layer, index) => imageByAsset.set(layer.sprite.asset, layerImages[index]));
      const capeLayers = layers.filter((layer) => layer.slot === "cape");
      for (const layer of capeLayers) {
        const image = imageByAsset.get(layer.sprite.asset);
        if (image) drawEquipmentLayer(context, image, layer.sprite, layer.anchor, layer.fragment);
      }

      const legLayer = layers.find((layer) => layer.slot === "legs")!;
      const bootOnly = legLayer.sprite.atlas === "legacyAscended" || (legLayer.sprite.atlas === "armor" && legLayer.sprite.cell === 14) || (legLayer.sprite.atlas === "costumes" && legLayer.sprite.cell === 3);
      drawBaseParts(context, base, equipped(loadout, "head"), bootOnly);

      for (const layer of layers) {
        if (layer.slot === "cape") continue;
        const image = imageByAsset.get(layer.sprite.asset);
        if (image) drawEquipmentLayer(context, image, layer.sprite, layer.anchor, layer.fragment,
          layer.slot === "body" && layer.sprite.atlas === "costumes" && layer.sprite.cell === 1 ? .64 : 1);
        // Inventory hoods have painted dark interiors, not transparent face holes.
        // Restore just the face inside that opening, never the hidden crown/hair.
        if (layer.slot === "head" && layer.sprite.atlas === "armor" && layer.sprite.cell === 1) {
          context.save();
          context.beginPath();
          context.ellipse(canvas.width * .51, canvas.height * .213, canvas.width * .12, canvas.height * .063, 0, 0, Math.PI * 2);
          context.clip();
          context.drawImage(base, 0, 0, canvas.width, canvas.height);
          context.restore();
        }
      }
      canvas.dataset.ready = "true";
    }).catch(() => {
      // Keep the transparent base sprite visible if an optional gear atlas is unavailable.
    });

    return () => { cancelled = true; };
  }, [loadoutKey]);

  return <span
    role="img"
    aria-label={"装備中：" + description}
    className={s.equipmentAvatar + " " + s.equipmentAvatarTall + (large ? " " + s.equipmentAvatarLarge : "")}
    data-pixel-avatar="true"
    data-weapon-rarity={weapon.rarity}
    data-weapon-style={weapon.weaponStyle ?? "club"}
  >
    <img className={s.avatarPixelBase} src={PIXEL_BASE_ASSET} alt="" aria-hidden="true" draggable={false}/>
    <canvas ref={canvasRef} className={s.equipmentAvatarCanvas} aria-hidden="true"/>
    {weapon.rarity !== "common" && weapon.rarity !== "uncommon" && <span className={s.avatarWeaponSparkles} data-rarity={weapon.rarity} aria-hidden="true"><i/><i/><i/></span>}
  </span>;
}

function spriteStyle(sprite: EquipmentSprite) {
  const column = sprite.cell % sprite.columns;
  const row = Math.floor(sprite.cell / sprite.columns);
  return {
    backgroundImage: "url(\"/assets/lumina/" + sprite.asset + "\")",
    backgroundSize: (sprite.columns * 100) + "% " + (sprite.rows * 100) + "%",
    backgroundPosition: (sprite.columns > 1 ? column / (sprite.columns - 1) * 100 : 0) + "% " + (sprite.rows > 1 ? row / (sprite.rows - 1) * 100 : 0) + "%",
  };
}

export function EquipmentGlyph({ item, large = false }: { item: EquipmentItem; large?: boolean }) {
  const sprite = equipmentSpriteFor(item);
  return <span className={s.equipmentGlyph + (large ? " " + s.equipmentGlyphLarge : "")} data-rarity={item.rarity} data-art={sprite.atlas} data-art-cell={sprite.cell} data-art-asset={sprite.asset} aria-hidden="true">
    <span className={s.equipmentSprite} style={spriteStyle(sprite)}/>
  </span>;
}
