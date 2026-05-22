// API Configuration
// All endpoints are configurable - operators can point to their own MCP instance

export const DEFAULT_MCP_BASE_URL = "https://mcp.ellis-aegis.us";
export const DEFAULT_SHELL_URL = "wss://mcp.ellis-aegis.us/shell";

// Storage keys
export const STORAGE_KEYS = {
  TOKEN: "operator_token",
  MCP_BASE_URL: "mcp_base_url",
  SHELL_URL: "shell_url",
} as const;

// API Endpoints
export const ENDPOINTS = {
  HEALTHZ: "/healthz",
  TENANTS: "/api/tenants",
  AUDIT_EVENTS: "/audit/events",
  DRIFT_SCAN: "/api/drift/scan",
  DRIFT_STATUS: "/api/drift/status",
  COMPLIANCE: "/api/compliance",
  CONNECTIONS: "/api/connections",
  CHANGE_REQUESTS: "/api/change-request",
} as const;

// Color palette
export const COLORS = {
  background: "#0A0A0F",
  surface: "#13131A",
  border: "#1E1E2E",
  primary: "#6C63FF",
  accent: "#00D4FF",
  success: "#00FF94",
  warning: "#FFB800",
  danger: "#FF4757",
  text: "#E8E8F0",
  muted: "#6B6B8A",
} as const;

// Quick commands for console
export const QUICK_COMMANDS = [
  { label: "Health Check All", command: "mcp health --all" },
  { label: "Drift Scan CF", command: "mcp drift scan --provider cloudflare" },
  { label: "Compliance JSON", command: "mcp compliance check --format json" },
  { label: "Policy Dry Run", command: "mcp policy apply --dry-run" },
  { label: "Ledger Query", command: "mcp ledger query --last 100" },
] as const;
