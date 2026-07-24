import type { ComponentType } from "react";

/**
 * Content-loader abstraction: pages consume these functions, never read
 * files directly. Swapping in a headless CMS later means changing only
 * this module's implementation, not the pages that call it.
 *
 * Schedule and FAQ content moved to the ScheduleEvent/FaqEntry Prisma models
 * (admin-editable); the rulebook has no editing requirement yet, so it stays
 * MDX here.
 */

export async function loadRulebook(): Promise<ComponentType> {
  const mod = await import("../../content/rules/rulebook.mdx");
  return mod.default;
}
