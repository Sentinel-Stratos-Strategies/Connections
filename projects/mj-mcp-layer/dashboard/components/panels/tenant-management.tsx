"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { createFetcher, mcpFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

interface Tenant {
  id: string;
  name?: string;
  status: string;
  rateLimit: number;
  capabilities: string[];
  createdAt?: string;
}

interface TenantsResponse {
  tenants: Tenant[];
}

export function TenantManagement() {
  const { token } = useAuth();
  const fetcher = createFetcher(token || "");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<TenantsResponse>(
    token ? "/tenants" : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    if (!token) return;
    setActionLoading(tenantId);
    try {
      const newStatus = currentStatus === "active" ? "suspended" : "active";
      await mcpFetch(`/tenants/${tenantId}/status`, {
        method: "PATCH",
        body: { status: newStatus },
        token,
      });
      mutate();
    } catch (err) {
      console.error("Failed to update tenant status:", err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-accent" />
          Tenant Management
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => mutate()}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading tenants...
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted">
            <p>Failed to load tenants</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : !data?.tenants?.length ? (
          <div className="text-center py-8 text-muted">
            <p>No tenants configured</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="text-left font-medium px-6 py-2">Tenant ID</th>
                  <th className="text-left font-medium px-4 py-2">Status</th>
                  <th className="text-left font-medium px-4 py-2">Rate Limit</th>
                  <th className="text-left font-medium px-4 py-2">Capabilities</th>
                  <th className="text-right font-medium px-6 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="px-6 py-3">
                      <span className="font-mono text-foreground">{tenant.id}</span>
                      {tenant.name && (
                        <span className="block text-xs text-muted">{tenant.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={tenant.status === "active" ? "success" : "warning"}
                      >
                        {tenant.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {tenant.rateLimit.toLocaleString()}/min
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tenant.capabilities.slice(0, 3).map((cap) => (
                          <Badge key={cap} variant="outline" className="text-xs">
                            {cap}
                          </Badge>
                        ))}
                        {tenant.capabilities.length > 3 && (
                          <Badge variant="muted" className="text-xs">
                            +{tenant.capabilities.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        variant={tenant.status === "active" ? "warning" : "success"}
                        size="sm"
                        disabled={actionLoading === tenant.id}
                        onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                      >
                        {actionLoading === tenant.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : tenant.status === "active" ? (
                          "Suspend"
                        ) : (
                          "Activate"
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
