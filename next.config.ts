import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables unauthorized() and forbidden() for auth interrupts in Server Components.
    authInterrupts: true,
    // Enables React's ViewTransition component + deeper Next.js integration.
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
    ],
  },
};

export default nextConfig;
