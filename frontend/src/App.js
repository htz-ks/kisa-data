import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";
import AppShell from "@/components/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import CategoriesPage from "@/pages/CategoriesPage";
import ContactsPage from "@/pages/ContactsPage";
import PurchasesPage from "@/pages/PurchasesPage";
import POSPage from "@/pages/POSPage";
import SalesPage from "@/pages/SalesPage";
import PaymentsPage from "@/pages/PaymentsPage";
import ReportsPage from "@/pages/ReportsPage";
import UsersPage from "@/pages/UsersPage";
import PrintSalePage from "@/pages/PrintSalePage";
import ReturnsPage from "@/pages/ReturnsPage";
import SaleEntryPage from "@/pages/SaleEntryPage";

function Protected({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0B0F17] text-slate-500">Duke ngarkuar…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/print/sale/:id" element={<Protected><PrintSalePage /></Protected>} />
            <Route element={<Protected><AppShell /></Protected>}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pos" element={<POSPage />} />
              <Route path="/sale/new" element={<SaleEntryPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/categories" element={<Protected adminOnly><CategoriesPage /></Protected>} />
              <Route path="/customers" element={<ContactsPage kind="customer" />} />
              <Route path="/suppliers" element={<Protected adminOnly><ContactsPage kind="supplier" /></Protected>} />
              <Route path="/purchases" element={<Protected adminOnly><PurchasesPage /></Protected>} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/payments" element={<Protected adminOnly><PaymentsPage /></Protected>} />
              <Route path="/returns" element={<Protected adminOnly><ReturnsPage /></Protected>} />
              <Route path="/reports" element={<Protected adminOnly><ReportsPage /></Protected>} />
              <Route path="/users" element={<Protected adminOnly><UsersPage /></Protected>} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
