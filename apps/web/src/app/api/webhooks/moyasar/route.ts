import { adminClient } from "@/lib/admin-client";
import { syncInvoice, webhookInvoiceId, webhookTokenValid } from "@/lib/services/billing";

/**
 * Moyasar webhook (dashboard: Settings, Webhooks; shared secret = MOYASAR_WEBHOOK_SECRET). Needs a public HTTPS URL.
 * The body is only used to find the invoice: status and amount are re-fetched from Moyasar before anything is activated, and
 * processing is idempotent, so replayed or duplicate events are harmless.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { secret_token?: unknown } | null;
  if (!webhookTokenValid(body?.secret_token)) return new Response("unauthorized", { status: 401 });
  const invoiceId = webhookInvoiceId(body);
  if (!invoiceId) return new Response("ignored", { status: 200 });
  const r = await syncInvoice(adminClient(), invoiceId);
  // A 5xx makes Moyasar retry; "unknown payment" is final (200) so it does not retry forever.
  return new Response(r.ok ? "ok" : r.kind === "error" ? "retry" : "ignored", { status: r.ok || r.kind !== "error" ? 200 : 500 });
}
