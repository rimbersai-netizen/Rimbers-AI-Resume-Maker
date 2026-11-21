/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@gars/localization", "@gars/resume-schema", "@gars/shared-types", "@gars/validation", "@gars/country-rules"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
