import type { ReactNode } from "react";
import { systemCards } from "../data";
import { StatusPill } from "./StatusPill";

export function ControlPanelShell({ children }: { children: ReactNode }) {
  return (
    <main className="genesis-shell">
      <section className="hero-panel" aria-labelledby="control-panel-title">
        <div className="brand-mark" aria-hidden>
          B
        </div>
        <div>
          <p className="eyebrow">Genesis OS</p>
          <h1 id="control-panel-title">MJ Layer Control</h1>
          <p className="lede">
            Command authority for protected cloud shells, lane dispatch, evidence
            capture, and policy-gated infrastructure changes.
          </p>
        </div>
      </section>

      <section className="system-grid" aria-label="MJ Layer system status">
        {systemCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="system-card" key={card.label}>
              <Icon aria-hidden size={24} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <StatusPill state={card.state} />
            </article>
          );
        })}
      </section>

      {children}
    </main>
  );
}
