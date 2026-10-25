// Vite development-only entry; this HTML is not a production build input.
import { createRoot } from "react-dom/client";
import { MinuteJourney } from "../app/lumina/MinuteJourney";
import { emptySave, emptyJourneyStats } from "../app/lumina/minute-engine";
import { createAccountStorage, setAccountStorage } from "./cloud-storage";
import "./app.css";
if (!import.meta.env.DEV) throw new Error("Development UI fixture only");
const memory = new Map<string,string>();
let revision = 0;
setAccountStorage(createAccountStorage("anonymous-ui-fixture", {revision,save:emptySave(),stats:emptyJourneyStats()}, "fixture-csrf", {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key,value) => { memory.set(key,value); },
  removeItem: (key) => { memory.delete(key); },
}, async () => Response.json({revision:++revision})));
createRoot(document.getElementById("root")!).render(<><div style={{padding:"8px",background:"#fff1cc",textAlign:"center",fontSize:"12px"}}>匿名UI検証 · Googleログイン／本番D1の検証ではありません</div><MinuteJourney/></>);
