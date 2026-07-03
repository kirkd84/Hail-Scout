import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type MainTabsParamList = {
  Home:      undefined;
  Atlas:     undefined;
  Alerts:    undefined;
  Addresses: undefined;
  Settings:  undefined;
};

// Signed-in stack: the tabs, plus full-screen screens presented OVER them
// (Drive mode hides the tab bar for a clean, glanceable driving view).
export type AppStackParamList = {
  Main: NavigatorScreenParams<MainTabsParamList>;
  Drive: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabsParamList>;
};
