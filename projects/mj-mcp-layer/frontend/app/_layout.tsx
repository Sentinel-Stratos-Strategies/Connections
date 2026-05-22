import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/lib/auth-context";
import { COLORS } from "@/constants/config";
import "../global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" backgroundColor={COLORS.background} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
              animation: "fade",
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
