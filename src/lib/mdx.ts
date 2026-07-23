import type { ComponentType } from "react";
import scheduleData from "../../content/schedule/schedule.json";

/**
 * Content-loader abstraction: pages consume these functions, never read
 * files directly. Swapping in a headless CMS later means changing only
 * this module's implementation, not the pages that call it.
 */

export async function loadRulebook(): Promise<ComponentType> {
  const mod = await import("../../content/rules/rulebook.mdx");
  return mod.default;
}

export async function loadFaq(): Promise<ComponentType> {
  const mod = await import("../../content/faq/faq.mdx");
  return mod.default;
}

export interface ScheduleItem {
  date: string;
  title: string;
  description: string;
}

export async function loadSchedule(): Promise<ScheduleItem[]> {
  return scheduleData as ScheduleItem[];
}
