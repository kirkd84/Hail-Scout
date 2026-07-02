"use client";

/**
 * Alarm sound ladder — the sound IS the damage report.
 *
 *   < 1.25"  thud     marble on shingles
 *   < 1.75"  thunk    golf ball on a hood
 *   < 2.25"  crack    windshield chip
 *   < 3.0"   glass    glass crack + ring
 *   ≥ 3.0"   shatter  full glass shatter
 *   wind     gust howl (zone wind alerts)
 *   chaching optional "revenue mode" layer on 2"+ zone hits
 *
 * Files are procedurally generated WAVs (scripts/gen-alarm-sounds.cjs);
 * swap any file in public/sounds/ for a studio sample without touching
 * this module. Preferences persist in localStorage.
 */

export type AlarmSoundName =
  | "thud"
  | "thunk"
  | "crack"
  | "glass"
  | "shatter"
  | "wind"
  | "chaching";

export interface AlarmPrefs {
  muted: boolean;
  volume: number; // 0..1
  chaching: boolean;
}

const PREFS_KEY = "hs.alarm.prefs";

export function getAlarmPrefs(): AlarmPrefs {
  if (typeof window === "undefined") {
    return { muted: false, volume: 0.8, chaching: false };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AlarmPrefs>;
      return {
        muted: !!p.muted,
        volume: typeof p.volume === "number" ? Math.max(0, Math.min(1, p.volume)) : 0.8,
        chaching: !!p.chaching,
      };
    }
  } catch {
    /* corrupted prefs — fall through to defaults */
  }
  return { muted: false, volume: 0.8, chaching: false };
}

export function setAlarmPrefs(patch: Partial<AlarmPrefs>): AlarmPrefs {
  const next = { ...getAlarmPrefs(), ...patch };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* private mode etc. */
  }
  return next;
}

export function soundForSize(sizeIn: number): AlarmSoundName {
  if (sizeIn >= 3.0) return "shatter";
  if (sizeIn >= 2.25) return "glass";
  if (sizeIn >= 1.75) return "crack";
  if (sizeIn >= 1.25) return "thunk";
  return "thud";
}

/** Play one alarm sound, honoring the saved prefs. Best-effort — browsers
 * block autoplay until the user has interacted with the page; we swallow
 * that rejection (the toast still shows). */
export function playAlarm(
  name: AlarmSoundName,
  opts: { ignoreMute?: boolean; volume?: number } = {},
): void {
  if (typeof window === "undefined") return;
  const prefs = getAlarmPrefs();
  if (prefs.muted && !opts.ignoreMute) return;
  try {
    const audio = new Audio(`/sounds/${name}.wav`);
    audio.volume = opts.volume ?? prefs.volume;
    void audio.play().catch(() => {
      /* autoplay blocked pre-interaction — fine */
    });
  } catch {
    /* no Audio support */
  }
}

/** Severity sound for an alert (+ optional cha-ching layer on big zone
 * hits when "revenue mode" is on). */
export function playAlarmForAlert(alert: {
  peak_size_in: number;
  kind?: string;
}): void {
  const kind = alert.kind ?? "address";
  const name =
    kind === "zone_wind" ? "wind" : soundForSize(alert.peak_size_in);
  playAlarm(name);
  const prefs = getAlarmPrefs();
  if (prefs.chaching && kind === "zone_hail" && alert.peak_size_in >= 2.0) {
    window.setTimeout(() => playAlarm("chaching"), 350);
  }
}
