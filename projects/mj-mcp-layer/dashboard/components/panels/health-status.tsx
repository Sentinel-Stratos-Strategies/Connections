"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { createFetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface HealthResponse {
  status: string;
  version?: string;
  uptime?: number;
  services?: {
    name: string;
    status: string;
  }[];
}

export function HealthStatusCard() {
  const { token } = useAuth();
  const fetcher = createFetcher(token || "");
  
  const { data, error, isLoading } = useSWR<HealthResponse>(
    token ? "/healthz" : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const isHealthy = data?.status === "ok" || data?.status === "healthy";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-accent" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Checking health...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-danger" />
            <div>
              <p className="font-medium text-danger">Unreachable</p>
              <p className="text-xs text-muted">Failed to connect to MCP</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {isHealthy ? (
                <CheckCircle className="w-6 h-6 text-success" />
              ) : (
                <XCircle className="w-6 h-6 text-danger" />
              )}
              <div>
                <p className="font-semibold text-foreground">
                  {isHealthy ? "All Systems Operational" : "Degraded"}
                </p>
                {data?.version && (
                  <p className="text-xs text-muted">Version {data.version}</p>
                )}
              </div>
              <Badge variant={isHealthy ? "success" : "danger"} className="ml-auto">
                {data?.status || "unknown"}
              </Badge>
            </div>

            {data?.services && data.services.length > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                {data.services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{service.name}</span>
                    <Badge
                      variant={service.status === "ok" ? "success" : "danger"}
                      className="text-xs"
                    >
                      {service.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {data?.uptime !== undefined && (
              <p className="text-xs text-muted pt-2 border-t border-border">
                Uptime: {Math.floor(data.uptime / 3600)}h {Math.floor((data.uptime % 3600) / 60)}m
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
