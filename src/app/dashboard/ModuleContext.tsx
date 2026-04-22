"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ModuleContextType {
  activeModule: string | null;
  setActiveModule: (module: string | null) => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModuleState] = useState<string | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("tripos_active_module");
    if (saved) {
      setActiveModuleState(saved);
    }
  }, []);

  const setActiveModule = (mod: string | null) => {
    setActiveModuleState(mod);
    if (mod) {
      localStorage.setItem("tripos_active_module", mod);
    } else {
      localStorage.removeItem("tripos_active_module");
    }
  };

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useActiveModule() {
  const context = useContext(ModuleContext);
  if (!context) throw new Error("useActiveModule must be used within ModuleProvider");
  return context;
}
