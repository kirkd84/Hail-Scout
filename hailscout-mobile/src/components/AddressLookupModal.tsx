import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { HailBadge } from "@/components/HailBadge";
import { apiRequest } from "@/lib/api";

interface AddressInfo {
  query: string;
  formatted: string;
  lat: number;
  lng: number;
}
interface HailImpactRecord {
  storm_id: string;
  date: string;
  max_hail_size_in: number;
  category: string;
  distance_miles: number;
  impact_probability: number;
}
interface HailAtAddress {
  address: AddressInfo;
  hail_history: HailImpactRecord[];
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Address lookup — geocode + historical hail at a point, with one-tap
 * "monitor this address". Backed by the public GET /v1/hail-at-address and
 * (authed) POST /v1/monitored-addresses.
 */
export function AddressLookupModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = theme(useColorScheme());
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<HailAtAddress | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "saving">("idle");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const reset = () => {
    setQuery("");
    setResult(null);
    setStatus("idle");
    setErr("");
    setSaved(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const search = async () => {
    const q = query.trim();
    if (!q || status === "searching") return;
    setStatus("searching");
    setErr("");
    setResult(null);
    setSaved(false);
    try {
      const token = await getToken();
      const res = await apiRequest<HailAtAddress>(
        `/v1/hail-at-address?address=${encodeURIComponent(q)}`,
        { token },
      );
      setResult(res);
    } catch {
      setErr("Couldn’t find that address. Try “City, ST” or a full street address.");
    } finally {
      setStatus("idle");
    }
  };

  const save = async () => {
    if (!result || status === "saving") return;
    setStatus("saving");
    setErr("");
    try {
      const token = await getToken();
      await apiRequest("/v1/monitored-addresses", {
        token,
        method: "POST",
        body: JSON.stringify({
          address: result.address.formatted,
          lat: result.address.lat,
          lng: result.address.lng,
        }),
      });
      setSaved(true);
      onSaved();
    } catch {
      setErr("Couldn’t save — you may already be monitoring this address.");
    } finally {
      setStatus("idle");
    }
  };

  const peak =
    result?.hail_history?.reduce((m, r) => Math.max(m, r.max_hail_size_in), 0) ?? 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { backgroundColor: t.bg, borderColor: t.border }]}>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: t.border }]} />
            </View>

            <Text style={[styles.eyebrow, { color: t.accent }]}>Address lookup</Text>
            <Text style={[styles.h1, { color: t.fg }]}>What hit this address?</Text>

            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="123 Main St, Plano, TX"
                placeholderTextColor={t.fgMuted}
                style={[
                  styles.input,
                  { color: t.fg, borderColor: t.border, backgroundColor: t.bgLift },
                ]}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={search}
              />
              <Pressable
                onPress={search}
                disabled={!query.trim() || status === "searching"}
                style={[
                  styles.searchBtn,
                  {
                    backgroundColor: t.accent,
                    opacity: !query.trim() || status === "searching" ? 0.5 : 1,
                  },
                ]}
              >
                {status === "searching" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.searchBtnText}>Search</Text>
                )}
              </Pressable>
            </View>

            {err ? <Text style={styles.err}>{err}</Text> : null}

            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              {result && (
                <View>
                  <Text style={[styles.formatted, { color: t.fg }]}>
                    {result.address.formatted}
                  </Text>
                  {result.hail_history.length === 0 ? (
                    <Text style={[styles.empty, { color: t.fgMuted }]}>
                      No recorded hail at this location since 2011.
                    </Text>
                  ) : (
                    <View>
                      <View style={styles.peakRow}>
                        <Text style={[styles.peakLabel, { color: t.fgMuted }]}>
                          {result.hail_history.length} event
                          {result.hail_history.length === 1 ? "" : "s"} · peak
                        </Text>
                        <HailBadge sizeIn={peak} compact />
                      </View>
                      {result.hail_history.slice(0, 12).map((r) => (
                        <View key={r.storm_id} style={[styles.histRow, { borderColor: t.border }]}>
                          <View style={styles.histBody}>
                            <Text style={[styles.histDate, { color: t.fg }]}>
                              {fmtDate(r.date)}
                            </Text>
                            <Text style={[styles.histMeta, { color: t.fgMuted }]}>
                              {r.distance_miles.toFixed(1)} mi away
                            </Text>
                          </View>
                          <HailBadge sizeIn={r.max_hail_size_in} compact />
                        </View>
                      ))}
                    </View>
                  )}

                  {saved ? (
                    <View style={[styles.savedPill, { borderColor: t.accent }]}>
                      <Text style={[styles.savedText, { color: t.accent }]}>
                        ✓ Added to your watchlist
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={save}
                      disabled={status === "saving"}
                      style={[
                        styles.saveBtn,
                        { borderColor: t.accent, opacity: status === "saving" ? 0.5 : 1 },
                      ]}
                    >
                      <Text style={[styles.saveText, { color: t.accent }]}>
                        {status === "saving" ? "Saving…" : "+ Monitor this address"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>

            <Pressable onPress={close} style={styles.doneBtn}>
              <Text style={[styles.doneText, { color: t.fgMuted }]}>Done</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheetWrap: { width: "100%" },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  handleWrap: { alignItems: "center", paddingVertical: SPACING.sm },
  handle: { width: 40, height: 4, borderRadius: 2 },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Courier",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: SPACING.xs,
  },
  h1: { fontFamily: "serif", fontSize: 22, fontWeight: "500", marginTop: 2, marginBottom: SPACING.md },
  searchRow: { flexDirection: "row", gap: SPACING.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 15,
  },
  searchBtn: {
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 84,
  },
  searchBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  err: { color: "#b91c1c", fontSize: 13, marginTop: SPACING.sm },
  formatted: { fontSize: 15, fontWeight: "500", marginTop: SPACING.lg, marginBottom: SPACING.sm },
  empty: { fontSize: 14, lineHeight: 20, marginBottom: SPACING.md },
  peakRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  peakLabel: { fontSize: 12, fontFamily: "Courier", letterSpacing: 0.3 },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  histBody: { flex: 1, minWidth: 0 },
  histDate: { fontSize: 14, fontWeight: "500" },
  histMeta: { fontSize: 11, marginTop: 2, fontFamily: "Courier" },
  savedPill: {
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  savedText: { fontSize: 14, fontWeight: "600" },
  saveBtn: {
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  saveText: { fontSize: 14, fontWeight: "600" },
  doneBtn: { alignItems: "center", paddingTop: SPACING.lg },
  doneText: { fontSize: 14 },
});
