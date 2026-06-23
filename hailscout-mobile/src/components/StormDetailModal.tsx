import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import type { MobileStorm } from "@/lib/storm-fixtures";

interface Props {
  storm: MobileStorm | null;
  visible: boolean;
  onClose: () => void;
}

function objectLabel(inches: number): string {
  if (inches >= 3.0) return "Softball";
  if (inches >= 2.75) return "Baseball";
  if (inches >= 2.5) return "Tennis ball";
  if (inches >= 2.0) return "Hen egg";
  if (inches >= 1.75) return "Golf ball";
  if (inches >= 1.5) return "Walnut";
  if (inches >= 1.25) return "Half dollar";
  if (inches >= 1.0) return "Quarter";
  return "Penny";
}
function colorHex(inches: number): string {
  if (inches >= 3.0) return "#1F1B33";
  if (inches >= 2.5) return "#5B2059";
  if (inches >= 2.0) return "#822424";
  if (inches >= 1.75) return "#A8412D";
  if (inches >= 1.5) return "#C46434";
  if (inches >= 1.25) return "#D88A3D";
  if (inches >= 1.0) return "#E2B843";
  return "#5DCAA5";
}

/**
 * Bottom-sheet storm detail. Opened by tapping a storm row (Home) or a
 * map centroid. Shows the at-a-glance facts a rep needs: size + object,
 * where, when, and whether it's ground-confirmed (the verification moat).
 */
export function StormDetailModal({ storm, visible, onClose }: Props) {
  const t = theme(useColorScheme());
  if (!storm) return null;
  const size = storm.peak_size_in;
  const badgeFg = size >= 1.5 ? "#FAF7F1" : "#2B2620";
  const confirmed = storm.lsr_confirmed === true;
  const dateStr = new Date(storm.start_time).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner press stop so taps on the sheet don't dismiss it. */}
        <Pressable
          style={[styles.sheet, { backgroundColor: t.bg, borderColor: t.border }]}
          onPress={() => {}}
        >
          <View style={[styles.grabber, { backgroundColor: t.border }]} />

          <View style={styles.headRow}>
            <View style={[styles.badge, { backgroundColor: colorHex(size) }]}>
              <Text style={[styles.badgeSize, { color: badgeFg }]}>
                {size.toFixed(2)}″
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.city, { color: t.fg }]} numberOfLines={2}>
                {storm.city}
              </Text>
              <Text style={[styles.object, { color: t.fgMuted }]}>
                {objectLabel(size)} · {dateStr}
              </Text>
            </View>
          </View>

          {/* Verification tier — the differentiator. */}
          <View
            style={[
              styles.tier,
              {
                backgroundColor: confirmed ? "rgba(47,122,79,0.12)" : t.bgLift,
                borderColor: confirmed ? "rgba(47,122,79,0.4)" : t.border,
              },
            ]}
          >
            <Text
              style={[
                styles.tierText,
                { color: confirmed ? "#2f7a4f" : t.fgMuted },
              ]}
            >
              {confirmed
                ? "✓ Ground-confirmed by a storm report"
                : "Radar-indicated (MRMS)"}
            </Text>
          </View>

          {storm.is_live && (
            <Text style={[styles.live, { color: t.accent }]}>● Active now</Text>
          )}

          <Text style={[styles.hint, { color: t.fgMuted }]}>
            Long-press anywhere on the map to check the exact hail size at a
            specific address.
          </Text>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.doneBtn,
              { backgroundColor: pressed ? t.bgMuted : t.primary },
            ]}
          >
            <Text style={[styles.doneText, { color: t.primaryFg }]}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: SPACING.sm },
  headRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  badge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeSize: { fontFamily: "Courier", fontSize: 16, fontWeight: "600" },
  city: { fontFamily: "serif", fontSize: 20, fontWeight: "500", letterSpacing: -0.3 },
  object: { fontSize: 13, marginTop: 4, fontFamily: "Courier", letterSpacing: 0.2 },
  tier: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md },
  tierText: { fontSize: 13, fontWeight: "500" },
  live: { fontSize: 12, fontFamily: "Courier", letterSpacing: 0.4 },
  hint: { fontSize: 12, lineHeight: 18 },
  doneBtn: { borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: "center", marginTop: SPACING.sm },
  doneText: { fontSize: 15, fontWeight: "600" },
});
