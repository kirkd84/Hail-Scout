import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
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
import { MfaRequiredError } from "@/auth/session";
import { env } from "@/app/env";

const FORGOT_PASSWORD_URL = "https://www.hailgps.com/forgot-password";

WebBrowser.maybeCompleteAuthSession();

const SCOPES = ["openid", "profile", "email"];

// expo-auth-session's Google provider THROWS during render if the platform
// client id is undefined — which crashes the entire app on the sign-in screen.
// Pass a harmless placeholder when unset so it never throws; the button stays
// disabled until a real id is supplied via EXPO_PUBLIC_GOOGLE_*_CLIENT_ID.
const GOOGLE_PLACEHOLDER = "unconfigured.apps.googleusercontent.com";

export function SignInScreen() {
  const scheme = useColorScheme();
  const t = theme(scheme);
  const { completeSignIn, signInWithPassword } = useAuth();
  const [busy, setBusy] = useState<null | "google" | "microsoft" | "apple" | "password">(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Revealed only after the API says this account has SMS 2FA and has texted
  // a code — most accounts never see it.
  const [mfaCode, setMfaCode] = useState("");
  const [mfaPhone, setMfaPhone] = useState<string | null>(null);
  const [mfaNeeded, setMfaNeeded] = useState(false);

  const onPasswordSubmit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy("password");
    try {
      await signInWithPassword(email, password, mfaNeeded ? mfaCode : undefined);
    } catch (e) {
      if (e instanceof MfaRequiredError) {
        setMfaNeeded(true);
        setMfaPhone(e.phone);
        setMfaCode("");
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      }
    } finally {
      setBusy(null);
    }
  };
  // Sign in with Apple — iOS only. Required by App Store guideline 4.8 when
  // we offer Google/Microsoft. Availability is checked at runtime.
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const googleConfigured = !!(env.GOOGLE_ANDROID_CLIENT_ID || env.GOOGLE_IOS_CLIENT_ID);
  const microsoftConfigured = !!env.MICROSOFT_CLIENT_ID;

  const onApplePress = async () => {
    setError(null);
    setBusy("apple");
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error("Apple didn't return an identity token.");
      await completeSignIn("apple", cred.identityToken);
    } catch (e) {
      // User cancelling the native sheet is not an error.
      if ((e as { code?: string })?.code !== "ERR_REQUEST_CANCELED") {
        setError(e instanceof Error ? e.message : "Apple sign-in failed.");
      }
    } finally {
      setBusy(null);
    }
  };

  // Google — the provider helper manages the iOS/Android client IDs + id_token.
  const [, gRes, gPrompt] = Google.useAuthRequest({
    iosClientId: env.GOOGLE_IOS_CLIENT_ID || GOOGLE_PLACEHOLDER,
    androidClientId: env.GOOGLE_ANDROID_CLIENT_ID || GOOGLE_PLACEHOLDER,
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
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
        <Wordmark size={28} />
        <Text style={[styles.eyebrow, { color: t.accent }]}>SIGN IN</Text>
        <Text style={[styles.title, { color: t.fg }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: t.fgMuted }]}>
          Storm intelligence for crews who beat the clock.
        </Text>

        <View style={{ width: "100%", marginTop: SPACING.xl, gap: SPACING.md }}>
          <TextInput
            style={[styles.input, { backgroundColor: t.bgLift, borderColor: t.border, color: t.fg }]}
            placeholder="Email"
            placeholderTextColor={t.fgMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            editable={busy === null}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { backgroundColor: t.bgLift, borderColor: t.border, color: t.fg }]}
            placeholder="Password"
            placeholderTextColor={t.fgMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="password"
            editable={busy === null}
            returnKeyType={mfaNeeded ? "next" : "go"}
            onSubmitEditing={() => {
              if (!mfaNeeded) void onPasswordSubmit();
            }}
          />
          {mfaNeeded && (
            <TextInput
              style={[styles.input, { backgroundColor: t.bgLift, borderColor: t.border, color: t.fg }]}
              placeholder={mfaPhone ? `6-digit code sent to ${mfaPhone}` : "6-digit code"}
              placeholderTextColor={t.fgMuted}
              value={mfaCode}
              onChangeText={setMfaCode}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              editable={busy === null}
              returnKeyType="go"
              onSubmitEditing={() => void onPasswordSubmit()}
            />
          )}
          <Pressable
            disabled={busy !== null}
            onPress={() => void onPasswordSubmit()}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: t.accent,
                opacity: busy !== null || pressed ? 0.7 : 1,
              },
            ]}
          >
            {busy === "password" ? (
              <ActivityIndicator color={t.bg} />
            ) : (
              <Text style={[styles.ctaText, { color: t.bg }]}>Sign in</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(FORGOT_PASSWORD_URL)}
            hitSlop={8}
          >
            <Text style={[styles.link, { color: t.fgMuted }]}>Forgot password?</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            <Text style={[styles.dividerText, { color: t.fgMuted }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: t.border }]} />
          </View>

          <ProviderButton
            label="Continue with Google"
            loading={busy === "google"}
            disabled={busy !== null || !googleConfigured}
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
            disabled={busy !== null || !mReq || !microsoftConfigured}
            onPress={() => {
              setError(null);
              setBusy("microsoft");
              void mPrompt();
            }}
            t={t}
          />
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                scheme === "dark"
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={RADIUS.md}
              style={{ height: 50, width: "100%" }}
              onPress={() => void onApplePress()}
            />
          )}
          {error && <Text style={[styles.error, { color: t.destructive }]}>{error}</Text>}
          <Text style={[styles.fine, { color: t.fgMuted }]}>
            Sign in with your email and password, or the work account tied to your
            email. No account? Ask your administrator to add you.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  // flexGrow (not flex) — this is a ScrollView contentContainerStyle now, so the
  // content still centres on tall screens but can scroll when the keyboard is up.
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    // 50pt tall: comfortably above the 44pt minimum touch target.
    height: 50,
    fontSize: 15,
  },
  link: { fontSize: 13, textAlign: "center", textDecorationLine: "underline" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginVertical: SPACING.xs },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  eyebrow: { fontSize: 10, fontFamily: "Courier", letterSpacing: 1.4, marginTop: 24 },
  title: { fontFamily: "serif", fontSize: 32, fontWeight: "500", letterSpacing: -0.5, textAlign: "center" },
  sub: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  cta: { borderRadius: RADIUS.md, padding: SPACING.md, alignItems: "center", justifyContent: "center", minHeight: 50 },
  ctaText: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  fine: { textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: SPACING.sm },
  error: { fontSize: 13, textAlign: "center" },
});
