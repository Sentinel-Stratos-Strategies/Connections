"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginForm } from "@/components/login-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DriftScanStatus } from "@/components/panels";

function DriftContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Drift Scan</h1>
          <p className="text-muted mt-1">
            Infrastructure drift detection and remediation
          </p>
        </div>
        <DriftScanStatus />
      </div>
    </DashboardLayout>
  );
}

export default function DriftPage() {
  return (
    <AuthProvider>
      <DriftContent />
    </AuthProvider>
  );
}
