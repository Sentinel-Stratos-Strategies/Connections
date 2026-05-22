"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Shield, ExternalLink } from "lucide-react";

export function Hero() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [status, setStatus] = useState<"online" | "checking">("checking");

  useEffect(() => {
    // Check MCP endpoint status
    fetch("https://mcp.ellis-aegis.us/healthz")
      .then((res) => {
        setStatus(res.ok ? "online" : "checking");
      })
      .catch(() => setStatus("checking"));
  }, []);

  return (
    <section className="relative min-h-screen grid-pattern overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">MJ Brady</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-muted hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-muted hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="https://docs.ellis-aegis.us"
              className="text-muted hover:text-foreground transition-colors flex items-center gap-1"
            >
              Docs <ExternalLink className="w-3 h-3" />
            </Link>
            <Link
              href="https://mcp.ellis-aegis.us"
              className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg font-medium transition-colors"
            >
              Launch Console
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-surface border-b border-border p-6 space-y-4">
            <Link
              href="#features"
              className="block text-muted hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="block text-muted hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="https://docs.ellis-aegis.us"
              className="block text-muted hover:text-foreground transition-colors"
            >
              Docs
            </Link>
            <Link
              href="https://mcp.ellis-aegis.us"
              className="block px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg font-medium transition-colors text-center"
            >
              Launch Console
            </Link>
          </div>
        )}
      </nav>

      {/* Hero content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 md:pt-32 md:pb-40">
        <div className="text-center max-w-4xl mx-auto">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface rounded-full border border-border mb-8">
            <span
              className={`w-2 h-2 rounded-full ${
                status === "online" ? "bg-success" : "bg-warning"
              } animate-pulse`}
            />
            <span className="text-sm text-muted">
              mcp.ellis-aegis.us{" "}
              {status === "online" ? "operational" : "checking..."}
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="gradient-text">Deploy. Monitor. Enforce.</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted mb-10 max-w-2xl mx-auto leading-relaxed">
            Enterprise MCP edge router and Cloudflare hardening platform.
            Control your infrastructure from anywhere.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="https://mcp.ellis-aegis.us"
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-hover rounded-xl font-semibold text-lg transition-all animate-pulse-glow"
            >
              Get Started
            </Link>
            <Link
              href="#features"
              className="w-full sm:w-auto px-8 py-4 bg-surface hover:bg-surface-hover border border-border rounded-xl font-semibold text-lg transition-colors"
            >
              Learn More
            </Link>
          </div>

          {/* App store badges */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <p className="text-sm text-muted">Mobile Operator Console:</p>
            <div className="flex gap-3">
              <Link
                href="#"
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <span className="text-sm font-medium">App Store</span>
              </Link>
              <Link
                href="#"
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
                </svg>
                <span className="text-sm font-medium">Google Play</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
          <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
        </div>
      </div>
    </section>
  );
}
