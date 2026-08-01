import { ImageResponse } from "next/og";
import { PLAYBOOKS, getPlaybook } from "../_content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Hail GPS playbook — workflow walkthrough";

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pb = getPlaybook(slug);
  return [
    {
      id: slug,
      size,
      alt: pb ? `${pb.title} — how crews run Hail GPS` : "Hail GPS playbook",
      contentType,
    },
  ];
}

export async function generateStaticParams() {
  return PLAYBOOKS.map((p) => ({ slug: p.slug }));
}

export default async function OG({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pb = getPlaybook(slug);
  const title = pb?.title ?? "Playbook";
  const timeframe = pb?.timeframe ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0F172A",
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
          style={{ position: "absolute", inset: 0 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M-50,420 Q300,360 600,400 T1250,360" fill="none" stroke="#94A3B8" strokeWidth="2" opacity="0.16" />
          <path d="M-50,360 Q300,300 600,340 T1250,300" fill="none" stroke="#94A3B8" strokeWidth="2" opacity="0.12" />
          <path d="M-50,300 Q300,240 600,280 T1250,240" fill="none" stroke="#94A3B8" strokeWidth="2" opacity="0.09" />
          <path d="M-50,240 Q300,180 600,220 T1250,180" fill="none" stroke="#94A3B8" strokeWidth="2" opacity="0.06" />
          <path d="M50,490 Q400,420 700,440 T1180,400" fill="none" stroke="#22D3EE" strokeWidth="2.6" opacity="0.85" />
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
          <svg width="44" height="44" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11" stroke="#94A3B8" strokeWidth="1.4" />
            <circle cx="14" cy="14" r="7" stroke="#94A3B8" strokeWidth="1.2" />
            <circle cx="14" cy="14" r="3.5" stroke="#22D3EE" strokeWidth="1.2" />
            <path d="M5 14 Q14 7 23 14" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="14" cy="14" r="1.4" fill="#22D3EE" />
          </svg>
          <span style={{ fontSize: 30, color: "#F8FAFC", letterSpacing: -0.5, fontWeight: 600 }}>Hail GPS</span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "#22D3EE" }}>
            <span>Playbook</span>
            {timeframe && (
              <>
                <span style={{ color: "#94A3B8", opacity: 0.5 }}>·</span>
                <span style={{ color: "#94A3B8" }}>{timeframe}</span>
              </>
            )}
          </div>
          <div
            style={{
              fontSize: 84,
              color: "#F8FAFC",
              lineHeight: 1.05,
              maxWidth: 1040,
              letterSpacing: -1.5,
              fontWeight: 600,
              display: "flex",
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 24, color: "#94A3B8", maxWidth: 900, lineHeight: 1.4 }}>
            A workflow walkthrough — how crews run Hail GPS in the field.
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            color: "#94A3B8",
            fontSize: 18,
          }}
        >
          <span>hailgps.com/case-studies/{slug}</span>
          <span style={{ fontFamily: "monospace", fontSize: 14 }}>PLATE 09 · {slug.toUpperCase()}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
