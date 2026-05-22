"use client";

import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";

interface DashboardLayoutContextType {
  pendingCommand: string | null;
  clearPendingCommand: () => void;
}

const DashboardLayoutContext = createContext<DashboardLayoutContextType>({
  pendingCommand: null,
  clearPendingCommand: () => {},
});

export const useDashboardLayout = () => useContext(DashboardLayoutContext);

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  const clearPendingCommand = useCallback(() => {
    setPendingCommand(null);
  }, []);

  const handleRunCommand = useCallback((command: string) => {
    setPendingCommand(command);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <DashboardLayoutContext.Provider value={{ pendingCommand, clearPendingCommand }}>
      <div className="min-h-screen bg-background">
        <Sidebar onCommandPalette={() => setCommandPaletteOpen(true)} />
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onRunCommand={handleRunCommand}
        />
        <main className="lg:pl-64 min-h-screen">
          <div className="p-4 lg:p-8 pt-16 lg:pt-8">{children}</div>
        </main>
      </div>
    </DashboardLayoutContext.Provider>
  );
}
