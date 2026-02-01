'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

type FilterContextValue = {
  openFilter: () => void;
  showFilterButton: boolean;
  activeFilterCount: number;
  registerFilter: (open: () => void, show: boolean, count: number) => void;
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const openRef = useRef<() => void>(() => {});
  const [showFilterButton, setShowFilterButton] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const registerFilter = useCallback((open: () => void, show: boolean, count: number) => {
    openRef.current = open;
    setShowFilterButton(show);
    setActiveFilterCount(count);
  }, []);

  const openFilter = useCallback(() => {
    openRef.current();
  }, []);

  return (
    <FilterContext.Provider
      value={{
        openFilter,
        showFilterButton,
        activeFilterCount,
        registerFilter,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  return ctx;
}
