import { ImageResponse } from "next/og";
import { hailColor } from "@/lib/hail";
import { nearestMetro } from "@/lib/metros";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "HailScout storm record";
export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://hail-scout-production.up.railway.app";

interface ApiStormDetail {
  id: string;
  start_time: string;
  end_time: string;
  max_hail_size_in: number;
  source: string;
  centroid: { type: "Point"; coordinates: [number, number] } | null;
}

/**
 * Per-storm Open Graph image — rendered at request time by Next.js
 * Image Response so every shared /storm/{id} URL on Twitter / SMS /
 * Slack pulls a custom card with the hail badge, metro, date, source.
 *
 * Falls back to a generic "Storm record" card if the API can't
 * resolve the id (deleted storm, malformed id, etc.).
 */
export default async function StormOG({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let storm: ApiStormDetail | null = null;
  try {
    const res = await fetch(`${API_BASE}/v1/storms/${encodeURIComponent(id)}`, {
      // No-cache: storms backfill in waves, and we don't want stale
      // OG cards lingering for hours. Cost is ~50ms per share.
      cache: "no-store",
    });
    if (res.ok) storm = await res.json();
  } catch {
    // fall through to fallback card
  }

  const fallback = !storm;
  const peak = storm?.max_hail_size_in ?? 0;
  const c = hailColor(peak || 1.0);
  const [lng, lat] = storm?.centroid?.coordinates ?? [0, 0];
  const where = storm ? nearestMetro(lat, lng) : null;
  const whereLabel = where?.label ?? "United States";
  const startDate = storm
    ? new Date(storm.start_time).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Storm record";
  const source = storm?.source ?? "MRMS";
  const sizeLabel = fallback ? "—" : `${peak.toFixed(2)}″`;
  const objectLabel = fallback ? "Storm" : c.object;
  const heavy = peak >= 1.5;
  const badgeFg = heavy ? "#FAF7F1" : c.text;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#F5F1EA",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* Topographic backdrop */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: "absolute", inset: 0, opacity: 0.55 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M-50,420 Q300,360 600,400 T1250,360" fill="none" stroke="#0F4C5C" strokeWidth="2" opacity="0.18" />
          <path d="M-50,360 Q300,300 600,340 T1250,300" fill="none" stroke="#0F4C5C" strokeWidth="2" opacity="0.14" />
          <path d="M-50,300 Q300,240 600,280 T1250,240" fill="none" stroke="#0F4C5C" strokeWidth="2" opacity="0.10" />
          <path d="M-50,240 Q300,180 600,220 T1250,180" fill="none" stroke="#0F4C5C" strokeWidth="2" opacity="0.07" />
          <path d="M50,490 Q400,420 700,440 T1180,400" fill="none" stroke="#D87C4A" strokeWidth="2.6" opacity="0.55" />
        </svg>

        {/* Header — wordmark + record eyebrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="44" height="44" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="11" stroke="#0F4C5C" strokeWidth="1.4" />
              <circle cx="14" cy="14" r="7" stroke="#0F4C5C" strokeWidth="1.2" />
              <circle cx="14" cy="14" r="3.5" stroke="#D87C4A" strokeWidth="1.2" />
              <path d="M5 14 Q14 7 23 14" stroke="#D87C4A" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="14" cy="14" r="1.4" fill="#D87C4A" />
            </svg>
            <span style={{ fontSize: 30, color: "#2B2620", letterSpacing: -0.5, fontWeight: 500 }}>HailScout</span>
          </div>
          <span style={{ fontSize: 16, color: "#6B6052", letterSpacing: 2, textTransform: "uppercase" }}>
            Storm record · {source}
          </span>
        </div>

        {/* Center — title + meta */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontSize: 18,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#D87C4A",
            }}
          >
            <span>{startDate}</span>
            {where && where.miles >= 5 && where.miles <= 250 && (
              <>
                <span style={{ color: "#0F4C5C", opacity: 0.4 }}>·</span>
                <span style={{ color: "#6B6052" }}>
                  ~{where.miles}mi from {where.metro.name}
                </span>
              </>
            )}
          </div>
          <div
            style={{
              fontSize: 88,
              color: "#0F4C5C",
              lineHeight: 1.0,
              letterSpacing: -2,
              fontWeight: 500,
              display: "flex",
            }}
          >
            {whereLabel}
          </div>

          {/* Hail badge — big and unmistakable */}
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 168,
                height: 168,
                borderRadius: 18,
                background: c.solid,
                color: badgeFg,
                boxShadow: "0 12px 32px -8px rgba(0,0,0,0.25)",
              }}
            >
              <span style={{ fontSize: 64, fontWeight: 600, letterSpacing: -2, lineHeight: 1 }}>
                {sizeLabel}
              </span>
              <span style={{ fontSize: 16, textTransform: "uppercase", letterSpacing: 2, marginTop: 8, opacity: 0.92 }}>
                {objectLabel}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 22, color: "#6B6052", textTransform: "uppercase", letterSpacing: 1.4 }}>
                Peak hail diameter
              </span>
              <span style={{ fontSize: 26, color: "#2B2620", maxWidth: 600 }}>
                {fallback
                  ? "Storm record not found"
                  : peak >= 2.0
                    ? "Damaging hail event — major roof-claim risk inside the footprint."
                    : peak >= 1.0
                      ? "Claim-eligible damage likely on standard roofing materials."
                      : "Light hail event — surface damage possible."}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            color: "#6B6052",
            fontSize: 18,
          }}
        >
          <span>hailscout.net/storm/{id.slice(0, 24)}</span>
          <span style={{ fontFamily: "monospace", fontSize: 14 }}>
            HAILSCOUT · STORM PLATE
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
