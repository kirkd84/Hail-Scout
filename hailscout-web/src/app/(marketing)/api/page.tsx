import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { ContourBg } from "@/components/brand/contour-bg";

export const metadata: Metadata = {
  title: "API · HailScout",
  description:
    "HailScout's public hail intelligence API. Query MRMS + NEXRAD cells by bbox, date, source, size. Free for prospects, no auth required for public endpoints.",
};

/**
 * Public API documentation. Server-rendered (static) — no client hooks,
 * just typed examples. Lists the public endpoints, parameters, and
 * sample responses. Good SEO target for developer keywords + helps
 * partners understand what they can pull.
 */
export default function ApiDocsPage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden bg-topo">
        <ContourBg className="opacity-90" density="sparse" />
        <div className="container relative pb-10 pt-16 md:pb-12 md:pt-20">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">
            Developer · public API
          </p>
          <h1 className="mt-2 font-display text-balance text-5xl font-medium leading-[1.05] tracking-tight-display text-foreground md:text-6xl">
            Build on HailScout.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            REST endpoints over every hail cell HailScout has ingested,
            across MRMS &amp; NEXRAD. Returns proper GeoJSON. No auth
            required for any read endpoint listed here.
          </p>
          <div className="mt-6 inline-flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 font-mono text-sm">
            <span className="text-foreground/55">Base URL:</span>
            <code className="text-copper">https://hail-scout-production.up.railway.app</code>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="container py-12 grid gap-8">
          <Endpoint
            method="GET"
            path="/v1/storms"
            summary="List storm cells in a bounding box + date window"
            params={[
              { name: "bbox",      type: "string",   desc: "WGS84: minlon,minlat,maxlon,maxlat", required: true,  example: "-105,30,-90,42" },
              { name: "from",      type: "ISO date", desc: "Start of window (inclusive)",         required: true,  example: "2026-04-01" },
              { name: "to",        type: "ISO date", desc: "End of window (inclusive)",           required: true,  example: "2026-05-13" },
              { name: "limit",     type: "int",      desc: "Max rows. 1-200.",                                    example: "50" },
              { name: "include",   type: "string",   desc: 'Comma-separated extras. "swaths" embeds the per-cell hail polygons.', example: "swaths" },
              { name: "simplify",  type: "float",    desc: "ST_SimplifyPreserveTopology tolerance (degrees) when include=swaths. 0 = full precision.", example: "0.02" },
              { name: "source",    type: "string",   desc: "Filter pipeline source: 'MRMS' or 'NEXRAD'.",         example: "MRMS" },
              { name: "min_size",  type: "float",    desc: "Drop cells with peak hail < this size (inches).",     example: "1.0" },
              { name: "order",     type: "string",   desc: "'recent' (default) or 'peak' (biggest first).",        example: "peak" },
            ]}
            curlExample={`curl "https://hail-scout-production.up.railway.app/v1/storms?bbox=-105,30,-90,42&from=2026-04-01&to=2026-05-13&limit=10&order=peak"`}
            responseExample={`{
  "storms": [
    {
      "id": "storm_5pYhBb3LZqq0cA",
      "start_time": "2026-04-12T11:00:00Z",
      "end_time": "2026-04-12T11:00:00Z",
      "max_hail_size_in": 2.5,
      "source": "MRMS",
      "centroid": {
        "type": "Point",
        "coordinates": [-97.95, 37.79]
      },
      "bbox": {
        "type": "Polygon",
        "coordinates": [[[ ... ]]]
      }
    }
  ],
  "cursor": null,
  "total": 1
}`}
          />

          <Endpoint
            method="GET"
            path="/v1/storms/stats"
            summary="Aggregate counts over the whole storms table"
            params={[]}
            curlExample={`curl "https://hail-scout-production.up.railway.app/v1/storms/stats"`}
            responseExample={`{
  "total_cells": 12345,
  "cells_last_24h": 27,
  "cells_last_7d": 198,
  "cells_last_30d": 921,
  "peak_hail_in": 4.97,
  "earliest": "2025-05-13T00:00:00Z",
  "latest":   "2026-05-13T11:30:00Z",
  "sources": { "MRMS": 12000, "NEXRAD": 345 }
}`}
          />

          <Endpoint
            method="GET"
            path="/v1/storms/at-point"
            summary={"What hit this exact address? Returns the storms whose swaths contain the (lat, lng) point."}
            params={[
              { name: "lat",   type: "float", desc: "Latitude (WGS84). -90 to 90.",   required: true,  example: "32.78" },
              { name: "lng",   type: "float", desc: "Longitude (WGS84). -180 to 180.", required: true,  example: "-96.80" },
              { name: "from",  type: "ISO date", desc: "Window start. Optional.",                 example: "2025-05-13" },
              { name: "to",    type: "ISO date", desc: "Window end. Optional.",                   example: "2026-05-13" },
              { name: "limit", type: "int",      desc: "Max hits. 1-200.",                        example: "20" },
            ]}
            curlExample={`curl "https://hail-scout-production.up.railway.app/v1/storms/at-point?lat=32.78&lng=-96.80"`}
            responseExample={`{
  "lat": 32.78,
  "lng": -96.8,
  "hits": [
    {
      "id": "storm_xxx",
      "start_time": "2026-04-12T11:00:00Z",
      "end_time": "2026-04-12T11:00:00Z",
      "max_hail_size_in": 2.5,
      "source": "MRMS",
      "category_at_point": "2.5"
    }
  ],
  "total": 1
}`}
          />

          <Endpoint
            method="GET"
            path="/v1/storms/{storm_id}"
            summary="Full storm detail with every hail swath as GeoJSON MultiPolygon"
            params={[]}
            curlExample={`curl "https://hail-scout-production.up.railway.app/v1/storms/storm_5pYhBb3LZqq0cA"`}
            responseExample={`{
  "id": "storm_5pYhBb3LZqq0cA",
  "start_time": "2026-04-12T11:00:00Z",
  "end_time": "2026-04-12T11:00:00Z",
  "max_hail_size_in": 2.5,
  "source": "MRMS",
  "centroid": { "type": "Point", "coordinates": [-97.95, 37.79] },
  "bbox":     { "type": "Polygon", "coordinates": [[[ ... ]]] },
  "swaths": [
    {
      "id": "swath_yyy",
      "hail_size_category": "1.5",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[[[ ... ]]]]
      },
      "updated_at": "2026-04-12T11:00:00Z"
    }
  ]
}`}
          />
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="container py-12 max-w-3xl">
          <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
            Notes
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight-display text-foreground">
            Things to know
          </h2>
          <ul className="mt-5 space-y-3 text-sm text-foreground/85 leading-relaxed">
            <li>
              <strong className="font-medium">Sort order:</strong> default
              is start_time DESC (most recent first). Pass{" "}
              <code className="font-mono text-copper">?order=peak</code> to
              sort by peak hail size for &quot;biggest events&quot; views.
            </li>
            <li>
              <strong className="font-medium">Geometry payload:</strong>{" "}
              swaths can be huge. Use{" "}
              <code className="font-mono text-copper">?simplify=0.02</code>{" "}
              (~2 km tolerance) for map-rendering use cases; drop to 0 for
              full precision in analytics.
            </li>
            <li>
              <strong className="font-medium">Source field:</strong>{" "}
              <code className="font-mono">MRMS</code> for the 1 km
              CONUS-wide instantaneous-MESH pipeline,{" "}
              <code className="font-mono">NEXRAD</code> for the sub-km
              Level II / SCIT pipeline. Same schema, different upstream.
            </li>
            <li>
              <strong className="font-medium">Rate limits:</strong> none
              published right now. Be reasonable — we run on a shared
              Railway instance.
            </li>
            <li>
              <strong className="font-medium">Auth:</strong> none for the
              endpoints above. Customer-data endpoints (alerts, markers,
              contacts) require an authenticated session token and are not
              documented here.
            </li>
          </ul>
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container py-12 text-center md:py-16">
          <h2 className="font-display text-balance text-3xl font-medium tracking-tight-display md:text-4xl">
            Need authenticated endpoints, webhooks, or higher quotas?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Sign up for an account — you&apos;ll get an access token
            that unlocks the customer-data endpoints (alerts, monitored
            addresses, exports).
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/request-access" className="inline-flex items-center gap-2 rounded-md bg-copper px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-copper-700">
              Request access <span aria-hidden>→</span>
            </Link>
            <Link href="/storms" className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 bg-transparent px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10">
              Browse the catalog
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

