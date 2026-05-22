"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginForm } from "@/components/login-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ChangeRequestQueue } from "@/components/panels";

function ChangesContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Change Request Queue</h1>
          <p className="text-muted mt-1">
            Review and approve infrastructure change requests
          </p>
        </div>
        <ChangeRequestQueue />
      </div>
    </DashboardLayout>
  );
}

export default function ChangesPage() {
  return (
    <AuthProvider>
      <ChangesContent />
    </AuthProvider>
  );
}
