"use client";

import * as React from "react";

const STORAGE_KEY = "mahanya:selectedScenarioId";

interface ScenarioContextValue {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const ScenarioContext = React.createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedIdState] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedIdState(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const setSelectedId = React.useCallback((id: string | null) => {
    setSelectedIdState(id);
    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = React.useMemo(
    () => ({ selectedId, setSelectedId }),
    [selectedId, setSelectedId],
  );

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useSelectedScenario(): ScenarioContextValue {
  const ctx = React.useContext(ScenarioContext);
  if (!ctx) {
    throw new Error(
      "useSelectedScenario must be used within a ScenarioProvider",
    );
  }
  return ctx;
}
