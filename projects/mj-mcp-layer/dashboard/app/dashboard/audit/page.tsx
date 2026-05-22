"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginForm } from "@/components/login-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { AuditLogViewer } from "@/components/panels";

function AuditContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted mt-1">
            View and filter system audit events
          </p>
        </div>
        <AuditLogViewer />
      </div>
    </DashboardLayout>
  );
}

export default function AuditPage() {
  return (
    <AuthProvider>
      <AuditContent />
    </AuthProvider>
  );
}
