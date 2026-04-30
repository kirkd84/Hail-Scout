"use client";

/**
 * Hail Impact Report — client-side branded PDF.
 *
 * Generated entirely in the browser via @react-pdf/renderer. No backend
 * round-trip. Used as the demo wow-moment: contractor opens a storm,
 * clicks "Download Hail Impact Report", gets a polished cream-paper PDF
 * with the brand mark, the address, the storm meta, and the legal
 * disclaimer ready to hand to a homeowner.
 *
 * Limitations of the v1: no embedded map snapshot. Future passes can
 * use html2canvas on the live map and embed the dataURL via <Image src=...>.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Circle,
  Image,
} from "@react-pdf/renderer";
import type { Storm } from "@/lib/api-types";
import { hailColor } from "@/lib/hail";

interface ReportProps {
  storm: Storm;
  /** Optional address — set when generated from address-search context. */
  address?: string;
  /** PNG dataURL of a live map snapshot. When provided, renders above the hero. */
  mapImage?: string;
  organizationName?: string;
  preparedBy?: string;
}

const COLORS = {
  cream: "#F5F1EA",
  creamLift: "#FAF7F1",
  paper: "#FFFFFF",
  charcoal: "#2B2620",
  textMuted: "#6B6052",
  border: "#E0D9CC",
  teal: "#0F4C5C",
  copper: "#D87C4A",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.cream,
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.charcoal,
    lineHeight: 1.5,
  },
  /* Top wordmark row */
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontSize: 14, fontFamily: "Helvetica-Bold", color: COLORS.teal, letterSpacing: -0.4 },
  topMeta: { fontSize: 8, color: COLORS.textMuted, fontFamily: "Helvetica-Oblique" },

  /* Atlas rule */
  rule: { height: 0.6, backgroundColor: COLORS.border, marginVertical: 14 },

  /* Eyebrow / display headings */
  eyebrow: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.copper, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 },
  display: { fontSize: 28, fontFamily: "Helvetica-Bold", color: COLORS.charcoal, letterSpacing: -0.7, marginBottom: 4, lineHeight: 1.1 },
  subtitle: { fontSize: 11, color: COLORS.textMuted, marginBottom: 8 },

  /* Map snapshot block */
  mapBlock: {
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: COLORS.border,
    overflow: "hidden",
    backgroundColor: COLORS.creamLift,
  },
  mapImage: { width: "100%", height: 220, objectFit: "cover" },
  mapCaption: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 8,
    color: COLORS.textMuted,
    fontFamily: "Courier",
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },

  /* Hero card */
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 8,
    marginVertical: 18,
    borderWidth: 0.6,
  },
  heroDial: { width: 78, height: 78, marginRight: 18 },
  heroNumber: { fontSize: 34, fontFamily: "Helvetica-Bold", letterSpacing: -1 },
  heroObject: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  heroBin: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.4, textTransform: "uppercase", marginTop: 6 },

  /* Two-column meta grid */
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  metaCol: { width: "50%", paddingVertical: 6, paddingRight: 12 },
  metaLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.textMuted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 },
  metaValue: { fontSize: 11, color: COLORS.charcoal },
  mono: { fontFamily: "Courier" },

  /* Section block */
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COLORS.charcoal, marginBottom: 8, marginTop: 6 },
  sectionBody: { fontSize: 10, color: COLORS.charcoal, lineHeight: 1.55 },

  /* Footer */
  footer: { position: "absolute", bottom: 32, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingTop: 10 },
  footerText: { fontSize: 7.5, color: COLORS.textMuted },

  disclaimer: {
    fontSize: 8,
    color: COLORS.textMuted,
    backgroundColor: COLORS.creamLift,
    borderColor: COLORS.border,
    borderWidth: 0.5,
    padding: 12,
    borderRadius: 6,
    lineHeight: 1.5,
    marginTop: 8,
  },
});

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function durationMin(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 60000));
}

