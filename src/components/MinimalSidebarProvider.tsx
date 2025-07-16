import * as React from "react";

// Minimal sidebar context that provides only what SidebarMenuButton needs
type MinimalSidebarContextProps = {
  state: "expanded" | "collapsed";
  isMobile: boolean;
};

const MinimalSidebarContext = React.createContext<MinimalSidebarContextProps | null>(null);

export function useMinimalSidebar() {
  const context = React.useContext(MinimalSidebarContext);
  if (!context) {
    throw new Error("useMinimalSidebar must be used within a MinimalSidebarProvider.");
  }
  return context;
}

export function MinimalSidebarProvider({ children }: { children: React.ReactNode }) {
  const contextValue = React.useMemo<MinimalSidebarContextProps>(
    () => ({
      state: "expanded", // Always expanded for resizable layout
      isMobile: false,   // Let's keep it simple for now
    }),
    []
  );

  return (
    <MinimalSidebarContext.Provider value={contextValue}>
      {children}
    </MinimalSidebarContext.Provider>
  );
}