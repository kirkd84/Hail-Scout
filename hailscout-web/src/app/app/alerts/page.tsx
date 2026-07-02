"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import {
  useAlertZones,
  type AlertZone,
  type ZoneKind,
} from "@/hooks/useAlertZones";
import {
  getAlarmPrefs,
  playAlarm,
  setAlarmPrefs,
  type AlarmSoundName,
} from "@/lib/alarm-sounds";
import { hailColor } from "@/lib/hail";
import { timeAgo } from "@/lib/time-ago";
import { IconBolt, IconClose, IconChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/* ── constants ─────────────────────────────────────────────────────── */

const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

/** One-click radius zones around hail-market metros (50 mi). */
const METRO_PRESETS: { label: string; lat: number; lng: number }[] = [
  { label: "Chicago area",     lat: 41.88, lng: -87.63 },
  { label: "Dallas–Fort Worth", lat: 32.78, lng: -97.04 },
  { label: "Denver metro",     lat: 39.74, lng: -104.99 },
  { label: "OKC metro",        lat: 35.47, lng: -97.52 },
  { label: "Kansas City",      lat: 39.10, lng: -94.58 },
  { label: "Salt Lake City",   lat: 40.76, lng: -111.89 },
];

const HAIL_CHOICES: { v: number | null; label: string }[] = [
  { v: 0.75, label: "Any hail (≥ 0.75″)" },
  { v: 1.0,  label: "≥ 1″ (quarter)" },
  { v: 1.5,  label: "≥ 1.5″ (ping-pong)" },
  { v: 2.0,  label: "≥ 2″ (hen egg)" },
  { v: 3.0,  label: "≥ 3″ (softball)" },
  { v: null, label: "Off (wind only)" },
];

const WIND_CHOICES: { v: number | null; label: string }[] = [
  { v: null, label: "Off" },
  { v: 60,  label: "≥ 60 mph" },
  { v: 80,  label: "≥ 80 mph" },
  { v: 100, label: "≥ 100 mph" },
];

const SOUND_LADDER: { name: AlarmSoundName; label: string; hint: string }[] = [
  { name: "thud",    label: "1″",   hint: "thud" },
  { name: "thunk",   label: "1.5″", hint: "thunk" },
  { name: "crack",   label: "2″",   hint: "crack" },
  { name: "glass",   label: "2.5″", hint: "glass" },
  { name: "shatter", label: "3″+",  hint: "shatter" },
  { name: "wind",    label: "Wind", hint: "gust" },
];

/* ── page ──────────────────────────────────────────────────────────── */

export default function AlertsPage() {
  const { alerts, unreadCount, markAllRead, markRead, dismiss, isLoading } = useAlerts();
  const zonesApi = useAlertZones();

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-4xl py-10 space-y-8">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Storm alarms
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Alerts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up alarm zones — we pop a notification (with a sound to match
            the stone) the moment a storm pings an area you track. Watchlist
            addresses alert here too.
          </p>
        </div>

        <SoundBoard />
        <ZonesSection {...zonesApi} />

        <AlertHistory
          alerts={alerts}
          unreadCount={unreadCount}
          isLoading={isLoading}
          markAllRead={markAllRead}
          markRead={markRead}
          dismiss={dismiss}
        />
      </div>
    </div>
  );
}

/* ── sound settings + test board ───────────────────────────────────── */

