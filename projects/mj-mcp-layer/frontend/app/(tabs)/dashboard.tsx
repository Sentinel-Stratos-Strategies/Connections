import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { COLORS } from "@/constants/config";
import {
  getTenants,
  getAuditEvents,
  getChangeRequests,
  getComplianceScores,
  approveChangeRequest,
  denyChangeRequest,
  type Tenant,
  type AuditEvent,
  type ChangeRequest,
  type ComplianceScore,
} from "@/lib/api";

type DashboardTab = "tenants" | "audit" | "changes" | "compliance";

// Tenant Table
function TenantTable() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tenants"],
    queryFn: getTenants,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Ionicons name="alert-circle" size={48} color={COLORS.danger} />
        <Text className="text-danger mt-2">Failed to load tenants</Text>
        <Pressable onPress={() => refetch()} className="mt-4">
          <Text className="text-accent">Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const tenants: Tenant[] = data || [
    {
      id: "tenant-001",
      name: "Acme Corp",
      status: "active",
      rateLimit: 5000,
      capabilities: ["api", "webhooks"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "tenant-002",
      name: "TechStart Inc",
      status: "active",
      rateLimit: 2500,
      capabilities: ["api"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "tenant-003",
      name: "Enterprise Ltd",
      status: "suspended",
      rateLimit: 10000,
      capabilities: ["api", "webhooks", "streaming"],
      createdAt: new Date().toISOString(),
    },
  ];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {tenants.map((tenant) => (
        <View
          key={tenant.id}
          className="bg-surface rounded-xl p-4 mb-3 border border-border"
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-text font-semibold">{tenant.name}</Text>
            <View
              className={`px-2 py-1 rounded ${
                tenant.status === "active"
                  ? "bg-success/10"
                  : tenant.status === "suspended"
                  ? "bg-danger/10"
                  : "bg-warning/10"
              }`}
            >
              <Text
                className={`text-xs capitalize ${
                  tenant.status === "active"
                    ? "text-success"
                    : tenant.status === "suspended"
                    ? "text-danger"
                    : "text-warning"
                }`}
              >
                {tenant.status}
              </Text>
            </View>
          </View>

          <Text className="text-muted text-xs mb-2">{tenant.id}</Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Ionicons name="speedometer-outline" size={14} color={COLORS.muted} />
              <Text className="text-muted text-xs ml-1">
                {tenant.rateLimit.toLocaleString()}/min
              </Text>
            </View>

            <View className="flex-row gap-1">
              {tenant.capabilities.slice(0, 3).map((cap) => (
                <View
                  key={cap}
                  className="bg-primary/10 px-2 py-0.5 rounded"
                >
                  <Text className="text-primary text-xs">{cap}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// Audit Log
function AuditLog() {
  const [tenantFilter, setTenantFilter] = useState("");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit", tenantFilter],
    queryFn: () =>
      getAuditEvents(tenantFilter ? { tenantId: tenantFilter } : undefined),
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Ionicons name="alert-circle" size={48} color={COLORS.danger} />
        <Text className="text-danger mt-2">Failed to load audit events</Text>
        <Pressable onPress={() => refetch()} className="mt-4">
          <Text className="text-accent">Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const events: AuditEvent[] = data || [
    {
      id: "evt-001",
      tenantId: "tenant-001",
      event: "api.request",
      timestamp: new Date().toISOString(),
      details: {},
      severity: "info",
    },
    {
      id: "evt-002",
      tenantId: "tenant-002",
      event: "rate.limit.exceeded",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      details: {},
      severity: "warning",
    },
    {
      id: "evt-003",
      tenantId: "tenant-001",
      event: "auth.failure",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      details: {},
      severity: "critical",
    },
  ];

  const severityColors = {
    info: COLORS.accent,
    warning: COLORS.warning,
    critical: COLORS.danger,
  };

  return (
    <View className="flex-1">
      {/* Filter */}
      <View className="mb-4">
        <View className="flex-row items-center bg-surface rounded-xl border border-border px-3">
          <Ionicons name="search" size={18} color={COLORS.muted} />
          <TextInput
            className="flex-1 py-3 px-2 text-text"
            placeholder="Filter by tenant ID..."
            placeholderTextColor={COLORS.muted}
            value={tenantFilter}
            onChangeText={setTenantFilter}
          />
          {tenantFilter && (
            <Pressable onPress={() => setTenantFilter("")}>
              <Ionicons name="close-circle" size={18} color={COLORS.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Events List */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {events.map((event) => (
          <View
            key={event.id}
            className="bg-surface rounded-xl p-4 mb-3 border border-border"
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <View
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: severityColors[event.severity] }}
                  />
                  <Text className="text-text font-medium">{event.event}</Text>
                </View>
                <Text className="text-muted text-xs mt-1">{event.tenantId}</Text>
              </View>
              <Text className="text-muted text-xs">
                {new Date(event.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Change Request Item with Swipe Actions
function ChangeRequestItem({
  request,
  onApprove,
  onDeny,
}: {
  request: ChangeRequest;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const translateX = useSharedValue(0);

  const handleApprove = useCallback(() => {
    onApprove();
  }, [onApprove]);

  const handleDeny = useCallback(() => {
    onDeny();
  }, [onDeny]);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = Math.max(-150, Math.min(150, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > 100) {
        runOnJS(handleApprove)();
      } else if (e.translationX < -100) {
        runOnJS(handleDeny)();
      }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 50 ? 1 : 0,
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -50 ? 1 : 0,
  }));

  return (
    <View className="mb-3 overflow-hidden rounded-xl">
      {/* Background Actions */}
      <View className="absolute inset-0 flex-row">
        <Animated.View
          style={leftActionStyle}
          className="flex-1 bg-success items-start justify-center pl-4"
        >
          <Ionicons name="checkmark-circle" size={32} color="#fff" />
        </Animated.View>
        <Animated.View
          style={rightActionStyle}
          className="flex-1 bg-danger items-end justify-center pr-4"
        >
          <Ionicons name="close-circle" size={32} color="#fff" />
        </Animated.View>
      </View>

      {/* Card */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={animatedStyle}
          className="bg-surface p-4 border border-border rounded-xl"
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-text font-semibold">{request.type}</Text>
            <View
              className={`px-2 py-1 rounded ${
                request.status === "pending"
                  ? "bg-warning/10"
                  : request.status === "approved"
                  ? "bg-success/10"
                  : "bg-danger/10"
              }`}
            >
              <Text
                className={`text-xs capitalize ${
                  request.status === "pending"
                    ? "text-warning"
                    : request.status === "approved"
                    ? "text-success"
                    : "text-danger"
                }`}
              >
                {request.status}
              </Text>
            </View>
          </View>
          <Text className="text-muted text-sm" numberOfLines={2}>
            {request.description}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-muted text-xs">by {request.requestedBy}</Text>
            <Text className="text-muted text-xs">
              {new Date(request.requestedAt).toLocaleDateString()}
            </Text>
          </View>
          {request.status === "pending" && (
            <Text className="text-accent text-xs mt-2">
              Swipe right to approve, left to deny
            </Text>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// Change Requests List
function ChangeRequestsList() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["changeRequests"],
    queryFn: getChangeRequests,
  });

  const approveMutation = useMutation({
    mutationFn: approveChangeRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changeRequests"] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: denyChangeRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changeRequests"] });
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Ionicons name="alert-circle" size={48} color={COLORS.danger} />
        <Text className="text-danger mt-2">Failed to load change requests</Text>
        <Pressable onPress={() => refetch()} className="mt-4">
          <Text className="text-accent">Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const requests: ChangeRequest[] = data || [
    {
      id: "cr-001",
      type: "Rate Limit Increase",
      description: "Request to increase rate limit from 1000 to 5000 req/min",
      status: "pending",
      requestedBy: "operator@acme.com",
      requestedAt: new Date().toISOString(),
    },
    {
      id: "cr-002",
      type: "New Capability",
      description: "Enable streaming API access for tenant-002",
      status: "pending",
      requestedBy: "admin@techstart.io",
      requestedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "cr-003",
      type: "WAF Rule Update",
      description: "Switch from Standard to Strict WAF ruleset",
      status: "approved",
      requestedBy: "security@enterprise.com",
      requestedAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {requests.map((request) => (
        <ChangeRequestItem
          key={request.id}
          request={request}
          onApprove={() => {
            Alert.alert(
              "Approve Request",
              `Approve "${request.type}"?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Approve",
                  onPress: () => approveMutation.mutate(request.id),
                },
              ]
            );
          }}
          onDeny={() => {
            Alert.alert(
              "Deny Request",
              `Deny "${request.type}"?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Deny",
                  style: "destructive",
                  onPress: () => denyMutation.mutate(request.id),
                },
              ]
            );
          }}
        />
      ))}
    </ScrollView>
  );
}

// Compliance Detail Panel
function CompliancePanel() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["compliance"],
    queryFn: getComplianceScores,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Ionicons name="alert-circle" size={48} color={COLORS.danger} />
        <Text className="text-danger mt-2">Failed to load compliance data</Text>
        <Pressable onPress={() => refetch()} className="mt-4">
          <Text className="text-accent">Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const scores: ComplianceScore[] = data || [
    {
      framework: "SOC2",
      status: "pass",
      score: 98,
      controls: [
        { id: "CC1", name: "Control Environment", status: "pass" },
        { id: "CC2", name: "Communication", status: "pass" },
        { id: "CC3", name: "Risk Assessment", status: "pass" },
      ],
    },
    {
      framework: "PCI",
      status: "pass",
      score: 100,
      controls: [
        { id: "1", name: "Firewall Configuration", status: "pass" },
        { id: "2", name: "Password Protection", status: "pass" },
        { id: "3", name: "Cardholder Data Protection", status: "pass" },
      ],
    },
    {
      framework: "HIPAA",
      status: "partial",
      score: 85,
      controls: [
        { id: "164.308", name: "Administrative Safeguards", status: "pass" },
        { id: "164.310", name: "Physical Safeguards", status: "fail" },
        { id: "164.312", name: "Technical Safeguards", status: "pass" },
      ],
    },
  ];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {scores.map((score) => (
        <View
          key={score.framework}
          className="bg-surface rounded-xl p-4 mb-4 border border-border"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View
                className={`w-10 h-10 rounded-lg items-center justify-center mr-3 ${
                  score.status === "pass"
                    ? "bg-success/10"
                    : score.status === "partial"
                    ? "bg-warning/10"
                    : "bg-danger/10"
                }`}
              >
                <Ionicons
                  name={
                    score.status === "pass"
                      ? "checkmark-circle"
                      : score.status === "partial"
                      ? "alert-circle"
                      : "close-circle"
                  }
                  size={24}
                  color={
                    score.status === "pass"
                      ? COLORS.success
                      : score.status === "partial"
                      ? COLORS.warning
                      : COLORS.danger
                  }
                />
              </View>
              <View>
                <Text className="text-text font-semibold text-lg">
                  {score.framework}
                </Text>
                <Text className="text-muted text-xs capitalize">
                  {score.status}
                </Text>
              </View>
            </View>
            <Text className="text-3xl font-bold text-text">{score.score}%</Text>
          </View>

          {/* Controls */}
          <View className="border-t border-border pt-3">
            {score.controls.map((control) => (
              <View
                key={control.id}
                className="flex-row items-center justify-between py-2"
              >
                <View className="flex-row items-center flex-1">
                  <Text className="text-muted text-xs w-16">{control.id}</Text>
                  <Text className="text-text text-sm flex-1" numberOfLines={1}>
                    {control.name}
                  </Text>
                </View>
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${
                    control.status === "pass" ? "bg-success/10" : "bg-danger/10"
                  }`}
                >
                  <Ionicons
                    name={control.status === "pass" ? "checkmark" : "close"}
                    size={14}
                    color={
                      control.status === "pass" ? COLORS.success : COLORS.danger
                    }
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// Main Dashboard Screen
export default function DashboardScreen() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("tenants");
  const [refreshing, setRefreshing] = useState(false);

  const tabs: { id: DashboardTab; label: string; icon: string }[] = [
    { id: "tenants", label: "Tenants", icon: "people-outline" },
    { id: "audit", label: "Audit", icon: "document-text-outline" },
    { id: "changes", label: "Changes", icon: "git-pull-request-outline" },
    { id: "compliance", label: "Compliance", icon: "shield-checkmark-outline" },
  ];

  async function onRefresh() {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-4 py-4">
        <Text className="text-2xl font-bold text-text">Dashboard</Text>
        <Text className="text-muted">Monitor and manage your deployment</Text>
      </View>

      {/* Tab Bar */}
      <View className="flex-row px-4 mb-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="gap-2"
          contentContainerClassName="gap-2"
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-row items-center px-4 py-2 rounded-full ${
                activeTab === tab.id
                  ? "bg-primary"
                  : "bg-surface border border-border"
              }`}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.id ? "#fff" : COLORS.muted}
              />
              <Text
                className={`ml-2 font-medium ${
                  activeTab === tab.id ? "text-white" : "text-muted"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <View className="flex-1 px-4">
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          contentContainerClassName="pb-4"
        >
          {activeTab === "tenants" && <TenantTable />}
          {activeTab === "audit" && <AuditLog />}
          {activeTab === "changes" && <ChangeRequestsList />}
          {activeTab === "compliance" && <CompliancePanel />}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
