import { HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./lib/AppContext";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import Supply from "./pages/Supply";
import Production from "./pages/Production";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Customers from "./pages/Customers";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <div className="flex min-h-screen bg-ink-950 text-ink-100 font-body">
          <Sidebar />
          <main className="flex-1 p-8 max-w-6xl">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/supply" element={<Supply />} />
              <Route path="/production" element={<Production />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AppProvider>
  );
}
