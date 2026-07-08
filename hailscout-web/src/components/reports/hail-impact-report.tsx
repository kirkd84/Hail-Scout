"use client";

/**
 * Hail Impact Report — client-side branded, adjuster-grade PDF.
 *
 * Generated entirely in the browser via @react-pdf/renderer (no backend
 * round-trip). Page 1 is the at-a-glance impact summary; page 2 is the
 * defensibility packet an insurance adjuster needs: data-source provenance,
 * the concrete evidence on record (ground-truth report, dual-pol signature,
 * reflectivity), a plain-English methodology + tier glossary, and a formal
 * limitations statement. Optional field photos embed on page 2.
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
  address?: string;
  mapImage?: string;
  organizationName?: string;
  preparedBy?: string;
  /** Field-captured damage photos (dataURLs) — embedded on page 2. */
  photos?: string[];
  /** Hex override for the brand primary (defaults to topographic teal). */
  brandPrimary?: string;
  /** Hex override for the brand accent (defaults to copper). */
  brandAccent?: string;
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
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontSize: 14, fontFamily: "Helvetica-Bold", color: COLORS.teal, letterSpacing: -0.4 },
  topMeta: { fontSize: 8, color: COLORS.textMuted, fontFamily: "Helvetica-Oblique" },

  rule: { height: 0.6, backgroundColor: COLORS.border, marginVertical: 14 },

  eyebrow: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.copper, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 },
  display: { fontSize: 28, fontFamily: "Helvetica-Bold", color: COLORS.charcoal, letterSpacing: -0.7, marginBottom: 4, lineHeight: 1.1 },
  subtitle: { fontSize: 11, color: COLORS.textMuted, marginBottom: 8 },

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
  heroPeak: { fontSize: 8.5, marginTop: 4 },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  metaCol: { width: "50%", paddingVertical: 6, paddingRight: 12 },
  metaLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.textMuted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 },
  metaValue: { fontSize: 11, color: COLORS.charcoal },
  mono: { fontFamily: "Courier" },

  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COLORS.charcoal, marginBottom: 8, marginTop: 6 },
  sectionBody: { fontSize: 10, color: COLORS.charcoal, lineHeight: 1.55 },

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

  verifyCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 8,
    borderWidth: 0.6,
    backgroundColor: COLORS.creamLift,
  },
  verifyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 4,
    marginBottom: 8,
  },
  verifyBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  verifyBadgeText: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, textTransform: "uppercase" },
  verifyBody: { fontSize: 9.5, color: COLORS.charcoal, lineHeight: 1.55, marginBottom: 10 },
  signalRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4, gap: 6 },
  signalMark: { fontSize: 9, fontFamily: "Helvetica-Bold", width: 10 },
  signalLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLORS.charcoal },
  signalDetail: { fontSize: 8.5, color: COLORS.textMuted },

  /* Page 2 — methodology / evidence */
  srcItem: { marginBottom: 8 },
  srcName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: COLORS.charcoal },
  srcDesc: { fontSize: 8.5, color: COLORS.textMuted, lineHeight: 1.5 },
  tierRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 5, gap: 6 },
  tierDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 3 },
  tierName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLORS.charcoal },
  tierDesc: { fontSize: 8.5, color: COLORS.textMuted },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  photo: { width: 150, height: 112, objectFit: "cover", borderRadius: 6, borderWidth: 0.5, borderColor: COLORS.border },
});

/** Tier -> display color. Mirrors the verification tier ranking. */
function tierColor(tier: string): string {
  switch (tier) {
    case "ground_truth_confirmed": return "#2F7A4F"; // forest green — strongest
    case "dual_pol_confirmed":     return "#0F4C5C"; // teal
    case "multi_source":           return "#3B6EA5"; // blue
    case "radar_indicated":        return "#B5792F"; // amber caution
    default:                       return "#9A3B3B"; // unverified red
  }
}