function SoundBoard() {
  const [prefs, setPrefs] = useState(getAlarmPrefs);

  const patch = (p: Parameters<typeof setAlarmPrefs>[0]) =>
    setPrefs(setAlarmPrefs(p));

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
            Alarm sounds
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bigger hail, bigger sound — tap one to hear it.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-foreground/75">
            Volume
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(prefs.volume * 100)}
              onChange={(e) => patch({ volume: Number(e.target.value) / 100 })}
              className="w-28 accent-[hsl(var(--primary))]"
            />
          </label>
          <button
            type="button"
            onClick={() => patch({ muted: !prefs.muted })}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              prefs.muted
                ? "border-destructive/50 text-destructive"
                : "border-border text-foreground/75 hover:border-copper/40",
            )}
            aria-pressed={prefs.muted}
          >
            {prefs.muted ? "Muted" : "Mute"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SOUND_LADDER.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => playAlarm(s.name, { ignoreMute: true })}
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-2 text-sm transition-all hover:border-copper/50 hover:shadow-atlas"
          >
            <span aria-hidden>🔊</span>
            <span className="font-mono-num font-medium">{s.label}</span>
            <span className="text-xs text-muted-foreground group-hover:text-foreground/75">
              {s.hint}
            </span>
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-4 py-2.5">
        <span className="text-sm text-foreground/85">
          Cha-ching mode
          <span className="block text-[11px] text-muted-foreground">
            Adds a cash-register ring when 2″+ hail lands in one of your zones.
            Hail is revenue — let it sound like it.
          </span>
        </span>
        <span
          role="switch"
          aria-checked={prefs.chaching}
          tabIndex={0}
          onClick={() => {
            const next = !prefs.chaching;
            patch({ chaching: next });
            if (next) playAlarm("chaching", { ignoreMute: true });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") patch({ chaching: !prefs.chaching });
          }}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
            prefs.chaching ? "bg-primary" : "bg-foreground/25",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
              prefs.chaching ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </span>
      </label>
    </section>
  );
}

/* ── alarm zones ───────────────────────────────────────────────────── */

type ZonesApi = ReturnType<typeof useAlertZones>;

function ZonesSection({ zones, isLoading, create, update, remove }: ZonesApi) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
            Alarm zones
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The areas you want pinged about — a radius, whole states, or the
            whole country.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
        >
          {formOpen ? "Close" : "+ New zone"}
        </button>
      </div>

      {formOpen && (
        <ZoneForm
          onCreate={async (input) => {
            await create(input);
            setFormOpen(false);
          }}
        />
      )}

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton width="60%" height={16} />
        </div>
      ) : zones.length === 0 && !formOpen ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-6 text-center text-sm text-muted-foreground">
          No zones yet. Try <button type="button" className="text-copper hover:text-copper-700 font-medium" onClick={() => setFormOpen(true)}>“+ New zone”</button> —
          e.g. all of Colorado at ≥ 1.5″, or 25 miles around the office at any size.
        </div>
      ) : (
        <ul className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
          {zones.map((z) => (
            <ZoneRow key={z.id} zone={z} onToggle={update} onDelete={remove} />
          ))}
        </ul>
      )}
    </section>
  );
}

function zoneWhere(z: AlertZone): string {
  if (z.kind === "nationwide") return "Nationwide";
  if (z.kind === "states") return (z.states ?? []).join(", ") || "States";
  const r = z.radius_mi ? `${Math.round(z.radius_mi)} mi` : "radius";
  return `${r} around ${z.center_lat?.toFixed(2)}, ${z.center_lng?.toFixed(2)}`;
}

function zoneThresholds(z: AlertZone): string {
  const parts: string[] = [];
  if (z.min_hail_in != null) parts.push(`hail ≥ ${z.min_hail_in}″`);
  if (z.min_wind_mph != null) parts.push(`wind ≥ ${z.min_wind_mph} mph (soon)`);
  return parts.join(" · ") || "—";
}

function ZoneRow({
  zone,
  onToggle,
  onDelete,
}: {
  zone: AlertZone;
  onToggle: ZonesApi["update"];
  onDelete: ZonesApi["remove"];
}) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      <span
        role="switch"
        aria-checked={zone.enabled}
        tabIndex={0}
        onClick={async () => {
          setBusy(true);
          try { await onToggle(zone.id, { enabled: !zone.enabled }); } finally { setBusy(false); }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") void onToggle(zone.id, { enabled: !zone.enabled });
        }}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
          zone.enabled ? "bg-primary" : "bg-foreground/25",
          busy && "opacity-60",
        )}
        aria-label={`${zone.enabled ? "Disable" : "Enable"} ${zone.name}`}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            zone.enabled ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", zone.enabled ? "text-foreground" : "text-foreground/50")}>
          {zone.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {zoneWhere(zone)} · {zoneThresholds(zone)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          if (confirm(`Delete zone "${zone.name}"?`)) void onDelete(zone.id);
        }}
        aria-label={`Delete ${zone.name}`}
        className="text-foreground/40 hover:text-destructive"
      >
        <IconClose className="h-4 w-4" />
      </button>
    </li>
  );
}

