"use client";

import { useEffect, useState } from "react";
import { useBranding } from "@/hooks/useReports";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "HailScout default", primary: "#0F4C5C", accent: "#D87C4A" },
  { label: "Storm navy",        primary: "#0A1628", accent: "#FFD600" },
  { label: "Forest + amber",    primary: "#2F5233", accent: "#E8A23A" },
  { label: "Plum + rose",       primary: "#3F1B47", accent: "#E0507A" },
];

export function BrandingCard() {
  const { branding, update } = useBranding();
  const [companyName, setCompanyName] = useState("");
  const [primary, setPrimary] = useState("#0F4C5C");
  const [accent, setAccent] = useState("#D87C4A");
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!branding) return;
    setCompanyName(branding.company_name ?? "");
    setPrimary(branding.primary ?? "#0F4C5C");
    setAccent(branding.accent ?? "#D87C4A");
    setLogoUrl(branding.logo_url ?? "");
  }, [branding]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await update({
        company_name: companyName.trim() || null,
        primary: primary || null,
        accent: accent || null,
        logo_url: logoUrl.trim() || null,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch {
      // silent — UI shows nothing changed; user can retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
        Reports
      </p>
      <h2 className="mt-1 font-display text-2xl font-medium tracking-tight-display">
        Branded reports
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Override the company name and brand colors that appear on your Hail Impact Reports.
      </p>

      <div className="mt-6 space-y-5">
        <Field label="Company name" hint="Shown next to the radar mark in the report header.">
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="HailScout"
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:border-copper focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary color" hint="Headers + brand mark.">
            <ColorInput value={primary} onChange={setPrimary} />
          </Field>
          <Field label="Accent color" hint="Eyebrows + buttons.">
            <ColorInput value={accent} onChange={setAccent} />
          </Field>
        </div>

        <Field label="Logo URL (optional)" hint="PNG or SVG. Leave blank to use the radar mark.">
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:border-copper focus:outline-none"
          />
        </Field>

        {/* Presets */}
        <div>
          <p className="mb-2 font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
            Try a preset
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setPrimary(p.primary);
                  setAccent(p.accent);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-copper/50",
                  primary === p.primary && accent === p.accent && "border-copper bg-copper/5",
                )}
              >
                <span className="inline-flex">
                  <span className="h-3 w-3 rounded-l-full" style={{ background: p.primary }} />
                  <span className="h-3 w-3 rounded-r-full" style={{ background: p.accent }} />
                </span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Preview primary={primary} accent={accent} companyName={companyName || "HailScout"} />

        <div className="flex items-center justify-end gap-3">
          {savedFlash && (
            <span className="text-xs text-forest font-mono uppercase tracking-wide-caps">
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save branding"}
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5">
        <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-12 cursor-pointer rounded-md border border-border bg-background p-0.5"
        aria-label="Color picker"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono-num focus:border-copper focus:outline-none"
        placeholder="#0F4C5C"
      />
    </div>
  );
}

function Preview({ primary, accent, companyName }: { primary: string; accent: string; companyName: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-4">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 mb-2">
        Preview
      </p>
      <div className="flex items-center justify-between rounded border border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11" stroke={primary} strokeWidth="1.4" fill="none" />
            <circle cx="14" cy="14" r="7"  stroke={primary} strokeWidth="1.2" fill="none" />
            <circle cx="14" cy="14" r="3.5" stroke={accent} strokeWidth="1.2" fill="none" />
            <path d="M5 14 Q14 7 23 14" stroke={accent} strokeWidth="1.2" fill="none" />
            <circle cx="14" cy="14" r="1.4" fill={accent} />
          </svg>
          <span className="font-display text-base font-medium tracking-tight-display" style={{ color: primary }}>
            {companyName}
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wide-caps" style={{ color: accent }}>
          Hail Impact Report
        </span>
      </div>
    </div>
  );
}
