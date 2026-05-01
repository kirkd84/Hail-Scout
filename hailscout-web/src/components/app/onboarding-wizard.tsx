"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { searchAddress } from "@/lib/geocode";
import { fixturesAtPoint, STORM_FIXTURES, type StormFixture } from "@/lib/storm-fixtures";
import { hailColor } from "@/lib/hail";
import { Wordmark } from "@/components/brand/wordmark";
import { ContourBg } from "@/components/brand/contour-bg";
import { IconClose, IconChevronRight, IconAddresses, IconBolt, IconReport, IconUsers } from "@/components/icons";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "hs.onboarding.v1";

type Step = "welcome" | "address" | "storms" | "report" | "team" | "done";

interface Props {
  /** Force-open even if the user has previously dismissed. */
  forceOpen?: boolean;
}

export function OnboardingWizard({ forceOpen }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const { save, addresses } = useSavedAddresses();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [addressInput, setAddressInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedHits, setSavedHits] = useState<StormFixture[]>([]);
  const [savedAddressLabel, setSavedAddressLabel] = useState<string | null>(null);

  // Open on mount for first-time users
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (forceOpen) {
      setOpen(true);
      return;
    }
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const t = setTimeout(() => setOpen(true), 900);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, [forceOpen]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  const skipAll = () => close();

  const handleSaveAddress = async () => {
    if (!addressInput.trim()) {
      // Use the suggested address (Dallas TX) if user didn't enter one
      setAddressInput("Dallas TX");
      setBusy(true);
      try {
        const r = await searchAddress("Dallas TX");
        if (r) {
          const hits = fixturesAtPoint(r.lng, r.lat);
          await save({
            address: r.pretty,
            lat: r.lat,
            lng: r.lng,
            last_storm_size_in: hits.length > 0 ? Math.max(...hits.map((s) => s.max_hail_size_in)) : undefined,
          });
          setSavedAddressLabel(r.pretty);
          setSavedHits(hits);
          setStep("storms");
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const r = await searchAddress(addressInput.trim());
      if (r) {
        const hits = fixturesAtPoint(r.lng, r.lat);
        await save({
          address: r.pretty,
          lat: r.lat,
          lng: r.lng,
          last_storm_size_in: hits.length > 0 ? Math.max(...hits.map((s) => s.max_hail_size_in)) : undefined,
        });
        setSavedAddressLabel(r.pretty);
        setSavedHits(hits);
        setStep("storms");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/55 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={skipAll}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-panel animate-in zoom-in-95 duration-300"
      >
        <ContourBg className="opacity-60" density="sparse" fadeBottom />

        <button
          type="button"
          onClick={skipAll}
          className="absolute right-4 top-4 z-10 rounded-md p-1 text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
          aria-label="Close onboarding"
        >
          <IconClose className="h-4 w-4" />
        </button>

        <div className="relative px-7 pt-7 pb-2">
          <Wordmark size="sm" pulse href={null} />
        </div>

        <div className="relative px-7 pb-2 pt-3 min-h-[300px]">
          {step === "welcome" && (
            <Welcome
              onNext={() => setStep("address")}
              firstName={user?.firstName ?? user?.emailAddresses[0]?.emailAddress.split("@")[0]}
            />
          )}
          {step === "address" && (
            <SaveAddress
              value={addressInput}
              onChange={setAddressInput}
              onNext={handleSaveAddress}
              busy={busy}
              alreadyHas={addresses.length > 0}
              onSkip={() => setStep("storms")}
            />
          )}
          {step === "storms" && (
            <ShowStorms
              hits={savedHits}
              addressLabel={savedAddressLabel}
              onNext={() => setStep("report")}
            />
          )}
          {step === "report" && (
            <ShowReport onNext={() => setStep("team")} />
          )}
          {step === "team" && (
            <InviteTeam
              onFinish={() => {
                close();
                router.push("/app");
              }}
            />
          )}
        </div>

        {/* Step dots */}
        <div className="relative flex items-center justify-center gap-1.5 py-3">
          {(["welcome", "address", "storms", "report", "team"] as Step[]).map((s, i) => {
            const allSteps: Step[] = ["welcome", "address", "storms", "report", "team"];
            const currentIdx = allSteps.indexOf(step);
            const myIdx = i;
            return (
              <span
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  myIdx === currentIdx ? "w-6 bg-copper" : myIdx < currentIdx ? "w-1.5 bg-copper/60" : "w-1.5 bg-foreground/20",
                )}
              />
            );
          })}
        </div>

        <div className="relative flex items-center justify-between border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={skipAll}
            className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wide-caps text-foreground/45">
            <kbd className="rounded bg-foreground/10 px-1.5 py-0.5">esc</kbd>
            <span>close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Steps
   ────────────────────────────────────────────────────────── */

function Welcome({ onNext, firstName }: { onNext: () => void; firstName?: string }) {
  return (
    <div>
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
        Welcome
      </p>
      <h2 className="mt-2 font-display text-3xl font-medium tracking-tight-display text-foreground">
        Hey {firstName ?? "there"} — let&apos;s get you set up.
      </h2>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        Four quick steps. About a minute. We&apos;ll save a customer address,
        show you what hail hit it, generate a branded report, and let you
        invite your crew. Then you&apos;re ready for the conference floor.
      </p>
      <button
        type="button"
        onClick={onNext}
        className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
      >
        Let&apos;s go <IconChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SaveAddress({
  value, onChange, onNext, busy, alreadyHas, onSkip,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  busy: boolean;
  alreadyHas: boolean;
  onSkip: () => void;
}) {
  return (
    <div>
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">Step 1 / 4</p>
      <h2 className="mt-2 font-display text-2xl font-medium tracking-tight-display text-foreground">
        Save a customer address
      </h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Try one in your territory, or use the demo city. We&apos;ll auto-populate
        the storm history at that point.
      </p>

      <div className="mt-5 flex items-start gap-3">
        <div className="mt-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-copper/15 text-copper">
          <IconAddresses className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="2840 N Pleasant Ave, Dallas TX"
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:border-copper focus:outline-none"
            disabled={busy}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Try <button type="button" className="text-copper hover:text-copper-700 underline-offset-2 hover:underline" onClick={() => onChange("Dallas TX")}>Dallas TX</button>,{" "}
            <button type="button" className="text-copper hover:text-copper-700 underline-offset-2 hover:underline" onClick={() => onChange("Amarillo TX")}>Amarillo TX</button>, or{" "}
            <button type="button" className="text-copper hover:text-copper-700 underline-offset-2 hover:underline" onClick={() => onChange("Oklahoma City OK")}>Oklahoma City OK</button>.
          </p>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        {alreadyHas ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] font-mono uppercase tracking-wide-caps text-foreground/55 hover:text-foreground"
          >
            I have addresses already → skip
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900 disabled:opacity-60"
        >
          {busy ? "Geocoding…" : "Save & continue"} <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ShowStorms({
  hits, addressLabel, onNext,
}: {
  hits: StormFixture[];
  addressLabel: string | null;
  onNext: () => void;
}) {
  const peak = hits.length > 0 ? Math.max(...hits.map((s) => s.max_hail_size_in)) : 0;
  const c = peak > 0 ? hailColor(peak) : null;

  return (
    <div>
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">Step 2 / 4</p>
      <h2 className="mt-2 font-display text-2xl font-medium tracking-tight-display text-foreground">
        {hits.length > 0 ? `${hits.length} storm${hits.length === 1 ? "" : "s"} on file` : "No hail on record"}
      </h2>
      {addressLabel && (
        <p className="mt-1 text-xs text-muted-foreground font-mono-num">{addressLabel}</p>
      )}

      {hits.length > 0 && c ? (
        <div className="mt-4 rounded-lg border p-4 flex items-center gap-4" style={{ background: c.bg, borderColor: c.border }}>
          <span className="inline-flex h-12 w-14 flex-col items-center justify-center rounded-md border" style={{ background: "rgba(255,255,255,0.4)", borderColor: c.border }}>
            <span className="font-mono-num text-base font-medium leading-none" style={{ color: c.text }}>
              {peak.toFixed(2)}″
            </span>
            <span className="text-[9px] uppercase tracking-wide-caps font-mono leading-none mt-1" style={{ color: c.text, opacity: 0.75 }}>
              {c.object}
            </span>
          </span>
          <div className="min-w-0">
            <p className="font-medium text-sm" style={{ color: c.text }}>
              Peak hail at this address.
            </p>
            <p className="mt-0.5 text-xs" style={{ color: c.text, opacity: 0.85 }}>
              Well within the threshold for filing an insurance claim.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm text-foreground/85">
            That address hasn&apos;t been hit by hail in our 30-day window.
            We&apos;ll alert you the moment one rolls through.
          </p>
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
        From here on out, every storm that touches this address generates an
        alert in your inbox + Slack (when configured). You can monitor as
        many addresses as you like.
      </p>

      <div className="mt-6 flex items-center justify-end">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
        >
          Show me the report → <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ShowReport({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">Step 3 / 4</p>
      <h2 className="mt-2 font-display text-2xl font-medium tracking-tight-display text-foreground">
        Branded reports in 6 seconds
      </h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Click any storm on the map → <strong className="font-medium text-foreground">Download Hail Impact Report</strong>.
        You get a one-page PDF with a captured swath snapshot, hero hail
        size, the storm timeline, your branding, and a legal disclaimer.
        Hand it to a homeowner, file it with insurance, attach it to a
        proposal — closes deals.
      </p>

      <div className="mt-5 flex items-start gap-3">
        <div className="mt-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconReport className="h-4 w-4" />
        </div>
        <div className="text-sm text-foreground/85">
          <p className="font-medium text-foreground">Customize your branding</p>
          <p className="mt-1 text-muted-foreground">
            Set your company name, primary color, and accent in <strong className="font-medium text-foreground">Settings → Branded reports</strong>. Every future PDF picks them up.
          </p>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-end">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
        >
          Last step → <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function InviteTeam({ onFinish }: { onFinish: () => void }) {
  return (
    <div>
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">Step 4 / 4</p>
      <h2 className="mt-2 font-display text-2xl font-medium tracking-tight-display text-foreground">
        Bring the crew
      </h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        HailScout is unlimited-seat — invite your whole sales team, your
        canvassers, your office staff. Markers and reports sync across
        every device.
      </p>

      <div className="mt-5 flex items-start gap-3">
        <div className="mt-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-copper/15 text-copper">
          <IconUsers className="h-4 w-4" />
        </div>
        <div className="text-sm text-foreground/85">
          <p className="font-medium text-foreground">Invite teammates</p>
          <p className="mt-1 text-muted-foreground">
            Open <strong className="font-medium text-foreground">Team</strong> in the sidebar. We&apos;ll send each invite via email.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3">
        <div className="mt-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBolt className="h-4 w-4" />
        </div>
        <div className="text-sm text-foreground/85">
          <p className="font-medium text-foreground">Wire up Slack alerts</p>
          <p className="mt-1 text-muted-foreground">
            Open <strong className="font-medium text-foreground">Settings → Slack</strong>. Paste an incoming-webhook URL. Done.
          </p>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-end">
        <button
          type="button"
          onClick={onFinish}
          className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
        >
          Open the dashboard → <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
