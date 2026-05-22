"use client";

import useSWR from "swr";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createFetcher, mcpFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Loader2,
  RefreshCw,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "denied";
  type: string;
  affectedResources: string[];
}

interface ChangeQueueResponse {
  requests: ChangeRequest[];
  total: number;
}

export function ChangeRequestQueue() {
  const { token } = useAuth();
  const fetcher = createFetcher(token || "");
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<ChangeQueueResponse>(
    token ? "/changes/queue" : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const handleAction = async (requestId: string, action: "approve" | "deny") => {
    if (!token) return;
    setActionLoading(`${requestId}-${action}`);
    try {
      await mcpFetch(`/changes/${requestId}/${action}`, {
        method: "POST",
        token,
      });
      mutate();
    } catch (err) {
      console.error(`Failed to ${action} request:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="success">Approved</Badge>;
      case "denied":
        return <Badge variant="danger">Denied</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  const pendingCount = data?.requests?.filter((r) => r.status === "pending").length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="w-4 h-4 text-accent" />
          Change Request Queue
          {pendingCount > 0 && (
            <Badge variant="warning" className="ml-2">
              {pendingCount} pending
            </Badge>
          )}
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
            Loading change requests...
          </div>
        ) : error ? (
          <div className="text-center py-6 text-muted">
            <p>Failed to load change requests</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : !data?.requests?.length ? (
          <div className="text-center py-6 text-muted">
            <p>No change requests in queue</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.requests.map((request) => (
              <div
                key={request.id}
                className="border border-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedRequest(
                      expandedRequest === request.id ? null : request.id
                    )
                  }
                  className="w-full px-4 py-3 flex items-center gap-4 hover:bg-surface-hover text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground truncate">
                        {request.title}
                      </span>
                      {getStatusBadge(request.status)}
                      <Badge variant="outline" className="text-xs">
                        {request.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>{request.requestedBy}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(request.requestedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                  {expandedRequest === request.id ? (
                    <ChevronUp className="w-4 h-4 text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted" />
                  )}
                </button>

                {expandedRequest === request.id && (
                  <div className="px-4 py-4 bg-background border-t border-border space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted mb-1">
                        Description
                      </h4>
                      <p className="text-sm text-foreground">
                        {request.description}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-muted mb-2">
                        Affected Resources
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {request.affectedResources.map((resource) => (
                          <Badge key={resource} variant="outline" className="font-mono text-xs">
                            {resource}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-muted">
                      Requested: {format(new Date(request.requestedAt), "MMM d, yyyy HH:mm")}
                    </div>

                    {request.status === "pending" && (
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleAction(request.id, "approve")}
                          disabled={actionLoading === `${request.id}-approve`}
                        >
                          {actionLoading === `${request.id}-approve` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(request.id, "deny")}
                          disabled={actionLoading === `${request.id}-deny`}
                        >
                          {actionLoading === `${request.id}-deny` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4 mr-1" />
                          )}
                          Deny
                        </Button>
                      </div>
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
