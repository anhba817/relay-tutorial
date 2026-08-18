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
    //
    // GFM is not on by default: @mdx-js parses CommonMark, in which a pipe
    // table is just a paragraph full of pipes. Chapters 3.4 and 3.5 have real
    // tables, so the extension has to be asked for. remark-gfm was already a
    // dependency here — the reference-doc renderer (components/docs/doc-article
    // .tsx) passes it to react-markdown, which is why /docs tables rendered and
    // chapter tables did not.
    remarkPlugins: ["remark-gfm"],
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
