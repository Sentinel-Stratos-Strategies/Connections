"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  FileText,
  Shield,
  GitCompare,
  Plug,
  ClipboardList,
  Terminal,
  LogOut,
  Menu,
  X,
  Command,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/tenants", label: "Tenants", icon: Users },
  { href: "/dashboard/audit", label: "Audit Log", icon: FileText },
  { href: "/dashboard/compliance", label: "Compliance", icon: Shield },
  { href: "/dashboard/drift", label: "Drift Scan", icon: GitCompare },
  { href: "/dashboard/connections", label: "Connections", icon: Plug },
  { href: "/dashboard/changes", label: "Change Queue", icon: ClipboardList },
  { href: "/dashboard/console", label: "Console", icon: Terminal },
];

interface SidebarProps {
  onCommandPalette?: () => void;
}

export function Sidebar({ onCommandPalette }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface border border-border text-foreground"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-surface border-r border-border flex flex-col z-50 transition-transform duration-200",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">MJ Brady</h1>
                <p className="text-xs text-muted">Operations Center</p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1 rounded text-muted hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Command Palette Trigger */}
        <div className="px-3 py-3">
          <button
            onClick={onCommandPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border text-muted text-sm hover:border-primary/50 hover:text-foreground transition-colors"
          >
            <Command className="w-4 h-4" />
            <span>Quick Commands...</span>
            <kbd className="ml-auto text-xs bg-surface px-1.5 py-0.5 rounded border border-border">
              {"\u2318"}K
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted hover:text-foreground hover:bg-surface-hover"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted hover:text-danger"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
}
