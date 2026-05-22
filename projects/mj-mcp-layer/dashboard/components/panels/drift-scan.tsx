"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { createFetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitCompare, Loader2, RefreshCw, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface DriftScanResult {
  lastRun: string;
  status: "clean" | "drift_detected" | "error" | "pending";
  provider: string;
  changesDetected: number;
  details?: {
    resource: string;
    expected: string;
    actual: string;
  }[];
}

interface DriftResponse {
  scans: DriftScanResult[];
}

export function DriftScanStatus() {
  const { token } = useAuth();
  const fetcher = createFetcher(token || "");

  const { data, error, isLoading, mutate } = useSWR<DriftResponse>(
    token ? "/drift/status" : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "clean":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="w-3 h-3" />
            Clean
          </Badge>
        );
      case "drift_detected":
        return (
          <Badge variant="danger" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            Drift Detected
          </Badge>
        );
      case "error":
        return <Badge variant="danger">Error</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompare className="w-4 h-4 text-accent" />
          Drift Scan Status
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
          <div className="flex items-center justify-center py-6 text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading drift status...
          </div>
        ) : error ? (
          <div className="text-center py-6 text-muted">
            <p>Failed to load drift status</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : !data?.scans?.length ? (
          <div className="text-center py-6 text-muted">
            <p>No drift scans recorded</p>
            <p className="text-xs mt-1">Run a drift scan from the Console</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.scans.map((scan, idx) => (
              <div
                key={`${scan.provider}-${idx}`}
                className="p-4 rounded-lg bg-background border border-border"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground capitalize">
                      {scan.provider}
                    </span>
                    {getStatusBadge(scan.status)}
                  </div>
                  {scan.changesDetected > 0 && (
                    <span className="text-sm text-danger">
                      {scan.changesDetected} change{scan.changesDetected !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted">
                  <Clock className="w-3 h-3" />
                  <span>
                    Last run: {format(new Date(scan.lastRun), "MMM d, HH:mm")}
                  </span>
                  <span className="text-muted-foreground">
                    ({formatDistanceToNow(new Date(scan.lastRun), { addSuffix: true })})
                  </span>
                </div>

                {scan.details && scan.details.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {scan.details.slice(0, 3).map((detail, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-mono text-foreground">
                          {detail.resource}
                        </span>
                        <div className="ml-4 text-muted">
                          Expected: <span className="text-success">{detail.expected}</span>
                          {" | "}
                          Actual: <span className="text-danger">{detail.actual}</span>
                        </div>
                      </div>
                    ))}
                    {scan.details.length > 3 && (
                      <p className="text-xs text-muted">
                        +{scan.details.length - 3} more changes
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
