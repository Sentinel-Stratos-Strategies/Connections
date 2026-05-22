import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS } from "@/constants/config";
import {
  getHealth,
  getMCPConnections,
  getDriftStatus,
  getComplianceScores,
  triggerDriftScan,
} from "@/lib/api";

// Health Status Card
function HealthCard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <View className="bg-surface rounded-2xl p-5 border border-border">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-surface rounded-2xl p-5 border border-danger/30">
        <View className="flex-row items-center">
          <View className="w-3 h-3 rounded-full bg-danger mr-3" />
          <Text className="text-danger font-semibold">Connection Error</Text>
        </View>
        <Pressable onPress={() => refetch()} className="mt-3">
          <Text className="text-accent text-sm">Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const statusColor = {
    healthy: COLORS.success,
    degraded: COLORS.warning,
    unhealthy: COLORS.danger,
  }[data?.status || "unhealthy"];

  return (
    <View className="bg-surface rounded-2xl p-5 border border-border">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-muted text-sm">System Health</Text>
        <View className="flex-row items-center">
          <View
            className="w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: statusColor }}
          />
          <Text className="text-text capitalize font-medium">
            {data?.status || "Unknown"}
          </Text>
        </View>
      </View>
      <View className="flex-row items-baseline">
        <Text className="text-4xl font-bold text-text">
          {data?.services?.filter((s) => s.status === "up").length || 0}
        </Text>
        <Text className="text-muted ml-2">
          / {data?.services?.length || 0} services up
        </Text>
      </View>
      {data?.version && (
        <Text className="text-muted text-xs mt-2">v{data.version}</Text>
      )}
    </View>
  );
}

// MCP Connections Pills
function MCPConnectionsPills() {
  const { data, isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: getMCPConnections,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <View className="flex-row gap-2">
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            className="bg-surface h-10 w-24 rounded-full border border-border"
          />
        ))}
      </View>
    );
  }

  const connections = data || [
    { id: "1", name: "Perplexity", provider: "perplexity", status: "connected" },
    { id: "2", name: "Codex", provider: "codex", status: "connected" },
    { id: "3", name: "OpenAI", provider: "openai", status: "connected" },
  ];

  return (
    <View className="flex-row flex-wrap gap-2">
      {connections.map((conn) => {
        const isConnected = conn.status === "connected";
        return (
          <View
            key={conn.id}
            className={`flex-row items-center px-4 py-2 rounded-full border ${
              isConnected
                ? "bg-success/10 border-success/30"
                : "bg-danger/10 border-danger/30"
            }`}
          >
            <View
              className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? "bg-success" : "bg-danger"
              }`}
            />
            <Text className={isConnected ? "text-success" : "text-danger"}>
              {conn.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Drift Status Badge
function DriftBadge() {
  const { data, isLoading } = useQuery({
    queryKey: ["drift"],
    queryFn: getDriftStatus,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <View className="bg-surface rounded-2xl p-5 border border-border">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const driftData = data || { status: "clean", lastScan: new Date().toISOString(), driftCount: 0 };
  const isClean = driftData.status === "clean";
  const lastScan = new Date(driftData.lastScan);

  return (
    <View className="bg-surface rounded-2xl p-5 border border-border">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-muted text-sm">Drift Status</Text>
        <View
          className={`px-3 py-1 rounded-full ${
            isClean ? "bg-success/10" : "bg-warning/10"
          }`}
        >
          <Text className={isClean ? "text-success" : "text-warning"}>
            {isClean ? "Clean" : "Drift Detected"}
          </Text>
        </View>
      </View>
      <Text className="text-muted text-xs">
        Last scan: {lastScan.toLocaleString()}
      </Text>
      {!isClean && driftData.driftCount > 0 && (
        <Text className="text-warning text-sm mt-2">
          {driftData.driftCount} resource(s) drifted
        </Text>
      )}
    </View>
  );
}

// Compliance Ring
function ComplianceRing() {
  const { data, isLoading } = useQuery({
    queryKey: ["compliance"],
    queryFn: getComplianceScores,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <View className="bg-surface rounded-2xl p-5 border border-border">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const scores = data || [
    { framework: "SOC2", status: "pass", score: 98 },
    { framework: "PCI", status: "pass", score: 100 },
    { framework: "HIPAA", status: "partial", score: 85 },
  ];

  const avgScore = Math.round(
    scores.reduce((acc, s) => acc + (s.score || 0), 0) / scores.length
  );

  return (
    <View className="bg-surface rounded-2xl p-5 border border-border">
      <Text className="text-muted text-sm mb-4">Compliance Score</Text>
      <View className="flex-row items-center">
        {/* Score Ring */}
        <View className="w-20 h-20 rounded-full border-4 border-primary items-center justify-center mr-4">
          <Text className="text-2xl font-bold text-text">{avgScore}%</Text>
        </View>
        {/* Framework List */}
        <View className="flex-1">
          {scores.map((s) => (
            <View
              key={s.framework}
              className="flex-row items-center justify-between py-1"
            >
              <Text className="text-text">{s.framework}</Text>
              <View
                className={`px-2 py-0.5 rounded ${
                  s.status === "pass"
                    ? "bg-success/10"
                    : s.status === "partial"
                    ? "bg-warning/10"
                    : "bg-danger/10"
                }`}
              >
                <Text
                  className={`text-xs ${
                    s.status === "pass"
                      ? "text-success"
                      : s.status === "partial"
                      ? "text-warning"
                      : "text-danger"
                  }`}
                >
                  {s.status === "pass"
                    ? "Pass"
                    : s.status === "partial"
                    ? "Partial"
                    : "Fail"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Quick Actions
function QuickActions() {
  const driftMutation = useQuery({
    queryKey: ["triggerDrift"],
    queryFn: triggerDriftScan,
    enabled: false,
  });

  const actions = [
    {
      icon: "scan-outline" as const,
      label: "Run Drift Scan",
      color: COLORS.accent,
      onPress: () => driftMutation.refetch(),
    },
    {
      icon: "add-circle-outline" as const,
      label: "New Deployment",
      color: COLORS.primary,
      onPress: () => router.push("/(tabs)/deploy"),
    },
    {
      icon: "terminal-outline" as const,
      label: "Open Console",
      color: COLORS.success,
      onPress: () => router.push("/(tabs)/console"),
    },
  ];

  return (
    <View className="flex-row gap-3">
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          className="flex-1 bg-surface rounded-2xl p-4 border border-border items-center"
        >
          <View
            className="w-12 h-12 rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: `${action.color}20` }}
          >
            <Ionicons name={action.icon} size={24} color={action.color} />
          </View>
          <Text className="text-text text-xs text-center">{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const [refreshing, setRefreshing] = React.useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between py-4">
          <View>
            <Text className="text-muted text-sm">MJ Brady</Text>
            <Text className="text-2xl font-bold text-text">War Room</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            className="w-10 h-10 bg-surface rounded-full items-center justify-center border border-border"
          >
            <Ionicons name="person-outline" size={20} color={COLORS.muted} />
          </Pressable>
        </View>

        {/* Health Status */}
        <View className="mb-4">
          <HealthCard />
        </View>

        {/* MCP Connections */}
        <View className="mb-4">
          <Text className="text-muted text-sm mb-3">Active Connections</Text>
          <MCPConnectionsPills />
        </View>

        {/* Drift & Compliance Row */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <DriftBadge />
          </View>
        </View>

        <View className="mb-4">
          <ComplianceRing />
        </View>

        {/* Quick Actions */}
        <View className="mb-4">
          <Text className="text-muted text-sm mb-3">Quick Actions</Text>
          <QuickActions />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
