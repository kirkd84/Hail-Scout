"use client";

/**
 * Street View panel — shows a ground-level look at a searched address so a
 * rep can size up the house (stories, footprint, roof pitch) before knocking.
 *
 * Uses Google's Maps Embed API (streetview mode), which is FREE — no
 * per-load billing, unlike the Static Street View API. It needs a Google
 * Maps key exposed to the browser as NEXT_PUBLIC_GOOGLE_MAPS_KEY, HTTP-
 * referrer-restricted to the HailScout domains with "Maps Embed API"
 * enabled.
 *
 * Graceful degradation: with NO key set, the panel is a one-click card that
 * opens Google Street View in a new tab (works today, zero setup). Set the
 * key and it upgrades in place to the embedded panorama — no code change.
 */

interface Props {
  lat: number;
  lng: number;
  address?: string;
}

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

export function StreetViewPanel({ lat, lng, address }: Props) {
  // New-tab deep link into Google Street View — needs no API key.
  const panoUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  const embedUrl = GOOGLE_KEY
    ? `https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_KEY}&location=${lat},${lng}&fov=80`
    : null;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[10px] font-mono uppercase tracking-wide-caps text-copper">
          Street view
        </p>
        <a
          href={panoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-foreground/50 transition-colors hover:text-foreground"
        >
          Open in Google ↗
        </a>
      </div>

      {embedUrl ? (
        <iframe
          title={`Street view of ${address ?? "this location"}`}
          src={embedUrl}
          className="aspect-[4/3] w-full rounded-lg border border-border"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <a
          href={panoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/20 px-4 text-center transition-colors hover:bg-secondary/30"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-copper" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="2.5" />
            <path d="M12 12.5c-2.8 0-5 1.6-5 3.5v3h10v-3c0-1.9-2.2-3.5-5-3.5z" />
            <path d="M4 20h16" />
          </svg>
          <span className="text-sm font-medium text-foreground/85">
            See this house on Street View
          </span>
          <span className="text-xs text-foreground/50">
            Opens Google Street View in a new tab
          </span>
        </a>
      )}
    </section>
  );
}
