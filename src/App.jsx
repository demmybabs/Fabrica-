import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppAuthProvider, useAuth } from "./lib/AuthContext";
import { supabaseEnabled } from "./lib/supabaseClient";
import { AppProvider } from "./lib/AppContext";
import ThemeProvider from "./lib/ThemeProvider";
import Sidebar from "./components/Sidebar";
import ErrorBanner from "./components/ErrorBanner";
import { ConfirmProvider } from "./lib/ConfirmContext";
import Overview from "./pages/Overview";
import Supply from "./pages/Supply";
import SupplyDashboard from "./pages/SupplyDashboard";
import Products from "./pages/Products";
import Production from "./pages/Production";
import ProductionDashboard from "./pages/ProductionDashboard";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import SalesDashboard from "./pages/SalesDashboard";
import Customers from "./pages/Customers";
import CustomerPortal from "./pages/CustomerPortal";
import Financials from "./pages/Financials";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Team from "./pages/Team";
import { LoginScreen, NoAccessScreen, SetPasswordScreen, SuspendedScreen, OrgPicker } from "./pages/Login";

function Connecting() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 text-ink-400">
      <div className="chip">Connecting…</div>
    </div>
  );
}

// Decides what a visitor sees: sign-in, "no workspace", an organisation
// picker, the super-admin console, a suspended notice, or the app itself.
function AuthGate() {
  const { loading, session, access, recovering, isSuperAdmin, memberships, activeOrg, isOrgAdmin } = useAuth();

  if (!supabaseEnabled) return <AppShell orgId={null} isOrgAdmin />; // local-only mode

  if (loading) return <Connecting />;
  if (!session || !session.user?.email) return <LoginScreen />; // also covers leftover anonymous sessions
  if (recovering) return <SetPasswordScreen />;
  if (!access) return <Connecting />;
  if (!isSuperAdmin && memberships.length === 0) return <NoAccessScreen />;

  if (!activeOrg) return isSuperAdmin ? <Admin /> : <OrgPicker />;
  if (activeOrg.status === "suspended" && !isSuperAdmin) return <SuspendedScreen />;

  return <AppShell key={activeOrg.id} orgId={activeOrg.id} isOrgAdmin={isOrgAdmin} />;
}

function AppShell({ orgId, isOrgAdmin }) {
  return (
    <AppProvider orgId={orgId}>
      <ThemeProvider>
        <HashRouter>
            <ErrorBanner />
            <div className="flex flex-col md:flex-row min-h-screen bg-ink-950 text-ink-100 font-body">
              <Sidebar />
              <main className="flex-1 p-4 md:p-8 max-w-6xl w-full">
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/supply" element={<Supply />} />
                  <Route path="/supply/dashboard" element={<SupplyDashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/production" element={<Production />} />
                  <Route path="/production/dashboard" element={<ProductionDashboard />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/sales/dashboard" element={<SalesDashboard />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customer-portal" element={<CustomerPortal />} />
                  <Route path="/financials" element={<Financials />} />
                  <Route path="/settings" element={isOrgAdmin ? <Settings /> : <Navigate to="/" replace />} />
                  <Route path="/team" element={supabaseEnabled && isOrgAdmin ? <Team /> : <Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </HashRouter>
      </ThemeProvider>
    </AppProvider>
  );
}

export default function App() {
  return (
    <AppAuthProvider>
      <ConfirmProvider>
        <AuthGate />
      </ConfirmProvider>
    </AppAuthProvider>
  );
}
