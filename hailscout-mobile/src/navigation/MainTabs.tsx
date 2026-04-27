import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet } from "react-native";
import { MapScreen } from "@/screens/MapScreen";
import { AddressesScreen } from "@/screens/AddressesScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { MainTabsParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#0066cc",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: "Map",
          tabBarLabel: "Map",
        }}
      />
      <Tab.Screen
        name="Addresses"
        component={AddressesScreen}
        options={{
          title: "Addresses",
          tabBarLabel: "Addresses",
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
});