export function HailImpactReport({
  storm,
  address,
  mapImage,
  organizationName = "HailScout",
  preparedBy = "HailScout AI",
}: ReportProps) {
  const c = hailColor(storm.max_hail_size_in);
  const reportDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const reportId = `HSR-${storm.id.slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const dur = durationMin(storm.start_time, storm.end_time);

  return (
    <Document title={`Hail Impact Report — ${address ?? storm.id}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Top brand row */}
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Svg width={22} height={22} viewBox="0 0 28 28">
              <Circle cx={14} cy={14} r={11} stroke={COLORS.teal} strokeWidth={1.4} fill="none" />
              <Circle cx={14} cy={14} r={7} stroke={COLORS.teal} strokeWidth={1.2} fill="none" />
              <Circle cx={14} cy={14} r={3.5} stroke={COLORS.copper} strokeWidth={1.2} fill="none" />
              <Path d="M5 14 Q14 7 23 14" stroke={COLORS.copper} strokeWidth={1.2} fill="none" />
              <Circle cx={14} cy={14} r={1.4} fill={COLORS.copper} />
            </Svg>
            <Text style={styles.brandText}>HailScout</Text>
          </View>
          <Text style={styles.topMeta}>Hail Impact Report · {reportDate}</Text>
        </View>

        <View style={styles.rule} />

        <Text style={styles.eyebrow}>Storm record</Text>
        <Text style={styles.display}>Hail Impact Report</Text>
        <Text style={styles.subtitle}>
          {address ?? "Affected location"} · prepared by {organizationName}
        </Text>

        {mapImage && (
          <View style={styles.mapBlock}>
            <Image src={mapImage} style={styles.mapImage} />
            <View style={styles.mapCaption}>
              <Text>STORM SWATH · {address ?? "affected area"}</Text>
              <Text>
                {storm.bbox
                  ? `${storm.bbox.min_lat.toFixed(2)},${storm.bbox.min_lng.toFixed(2)} → ${storm.bbox.max_lat.toFixed(2)},${storm.bbox.max_lng.toFixed(2)}`
                  : ""}
              </Text>
            </View>
          </View>
        )}

        {/* Hero card */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: c.bg, borderColor: c.border },
          ]}
        >
          <Svg style={styles.heroDial} viewBox="0 0 80 80">
            <Circle cx={40} cy={40} r={36} stroke={c.solid} strokeWidth={1.4} fill="none" opacity={0.5} />
            <Circle cx={40} cy={40} r={26} stroke={c.solid} strokeWidth={1.2} fill="none" opacity={0.7} />
            <Circle cx={40} cy={40} r={16} fill={c.solid} fillOpacity={0.9} />
          </Svg>
          <View>
            <Text style={[styles.eyebrow, { color: c.text }]}>Max hail diameter</Text>
            <Text style={[styles.heroNumber, { color: c.text }]}>
              {storm.max_hail_size_in.toFixed(2)}″
            </Text>
            <Text style={[styles.heroObject, { color: c.text }]}>{c.object}</Text>
            <Text style={[styles.heroBin, { color: c.text }]}>MRMS · {c.label}</Text>
          </View>
        </View>

        {/* Meta grid */}
        <Text style={styles.eyebrow}>Storm details</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Start</Text>
            <Text style={styles.metaValue}>{fmtDateTime(storm.start_time)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>End</Text>
            <Text style={styles.metaValue}>{fmtDateTime(storm.end_time)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Duration</Text>
            <Text style={styles.metaValue}>{dur} min</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Source</Text>
            <Text style={styles.metaValue}>
              {storm.source === "mrms" ? "Real-time MRMS" : "Historical archive"}
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Centroid</Text>
            <Text style={[styles.metaValue, styles.mono]}>
              {storm.centroid_lat?.toFixed(4)}°N, {Math.abs(storm.centroid_lng ?? 0).toFixed(4)}°W
            </Text>
          </View>
          {storm.bbox && (
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Bounds</Text>
              <Text style={[styles.metaValue, styles.mono]}>
                {storm.bbox.min_lat.toFixed(2)}, {storm.bbox.min_lng.toFixed(2)} →{" "}
                {storm.bbox.max_lat.toFixed(2)}, {storm.bbox.max_lng.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rule} />

        <Text style={styles.sectionTitle}>What this means</Text>
        <Text style={styles.sectionBody}>
          NOAA Multi-Radar Multi-Sensor (MRMS) data identified hail with a peak
          diameter of {storm.max_hail_size_in.toFixed(2)}″ ({c.object.toLowerCase()})
          across the affected area on {fmtDateTime(storm.start_time)}. Hail of
          this magnitude commonly causes shingle bruising, granule loss, and
          potential decking damage — sufficient grounds for an insurance claim
          and a professional roof inspection.
        </Text>

        <Text style={styles.sectionTitle}>Recommended next steps</Text>
        <Text style={styles.sectionBody}>
          1. Request a roof inspection from a licensed contractor.{"\n"}
          2. Document interior and exterior damage with timestamped photos.{"\n"}
          3. Notify your insurance carrier of a potential hail-damage claim.{"\n"}
          4. Retain this report as supporting evidence of the storm event.
        </Text>

        <View style={styles.disclaimer}>
          <Text>
            Disclaimer: This report is generated from NOAA MRMS radar-derived hail
            estimates and is intended for informational purposes only. Individual
            hail-size estimates carry approximately ±0.25″ uncertainty.
            On-the-ground damage assessment by a licensed professional is
            required before filing an insurance claim. {organizationName} makes
            no warranty of fitness for any particular purpose.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Report ID: {reportId} · Prepared by {preparedBy}
          </Text>
          <Text style={styles.footerText}>
            HailScout · hail-scout.vercel.app · Data: NOAA MRMS
          </Text>
        </View>
      </Page>
    </Document>
  );
}
