import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { MasterProfile } from "@gars/resume-schema";
import { extractResumeText, mergeImported } from "./resume-import";
import { toDraft } from "../profile-draft";

/** A tiny but valid one-page PDF with a text layer, built byte-exact so the xref offsets are right. */
function pdfWith(lines: string[]): Uint8Array {
  const stream = "BT /F1 12 Tf 14 TL 50 750 Td " + lines.map((l) => `(${l.replace(/[()\\]/g, "")}) Tj T*`).join(" ") + " ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n"; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}
const LINES = ["Sara Khan - Software Engineer", "sara.khan@example.com", "EXPERIENCE Senior Flutter Developer at Acme Labs from March 2021 to present", "Built the checkout flow for forty thousand customers"];

describe("extractResumeText", () => {
  it("reads a text-layer PDF", async () => {
    const r = await extractResumeText({ name: "cv.pdf", type: "application/pdf", bytes: pdfWith(LINES) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toMatch(/Sara Khan.*Acme Labs/s);
  });
  it("reads plain text", async () => {
    const t = "Sara Khan\n".padEnd(120, "x ");
    const r = await extractResumeText({ name: "cv.txt", type: "text/plain", bytes: new TextEncoder().encode(t) });
    expect(r.ok).toBe(true);
  });
  it("rejects empty, huge, unsupported and unreadable files with a friendly message", async () => {
    expect(await extractResumeText({ name: "a.pdf", type: "", bytes: new Uint8Array() })).toMatchObject({ ok: false });
    expect(await extractResumeText({ name: "a.pdf", type: "", bytes: new Uint8Array(6 * 1024 * 1024) })).toMatchObject({ ok: false, message: expect.stringContaining("too large") });
    expect(await extractResumeText({ name: "a.png", type: "image/png", bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) })).toMatchObject({ ok: false, message: expect.stringContaining("PDF or Word") });
    expect(await extractResumeText({ name: "bad.pdf", type: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.4 garbage") })).toMatchObject({ ok: false });
  });
});

describe("mergeImported", () => {
  const imported = toDraft({ schemaVersion: 1, personal: { fullName: "Sara Khan", email: "sara@example.com", location: { city: "Islamabad" } }, summary: "Imported summary text.",
    experience: [{ id: "11111111-1111-4111-8111-111111111111", employer: "Acme", title: "Dev", dates: { current: false }, bullets: [] }], education: [], skills: [{ id: "22222222-2222-4222-8222-222222222222", name: "Dart" }] });
  const current = toDraft({ schemaVersion: 1, personal: { fullName: "Sara K", phone: "123", photoPath: "p/1.jpg", location: {} }, experience: [{ id: "33333333-3333-4333-8333-333333333333", employer: "Old", title: "Old role", dates: { current: false }, bullets: [] }] });

  it("replace takes the CV but keeps the photo", () => {
    const m = mergeImported(current, imported, "replace");
    expect(m.experience[0]!.employer).toBe("Acme");
    expect(m.personal.photoPath).toBe("p/1.jpg");
    expect(MasterProfile.safeParse(m).success).toBe(true);
  });
  it("fill only adds what is missing", () => {
    const m = mergeImported(current, imported, "fill");
    expect(m.experience[0]!.employer).toBe("Old");
    expect(m.personal.fullName).toBe("Sara K");
    expect(m.personal.email).toBe("sara@example.com");
    expect(m.personal.phone).toBe("123");
    expect(m.skills.map((s) => s.name)).toEqual(["Dart"]);
    expect(m.summary).toBe("Imported summary text.");
  });
});
