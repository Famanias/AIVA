import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['bullmq', 'ioredis'],
  experimental: {
    instrumentationHook: true,
  }
};

export default nextConfig;
