import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Minimal production server for the Docker image (docker-compose.yml).
  output: "standalone",
};

const withMDX = createMDX({
  options: {
    // String form + serializable options: required by Turbopack. Dual shiki
    // themes ride the site's light/dark switch via CSS in globals.css.
    rehypePlugins: [
      [
        "rehype-pretty-code",
        {
          theme: { light: "github-light", dark: "github-dark" },
          keepBackground: false,
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
