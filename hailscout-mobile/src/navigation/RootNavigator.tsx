import React from "react";
import { useAuth } from "@/auth/AuthProvider";
import { createStackNavigator } from "@react-navigation/stack";
import { View, ActivityIndicator, useColorScheme } from "react-native";
import { theme } from "@/lib/tokens";
import { SignInScreen } from "@/auth/SignInScreen";
import { SignUpScreen } from "@/auth/SignUpScreen";
import { MainTabs } from "./MainTabs";
import { DriveScreen } from "@/screens/DriveScreen";
import type { AuthStackParamList, AppStackParamList } from "./types";

const AuthStack = createStackNavigator<AuthStackParamList>();
const AppStack = createStackNavigator<AppStackParamList>();

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function AppFlow() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Main" component={MainTabs} />
      <AppStack.Screen
        name="Drive"
        component={DriveScreen}
        options={{ presentation: "modal", gestureEnabled: false }}
      />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const t = theme(useColorScheme());

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return isSignedIn ? <AppFlow /> : <AuthFlow />;
}
