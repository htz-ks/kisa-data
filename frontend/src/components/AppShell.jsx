import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck,
  FileText, BarChart3, Receipt, UserCog, LogOut, Smartphone, Tags, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Paneli", roles: ["admin", "employee"], tid: "nav-dashboard" },
  { to: "/pos", icon: ShoppingCart, label: "POS / Shitje", roles: ["admin", "employee"], tid: "nav-pos" },
  { to: "/products", icon: Package, label: "Produkte", roles: ["admin", "employee"], tid: "nav-products" },
  { to: "/categories", icon: Tags, label: "Kategoritë", roles: ["admin"], tid: "nav-categories" },
  { to: "/customers", icon: Users, label: "Klientët", roles: ["admin", "employee"], tid: "nav-customers" },
  { to: "/suppliers", icon: Truck, label: "Furnitorët", roles: ["admin"], tid: "nav-suppliers" },
  { to: "/purchases", icon: FileText, label: "Blerjet", roles: ["admin"], tid: "nav-purchases" },
  { to: "/sales", icon: Receipt, label: "Faturat", roles: ["admin", "employee"], tid: "nav-sales" },
  { to: "/payments", icon: CreditCard, label: "Pagesa / Borxhe", roles: ["admin"], tid: "nav-payments" },
  { to: "/reports", icon: BarChart3, label: "Raportet", roles: ["admin"], tid: "nav-reports" },
  { to: "/users", icon: UserCog, label: "Përdoruesit", roles: ["admin"], tid: "nav-users" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const items = NAV.filter((i) => i.roles.includes(user?.role));

  const onLogout = async () => {
    await logout();
    nav("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r border-slate-800 bg-[#0D131E] shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-slate-900" />
          </div>
          <div>
            <div className="font-extrabold tracking-tight">PRODATA</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono-pd">Stock & POS</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} data-testid={i.tid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                }`
              }>
              <i.icon className="w-4 h-4" />
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate" data-testid="current-user-name">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono-pd">{user?.role}</div>
            </div>
          </div>
          <Button onClick={onLogout} variant="ghost" size="sm"
            className="w-full justify-start text-slate-400 hover:text-red-300 hover:bg-red-500/10"
            data-testid="logout-btn">
            <LogOut className="w-4 h-4 mr-2" /> Dil
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D131E] border-t border-slate-800">
        <div className="grid grid-cols-5 gap-0">
          {items.slice(0, 5).map((i) => (
            <NavLink key={i.to} to={i.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-[10px] ${isActive ? "text-emerald-400" : "text-slate-400"}`
              }>
              <i.icon className="w-4 h-4" />
              <span>{i.label.split(" ")[0]}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
