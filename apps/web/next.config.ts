import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "export",  // Disabled for now — dynamic routes need runtime. Will re-enable with generateStaticParams.
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