const TIER_GLOSSARY: { tier: string; name: string; desc: string }[] = [
  { tier: "ground_truth_confirmed", name: "Ground-truth confirmed", desc: "Radar hail corroborated by an independent NWS storm report nearby within ~30 minutes. Strongest class of evidence." },
  { tier: "dual_pol_confirmed", name: "Dual-pol confirmed", desc: "Polarimetric radar (ZDR/RhoHV) shows a direct hail signature aloft — physical evidence, not a reflectivity proxy." },
  { tier: "multi_source", name: "Multi-source", desc: "Two independent radar products (MRMS mosaic + single-site NEXRAD) agree on hail at this location and time." },
  { tier: "radar_indicated", name: "Radar-indicated", desc: "Single-source radar estimate without independent confirmation. A screening indicator — pair with inspection." },
  { tier: "unverified", name: "Unverified", desc: "Did not pass false-positive screening; may be radar noise or biological scatter." },
];

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

/** Friendly source label for the hero + narrative. */
function sourceLabel(source?: string): string {
  const s = (source || "").toUpperCase();
  if (s.startsWith("NEXRAD")) return "NEXRAD Level II";
  if (s.startsWith("MRMS") || s === "MESH") return "NOAA MRMS";
  if (s === "SPC-LSR") return "NWS storm report";
  return source || "Radar";
}

