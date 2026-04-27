import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";

export function SettingsScreen() {
  const { user } = useUser();
  const { signOut, isLoaded } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSignOut = async () => {
    if (!isLoaded) {
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        onPress: () => {},
        style: "cancel",
      },
      {
        text: "Sign Out",
        onPress: async () => {
          setIsLoading(true);
          try {
            await signOut();
          } catch (err) {
            console.error("Sign out error:", err);
            Alert.alert("Error", "Failed to sign out. Please try again.");
          } finally {
            setIsLoading(false);
          }
        },
        style: "destructive",
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.primaryEmailAddress?.emailAddress}</Text>
          </View>
          {user?.organizationMemberships?.[0]?.organization?.name && (
            <View style={styles.row}>
              <Text style={styles.label}>Organization</Text>
              <Text style={styles.value}>
                {user.organizationMemberships[0].organization.name}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.value}>1.0.0</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Environment</Text>
            <Text style={styles.value}>Production</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSignOut}
        disabled={isLoading || !isLoaded}
      >
        {isLoading ? (
          <ActivityIndicator color="#ff3b30" />
        ) : (
          <Text style={styles.buttonText}>Sign Out</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  label: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
  },
  button: {
    backgroundColor: "#ff3b30",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
