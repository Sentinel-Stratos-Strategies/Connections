"use client";

import Link from "next/link";
import { Shield, Github, Twitter, Linkedin, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";

export function Footer() {
  const [status, setStatus] = useState<"online" | "degraded" | "offline">(
    "online"
  );

  useEffect(() => {
    fetch("https://mcp.ellis-aegis.us/healthz")
      .then((res) => {
        setStatus(res.ok ? "online" : "degraded");
      })
      .catch(() => setStatus("offline"));
  }, []);

  const statusColors = {
    online: "bg-success",
    degraded: "bg-warning",
    offline: "bg-danger",
  };

  const statusText = {
    online: "All systems operational",
    degraded: "Partial outage",
    offline: "Service disruption",
  };

  return (
    <footer className="py-16 px-6 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">MJ Brady</span>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              Enterprise MCP edge router and Cloudflare hardening platform.
            </p>

            {/* Status badge */}
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 bg-surface rounded-lg border border-border">
              <span
                className={`w-2 h-2 rounded-full ${statusColors[status]} animate-pulse`}
              />
              <span className="text-xs text-muted">
                {statusText[status]}
              </span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#features"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="#pricing"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="https://docs.ellis-aegis.us"
                  className="text-muted hover:text-foreground transition-colors text-sm flex items-center gap-1"
                >
                  Documentation <ExternalLink className="w-3 h-3" />
                </Link>
              </li>
              <li>
                <Link
                  href="https://status.ellis-aegis.us"
                  className="text-muted hover:text-foreground transition-colors text-sm flex items-center gap-1"
                >
                  Status <ExternalLink className="w-3 h-3" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="https://ellis-aegis.us/about"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="https://ellis-aegis.us/blog"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="https://ellis-aegis.us/careers"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="mailto:contact@ellis-aegis.us"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="https://ellis-aegis.us/privacy"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="https://ellis-aegis.us/terms"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="https://ellis-aegis.us/security"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  Security
                </Link>
              </li>
              <li>
                <Link
                  href="https://ellis-aegis.us/compliance"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  Compliance
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted">
            &copy; {new Date().getFullYear()} Ellis Aegis. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/ellis-aegis"
              className="text-muted hover:text-foreground transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </Link>
            <Link
              href="https://twitter.com/ellisaegis"
              className="text-muted hover:text-foreground transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5" />
            </Link>
            <Link
              href="https://linkedin.com/company/ellis-aegis"
              className="text-muted hover:text-foreground transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
