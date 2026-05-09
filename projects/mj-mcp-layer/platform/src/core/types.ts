export type ISO8601 = string;
export type SHA256 = string;
export type UUID = string;
export type ProviderName = "cloudflare" | "aws" | "kubernetes" | "terraform";

export interface LedgerEntry {
  ts: ISO8601;
  intent: string;
  provider: ProviderName;
  hash: SHA256;
  changeId: UUID;
  source: "bootstrap" | "api" | "schedule" | "operator" | "automation";
  payload: Record<string, unknown>;
  result: "success" | "failure";
  error?: string;
}

export interface SignedEntry {
  entry: LedgerEntry;
  signature: string;
}

export interface InventorySnapshot {
  provider: ProviderName;
  timestamp: ISO8601;
  resources: Record<string, unknown>;
  denyByDefault?: boolean;
  auditImmutable?: boolean;
  rateLimit?: { enabled: boolean };
  mfaRequired?: boolean;
  encryptAtRest?: boolean;
  encryptInTransit?: boolean;
}

export interface HealthStatus {
  ok: boolean;
  latency: number;
  errors?: string[];
  details?: Record<string, unknown>;
}

export interface AccessValidation {
  ok: boolean;
  errors?: string[];
  permissions?: string[];
}

export interface SecurityPolicy {
  version: number;
  name: string;
  targetProviders: ProviderName[];
  zones: ZoneConfig[];
  securityDefaults: SecurityDefaults;
  policies: PolicySet;
  rbac: RBACConfig;
  audit: AuditConfig;
}

export interface ZoneConfig {
  name: string;
  cloudflare?: { domains: string[] };
  aws?: { regions: string[]; vpcIds: string[] };
  kubernetes?: { clusters: string[] };
}

export interface SecurityDefaults {
  denyByDefault: boolean;
  requiredHeaders: string[];
}

export interface PolicySet {
  waf: { rules: WafRule[] };
  rateLimit: { rules: RateLimitRule[] };
}

export interface WafRule {
  name: string;
  expression: string;
  awsExpression?: string;
  k8sSelector?: string;
  action: string;
}

export interface RateLimitRule {
  name: string;
  requests: number;
  period: number;
  action: string;
}

export interface RBACConfig {
  tenants: TenantConfig[];
}

export interface TenantConfig {
  id: string;
  capabilities: string[];
  rateLimit: string;
}

export interface AuditConfig {
  enabled: boolean;
  retention: string;
  immutable: boolean;
}

export interface ChangeRequest {
  id: UUID;
  name: string;
  targetProviders: ProviderName[];
  policy: SecurityPolicy;
  requester: string;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  createdAt: ISO8601;
}

export interface ExecutionReport {
  timestamp: ISO8601;
  results: Record<string, ProviderResult>;
  ledgerEntries: LedgerEntry[];
}

export interface ProviderResult {
  status: "success" | "failed";
  changeId?: string;
  changes?: number;
  reason?: string;
}

export interface DriftReport {
  provider: ProviderName;
  timestamp: ISO8601;
  unauthorizedChanges: DriftChange[];
  severity: "ok" | "low" | "medium" | "high";
}

export interface DriftChange {
  resource: string;
  type: "added" | "modified" | "removed";
  current: unknown;
  expected: unknown;
}

export interface ComplianceReport {
  timestamp: ISO8601;
  providers: Record<string, ComplianceResult>;
  overallScore: number;
}

export interface ComplianceResult {
  score: number;
  results: ComplianceCheck[];
  status: "compliant" | "non-compliant";
}

export interface ComplianceCheck {
  name: string;
  passed: boolean;
}

export interface HealthReport {
  timestamp: ISO8601;
  providers: Record<string, ProviderHealth>;
  overallStatus: "healthy" | "degraded" | "unhealthy";
}

export interface ProviderHealth {
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  lastChecked: ISO8601;
  errors: string[];
}

export interface Alert {
  severity: "low" | "medium" | "high" | "critical";
  provider?: string;
  title?: string;
  message?: string;
  changes?: DriftChange[];
  suggestedAction?: string;
  report?: unknown;
}
