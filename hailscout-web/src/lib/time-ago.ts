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
