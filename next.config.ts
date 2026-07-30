import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Minimal production server for the Docker image (docker-compose.yml).
  output: "standalone",
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
