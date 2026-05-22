import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { COLORS } from "@/constants/config";
import { createChangeRequest, getHealth } from "@/lib/api";

// Types
type ComplianceTarget = "SOC2" | "PCI" | "HIPAA" | "Custom";
type WAFRuleset = "Standard" | "Strict" | "Paranoid";
type BotPosture = "allow_verified" | "block_all" | "custom";
type TenantMode = "single" | "multi";

interface DeployConfig {
  complianceTarget: ComplianceTarget;
  wafRuleset: WAFRuleset;
  rateLimit: number;
  botPosture: BotPosture;
  tenantMode: TenantMode;
  deploymentName: string;
}

const initialConfig: DeployConfig = {
  complianceTarget: "SOC2",
  wafRuleset: "Standard",
  rateLimit: 1000,
  botPosture: "allow_verified",
  tenantMode: "single",
  deploymentName: "",
};

// Step 1: Compliance Target
function ComplianceStep({
  value,
  onChange,
}: {
  value: ComplianceTarget;
  onChange: (v: ComplianceTarget) => void;
}) {
  const targets: { id: ComplianceTarget; name: string; desc: string }[] = [
    {
      id: "SOC2",
      name: "SOC 2",
      desc: "Service Organization Control 2 compliance for SaaS",
    },
    {
      id: "PCI",
      name: "PCI DSS",
      desc: "Payment Card Industry Data Security Standard",
    },
    {
      id: "HIPAA",
      name: "HIPAA",
      desc: "Health Insurance Portability and Accountability",
    },
    {
      id: "Custom",
      name: "Custom",
      desc: "Define your own compliance requirements",
    },
  ];

  return (
    <View>
      <Text className="text-2xl font-bold text-text mb-2">
        Compliance Target
      </Text>
      <Text className="text-muted mb-6">
        Select the regulatory framework for this deployment
      </Text>

      <View className="gap-3">
        {targets.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            className={`p-4 rounded-2xl border ${
              value === t.id
                ? "bg-primary/10 border-primary"
                : "bg-surface border-border"
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-text font-semibold text-lg">
                  {t.name}
                </Text>
                <Text className="text-muted text-sm mt-1">{t.desc}</Text>
              </View>
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  value === t.id ? "border-primary bg-primary" : "border-muted"
                }`}
              >
                {value === t.id && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Step 2: WAF Ruleset
function WAFStep({
  value,
  onChange,
}: {
  value: WAFRuleset;
  onChange: (v: WAFRuleset) => void;
}) {
  const rulesets: { id: WAFRuleset; name: string; desc: string; icon: string }[] = [
    {
      id: "Standard",
      name: "Standard",
      desc: "Balanced protection with minimal false positives",
      icon: "shield-outline",
    },
    {
      id: "Strict",
      name: "Strict",
      desc: "Enhanced protection with moderate sensitivity",
      icon: "shield-half-outline",
    },
    {
      id: "Paranoid",
      name: "Paranoid",
      desc: "Maximum protection, may require tuning",
      icon: "shield-checkmark",
    },
  ];

  return (
    <View>
      <Text className="text-2xl font-bold text-text mb-2">WAF Ruleset</Text>
      <Text className="text-muted mb-6">
        Configure Web Application Firewall rules
      </Text>

      <View className="gap-3">
        {rulesets.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => onChange(r.id)}
            className={`p-5 rounded-2xl border ${
              value === r.id
                ? "bg-primary/10 border-primary"
                : "bg-surface border-border"
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`w-14 h-14 rounded-xl items-center justify-center mr-4 ${
                  value === r.id ? "bg-primary/20" : "bg-background"
                }`}
              >
                <Ionicons
                  name={r.icon as any}
                  size={28}
                  color={value === r.id ? COLORS.primary : COLORS.muted}
                />
              </View>
              <View className="flex-1">
                <Text className="text-text font-semibold text-lg">
                  {r.name}
                </Text>
                <Text className="text-muted text-sm mt-1">{r.desc}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Step 3: Rate Limit
function RateLimitStep({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const presets = [100, 500, 1000, 2500, 5000, 10000];

  return (
    <View>
      <Text className="text-2xl font-bold text-text mb-2">Rate Limiting</Text>
      <Text className="text-muted mb-6">
        Set maximum requests per minute per tenant
      </Text>

      {/* Current Value Display */}
      <View className="bg-surface rounded-2xl p-6 border border-border mb-6 items-center">
        <Text className="text-5xl font-bold text-primary">{value}</Text>
        <Text className="text-muted mt-2">requests / minute</Text>
      </View>

      {/* Preset Buttons */}
      <View className="flex-row flex-wrap gap-2 mb-6">
        {presets.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => onChange(preset)}
            className={`px-4 py-3 rounded-xl ${
              value === preset
                ? "bg-primary"
                : "bg-surface border border-border"
            }`}
          >
            <Text
              className={value === preset ? "text-white font-semibold" : "text-text"}
            >
              {preset.toLocaleString()}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Custom Input */}
      <View>
        <Text className="text-muted text-sm mb-2">Custom value</Text>
        <TextInput
          className="bg-surface border border-border rounded-xl px-4 py-3 text-text text-lg"
          keyboardType="numeric"
          value={String(value)}
          onChangeText={(t) => {
            const n = parseInt(t, 10);
            if (!isNaN(n) && n >= 100 && n <= 10000) {
              onChange(n);
            }
          }}
          placeholder="100 - 10,000"
          placeholderTextColor={COLORS.muted}
        />
      </View>
    </View>
  );
}

// Step 4: Bot Posture
function BotPostureStep({
  value,
  onChange,
}: {
  value: BotPosture;
  onChange: (v: BotPosture) => void;
}) {
  const postures: { id: BotPosture; name: string; desc: string }[] = [
    {
      id: "allow_verified",
      name: "Allow Verified",
      desc: "Allow known good bots (search engines, monitoring)",
    },
    {
      id: "block_all",
      name: "Block All",
      desc: "Block all automated traffic without exception",
    },
    {
      id: "custom",
      name: "Custom Whitelist",
      desc: "Define your own bot allowlist rules",
    },
  ];

  return (
    <View>
      <Text className="text-2xl font-bold text-text mb-2">Bot Posture</Text>
      <Text className="text-muted mb-6">
        Configure automated traffic handling
      </Text>

      <View className="gap-3">
        {postures.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            className={`p-4 rounded-2xl border flex-row items-center ${
              value === p.id
                ? "bg-primary/10 border-primary"
                : "bg-surface border-border"
            }`}
          >
            <View
              className={`w-5 h-5 rounded-full border-2 mr-4 items-center justify-center ${
                value === p.id ? "border-primary bg-primary" : "border-muted"
              }`}
            >
              {value === p.id && (
                <View className="w-2 h-2 rounded-full bg-white" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-text font-semibold">{p.name}</Text>
              <Text className="text-muted text-sm">{p.desc}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Step 5: Tenant Mode & Name
function TenantModeStep({
  config,
  onChange,
}: {
  config: DeployConfig;
  onChange: (updates: Partial<DeployConfig>) => void;
}) {
  return (
    <View>
      <Text className="text-2xl font-bold text-text mb-2">Tenant Mode</Text>
      <Text className="text-muted mb-6">
        Configure multi-tenancy and name your deployment
      </Text>

      {/* Tenant Mode Toggle */}
      <View className="flex-row gap-3 mb-6">
        <Pressable
          onPress={() => onChange({ tenantMode: "single" })}
          className={`flex-1 p-4 rounded-2xl border items-center ${
            config.tenantMode === "single"
              ? "bg-primary/10 border-primary"
              : "bg-surface border-border"
          }`}
        >
          <Ionicons
            name="person"
            size={32}
            color={
              config.tenantMode === "single" ? COLORS.primary : COLORS.muted
            }
          />
          <Text className="text-text font-semibold mt-2">Single Tenant</Text>
          <Text className="text-muted text-xs text-center mt-1">
            One isolated environment
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onChange({ tenantMode: "multi" })}
          className={`flex-1 p-4 rounded-2xl border items-center ${
            config.tenantMode === "multi"
              ? "bg-primary/10 border-primary"
              : "bg-surface border-border"
          }`}
        >
          <Ionicons
            name="people"
            size={32}
            color={
              config.tenantMode === "multi" ? COLORS.primary : COLORS.muted
            }
          />
          <Text className="text-text font-semibold mt-2">Multi-Tenant</Text>
          <Text className="text-muted text-xs text-center mt-1">
            Shared infrastructure
          </Text>
        </Pressable>
      </View>

      {/* Deployment Name */}
      <View>
        <Text className="text-muted text-sm mb-2">Deployment Name</Text>
        <TextInput
          className="bg-surface border border-border rounded-xl px-4 py-4 text-text text-lg"
          value={config.deploymentName}
          onChangeText={(t) => onChange({ deploymentName: t })}
          placeholder="e.g., prod-us-east-1"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
}

// Review Screen with YAML Preview
function ReviewStep({
  config,
  onDeploy,
  isDeploying,
}: {
  config: DeployConfig;
  onDeploy: () => void;
  isDeploying: boolean;
}) {
  const yaml = `apiVersion: mcp.ellis-aegis.us/v1
kind: SecurityDeployment
metadata:
  name: ${config.deploymentName || "unnamed-deployment"}
spec:
  compliance:
    framework: ${config.complianceTarget}
  waf:
    ruleset: ${config.wafRuleset.toLowerCase()}
  rateLimit:
    requestsPerMinute: ${config.rateLimit}
  botManagement:
    posture: ${config.botPosture}
  tenancy:
    mode: ${config.tenantMode}
`;

  return (
    <View>
      <Text className="text-2xl font-bold text-text mb-2">Review & Deploy</Text>
      <Text className="text-muted mb-6">
        Confirm your deployment configuration
      </Text>

      {/* YAML Preview */}
      <View className="bg-surface rounded-2xl border border-border overflow-hidden mb-6">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-muted text-sm">manifest.yaml</Text>
          <Ionicons name="code-slash" size={16} color={COLORS.muted} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="p-4"
        >
          <Text className="text-accent font-mono text-sm">{yaml}</Text>
        </ScrollView>
      </View>

      {/* Summary Cards */}
      <View className="flex-row flex-wrap gap-2 mb-6">
        <View className="bg-surface px-3 py-2 rounded-lg border border-border">
          <Text className="text-muted text-xs">Compliance</Text>
          <Text className="text-text font-semibold">
            {config.complianceTarget}
          </Text>
        </View>
        <View className="bg-surface px-3 py-2 rounded-lg border border-border">
          <Text className="text-muted text-xs">WAF</Text>
          <Text className="text-text font-semibold">{config.wafRuleset}</Text>
        </View>
        <View className="bg-surface px-3 py-2 rounded-lg border border-border">
          <Text className="text-muted text-xs">Rate Limit</Text>
          <Text className="text-text font-semibold">
            {config.rateLimit}/min
          </Text>
        </View>
        <View className="bg-surface px-3 py-2 rounded-lg border border-border">
          <Text className="text-muted text-xs">Bot</Text>
          <Text className="text-text font-semibold capitalize">
            {config.botPosture.replace("_", " ")}
          </Text>
        </View>
        <View className="bg-surface px-3 py-2 rounded-lg border border-border">
          <Text className="text-muted text-xs">Tenancy</Text>
          <Text className="text-text font-semibold capitalize">
            {config.tenantMode}
          </Text>
        </View>
      </View>

      {/* Deploy Button */}
      <Pressable
        onPress={onDeploy}
        disabled={isDeploying || !config.deploymentName}
        className={`py-4 rounded-xl items-center ${
          isDeploying || !config.deploymentName
            ? "bg-primary/50"
            : "bg-primary"
        }`}
      >
        {isDeploying ? (
          <View className="flex-row items-center">
            <ActivityIndicator color="#fff" size="small" />
            <Text className="text-white font-semibold ml-2">Deploying...</Text>
          </View>
        ) : (
          <View className="flex-row items-center">
            <Ionicons name="rocket" size={20} color="#fff" />
            <Text className="text-white font-semibold ml-2">
              Deploy to Cloudflare
            </Text>
          </View>
        )}
      </Pressable>

      {!config.deploymentName && (
        <Text className="text-warning text-sm text-center mt-3">
          Please enter a deployment name
        </Text>
      )}
    </View>
  );
}

// Deployment Status Modal
function DeploymentStatusModal({
  visible,
  status,
  onClose,
}: {
  visible: boolean;
  status: "polling" | "success" | "error";
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/80 items-center justify-center px-6">
        <View className="bg-surface rounded-2xl p-6 w-full max-w-sm border border-border">
          {status === "polling" && (
            <>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text className="text-text font-semibold text-lg text-center mt-4">
                Deploying...
              </Text>
              <Text className="text-muted text-center mt-2">
                Provisioning Cloudflare Worker
              </Text>
            </>
          )}

          {status === "success" && (
            <>
              <View className="w-16 h-16 bg-success/20 rounded-full items-center justify-center self-center">
                <Ionicons name="checkmark" size={40} color={COLORS.success} />
              </View>
              <Text className="text-text font-semibold text-lg text-center mt-4">
                Deployment Successful
              </Text>
              <Text className="text-muted text-center mt-2">
                Your security layer is now active
              </Text>
              <Pressable
                onPress={onClose}
                className="bg-primary py-3 rounded-xl mt-6"
              >
                <Text className="text-white font-semibold text-center">
                  Done
                </Text>
              </Pressable>
            </>
          )}

          {status === "error" && (
            <>
              <View className="w-16 h-16 bg-danger/20 rounded-full items-center justify-center self-center">
                <Ionicons name="close" size={40} color={COLORS.danger} />
              </View>
              <Text className="text-text font-semibold text-lg text-center mt-4">
                Deployment Failed
              </Text>
              <Text className="text-muted text-center mt-2">
                Check logs for details
              </Text>
              <Pressable
                onPress={onClose}
                className="bg-surface border border-border py-3 rounded-xl mt-6"
              >
                <Text className="text-text font-semibold text-center">
                  Close
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Main Deploy Screen
export default function DeployScreen() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<DeployConfig>(initialConfig);
  const [modalVisible, setModalVisible] = useState(false);
  const [deployStatus, setDeployStatus] = useState<
    "polling" | "success" | "error"
  >("polling");

  const deployMutation = useMutation({
    mutationFn: () =>
      createChangeRequest({
        type: "deployment",
        name: config.deploymentName,
        compliance: config.complianceTarget,
        waf: config.wafRuleset,
        rateLimit: config.rateLimit,
        botPosture: config.botPosture,
        tenantMode: config.tenantMode,
      }),
    onSuccess: () => {
      // Start polling
      pollDeployment();
    },
    onError: () => {
      setDeployStatus("error");
    },
  });

  const { refetch: pollHealth } = useQuery({
    queryKey: ["deployHealth"],
    queryFn: getHealth,
    enabled: false,
  });

  async function pollDeployment() {
    setModalVisible(true);
    setDeployStatus("polling");

    // Poll 5 times, 3 seconds apart
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        await pollHealth();
      } catch {
        // Continue polling
      }
    }

    // Simulate success after polling
    setDeployStatus("success");
  }

  function handleDeploy() {
    deployMutation.mutate();
  }

  function updateConfig(updates: Partial<DeployConfig>) {
    setConfig((prev) => ({ ...prev, ...updates }));
  }

  const steps = [
    <ComplianceStep
      key="compliance"
      value={config.complianceTarget}
      onChange={(v) => updateConfig({ complianceTarget: v })}
    />,
    <WAFStep
      key="waf"
      value={config.wafRuleset}
      onChange={(v) => updateConfig({ wafRuleset: v })}
    />,
    <RateLimitStep
      key="rate"
      value={config.rateLimit}
      onChange={(v) => updateConfig({ rateLimit: v })}
    />,
    <BotPostureStep
      key="bot"
      value={config.botPosture}
      onChange={(v) => updateConfig({ botPosture: v })}
    />,
    <TenantModeStep key="tenant" config={config} onChange={updateConfig} />,
    <ReviewStep
      key="review"
      config={config}
      onDeploy={handleDeploy}
      isDeploying={deployMutation.isPending}
    />,
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-4 py-4 border-b border-border">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-text">Deploy Wizard</Text>
          <Text className="text-muted">
            Step {step + 1} of {steps.length}
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="h-1 bg-surface rounded-full mt-3 overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-6"
        keyboardShouldPersistTaps="handled"
      >
        {steps[step]}
      </ScrollView>

      {/* Navigation */}
      <View className="px-4 py-4 border-t border-border flex-row gap-3">
        {step > 0 && (
          <Pressable
            onPress={() => setStep((s) => s - 1)}
            className="flex-1 py-4 rounded-xl bg-surface border border-border items-center"
          >
            <Text className="text-text font-semibold">Back</Text>
          </Pressable>
        )}

        {step < steps.length - 1 && (
          <Pressable
            onPress={() => setStep((s) => s + 1)}
            className="flex-1 py-4 rounded-xl bg-primary items-center"
          >
            <Text className="text-white font-semibold">Continue</Text>
          </Pressable>
        )}
      </View>

      {/* Deployment Status Modal */}
      <DeploymentStatusModal
        visible={modalVisible}
        status={deployStatus}
        onClose={() => {
          setModalVisible(false);
          if (deployStatus === "success") {
            setStep(0);
            setConfig(initialConfig);
          }
        }}
      />
    </SafeAreaView>
  );
}
