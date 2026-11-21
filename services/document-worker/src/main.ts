/** Long-running export worker. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-side secret only). */
import { createClient } from "@supabase/supabase-js";
import { closeBrowser } from "./pdf";
import { runOnce } from "./worker";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });
let stopping = false;
const stop = async () => { stopping = true; await closeBrowser(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);

console.log(`document-worker started (${new URL(url).host})`);
while (!stopping) {
  try {
    const worked = await runOnce(db);
    if (!worked) await new Promise((r) => setTimeout(r, 1500));
  } catch (e) {
    console.error((e as Error).message);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
