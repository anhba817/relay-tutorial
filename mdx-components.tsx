import type { MDXComponents } from "mdx/types";

import { slugifyHeading, textOf } from "@/components/docs/doc-article";
import { CodeBlock } from "@/components/tutorial/code-block";

// Required by @next/mdx with the App Router. Base HTML elements inherit the
// chapter shell's `prose` styling; tutorial box components are imported
// explicitly in each chapter instead of being injected here.
//
// h2 gets a stable slugged id (the same rule the reference-doc renderer uses)
// so the on-this-page rail can anchor chapter sections without any chapter
// file being edited (feature 012, FR-004).
const components: MDXComponents = {
  h2: ({ children, ...props }) => (
    <h2 id={slugifyHeading(textOf(children))} {...props}>
      {children}
    </h2>
  ),
  // Code fences get the copy-button chrome (highlighting itself happens at
  // build time via rehype-pretty-code — see next.config.ts).
  pre: (props) => <CodeBlock {...props} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
