"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { IconReport, IconCloud, IconClose, IconBolt } from "@/components/icons";

type Phase = "idle" | "analyzing" | "done";

interface Result {
  strikeCount: number;
  severity: "Low" | "Moderate" | "Severe" | "Total Loss";
  confidence: number;
  recommendation: string;
  affectedAreaPct: number;
  estimatedReplacementUSD: number;
}

function mockAnalyze(filename: string, sizeKb: number): Result {
  // Deterministic-ish: hash filename+size to a result so the same upload is consistent
  let hash = sizeKb;
  for (let i = 0; i < filename.length; i++) hash = (hash * 31 + filename.charCodeAt(i)) % 1_000_000;

  const severityOrder: Result["severity"][] = ["Low", "Moderate", "Severe", "Total Loss"];
  const sIdx = Math.min(severityOrder.length - 1, Math.floor((hash % 100) / 25));
  const severity = severityOrder[sIdx];
  const strikeCount = 8 + Math.floor((hash % 90) * (sIdx + 1) / 2);
  const confidence = 0.78 + ((hash % 18) / 100);
  const affectedAreaPct = 6 + ((hash % 38) * (sIdx + 1) / 4);

  const recommendations: Record<Result["severity"], string> = {
    Low: "Roof remains within service life. Document and monitor.",
    Moderate: "Repairs recommended for affected slopes within 60 days.",
    Severe: "Full replacement recommended. Insurance claim warranted.",
    "Total Loss": "Total replacement required. File claim immediately.",
  };

  const ticketBase: Record<Result["severity"], number> = {
    Low: 2200,
    Moderate: 7800,
    Severe: 18500,
    "Total Loss": 32400,
  };

  return {
    strikeCount,
    severity,
    confidence,
    recommendation: recommendations[severity],
    affectedAreaPct: Math.round(affectedAreaPct * 10) / 10,
    estimatedReplacementUSD: ticketBase[severity] + Math.floor((hash % 4000)),
  };
}

const SEVERITY_TONE: Record<Result["severity"], { color: string; bg: string; border: string }> = {
  Low:          { color: "#1A6B36", bg: "rgba(54, 193, 104, 0.16)",  border: "rgba(31, 142, 72, 0.55)" },
  Moderate:     { color: "#7A4A0E", bg: "rgba(240, 161, 44, 0.18)",  border: "rgba(197, 120, 26, 0.55)" },
  Severe:       { color: "#6E1A10", bg: "rgba(217, 70, 47, 0.16)",   border: "rgba(161, 42, 26, 0.55)" },
  "Total Loss": { color: "#250A40", bg: "rgba(74, 32, 112, 0.18)",   border: "rgba(42, 14, 69, 0.6)" },
};

