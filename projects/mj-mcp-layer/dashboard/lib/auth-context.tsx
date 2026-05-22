"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const TOKEN_STORAGE_KEY = "mj-brady-operator-token";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setToken(window.sessionStorage.getItem(TOKEN_STORAGE_KEY));
    setHydrated(true);
  }, []);

  const login = useCallback((nextToken: string) => {
    const trimmedToken = nextToken.trim();
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, trimmedToken);
    setToken(trimmedToken);
  }, []);

  const logout = useCallback(() => {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: hydrated && Boolean(token),
      login,
      logout,
    }),
    [hydrated, login, logout, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
