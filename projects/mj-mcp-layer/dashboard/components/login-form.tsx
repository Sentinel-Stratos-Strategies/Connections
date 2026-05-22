"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertCircle, Loader2 } from "lucide-react";

export function LoginForm() {
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!token.trim()) {
      setError("Please enter your operator token");
      return;
    }

    setLoading(true);
    
    // Validate token by attempting to hit the healthz endpoint
    try {
      const baseUrl = process.env.NEXT_PUBLIC_MCP_BASE_URL || "https://mcp.ellis-aegis.us";
      const response = await fetch(`${baseUrl}/healthz`, {
        headers: {
          "x-ellis-aegis-token": token.trim(),
        },
      });

      if (!response.ok) {
        throw new Error("Invalid token or server unavailable");
      }

      login(token.trim());
    } catch {
      setError("Authentication failed. Please check your token and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/20 border border-primary/30 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">MJ Brady</h1>
          <p className="text-muted mt-1">Deployment Operations Center</p>
        </div>

        <Card className="border-border/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Operator Login</CardTitle>
            <CardDescription className="text-center">
              Enter your operator token to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="token" className="text-sm font-medium text-foreground">
                  Operator Token
                </label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Enter your token..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="font-mono"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-danger/10 border border-danger/30 text-danger text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Access Dashboard"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-muted text-center">
                Secure access to MCP deployment infrastructure.
                <br />
                Contact your administrator if you need access.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted">
            Ellis Aegis Infrastructure | MJ Layer v0.1
          </p>
        </div>
      </div>
    </div>
  );
}
