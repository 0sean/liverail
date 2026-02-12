import { clsx, type ClassValue } from "clsx"
import { compareAsc, formatDuration, intervalToDuration } from "date-fns";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: string) {
  return `${date.slice(0, 2)}:${date.slice(2, 4)}`;
}

export function formatDistanceExact(dateLeft: Date, dateRight: Date) {
  const [start, end] = compareAsc(dateLeft, dateRight) <= 0 ? [dateLeft, dateRight] : [dateRight, dateLeft];
  const duration = intervalToDuration({ start, end });
  const formatted = formatDuration(duration, { format: ["years", "months", "days", "hours", "minutes"] });

  return formatted || "less than a minute";
}
