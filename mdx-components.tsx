import type { MDXComponents } from "mdx/types";

// Required by @next/mdx with the App Router. Base HTML elements inherit the
// chapter shell's `prose` styling; tutorial box components are imported
// explicitly in each chapter instead of being injected here.
const components: MDXComponents = {};

export function useMDXComponents(): MDXComponents {
  return components;
}
