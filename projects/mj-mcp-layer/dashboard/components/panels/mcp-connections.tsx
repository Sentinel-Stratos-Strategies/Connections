"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { createFetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plug, Loader2, RefreshCw, Circle } from "lucide-react";

interface MCPConnection {
  id: string;
  name: string;
  provider: string;
  status: "connected" | "disconnected" | "degraded";
  latency?: number;
  lastPing?: string;
  requestsToday?: number;
}

interface ConnectionsResponse {
  connections: MCPConnection[];
}

const providerColors: Record<string, string> = {
  perplexity: "text-purple-400",
  codex: "text-green-400",
  openai: "text-emerald-400",
  anthropic: "text-orange-400",
  default: "text-accent",
};

export function MCPConnections() {
  const { token } = useAuth();
  const fetcher = createFetcher(token || "");

  const { data, error, isLoading, mutate } = useSWR<ConnectionsResponse>(
    token ? "/connections" : null,
    fetcher,
    { refreshInterval: 15000 }
  );

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "connected":
        return <Circle className="w-2 h-2 fill-success text-success" />;
      case "degraded":
        return <Circle className="w-2 h-2 fill-warning text-warning" />;
      default:
        return <Circle className="w-2 h-2 fill-danger text-danger" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge variant="success">Live</Badge>;
      case "degraded":
        return <Badge variant="warning">Degraded</Badge>;
      default:
        return <Badge variant="danger">Offline</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="w-4 h-4 text-accent" />
          Active MCP Connections
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
            Loading connections...
          </div>
        ) : error ? (
          <div className="text-center py-6 text-muted">
            <p>Failed to load connections</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : !data?.connections?.length ? (
          <div className="text-center py-6 text-muted">
            <p>No active connections</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border hover:border-border/80 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIndicator(conn.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${
                          providerColors[conn.provider.toLowerCase()] ||
                          providerColors.default
                        }`}
                      >
                        {conn.name}
                      </span>
                      {getStatusBadge(conn.status)}
                    </div>
                    <span className="text-xs text-muted capitalize">
                      {conn.provider}
                    </span>
                  </div>
                </div>

                <div className="text-right text-sm">
                  {conn.latency !== undefined && (
                    <div className="text-muted">
                      <span
                        className={
                          conn.latency < 100
                            ? "text-success"
                            : conn.latency < 300
                            ? "text-warning"
                            : "text-danger"
                        }
                      >
                        {conn.latency}ms
                      </span>
                    </div>
                  )}
                  {conn.requestsToday !== undefined && (
                    <div className="text-xs text-muted">
                      {conn.requestsToday.toLocaleString()} reqs today
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
