"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { IconReport, IconCloud, IconClose, IconBolt } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { apiClient, ApiError } from "@/lib/api";

type Phase = "idle" | "analyzing" | "done" | "error";

type Severity = "Low" | "Moderate" | "Severe" | "Total Loss";

/** Shape returned by POST /v1/ai/damage-triage (snake_case). */
interface TriageApiResponse {
  hail_damage_probability: number;
  severity: string;
  confidence: number;
  estimated_hail_size_in: number | null;
  findings: string[];
  summary: string;
  recommended_action: string;
}

/** UI-facing result. */
interface Result {
  probability: number;
  severity: Severity;
  confidence: number;
  estimatedHailSizeIn: number | null;
  findings: string[];
  summary: string;
  recommendedAction: string;
}

const SEVERITIES: Severity[] = ["Low", "Moderate", "Severe", "Total Loss"];

function normalizeSeverity(s: string): Severity {
  return (SEVERITIES as string[]).includes(s) ? (s as Severity) : "Low";
}

const SEVERITY_TONE: Record<Severity, { color: string; bg: string; border: string }> = {
  Low:          { color: "#1A6B36", bg: "rgba(54, 193, 104, 0.16)",  border: "rgba(31, 142, 72, 0.55)" },
  Moderate:     { color: "#7A4A0E", bg: "rgba(240, 161, 44, 0.18)",  border: "rgba(197, 120, 26, 0.55)" },
  Severe:       { color: "#6E1A10", bg: "rgba(217, 70, 47, 0.16)",   border: "rgba(161, 42, 26, 0.55)" },
  "Total Loss": { color: "#250A40", bg: "rgba(74, 32, 112, 0.18)",   border: "rgba(42, 14, 69, 0.6)" },
};

/**
 * Read a file, downscale to <=1568px on the long edge (Anthropic's optimal max),
 * and return base64 JPEG. Keeps payloads well under the vision size limit and
 * normalizes odd formats to JPEG. Falls back to the raw bytes if canvas decode
 * fails (e.g. some HEIC on Chrome).
 */
async function fileToTriageImage(
  file: File,
  maxDim = 1568,
): Promise<{ base64: string; mediaType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
  const stripPrefix = (u: string) => u.slice(u.indexOf(",") + 1);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("decode failed"));
      im.src = dataUrl;
    });
    const longEdge = Math.max(img.width, img.height) || 1;
    const scale = Math.min(1, maxDim / longEdge);
    // Already small + modest file → send as-is (only for formats the model accepts).
    const accepted = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (scale >= 1 && file.size < 3_500_000 && accepted.includes(file.type)) {
      return { base64: stripPrefix(dataUrl), mediaType: file.type };
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", 0.85);
    return { base64: stripPrefix(out), mediaType: "image/jpeg" };
  } catch (err) {
    // Canvas decode failed (commonly iPhone HEIC in Chrome). Only fall
    // back to the raw bytes when the model can actually accept them —
    // otherwise surface a clear error instead of a doomed giant POST.
    const accepted = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (accepted.includes(file.type) && file.size < 3_500_000) {
      return { base64: stripPrefix(dataUrl), mediaType: file.type };
    }
    throw err instanceof Error ? err : new Error("image decode failed");
  }
}

