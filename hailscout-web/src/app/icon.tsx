import { ImageResponse } from "next/og";

/**
 * Dynamic favicon — the topographic radar mark on cream.
 * Next.js renders this to /favicon.ico automatically at build time.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#F5F1EA",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          <circle cx="14" cy="14" r="11" stroke="#0F4C5C" strokeWidth="1.6" />
          <circle cx="14" cy="14" r="7" stroke="#0F4C5C" strokeWidth="1.4" />
          <circle cx="14" cy="14" r="3.5" stroke="#D87C4A" strokeWidth="1.4" />
          <path d="M5 14 Q14 7 23 14" stroke="#D87C4A" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="14" cy="14" r="1.4" fill="#D87C4A" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
