"use client";

import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginForm } from "@/components/login-form";
import { DashboardLayout, useDashboardLayout } from "@/components/dashboard-layout";
import { CloudShell } from "@/components/cloud-shell";
import { Button } from "@/components/ui/button";
import { Plus, X, Terminal } from "lucide-react";

interface ShellTab {
  id: string;
  label: string;
  initialCommand?: string;
}

function ConsoleShellTabs() {
  const { pendingCommand, clearPendingCommand } = useDashboardLayout();
  const [tabs, setTabs] = useState<ShellTab[]>([
    { id: "main", label: "Shell 1" },
  ]);
  const [activeTab, setActiveTab] = useState("main");

  useEffect(() => {
    if (!pendingCommand) return;

    const newTab: ShellTab = {
      id: `shell-${Date.now()}`,
      label: `Shell ${tabs.length + 1}`,
      initialCommand: pendingCommand,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTab(newTab.id);
    clearPendingCommand();
  }, [pendingCommand, clearPendingCommand, tabs.length]);

  const addTab = () => {
    const newTab: ShellTab = {
      id: `shell-${Date.now()}`,
      label: `Shell ${tabs.length + 1}`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTab(newTab.id);
  };

  const removeTab = (tabId: string) => {
    if (tabs.length === 1) return;

    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTab === tabId) {
      setActiveTab(newTabs[newTabs.length - 1].id);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Terminal className="w-6 h-6 text-accent" />
            Cloud Console
          </h1>
          <p className="text-muted mt-1">
            MCP CLI shell - run commands directly against the infrastructure
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-terminal-bg text-terminal-text border border-border border-b-terminal-bg -mb-[3px]"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <button
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2"
            >
              <Terminal className="w-3.5 h-3.5" />
              {tab.label}
            </button>
            {tabs.length > 1 && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  removeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-danger/20 hover:text-danger transition-all"
                aria-label={`Close ${tab.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={addTab}
          className="ml-2 text-muted hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 rounded-lg border border-border overflow-hidden bg-terminal-bg">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`h-full ${activeTab === tab.id ? "block" : "hidden"}`}
          >
            <CloudShell initialCommand={tab.initialCommand} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">
              Ctrl+C
            </kbd>{" "}
            to interrupt
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border">
              {"\u2318"}K
            </kbd>{" "}
            for quick commands
          </span>
        </div>
        <span>Connected to MCP Cloud Shell</span>
      </div>
    </div>
  );
}

function ConsoleContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout>
      <ConsoleShellTabs />
    </DashboardLayout>
  );
}

export default function ConsolePage() {
  return (
    <AuthProvider>
      <ConsoleContent />
    </AuthProvider>
  );
}
