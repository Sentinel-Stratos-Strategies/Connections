import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { COLORS } from "@/constants/config";

export default function LoginScreen() {
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!token.trim()) {
      setError("Please enter your operator token");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await login(token.trim());
      if (success) {
        router.replace("/(tabs)");
      } else {
        setError("Invalid token or server unreachable");
      }
    } catch (err) {
      setError("Connection failed. Check your network.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo Area */}
        <View className="items-center mb-12">
          <View className="w-20 h-20 bg-surface rounded-2xl items-center justify-center mb-4 border border-border">
            <Ionicons name="shield-checkmark" size={40} color={COLORS.primary} />
          </View>
          <Text className="text-3xl font-bold text-text">MJ Brady</Text>
          <Text className="text-muted text-base mt-1">Operator Console</Text>
        </View>

        {/* Login Form */}
        <View className="bg-surface rounded-2xl p-6 border border-border">
          <Text className="text-text text-lg font-semibold mb-4">
            Authenticate
          </Text>

          <View className="mb-4">
            <Text className="text-muted text-sm mb-2">Operator Token</Text>
            <View className="flex-row items-center bg-background rounded-xl border border-border px-4">
              <Ionicons name="key-outline" size={20} color={COLORS.muted} />
              <TextInput
                className="flex-1 text-text py-4 px-3 text-base"
                placeholder="Enter your operator token"
                placeholderTextColor={COLORS.muted}
                value={token}
                onChangeText={setToken}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {error && (
            <View className="bg-danger/10 rounded-xl p-3 mb-4 flex-row items-center">
              <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
              <Text className="text-danger text-sm ml-2 flex-1">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            className={`rounded-xl py-4 items-center justify-center ${
              isLoading ? "bg-primary/50" : "bg-primary"
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                Authenticate
              </Text>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <View className="items-center mt-8">
          <Text className="text-muted text-xs">
            Secure connection to MCP Gateway
          </Text>
          <View className="flex-row items-center mt-2">
            <View className="w-2 h-2 rounded-full bg-success mr-2" />
            <Text className="text-muted text-xs">TLS 1.3 Encrypted</Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
