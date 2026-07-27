import type { NextConfig } from "next";

const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      {
        source: "/servers",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
