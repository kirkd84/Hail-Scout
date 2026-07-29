/**
 * Canvassing marker model — the mobile mirror of the web app's
 * `hailscout-web/src/lib/markers.ts`.
 *
 * Markers live server-side (`/v1/markers`, org-scoped), so a pin dropped in
 * the truck shows up on the web map and vice-versa. The status ids and
 * colors below MUST stay identical to the web list or the two clients would
 * render the same pin differently.
 */

export type MarkerStatus =
  | "lead"
  | "knocked"
  | "no_answer"
  | "appt"
  | "contract"
  | "not_interested";

export interface Marker {
  id: string;
  lng: number;
  lat: number;
  status: MarkerStatus;
  notes?: string;
  assignee_user_id?: string | null;
  /** ISO timestamp. */
  created_at: string;
  /** ISO timestamp. */
  updated_at: string;
}

export const MARKER_STATUSES: {
  id: MarkerStatus;
  label: string;
  color: string;
  outline: string;
}[] = [
  { id: "lead", label: "Lead", color: "#3B82F6", outline: "#1D4ED8" },
  { id: "knocked", label: "Knocked", color: "#EAB308", outline: "#A16207" },
  { id: "no_answer", label: "No answer", color: "#6B7280", outline: "#374151" },
  { id: "appt", label: "Appointment", color: "#A855F7", outline: "#6B21A8" },
  { id: "contract", label: "Contract", color: "#22C55E", outline: "#15803D" },
  { id: "not_interested", label: "Not interested", color: "#EF4444", outline: "#991B1B" },
];

export function statusInfo(status: MarkerStatus) {
  return MARKER_STATUSES.find((s) => s.id === status) ?? MARKER_STATUSES[0];
}

/** Flat [status, color, …] pairs for a MapLibre `match` expression. */
export const STATUS_COLOR_PAIRS: string[] = MARKER_STATUSES.flatMap((s) => [
  s.id,
  s.color,
]);
