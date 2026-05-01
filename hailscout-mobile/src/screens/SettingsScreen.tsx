import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  useColorScheme,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/Card";
import { Wordmark } from "@/components/Wordmark";

const VERSION = "0.2.0";

export function SettingsScreen() {
  const t = theme(useColorScheme());
  const { signOut } = useAuth();
  const { user } = useUser();

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <AppHeader eyebrow="Settings" title="Account" />

      <View style={{ padding: SPACING.lg, gap: SPACING.lg }}>
        <Card>
          <Text style={[styles.eyebrow, { color: t.fgMuted }]}>SIGNED IN</Text>
          <Text style={[styles.value, { color: t.fg }]} numberOfLines={1}>
            {user?.emailAddresses[0]?.emailAddress ?? "—"}
          </Text>
          {user?.firstName && (
            <Text style={[styles.sub, { color: t.fgMuted }]}>
              {user.firstName} {user.lastName}
            </Text>
          )}
        </Card>

        <Card>
          <Pressable
            onPress={() => Linking.openURL("https://hail-scout.vercel.app/app")}
          >
            <Text style={[styles.linkLabel, { color: t.accent }]}>OPEN ON DESKTOP</Text>
            <Text style={[styles.linkValue, { color: t.fg }]}>
              hail-scout.vercel.app/app  →
            </Text>
            <Text style={[styles.sub, { color: t.fgMuted }]}>
              Markers and addresses sync between mobile and web.
            </Text>
          </Pressable>
        </Card>

        <Pressable
          onPress={() => signOut()}
          style={({ pressed }) => [
            styles.signOut,
            {
              borderColor: t.border,
              backgroundColor: pressed ? t.bgMuted : t.bgLift,
            },
          ]}
        >
          <Text style={[styles.signOutText, { color: t.destructive }]}>Sign out</Text>
        </Pressable>

        <View style={styles.footer}>
          <Wordmark size={20} />
          <Text style={[styles.version, { color: t.fgMuted }]}>v{VERSION}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  eyebrow:    { fontSize: 10, fontFamily: "Courier", letterSpacing: 1.2 },
  value:      { fontFamily: "serif", fontSize: 18, fontWeight: "500", marginTop: 4 },
  sub:        { fontSize: 12, marginTop: 4 },
  linkLabel:  { fontSize: 10, fontFamily: "Courier", letterSpacing: 1.2 },
  linkValue:  { fontSize: 16, fontWeight: "500", marginTop: 6, letterSpacing: -0.2 },
  signOut:    {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
  },
  signOutText: { fontSize: 15, fontWeight: "500" },
  footer:      { alignItems: "center", marginTop: SPACING.xl, gap: 6 },
  version:     { fontSize: 11, fontFamily: "Courier" },
});
