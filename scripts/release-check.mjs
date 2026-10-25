import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const failures = [];
if (config.name !== "lumina-care-rpg") failures.push("LUMINA専用Worker名ではありません");
const db = config.d1_databases?.find(value => value.binding === "DB");
if (db?.database_name !== "lumina-db" || !/^[a-f0-9-]{36}$/i.test(db?.database_id ?? "") || db?.database_id === "00000000-0000-0000-0000-000000000000") failures.push("LUMINA専用D1の実IDを設定してください");
try {
  const origin = new URL(config.vars?.APP_ORIGIN);
  if (origin.protocol !== "https:" || origin.origin !== config.vars.APP_ORIGIN || /(^|\.)(localhost|example|invalid|test)$/.test(origin.hostname)) throw new Error();
} catch { failures.push("APP_ORIGINにLUMINA専用の実HTTPSオリジンを設定してください"); }
if (!config.ratelimits?.some(value => value.name === "AUTH_RATE_LIMITER")) failures.push("AUTH_RATE_LIMITERの専用bindingを設定してください");
if (failures.length) { failures.forEach(value => console.error(`公開停止: ${value}`)); process.exitCode = 1; }
else console.log("LUMINAの公開先設定を確認。OAuth秘密値・アカウント所有権は別途確認が必要です。");
