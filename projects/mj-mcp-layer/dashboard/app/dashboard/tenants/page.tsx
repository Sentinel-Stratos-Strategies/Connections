"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginForm } from "@/components/login-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { TenantManagement } from "@/components/panels";

function TenantsContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tenant Management</h1>
          <p className="text-muted mt-1">
            Manage tenant configurations, rate limits, and capabilities
          </p>
        </div>
        <TenantManagement />
      </div>
    </DashboardLayout>
  );
}

export default function TenantsPage() {
  return (
    <AuthProvider>
      <TenantsContent />
    </AuthProvider>
  );
}
