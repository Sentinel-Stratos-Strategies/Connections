import { CheckCircle2, ChevronRight, ClipboardCheck, ExternalLink, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  activityFeed,
  adminCommandGroups,
  adminMetrics,
  customerCommandGroups,
  quickAccess,
  systemCards,
  tenants,
} from "./data";
import type { Accent, CommandGroup } from "./data";

type View = "admin" | "customer";
type SurfaceSource = "admin-command" | "customer-command" | "tenant" | "quick-access" | "onboarding";

interface ActiveSurface {
  accent: Accent;
  details: string[];
  endpoint?: string;
  eyebrow: string;
  id: string;
  meta: { label: string; value: string }[];
  next: string[];
  status: string;
  summary: string;
  title: string;
}

const commandSurfaces: Record<string, Partial<ActiveSurface>> = {
  "Open MJ cloud shell": {
    accent: "coral",
    details: ["Route /mcp is active", "Commands stage as change requests", "Operator capability is required for mutation paths"],
    endpoint: "https://mcp.ellis-aegis.us/mcp",
    eyebrow: "MJ Cloud Shell",
    next: ["Draft intent", "Classify capability", "Submit for approval"],
    status: "Session ready",
    summary: "The governed cloud-shell surface is open in operator mode. Nothing mutates production until the lane policy and approval gate pass.",
    title: "MJ Cloud Shell Session",
  },
  "Create change request": {
    accent: "coral",
    details: ["Intent compiler ready", "Ledger receipt required", "Rollback reference required before apply"],
    endpoint: "https://mcp.ellis-aegis.us/api/change-request",
    eyebrow: "Delivery Airlock",
    next: ["Write intent", "Attach evidence", "Request approval"],
    status: "Drafting",
    summary: "A change request workspace is staged for policy review, evidence capture, and rollback planning.",
    title: "Change Request Builder",
  },
  "Dispatch provider plan": {
    accent: "coral",
    details: ["Cloudflare lane available", "GitHub lane available", "Local lane remains approval-gated"],
    eyebrow: "Provider Mesh",
    next: ["Select lane", "Run provider diff", "Collect receipt"],
    status: "Planning",
    summary: "Provider dispatch is staged through the MJ router so each lane stays scoped to its own authority.",
    title: "Provider Plan Dispatch",
  },
  "Queue deployment": {
    accent: "coral",
    details: ["GitHub Actions deploy gate", "Wrangler dry-run before deploy", "Smoke test required after deploy"],
    endpoint: "https://github.com/Sentinel-Stratos-Strategies/Connections/actions/workflows/mj-layer-deploy.yml",
    eyebrow: "Release Gate",
    next: ["Confirm branch", "Run deploy workflow", "Upload deployment manifest"],
    status: "Ready to queue",
    summary: "The deployment queue opens the manual workflow path and keeps production release proof attached to the branch.",
    title: "Deployment Queue",
  },
  "Rollback release": {
    accent: "coral",
    details: ["Previous Worker version retained", "Clean-state verification required", "Rollback receipt written to evidence bundle"],
    eyebrow: "Release Recovery",
    next: ["Select release", "Verify rollback target", "Run smoke checks"],
    status: "Awaiting target",
    summary: "Rollback controls are staged for a verified release revert with a post-rollback smoke check.",
    title: "Rollback Console",
  },
  "Run runtime verification": {
    accent: "teal",
    details: ["Runtime proof checks policy headers", "Mutation tests remain isolated", "Verifier receipts are retained"],
    eyebrow: "Runtime Proof",
    next: ["Run verifier", "Review receipts", "Attach to ledger"],
    status: "Verifier ready",
    summary: "Runtime verification opens the referee path for proving that lane behavior still matches policy.",
    title: "Runtime Verification",
  },
  "Scan drift": {
    accent: "teal",
    details: ["Cloudflare config diff", "Manifest alignment check", "No automatic remediation without approval"],
    eyebrow: "Drift Immunity",
    next: ["Run scan", "Classify drift", "Open remediation request"],
    status: "Scanner ready",
    summary: "Drift scanning compares current infrastructure against the MJ manifests and evidence ledger.",
    title: "Drift Scanner",
  },
  "Mint capability visa": {
    accent: "teal",
    details: ["Tenant, lane, capability, and expiry required", "Tamper checks enforced", "Critical actions require approval"],
    eyebrow: "Capability Control",
    next: ["Select actor", "Set expiry", "Sign visa"],
    status: "Visa draft",
    summary: "Capability visa issuance opens a scoped permission draft for temporary, auditable access.",
    title: "Capability Visa Mint",
  },
  "Audit anomaly log": {
    accent: "teal",
    details: ["Ledger hash chain inspected", "Anomaly event classification", "Support timeline retained"],
    eyebrow: "Evidence Ledger",
    next: ["Filter events", "Classify anomaly", "Create incident"],
    status: "Audit open",
    summary: "The anomaly log opens ledger-backed review for suspicious runtime or infrastructure events.",
    title: "Audit Anomaly Review",
  },
  "Push WAF rule": {
    accent: "teal",
    details: ["Ruleset change requires approval", "Canary proof before production", "Rollback plan required"],
    eyebrow: "Cloudflare Defense",
    next: ["Draft rule", "Run canary", "Verify clean rollback"],
    status: "Approval required",
    summary: "WAF rule changes are staged through the hardening lane so the edge does not drift from policy.",
    title: "WAF Rule Control",
  },
  "Open billing gate": {
    accent: "violet",
    details: ["Stripe integration is roadmap-gated", "402 kill switch model tracked", "No billing mutation runs from this dashboard yet"],
    eyebrow: "Financial Gate",
    next: ["Confirm Stripe secrets", "Wire webhook idempotency", "Add FinOps circuit breaker"],
    status: "Wiring",
    summary: "Billing controls open the productization lane for subscription state, payment enforcement, and kill-switch wiring.",
    title: "Billing Gate",
  },
  "Provision custom domain": {
    accent: "violet",
    details: ["CNAME validation required", "TLS state must be active", "Public app routes stay isolated"],
    eyebrow: "Domain Lifecycle",
    next: ["Enter hostname", "Verify CNAME", "Bind route"],
    status: "Pending hostname",
    summary: "Domain provisioning opens the Cloudflare custom-hostname lane for tenant route and certificate setup.",
    title: "Custom Domain Provisioning",
  },
  "Inspect tenant workload": {
    accent: "violet",
    details: ["Dispatch namespace model tracked", "Workload isolation proof required", "Support telemetry still dashboard-roadmap"],
    eyebrow: "Tenant Runtime",
    next: ["Select tenant", "Review limits", "Inspect workload logs"],
    status: "Awaiting tenant",
    summary: "Tenant workload inspection opens the productization path for isolated execution and operator support telemetry.",
    title: "Tenant Workload Inspector",
  },
  "Toggle feature flag": {
    accent: "violet",
    details: ["Flag updates require lane scope", "Critical flags require approval", "Audit event emitted after change"],
    eyebrow: "Feature Control",
    next: ["Choose flag", "Set rollout", "Record receipt"],
    status: "Flag console open",
    summary: "Feature flags are staged as governed configuration changes with rollout state and audit receipts.",
    title: "Feature Flag Console",
  },
  "Update pricing plan": {
    accent: "violet",
    details: ["Plan limits affect tenant budgets", "Billing sync must be idempotent", "Customer notification required"],
    eyebrow: "Pricing Ops",
    next: ["Select tier", "Validate limits", "Publish plan"],
    status: "Plan editor open",
    summary: "Pricing changes open a controlled plan editor for tier limits and customer-facing subscription state.",
    title: "Pricing Plan Editor",
  },
  "Create tenant": {
    accent: "amber",
    details: ["Tenant ID, domain, lane scope required", "Initial budget starts locked", "Domain routes remain disabled until verified"],
    eyebrow: "Tenant Ops",
    next: ["Create tenant draft", "Assign lane scope", "Verify domain"],
    status: "Draft ready",
    summary: "Tenant creation opens the onboarding lane with isolation, policy, and billing checkpoints.",
    title: "Tenant Creation",
  },
  "Suspend tenant": {
    accent: "amber",
    details: ["Compute gate blocks workload", "Network detach requires provider approval", "Support note required"],
    eyebrow: "Tenant Ops",
    next: ["Select tenant", "Choose reason", "Record suspension"],
    status: "Suspension review",
    summary: "Suspension controls stage a tenant lockout with evidence and support context.",
    title: "Tenant Suspension",
  },
  "Export tenant data": {
    accent: "amber",
    details: ["Data export is approval-only", "Truth writes remain blocked", "Receipt and retention policy required"],
    eyebrow: "Tenant Data",
    next: ["Select scope", "Request approval", "Generate export"],
    status: "Approval required",
    summary: "Data export opens a guarded evidence path for tenant-scoped export requests.",
    title: "Tenant Data Export",
  },
  "Usage report": {
    accent: "amber",
    details: ["API volume", "Bandwidth", "Budget status"],
    eyebrow: "Usage",
    next: ["Pick tenant", "Choose window", "Export report"],
    status: "Report ready",
    summary: "Usage reporting opens tenant consumption views for support, billing, and budget review.",
    title: "Usage Report",
  },
  "Impersonate tenant": {
    accent: "amber",
    details: ["Requires support approval", "Session is time-boxed", "All actions are recorded"],
    eyebrow: "Support Access",
    next: ["Choose tenant", "Request approval", "Start audited session"],
    status: "Approval required",
    summary: "Tenant impersonation opens an audited support session draft without granting live access until approved.",
    title: "Tenant Impersonation",
  },
};

