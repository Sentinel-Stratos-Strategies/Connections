import {
  Shield,
  Activity,
  Cpu,
  Users,
  FileText,
  Smartphone,
} from "lucide-react";

const features = [
  {
    icon: Cpu,
    title: "MCP Edge Routing",
    description:
      "Route Model Context Protocol requests through Cloudflare edge with sub-millisecond latency. Geographic load balancing and automatic failover included.",
  },
  {
    icon: Shield,
    title: "SOC2/HIPAA/PCI Compliance",
    description:
      "Pre-configured compliance frameworks with continuous monitoring. One-click deployment of security controls that meet enterprise audit requirements.",
  },
  {
    icon: Activity,
    title: "Drift Detection",
    description:
      "Real-time configuration drift alerts. Know immediately when your infrastructure deviates from declared state with automatic remediation options.",
  },
  {
    icon: Smartphone,
    title: "Mobile Operator Console",
    description:
      "Full infrastructure control from your pocket. Deploy, monitor, and respond to incidents from iOS or Android with push notifications.",
  },
  {
    icon: Users,
    title: "Multi-Tenant Isolation",
    description:
      "Cryptographic tenant isolation at the edge. Each tenant gets dedicated secrets, rate limits, and audit trails with zero cross-contamination.",
  },
  {
    icon: FileText,
    title: "Immutable Audit Ledger",
    description:
      "Every configuration change, access request, and deployment is logged to a tamper-proof audit trail. Full chain of custody for compliance.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Enterprise Infrastructure Control
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Everything you need to secure, monitor, and manage your edge
            infrastructure at scale.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 bg-surface rounded-2xl border border-border hover:border-primary/50 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-muted flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