/* ── create form ───────────────────────────────────────────────────── */

function ZoneForm({
  onCreate,
}: {
  onCreate: (input: Parameters<ZonesApi["create"]>[0]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ZoneKind>("states");
  const [states, setStates] = useState<string[]>([]);
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [radius, setRadius] = useState(25);
  const [minHail, setMinHail] = useState<number | null>(1.0);
  const [minWind, setMinWind] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const autoName = useMemo(() => {
    if (name.trim()) return name.trim();
    if (kind === "nationwide") return "Nationwide";
    if (kind === "states") return states.join(", ") || "New zone";
    return "Radius zone";
  }, [name, kind, states]);

  const toggleState = (code: string) =>
    setStates((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(4));
      setLng(pos.coords.longitude.toFixed(4));
    });
  };

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await onCreate({
        name: autoName,
        kind,
        center_lat: kind === "radius" ? parseFloat(lat) : null,
        center_lng: kind === "radius" ? parseFloat(lng) : null,
        radius_mi: kind === "radius" ? radius : null,
        states: kind === "states" ? states : null,
        min_hail_in: minHail,
        min_wind_mph: minWind,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the zone.");
    } finally {
      setBusy(false);
    }
  };

  const valid =
    (kind === "nationwide" ||
      (kind === "states" && states.length > 0) ||
      (kind === "radius" && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)))) &&
    (minHail != null || minWind != null);

  return (
    <div className="space-y-4 rounded-xl border border-copper/40 bg-copper/5 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">Zone name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={autoName}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-copper focus:outline-none"
          />
        </label>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">Area type</span>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {(["radius", "states", "nationwide"] as ZoneKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-md px-3 py-2 text-xs font-medium capitalize transition-colors",
                  kind === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground/75 hover:border-copper/40",
                )}
              >
                {k === "radius" ? "Radius" : k === "states" ? "States" : "Nationwide"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {kind === "radius" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {METRO_PRESETS.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => {
                  setLat(String(m.lat));
                  setLng(String(m.lng));
                  setRadius(50);
                  if (!name) setName(m.label);
                }}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/75 hover:border-copper/50"
              >
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={useMyLocation}
              className="rounded-full border border-copper/50 bg-card px-3 py-1 text-xs font-medium text-copper hover:bg-copper/10"
            >
              📍 Use my location
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text" inputMode="decimal" placeholder="Latitude"
              value={lat} onChange={(e) => setLat(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-mono-num focus:border-copper focus:outline-none"
            />
            <input
              type="text" inputMode="decimal" placeholder="Longitude"
              value={lng} onChange={(e) => setLng(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-mono-num focus:border-copper focus:outline-none"
            />
            <label className="flex items-center gap-2 text-xs text-foreground/75">
              <input
                type="range" min={5} max={250} step={5} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="flex-1 accent-[hsl(var(--primary))]"
              />
              <span className="font-mono-num w-14 text-right">{radius} mi</span>
            </label>
          </div>
        </div>
      )}

      {kind === "states" && (
        <div>
          <div className="flex flex-wrap gap-1">
            {US_STATES.map(([code, full]) => (
              <button
                key={code}
                type="button"
                title={full}
                onClick={() => toggleState(code)}
                className={cn(
                  "rounded px-2 py-1 font-mono-num text-xs transition-colors",
                  states.includes(code)
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground/70 hover:border-copper/40",
                )}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">Hail size</span>
          <select
            value={minHail == null ? "off" : String(minHail)}
            onChange={(e) => setMinHail(e.target.value === "off" ? null : Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-copper focus:outline-none"
          >
            {HAIL_CHOICES.map((c) => (
              <option key={c.label} value={c.v == null ? "off" : String(c.v)}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">Wind speed</span>
          <select
            value={minWind == null ? "off" : String(minWind)}
            onChange={(e) => setMinWind(e.target.value === "off" ? null : Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-copper focus:outline-none"
          >
            {WIND_CHOICES.map((c) => (
              <option key={c.label} value={c.v == null ? "off" : String(c.v)}>{c.label}</option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Wind alerts are wiring up now — set a speed and this zone starts
            firing the moment wind data goes live.
          </span>
        </label>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <button
        type="button"
        disabled={!valid || busy}
        onClick={() => void submit()}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Create zone"}
      </button>
    </div>
  );
}

/* ── history ───────────────────────────────────────────────────────── */

function AlertHistory({
  alerts,
  unreadCount,
  isLoading,
  markAllRead,
  markRead,
  dismiss,
}: {
  alerts: ReturnType<typeof useAlerts>["alerts"];
  unreadCount: number;
  isLoading: boolean;
  markAllRead: () => Promise<void> | void;
  markRead: (id: number) => Promise<void> | void;
  dismiss: (id: number) => Promise<void> | void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
            Alert history
          </p>
          {unreadCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide-caps text-copper-700">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65 hover:text-copper"
          >
            Mark all read
          </button>
        )}
      </div>

      {isLoading && alerts.length === 0 ? (
        <ul className="rounded-xl border border-border bg-card divide-y divide-border/60">
          {[0, 1, 2].map((i) => (
            <li key={i} className="px-5 py-4 flex items-center gap-4">
              <Skeleton width={56} height={48} rounded="md" />
              <div className="flex-1 space-y-2">
                <Skeleton width="50%" height={14} />
                <Skeleton width="35%" height={10} subtle />
              </div>
            </li>
          ))}
        </ul>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-center">
          <IconBolt className="mx-auto h-6 w-6 text-foreground/30" aria-hidden />
          <p className="mt-2 text-sm text-muted-foreground">
            Quiet for now. When a storm hits one of your zones or watchlist
            addresses, it lands here — and pops up wherever you are in the app.
          </p>
        </div>
      ) : (
        <ul className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
          {alerts.map((a) => {
            const c = hailColor(a.peak_size_in);
            const unread = a.read_at === null;
            const isZone = (a.kind ?? "address").startsWith("zone");
            const title = isZone
              ? a.zone_name || "Alarm zone"
              : a.address_label || a.address || "Monitored address";
            const href = isZone
              ? "/app/map"
              : `/app/map?address=${encodeURIComponent(a.address ?? "")}`;
            return (
              <li
                key={a.id}
                className={cn(
                  "group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/40",
                  unread && "bg-copper/5",
                )}
              >
                <span
                  className="inline-flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md border"
                  style={{ background: c.bg, borderColor: c.border }}
                >
                  <span className="font-mono-num text-sm font-medium leading-none" style={{ color: c.text }}>
                    {a.peak_size_in.toFixed(2)}″
                  </span>
                  <span className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-0.5" style={{ color: c.text, opacity: 0.75 }}>
                    {c.object}
                  </span>
                </span>

                <div className="flex-1 min-w-0">
                  <Link
                    href={href}
                    onClick={() => {
                      if (unread) void markRead(a.id);
                    }}
                    className="block"
                  >
                    <p className="font-medium text-foreground truncate flex items-center gap-2">
                      {unread && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-copper" aria-hidden />
                      )}
                      {title}
                      {isZone && (
                        <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide-caps text-primary">
                          Zone
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {a.storm_city ?? "Storm"} · started {timeAgo(a.storm_started_at)}
                      {" · "}
                      <span className="font-mono-num">id {a.storm_id.slice(-8)}</span>
                    </p>
                  </Link>
                </div>

                <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  {unread && (
                    <button
                      type="button"
                      onClick={() => void markRead(a.id)}
                      className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/65 hover:text-copper"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void dismiss(a.id)}
                    aria-label="Dismiss alert"
                    className="text-foreground/40 hover:text-destructive"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                  <IconChevronRight className="h-4 w-4 text-foreground/30" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
