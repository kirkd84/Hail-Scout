import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type MainTabsParamList = {
  Home:      undefined;
  // `focusDay` (UTC YYYY-MM-DD) opens the map filtered to one storm day —
  // used by "See this day on the map" from a storm record elsewhere in the
  // app. `focusStormId` also flies the camera to that cell.
  Atlas:     { focusDay?: string; focusStormId?: string } | undefined;
  Alerts:    undefined;
  Addresses: undefined;
  Settings:  undefined;
};

// Signed-in stack: the tabs, plus full-screen screens presented OVER them
// (Drive mode hides the tab bar for a clean, glanceable driving view).
export type AppStackParamList = {
  Main: NavigatorScreenParams<MainTabsParamList>;
  Drive: undefined;
  Navigate: { destLng: number; destLat: number; label?: string };
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabsParamList>;
};
