import type { MDXComponents } from "mdx/types";
import { MazeAnatomy } from "@/components/rules/MazeAnatomy";
import { RobotFootprint } from "@/components/rules/RobotFootprint";
import { RunComparison } from "@/components/rules/RunComparison";

// Required by @next/mdx for App Router: provides the component overrides
// used when rendering any imported .mdx file.
//
// The rules diagrams are registered here rather than imported by the rulebook
// itself, so the content file stays readable as content — `<MazeAnatomy />`
// between two paragraphs, with no import block at the top for whoever edits the
// rules next.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    MazeAnatomy,
    RobotFootprint,
    RunComparison,
    // Last, so a caller passing its own overrides still wins.
    ...components,
  };
}
