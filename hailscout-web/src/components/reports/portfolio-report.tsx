"use client";

/**
 * Portfolio Hail Impact Report — single PDF covering every monitored
 * address with hail history. Branded, multi-page.
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
} from "@react-pdf/renderer";
import { hailColor } from "@/lib/hail";

interface Storm {
  id: string;
  start_time: string;
  end_time: string;
  max_hail_size_in: number;
  centroid_lat: number;
  centroid_lng: number;
  source: string;
}

interface AddressBlock {
  address: string;
  lat: number;
  lng: number;
  label?: string;
  storms: Storm[];
}

interface ReportProps {
  blocks: AddressBlock[];
  organizationName?: string;
  brandPrimary?: string;
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
  brandText: { fontSize: 14, fontFamily: "Helvetica-Bold", letterSpacing: -0.4 },
  topMeta: { fontSize: 8, color: COLORS.textMuted, fontFamily: "Helvetica-Oblique" },
  rule: { height: 0.6, backgroundColor: COLORS.border, marginVertical: 14 },

  /* Cover */
  coverEyebrow: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 },
  coverTitle: { fontSize: 32, fontFamily: "Helvetica-Bold", letterSpacing: -0.7, marginBottom: 4, lineHeight: 1.1 },
  coverSubtitle: { fontSize: 12, color: COLORS.textMuted, marginBottom: 16 },
  coverStats: { flexDirection: "row", gap: 12, marginVertical: 18 },
  coverStat: {
    flex: 1,
    borderWidth: 0.6,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 10,
    backgroundColor: COLORS.creamLift,
  },
  coverStatLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, color: COLORS.textMuted, textTransform: "uppercase" },
  coverStatValue: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: -0.5, marginTop: 4 },
  coverIntro: { fontSize: 11, lineHeight: 1.6, marginTop: 14 },

  /* Address pages */
  addrEyebrow: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.copper, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 },
  addrTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", letterSpacing: -0.5, marginBottom: 4 },
  addrCoords: { fontSize: 9, fontFamily: "Courier", color: COLORS.textMuted, marginBottom: 12 },

  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 6,
    marginVertical: 10,
    borderWidth: 0.6,
  },
  heroDial: { width: 56, height: 56, marginRight: 14 },
  heroNumber: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: -0.6 },
  heroObject: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },

  stormRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: 0.4,
    borderBottomColor: COLORS.border,
  },
  stormSize: { fontSize: 11, fontFamily: "Helvetica-Bold", width: 50, fontFamily: "Courier" },
  stormDate: { fontSize: 10, flex: 1 },
  stormSource: { fontSize: 8, color: COLORS.textMuted, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },

  emptyMsg: { fontSize: 10, fontStyle: "italic", color: COLORS.textMuted, marginVertical: 10 },

  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  footerText: { fontSize: 7.5, color: COLORS.textMuted },

  pageNum: { fontSize: 8, color: COLORS.textMuted, fontFamily: "Courier" },
});

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PortfolioReport({
  blocks,
  organizationName = "HailScout",
  brandPrimary,
  brandAccent,
}: ReportProps) {
  const primary = brandPrimary || COLORS.teal;
  const accent  = brandAccent  || COLORS.copper;

  const totalStorms = blocks.reduce((sum, b) => sum + b.storms.length, 0);
  const peak = blocks.flatMap((b) => b.storms.map((s) => s.max_hail_size_in)).reduce((m, v) => Math.max(m, v), 0);
  const hitCount = blocks.filter((b) => b.storms.length > 0).length;
  const reportDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const reportId = `HSP-${Date.now().toString(36).slice(-6).toUpperCase()}`;

  return (
    <Document title={`Portfolio Hail Impact Report — ${blocks.length} address${blocks.length === 1 ? "" : "es"}`}>
      {/* Cover */}
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
          <Text style={styles.topMeta}>Portfolio Report · {reportDate}</Text>
        </View>

        <View style={styles.rule} />

        <Text style={[styles.coverEyebrow, { color: accent }]}>Customer portfolio</Text>
        <Text style={[styles.coverTitle, { color: COLORS.charcoal }]}>Hail Impact Report</Text>
        <Text style={styles.coverSubtitle}>
          {blocks.length} monitored address{blocks.length === 1 ? "" : "es"} · prepared by {organizationName}
        </Text>

        <View style={styles.coverStats}>
          <View style={styles.coverStat}>
            <Text style={styles.coverStatLabel}>Addresses</Text>
            <Text style={[styles.coverStatValue, { color: COLORS.charcoal }]}>{blocks.length}</Text>
          </View>
          <View style={styles.coverStat}>
            <Text style={styles.coverStatLabel}>Hit by hail</Text>
            <Text style={[styles.coverStatValue, { color: accent }]}>{hitCount}</Text>
          </View>
          <View style={styles.coverStat}>
            <Text style={styles.coverStatLabel}>Total storms</Text>
            <Text style={[styles.coverStatValue, { color: primary }]}>{totalStorms}</Text>
          </View>
          <View style={styles.coverStat}>
            <Text style={styles.coverStatLabel}>Peak hail</Text>
            <Text style={[styles.coverStatValue, { color: primary }]}>{peak ? `${peak.toFixed(2)}″` : "—"}</Text>
          </View>
        </View>

        <Text style={styles.coverIntro}>
          This report consolidates every NOAA MRMS-detected hail event across {blocks.length} customer
          address{blocks.length === 1 ? "" : "es"} in the past 30 days. Each address has its own page with
          the full event timeline, peak hail size, and a tactical recommendation.
          Hand to your sales team or attach to insurance correspondence — every storm
          is citable from the public NOAA feed.
        </Text>

        <View style={styles.rule} />

        <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 6 }}>
          Address index
        </Text>
        {blocks.map((b, i) => (
          <View key={b.address} style={styles.stormRow}>
            <Text style={styles.stormSize}>#{(i + 1).toString().padStart(2, "0")}</Text>
            <Text style={styles.stormDate}>{b.label || b.address}</Text>
            <Text style={[styles.stormSource, { color: b.storms.length > 0 ? accent : COLORS.textMuted }]}>
              {b.storms.length > 0 ? `${b.storms.length} storm${b.storms.length === 1 ? "" : "s"}` : "no record"}
            </Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Report ID: {reportId} · Prepared {reportDate}</Text>
          <Text style={styles.pageNum}>1 / {1 + blocks.length}</Text>
        </View>
      </Page>

      {/* Per-address pages */}
      {blocks.map((block, idx) => {
        const peakHere = block.storms.reduce((m, s) => Math.max(m, s.max_hail_size_in), 0);
        const c = peakHere > 0 ? hailColor(peakHere) : null;
        const sortedStorms = [...block.storms].sort(
          (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
        );
        return (
          <Page key={block.address} size="LETTER" style={styles.page}>
            <View style={styles.topRow}>
              <View style={styles.brand}>
                <Svg width={20} height={20} viewBox="0 0 28 28">
                  <Circle cx={14} cy={14} r={11} stroke={primary} strokeWidth={1.4} fill="none" />
                  <Circle cx={14} cy={14} r={4} stroke={accent} strokeWidth={1.2} fill="none" />
                  <Circle cx={14} cy={14} r={1.4} fill={accent} />
                </Svg>
                <Text style={[styles.brandText, { color: primary, fontSize: 12 }]}>{organizationName}</Text>
              </View>
              <Text style={styles.topMeta}>Address {idx + 1} of {blocks.length}</Text>
            </View>

            <View style={styles.rule} />

            <Text style={[styles.addrEyebrow, { color: accent }]}>Property record</Text>
            <Text style={styles.addrTitle}>{block.label || block.address}</Text>
            {block.label && (
              <Text style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{block.address}</Text>
            )}
            <Text style={styles.addrCoords}>
              {block.lat.toFixed(4)}°N, {Math.abs(block.lng).toFixed(4)}°W
            </Text>

            {c && peakHere > 0 ? (
              <>
                <View style={[styles.heroCard, { backgroundColor: c.bg, borderColor: c.border }]}>
                  <Svg style={styles.heroDial} viewBox="0 0 80 80">
                    <Circle cx={40} cy={40} r={36} stroke={c.solid} strokeWidth={1.4} fill="none" opacity={0.5} />
                    <Circle cx={40} cy={40} r={26} stroke={c.solid} strokeWidth={1.2} fill="none" opacity={0.7} />
                    <Circle cx={40} cy={40} r={16} fill={c.solid} fillOpacity={0.9} />
                  </Svg>
                  <View>
                    <Text style={[styles.coverEyebrow, { color: c.text, marginBottom: 2 }]}>Peak hail</Text>
                    <Text style={[styles.heroNumber, { color: c.text }]}>{peakHere.toFixed(2)}″</Text>
                    <Text style={[styles.heroObject, { color: c.text }]}>{c.object}</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 6 }}>
                  Storm timeline ({block.storms.length} event{block.storms.length === 1 ? "" : "s"})
                </Text>
                {sortedStorms.map((s) => {
                  const sc = hailColor(s.max_hail_size_in);
                  return (
                    <View key={s.id} style={styles.stormRow}>
                      <Text style={[styles.stormSize, { color: sc.text }]}>
                        {s.max_hail_size_in.toFixed(2)}″
                      </Text>
                      <Text style={styles.stormDate}>{fmtDate(s.start_time)}</Text>
                      <Text style={[styles.stormSource, { color: COLORS.textMuted }]}>
                        {s.source.toUpperCase()}
                      </Text>
                    </View>
                  );
                })}

                <View style={[styles.heroCard, { backgroundColor: COLORS.creamLift, borderColor: COLORS.border, marginTop: 14 }]}>
                  <View>
                    <Text style={[styles.coverEyebrow, { color: accent, marginBottom: 4 }]}>Recommended action</Text>
                    <Text style={{ fontSize: 11, lineHeight: 1.5 }}>
                      {peakHere >= 1.75
                        ? "Severe hail. Inspect immediately. Insurance claim viability is high — file documentation including this report."
                        : peakHere >= 1.0
                        ? "Moderate hail. Inspection recommended within 30 days. Likely roof bruising and granule loss on aging shingles."
                        : "Minor hail. Document and monitor. Usually within roof service-life tolerance."}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.emptyMsg}>
                No MRMS-detected hail events at this address in the past 30 days.
              </Text>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>{organizationName} · Data: NOAA MRMS</Text>
              <Text style={styles.pageNum}>{idx + 2} / {1 + blocks.length}</Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