export function App() {
  const [view, setView] = useState<View>("admin");
  const [toast, setToast] = useState("");
  const [activeSurface, setActiveSurface] = useState<ActiveSurface | null>(null);
  const [surfaceLog, setSurfaceLog] = useState<string[]>([]);

  function fire(message: string) {
    setToast(message);
    window.clearTimeout(Number(window.sessionStorage.getItem("mj-toast-timeout") ?? 0));
    const timeout = window.setTimeout(() => setToast(""), 2400);
    window.sessionStorage.setItem("mj-toast-timeout", String(timeout));
  }

  function stamp(message: string) {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${time} · ${message}`;
  }

  function openSurface(label: string, source: SurfaceSource, meta: Record<string, string> = {}) {
    const surface = buildSurface(label, source, meta);
    setActiveSurface(surface);
    setSurfaceLog([stamp(`${surface.title} opened`), stamp(surface.status)]);
    fire(`${surface.title} opened`);
  }

  function stageActiveSurface() {
    if (!activeSurface) return;
    setActiveSurface({ ...activeSurface, status: "Ready for approval" });
    setSurfaceLog((items) => [stamp("Request staged for approval"), ...items].slice(0, 5));
    fire("Request staged for approval");
  }

  function markActiveSurfaceReviewed() {
    if (!activeSurface) return;
    setActiveSurface({ ...activeSurface, status: "Review captured" });
    setSurfaceLog((items) => [stamp("Operator review captured"), ...items].slice(0, 5));
    fire("Operator review captured");
  }

  function openSurfaceEndpoint() {
    if (!activeSurface?.endpoint) return;
    window.open(activeSurface.endpoint, "_blank", "noopener,noreferrer");
    setSurfaceLog((items) => [stamp(`Endpoint opened: ${activeSurface.endpoint}`), ...items].slice(0, 5));
    fire("Endpoint opened");
  }

  return (
    <div className="app-bg">
      <main className="shell">
        <header className="topbar">
          <div className="mj-wrap">
            <div className="mj-mark" aria-hidden>
              <svg className="mj-rings" viewBox="0 0 72 72" fill="none">
                <rect x="3" y="3" width="66" height="66" rx="17" stroke="#FF6B6B" strokeWidth="2.2" strokeDasharray="4 2.5" opacity=".6" />
                <rect x="7" y="7" width="58" height="58" rx="14" stroke="#F72585" strokeWidth="1.8" opacity=".55" />
                <rect x="12" y="12" width="48" height="48" rx="11" stroke="#9B5DE5" strokeWidth="1.5" opacity=".5" />
                <rect x="17" y="17" width="38" height="38" rx="8" stroke="#3A86FF" strokeWidth="1.3" opacity=".45" />
                <rect x="22" y="22" width="28" height="28" rx="6" stroke="#06D6A0" strokeWidth="1.1" opacity=".5" />
              </svg>
              <span className="mj-initials">MJ</span>
            </div>
            <div className="mj-word">
              <span className="mj-edge">MJ Edge</span>
              <span className="mj-sub">Genesis OS · Command Layer</span>
            </div>
          </div>

          <div className="vtabs" role="tablist" aria-label="Dashboard views">
            <button className={`vtab ${view === "admin" ? "active" : ""}`} onClick={() => setView("admin")} type="button">
              Admin
            </button>
            <button className={`vtab ${view === "customer" ? "active" : ""}`} onClick={() => setView("customer")} type="button">
              Customer
            </button>
          </div>
        </header>

        <section className="hero">
          <div>
            <p className="eyebrow">Genesis OS — Command Layer</p>
            <h1 className="hero-h1">MJ Layer<br /><em>Command Center</em></h1>
            <p className="hero-lede">
              A governed cloud-shell cockpit for opening lanes, closing doors, dispatching providers, and proving every play across every tenant.
            </p>
          </div>
          <div className="live-pill"><span className="live-dot" />System Online</div>
        </section>

        <SectionLabel>System State</SectionLabel>
        <section className="sys-grid" aria-label="System state">
          {systemCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="sys-card" key={card.label}>
                <span className={`sc-icon ic-${card.accent}`}><Icon aria-hidden size={18} /></span>
                <div>
                  <span className="sc-lbl">{card.label}</span>
                  <strong className="sc-val">{card.value}</strong>
                </div>
                <span className={`pill p-${card.accent}`}>{card.state}</span>
              </article>
            );
          })}
        </section>

        {view === "admin" ? <AdminView openSurface={openSurface} /> : <CustomerView openSurface={openSurface} />}
      </main>
      <ActionSurface
        log={surfaceLog}
        onClose={() => setActiveSurface(null)}
        onEndpoint={openSurfaceEndpoint}
        onReview={markActiveSurfaceReviewed}
        onStage={stageActiveSurface}
        surface={activeSurface}
      />
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast ? `✓ ${toast}` : ""}
      </div>
    </div>
  );
}

function buildSurface(label: string, source: SurfaceSource, meta: Record<string, string>): ActiveSurface {
  if (source === "tenant") {
    return {
      accent: "cobalt",
      details: [
        `Domain route: ${meta.domain}`,
        `Plan: ${meta.plan}`,
        `Current workload status: ${meta.status}`,
        `Daily API volume: ${meta.api}`,
      ],
      endpoint: `https://${meta.domain}`,
      eyebrow: "Tenant Inspector",
      id: `tenant-${meta.name}`,
      meta: [
        { label: "Tenant", value: meta.name },
        { label: "MRR", value: meta.mrr },
        { label: "Source", value: "Admin roster" },
      ],
      next: ["Review route health", "Check budget status", "Open support timeline"],
      status: `${meta.status} · ${meta.plan}`,
      summary: `${meta.name} is open for operator inspection with domain, plan, usage, and support context attached.`,
      title: `${meta.name} Tenant Console`,
    };
  }

  if (source === "onboarding") {
    return {
      accent: "amber",
      details: ["Tenant draft required", "Domain verification required", "Initial lane scope starts locked", "Billing gate stays wiring-only until approved"],
      endpoint: "https://mcp.ellis-aegis.us/api/change-request",
      eyebrow: "Tenant Onboarding",
      id: "tenant-onboarding",
      meta: [
        { label: "Mode", value: "Draft" },
        { label: "Authority", value: "MJ MCP" },
        { label: "Approval", value: "Required" },
      ],
      next: ["Name tenant", "Bind lane scope", "Submit change request"],
      status: "Onboarding draft open",
      summary: "A new tenant onboarding workspace is open with route, policy, and deployment checks ready to be filled.",
      title: "Tenant Onboarding",
    };
  }

  if (source === "quick-access") {
    const fallbackAccent = meta.accent as Accent | undefined;
    return {
      accent: fallbackAccent ?? "teal",
      details: [`Workspace: ${meta.section}`, meta.subtitle ?? "Operational quick access", "Action opens inside the governed dashboard shell"],
      eyebrow: meta.section ?? "Quick Access",
      id: `quick-${label}`,
      meta: [
        { label: "Surface", value: label },
        { label: "Mode", value: "Customer workspace" },
        { label: "Scope", value: "Tenant-owned" },
      ],
      next: ["Review state", "Stage update", "Capture support note"],
      status: "Opened",
      summary: `${label} is open with the current workspace context and customer-safe controls.`,
      title: label,
    };
  }

  const catalog = commandSurfaces[label] ?? {};
  const isCustomer = source === "customer-command";
  const accent = catalog.accent ?? (isCustomer ? "teal" : "coral");
  return {
    accent,
    details: catalog.details ?? [isCustomer ? "Tenant-safe action" : "Operator action", "Policy scope checked", "Audit event ready"],
    endpoint: catalog.endpoint,
    eyebrow: catalog.eyebrow ?? (isCustomer ? "Customer Control" : "Operator Control"),
    id: `${source}-${label}`,
    meta: [
      { label: "Command", value: label },
      { label: "Source", value: isCustomer ? "Customer portal" : "Admin panel" },
      { label: "Guardrail", value: isCustomer ? "Tenant scoped" : "Operator gated" },
    ],
    next: catalog.next ?? ["Review context", "Stage request", "Capture receipt"],
    status: catalog.status ?? "Opened",
    summary: catalog.summary ?? `${label} opened inside the MJ command layer with the current policy context attached.`,
    title: catalog.title ?? label,
  };
}

