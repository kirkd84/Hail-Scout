import React from "react";
import { View, Text, Pressable, StyleSheet, useColorScheme } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { Wordmark } from "@/components/Wordmark";

/**
 * HailScout accounts are provisioned by an administrator (no self-serve
 * sign-up yet — matches the web). This screen explains that and routes back
 * to the provider sign-in.
 */
export function SignUpScreen() {
  const t = theme(useColorScheme());
  const nav = useNavigation<any>();

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={styles.center}>
        <Wordmark size={28} />
        <Text style={[styles.title, { color: t.fg }]}>Get set up</Text>
        <Text style={[styles.sub, { color: t.fgMuted }]}>
          HailScout accounts are created by your company administrator. Once
          they&apos;ve added your work email, sign in with the matching Apple,
          Google, or Microsoft account.
        </Text>
        <Pressable
          onPress={() => nav.navigate("SignIn")}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: t.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.ctaText, { color: t.primaryFg }]}>Back to sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.md },
  title: { fontFamily: "serif", fontSize: 30, fontWeight: "500", letterSpacing: -0.5, textAlign: "center", marginTop: 16 },
  sub: { fontSize: 14, textAlign: "center", lineHeight: 21, maxWidth: 300 },
  cta: { borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, alignItems: "center", marginTop: SPACING.md },
  ctaText: { fontSize: 15, fontWeight: "600" },
});