export default function PhotoAiPage() {
  const { getToken } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{ name: string; sizeKb: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
      setPhotoMeta({ name: file.name, sizeKb: Math.round(file.size / 1024) });
      setResult(null);
      setErrorMsg("");
      // Enforce the promised cap up front — a 40MB original would hang in
      // the browser downscale and blow the request body limit.
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg("That photo is over 10 MB. Use a smaller export or a screenshot of it.");
        setPhase("error");
        return;
      }
      setPhase("analyzing");

      try {
        const { base64, mediaType } = await fileToTriageImage(file);
        const token = await getToken();
        const data = await apiClient.post<TriageApiResponse>(
          "/v1/ai/damage-triage",
          { image_base64: base64, media_type: mediaType },
          token || undefined,
        );
        setResult({
          probability: clamp01(data.hail_damage_probability),
          severity: normalizeSeverity(data.severity),
          confidence: clamp01(data.confidence),
          estimatedHailSizeIn:
            typeof data.estimated_hail_size_in === "number" ? data.estimated_hail_size_in : null,
          findings: Array.isArray(data.findings) ? data.findings.slice(0, 8) : [],
          summary: data.summary ?? "",
          recommendedAction: data.recommended_action ?? "",
        });
        setPhase("done");
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) {
          setErrorMsg(
            "Photo AI isn't switched on for this workspace yet. Once the analysis key is set on the API, this works instantly — no code changes needed.",
          );
        } else if (err instanceof ApiError && err.status === 401) {
          setErrorMsg("Your session expired. Refresh the page and sign in again.");
        } else if (err instanceof ApiError) {
          setErrorMsg("The model couldn't analyze that photo. Try a clearer, closer shot of the roof surface.");
        } else {
          setErrorMsg(
            "Couldn't read that image format (iPhone HEIC isn't supported in every browser). Convert it to JPG or PNG and try again.",
          );
        }
        setPhase("error");
      }
    },
    [getToken],
  );

  const reset = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoMeta(null);
    setResult(null);
    setErrorMsg("");
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
            Pro feature
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight-display text-foreground">
            Photo damage triage
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Drop a roof photo. A vision model returns a hail-damage probability, severity rating, the
            specific evidence it saw, and a recommended next step — built to tell genuine hail impact
            apart from foot traffic, wear, and mechanical damage.
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
              JPG / PNG / WebP up to ~10 MB · resized in your browser, then sent securely for analysis
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Uploaded roof" className="w-full h-80 object-cover" />
              {phase === "analyzing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
                  <div className="rounded-lg bg-card/95 px-4 py-3 shadow-panel border border-border">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="inline-block h-2 w-2 rounded-full bg-copper animate-pulse" />
                      Analyzing…
                    </p>
                    <p className="mt-1 font-mono-num text-[10px] text-foreground/55 tracking-wide-caps uppercase">
                      Inspecting surface · scoring hail damage
                    </p>
                  </div>
                </div>
              )}
              {(phase === "done" || phase === "error") && (
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
              {phase === "error" && <ErrorPanel msg={errorMsg} onRetry={reset} />}
            </div>
          </div>
        )}

        {/* What is this? */}
        <div className="rounded-xl border border-copper/30 bg-copper/5 p-5">
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper-700">
            How it works &amp; limits
          </p>
          <p className="mt-2 text-sm text-foreground/85 leading-relaxed">
            Your photo is resized in the browser and sent to our analysis service, which runs a
            vision model tuned to be <em>conservative</em> — it down-weights ambiguous shots rather
            than over-calling damage. It returns a probability, a severity rating, and the evidence
            it relied on. It is a triage aid for prioritizing inspections, not a substitute for an
            on-roof inspection or an adjuster&apos;s determination.
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

function ResultPanel({ result }: { result: Result }) {
  const tone = SEVERITY_TONE[result.severity];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const size =
    result.estimatedHailSizeIn != null ? `${result.estimatedHailSizeIn.toFixed(2).replace(/\.?0+$/, "")}"` : "—";

  return (
    <>
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-copper">
        Damage assessment
      </p>

      <div className="rounded-lg border p-5" style={{ background: tone.bg, borderColor: tone.border }}>
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
        {result.summary && (
          <p className="mt-2 text-sm" style={{ color: tone.color, opacity: 0.9 }}>
            {result.summary}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Hail likelihood" value={pct(result.probability)} accent />
        <Stat label="Confidence" value={pct(result.confidence)} />
        <Stat label="Est. hail size" value={size} />
      </div>

      {result.findings.length > 0 && (
        <>
          <div className="rule-atlas" />
          <div>
            <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
              What the model saw
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                  <IconBolt className="mt-0.5 h-3.5 w-3.5 shrink-0 text-copper" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {result.recommendedAction && (
        <div>
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
            Recommended next step
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{result.recommendedAction}</p>
        </div>
      )}

      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700 disabled:opacity-50"
        disabled
        title="Report generation from photo coming soon"
      >
        <IconReport className="h-4 w-4" />
        Generate adjuster-ready report (coming soon)
      </button>
    </>
  );
}

function ErrorPanel({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="space-y-4">
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
        Couldn&apos;t analyze
      </p>
      <div className="rounded-lg border border-border bg-secondary/40 p-4">
        <p className="text-sm text-foreground/85 leading-relaxed">{msg}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-atlas hover:bg-copper-700"
      >
        Try another photo
      </button>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <p className="text-[10px] font-mono uppercase tracking-wide-caps text-foreground/55">{label}</p>
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

function clamp01(n: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
