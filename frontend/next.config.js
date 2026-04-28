/** @type {import('next').NextConfig} */

// Backend URL for server-side rewrites. In docker-compose dev the internal
// hostname `backend:8000` resolves; production deployments override via env.
const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

const nextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // Proxy form PDF endpoints through Next.js so the iframe loads same-origin.
  // In production (nginx), /api/* and / are already same-origin; this rewrite
  // only matters for the dev environment.
  async rewrites() {
    return [
      {
        source: "/api/forms/:path*",
        destination: `${BACKEND_URL}/api/forms/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
