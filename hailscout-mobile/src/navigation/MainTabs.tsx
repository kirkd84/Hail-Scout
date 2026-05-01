import React from "react";
import { Text, View, useColorScheme, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Svg, { Path, Circle } from "react-native-svg";
import { theme } from "@/lib/tokens";
import { HomeScreen } from "@/screens/HomeScreen";
import { MapScreen } from "@/screens/MapScreen";
import { AlertsScreen } from "@/screens/AlertsScreen";
import { AddressesScreen } from "@/screens/AddressesScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { MainTabsParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabsParamList>();

interface IconProps { color: string; focused: boolean }

const IconHome   = ({ color }: IconProps) => (
  <Svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2.5 14.5V6L8 2L13.5 6V14.5" />
    <Path d="M6 14.5V9.5H10V14.5" />
  </Svg>
);
const IconAtlas  = ({ color }: IconProps) => (
  <Svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5.5 13.5L1.5 14.5V3L5.5 2M5.5 13.5L10.5 14M5.5 13.5V2M10.5 14L14.5 13V2.5L10.5 2M10.5 14V2M5.5 2L10.5 2" />
  </Svg>
);
const IconBolt   = ({ color }: IconProps) => (
  <Svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 1.5L3 9.5H7.5L6.5 14.5L13 6.5H8.5L9 1.5Z" />
  </Svg>
);
const IconPin    = ({ color }: IconProps) => (
  <Svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 14.5C8 14.5 13 10.5 13 6.5A5 5 0 0 0 3 6.5C3 10.5 8 14.5 8 14.5Z" />
    <Circle cx="8" cy="6.5" r="1.7" />
  </Svg>
);
const IconCog    = ({ color }: IconProps) => (
  <Svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="8" cy="8" r="2.2" />
    <Path d="M8 1.5V3M8 13V14.5M2.7 5L4 5.8M12 10.2L13.3 11M2.7 11L4 10.2M12 5.8L13.3 5M1.5 8H3M13 8H14.5" />
  </Svg>
);

export function MainTabs() {
  const t = theme(useColorScheme());
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.fgMuted,
        tabBarStyle: {
          backgroundColor: t.bg,
          borderTopColor: t.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Courier",
          letterSpacing: 0.6,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen name="Home"      component={HomeScreen}      options={{ tabBarIcon: IconHome,  tabBarLabel: "HOME" }} />
      <Tab.Screen name="Atlas"     component={MapScreen}       options={{ tabBarIcon: IconAtlas, tabBarLabel: "ATLAS" }} />
      <Tab.Screen name="Alerts"    component={AlertsScreen}    options={{ tabBarIcon: IconBolt,  tabBarLabel: "ALERTS" }} />
      <Tab.Screen name="Addresses" component={AddressesScreen} options={{ tabBarIcon: IconPin,   tabBarLabel: "ADDRS" }} />
      <Tab.Screen name="Settings"  component={SettingsScreen}  options={{ tabBarIcon: IconCog,   tabBarLabel: "SETTINGS" }} />
    </Tab.Navigator>
  );
}
