import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/generated/prisma/*.node"],
    "/insights/**/*": ["./src/generated/prisma/*.node"],
    "/u/**/*": ["./src/generated/prisma/*.node"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