interface Param {
  name: string;
  type: string;
  desc: string;
  required?: boolean;
  example?: string;
}

function Endpoint({
  method,
  path,
  summary,
  params,
  curlExample,
  responseExample,
}: {
  method: string;
  path: string;
  summary: string;
  params: Param[];
  curlExample: string;
  responseExample: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-secondary/30 flex items-baseline gap-3 flex-wrap">
        <span className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
          {method}
        </span>
        <code className="font-mono text-base font-medium text-foreground">{path}</code>
        <span className="text-sm text-muted-foreground ml-auto">{summary}</span>
      </div>

      {params.length > 0 && (
        <div className="px-6 py-5 border-b border-border/60">
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 mb-3">
            Query parameters
          </p>
          <ul className="space-y-2 text-sm">
            {params.map((p) => (
              <li key={p.name} className="grid grid-cols-[10rem_5rem_1fr_auto] gap-3 items-baseline">
                <code className="font-mono text-copper">{p.name}{p.required ? "" : "?"}</code>
                <span className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">
                  {p.type}
                </span>
                <span className="text-foreground/85">{p.desc}</span>
                {p.example && (
                  <code className="font-mono text-[11px] text-foreground/55 whitespace-nowrap">
                    e.g. {p.example}
                  </code>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60">
        <div className="px-6 py-5">
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 mb-2">
            cURL
          </p>
          <pre className="text-[11px] font-mono leading-relaxed text-foreground/85 whitespace-pre-wrap break-all">
            {curlExample}
          </pre>
        </div>
        <div className="px-6 py-5">
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55 mb-2">
            Response
          </p>
          <pre className="text-[11px] font-mono leading-relaxed text-foreground/85 whitespace-pre-wrap">
            {responseExample}
          </pre>
        </div>
      </div>
    </article>
  );
}
