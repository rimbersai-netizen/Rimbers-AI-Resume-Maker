/** Long-running AI worker. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; optional OLLAMA_BASE_URL, AI_MODELS. */
import { createClient } from "@supabase/supabase-js";
import { defaultDeps, runOnce } from "./worker";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });
const deps = defaultDeps();
const health = await deps.provider.health();
console.log(`ai-worker started; AI primary=${deps.route.cloud?.enabled && deps.route.cloud.first ? `${deps.route.cloud.provider.name}:${deps.route.cloud.model} (local fallback)` : "local"}; ${deps.provider.name} ${health.ok ? `ok (${health.models.length} models)` : `UNAVAILABLE: ${health.error}`}; models=${deps.route.localModels.join(",")}`);
process.on("SIGINT", () => process.exit(0)); process.on("SIGTERM", () => process.exit(0));
for (;;) {
  try {
    if (!(await runOnce(db, deps))) await new Promise((r) => setTimeout(r, 1500));
  } catch (e) {
    console.error((e as Error).message);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
