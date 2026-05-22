"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginForm } from "@/components/login-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MCPConnections } from "@/components/panels";

function ConnectionsContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">MCP Connections</h1>
          <p className="text-muted mt-1">
            Active provider connections and latency monitoring
          </p>
        </div>
        <MCPConnections />
      </div>
    </DashboardLayout>
  );
}

export default function ConnectionsPage() {
  return (
    <AuthProvider>
      <ConnectionsContent />
    </AuthProvider>
  );
}
