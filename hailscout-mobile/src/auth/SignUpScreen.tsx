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
import { useSignUp } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { Wordmark } from "@/components/Wordmark";

export function SignUpScreen() {
  const t = theme(useColorScheme());
  const { signUp, setActive, isLoaded } = useSignUp();
  const nav = useNavigation<any>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!isLoaded) return;
    setBusy(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("verify");
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!isLoaded) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
      } else {
        setError("Verification incomplete.");
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Verification failed.");
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
        <Text style={[styles.eyebrow, { color: t.accent }]}>
          {stage === "form" ? "JOIN HAILSCOUT" : "VERIFY EMAIL"}
        </Text>
        <Text style={[styles.title, { color: t.fg }]}>
          {stage === "form" ? "Get the atlas" : "Check your inbox"}
        </Text>
        <Text style={[styles.sub, { color: t.fgMuted }]}>
          {stage === "form"
            ? "Create an account. 14-day trial, no card required."
            : `We sent a code to ${email}.`}
        </Text>

        <View style={{ width: "100%", marginTop: SPACING.xl, gap: SPACING.md }}>
          {stage === "form" ? (
            <>
              <TextInput
                placeholder="Work email"
                placeholderTextColor={t.fgMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={[styles.input, { color: t.fg, backgroundColor: t.bgLift, borderColor: t.border }]}
              />
              <TextInput
                placeholder="Password"
                placeholderTextColor={t.fgMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={[styles.input, { color: t.fg, backgroundColor: t.bgLift, borderColor: t.border }]}
              />
              {error && <Text style={[styles.error, { color: t.destructive }]}>{error}</Text>}
              <Pressable
                disabled={busy}
                onPress={start}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: t.primary, opacity: busy || pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.ctaText, { color: t.primaryFg }]}>
                  {busy ? "Creating…" : "Create account"}
                </Text>
              </Pressable>
              <Pressable onPress={() => nav.navigate("SignIn")}>
                <Text style={[styles.altLink, { color: t.fgMuted }]}>
                  Already a user?{" "}
                  <Text style={{ color: t.accent, fontWeight: "500" }}>Sign in →</Text>
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                placeholder="6-digit code"
                placeholderTextColor={t.fgMuted}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                style={[styles.input, { color: t.fg, backgroundColor: t.bgLift, borderColor: t.border, fontFamily: "Courier", fontSize: 20, letterSpacing: 4, textAlign: "center" }]}
              />
              {error && <Text style={[styles.error, { color: t.destructive }]}>{error}</Text>}
              <Pressable
                disabled={busy}
                onPress={verify}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: t.primary, opacity: busy || pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.ctaText, { color: t.primaryFg }]}>
                  {busy ? "Verifying…" : "Verify"}
                </Text>
              </Pressable>
            </>
          )}
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
  input: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15 },
  cta: { borderRadius: RADIUS.md, padding: SPACING.md, alignItems: "center", marginTop: SPACING.sm },
  ctaText: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  altLink: { textAlign: "center", fontSize: 13, marginTop: SPACING.md },
  error: { fontSize: 13, textAlign: "center" },
});
