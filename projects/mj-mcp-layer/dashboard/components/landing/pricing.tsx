import { Check } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "$299",
    period: "/month",
    description: "For small teams getting started with MCP edge routing.",
    features: [
      "1 Tenant",
      "5 MCP endpoints",
      "Basic WAF rules",
      "Email drift alerts",
      "7-day audit retention",
      "Community support",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$799",
    period: "/month",
    description: "For growing organizations with multiple environments.",
    features: [
      "10 Tenants",
      "Unlimited MCP endpoints",
      "Advanced WAF + Bot protection",
      "Push notifications + Webhooks",
      "90-day audit retention",
      "SOC2 compliance templates",
      "Priority support",
      "Mobile operator console",
    ],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For organizations with advanced security requirements.",
    features: [
      "Unlimited Tenants",
      "Unlimited MCP endpoints",
      "Custom WAF rules + DDoS protection",
      "HIPAA + PCI-DSS compliance",
      "Unlimited audit retention",
      "Dedicated support engineer",
      "Custom SLA",
      "On-premise deployment option",
      "SSO + SAML integration",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32 px-6 bg-surface/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-8 rounded-2xl border ${
                plan.highlight
                  ? "bg-gradient-to-b from-primary-muted to-surface border-primary"
                  : "bg-surface border-border"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted">{plan.period}</span>
                </div>
                <p className="text-muted mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    <span className="text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={
                  plan.name === "Enterprise"
                    ? "mailto:sales@ellis-aegis.us"
                    : "https://mcp.ellis-aegis.us"
                }
                className={`block w-full py-3 rounded-xl font-semibold text-center transition-colors ${
                  plan.highlight
                    ? "bg-primary hover:bg-primary-hover text-white"
                    : "bg-surface-hover hover:bg-border border border-border"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
