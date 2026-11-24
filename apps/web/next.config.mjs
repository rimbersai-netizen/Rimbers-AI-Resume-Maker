/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@gars/localization", "@gars/resume-schema", "@gars/shared-types", "@gars/validation", "@gars/country-rules", "@gars/template-engine", "@gars/subscriptions", "@gars/ats-engine", "@gars/resume-builder", "@gars/ai-engine"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Clickjacking protection everywhere except the template preview pages, which the gallery embeds from the same origin.
      { source: "/((?!templates/preview/).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
      { source: "/templates/preview/:id", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};
