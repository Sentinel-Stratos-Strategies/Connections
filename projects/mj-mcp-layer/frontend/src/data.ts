import {
  Activity,
  ArrowUpCircle,
  BadgeDollarSign,
  BarChart2,
  Bell,
  Cloud,
  Code2,
  Cpu,
  CreditCard,
  Download,
  Eye,
  FileClock,
  FileText,
  GitBranch,
  Globe2,
  KeyRound,
  Layers,
  Lock,
  MessageCircle,
  Network,
  PauseCircle,
  PlusCircle,
  Radar,
  Rocket,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  ToggleLeft,
  UserCheck,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Accent = "amber" | "cobalt" | "coral" | "rose" | "sky" | "teal" | "violet";

export interface CommandItem {
  accent: Accent;
  command: string;
  hint: string;
  icon: LucideIcon;
}

export interface CommandGroup {
  accent: Accent;
  items: CommandItem[];
  title: string;
}

export const systemCards = [
  { accent: "teal", label: "Domain Auth", value: "Cloudflare", state: "anchored", icon: Cloud },
  { accent: "coral", label: "MJ Orchestrator", value: "Cloud Shell", state: "active", icon: TerminalSquare },
  { accent: "amber", label: "Financial Gate", value: "Stripe", state: "wiring", icon: BadgeDollarSign },
  { accent: "violet", label: "Evidence Ledger", value: "Recording", state: "recording", icon: FileClock },
  { accent: "cobalt", label: "Runtime Verifier", value: "Watching", state: "watching", icon: Activity },
  { accent: "rose", label: "Active Lanes", value: "34", state: "online", icon: Users },
] as const;

export const adminMetrics = [
  { accent: "coral", delta: "GitHub Actions + Workers", label: "Deploy Gate", value: "green" },
  { accent: "teal", delta: "mcp + mj health checks", label: "Edge Health", value: "200" },
  { accent: "violet", delta: "Console connectors mapped", label: "Mini Lanes", value: "34" },
  { accent: "amber", delta: "Manual approval for mutations", label: "Policy Mode", value: "deny" },
] as const;

export const adminCommandGroups: CommandGroup[] = [
  {
    accent: "coral",
    title: "Orchestrate",
    items: [
      { accent: "coral", command: "Open MJ cloud shell", hint: "Play-calling language", icon: TerminalSquare },
      { accent: "coral", command: "Create change request", hint: "Route intent to lane", icon: Workflow },
      { accent: "coral", command: "Dispatch provider plan", hint: "Cloudflare, GitHub, local", icon: Network },
      { accent: "coral", command: "Queue deployment", hint: "Staged rollout", icon: GitBranch },
      { accent: "coral", command: "Rollback release", hint: "Instant revert", icon: RotateCcw },
    ],
  },
  {
    accent: "teal",
    title: "Defend",
    items: [
      { accent: "teal", command: "Run runtime verification", hint: "Referee checks", icon: ShieldCheck },
      { accent: "teal", command: "Scan drift", hint: "Watch the court", icon: Radar },
      { accent: "teal", command: "Mint capability visa", hint: "Temporary permission", icon: KeyRound },
      { accent: "teal", command: "Audit anomaly log", hint: "Flag + triage", icon: Eye },
      { accent: "teal", command: "Push WAF rule", hint: "Firewall enforcement", icon: ShieldAlert },
    ],
  },
  {
    accent: "violet",
    title: "Productize",
    items: [
      { accent: "violet", command: "Open billing gate", hint: "Stripe + kill switch", icon: BadgeDollarSign },
      { accent: "violet", command: "Provision custom domain", hint: "CNAME + TLS state", icon: Globe2 },
      { accent: "violet", command: "Inspect tenant workload", hint: "Dispatch namespace", icon: Cpu },
      { accent: "violet", command: "Toggle feature flag", hint: "Canary or kill", icon: ToggleLeft },
      { accent: "violet", command: "Update pricing plan", hint: "Tier management", icon: Layers },
    ],
  },
  {
    accent: "amber",
    title: "Tenant Ops",
    items: [
      { accent: "amber", command: "Create tenant", hint: "Isolated + scoped", icon: PlusCircle },
      { accent: "amber", command: "Suspend tenant", hint: "Billing or violation", icon: PauseCircle },
      { accent: "amber", command: "Export tenant data", hint: "Approval required", icon: Download },
      { accent: "amber", command: "Usage report", hint: "API + bandwidth", icon: BarChart2 },
      { accent: "amber", command: "Impersonate tenant", hint: "Debug as customer", icon: UserCheck },
    ],
  },
];

export const customerCommandGroups: CommandGroup[] = [
  {
    accent: "coral",
    title: "My Project",
    items: [
      { accent: "coral", command: "Open project shell", hint: "Your workspace", icon: TerminalSquare },
      { accent: "coral", command: "Deploy latest build", hint: "Push to production", icon: Rocket },
      { accent: "coral", command: "Rollback build", hint: "Instant revert", icon: RotateCcw },
      { accent: "coral", command: "Manage domain", hint: "CNAME + TLS", icon: Globe2 },
      { accent: "coral", command: "Edit env variables", hint: "Secrets + config", icon: Lock },
    ],
  },
  {
    accent: "violet",
    title: "Integrations",
    items: [
      { accent: "violet", command: "Stripe connection", hint: "Payments + billing", icon: BadgeDollarSign },
      { accent: "violet", command: "Webhook manager", hint: "Events + delivery logs", icon: Zap },
      { accent: "violet", command: "OAuth apps", hint: "Third-party access", icon: KeyRound },
      { accent: "violet", command: "Manage API keys", hint: "Create + revoke", icon: Code2 },
      { accent: "violet", command: "Notification hooks", hint: "Slack, email, SMS", icon: Bell },
    ],
  },
  {
    accent: "teal",
    title: "Support & Billing",
    items: [
      { accent: "teal", command: "Open support ticket", hint: "Priority response", icon: MessageCircle },
      { accent: "teal", command: "View system status", hint: "Uptime + incidents", icon: Activity },
      { accent: "teal", command: "Check usage", hint: "API + bandwidth", icon: BarChart2 },
      { accent: "teal", command: "Billing & invoices", hint: "Manage subscription", icon: CreditCard },
      { accent: "teal", command: "Upgrade plan", hint: "Unlock capacity", icon: ArrowUpCircle },
    ],
  },
];

export const tenants = [
  { api: "18.4k", domain: "hitch.guru", mrr: "$1,200", name: "Hitch", plan: "Enterprise", status: "active" },
  { api: "41.2k", domain: "ellis-aegis.us", mrr: "$2,400", name: "Ellis Aegis Core", plan: "Enterprise", status: "active" },
  { api: "3.1k", domain: "kevis.online", mrr: "$480", name: "Kevis", plan: "Pro", status: "watching" },
  { api: "890", domain: "codex.ellis-aegis.us", mrr: "$120", name: "Codex Lane", plan: "Internal", status: "building" },
  { api: "120", domain: "mcp.ellis-aegis.us", mrr: "$0", name: "MJ Sandbox", plan: "Trial", status: "trial" },
] as const;

export const activityFeed = [
  { accent: "teal", subtitle: "Domain Authority · TLS issued", text: "Cloudflare routes healthy for mcp.ellis-aegis.us", time: "2m ago" },
  { accent: "coral", subtitle: "GitHub Actions · proof gate", text: "MJ Layer deploy workflow passed on enterprise branch", time: "7m ago" },
  { accent: "violet", subtitle: "Console Mesh · connector registry", text: "Mini lanes mapped into main MJ MCP contract", time: "14m ago" },
  { accent: "amber", subtitle: "Productize · roadmap gate", text: "Stripe billing gate remains approval-gated", time: "31m ago" },
  { accent: "rose", subtitle: "Defend · edge enforcement", text: "WAF hardening and drift scan artifacts retained", time: "44m ago" },
  { accent: "teal", subtitle: "Defend · policy", text: "Capability visa and approval gates active", time: "58m ago" },
] as const;

export const quickAccess = [
  {
    subtitle: "Manage builds, rollbacks, and production releases.",
    title: "Deployments",
    rows: [
      { accent: "teal", label: "Deployment history", sub: "Last 30 deploys", icon: FileClock },
      { accent: "cobalt", label: "Build logs", sub: "Full output stream", icon: FileText },
      { accent: "coral", label: "Rollback to previous", sub: "Instant revert", icon: RotateCcw },
    ],
  },
  {
    subtitle: "Connect your tools, webhooks, OAuth, and APIs.",
    title: "Integrations",
    rows: [
      { accent: "violet", label: "Stripe connection", sub: "Payments + billing", icon: BadgeDollarSign },
      { accent: "amber", label: "Webhook manager", sub: "Events + delivery logs", icon: Zap },
      { accent: "rose", label: "API key manager", sub: "Create + revoke tokens", icon: Code2 },
    ],
  },
] as const;
