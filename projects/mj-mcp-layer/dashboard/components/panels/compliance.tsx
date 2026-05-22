"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { createFetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface ComplianceCheck {
  framework: string;
  status: "pass" | "fail" | "partial";
  score: number;
  lastChecked: string;
  issues?: number;
}

interface ComplianceResponse {
  checks: ComplianceCheck[];
  overallScore: number;
}

export function CompliancePanel() {
  const { token } = useAuth();
  const fetcher = createFetcher(token || "");

  const { data, error, isLoading, mutate } = useSWR<ComplianceResponse>(
    token ? "/compliance/status" : null,
    fetcher,
    { refreshInterval: 300000 }
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="w-5 h-5 text-success" />;
      case "fail":
        return <XCircle className="w-5 h-5 text-danger" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-warning" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pass":
        return <Badge variant="success">Compliant</Badge>;
      case "fail":
        return <Badge variant="danger">Non-Compliant</Badge>;
      default:
        return <Badge variant="warning">Partial</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-success";
    if (score >= 70) return "text-warning";
    return "text-danger";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-4 h-4 text-accent" />
          Compliance Status
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
            Loading compliance status...
          </div>
        ) : error ? (
          <div className="text-center py-6 text-muted">
            <p>Failed to load compliance status</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : !data?.checks?.length ? (
          <div className="text-center py-6 text-muted">
            <p>No compliance checks configured</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overall Score */}
            {data.overallScore !== undefined && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                <span className="text-muted">Overall Compliance Score</span>
                <span className={`text-2xl font-bold ${getScoreColor(data.overallScore)}`}>
                  {data.overallScore}%
                </span>
              </div>
            )}

            {/* Framework Checks */}
            <div className="grid gap-3">
              {data.checks.map((check) => (
                <div
                  key={check.framework}
                  className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border"
                >
                  {getStatusIcon(check.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {check.framework}
                      </span>
                      {getStatusBadge(check.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted">
                      <span>Score: {check.score}%</span>
                      {check.issues !== undefined && check.issues > 0 && (
                        <span className="text-danger">
                          {check.issues} issue{check.issues !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-semibold ${getScoreColor(check.score)}`}
                    >
                      {check.score}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
