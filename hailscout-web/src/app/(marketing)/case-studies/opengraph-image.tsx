import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Playbooks — how crews run Hail GPS.";
export const dynamic = "force-static";

/** Dark "Storm Instrument" plate: slate ground, contour lines, cyan trail. */
export default function OG() {
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
          <circle cx="700" cy="440" r="7" fill="#22D3EE" />
          <circle cx="1180" cy="400" r="8" fill="#22D3EE" />
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
          <svg width="44" height="44" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11" stroke="#94A3B8" strokeWidth="1.4" />
            <circle cx="14" cy="14" r="7" stroke="#94A3B8" strokeWidth="1.2" />
            <circle cx="14" cy="14" r="3.5" stroke="#22D3EE" strokeWidth="1.2" />
            <path d="M5 14 Q14 7 23 14" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="14" cy="14" r="1.4" fill="#22D3EE" />
          </svg>
          <span style={{ fontSize: 32, color: "#F8FAFC", letterSpacing: -0.5, fontWeight: 600 }}>Hail GPS</span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
          <div style={{ fontSize: 18, color: "#22D3EE", letterSpacing: 2, textTransform: "uppercase" }}>
            Playbooks
          </div>
          <div
            style={{
              fontSize: 96,
              color: "#F8FAFC",
              lineHeight: 1.03,
              marginTop: 24,
              maxWidth: 1000,
              letterSpacing: -2,
              fontWeight: 600,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>How crews</span>
            <span style={{ color: "#22D3EE" }}>run Hail GPS.</span>
          </div>
          <div style={{ fontSize: 26, color: "#94A3B8", marginTop: 32, maxWidth: 880, lineHeight: 1.4 }}>
            The storm day and the canvassing week — hour-by-hour walkthroughs of the workflow.
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
          <span>hailgps.com/case-studies</span>
          <span style={{ fontFamily: "monospace", fontSize: 14 }}>PLATE 09 · PLAYBOOKS</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
