import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
  useColorScheme,
} from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/Card";
import { Wordmark } from "@/components/Wordmark";
import { deleteAccount } from "@/auth/session";

const VERSION = "0.2.0";

export function SettingsScreen() {
  const t = theme(useColorScheme());
  const { signOut, user, organization, getToken } = useAuth();

  const onDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your HailScout account and the data tied to it. You'll be signed out immediately. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) throw new Error("Please sign in again.");
              await deleteAccount(token);
            } catch (e) {
              Alert.alert(
                "Couldn't delete account",
                e instanceof Error ? e.message : "Please try again.",
              );
              return;
            }
            await signOut();
            Alert.alert(
              "Account deleted",
              "Your account has been deleted and you've been signed out.",
            );
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <AppHeader eyebrow="Settings" title="Account" />

      <View style={{ padding: SPACING.lg, gap: SPACING.lg }}>
        <Card>
          <Text style={[styles.eyebrow, { color: t.fgMuted }]}>SIGNED IN</Text>
          <Text style={[styles.value, { color: t.fg }]} numberOfLines={1}>
            {user?.email ?? "—"}
          </Text>
          {(organization?.name || user?.role) && (
            <Text style={[styles.sub, { color: t.fgMuted }]}>
              {[organization?.name, user?.role?.replace("_", " ")].filter(Boolean).join(" · ")}
            </Text>
          )}
        </Card>

        <Card>
          <Pressable onPress={() => Linking.openURL("https://hailscout.net/app")}>
            <Text style={[styles.linkLabel, { color: t.accent }]}>OPEN ON DESKTOP</Text>
            <Text style={[styles.linkValue, { color: t.fg }]}>hailscout.net/app  →</Text>
            <Text style={[styles.sub, { color: t.fgMuted }]}>
              Markers and addresses sync between mobile and web.
            </Text>
          </Pressable>
        </Card>

        {/* Account deletion — required by Apple (5.1.1v) + Google Play for
            any app with sign-in. Deletes in-app: deactivates + revokes the
            account server-side, then signs out. */}
        <Card>
          <Pressable onPress={onDeleteAccount}>
            <Text style={[styles.linkLabel, { color: t.destructive }]}>
              DELETE ACCOUNT
            </Text>
            <Text style={[styles.linkValue, { color: t.fg }]}>
              Delete account + data  →
            </Text>
            <Text style={[styles.sub, { color: t.fgMuted }]}>
              Permanently removes your account and the data tied to it.
            </Text>
          </Pressable>
        </Card>

        <Pressable
          onPress={() => {
            void signOut();
          }}
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
  eyebrow: { fontSize: 10, fontFamily: "Courier", letterSpacing: 1.2 },
  value: { fontFamily: "serif", fontSize: 18, fontWeight: "500", marginTop: 4 },
  sub: { fontSize: 12, marginTop: 4 },
  linkLabel: { fontSize: 10, fontFamily: "Courier", letterSpacing: 1.2 },
  linkValue: { fontSize: 16, fontWeight: "500", marginTop: 6, letterSpacing: -0.2 },
  signOut: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
  },
  signOutText: { fontSize: 15, fontWeight: "500" },
  footer: { alignItems: "center", marginTop: SPACING.xl, gap: 6 },
  version: { fontSize: 11, fontFamily: "Courier" },
});
