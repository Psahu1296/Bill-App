import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { Provider } from "react-redux";
import store from "./redux/store";
import { SnackbarProvider } from "notistack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes — no refetch during this window
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes before garbage collection
      gcTime: 10 * 60 * 1000,
      // Don't refetch just because the user switched tabs or clicked back into the window
      refetchOnWindowFocus: false,
      // Don't re-fetch on mount if data is already in cache and not stale
      refetchOnMount: true,
      // Still retry failed requests once (network blips etc.)
      retry: 1,
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <SnackbarProvider autoHideDuration={3000}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </SnackbarProvider>
    </Provider>
  </StrictMode>
);
