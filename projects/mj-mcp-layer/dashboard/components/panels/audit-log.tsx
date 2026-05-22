"use client";

import useSWR from "swr";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createFetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Loader2, RefreshCw, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface AuditEvent {
  id: string;
  timestamp: string;
  tenantId: string;
  action: string;
  actor: string;
  resource: string;
  outcome: "success" | "failure" | "pending";
  details?: string;
}

interface AuditResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export function AuditLogViewer() {
  const { token } = useAuth();
  const fetcher = createFetcher(token || "");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("start", startDate);
    if (endDate) params.append("end", endDate);
    if (tenantFilter) params.append("tenantId", tenantFilter);
    const query = params.toString();
    return `/audit/events${query ? `?${query}` : ""}`;
  };

  const { data, error, isLoading, mutate } = useSWR<AuditResponse>(
    token ? buildQuery() : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const handleApplyFilters = () => {
    mutate();
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setTenantFilter("");
    mutate();
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case "success":
        return <Badge variant="success">Success</Badge>;
      case "failure":
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-4 h-4 text-accent" />
          Audit Log
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-4 p-4 rounded-lg bg-background border border-border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Tenant ID
                </label>
                <Input
                  type="text"
                  placeholder="Filter by tenant..."
                  value={tenantFilter}
                  onChange={(e) => setTenantFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApplyFilters}>
                Apply Filters
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Events List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading audit events...
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted">
            <p>Failed to load audit events</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : !data?.events?.length ? (
          <div className="text-center py-8 text-muted">
            <p>No audit events found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.events.map((event) => (
              <div
                key={event.id}
                className="border border-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedEvent(expandedEvent === event.id ? null : event.id)
                  }
                  className="w-full px-4 py-3 flex items-center gap-4 hover:bg-surface-hover text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {event.action}
                      </span>
                      {getOutcomeBadge(event.outcome)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span>
                        {format(new Date(event.timestamp), "MMM d, yyyy HH:mm:ss")}
                      </span>
                      <span className="font-mono">{event.tenantId}</span>
                      <span>{event.actor}</span>
                    </div>
                  </div>
                  {expandedEvent === event.id ? (
                    <ChevronUp className="w-4 h-4 text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted" />
                  )}
                </button>
                {expandedEvent === event.id && (
                  <div className="px-4 py-3 bg-background border-t border-border">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted">Resource:</span>
                        <span className="ml-2 font-mono text-foreground">
                          {event.resource}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted">Event ID:</span>
                        <span className="ml-2 font-mono text-foreground">
                          {event.id}
                        </span>
                      </div>
                    </div>
                    {event.details && (
                      <div className="mt-3 p-2 rounded bg-surface font-mono text-xs text-muted overflow-x-auto">
                        {event.details}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {data.total > data.events.length && (
              <p className="text-center text-sm text-muted pt-4">
                Showing {data.events.length} of {data.total} events
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
