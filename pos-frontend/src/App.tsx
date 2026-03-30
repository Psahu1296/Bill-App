import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Home, Auth, Orders, Tables, Menu, Dashboard, OrderSummary, Consumables, AppUpdate, Staff, DataManagement, DishesPage, ServerStatus } from "./pages";
import Header from "./components/shared/Header";
import { ErrorBoundary } from "./components/shared";
import { useSelector } from "react-redux";
import useLoadData from "./hooks/useLoadData";
import FullScreenLoader from "./components/shared/FullScreenLoader";
import CustomerLedgerList from "./components/customerLedger/CustomerLedgerList";
import type { RootState } from "./redux/store";
import { NotificationProvider } from "./context/NotificationContext";
import { useAdminNotify } from "./hooks/useAdminNotify";

function Layout() {
  const isLoading = useLoadData();
  const location = useLocation();
  const hideHeaderRoutes = ["/auth"];
  const { isAuth } = useSelector((state: RootState) => state.user);

  if (isLoading) return <FullScreenLoader />;

  return (
    <>
      {!hideHeaderRoutes.includes(location.pathname) && <Header />}
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoutes>
              <Home />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/auth"
          element={isAuth ? <Navigate to="/" /> : <Auth />}
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoutes>
              <Orders />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/tables"
          element={
            <ProtectedRoutes>
              <Tables />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/menu"
          element={
            <ProtectedRoutes>
              <Menu />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoutes>
              <Dashboard />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/ledger"
          element={
            <ProtectedRoutes>
              <CustomerLedgerList />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/consumables"
          element={
            <ProtectedRoutes>
              <Consumables />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoutes>
              <Staff />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/app-update"
          element={
            <ProtectedRoutes>
              <AppUpdate />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/data-management"
          element={
            <ProtectedRoutes>
              <DataManagement />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/dashboard/dishes"
          element={
            <ProtectedRoutes>
              <DishesPage />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/order-summary"
          element={
            <ProtectedRoutes>
              <OrderSummary />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/server-status"
          element={
            <ProtectedRoutes>
              <ServerStatus />
            </ProtectedRoutes>
          }
        />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </>
  );
}

function ProtectedRoutes({ children }: { children: React.ReactNode }) {
  const { isAuth } = useSelector((state: RootState) => state.user);
  if (!isAuth) {
    return <Navigate to="/auth" />;
  }
  return <>{children}</>;
}

/** Mounts the SSE admin notification listener — only when authenticated */
function AdminNotifyMount() {
  const { isAuth } = useSelector((state: RootState) => state.user);
  useAdminNotify(isAuth);
  return null;
}

function App() {
  return (
    <NotificationProvider>
      <Router>
        <AdminNotifyMount />
        <ErrorBoundary>
          <Layout />
        </ErrorBoundary>
      </Router>
    </NotificationProvider>
  );
}

export default App;
