import { ImageResponse } from "next/og";

export const dynamic = "force-static";

/** Pre-render the two sizes the manifest references. */
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

/**
 * Maskable-safe app icon: the HailScout concentric-ring mark centered on a
 * solid teal field (fills the maskable safe area), rendered at the requested
 * size. Referenced by the PWA manifest at 192 + 512.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;
  const s = Math.min(1024, Math.max(48, parseInt(size, 10) || 192));

  const ring1 = Math.round(s * 0.56);
  const ring2 = Math.round(ring1 * 0.62);
  const dot = Math.round(s * 0.12);
  const bw = Math.max(2, Math.round(s * 0.013));

  return new ImageResponse(
    (
      <div
        style={{
          width: s,
          height: s,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F4C5C",
        }}
      >
        <div
          style={{
            width: ring1,
            height: ring1,
            borderRadius: 9999,
            border: `${bw}px solid #F5F1EA`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: ring2,
              height: ring2,
              borderRadius: 9999,
              border: `${Math.max(1, bw - 1)}px solid #F5F1EA`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: dot, height: dot, borderRadius: 9999, background: "#D87C4A" }} />
          </div>
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
