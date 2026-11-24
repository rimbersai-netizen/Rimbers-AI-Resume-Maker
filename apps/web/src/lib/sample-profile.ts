import { MasterProfile } from "@gars/resume-schema";

/** Clearly fictional persona used only to preview templates when the signed-in user has not filled in their profile yet. */
export const SAMPLE_PROFILE = MasterProfile.parse({
  schemaVersion: 1,
  personal: {
    fullName: "Alex Morgan", professionalTitle: "Senior Product Designer", email: "alex.morgan@example.com", phone: "+1 555 010 2030",
    location: { city: "London", country: "GB" }, linkedin: "https://linkedin.com/in/alex-morgan", website: "https://alexmorgan.example.com",
  },
  summary: "Product designer with 8 years of experience shaping web and mobile products from research to launch. Leads small cross-functional teams and keeps design systems consistent and accessible.",
  experience: [
    { id: "11111111-1111-4111-8111-111111111111", employer: "Northwind Labs", title: "Senior Product Designer", location: "London", dates: { start: "2021-03", current: true },
      bullets: [
        { id: "a1111111-1111-4111-8111-111111111111", text: "Led the redesign of the onboarding flow, simplifying 9 steps to 4", provenance: "user" },
        { id: "a2222222-1111-4111-8111-111111111111", text: "Built and maintained a design system used by 3 product teams", provenance: "user" },
        { id: "a3333333-1111-4111-8111-111111111111", text: "Ran weekly usability sessions and turned findings into prioritised fixes", provenance: "user" },
      ] },
    { id: "22222222-2222-4222-8222-222222222222", employer: "Brightside Studio", title: "Product Designer", location: "Manchester", dates: { start: "2017-06", end: "2021-02" },
      bullets: [
        { id: "b1111111-2222-4222-8222-222222222222", text: "Designed mobile and web interfaces for 12 client projects", provenance: "user" },
        { id: "b2222222-2222-4222-8222-222222222222", text: "Introduced prototyping and design reviews across the studio", provenance: "user" },
      ] },
  ],
  education: [{ id: "33333333-3333-4333-8333-333333333333", institution: "University of Leeds", qualification: "BA Design", field: "Interaction Design", dates: { start: "2013-09", end: "2016-06" } }],
  skills: ["Figma", "Design systems", "User research", "Prototyping", "Accessibility", "HTML & CSS"].map((name, i) => ({ id: `4444444${i}-4444-4444-8444-444444444444`, name })),
  languages: [{ id: "55555555-5555-4555-8555-555555555555", language: "English", proficiency: "native" }, { id: "66666666-6666-4666-8666-666666666666", language: "French", proficiency: "B2" }],
});
