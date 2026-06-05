import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import {
  useAuthRequest,
  useAutoDiscovery,
  exchangeCodeAsync,
  makeRedirectUri,
  ResponseType,
} from "expo-auth-session";
import { theme, SPACING, RADIUS } from "@/lib/tokens";
import { Wordmark } from "@/components/Wordmark";
import { useAuth } from "@/auth/AuthProvider";
import { env } from "@/app/env";

WebBrowser.maybeCompleteAuthSession();

const SCOPES = ["openid", "profile", "email"];

export function SignInScreen() {
  const t = theme(useColorScheme());
  const { completeSignIn } = useAuth();
  const [busy, setBusy] = useState<null | "google" | "microsoft">(null);
  const [error, setError] = useState<string | null>(null);

  // Google — the provider helper manages the iOS/Android client IDs + id_token.
  const [, gRes, gPrompt] = Google.useAuthRequest({
    iosClientId: env.GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: env.GOOGLE_ANDROID_CLIENT_ID || undefined,
    scopes: SCOPES,
  });

  // Microsoft — generic Authorization-Code + PKCE against the v2.0 endpoints.
  const msDiscovery = useAutoDiscovery(
    `https://login.microsoftonline.com/${env.MICROSOFT_TENANT}/v2.0`,
  );
  const msRedirect = makeRedirectUri({ scheme: "hailscout", path: "auth" });
  const [mReq, mRes, mPrompt] = useAuthRequest(
    {
      clientId: env.MICROSOFT_CLIENT_ID,
      scopes: SCOPES,
      redirectUri: msRedirect,
      responseType: ResponseType.Code,
      usePKCE: true,
    },
    msDiscovery,
  );

  // Google result → id_token → exchange.
  useEffect(() => {
    if (!gRes) return;
    if (gRes.type !== "success") {
      if (gRes.type === "error") setError("Google sign-in failed.");
      setBusy(null);
      return;
    }
    const idToken =
      (gRes.params?.id_token as string | undefined) ?? gRes.authentication?.idToken;
    if (!idToken) {
      setError("Google didn't return an identity token.");
      setBusy(null);
      return;
    }
    (async () => {
      try {
        await completeSignIn("google", idToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      } finally {
        setBusy(null);
      }
    })();
  }, [gRes, completeSignIn]);

  // Microsoft result → exchange code for tokens → id_token → exchange.
  useEffect(() => {
    if (!mRes) return;
    if (mRes.type !== "success" || !msDiscovery || !mReq) {
      if (mRes.type === "error") setError("Microsoft sign-in failed.");
      setBusy(null);
      return;
    }
    (async () => {
      try {
        const tokenRes = await exchangeCodeAsync(
          {
            clientId: env.MICROSOFT_CLIENT_ID,
            code: mRes.params.code,
            redirectUri: msRedirect,
            extraParams: { code_verifier: mReq.codeVerifier ?? "" },
          },
          msDiscovery,
        );
        if (!tokenRes.idToken) throw new Error("Microsoft didn't return an identity token.");
        await completeSignIn("microsoft", tokenRes.idToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      } finally {
        setBusy(null);
      }
    })();
  }, [mRes, msDiscovery, mReq, msRedirect, completeSignIn]);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={styles.center}>
        <Wordmark size={28} />
        <Text style={[styles.eyebrow, { color: t.accent }]}>SIGN IN</Text>
        <Text style={[styles.title, { color: t.fg }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: t.fgMuted }]}>
          Storm intelligence for crews who beat the clock.
        </Text>

        <View style={{ width: "100%", marginTop: SPACING.xl, gap: SPACING.md }}>
          <ProviderButton
            label="Continue with Google"
            loading={busy === "google"}
            disabled={busy !== null}
            onPress={() => {
              setError(null);
              setBusy("google");
              void gPrompt();
            }}
            t={t}
          />
          <ProviderButton
            label="Continue with Microsoft"
            loading={busy === "microsoft"}
            disabled={busy !== null || !mReq}
            onPress={() => {
              setError(null);
              setBusy("microsoft");
              void mPrompt();
            }}
            t={t}
          />
          {error && <Text style={[styles.error, { color: t.destructive }]}>{error}</Text>}
          <Text style={[styles.fine, { color: t.fgMuted }]}>
            Use the Google or Microsoft account tied to your work email. No account?
            Ask your administrator to add you.
          </Text>
        </View>
      </View>
    </View>
  );
}

function ProviderButton({
  label,
  loading,
  disabled,
  onPress,
  t,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  t: ReturnType<typeof theme>;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cta,
        {
          backgroundColor: t.bgLift,
          borderColor: t.border,
          borderWidth: 1,
          opacity: disabled || pressed ? 0.7 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t.accent} />
      ) : (
        <Text style={[styles.ctaText, { color: t.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm },
  eyebrow: { fontSize: 10, fontFamily: "Courier", letterSpacing: 1.4, marginTop: 24 },
  title: { fontFamily: "serif", fontSize: 32, fontWeight: "500", letterSpacing: -0.5, textAlign: "center" },
  sub: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  cta: { borderRadius: RADIUS.md, padding: SPACING.md, alignItems: "center", justifyContent: "center", minHeight: 50 },
  ctaText: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  fine: { textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: SPACING.sm },
  error: { fontSize: 13, textAlign: "center" },
});
