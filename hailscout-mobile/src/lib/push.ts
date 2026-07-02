/**
 * Expo push-notification registration for the native app.
 *
 * Flow: ask permission → fetch this device's ExponentPushToken → register it
 * with the API (`/v1/me/push-token`). The server relays hail alerts through
 * Expo's push service. All best-effort: a denied permission, a simulator (no
 * token), or a network blip never blocks sign-in.
 *
 * NOTE: Android delivery needs the project's FCM credentials configured in
 * Expo/EAS (a one-time console step) — that's set up alongside the build, not
 * here.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiRequest } from "@/lib/api";

// Show heads-up notifications even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Remember the token we registered so we can unregister it on sign-out.
let registeredToken: string | null = null;

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).easConfig?.projectId
  );
}

export async function registerForPushNotifications(
  getToken: () => Promise<string | null>,
): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Hail alerts",
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: "#06B6D4",
      });
      // Storm alarms (Phase 34 — car-ready): MAX importance = heads-up
      // banner + sound even while navigating, which also plays over car
      // Bluetooth / Android Auto audio. The server targets this channel
      // via channelId on zone/watchlist alerts.
      await Notifications.setNotificationChannelAsync("storm-alarms", {
        name: "Storm alarms",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 300, 150, 300],
        lightColor: "#06B6D4",
      });
    }

    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const projectId = getProjectId();
    // Throws on a simulator/emulator (no push service) — caught below.
    const { data: expoToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!expoToken) return;

    const authToken = await getToken();
    if (!authToken) return;
    await apiRequest("/v1/me/push-token", {
      token: authToken,
      method: "POST",
      body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
    });
    registeredToken = expoToken;
  } catch {
    // Best-effort: never surface a push error to the sign-in flow.
  }
}

export async function unregisterPushNotifications(
  getToken: () => Promise<string | null>,
): Promise<void> {
  try {
    if (!registeredToken) return;
    const authToken = await getToken();
    if (!authToken) return;
    await apiRequest("/v1/me/push-token", {
      token: authToken,
      method: "DELETE",
      body: JSON.stringify({ token: registeredToken }),
    });
    registeredToken = null;
  } catch {
    /* best-effort */
  }
}
