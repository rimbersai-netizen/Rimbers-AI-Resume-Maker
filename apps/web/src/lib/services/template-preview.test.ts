import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./profile", () => ({ loadPrimaryProfileCore: vi.fn() }));
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@gars/template-engine";
import { MasterProfile } from "@gars/resume-schema";
import { loadPrimaryProfileCore } from "./profile";
import { toDraft } from "../profile-draft";
import { templatePreview } from "./template-preview";

const mine = MasterProfile.parse({ schemaVersion: 1, personal: { fullName: "Aliza Saeed", professionalTitle: "Flutter Developer" },
  experience: [{ id: "11111111-1111-4111-8111-111111111111", employer: "Acme Mobile", title: "Flutter Developer", dates: { start: "2020-01", current: true }, bullets: [] }] });
const empty = toDraft({});
const user = { id: "u" } as never, db = {} as never;

describe("template previews", () => {
  it("renders every template with the sample persona when nobody is signed in", async () => {
    for (const t of TEMPLATES) {
      const r = await templatePreview(null, null, t.id, "http://x");
      expect(r?.source, t.id).toBe("sample");
      expect(r?.html, t.id).toContain("Alex Morgan");
      expect(r?.html, t.id).toContain("Northwind Labs");
      expect(r?.html, t.id).toContain('content="width=820"');
    }
  });
  it("uses the signed-in user's own saved data when the profile has content", async () => {
    vi.mocked(loadPrimaryProfileCore).mockResolvedValue({ id: "p", updatedAt: "x", profile: mine });
    for (const t of TEMPLATES.slice(0, 12)) {
      const r = await templatePreview(db, user, t.id, "http://x");
      expect(r?.source).toBe("profile");
      expect(r?.html).toContain("Aliza Saeed");
      expect(r?.html).toContain("Acme Mobile");
      expect(r?.html).not.toContain("Alex Morgan");
    }
  });
  it("falls back to the sample for an empty profile, and rejects unknown templates", async () => {
    vi.mocked(loadPrimaryProfileCore).mockResolvedValue({ id: "p", updatedAt: "x", profile: empty });
    expect((await templatePreview(db, user, TEMPLATES[0]!.id, "http://x"))?.source).toBe("sample");
    expect(await templatePreview(null, null, "no-such-template", "http://x")).toBeNull();
  });
});
