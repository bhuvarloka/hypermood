import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables unauthorized() and forbidden() for auth interrupts in Server Components.
    authInterrupts: true,
  },
};

export default nextConfig;
