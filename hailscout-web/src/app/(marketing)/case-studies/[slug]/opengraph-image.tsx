import { ImageResponse } from "next/og";
import { CASE_STUDIES, getCaseStudy } from "@/lib/case-studies";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "HailScout customer story";

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  return [
    {
      id: slug,
      size,
      alt: cs ? `${cs.headline} — ${cs.region}` : "HailScout customer story",
      contentType,
    },
  ];
}

export async function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export default async function OG({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  const headline = cs?.headline ?? "Customer story";
  const region = cs?.region ?? "";
  const stat = cs?.stats?.[0];

  return new ImageResponse(
    (
      <div
        style={{
          background: "#F5F1EA",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          position: "relative",
        }}
      >
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
          <path d="M50,490 Q400,420 700,440 T1180,400" fill="none" stroke="#D87C4A" strokeWidth="2.6" opacity="0.85" />
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
          <svg width="44" height="44" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11" stroke="#0F4C5C" strokeWidth="1.4" />
            <circle cx="14" cy="14" r="7" stroke="#0F4C5C" strokeWidth="1.2" />
            <circle cx="14" cy="14" r="3.5" stroke="#D87C4A" strokeWidth="1.2" />
            <path d="M5 14 Q14 7 23 14" stroke="#D87C4A" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="14" cy="14" r="1.4" fill="#D87C4A" />
          </svg>
          <span style={{ fontSize: 30, color: "#2B2620", letterSpacing: -0.5, fontWeight: 500 }}>HailScout</span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "#D87C4A" }}>
            <span>Customer story</span>
            {region && (
              <>
                <span style={{ color: "#0F4C5C", opacity: 0.4 }}>·</span>
                <span style={{ color: "#6B6052" }}>{region}</span>
              </>
            )}
          </div>
          <div
            style={{
              fontSize: 70,
              color: "#0F4C5C",
              lineHeight: 1.05,
              maxWidth: 1040,
              letterSpacing: -1.5,
              fontWeight: 500,
              display: "flex",
            }}
          >
            {headline}
          </div>
          {stat && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 12 }}>
              <span style={{ fontSize: 84, color: "#D87C4A", letterSpacing: -2, fontWeight: 500, lineHeight: 1 }}>
                {stat.value}
              </span>
              <span style={{ fontSize: 22, color: "#6B6052", textTransform: "uppercase", letterSpacing: 1.4 }}>
                {stat.label}
              </span>
            </div>
          )}
        </div>

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
          <span>hail-scout.vercel.app/case-studies/{slug}</span>
          <span style={{ fontFamily: "monospace", fontSize: 14 }}>PLATE 09 · STORY {slug.toUpperCase()}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
