import type { MDXComponents } from "mdx/types";

// Required by @next/mdx for App Router: provides the component overrides
// used when rendering any imported .mdx file.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return components;
}