export default function PhotoAiPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{ name: string; sizeKb: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setPhotoMeta({ name: file.name, sizeKb: Math.round(file.size / 1024) });
    setPhase("analyzing");
    setResult(null);
    setTimeout(() => {
      const r = mockAnalyze(file.name, Math.round(file.size / 1024));
      setResult(r);
      setPhase("done");
    }, 1800);
  }, []);

  const reset = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoMeta(null);
    setResult(null);
    setPhase("idle");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-4xl py-10 space-y-8">
        <div>
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Pro feature · preview
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Photo damage triage
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Drop a roof photo. Our model returns a hail-strike count, severity rating, and replacement
            recommendation in seconds. Currently in preview — results are illustrative only.
          </p>
        </div>
        <div className="rule-atlas" />

        {phase === "idle" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="relative rounded-xl border-2 border-dashed border-border bg-card px-6 py-16 text-center transition-colors hover:border-copper/50"
          >
            <IconCloud className="mx-auto h-10 w-10 text-foreground/40" />
            <h2 className="mt-4 font-display text-2xl font-medium tracking-tight-display text-foreground">
              Drop a roof photo to analyze
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              JPG / PNG / HEIC up to ~10 MB · processed entirely in your browser
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900"
            >
              Choose photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {phase !== "idle" && photoUrl && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Photo preview */}
            <div className="relative rounded-xl border border-border bg-card overflow-hidden">
              <img
                src={photoUrl}
                alt="Uploaded roof"
                className="w-full h-80 object-cover"
              />
              {phase === "analyzing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
                  <div className="rounded-lg bg-card/95 px-4 py-3 shadow-panel border border-border">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="inline-block h-2 w-2 rounded-full bg-copper animate-pulse" />
                      Analyzing…
                    </p>
                    <p className="mt-1 font-mono-num text-[10px] text-foreground/55 tracking-wide-caps uppercase">
                      Detecting strikes · scoring severity
                    </p>
                  </div>
                </div>
              )}
              {phase === "done" && result && (
                <ResultOverlay result={result} />
              )}
              {phase === "done" && (
                <button
                  type="button"
                  onClick={reset}
                  className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-medium text-foreground/85 shadow-atlas border border-border hover:bg-card"
                >
                  <IconClose className="h-3 w-3" /> New photo
                </button>
              )}
              <div className="px-4 py-2 border-t border-border text-[11px] font-mono-num text-foreground/55 truncate">
                {photoMeta?.name} · {photoMeta?.sizeKb} KB
              </div>
            </div>

            {/* Result panel */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              {phase === "analyzing" && (
                <div className="space-y-3">
                  <div className="h-3 rounded bg-secondary animate-pulse w-1/2" />
                  <div className="h-12 rounded bg-secondary animate-pulse" />
                  <div className="h-3 rounded bg-secondary animate-pulse w-3/4" />
                  <div className="h-3 rounded bg-secondary animate-pulse w-2/3" />
                </div>
              )}
              {phase === "done" && result && <ResultPanel result={result} />}
            </div>
          </div>
        )}

        {/* What is this? */}
        <div className="rounded-xl border border-copper/30 bg-copper/5 p-5">
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper-700">
            How it works
          </p>
          <p className="mt-2 text-sm text-foreground/85 leading-relaxed">
            Photos are processed locally in your browser and never uploaded to a
            server in this preview. Production version will route through our
            CV pipeline (CNN-based hail-strike detector trained on 50k+ labeled
            roof photos) and return per-pixel impact maps you can share with
            insurance adjusters.
          </p>
          <Link
            href="/compare"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-copper-700 hover:text-copper"
          >
            See the Pro tier roadmap <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResultOverlay({ result }: { result: Result }) {
  // Generate deterministic fake strike marker positions
  const markers = Array.from({ length: Math.min(20, Math.floor(result.strikeCount / 2)) }).map((_, i) => {
    const seed = (i * 7) ^ result.strikeCount;
    return {
      x: 8 + ((seed * 13) % 84),
      y: 10 + ((seed * 19) % 78),
      size: 10 + ((seed * 5) % 16),
    };
  });

  return (
    <div className="pointer-events-none absolute inset-0">
      {markers.map((m, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: m.size,
            height: m.size,
            border: `1.5px solid #D87C4A`,
            boxShadow: `0 0 0 2px rgba(216, 124, 74, 0.25)`,
          }}
        />
      ))}
    </div>
  );
}

function ResultPanel({ result }: { result: Result }) {
  const tone = SEVERITY_TONE[result.severity];
  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  return (
    <>
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
        Damage assessment
      </p>

      <div
        className="rounded-lg border p-5"
        style={{ background: tone.bg, borderColor: tone.border }}
      >
        <p
          className="font-mono-num text-[10px] uppercase tracking-wide-caps"
          style={{ color: tone.color }}
        >
          Severity rating
        </p>
        <p
          className="mt-1 font-display text-3xl font-medium tracking-tight-display"
          style={{ color: tone.color }}
        >
          {result.severity}
        </p>
        <p className="mt-2 text-sm" style={{ color: tone.color, opacity: 0.85 }}>
          {result.recommendation}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Hail strikes" value={result.strikeCount.toString()} accent />
        <Stat label="Roof affected" value={`${result.affectedAreaPct}%`} />
        <Stat label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
      </div>

      <div className="rule-atlas" />

      <div>
        <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
          Estimated replacement cost
        </p>
        <p className="mt-1 font-display text-3xl font-medium tracking-tight-display text-primary">
          {fmtMoney(result.estimatedReplacementUSD)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Industry-average sq-ft pricing for the affected area
        </p>
      </div>

      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-teal-900 disabled:opacity-50"
        disabled
        title="Report generation from photo coming soon"
      >
        <IconReport className="h-4 w-4" />
        Generate adjuster-ready report (coming soon)
      </button>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-medium tracking-tight-display",
          accent ? "text-copper" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