export function HailImpactReport({
  storm,
  address,
  mapImage,
  organizationName = "HailScout",
  preparedBy = "HailScout AI",
  photos,
  brandPrimary,
  brandAccent,
}: ReportProps) {
  const primary = brandPrimary || COLORS.teal;
  const accent  = brandAccent  || COLORS.copper;

  // The legally-relevant number is the hail size AT this address (size_at_point),
  // not the storm's global peak miles away. Lead with it when we have it.
  const atPoint = storm.size_at_point ?? null;
  const headlineSize = atPoint ?? storm.max_hail_size_in;
  const c = hailColor(headlineSize);
  const showPeak = atPoint != null && storm.max_hail_size_in - atPoint >= 0.25;

  const reportDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const generatedAt = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
  const reportId = `HSR-${storm.id.slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const dur = durationMin(storm.start_time, storm.end_time);
  const v = storm.verification;

  return (
    <Document title={`Hail Impact Report — ${address ?? storm.id}`}>
      {/* ───────────────────────── PAGE 1 — impact summary ───────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Svg width={22} height={22} viewBox="0 0 28 28">
              <Circle cx={14} cy={14} r={11} stroke={primary} strokeWidth={1.4} fill="none" />
              <Circle cx={14} cy={14} r={7} stroke={primary} strokeWidth={1.2} fill="none" />
              <Circle cx={14} cy={14} r={3.5} stroke={accent} strokeWidth={1.2} fill="none" />
              <Path d="M5 14 Q14 7 23 14" stroke={accent} strokeWidth={1.2} fill="none" />
              <Circle cx={14} cy={14} r={1.4} fill={accent} />
            </Svg>
            <Text style={[styles.brandText, { color: primary }]}>{organizationName}</Text>
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
                  ? `${storm.bbox.min_lat.toFixed(2)},${storm.bbox.min_lng.toFixed(2)} -> ${storm.bbox.max_lat.toFixed(2)},${storm.bbox.max_lng.toFixed(2)}`
                  : ""}
              </Text>
            </View>
          </View>
        )}

        {/* Hero card — leads with size at this address when available */}
        <View style={[styles.heroCard, { backgroundColor: c.bg, borderColor: c.border }]}>
          <Svg style={styles.heroDial} viewBox="0 0 80 80">
            <Circle cx={40} cy={40} r={36} stroke={c.solid} strokeWidth={1.4} fill="none" opacity={0.5} />
            <Circle cx={40} cy={40} r={26} stroke={c.solid} strokeWidth={1.2} fill="none" opacity={0.7} />
            <Circle cx={40} cy={40} r={16} fill={c.solid} fillOpacity={0.9} />
          </Svg>
          <View>
            <Text style={[styles.eyebrow, { color: c.text }]}>
              {atPoint != null ? "Hail diameter at this address" : "Max hail diameter"}
            </Text>
            <Text style={[styles.heroNumber, { color: c.text }]}>
              {headlineSize.toFixed(2)}"
            </Text>
            <Text style={[styles.heroObject, { color: c.text }]}>{c.object}</Text>
            <Text style={[styles.heroBin, { color: c.text }]}>{sourceLabel(storm.source)} · {c.label}</Text>
            {showPeak && (
              <Text style={[styles.heroPeak, { color: c.text }]}>
                Storm peak nearby: {storm.max_hail_size_in.toFixed(2)}"
              </Text>
            )}
          </View>
        </View>

        {/* Verification panel — the multi-source evidence that distinguishes
            this from a single-source competitor report. */}
        {v && (
          <View style={[styles.verifyCard, { borderColor: tierColor(v.tier) }]}>
            <View style={[styles.verifyBadge, { backgroundColor: `${tierColor(v.tier)}1A` }]}>
              <View style={[styles.verifyBadgeDot, { backgroundColor: tierColor(v.tier) }]} />
              <Text style={[styles.verifyBadgeText, { color: tierColor(v.tier) }]}>
                {v.tier_label}
              </Text>
            </View>
            <Text style={styles.verifyBody}>{v.defensibility}</Text>
            {v.signals.map((s) => (
              <View key={s.key} style={styles.signalRow}>
                <Text style={[styles.signalMark, { color: s.present ? tierColor("ground_truth_confirmed") : COLORS.textMuted }]}>
                  {s.present ? "•" : "—"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.signalLabel}>{s.label}</Text>
                  <Text style={styles.signalDetail}>{s.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

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
            <Text style={styles.metaLabel}>Radar source</Text>
            <Text style={styles.metaValue}>{sourceLabel(storm.source)}</Text>
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
                {storm.bbox.min_lat.toFixed(2)}, {storm.bbox.min_lng.toFixed(2)}{" -> "}
                {storm.bbox.max_lat.toFixed(2)}, {storm.bbox.max_lng.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rule} />

        <Text style={styles.sectionTitle}>What this means</Text>
        <Text style={styles.sectionBody}>
          {sourceLabel(storm.source)} data identified hail with a diameter of{" "}
          {headlineSize.toFixed(2)}" ({c.object.toLowerCase()})
          {atPoint != null ? " at this address" : " across the affected area"} on{" "}
          {fmtDateTime(storm.start_time)}. Hail of this magnitude commonly causes
          shingle bruising, granule loss, and potential decking damage — sufficient
          grounds for an insurance claim and a professional roof inspection.
        </Text>

        <Text style={styles.sectionTitle}>Recommended next steps</Text>
        <Text style={styles.sectionBody}>
          1. Request a roof inspection from a licensed contractor.{"\n"}
          2. Document interior and exterior damage with timestamped photos.{"\n"}
          3. Notify your insurance carrier of a potential hail-damage claim.{"\n"}
          4. Retain this report (incl. the evidence on page 2) as supporting documentation.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Report ID: {reportId} · Prepared by {preparedBy}</Text>
          <Text style={styles.footerText}>{organizationName} · hailscout.net · Page 1 of 2</Text>
        </View>
      </Page>

      {/* ───────────────────── PAGE 2 — methodology & evidence ───────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Svg width={18} height={18} viewBox="0 0 28 28">
              <Circle cx={14} cy={14} r={11} stroke={primary} strokeWidth={1.4} fill="none" />
              <Circle cx={14} cy={14} r={3.5} stroke={accent} strokeWidth={1.2} fill="none" />
            </Svg>
            <Text style={[styles.brandText, { color: primary }]}>{organizationName}</Text>
          </View>
          <Text style={styles.topMeta}>Methodology & evidence · {address ?? storm.id}</Text>
        </View>
        <View style={styles.rule} />

        <Text style={styles.eyebrow}>For the adjuster</Text>
        <Text style={[styles.display, { fontSize: 22 }]}>Methodology & evidence</Text>
        <Text style={styles.sectionBody}>
          HailScout grades every detection by how much independent evidence supports
          it. This event is classified <Text style={{ fontFamily: "Helvetica-Bold" }}>{v?.tier_label ?? "Radar-indicated"}</Text>
          {" "}— the strongest class of evidence available for this location and time.
        </Text>

        {/* Evidence on record — the hard citations */}
        <Text style={styles.sectionTitle}>Evidence on record</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Classification</Text>
            <Text style={styles.metaValue}>{v?.tier_label ?? "Radar-indicated"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Hail size at location</Text>
            <Text style={styles.metaValue}>{headlineSize.toFixed(2)}" ({c.object})</Text>
          </View>
          {storm.lsr_confirmed && storm.lsr_observed_size_in != null && (
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>NWS ground report</Text>
              <Text style={styles.metaValue}>
                {storm.lsr_observed_size_in.toFixed(2)}" observed
                {storm.lsr_observed_at ? ` ${fmtDateTime(storm.lsr_observed_at)}` : ""}
              </Text>
            </View>
          )}
          {storm.peak_dbz != null && (
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Peak reflectivity</Text>
              <Text style={[styles.metaValue, styles.mono]}>{Math.round(storm.peak_dbz)} dBZ</Text>
            </View>
          )}
          {storm.hail_confirmed && (
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Dual-pol signature</Text>
              <Text style={styles.metaValue}>Present (ZDR/RhoHV)</Text>
            </View>
          )}
          {storm.confidence != null && (
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Screening confidence</Text>
              <Text style={styles.metaValue}>{Math.round(storm.confidence * 100)}%</Text>
            </View>
          )}
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Event window</Text>
            <Text style={styles.metaValue}>{fmtDateTime(storm.start_time)}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        {/* Data sources */}
        <Text style={styles.sectionTitle}>Data sources</Text>
        <View style={styles.srcItem}>
          <Text style={styles.srcName}>NOAA MRMS (Multi-Radar Multi-Sensor)</Text>
          <Text style={styles.srcDesc}>National radar mosaic; the MESH product estimates maximum expected hail size from reflectivity through the storm column.</Text>
        </View>
        <View style={styles.srcItem}>
          <Text style={styles.srcName}>NEXRAD Level II (dual-polarization)</Text>
          <Text style={styles.srcDesc}>Single-site WSR-88D radar; ZDR/RhoHV signatures distinguish hail from heavy rain — direct physical evidence of hail aloft.</Text>
        </View>
        <View style={styles.srcItem}>
          <Text style={styles.srcName}>NWS Local Storm Reports (SPC)</Text>
          <Text style={styles.srcDesc}>Ground-truth observations from trained spotters and the public, logged by the National Weather Service — independent corroboration of radar.</Text>
        </View>

        <View style={styles.rule} />

        {/* Tier glossary */}
        <Text style={styles.sectionTitle}>How verification tiers work</Text>
        {TIER_GLOSSARY.map((t) => (
          <View key={t.tier} style={styles.tierRow}>
            <View style={[styles.tierDot, { backgroundColor: tierColor(t.tier) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tierName}>{t.name}</Text>
              <Text style={styles.tierDesc}>{t.desc}</Text>
            </View>
          </View>
        ))}

        {/* Optional field documentation */}
        {photos && photos.length > 0 && (
          <>
            <View style={styles.rule} />
            <Text style={styles.sectionTitle}>Field documentation</Text>
            <View style={styles.photoRow}>
              {photos.slice(0, 4).map((src, i) => (
                <Image key={i} src={src} style={styles.photo} />
              ))}
            </View>
          </>
        )}

        <View style={styles.disclaimer}>
          <Text>
            Limitations & proper use: Radar-derived hail-size estimates carry
            approximately ±0.25" uncertainty and describe hail aloft, not confirmed
            ground impact at a specific structure. This report establishes that a
            hail event of the stated magnitude occurred at this location and time,
            corroborated by the evidence above; it does not substitute for an
            on-site inspection by a licensed professional. Source data is public
            NOAA/NWS observation. {organizationName} makes no warranty of fitness
            for any particular purpose.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated {generatedAt} · Report ID: {reportId}
          </Text>
          <Text style={styles.footerText}>{organizationName} · hailscout.net · Page 2 of 2</Text>
        </View>
      </Page>
    </Document>
  );
}
