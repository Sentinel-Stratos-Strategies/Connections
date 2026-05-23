import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearToken, setToken as persistToken } from "@/constants/storage";
import { STORAGE_KEYS } from "@/constants/config";
import * as SecureStore from "expo-secure-store";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEYS.TOKEN)
      .then((token) => setIsAuthenticated(Boolean(token)))
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated,
    isLoading,
    async login(token: string) {
      if (!token.trim()) return false;
      await persistToken(token.trim());
      setIsAuthenticated(true);
      return true;
    },
    async logout() {
      await clearToken();
      setIsAuthenticated(false);
    },
  }), [isAuthenticated, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
