import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "next-themes";

import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" enableSystem>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