function AdminView({ openSurface }: { openSurface: (label: string, source: SurfaceSource, meta?: Record<string, string>) => void }) {
  return (
    <div className="view-panel">
      <SectionLabel>Admin Metrics</SectionLabel>
      <div className="met-grid">
        {adminMetrics.map((metric) => (
          <article className="met-card" key={metric.label}>
            <span className={`met-num mn-${metric.accent}`}>{metric.value}</span>
            <span className="met-lbl">{metric.label}</span>
            <span className="met-delta">{metric.delta}</span>
          </article>
        ))}
      </div>

      <SectionLabel>Admin Command Palette</SectionLabel>
      <CommandPalette
        eyebrow="Admin Panel — Full Access"
        groups={adminCommandGroups}
        onAction={(command) => openSurface(command, "admin-command")}
        placeholder="Ask MJ to run the next safe play..."
        variant="admin"
      />

      <SectionLabel>Active Tenants</SectionLabel>
      <section className="tbl-wrap">
        <div className="tbl-hdr">
          <span className="tbl-ht">Tenant Roster</span>
          <button className="act-btn" onClick={() => openSurface("Tenant Onboarding", "onboarding")} type="button">+ Onboard Tenant</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Tenant</th><th>Domain</th><th>Plan</th><th>API / Day</th><th>MRR</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.name}>
                  <td>{tenant.name}</td>
                  <td className="td-dom">{tenant.domain}</td>
                  <td><span className={`tplan tp-${tenant.plan.toLowerCase()}`}>{tenant.plan}</span></td>
                  <td>{tenant.api}</td>
                  <td>{tenant.mrr}</td>
                  <td><span className="pill p-teal">{tenant.status}</span></td>
                  <td>
                    <button
                      className="act-btn"
                      onClick={() => openSurface(`${tenant.name} Tenant Console`, "tenant", tenant)}
                      type="button"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SectionLabel>Live Activity Feed</SectionLabel>
      <section className="feed-wrap">
        <div className="feed-hdr"><span className="feed-ht">System Events</span><span>Auto-refreshing</span></div>
        <ul className="feed-list">
          {activityFeed.map((item) => (
            <li className="feed-item" key={`${item.time}-${item.text}`}>
              <span className={`fdot fd-${item.accent}`} />
              <div>
                <div className="feed-txt">{item.text}</div>
                <div className="feed-sub">{item.subtitle}</div>
              </div>
              <span className="feed-t">{item.time}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CustomerView({ openSurface }: { openSurface: (label: string, source: SurfaceSource, meta?: Record<string, string>) => void }) {
  return (
    <div className="view-panel">
      <SectionLabel>Your Workspace</SectionLabel>
      <CommandPalette
        eyebrow="Customer Portal — Your Controls"
        groups={customerCommandGroups}
        onAction={(command) => openSurface(command, "customer-command")}
        placeholder="What do you want to build or check?"
        variant="customer"
      />

      <SectionLabel>Quick Access</SectionLabel>
      <div className="cust-grid">
        {quickAccess.map((card) => (
          <article className="cust-card" key={card.title}>
            <div>
              <div className="cc-title">{card.title}</div>
              <div className="cc-sub">{card.subtitle}</div>
            </div>
            <div className="quick-list">
              {card.rows.map((row) => {
                const Icon = row.icon;
                return (
                  <button
                    className="pa-row"
                    onClick={() => openSurface(row.label, "quick-access", {
                      accent: row.accent,
                      section: card.title,
                      subtitle: row.sub,
                    })}
                    key={row.label}
                    type="button"
                  >
                    <span className={`pa-ico pai-${row.accent}`}><Icon aria-hidden size={16} /></span>
                    <span className="pa-txt"><strong>{row.label}</strong><small>{row.sub}</small></span>
                    <span className="pa-arr"><ChevronRight aria-hidden size={15} /></span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ActionSurface({
  log,
  onClose,
  onEndpoint,
  onReview,
  onStage,
  surface,
}: {
  log: string[];
  onClose: () => void;
  onEndpoint: () => void;
  onReview: () => void;
  onStage: () => void;
  surface: ActiveSurface | null;
}) {
  if (!surface) return null;

  return (
    <aside className={`surface-drawer sd-${surface.accent}`} aria-label={surface.title} role="dialog">
      <div className="surface-head">
        <div>
          <span className="surface-eyebrow">{surface.eyebrow}</span>
          <h2>{surface.title}</h2>
        </div>
        <button className="surface-icon-btn" onClick={onClose} type="button" aria-label="Close command surface">
          <X aria-hidden size={18} />
        </button>
      </div>

      <div className="surface-status-row">
        <span className="surface-status"><CheckCircle2 aria-hidden size={15} />{surface.status}</span>
        <span className="surface-id">{surface.id}</span>
      </div>

      <p className="surface-summary">{surface.summary}</p>

      <div className="surface-meta" aria-label="Command metadata">
        {surface.meta.map((item) => (
          <div key={`${item.label}-${item.value}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="surface-section">
        <h3>Checks</h3>
        <ul>
          {surface.details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
      </div>

      <div className="surface-section">
        <h3>Next Plays</h3>
        <ol>
          {surface.next.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>

      <div className="surface-actions">
        <button className="surface-action primary" onClick={onStage} type="button">
          <ClipboardCheck aria-hidden size={16} />
          Stage Request
        </button>
        <button className="surface-action" onClick={onReview} type="button">
          <CheckCircle2 aria-hidden size={16} />
          Mark Reviewed
        </button>
        {surface.endpoint ? (
          <button className="surface-action" onClick={onEndpoint} type="button">
            <ExternalLink aria-hidden size={16} />
            Open Endpoint
          </button>
        ) : null}
      </div>

      <div className="surface-log" aria-live="polite">
        {log.map((entry) => <span key={entry}>{entry}</span>)}
      </div>
    </aside>
  );
}

function CommandPalette({
  eyebrow,
  groups,
  onAction,
  placeholder,
  variant,
}: {
  eyebrow: string;
  groups: CommandGroup[];
  onAction: (message: string) => void;
  placeholder: string;
  variant: "admin" | "customer";
}) {
  const [query, setQuery] = useState("");
  const visibleGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${item.command} ${item.hint}`.toLowerCase().includes(normalized)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  return (
    <section className="pal-card">
      <div className="pal-top">
        <span className={`pal-title ${variant === "admin" ? "pt-admin" : "pt-cust"}`}>{eyebrow}</span>
        <span className="live-pill small"><span className="live-dot" />{variant === "admin" ? "MJ Active" : "Connected"}</span>
      </div>
      <div className="pal-search">
        <Search aria-hidden size={18} />
        <input
          aria-label={`${variant} command search`}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          value={query}
        />
        <kbd>⌘K</kbd>
      </div>
      <div className={`cmd-groups cmd-count-${Math.min(groups.length, 4)}`}>
        {visibleGroups.map((group) => (
          <div className="cmd-group" key={group.title}>
            <h2 className={`cg-title cg-${group.accent}`}>{group.title}</h2>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button className={`cmd-row cr-${item.accent}`} onClick={() => onAction(item.command)} key={item.command} type="button">
                  <span className={`ci ci-${item.accent}`}><Icon aria-hidden size={16} /></span>
                  <span><strong>{item.command}</strong><small>{item.hint}</small></span>
                  <span className={`lane ln-${item.accent}`} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {visibleGroups.length === 0 ? <div className="command-empty">No matching control surface</div> : null}
    </section>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="sec-label">{children}</p>;
}
