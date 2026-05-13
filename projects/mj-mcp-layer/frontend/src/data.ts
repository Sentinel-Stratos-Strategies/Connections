import {
  Activity,
  BadgeDollarSign,
  Cloud,
  Cpu,
  FileClock,
  Globe2,
  KeyRound,
  Network,
  Radar,
  ShieldCheck,
  TerminalSquare,
  Workflow,
} from "lucide-react";

export const commandGroups = [
  {
    title: "Orchestrate",
    items: [
      { icon: TerminalSquare, command: "Open MJ cloud shell", hint: "Play-calling language" },
      { icon: Workflow, command: "Create change request", hint: "Route intent to lane" },
      { icon: Network, command: "Dispatch provider plan", hint: "Cloudflare, AWS, K8s" },
    ],
  },
  {
    title: "Defend",
    items: [
      { icon: ShieldCheck, command: "Run runtime verification", hint: "Referee checks" },
      { icon: Radar, command: "Scan drift", hint: "Watch the court" },
      { icon: KeyRound, command: "Mint capability visa", hint: "Temporary permission" },
    ],
  },
  {
    title: "Productize",
    items: [
      { icon: BadgeDollarSign, command: "Open billing gate", hint: "Stripe + kill switch" },
      { icon: Globe2, command: "Provision custom domain", hint: "CNAME + TLS state" },
      { icon: Cpu, command: "Inspect tenant workload", hint: "Dispatch namespace" },
    ],
  },
];

export const systemCards = [
  { label: "Domain Authority", value: "Cloudflare", state: "anchored", icon: Cloud },
  { label: "MJ Orchestrator", value: "Cloud Shell", state: "active", icon: TerminalSquare },
  { label: "Financial Gate", value: "Not wired", state: "missing", icon: BadgeDollarSign },
  { label: "Evidence", value: "Ledger", state: "recording", icon: FileClock },
  { label: "Runtime", value: "Verifier", state: "watching", icon: Activity },
];
