import { Search, ChevronRight } from "lucide-react";
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
import type { CommandGroup } from "./data";

type View = "admin" | "customer";

export function App() {
  const [view, setView] = useState<View>("admin");
  const [toast, setToast] = useState("");

  function fire(message: string) {
    setToast(message);
    window.clearTimeout(Number(window.sessionStorage.getItem("mj-toast-timeout") ?? 0));
    const timeout = window.setTimeout(() => setToast(""), 2400);
    window.sessionStorage.setItem("mj-toast-timeout", String(timeout));
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

        {view === "admin" ? <AdminView fire={fire} /> : <CustomerView fire={fire} />}
      </main>
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast ? `✓ ${toast}` : ""}
      </div>
    </div>
  );
}

function AdminView({ fire }: { fire: (message: string) => void }) {
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
        onAction={fire}
        placeholder="Ask MJ to run the next safe play..."
        variant="admin"
      />

      <SectionLabel>Active Tenants</SectionLabel>
      <section className="tbl-wrap">
        <div className="tbl-hdr">
          <span className="tbl-ht">Tenant Roster</span>
          <button className="act-btn" onClick={() => fire("New tenant onboarded")} type="button">+ Onboard Tenant</button>
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
                  <td><button className="act-btn" onClick={() => fire(`${tenant.name} inspected`)} type="button">Inspect</button></td>
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

function CustomerView({ fire }: { fire: (message: string) => void }) {
  return (
    <div className="view-panel">
      <SectionLabel>Your Workspace</SectionLabel>
      <CommandPalette
        eyebrow="Customer Portal — Your Controls"
        groups={customerCommandGroups}
        onAction={fire}
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
                  <button className="pa-row" onClick={() => fire(`${row.label} opened`)} key={row.label} type="button">
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
