import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/site-chrome";
import { SectionHeading, CtaBand } from "@/components/marketing/primitives";
import { ContourBg } from "@/components/brand/contour-bg";

export const metadata: Metadata = {
  title: "API",
  description:
    "Hail GPS's public hail intelligence API. Storms by bbox and date, hail at a point, SPC hail outlooks, live radar frames. GeoJSON out, no auth required.",
};

const BASE = "https://hail-scout-production.up.railway.app";

/**
 * Public API documentation. Server-rendered (static) — no client hooks,
 * just typed examples. Every endpoint documented here is real, public,
 * and unauthenticated; customer-data endpoints are deliberately absent.
 */
export default function ApiDocsPage() {
  return (
    <main className="bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <ContourBg density="sparse" className="opacity-60" />
        <div className="container relative max-w-6xl pb-14 pt-20 md:pb-16 md:pt-28">
          <p className="eyebrow">Developer · public API</p>
          <h1 className="display-1 mt-4 max-w-3xl text-foreground">
            Build on Hail GPS.
          </h1>
          <p className="mt-5 max-w-prose text-base leading-[1.65] text-muted-foreground">
            REST endpoints over every hail cell Hail GPS has ingested, plus
            the live radar frames and SPC hail outlooks behind the map.
            Proper GeoJSON out. No auth required for anything on this page.
          </p>
          <div className="mt-7 inline-flex max-w-full items-center gap-3 overflow-x-auto rounded-md border border-border bg-card px-4 py-2.5 font-mono text-sm">
            <span className="shrink-0 text-muted-foreground">Base URL</span>
            <code className="whitespace-nowrap text-primary">{BASE}</code>
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="container max-w-6xl">
          <SectionHeading
            eyebrow="Endpoints"
            title="Six endpoints, all public."
            lede="Storm cells, address history, aggregate stats, forecast outlooks, and the radar loop — the same data the product renders."
          />

          <div className="mt-12 grid gap-8">
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
                { name: "simplify",  type: "float",    desc: "Geometry simplification tolerance (degrees) when include=swaths. 0 = full precision.", example: "0.02" },
                { name: "source",    type: "string",   desc: "Filter pipeline source: 'MRMS' or 'NEXRAD'.",         example: "MRMS" },
                { name: "min_size",  type: "float",    desc: "Drop cells with peak hail < this size (inches).",     example: "1.0" },
                { name: "order",     type: "string",   desc: "'recent' (default) or 'peak' (biggest first).",        example: "peak" },
              ]}
              curlExample={`curl "${BASE}/v1/storms?bbox=-105,30,-90,42&from=2026-04-01&to=2026-05-13&limit=10&order=peak"`}
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
              path="/v1/storms/at-point"
              summary="What hit this exact address? Storms whose swaths contain the point."
              params={[
                { name: "lat",   type: "float", desc: "Latitude (WGS84). -90 to 90.",   required: true,  example: "32.78" },
                { name: "lng",   type: "float", desc: "Longitude (WGS84). -180 to 180.", required: true,  example: "-96.80" },
                { name: "from",  type: "ISO date", desc: "Window start. Optional.",                 example: "2025-05-13" },
                { name: "to",    type: "ISO date", desc: "Window end. Optional.",                   example: "2026-05-13" },
                { name: "limit", type: "int",      desc: "Max hits. 1-200.",                        example: "20" },
              ]}
              curlExample={`curl "${BASE}/v1/storms/at-point?lat=32.78&lng=-96.80"`}
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
              curlExample={`curl "${BASE}/v1/storms/storm_5pYhBb3LZqq0cA"`}
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

            <Endpoint
              method="GET"
              path="/v1/storms/stats"
              summary="Aggregate counts over the whole storms table"
              params={[]}
              curlExample={`curl "${BASE}/v1/storms/stats"`}
              responseExample={`{
  "total_cells": 99110,
  "cells_last_24h": 122,
  "cells_last_7d": 1246,
  "cells_last_30d": 5628,
  "peak_hail_in": 7.0,
  "earliest": "2021-01-01T00:00:20Z",
  "latest":   "2026-08-01T06:50:00Z",
  "sources": { "SPC-LSR": 47443, "NEXRAD": 35379, "MRMS": 16288 }
}`}
            />

            <Endpoint
              method="GET"
              path="/v1/outlook/hail"
              summary="SPC hail-probability contours for a forecast day, as GeoJSON"
              isNew
              params={[
                { name: "day",  type: "int",    desc: "Forecast day: 1 = today, 2 = tomorrow, 3 = the day after. Default 1.", example: "1" },
                { name: "kind", type: "string", desc: "'hail' for any severe hail, 'sighail' for the significant (2in+) subset. Omit for both.", example: "hail" },
                { name: "include_expired", type: "bool", desc: "Also return outlook periods that have already ended. Default false.", example: "false" },
              ]}
              curlExample={`curl "${BASE}/v1/outlook/hail?day=1"`}
              responseExample={`{
  "outlooks": [
    {
      "id": "outlook_xxx",
      "day": 1,
      "kind": "hail",
      "probability": 0.15,
      "label": "15%",
      "valid_from": "2026-08-01T12:00:00Z",
      "valid_to": "2026-08-02T12:00:00Z",
      "issued_at": "2026-08-01T12:31:00Z",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[[[ ... ]]]]
      }
    }
  ]
}`}
            />

            <Endpoint
              method="GET"
              path="/v1/radar/frames"
              summary="Newest-first radar frames for one product — image metadata + a PNG URL each"
              isNew
              params={[
                { name: "product", type: "string", desc: "'mesh' (hail size), 'posh' (hail likely), or 'reflectivity' (where the storm is). Default 'mesh'.", example: "mesh" },
                { name: "limit",   type: "int",    desc: "How many frames, newest first. 1-60; frames land ~every 2 minutes, so 12 ≈ 24 minutes of loop.", example: "12" },
              ]}
              curlExample={`curl "${BASE}/v1/radar/frames?product=mesh&limit=12"`}
              responseExample={`{
  "frames": [
    {
      "id": "mesh_20260801T073843Z",
      "product": "mesh",
      "valid_time": "2026-08-01T07:38:43Z",
      "bounds": {
        "min_lat": 20.0, "min_lng": -130.0,
        "max_lat": 55.0, "max_lng": -60.0
      },
      "width": 1750,
      "height": 875,
      "peak_value": 0.63,
      "url": "/v1/radar/frames/mesh_20260801T073843Z.png"
    }
  ]
}`}
            />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-24 md:py-32">
        <div className="container max-w-6xl">
          <div className="max-w-3xl">
            <SectionHeading eyebrow="Notes" title="Things to know" />
            <ul className="mt-10 space-y-4 text-sm leading-[1.65] text-foreground/85">
              <li>
                <strong className="font-semibold">Sort order:</strong> default is
                start_time DESC (most recent first). Pass{" "}
                <code className="font-mono text-primary">?order=peak</code> to sort
                by peak hail size for &quot;biggest events&quot; views.
              </li>
              <li>
                <strong className="font-semibold">Geometry payload:</strong> swaths
                can be huge. Use{" "}
                <code className="font-mono text-primary">?simplify=0.02</code>{" "}
                (~2 km tolerance) for map rendering; drop to 0 for full precision
                in analytics.
              </li>
              <li>
                <strong className="font-semibold">Source field:</strong>{" "}
                <code className="font-mono">MRMS</code> is the 1 km CONUS-wide
                radar pipeline, <code className="font-mono">NEXRAD</code> the
                sub-km single-radar pipeline, and{" "}
                <code className="font-mono">SPC-LSR</code> ground hail reports.
                Same schema, different upstream.
              </li>
              <li>
                <strong className="font-semibold">Radar frame PNGs:</strong> a
                frame id is immutable — the PNG at its{" "}
                <code className="font-mono">url</code> is cached forever and
                answers 304 to a matching ETag, so a looping client re-fetches
                nothing.
              </li>
              <li>
                <strong className="font-semibold">Outlooks on quiet days:</strong>{" "}
                a day with no hail forecast legitimately returns an empty{" "}
                <code className="font-mono">outlooks</code> list — never a
                placeholder shape. Only the newest SPC issuance is returned per
                kind.
              </li>
              <li>
                <strong className="font-semibold">Rate limits:</strong> none
                published right now. Be reasonable — we run on a shared
                instance.
              </li>
              <li>
                <strong className="font-semibold">Auth:</strong> none for the
                endpoints above. Customer-data endpoints (alerts, markers,
                contacts) require an authenticated session and are not
                documented here.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <CtaBand
        title="Need authenticated endpoints or higher quotas?"
        lede="Request access — accounts get tokens for the customer-data endpoints: alerts, monitored addresses, exports."
        primary={{ label: "Request access", href: "/request-access" }}
        secondary={{ label: "Browse the storm catalog", href: "/storms" }}
      />

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
  isNew,
}: {
  method: string;
  path: string;
  summary: string;
  params: Param[];
  curlExample: string;
  responseExample: string;
  isNew?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border bg-secondary/40 px-6 py-4">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
          {method}
        </span>
        <code className="font-mono text-base font-medium text-foreground">{path}</code>
        {isNew && (
          <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
            New
          </span>
        )}
        <span className="w-full text-sm text-muted-foreground sm:ml-auto sm:w-auto">{summary}</span>
      </div>

      {params.length > 0 && (
        <div className="border-b border-border/60 px-6 py-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Query parameters
          </p>
          <ul className="space-y-3 text-sm sm:space-y-2">
            {params.map((p) => (
              <li
                key={p.name}
                className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[10rem_5rem_1fr_auto] sm:items-baseline"
              >
                <span className="flex items-baseline gap-3">
                  <code className="font-mono text-primary">
                    {p.name}
                    {p.required ? "" : "?"}
                  </code>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
                    {p.type}
                  </span>
                </span>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:block">
                  {p.type}
                </span>
                <span className="text-foreground/85">{p.desc}</span>
                {p.example && (
                  <code className="font-mono text-[11px] text-muted-foreground sm:whitespace-nowrap">
                    e.g. {p.example}
                  </code>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid divide-y divide-border/60 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="min-w-0 px-6 py-5">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            cURL
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/85">
            {curlExample}
          </pre>
        </div>
        <div className="min-w-0 px-6 py-5">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Response
          </p>
          <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-foreground/85">
            {responseExample}
          </pre>
        </div>
      </div>
    </article>
  );
}
