/**
 * Compact "5m / 1h / 3d" relative-time formatter for the activity feed.
 */

export function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "—";
  const now = Date.now();
  const diff = now - ts;

  if (diff < 0) return "now";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function isLiveByTime(startIso: string, withinMs = 2 * 60 * 60 * 1000): boolean {
  const ts = new Date(startIso).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < withinMs;
}

export interface SoLStatus {
  /** Which anniversary deadline is approaching: 1-year or 2-year. */
  deadline: 1 | 2;
  /** Whole days until that deadline (>= 0). */
  daysUntil: number;
  /** The calendar deadline date. */
  deadlineDate: Date;
}

/**
 * Statute-of-limitations radar. A hail claim's window typically closes 1 or 2
 * years after the storm (varies by state/policy). Returns the nearest upcoming
 * anniversary that falls within `windowDays`, else null. Calendar-accurate
 * (handles leap years via setFullYear), so it lines up with the real date.
 */
export function statuteStatus(startIso: string, windowDays = 60): SoLStatus | null {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const now = Date.now();
  const DAY = 86_400_000;
  for (const yrs of [1, 2] as const) {
    const deadline = new Date(start);
    deadline.setFullYear(start.getFullYear() + yrs);
    const daysUntil = Math.ceil((deadline.getTime() - now) / DAY);
    if (daysUntil >= 0 && daysUntil <= windowDays) {
      return { deadline: yrs, daysUntil, deadlineDate: deadline };
    }
  }
  return null;
}
