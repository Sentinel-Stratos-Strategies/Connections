"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginForm } from "@/components/login-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CompliancePanel } from "@/components/panels";

function ComplianceContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance Status</h1>
          <p className="text-muted mt-1">
            SOC2, PCI, and HIPAA compliance monitoring
          </p>
        </div>
        <CompliancePanel />
      </div>
    </DashboardLayout>
  );
}

export default function CompliancePage() {
  return (
    <AuthProvider>
      <ComplianceContent />
    </AuthProvider>
  );
}
