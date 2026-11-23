import type { BusinessHours } from "./availability";

const SHORT_DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

const clock = (minute: number) => `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")}`;

/** "lun–sáb 9:00–13:00 y 14:00–20:00; dom cerrado": días seguidos con los mismos tramos, de lunes a domingo. */
export function describeWeeklyHours(weekly: readonly (readonly BusinessHours[])[]): string {
  if (!weekly.some((d) => d.length > 0)) return "";
  const groups: { first: number; last: number; text: string }[] = [];
  for (const day of MONDAY_FIRST) {
    const hours = weekly[day] ?? [];
    const text = hours.length ? hours.map((h) => `${clock(h.openMinute)}–${clock(h.closeMinute)}`).join(" y ") : "cerrado";
    const last = groups.at(-1);
    if (last?.text === text) last.last = day;
    else groups.push({ first: day, last: day, text });
  }
  return groups.map((g) => `${g.first === g.last ? SHORT_DAYS[g.first] : `${SHORT_DAYS[g.first]}–${SHORT_DAYS[g.last]}`} ${g.text}`).join("; ");
}
