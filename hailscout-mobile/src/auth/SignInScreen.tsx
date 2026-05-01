import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { Wordmark } from "@/components/Wordmark";

export function SignInScreen() {
  const t = theme(useColorScheme());
  const { signIn, setActive, isLoaded } = useSignIn();
  const nav = useNavigation<any>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!isLoaded) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email, password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
      } else {
        setError("Additional verification required.");
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.center}>
        <Wordmark size={28} />
        <Text style={[styles.eyebrow, { color: t.accent }]}>SIGN IN</Text>
        <Text style={[styles.title, { color: t.fg }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: t.fgMuted }]}>
          Storm intelligence for crews who beat the clock.
        </Text>

        <View style={{ width: "100%", marginTop: SPACING.xl, gap: SPACING.md }}>
          <TextInput
            placeholder="Email"
            placeholderTextColor={t.fgMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { color: t.fg, backgroundColor: t.bgLift, borderColor: t.border }]}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={t.fgMuted}
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { color: t.fg, backgroundColor: t.bgLift, borderColor: t.border }]}
          />
          {error && <Text style={[styles.error, { color: t.destructive }]}>{error}</Text>}
          <Pressable
            disabled={busy}
            onPress={submit}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: t.primary, opacity: busy || pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { color: t.primaryFg }]}>
              {busy ? "Signing in…" : "Sign in"}
            </Text>
          </Pressable>
          <Pressable onPress={() => nav.navigate("SignUp")}>
            <Text style={[styles.altLink, { color: t.fgMuted }]}>
              No account yet?{" "}
              <Text style={{ color: t.accent, fontWeight: "500" }}>Create one →</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm },
  eyebrow: { fontSize: 10, fontFamily: "Courier", letterSpacing: 1.4, marginTop: 24 },
  title: { fontFamily: "serif", fontSize: 32, fontWeight: "500", letterSpacing: -0.5, textAlign: "center" },
  sub: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  input: {
    borderWidth: 1, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: 15,
  },
  cta: {
    borderRadius: RADIUS.md, padding: SPACING.md,
    alignItems: "center", marginTop: SPACING.sm,
  },
  ctaText: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  altLink: { textAlign: "center", fontSize: 13, marginTop: SPACING.md },
  error: { fontSize: 13, textAlign: "center" },
});
