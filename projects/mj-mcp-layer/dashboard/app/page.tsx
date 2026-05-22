"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginForm } from "@/components/login-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  HealthStatusCard,
  TenantManagement,
  DriftScanStatus,
  CompliancePanel,
  MCPConnections,
  ChangeRequestQueue,
} from "@/components/panels";

function DashboardContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-muted mt-1">
            MJ Brady MCP deployment operations center
          </p>
        </div>

        {/* Top row - Health, Connections, Compliance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <HealthStatusCard />
          <MCPConnections />
          <CompliancePanel />
        </div>

        {/* Middle row - Drift and Change Requests */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DriftScanStatus />
          <ChangeRequestQueue />
        </div>

        {/* Bottom row - Tenants */}
        <TenantManagement />
      </div>
    </DashboardLayout>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
