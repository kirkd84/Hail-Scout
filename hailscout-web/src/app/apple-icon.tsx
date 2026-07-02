import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#F8FAFC",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
        }}
      >
        <svg width="140" height="140" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" fill="none">
          <circle cx="14" cy="14" r="11" stroke="#1F2937" strokeWidth="1.4" />
          <circle cx="14" cy="14" r="7" stroke="#1F2937" strokeWidth="1.2" />
          <circle cx="14" cy="14" r="3.5" stroke="#06B6D4" strokeWidth="1.2" />
          <path d="M5 14 Q14 7 23 14" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="14" cy="14" r="1.4" fill="#06B6D4" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
