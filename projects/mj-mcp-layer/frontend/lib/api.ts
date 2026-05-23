import { ENDPOINTS } from "@/constants/config";
import { getConfig } from "@/constants/storage";

export interface HealthService {
  name: string;
  status: "up" | "down" | "degraded";
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version?: string;
  services?: HealthService[];
}

export interface MCPConnection {
  id: string;
  name: string;
  provider: string;
  status: "connected" | "disconnected" | "degraded";
}

export interface DriftStatus {
  status: "clean" | "drift" | "drifted";
  lastScan: string;
  driftCount: number;
}

export interface ComplianceControl {
  id: string;
  name: string;
  status: "pass" | "partial" | "fail";
}

export interface ComplianceScore {
  framework: string;
  status: "pass" | "partial" | "fail";
  score: number;
  controls: ComplianceControl[];
}

export interface Tenant {
  id: string;
  name: string;
  status: "active" | "suspended" | "pending";
  rateLimit: number;
  capabilities: string[];
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  event: string;
  timestamp: string;
  details: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
}

export interface ChangeRequest {
  id: string;
  type: string;
  description: string;
  status: "pending" | "approved" | "denied";
  requestedBy: string;
  requestedAt: string;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token, mcpBaseUrl } = await getConfig();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("x-ellis-aegis-token", token);
  }

  const response = await fetch(`${mcpBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${path}`);
  }
  return (await response.json()) as T;
}

function listFromPayload<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    for (const key of keys) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

export async function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>(ENDPOINTS.HEALTHZ);
}

export async function getMCPConnections(): Promise<MCPConnection[]> {
  const payload = await requestJson<unknown>(ENDPOINTS.CONNECTIONS);
  return listFromPayload<MCPConnection>(payload, ["connections", "items", "result"]);
}

export async function getDriftStatus(): Promise<DriftStatus> {
  return requestJson<DriftStatus>(ENDPOINTS.DRIFT_STATUS);
}

export async function triggerDriftScan(): Promise<DriftStatus> {
  return requestJson<DriftStatus>(ENDPOINTS.DRIFT_SCAN, { method: "POST" });
}

export async function getComplianceScores(): Promise<ComplianceScore[]> {
  const payload = await requestJson<unknown>(ENDPOINTS.COMPLIANCE);
  return listFromPayload<ComplianceScore>(payload, ["scores", "frameworks", "items", "result"]);
}

export async function getTenants(): Promise<Tenant[]> {
  const payload = await requestJson<unknown>(ENDPOINTS.TENANTS);
  return listFromPayload<Tenant>(payload, ["tenants", "items", "result"]);
}

export async function getAuditEvents(filters?: { tenantId?: string }): Promise<AuditEvent[]> {
  const query = filters?.tenantId ? `?tenantId=${encodeURIComponent(filters.tenantId)}` : "";
  const payload = await requestJson<unknown>(`${ENDPOINTS.AUDIT_EVENTS}${query}`);
  return listFromPayload<AuditEvent>(payload, ["events", "items", "result"]);
}

export async function getChangeRequests(): Promise<ChangeRequest[]> {
  const payload = await requestJson<unknown>(ENDPOINTS.CHANGE_REQUESTS);
  return listFromPayload<ChangeRequest>(payload, ["requests", "items", "result"]);
}

export async function createChangeRequest(payload: Record<string, unknown>): Promise<ChangeRequest> {
  return requestJson<ChangeRequest>(ENDPOINTS.CHANGE_REQUESTS, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approveChangeRequest(id: string): Promise<ChangeRequest> {
  return requestJson<ChangeRequest>(`${ENDPOINTS.CHANGE_REQUESTS}/${encodeURIComponent(id)}/approve`, {
    method: "POST",
  });
}

export async function denyChangeRequest(id: string): Promise<ChangeRequest> {
  return requestJson<ChangeRequest>(`${ENDPOINTS.CHANGE_REQUESTS}/${encodeURIComponent(id)}/deny`, {
    method: "POST",
  });
}
