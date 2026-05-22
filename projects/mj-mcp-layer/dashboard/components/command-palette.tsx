"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command, Terminal, Shield, GitCompare, FileText, X } from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onRunCommand?: (command: string) => void;
}

const quickCommands = [
  {
    label: "Health Check All Providers",
    command: "health-check --all-providers",
    icon: Shield,
    category: "Operations",
  },
  {
    label: "Drift Scan - Cloudflare",
    command: "drift-scan --provider cloudflare",
    icon: GitCompare,
    category: "Operations",
  },
  {
    label: "Compliance Check (JSON)",
    command: "compliance-check --format json",
    icon: Shield,
    category: "Compliance",
  },
  {
    label: "Policy Apply (Dry Run)",
    command: "policy-apply --file manifests/default.yaml --dry-run",
    icon: FileText,
    category: "Policy",
  },
  {
    label: "Query Ledger",
    command: "ledger query",
    icon: Terminal,
    category: "Data",
  },
  {
    label: "List Tenants",
    command: "tenant list --format table",
    icon: Terminal,
    category: "Tenants",
  },
];

const navCommands = [
  { label: "Go to Overview", path: "/dashboard", category: "Navigation" },
  { label: "Go to Tenants", path: "/dashboard/tenants", category: "Navigation" },
  { label: "Go to Audit Log", path: "/dashboard/audit", category: "Navigation" },
  { label: "Go to Compliance", path: "/dashboard/compliance", category: "Navigation" },
  { label: "Go to Console", path: "/dashboard/console", category: "Navigation" },
];

export function CommandPalette({ isOpen, onClose, onRunCommand }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredQuickCommands = quickCommands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.command.toLowerCase().includes(search.toLowerCase())
  );

  const filteredNavCommands = navCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  const allItems = [...filteredQuickCommands, ...filteredNavCommands];

  const handleSelect = useCallback(
    (index: number) => {
      const item = allItems[index];
      if (!item) return;

      if ("command" in item) {
        onRunCommand?.(item.command);
        router.push("/dashboard/console");
      } else if ("path" in item) {
        router.push(item.path);
      }
      onClose();
    },
    [allItems, onClose, onRunCommand, router]
  );

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setSelectedIndex(0);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(selectedIndex);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, allItems.length, selectedIndex, handleSelect]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Command className="w-5 h-5 text-muted" />
          <input
            type="text"
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredQuickCommands.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-xs font-medium text-muted uppercase tracking-wide">
                Quick Commands
              </p>
              {filteredQuickCommands.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.command}
                    onClick={() => handleSelect(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedIndex === i
                        ? "bg-primary/20 text-primary"
                        : "text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{cmd.label}</p>
                      <p className="text-xs text-muted font-mono">{cmd.command}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {filteredNavCommands.length > 0 && (
            <div>
              <p className="px-2 py-1 text-xs font-medium text-muted uppercase tracking-wide">
                Navigation
              </p>
              {filteredNavCommands.map((cmd, i) => {
                const globalIndex = filteredQuickCommands.length + i;
                return (
                  <button
                    key={cmd.path}
                    onClick={() => handleSelect(globalIndex)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedIndex === globalIndex
                        ? "bg-primary/20 text-primary"
                        : "text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    <span className="text-sm font-medium">{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {allItems.length === 0 && (
            <p className="px-3 py-6 text-center text-muted text-sm">
              No results found
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
              {"\u2191"}
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
              {"\u2193"}
            </kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
              {"\u21B5"}
            </kbd>
            to select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
              esc
            </kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
