import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style class merger: combine clsx + tailwind-merge for conflict-aware className composition. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Debounce a function. Returns a wrapper that delays invocation until `wait` ms have elapsed since the last call. */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Format an ISO timestamp for display. Falls back to the raw string if parsing fails. */
export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
