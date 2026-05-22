import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Pricing } from "@/components/landing/pricing";
import { Footer } from "@/components/landing/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MJ Brady | Enterprise MCP Edge Router & Security Platform",
  description:
    "Deploy, monitor, and enforce security policies across your Cloudflare edge network. SOC2, HIPAA, and PCI-DSS compliant with immutable audit ledger.",
  keywords: [
    "MCP",
    "edge router",
    "Cloudflare",
    "security",
    "compliance",
    "SOC2",
    "HIPAA",
    "PCI-DSS",
    "infrastructure",
    "DevOps",
  ],
  openGraph: {
    title: "MJ Brady | Enterprise MCP Edge Router",
    description: "Deploy. Monitor. Enforce. Enterprise infrastructure control.",
    url: "https://mjbrady.io",
    siteName: "MJ Brady",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Features />
      <Pricing />
      <Footer />
    </main>
  );
}
