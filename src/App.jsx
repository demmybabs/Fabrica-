import { HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./lib/AppContext";
import ThemeProvider from "./lib/ThemeProvider";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import Supply from "./pages/Supply";
import Products from "./pages/Products";
import Production from "./pages/Production";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Customers from "./pages/Customers";
import CustomerPortal from "./pages/CustomerPortal";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <AppProvider>
      <ThemeProvider>
        <HashRouter>
          <div className="flex flex-col md:flex-row min-h-screen bg-ink-950 text-ink-100 font-body">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 max-w-6xl w-full">
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/supply" element={<Supply />} />
                <Route path="/products" element={<Products />} />
                <Route path="/production" element={<Production />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customer-portal" element={<CustomerPortal />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
        </HashRouter>
      </ThemeProvider>
    </AppProvider>
  );
}
