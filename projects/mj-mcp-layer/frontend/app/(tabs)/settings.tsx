import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import {
  COLORS,
  DEFAULT_MCP_BASE_URL,
  DEFAULT_SHELL_URL,
  STORAGE_KEYS,
} from "@/constants/config";
import { useAuth } from "@/lib/auth-context";

// Setting Row Component
function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center py-4 border-b border-border ${
        onPress ? "active:opacity-70" : ""
      }`}
    >
      <View
        className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${
          danger ? "bg-danger/10" : "bg-surface"
        }`}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={danger ? COLORS.danger : COLORS.primary}
        />
      </View>
      <View className="flex-1">
        <Text className={danger ? "text-danger font-medium" : "text-text font-medium"}>
          {label}
        </Text>
        {value && (
          <Text className="text-muted text-sm mt-0.5" numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
      )}
    </Pressable>
  );
}

// Editable URL Modal Content
function URLEditor({
  title,
  value,
  defaultValue,
  onSave,
  onCancel,
}: {
  title: string;
  value: string;
  defaultValue: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState(value);

  return (
    <View className="bg-surface rounded-2xl p-6 border border-border">
      <Text className="text-text font-semibold text-lg mb-4">{title}</Text>

      <TextInput
        className="bg-background border border-border rounded-xl px-4 py-3 text-text mb-4"
        value={input}
        onChangeText={setInput}
        placeholder={defaultValue}
        placeholderTextColor={COLORS.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Text className="text-muted text-xs mb-4">
        Default: {defaultValue}
      </Text>

      <View className="flex-row gap-3">
        <Pressable
          onPress={onCancel}
          className="flex-1 py-3 rounded-xl bg-background border border-border items-center"
        >
          <Text className="text-text font-medium">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => onSave(input || defaultValue)}
          className="flex-1 py-3 rounded-xl bg-primary items-center"
        >
          <Text className="text-white font-medium">Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { logout } = useAuth();
  const [mcpBaseUrl, setMcpBaseUrl] = useState(DEFAULT_MCP_BASE_URL);
  const [shellUrl, setShellUrl] = useState(DEFAULT_SHELL_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUrl, setEditingUrl] = useState<"mcp" | "shell" | null>(null);
  const [newToken, setNewToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const [storedMcpUrl, storedShellUrl] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.MCP_BASE_URL),
        SecureStore.getItemAsync(STORAGE_KEYS.SHELL_URL),
      ]);
      if (storedMcpUrl) setMcpBaseUrl(storedMcpUrl);
      if (storedShellUrl) setShellUrl(storedShellUrl);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveMcpUrl(url: string) {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.MCP_BASE_URL, url);
      setMcpBaseUrl(url);
      setEditingUrl(null);
      Alert.alert("Saved", "MCP Base URL updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to save URL");
    }
  }

  async function saveShellUrl(url: string) {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.SHELL_URL, url);
      setShellUrl(url);
      setEditingUrl(null);
      Alert.alert("Saved", "Shell URL updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to save URL");
    }
  }

  async function rotateToken() {
    if (!newToken.trim()) {
      Alert.alert("Error", "Please enter a new token");
      return;
    }

    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, newToken.trim());
      setNewToken("");
      setShowTokenInput(false);
      Alert.alert("Success", "Token rotated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to rotate token");
    }
  }

  async function handleLogout() {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          },
        },
      ]
    );
  }

  async function resetToDefaults() {
    Alert.alert(
      "Reset Settings",
      "Reset all URLs to default values?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: async () => {
            await Promise.all([
              SecureStore.deleteItemAsync(STORAGE_KEYS.MCP_BASE_URL),
              SecureStore.deleteItemAsync(STORAGE_KEYS.SHELL_URL),
            ]);
            setMcpBaseUrl(DEFAULT_MCP_BASE_URL);
            setShellUrl(DEFAULT_SHELL_URL);
            Alert.alert("Reset", "Settings restored to defaults");
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        {/* Header */}
        <View className="py-4">
          <Text className="text-2xl font-bold text-text">Settings</Text>
          <Text className="text-muted">Configure your operator console</Text>
        </View>

        {/* API Configuration Section */}
        <View className="mb-6">
          <Text className="text-muted text-sm font-medium mb-2 uppercase tracking-wider">
            API Configuration
          </Text>
          <View className="bg-surface rounded-2xl px-4 border border-border">
            <SettingRow
              icon="server-outline"
              label="MCP Base URL"
              value={mcpBaseUrl}
              onPress={() => setEditingUrl("mcp")}
            />
            <SettingRow
              icon="terminal-outline"
              label="Shell WebSocket URL"
              value={shellUrl}
              onPress={() => setEditingUrl("shell")}
            />
          </View>
        </View>

        {/* URL Editor Modal */}
        {editingUrl === "mcp" && (
          <View className="mb-6">
            <URLEditor
              title="Edit MCP Base URL"
              value={mcpBaseUrl}
              defaultValue={DEFAULT_MCP_BASE_URL}
              onSave={saveMcpUrl}
              onCancel={() => setEditingUrl(null)}
            />
          </View>
        )}

        {editingUrl === "shell" && (
          <View className="mb-6">
            <URLEditor
              title="Edit Shell URL"
              value={shellUrl}
              defaultValue={DEFAULT_SHELL_URL}
              onSave={saveShellUrl}
              onCancel={() => setEditingUrl(null)}
            />
          </View>
        )}

        {/* Security Section */}
        <View className="mb-6">
          <Text className="text-muted text-sm font-medium mb-2 uppercase tracking-wider">
            Security
          </Text>
          <View className="bg-surface rounded-2xl px-4 border border-border">
            <SettingRow
              icon="key-outline"
              label="Rotate Token"
              value="Replace your operator token"
              onPress={() => setShowTokenInput(!showTokenInput)}
            />
          </View>

          {showTokenInput && (
            <View className="bg-surface rounded-2xl p-4 border border-border mt-3">
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-text mb-3"
                value={newToken}
                onChangeText={setNewToken}
                placeholder="Enter new operator token"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                autoCapitalize="none"
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setNewToken("");
                    setShowTokenInput(false);
                  }}
                  className="flex-1 py-3 rounded-xl bg-background border border-border items-center"
                >
                  <Text className="text-text font-medium">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={rotateToken}
                  className="flex-1 py-3 rounded-xl bg-primary items-center"
                >
                  <Text className="text-white font-medium">Save Token</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Actions Section */}
        <View className="mb-6">
          <Text className="text-muted text-sm font-medium mb-2 uppercase tracking-wider">
            Actions
          </Text>
          <View className="bg-surface rounded-2xl px-4 border border-border">
            <SettingRow
              icon="refresh-outline"
              label="Reset to Defaults"
              value="Restore default URLs"
              onPress={resetToDefaults}
            />
          </View>
        </View>

        {/* Account Section */}
        <View className="mb-6">
          <Text className="text-muted text-sm font-medium mb-2 uppercase tracking-wider">
            Account
          </Text>
          <View className="bg-surface rounded-2xl px-4 border border-border">
            <SettingRow
              icon="log-out-outline"
              label="Logout"
              onPress={handleLogout}
              danger
            />
          </View>
        </View>

        {/* App Info */}
        <View className="items-center py-6">
          <View className="w-16 h-16 bg-surface rounded-2xl items-center justify-center mb-3 border border-border">
            <Ionicons name="shield-checkmark" size={32} color={COLORS.primary} />
          </View>
          <Text className="text-text font-semibold">MJ Brady Operator Console</Text>
          <Text className="text-muted text-sm">Version 1.0.0</Text>
          <Text className="text-muted text-xs mt-1">Ellis Aegis Security Platform</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
